import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createServerClient } from "@/lib/supabase-server"
import { v4 as uuidv4 } from "uuid"

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      console.log("No session or user found")
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin or teacher
    if (session.user.role !== "admin" && session.user.role !== "teacher") {
      console.log(`User role ${session.user.role} is not authorized`)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    console.log("Received flashcard data:", JSON.stringify(body))

    const { setId, word, definition, example } = body

    if (!setId || !word || !definition) {
      console.log("Missing required fields:", { setId, word, definition })
      return NextResponse.json({ message: "Set ID, word, and definition are required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Check if the set exists
    const { data: set, error: setError } = await supabase.from("flashcard_sets").select("id").eq("id", setId).single()

    if (setError) {
      console.error("Error checking flashcard set:", setError)
      return NextResponse.json({ message: "Flashcard set not found", error: setError }, { status: 404 })
    }

    console.log("Found flashcard set:", set)

    const now = new Date().toISOString()
    const flashcardId = uuidv4()

    // Create a simplified flashcard object with only the essential fields
    const insertData = {
      id: flashcardId,
      set_id: setId,
      word: word,
      definition: definition,
      example: example || null,
      created_at: now,
    }

    console.log("Inserting flashcard with data:", insertData)

    // Insert the flashcard with minimal required fields
    const { data, error } = await supabase.from("flashcards").insert(insertData).select()

    if (error) {
      console.error("Error creating flashcard:", error)

      // Try an even more minimal insert if the first one failed
      const minimalData = {
        id: flashcardId,
        set_id: setId,
        word: word,
        definition: definition,
      }

      console.log("Trying minimal insert with data:", minimalData)
      const { data: retryData, error: retryError } = await supabase.from("flashcards").insert(minimalData).select()

      if (retryError) {
        console.error("Error on minimal retry:", retryError)
        return NextResponse.json(
          {
            message: "Failed to create flashcard",
            error: retryError.message,
            details: retryError.details,
            hint: retryError.hint,
            code: retryError.code,
          },
          { status: 500 },
        )
      }

      console.log("Created flashcard on minimal retry:", retryData)

      // Manually update the card count
      try {
        await supabase
          .from("flashcard_sets")
          .update({ card_count: supabase.rpc("count_flashcards", { set_id: setId }) })
          .eq("id", setId)
      } catch (countError) {
        console.error("Error updating card count (non-critical):", countError)
      }

      return NextResponse.json(retryData[0], { status: 201 })
    }

    console.log("Created flashcard:", data)

    // Manually update the card count
    try {
      const { data: countData, error: countError } = await supabase
        .from("flashcard_sets")
        .update({ card_count: supabase.rpc("count_flashcards", { set_id: setId }) })
        .eq("id", setId)
        .select()

      if (countError) {
        console.error("Error updating card count:", countError)
      } else {
        console.log("Updated card count:", countData)
      }
    } catch (countError) {
      console.error("Error updating card count (non-critical):", countError)
    }

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/flashcards:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

