import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createServerClient } from "@/lib/supabase-server"
import { v4 as uuidv4 } from "uuid"

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ 
        message: "Please log in to view flashcard sets",
        requiresAuth: true 
      }, { status: 401 })
    }

    const supabase = createServerClient()

    // Get all flashcard sets with their card counts
    const { data, error } = await supabase
      .from("flashcard_sets")
      .select("id, title, description, slug, card_count, created_at")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching flashcard sets:", error)
      return NextResponse.json({ message: "Error fetching flashcard sets", error }, { status: 500 })
    }

    // If any set is missing a card_count, update it
    const setsToUpdate = data.filter((set) => set.card_count === null || set.card_count === undefined)

    if (setsToUpdate.length > 0) {
      console.log(`Updating card counts for ${setsToUpdate.length} sets`)

      for (const set of setsToUpdate) {
        // Count the flashcards for this set
        const { count, error: countError } = await supabase
          .from("flashcards")
          .select("id", { count: "exact", head: true })
          .eq("set_id", set.id)

        if (!countError) {
          // Update the set with the correct count
          await supabase.from("flashcard_sets").update({ card_count: count }).eq("id", set.id)

          // Update the count in our response data
          set.card_count = count
        }
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in GET /api/flashcards/sets:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin or teacher
    if (session.user.role !== "admin" && session.user.role !== "teacher") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, slug } = body

    if (!title) {
      return NextResponse.json({ message: "Title is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Create a new set with initial card_count of 0
    const { data, error } = await supabase
      .from("flashcard_sets")
      .insert({
        id: uuidv4(),
        title,
        description: description || "",
        slug: slug || title.toLowerCase().replace(/\s+/g, "-"),
        card_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()

    if (error) {
      console.error("Error creating flashcard set:", error)
      return NextResponse.json({ message: "Error creating flashcard set", error }, { status: 500 })
    }

    return NextResponse.json(data[0], { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/flashcards/sets:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

