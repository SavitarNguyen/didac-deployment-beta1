import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createServerClient } from "@/lib/supabase-server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = 'force-dynamic';

const apiKey = process.env.GEMINI_API_KEY || "";
const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const genAI = new GoogleGenerativeAI(apiKey);

interface ExerciseGenerationRequest {
  vocabularyId: string; // vocabulary_definitions.id
  word: string;
  definition: string;
  exampleSentence: string;
}

/**
 * POST /api/my-vocabulary/exercises
 * Gets or generates exercises for a vocabulary item (hybrid approach)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ExerciseGenerationRequest = await request.json();
    const { vocabularyId, word, definition, exampleSentence } = body;

    if (!vocabularyId || !word) {
      return NextResponse.json(
        { error: "Vocabulary ID and word are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Step 1: Check if exercises already exist in database (hybrid approach)
    const { data: existingExercises, error: fetchError } = await supabase
      .from("vocabulary_exercise_bank")
      .select("*")
      .eq("vocabulary_id", vocabularyId);

    if (!fetchError && existingExercises && existingExercises.length >= 2) {
      // We have exercises - return them
      console.log(`Reusing existing exercises for: ${word}`);

      // Increment usage count
      for (const exercise of existingExercises) {
        await supabase
          .from("vocabulary_exercise_bank")
          .update({ times_used: (exercise.times_used || 0) + 1 })
          .eq("id", exercise.id);
      }

      return NextResponse.json({
        exercises: existingExercises,
        source: "database",
      });
    }

    // Step 2: Generate new exercises using AI
    console.log(`Generating new exercises for: ${word}`);

    const exercises = await generateExercises(word, definition, exampleSentence);

    // Step 3: Save exercises to database for future use
    const savedExercises = [];

    for (const exercise of exercises) {
      const { data: savedExercise, error: saveError } = await supabase
        .from("vocabulary_exercise_bank")
        .insert({
          vocabulary_id: vocabularyId,
          exercise_type: exercise.type,
          question: exercise.question,
          correct_answer: exercise.correctAnswer,
          options: exercise.options,
          explanation: exercise.explanation,
          difficulty_level: "medium",
          times_used: 1,
        })
        .select()
        .single();

      if (!saveError && savedExercise) {
        savedExercises.push(savedExercise);
      }
    }

    return NextResponse.json({
      exercises: savedExercises,
      source: "ai_generated",
    });
  } catch (error) {
    console.error("Error in exercises API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Generates exercises using Gemini AI
 */
async function generateExercises(
  word: string,
  definition: string,
  exampleSentence: string
): Promise<any[]> {
  const prompt = `You are an expert IELTS vocabulary teacher. Generate 2 multiple-choice exercises to help students learn this vocabulary:

**Word:** ${word}
**Definition:** ${definition}
**Example:** ${exampleSentence}

Generate the following exercises:

1. **MCQ - Meaning:** Test understanding of the word's definition
2. **MCQ - Context:** Test ability to use the word in the correct context

For each exercise:
- Create 4 options (1 correct, 3 distractors)
- Distractors should be plausible but clearly wrong
- Make questions at IELTS Band 6-7 difficulty level
- Provide a brief explanation of why the correct answer is right

**Response format (JSON ONLY):**
{
  "exercises": [
    {
      "type": "mcq_meaning",
      "question": "What does '${word}' mean?",
      "correctAnswer": "The correct definition",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "explanation": "Brief explanation why this is correct"
    },
    {
      "type": "mcq_context",
      "question": "Choose the sentence where '${word}' is used correctly:",
      "correctAnswer": "The correct sentence",
      "options": ["Sentence 1", "Sentence 2", "Sentence 3", "Sentence 4"],
      "explanation": "Brief explanation"
    }
  ]
}

**IMPORTANT:**
- For MCQ context, use simple words in the sentences (to avoid cognitive overload as per user requirements)
- Only test the target vocabulary, not other difficult words
- Make sentences realistic and natural
- Shuffle the position of the correct answer in the options array`;

  try {
    const geminiModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await geminiModel.generateContent([prompt]);
    const response = await result.response;
    const data = JSON.parse(response.text());

    return data.exercises || [];
  } catch (error) {
    console.error("Error generating exercises:", error);

    // Fallback exercises
    return [
      {
        type: "mcq_meaning",
        question: `What does '${word}' mean?`,
        correctAnswer: definition,
        options: [definition, "Something else", "Another option", "Different meaning"],
        explanation: "This is the correct definition.",
      },
      {
        type: "mcq_context",
        question: `Choose the sentence where '${word}' is used correctly:`,
        correctAnswer: exampleSentence,
        options: [
          exampleSentence,
          `The ${word} is very important.`,
          `I need to ${word} today.`,
          `This is a ${word} situation.`,
        ],
        explanation: "This sentence uses the word correctly in context.",
      },
    ];
  }
}

/**
 * POST /api/my-vocabulary/exercises/record
 * Records an exercise attempt for analytics
 */
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      savedVocabularyId,
      exerciseId,
      exerciseType,
      isCorrect,
      timeTaken,
    } = body;

    if (!savedVocabularyId || !exerciseType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const userId = session.user.id as string;

    // Record attempt
    const { error } = await supabase
      .from("vocabulary_exercise_attempts")
      .insert({
        user_id: userId,
        saved_vocabulary_id: savedVocabularyId,
        exercise_id: exerciseId,
        exercise_type: exerciseType,
        is_correct: isCorrect,
        time_taken_seconds: timeTaken,
      });

    if (error) {
      console.error("Error recording exercise attempt:", error);
      return NextResponse.json(
        { error: "Failed to record attempt" },
        { status: 500 }
      );
    }

    // Update exercise success rate if exerciseId provided
    if (exerciseId) {
      const { data: attempts } = await supabase
        .from("vocabulary_exercise_attempts")
        .select("is_correct")
        .eq("exercise_id", exerciseId);

      if (attempts && attempts.length > 0) {
        const successRate =
          attempts.filter((a) => a.is_correct).length / attempts.length;

        await supabase
          .from("vocabulary_exercise_bank")
          .update({ success_rate: successRate })
          .eq("id", exerciseId);
      }
    }

    return NextResponse.json({ message: "Attempt recorded" });
  } catch (error) {
    console.error("Error in record attempt API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
