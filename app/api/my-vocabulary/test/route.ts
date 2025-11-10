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

    const supabase = createServerClient();
    const userId = session.user.id as string;

    console.log("Session user ID:", userId);
    console.log("Session user:", session.user);

    // Test: Check if user exists in auth.users
    const { data: authUser, error: authError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    console.log("Auth user lookup:", authUser, authError);

    // Test: Try to insert a simple vocabulary item
    const testVocabId = "00000000-0000-0000-0000-000000000001"; // Dummy UUID

    const { data: testInsert, error: insertError } = await supabase
      .from("saved_vocabulary")
      .insert({
        user_id: userId,
        vocabulary_id: testVocabId,
        source_type: "manual",
        example_sentence: "Test sentence",
        mastery_level: "new",
      })
      .select();

    return NextResponse.json({
      session: {
        userId,
        userEmail: session.user.email,
      },
      authUser,
      authError: authError?.message,
      testInsert,
      insertError: insertError?.message,
      insertErrorDetails: insertError,
    });
  } catch (error) {
    console.error("Test API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
