import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getEssaysByUserId, createEssay } from "@/lib/db/essays"
import { incrementProgress } from "@/lib/db/progress"
import { selectVocabularyForLearning } from "@/lib/ielts/vocabularySelector"
import { IELTSFeedback } from "@/lib/types/ielts"

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "12")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const offset = (page - 1) * limit
    const userId = session.user.id as string

    const result = await getEssaysByUserId(userId, { limit, offset })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching essays:", error)
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { title, content, correctedContent, score, feedback, level } = await request.json()

    // If feedback exists and is IELTS feedback, add vocabulary selection
    let enhancedFeedback = feedback
    if (feedback && feedback.sentences && feedback.sentences.length > 0) {
      try {
        const ieltsFeedback = feedback as IELTSFeedback
        const selectedVocabulary = await selectVocabularyForLearning(ieltsFeedback, level)

        // Add selected vocabulary to feedback
        enhancedFeedback = {
          ...ieltsFeedback,
          selectedVocabulary,
        }

        console.log(`Selected ${selectedVocabulary.length} vocabulary items for essay: ${title}`)
      } catch (vocabError) {
        console.error("Error selecting vocabulary, continuing without it:", vocabError)
        // Continue without vocabulary selection if it fails
      }
    }

    const result = await createEssay({
      title,
      content,
      correctedContent,
      score,
      feedback: enhancedFeedback,
      level,
      userId: session.user.id as string,
      isFlagged: false,
    })

    // Update user progress
    await incrementProgress(session.user.id as string, "essaysCompleted")

    return NextResponse.json(
      {
        _id: result.insertedId,
        title,
        content,
        correctedContent,
        score,
        feedback: enhancedFeedback,
        level,
        userId: session.user.id,
        isFlagged: false,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error creating essay:", error)
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
  }
}

