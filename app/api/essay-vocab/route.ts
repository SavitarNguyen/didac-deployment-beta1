import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createServerClient } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const promptId = searchParams.get("prompt_id")

    if (!promptId) {
      return NextResponse.json({ error: "Prompt ID is required" }, { status: 400 })
    }

    const { data: suggestions, error } = await supabase
      .from("essay_vocab_suggestions")
      .select("*")
      .eq("prompt_id", promptId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching vocab suggestions:", error)
      return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 })
    }

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    const { prompt_id, content, suggestion_type } = await request.json()

    if (!prompt_id || !content) {
      return NextResponse.json({ error: "Prompt ID and content are required" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("essay_vocab_suggestions")
      .insert({
        prompt_id,
        content,
        suggestion_type: suggestion_type || "vocabulary",
        created_by: session.user.id,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating vocab suggestion:", error)
      return NextResponse.json({ error: "Failed to create suggestion" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
