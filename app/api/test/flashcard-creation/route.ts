import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createServerClient } from "@/lib/supabase-server"
import { v4 as uuidv4 } from "uuid"

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { setId } = body

    if (!setId) {
      return NextResponse.json({ message: "Set ID is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Check if the set exists
    const { data: set, error: setError } = await supabase
      .from("flashcard_sets")
      .select("id, title")
      .eq("id", setId)
      .single()

    if (setError) {
      return NextResponse.json(
        {
          message: "Flashcard set not found",
          error: setError,
        },
        { status: 404 },
      )
    }

    // Create a test flashcard
    const testId = uuidv4()
    const now = new Date().toISOString()

    const testFlashcard = {
      id: testId,
      set_id: setId,
      d: setId,
      word: `Test Word ${now}`,
      definition: "This is a test definition created by the test endpoint",
      example: "This is a test example sentence.",
      created_at: now,
    }

    console.log("Creating test flashcard:", testFlashcard)

    // Try to insert with minimal fields first
    const { data, error } = await supabase.from("flashcards").insert(testFlashcard).select()

    if (error) {
      console.error("Error creating test flashcard:", error)

      // Try with even fewer fields
      const minimalFlashcard = {
        id: testId,
        set_id: setId,
        word: `Test Word ${now}`,
        definition: "This is a test definition created by the test endpoint",
      }

      console.log("Trying with minimal fields:", minimalFlashcard)

      const { data: minimalData, error: minimalError } = await supabase
        .from("flashcards")
        .insert(minimalFlashcard)
        .select()

      if (minimalError) {
        return NextResponse.json(
          {
            message: "Failed to create test flashcard",
            error: minimalError,
            testFlashcard,
            minimalFlashcard,
          },
          { status: 500 },
        )
      }

      // Update the card count
      await supabase
        .from("flashcard_sets")
        .update({ card_count: supabase.rpc("count_flashcards", { set_id: setId }) })
        .eq("id", setId)

      return NextResponse.json({
        message: "Created test flashcard with minimal fields",
        flashcard: minimalData[0],
        set,
      })
    }

    // Update the card count
    await supabase
      .from("flashcard_sets")
      .update({ card_count: supabase.rpc("count_flashcards", { set_id: setId }) })
      .eq("id", setId)

    return NextResponse.json({
      message: "Created test flashcard successfully",
      flashcard: data[0],
      set,
    })
  } catch (error) {
    console.error("Error in test flashcard creation:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

