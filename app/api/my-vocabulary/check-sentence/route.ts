import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createServerClient } from "@/lib/supabase-server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';

const apiKey = process.env.GEMINI_API_KEY || "";
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const genAI = new GoogleGenerativeAI(apiKey);

interface CheckSentenceRequest {
  savedVocabularyId: string;
  word: string;
  sentence: string;
  definition: string;
  exampleSentence: string;
}

/**
 * POST /api/my-vocabulary/check-sentence
 * Checks a student-written sentence using AI and provides feedback
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CheckSentenceRequest = await request.json();
    const {
      savedVocabularyId,
      word,
      sentence,
      definition,
      exampleSentence,
    } = body;

    if (!savedVocabularyId || !word || !sentence) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check sentence with AI
    const feedback = await checkSentenceWithAI(
      word,
      sentence,
      definition,
      exampleSentence
    );

    // Save to database
    const supabase = createServerClient();
    const userId = session.user.id as string;

    const { data: savedSentence, error } = await supabase
      .from("student_sentences")
      .insert({
        user_id: userId,
        saved_vocabulary_id: savedVocabularyId,
        sentence: sentence,
        is_correct: feedback.isCorrect,
        ai_feedback: feedback,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving sentence:", error);
      // Continue even if save fails - return feedback to user
    }

    return NextResponse.json({
      feedback,
      sentenceId: savedSentence?.id,
    });
  } catch (error) {
    console.error("Error in check-sentence API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Checks student sentence using Gemini AI
 */
async function checkSentenceWithAI(
  word: string,
  studentSentence: string,
  definition: string,
  exampleSentence: string
): Promise<any> {
  const prompt = `You are an expert IELTS writing tutor. A student is learning the vocabulary word "${word}".

**Word:** ${word}
**Definition:** ${definition}
**Good Example:** ${exampleSentence}

**Student's Sentence:** "${studentSentence}"

Please check if the student used the word correctly and provide constructive feedback.

**Evaluation Criteria:**
1. Is the word used correctly in context?
2. Is the grammar correct?
3. Is the sentence natural and meaningful?
4. Is it appropriate for IELTS academic writing?

**Response format (JSON ONLY):**
{
  "isCorrect": true/false,
  "feedback": "Brief encouraging feedback (2-3 sentences)",
  "correctedSentence": "Corrected version (if needed, otherwise same as student's)",
  "grammarTips": "Specific grammar tips if there are errors (or empty string)",
  "betterExample": "A more sophisticated alternative sentence using the same word",
  "encouragement": "Positive, encouraging message"
}

**Guidelines:**
- Be encouraging and constructive
- If the sentence is good, praise the student
- If there are errors, explain them clearly in Vietnamese or English (student preference)
- Suggest improvements even if the sentence is correct
- Keep feedback brief and actionable`;

  try {
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await geminiModel.generateContent([prompt]);
    const response = await result.response;
    const feedback = JSON.parse(response.text());

    return feedback;
  } catch (error) {
    console.error("Error checking sentence with AI:", error);

    // Fallback feedback
    return {
      isCorrect: true,
      feedback: `Good attempt at using "${word}" in a sentence! Keep practicing to improve your vocabulary usage.`,
      correctedSentence: studentSentence,
      grammarTips: "",
      betterExample: exampleSentence,
      encouragement: "Great effort! Continue practicing to master this word.",
    };
  }
}

/**
 * GET /api/my-vocabulary/check-sentence
 * Gets previous sentence attempts for a vocabulary item
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const savedVocabularyId = searchParams.get("savedVocabularyId");

    if (!savedVocabularyId) {
      return NextResponse.json(
        { error: "Vocabulary ID required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const userId = session.user.id as string;

    const { data: sentences, error } = await supabase
      .from("student_sentences")
      .select("*")
      .eq("user_id", userId)
      .eq("saved_vocabulary_id", savedVocabularyId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching sentences:", error);
      return NextResponse.json(
        { error: "Failed to fetch sentences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sentences: sentences || [],
    });
  } catch (error) {
    console.error("Error in get sentences API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
