import { Suspense } from "react"
import { IELTSEssayClient } from "./IELTSEssayClient"
import { Loader2 } from "lucide-react"

export default function IELTSEssayPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <IELTSEssayClient />
    </Suspense>
  )
}
