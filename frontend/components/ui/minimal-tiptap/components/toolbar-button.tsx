import * as React from "react"
import type { TooltipContentProps } from "@radix-ui/react-tooltip"
import type { VariantProps } from "class-variance-authority"
import { cn } from "@/components/ui/minimal-tiptap/utils"
import { toggleVariants } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ToolbarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof toggleVariants> {
  isActive?: boolean
  tooltip?: string
  tooltipOptions?: TooltipContentProps
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
}

export const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  ToolbarButtonProps
>(
  (
    {
      isActive,
      children,
      tooltip,
      className,
      tooltipOptions,
      size,
      variant,
      pressed,
      defaultPressed: _defaultPressed,
      onPressedChange: _onPressedChange,
      ...props
    },
    ref
  ) => {
    const button = (
      <button
        ref={ref}
        type="button"
        aria-pressed={isActive ?? pressed}
        data-state={isActive ? "on" : "off"}
        className={cn(
          toggleVariants({ size, variant }),
          isActive && "bg-accent text-accent-foreground",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )

    if (!tooltip) {
      return button
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent {...tooltipOptions}>
          <div className="flex flex-col items-center text-center">
            {tooltip}
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }
)

ToolbarButton.displayName = "ToolbarButton"

export default ToolbarButton
