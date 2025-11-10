import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // 'all', 'due', 'by_essay', 'by_topic'
    const essayId = searchParams.get("essayId");
    const topic = searchParams.get("topic");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabase = createServerClient();
    const userId = session.user.id as string;

    // Base query
    let query = supabase
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
          usage_notes,
          ielts_band_level,
          vocabulary_definition_tags(
            tag:vocabulary_tags(name)
          )
        ),
        essay:essays(title, created_at)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    // Apply filters
    if (filter === "due") {
      const now = new Date().toISOString();
      query = query.lte("next_review_date", now);
    } else if (filter === "by_essay" && essayId) {
      query = query.eq("essay_id", essayId);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching vocabulary:", error);
      return NextResponse.json(
        { error: "Failed to fetch vocabulary" },
        { status: 500 }
      );
    }

    // Get statistics
    const { data: stats } = await supabase
      .from("saved_vocabulary")
      .select("mastery_level", { count: "exact" })
      .eq("user_id", userId);

    const statistics = {
      total: stats?.length || 0,
      new: stats?.filter((v) => v.mastery_level === "new").length || 0,
      learning: stats?.filter((v) => v.mastery_level === "learning").length || 0,
      practiced: stats?.filter((v) => v.mastery_level === "practiced").length || 0,
      mastered: stats?.filter((v) => v.mastery_level === "mastered").length || 0,
    };

    // Get due count
    const now = new Date().toISOString();
    const { data: dueVocab } = await supabase
      .from("saved_vocabulary")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .lte("next_review_date", now);

    return NextResponse.json({
      vocabulary: data || [],
      statistics,
      dueCount: dueVocab?.length || 0,
      total: count || 0,
    });
  } catch (error) {
    console.error("Error in my-vocabulary API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to remove vocabulary from user's collection
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vocabularyId = searchParams.get("id");

    if (!vocabularyId) {
      return NextResponse.json(
        { error: "Vocabulary ID required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const userId = session.user.id as string;

    const { error } = await supabase
      .from("saved_vocabulary")
      .delete()
      .eq("id", vocabularyId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting vocabulary:", error);
      return NextResponse.json(
        { error: "Failed to delete vocabulary" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Vocabulary deleted successfully" });
  } catch (error) {
    console.error("Error in DELETE my-vocabulary:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
