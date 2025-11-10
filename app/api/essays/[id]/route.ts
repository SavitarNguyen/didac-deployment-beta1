import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { getEssayById, deleteEssay } from "@/lib/db/essays"

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const essay = await getEssayById(params.id)

    if (!essay) {
      return NextResponse.json({ message: "Essay not found" }, { status: 404 })
    }

    // Check if the essay belongs to the requesting user
    if (essay.userId !== session.user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(essay)
  } catch (error) {
    console.error("Error fetching essay:", error)
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const essay = await getEssayById(params.id)

    if (!essay) {
      return NextResponse.json({ message: "Essay not found" }, { status: 404 })
    }

    // Check if the essay belongs to the requesting user
    if (essay.userId !== session.user.id) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    await deleteEssay(params.id, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting essay:", error)
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
  }
}
