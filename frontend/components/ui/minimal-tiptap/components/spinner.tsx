import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/components/ui/minimal-tiptap/utils"

type SpinnerProps = React.ComponentProps<typeof Loader2>

const SpinnerComponent = function Spinner({
  className,
  ...props
}: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin", className)}
      aria-hidden="true"
      {...props}
    />
  )
}

SpinnerComponent.displayName = "Spinner"

export const Spinner = React.memo(SpinnerComponent)
