import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getSpeakingPracticesByUserId, createSpeakingPractice } from "@/lib/db/speaking"
import { incrementProgress } from "@/lib/db/progress"

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const userId = session.user.id as string

    const speakingPractices = await getSpeakingPracticesByUserId(userId, limit)

    return NextResponse.json(speakingPractices)
  } catch (error) {
    console.error("Error fetching speaking practices:", error)
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { audioUrl, transcript } = await request.json()

    // In a real app, this would call Deepseek AI for analysis
    // For now, we'll simulate AI feedback
    const score = Math.floor(Math.random() * 30) + 70 // Random score between 70-100

    const feedback = {
      pronunciation: [
        "Good pronunciation of most words",
        "Work on the 'th' sound in 'think' and 'through'",
        "The 'r' sound needs more emphasis",
      ],
      fluency: [
        "Good pace overall",
        "Some hesitation between sentences",
        "Try to reduce filler words like 'um' and 'uh'",
      ],
      intonation: [
        "Good variation in tone",
        "Questions should rise in pitch at the end",
        "Emphasize important words more clearly",
      ],
    }

    const result = await createSpeakingPractice({
      audioUrl,
      transcript,
      score,
      feedback,
      userId: session.user.id as string,
    })

    // Update user progress
    await incrementProgress(session.user.id as string, "speakingCompleted")

    return NextResponse.json(
      {
        _id: result.insertedId,
        audioUrl,
        transcript,
        score,
        feedback,
        userId: session.user.id,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error creating speaking practice:", error)
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
  }
}

