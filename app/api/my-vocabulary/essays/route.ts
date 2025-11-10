import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createServerClient } from "@/lib/supabase-server";

// Force dynamic rendering for this route as it uses session/headers
export const dynamic = 'force-dynamic';

/**
 * GET endpoint to fetch unique essay sources from user's saved vocabulary
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();
    const userId = session.user.id as string;

    // Fetch all saved vocabulary with essay information
    const { data: vocabData, error } = await supabase
      .from("saved_vocabulary")
      .select(`
        id,
        essay_id,
        essay:essays(
          id,
          title,
          created_at
        )
      `)
      .eq("user_id", userId)
      .not("essay_id", "is", null);

    console.log("Vocab data with essays:", vocabData);
    console.log("Query error:", error);

    if (error) {
      console.error("Error fetching essay sources:", error);
      return NextResponse.json(
        { error: "Failed to fetch essay sources" },
        { status: 500 }
      );
    }

    // Group by essay and count words
    const essayMap = new Map<string, {
      id: string;
      title: string;
      wordCount: number;
      createdAt: string;
    }>();

    vocabData?.forEach((item) => {
      if (item.essay) {
        const essayId = item.essay.id;
        if (essayMap.has(essayId)) {
          const existing = essayMap.get(essayId)!;
          existing.wordCount += 1;
        } else {
          essayMap.set(essayId, {
            id: essayId,
            title: item.essay.title,
            wordCount: 1,
            createdAt: item.essay.created_at,
          });
        }
      }
    });

    // Convert map to array and sort by word count (descending)
    const essays = Array.from(essayMap.values()).sort(
      (a, b) => b.wordCount - a.wordCount
    );

    return NextResponse.json({
      essays,
      total: essays.length,
    });
  } catch (error) {
    console.error("Error in my-vocabulary/essays API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
