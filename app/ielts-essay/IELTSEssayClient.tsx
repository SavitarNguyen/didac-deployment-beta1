"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Send, Loader2, Save, BookOpen, Plus, Trash2 } from "lucide-react"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { FullScreenFeedbackView } from "@/components/ielts/FullScreenFeedbackView"
import { IdeasGenerator } from "@/components/ielts/IdeasGenerator"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { IELTSFeedback } from "@/lib/types/ielts"

interface Topic {
  id: string
  name: string
  description: string
}

interface Prompt {
  id: string
  topic_id: string
  title: string
  description: string
}

interface VocabSuggestion {
  id: string
  prompt_id: string
  content: string
  suggestion_type: string
}

export function IELTSEssayClient() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [essayText, setEssayText] = useState("")
  const [essayTitle, setEssayTitle] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<IELTSFeedback | null>(null)
  const [streamingText, setStreamingText] = useState("")
  const [showFeedback, setShowFeedback] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState("")
  const [selectedLevel, setSelectedLevel] = useState<'5.0_or_below' | '5.5_to_6.5' | '7.0_or_above'>('5.5_to_6.5')

  // Topic selector state
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<string>("")
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState<string>("")
  const [vocabSuggestions, setVocabSuggestions] = useState<VocabSuggestion[]>([])

  // Custom prompt state
  const [isCustomPrompt, setIsCustomPrompt] = useState(false)
  const [customPromptText, setCustomPromptText] = useState("")
  const [promptInputAnimation, setPromptInputAnimation] = useState(false)

  // Draft auto-save
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const [isLoadingDraft, setIsLoadingDraft] = useState(false)

  // Admin topic/prompt creation
  const [showAddTopicDialog, setShowAddTopicDialog] = useState(false)
  const [showAddPromptDialog, setShowAddPromptDialog] = useState(false)
  const [newTopicName, setNewTopicName] = useState("")
  const [newTopicDescription, setNewTopicDescription] = useState("")
  const [newPromptTitle, setNewPromptTitle] = useState("")
  const [newPromptDescription, setNewPromptDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // Admin topic/prompt deletion
  const [deletingTopic, setDeletingTopic] = useState<Topic | null>(null)
  const [deletingPrompt, setDeletingPrompt] = useState<Prompt | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Check if user is admin
  const isAdmin = session?.user?.role === "admin"

  // Load draft from URL parameter
  useEffect(() => {
    const draftId = searchParams.get("draft")
    if (!draftId || !session) return

    const loadDraft = async () => {
      setIsLoadingDraft(true)
      try {
        const response = await fetch(`/api/essay-drafts/${draftId}`)
        if (!response.ok) {
          throw new Error("Failed to load draft")
        }

        const draft = await response.json()

        // Load the draft content
        setEssayText(draft.content)
        setEssayTitle(draft.title)
        setCurrentDraftId(draft.id)

        // Set topic and prompt if available
        if (draft.topic_id) {
          setSelectedTopicId(draft.topic_id)
        }
        if (draft.prompt_id) {
          setSelectedPromptId(draft.prompt_id)
        }

        toast({
          title: "Draft loaded",
          description: "Continue writing your essay",
        })
      } catch (error) {
        console.error("Error loading draft:", error)
        toast({
          title: "Error",
          description: "Failed to load draft",
          variant: "destructive",
        })
      } finally {
        setIsLoadingDraft(false)
      }
    }

    loadDraft()
  }, [searchParams, session, toast])

  // Load topics on mount
  useEffect(() => {
    const loadTopics = async () => {
      try {
        const response = await fetch("/api/essay-topics")
        const data = await response.json()

        // Handle error response
        if (data.error || !Array.isArray(data)) {
          console.error("Error loading topics:", data.error || "Invalid response")
          setTopics([])
          return
        }

        setTopics(data)
      } catch (error) {
        console.error("Error loading topics:", error)
        setTopics([])
      }
    }
    loadTopics()
  }, [])

  // Load prompts when topic changes
  useEffect(() => {
    if (!selectedTopicId) {
      setPrompts([])
      setSelectedPromptId("")
      return
    }

    // Handle custom prompt selection
    if (selectedTopicId === "__custom__") {
      setIsCustomPrompt(true)
      setPrompts([])
      setSelectedPromptId("")
      setVocabSuggestions([])
      setCustomPromptText("")

      // Trigger animation on prompt input
      setPromptInputAnimation(true)
      setTimeout(() => setPromptInputAnimation(false), 2000)
      return
    }

    // Load prompts for regular topics
    setIsCustomPrompt(false)
    const loadPrompts = async () => {
      try {
        const response = await fetch(`/api/essay-prompts?topic_id=${selectedTopicId}`)
        const data = await response.json()
        setPrompts(data)
      } catch (error) {
        console.error("Error loading prompts:", error)
      }
    }
    loadPrompts()
  }, [selectedTopicId])

  // Auto-populate prompt text when ready-made prompt is selected
  useEffect(() => {
    if (!isCustomPrompt && selectedPromptId && selectedPromptId !== "general") {
      const selectedPrompt = prompts.find((p) => p.id === selectedPromptId)
      if (selectedPrompt) {
        setCustomPromptText(selectedPrompt.description)
      }
    } else if (selectedPromptId === "general" || !selectedPromptId) {
      setCustomPromptText("")
    }
  }, [selectedPromptId, prompts, isCustomPrompt])

  // Load vocab suggestions when prompt changes
  useEffect(() => {
    if (!selectedPromptId) {
      setVocabSuggestions([])
      return
    }

    const loadVocab = async () => {
      try {
        const response = await fetch(`/api/essay-vocab?prompt_id=${selectedPromptId}`)
        const data = await response.json()
        setVocabSuggestions(data)
      } catch (error) {
        console.error("Error loading vocab suggestions:", error)
      }
    }
    loadVocab()
  }, [selectedPromptId])

  // Auto-save draft every 5 minutes
  const saveDraft = useCallback(async () => {
    if (!session || !essayText.trim()) return

    setIsSaving(true)
    try {
      const response = await fetch("/api/essay-drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic_id: selectedTopicId || null,
          prompt_id: selectedPromptId || null,
          title: essayTitle || "Untitled Draft",
          content: essayText,
          parent_draft_id: currentDraftId,
        }),
      })

      const data = await response.json()
      setCurrentDraftId(data.id)

      toast({
        title: "Draft saved",
        description: "Your essay has been saved automatically",
      })
    } catch (error) {
      console.error("Error saving draft:", error)
    } finally {
      setIsSaving(false)
    }
  }, [session, essayText, essayTitle, selectedTopicId, selectedPromptId, currentDraftId, toast])

  // Set up auto-save timer
  useEffect(() => {
    if (!session || !essayText.trim()) return

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    // Set new timer for 5 minutes
    autoSaveTimerRef.current = setTimeout(() => {
      saveDraft()
    }, 5 * 60 * 1000) // 5 minutes

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [essayText, session, saveDraft])

  const handleSubmit = async () => {
    if (!essayText.trim()) {
      toast({
        title: "Error",
        description: "Please write your essay before submitting",
        variant: "destructive",
      })
      return
    }

    setIsAnalyzing(true)
    setFeedback(null)
    setStreamingText("")
    setProgress(0)
    setStatusMessage("Preparing essay...")

    try {
      setProgress(25)
      setStatusMessage("Analyzing essay...")

      const response = await fetch("/api/ielts/refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: essayText,
          instructionNames: ["ielts"],
          level: selectedLevel,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get IELTS feedback")
      }

      setProgress(50)
      setStatusMessage("Processing feedback...")

      const data = await response.json()

      setProgress(75)
      setStatusMessage("Selecting vocabulary for learning...")

      // Parse the feedback
      try {
        const parsedFeedback: IELTSFeedback = JSON.parse(data.refined)
        setFeedback(parsedFeedback)
        setShowFeedback(true)

        setProgress(100)
        setStatusMessage("Complete!")

        // Save to database if user is logged in
        if (session) {
          // Extract corrected content from paragraph revisions
          const correctedContent = parsedFeedback.paragraphs
            .map((p) => p.revisedParagraph)
            .join("\n\n")

          await fetch("/api/essays", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: essayTitle || "Untitled IELTS Essay",
              content: essayText,
              correctedContent,
              score: parsedFeedback.overallBand,
              feedback: parsedFeedback,
              level: selectedLevel,
            }),
          })
        }

        toast({
          title: "Success",
          description: session
            ? "Your essay has been graded and saved"
            : "Your essay has been graded. Sign in to save your progress.",
        })
      } catch (parseError) {
        console.error("Parse error:", parseError)
        toast({
          title: "Error",
          description: "Failed to parse feedback",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error getting IELTS feedback:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze essay",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
      setStreamingText("")
    }
  }

  const handleDownload = () => {
    // Implement download functionality
    console.log("Download feedback")
  }

  const handleCreateTopic = async () => {
    if (!newTopicName.trim()) {
      toast({
        title: "Error",
        description: "Topic name is required",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch("/api/essay-topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newTopicName,
          description: newTopicDescription,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create topic")
      }

      const newTopic = await response.json()
      setTopics([...topics, newTopic].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedTopicId(newTopic.id)
      setShowAddTopicDialog(false)
      setNewTopicName("")
      setNewTopicDescription("")

      toast({
        title: "Success",
        description: "Topic created successfully",
      })
    } catch (error) {
      console.error("Error creating topic:", error)
      toast({
        title: "Error",
        description: "Failed to create topic",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreatePrompt = async () => {
    if (!newPromptTitle.trim()) {
      toast({
        title: "Error",
        description: "Prompt title is required",
        variant: "destructive",
      })
      return
    }

    if (!selectedTopicId) {
      toast({
        title: "Error",
        description: "Please select a topic first",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch("/api/essay-prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic_id: selectedTopicId,
          title: newPromptTitle,
          description: newPromptDescription,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create prompt")
      }

      const newPrompt = await response.json()
      setPrompts([...prompts, newPrompt].sort((a, b) => a.title.localeCompare(b.title)))
      setSelectedPromptId(newPrompt.id)
      setShowAddPromptDialog(false)
      setNewPromptTitle("")
      setNewPromptDescription("")

      toast({
        title: "Success",
        description: "Prompt created successfully",
      })
    } catch (error) {
      console.error("Error creating prompt:", error)
      toast({
        title: "Error",
        description: "Failed to create prompt",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteTopic = async () => {
    if (!deletingTopic) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/essay-topics/${deletingTopic.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete topic")
      }

      toast({
        title: "Topic deleted",
        description: "Topic and all its prompts have been deleted successfully",
      })

      // Remove topic from state and clear selection
      setTopics(topics.filter((t) => t.id !== deletingTopic.id))
      if (selectedTopicId === deletingTopic.id) {
        setSelectedTopicId("")
        setSelectedPromptId("")
        setPrompts([])
      }
      setDeletingTopic(null)
    } catch (error) {
      console.error("Error deleting topic:", error)
      toast({
        title: "Error",
        description: "Failed to delete topic",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeletePrompt = async () => {
    if (!deletingPrompt) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/essay-prompts/${deletingPrompt.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete prompt")
      }

      toast({
        title: "Prompt deleted",
        description: "Prompt has been deleted successfully",
      })

      // Remove prompt from state and clear selection
      setPrompts(prompts.filter((p) => p.id !== deletingPrompt.id))
      if (selectedPromptId === deletingPrompt.id) {
        setSelectedPromptId("")
      }
      setDeletingPrompt(null)
    } catch (error) {
      console.error("Error deleting prompt:", error)
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {showFeedback && feedback && (
        <FullScreenFeedbackView
          feedback={feedback}
          onClose={() => setShowFeedback(false)}
          onDownload={handleDownload}
          isLoading={isAnalyzing}
        />
      )}

      {!showFeedback && (
        <div className="container py-8 max-w-7xl">
          <div className="flex flex-col gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">IELTS Essay Correction</h1>
              <p className="text-muted-foreground mt-2">
                Get comprehensive IELTS Task 2 feedback with band scores, detailed corrections, and improvement suggestions
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Essay Input */}
        <Card>
          <CardHeader>
            <CardTitle>Your Essay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Essay Title (Optional)</Label>
              <Input
                id="title"
                placeholder="e.g., Technology and Education"
                value={essayTitle}
                onChange={(e) => setEssayTitle(e.target.value)}
                disabled={isAnalyzing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt" className="flex items-center gap-2">
                Essay Prompt {isCustomPrompt && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="prompt"
                placeholder={
                  isCustomPrompt
                    ? "Enter your custom essay prompt here..."
                    : "Select a topic and prompt from the right panel, or the selected prompt will appear here"
                }
                value={customPromptText}
                onChange={(e) => setCustomPromptText(e.target.value)}
                disabled={!isCustomPrompt || isAnalyzing}
                className={`min-h-[100px] transition-all duration-500 ${
                  promptInputAnimation ? "ring-2 ring-primary animate-pulse" : ""
                } ${!isCustomPrompt ? "bg-muted/50 cursor-not-allowed" : ""}`}
              />
              {isCustomPrompt && !customPromptText.trim() && (
                <p className="text-xs text-destructive">
                  Please enter a custom prompt to generate ideas or submit your essay
                </p>
              )}
              {!isCustomPrompt && customPromptText && (
                <p className="text-xs text-muted-foreground">
                  ✓ Prompt loaded from selected topic
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Your Current Level *</Label>
              <Select
                value={selectedLevel}
                onValueChange={(value) => setSelectedLevel(value as '5.0_or_below' | '5.5_to_6.5' | '7.0_or_above')}
                disabled={isAnalyzing}
              >
                <SelectTrigger id="level">
                  <SelectValue placeholder="Select your level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5.0_or_below">5.0 or below (Beginner - Vietnamese feedback, basic focus)</SelectItem>
                  <SelectItem value="5.5_to_6.5">5.5 - 6.5 (Intermediate - Vietnamese feedback, full analysis)</SelectItem>
                  <SelectItem value="7.0_or_above">7.0 or above (Advanced - English feedback, full analysis)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose your level to get personalized feedback in the right language
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="essay">Essay Content *</Label>
              <Textarea
                id="essay"
                placeholder="Write your IELTS Task 2 essay here (minimum 250 words recommended)..."
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                disabled={isAnalyzing}
                className="min-h-[400px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Word count: {essayText.trim().split(/\s+/).filter(Boolean).length}
              </p>
            </div>

            <div className="space-y-2">
              {session && (
                <Button
                  onClick={saveDraft}
                  disabled={isSaving || !essayText.trim()}
                  className="w-full"
                  variant="outline"
                  size="lg"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Draft...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Draft
                    </>
                  )}
                </Button>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isAnalyzing || !essayText.trim()}
                className="w-full"
                size="lg"
              >
                {isAnalyzing ? (
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>{statusMessage}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit for Grading
                  </>
                )}
              </Button>
            </div>

            {!session && (
              <p className="text-xs text-center text-muted-foreground">
                Sign in to save drafts and track progress
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Topic Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Essay Topics & Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Select Topic</Label>
              <Select
                value={selectedTopicId}
                onValueChange={(value) => {
                  if (value === "__add_new__") {
                    setShowAddTopicDialog(true)
                  } else {
                    setSelectedTopicId(value)
                  }
                }}
              >
                <SelectTrigger id="topic">
                  <SelectValue placeholder="Choose a topic..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom__" className="text-primary font-medium">
                    Custom Prompt
                  </SelectItem>
                  {topics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.name}
                    </SelectItem>
                  ))}
                  {isAdmin && (
                    <SelectItem value="__add_new__" className="text-primary font-medium">
                      <div className="flex items-center">
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Topic
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {selectedTopicId && (
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-muted-foreground flex-1">
                    {topics.find((t) => t.id === selectedTopicId)?.description}
                  </p>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-destructive hover:text-destructive"
                      onClick={() => {
                        const topic = topics.find((t) => t.id === selectedTopicId)
                        if (topic) setDeletingTopic(topic)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {selectedTopicId && !isCustomPrompt && (
              <div className="space-y-2">
                <Label htmlFor="prompt">Essay Prompt</Label>
                <Select
                  value={selectedPromptId}
                  onValueChange={(value) => {
                    if (value === "__add_new__") {
                      setShowAddPromptDialog(true)
                    } else {
                      setSelectedPromptId(value)
                    }
                  }}
                >
                  <SelectTrigger id="prompt">
                    <SelectValue placeholder="Choose a prompt..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Topical Vocab/Grammar Structures</SelectItem>
                    {prompts.map((prompt) => (
                      <SelectItem key={prompt.id} value={prompt.id}>
                        {prompt.title}
                      </SelectItem>
                    ))}
                    {isAdmin && (
                      <SelectItem value="__add_new__" className="text-primary font-medium">
                        <div className="flex items-center">
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Prompt
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {selectedPromptId && selectedPromptId !== "general" && (
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground flex-1">
                      {prompts.find((p) => p.id === selectedPromptId)?.description}
                    </p>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-destructive hover:text-destructive"
                        onClick={() => {
                          const prompt = prompts.find((p) => p.id === selectedPromptId)
                          if (prompt) setDeletingPrompt(prompt)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {isCustomPrompt && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  You've selected custom prompt mode. Enter your essay prompt in the left panel to get started.
                </p>
              </div>
            )}

            {!isCustomPrompt && selectedPromptId && vocabSuggestions.length > 0 && (
              <div className="space-y-2">
                <Label>Vocabulary & Grammar Suggestions</Label>
                <div className="rounded-lg border p-4 max-h-[300px] overflow-y-auto">
                  <div className="space-y-3">
                    {vocabSuggestions.map((suggestion) => (
                      <div key={suggestion.id} className="text-sm">
                        <div className="font-medium text-primary capitalize">
                          {suggestion.suggestion_type}
                        </div>
                        <div className="text-muted-foreground mt-1 whitespace-pre-wrap">
                          {suggestion.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!isCustomPrompt && selectedPromptId === "general" && (
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  General vocabulary and grammar structures for this topic will be displayed here.
                  Administrators can add these in the admin panel.
                </p>
              </div>
            )}
            {/* Ideas Generator */}
            {((selectedPromptId && selectedPromptId !== "general") || (isCustomPrompt && customPromptText.trim())) && (
              <div className="pt-4 border-t">
                <IdeasGenerator
                  essayPrompt={customPromptText || prompts.find((p) => p.id === selectedPromptId)?.description || ""}
                  level={selectedLevel}
                  disabled={isAnalyzing || (isCustomPrompt && !customPromptText.trim())}
                />
              </div>
            )}
            {!selectedTopicId && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">
                  Select a topic to see essay prompts and vocabulary suggestions
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </div>
      )}

      {/* Add Topic Dialog */}
      <Dialog open={showAddTopicDialog} onOpenChange={setShowAddTopicDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Topic</DialogTitle>
            <DialogDescription>
              Create a new essay topic for students to explore
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="topic-name">Topic Name *</Label>
              <Input
                id="topic-name"
                placeholder="e.g., Technology"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-description">Description</Label>
              <Textarea
                id="topic-description"
                placeholder="Brief description of this topic..."
                value={newTopicDescription}
                onChange={(e) => setNewTopicDescription(e.target.value)}
                disabled={isCreating}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddTopicDialog(false)
                setNewTopicName("")
                setNewTopicDescription("")
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTopic} disabled={isCreating || !newTopicName.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Topic"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Prompt Dialog */}
      <Dialog open={showAddPromptDialog} onOpenChange={setShowAddPromptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Prompt</DialogTitle>
            <DialogDescription>
              Create a new essay prompt for the selected topic
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-title">Prompt Title *</Label>
              <Input
                id="prompt-title"
                placeholder="e.g., Impact of Social Media"
                value={newPromptTitle}
                onChange={(e) => setNewPromptTitle(e.target.value)}
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prompt-description">Prompt Description</Label>
              <Textarea
                id="prompt-description"
                placeholder="Detailed essay prompt or question..."
                value={newPromptDescription}
                onChange={(e) => setNewPromptDescription(e.target.value)}
                disabled={isCreating}
                className="min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddPromptDialog(false)
                setNewPromptTitle("")
                setNewPromptDescription("")
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreatePrompt} disabled={isCreating || !newPromptTitle.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Prompt"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Topic Confirmation */}
      <AlertDialog open={!!deletingTopic} onOpenChange={(open) => !open && setDeletingTopic(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTopic?.name}"? This will permanently delete the topic and ALL associated prompts and vocabulary suggestions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTopic}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Topic"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Prompt Confirmation */}
      <AlertDialog open={!!deletingPrompt} onOpenChange={(open) => !open && setDeletingPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPrompt?.title}"? This will permanently delete the prompt and all associated vocabulary suggestions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePrompt}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Prompt"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
