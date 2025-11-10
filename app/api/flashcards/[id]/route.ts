import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getFlashcardById, updateFlashcard, deleteFlashcard } from "@/lib/db/flashcards"
import { incrementProgress } from "@/lib/db/progress"

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id } = params
    const { isLearned, needsReview } = await request.json()

    // Check if the flashcard belongs to the user
    const flashcard = await getFlashcardById(id)

    if (!flashcard || flashcard.userId !== session.user.id) {
      return NextResponse.json({ message: "Flashcard not found or unauthorized" }, { status: 404 })
    }

    // Update the flashcard
    await updateFlashcard(id, {
      isLearned,
      needsReview,
    })

    // Update user progress if the card is marked as learned
    if (isLearned && !flashcard.isLearned) {
      await incrementProgress(session.user.id as string, "wordsLearned")
    }

    return NextResponse.json({
      ...flashcard,
      isLearned,
      needsReview,
    })
  } catch (error) {
    console.error("Error updating flashcard:", error)
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id } = params

    // Check if the flashcard belongs to the user or if user is admin
    const flashcard = await getFlashcardById(id)

    if (!flashcard || (flashcard.userId !== session.user.id && session.user.role !== "admin")) {
      return NextResponse.json({ message: "Flashcard not found or unauthorized" }, { status: 404 })
    }

    // Delete the flashcard
    await deleteFlashcard(id)

    return NextResponse.json({ message: "Flashcard deleted successfully" })
  } catch (error) {
    console.error("Error deleting flashcard:", error)
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
  }
}

