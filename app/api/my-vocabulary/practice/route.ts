import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/my-vocabulary/practice
 * Fetches vocabulary items due for practice with their exercises
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const supabase = createServerClient();
    const userId = session.user.id as string;
    const now = new Date().toISOString();

    // Fetch vocabulary due for review
    const { data: dueVocabulary, error } = await supabase
      .from("saved_vocabulary")
      .select(`
        *,
        vocabulary:vocabulary_definitions(
          word,
          definition,
          vietnamese_translation,
          pronunciation,
          word_type,
          collocations,
          synonyms,
          related_words,
          ielts_band_level,
          vocabulary_definition_tags(
            tag:vocabulary_tags(name)
          )
        )
      `)
      .eq("user_id", userId)
      .lte("next_review_date", now)
      .order("next_review_date", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("Error fetching practice vocabulary:", error);
      return NextResponse.json(
        { error: "Failed to fetch practice vocabulary" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      vocabulary: dueVocabulary || [],
      count: dueVocabulary?.length || 0,
    });
  } catch (error) {
    console.error("Error in practice API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/my-vocabulary/practice
 * Updates vocabulary after practice session (spaced repetition)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      savedVocabularyId,
      exercisesCompleted,
      exercisesCorrect,
      pronunciationPlayed,
    } = body;

    if (!savedVocabularyId) {
      return NextResponse.json(
        { error: "Vocabulary ID required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const userId = session.user.id as string;

    // Get current vocabulary data
    const { data: currentVocab, error: fetchError } = await supabase
      .from("saved_vocabulary")
      .select("*")
      .eq("id", savedVocabularyId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !currentVocab) {
      return NextResponse.json(
        { error: "Vocabulary not found" },
        { status: 404 }
      );
    }

    // Calculate success rate
    const totalExercises = (currentVocab.exercises_completed || 0) + exercisesCompleted;
    const totalCorrect = (currentVocab.exercises_correct || 0) + exercisesCorrect;
    const successRate = totalExercises > 0 ? totalCorrect / totalExercises : 0;

    // Determine new mastery level and next review date
    const { masteryLevel, nextReviewDate } = calculateSpacedRepetition(
      currentVocab.mastery_level,
      successRate,
      currentVocab.review_count
    );

    // Update vocabulary
    const { error: updateError } = await supabase
      .from("saved_vocabulary")
      .update({
        mastery_level: masteryLevel,
        next_review_date: nextReviewDate,
        review_count: (currentVocab.review_count || 0) + 1,
        last_reviewed_at: new Date().toISOString(),
        exercises_completed: totalExercises,
        exercises_correct: totalCorrect,
        pronunciation_plays: (currentVocab.pronunciation_plays || 0) + (pronunciationPlayed ? 1 : 0),
      })
      .eq("id", savedVocabularyId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating vocabulary:", updateError);
      return NextResponse.json(
        { error: "Failed to update vocabulary" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Practice session completed",
      masteryLevel,
      nextReviewDate,
      successRate: Math.round(successRate * 100),
    });
  } catch (error) {
    console.error("Error in practice update API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Spaced Repetition Algorithm
 * Based on performance, determines next review date and mastery level
 */
function calculateSpacedRepetition(
  currentLevel: string,
  successRate: number,
  reviewCount: number
): { masteryLevel: string; nextReviewDate: string } {
  const now = new Date();
  let masteryLevel = currentLevel;
  let hoursToAdd = 0;

  // Performance thresholds
  const EXCELLENT = 0.9; // 90%+
  const GOOD = 0.7; // 70-89%
  const FAIR = 0.5; // 50-69%
  // Below 50% = needs more practice

  // Determine mastery progression
  if (successRate >= EXCELLENT) {
    // Excellent performance - advance mastery level
    switch (currentLevel) {
      case "new":
        masteryLevel = "learning";
        hoursToAdd = 4; // 4 hours
        break;
      case "learning":
        masteryLevel = reviewCount >= 2 ? "practiced" : "learning";
        hoursToAdd = 24; // 1 day
        break;
      case "practiced":
        masteryLevel = reviewCount >= 4 ? "mastered" : "practiced";
        hoursToAdd = 72; // 3 days
        break;
      case "mastered":
        masteryLevel = "mastered";
        hoursToAdd = 168; // 7 days
        break;
    }
  } else if (successRate >= GOOD) {
    // Good performance - maintain or slightly advance
    switch (currentLevel) {
      case "new":
        masteryLevel = "new";
        hoursToAdd = 2; // 2 hours
        break;
      case "learning":
        masteryLevel = "learning";
        hoursToAdd = 12; // 12 hours
        break;
      case "practiced":
        masteryLevel = "practiced";
        hoursToAdd = 48; // 2 days
        break;
      case "mastered":
        masteryLevel = "practiced"; // Demote slightly
        hoursToAdd = 72; // 3 days
        break;
    }
  } else if (successRate >= FAIR) {
    // Fair performance - repeat at same level
    switch (currentLevel) {
      case "new":
        hoursToAdd = 1; // 1 hour
        break;
      case "learning":
        hoursToAdd = 4; // 4 hours
        break;
      case "practiced":
        masteryLevel = "learning"; // Demote
        hoursToAdd = 12; // 12 hours
        break;
      case "mastered":
        masteryLevel = "practiced"; // Demote
        hoursToAdd = 24; // 1 day
        break;
    }
  } else {
    // Poor performance - demote and practice soon
    switch (currentLevel) {
      case "learning":
      case "practiced":
      case "mastered":
        masteryLevel = "new"; // Reset to new
        hoursToAdd = 0.5; // 30 minutes
        break;
      default:
        hoursToAdd = 0.5; // 30 minutes
    }
  }

  // Calculate next review date
  const nextReviewDate = new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000);

  return {
    masteryLevel,
    nextReviewDate: nextReviewDate.toISOString(),
  };
}
