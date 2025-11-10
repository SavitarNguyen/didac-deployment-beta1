import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createServerClient } from "@/lib/supabase-server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';

const apiKey = process.env.GEMINI_API_KEY || "";
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const genAI = new GoogleGenerativeAI(apiKey);

interface SaveVocabularyRequest {
  word: string;
  type: 'word' | 'phrase' | 'collocation';
  original: string; // The word/phrase it replaces
  exampleSentence: string; // From the corrected essay
  sourceType: 'essay_correction' | 'ideas_generator' | 'manual';
  essayId?: string;
  sentenceId?: string;
  definition?: string; // Optional: if client already has it
  vietnameseTranslation?: string; // Optional
  explanation?: string; // Optional
  tags?: string[]; // Optional topic tags
  ieltsLevel?: string; // Optional band level
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: SaveVocabularyRequest = await request.json();
    const {
      word,
      type,
      original,
      exampleSentence,
      sourceType,
      essayId,
      sentenceId,
      definition,
      vietnameseTranslation,
      explanation,
      tags = ['general'],
      ieltsLevel = 'Band 6.0-7.0',
    } = body;

    // Validate required fields
    if (!word || !type || !original || !exampleSentence || !sourceType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const userId = session.user.id as string;

    // Step 1: Check if vocabulary already exists in shared database
    const { data: existingVocab, error: fetchError } = await supabase
      .from("vocabulary_definitions")
      .select("*")
      .eq("word", word.toLowerCase())
      .single();

    let vocabularyId: string;
    let vocabularyDefinition: any;

    if (existingVocab && !fetchError) {
      // Vocabulary exists - reuse it (hybrid approach)
      vocabularyId = existingVocab.id;
      vocabularyDefinition = existingVocab;

      // Increment usage count
      await supabase
        .from("vocabulary_definitions")
        .update({ times_used: (existingVocab.times_used || 0) + 1 })
        .eq("id", vocabularyId);

      console.log(`Reusing existing vocabulary: ${word}`);
    } else {
      // Vocabulary doesn't exist - generate definition using AI
      console.log(`Generating new vocabulary definition for: ${word}`);

      const vocabData = await generateVocabularyDefinition(
        word,
        type,
        exampleSentence,
        definition,
        vietnameseTranslation,
        explanation
      );

      // Save to shared vocabulary database
      const { data: newVocab, error: insertError } = await supabase
        .from("vocabulary_definitions")
        .insert({
          word: word.toLowerCase(),
          definition: vocabData.definition,
          vietnamese_translation: vocabData.vietnameseTranslation,
          pronunciation: vocabData.pronunciation,
          word_type: type,
          collocations: vocabData.collocations,
          synonyms: vocabData.synonyms,
          related_words: vocabData.relatedWords,
          usage_notes: vocabData.usageNotes,
          ielts_band_level: ieltsLevel,
          example_sentences: [exampleSentence],
          times_used: 1,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting vocabulary:", insertError);
        return NextResponse.json(
          { error: "Failed to save vocabulary definition" },
          { status: 500 }
        );
      }

      vocabularyId = newVocab.id;
      vocabularyDefinition = newVocab;

      // Save tags
      if (tags && tags.length > 0) {
        await saveTags(supabase, vocabularyId, tags);
      }
    }

    // Step 2: Check if user has already saved this vocabulary
    const { data: existingSaved } = await supabase
      .from("saved_vocabulary")
      .select("id")
      .eq("user_id", userId)
      .eq("vocabulary_id", vocabularyId)
      .single();

    if (existingSaved) {
      return NextResponse.json(
        {
          message: "Vocabulary already saved",
          vocabularyId: existingSaved.id,
        },
        { status: 200 }
      );
    }

    // Step 3: Save to user's vocabulary collection
    const { data: savedVocab, error: saveError } = await supabase
      .from("saved_vocabulary")
      .insert({
        user_id: userId,
        vocabulary_id: vocabularyId,
        source_type: sourceType,
        essay_id: essayId,
        example_sentence: exampleSentence,
        mastery_level: 'new',
        next_review_date: getInitialReviewDate(), // Review in 10 minutes
        review_count: 0,
        exercises_completed: 0,
        exercises_correct: 0,
        pronunciation_plays: 0,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving to user's vocabulary:", saveError);
      return NextResponse.json(
        { error: "Failed to save vocabulary to your collection" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Vocabulary saved successfully",
      vocabulary: {
        id: savedVocab.id,
        word,
        definition: vocabularyDefinition.definition,
        vietnameseTranslation: vocabularyDefinition.vietnamese_translation,
        exampleSentence,
        tags,
        masteryLevel: 'new',
        nextReviewDate: savedVocab.next_review_date,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Error in save vocabulary API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Generates vocabulary definition using Gemini AI
 */
async function generateVocabularyDefinition(
  word: string,
  type: string,
  exampleSentence: string,
  providedDefinition?: string,
  providedVietnamese?: string,
  providedExplanation?: string
): Promise<{
  definition: string;
  vietnameseTranslation: string;
  pronunciation: string;
  collocations: string[];
  synonyms: string[];
  relatedWords: string[];
  usageNotes: string;
}> {
  // If client provided all data, use it
  if (providedDefinition && providedVietnamese) {
    return {
      definition: providedDefinition,
      vietnameseTranslation: providedVietnamese,
      pronunciation: "", // Will be filled by TTS
      collocations: [],
      synonyms: [],
      relatedWords: [],
      usageNotes: providedExplanation || "",
    };
  }

  // Otherwise, generate using AI
  const prompt = `You are an expert IELTS vocabulary instructor. Generate comprehensive information for this vocabulary item:

**Word/Phrase:** ${word}
**Type:** ${type}
**Example from essay:** ${exampleSentence}

Generate the following information:
1. **Definition:** Clear, concise English definition (1-2 sentences)
2. **Vietnamese Translation:** Accurate Vietnamese translation
3. **Pronunciation:** IPA phonetic notation
4. **Collocations:** 2-3 common word combinations (if applicable)
5. **Synonyms:** 2-3 academic synonyms
6. **Related Words:** 2-3 related vocabulary items
7. **Usage Notes:** Brief note on when/how to use this vocabulary

Response format (JSON ONLY):
{
  "definition": "...",
  "vietnameseTranslation": "...",
  "pronunciation": "/.../",
  "collocations": ["...", "..."],
  "synonyms": ["...", "..."],
  "relatedWords": ["...", "..."],
  "usageNotes": "..."
}`;

  try {
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await geminiModel.generateContent([prompt]);
    const response = await result.response;
    const vocabData = JSON.parse(response.text());

    return vocabData;
  } catch (error) {
    console.error("Error generating vocabulary definition:", error);

    // Fallback to basic data
    return {
      definition: providedDefinition || `Meaning of ${word}`,
      vietnameseTranslation: providedVietnamese || `Bản dịch của ${word}`,
      pronunciation: "",
      collocations: [],
      synonyms: [],
      relatedWords: [],
      usageNotes: providedExplanation || "",
    };
  }
}

/**
 * Saves tags for vocabulary
 */
async function saveTags(supabase: any, vocabularyId: string, tags: string[]) {
  // Get or create tags
  for (const tagName of tags) {
    // Check if tag exists
    const { data: existingTag } = await supabase
      .from("vocabulary_tags")
      .select("id")
      .eq("name", tagName)
      .single();

    let tagId: string;

    if (existingTag) {
      tagId = existingTag.id;
    } else {
      // Create new tag
      const { data: newTag } = await supabase
        .from("vocabulary_tags")
        .insert({ name: tagName, description: `${tagName} related vocabulary` })
        .select()
        .single();

      if (!newTag) continue;
      tagId = newTag.id;
    }

    // Link tag to vocabulary
    await supabase
      .from("vocabulary_definition_tags")
      .insert({
        vocabulary_id: vocabularyId,
        tag_id: tagId,
      })
      .onConflict("vocabulary_id, tag_id")
      .ignoreDuplicates();
  }
}

/**
 * Gets initial review date (immediate for new vocabulary so they can practice right away)
 */
function getInitialReviewDate(): string {
  const now = new Date();
  // Set to now so vocabulary can be practiced immediately
  return now.toISOString();
}
