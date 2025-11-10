import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { createServerClient } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerClient()

    const { data: topics, error } = await supabase
      .from("essay_topics")
      .select("*")
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching essay topics:", error)
      return NextResponse.json({ error: "Failed to fetch topics" }, { status: 500 })
    }

    return NextResponse.json(topics)
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

    const { name, description } = await request.json()

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from("essay_topics")
      .insert({
        name,
        description,
        created_by: session.user.id,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating topic:", error)
      return NextResponse.json({ error: "Failed to create topic" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
