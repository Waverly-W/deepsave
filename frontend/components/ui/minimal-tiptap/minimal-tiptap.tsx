import type { Content, Editor } from "@tiptap/react"
import type { ReactNode } from "react"
import type { UseMinimalTiptapEditorProps } from "./hooks/use-minimal-tiptap"
import { EditorContent, EditorContext } from "@tiptap/react"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/components/ui/minimal-tiptap/utils"
import { SectionOne } from "./components/section/one"
import { SectionTwo } from "./components/section/two"
import { SectionThree } from "./components/section/three"
import { SectionFour } from "./components/section/four"
import { SectionFive } from "./components/section/five"
import { LinkBubbleMenu } from "./components/bubble-menu/link-bubble-menu"
import { useMinimalTiptapEditor } from "./hooks/use-minimal-tiptap"
import { MeasuredContainer } from "./components/measured-container"
import { useTiptapEditor } from "./hooks/use-tiptap-editor"

const ToolbarSeparator = () => (
  <Separator
    orientation="vertical"
    className="mx-2 h-6 bg-border/80"
  />
)

export interface MinimalTiptapProps extends Omit<
  UseMinimalTiptapEditorProps,
  "onUpdate"
> {
  value?: Content
  onChange?: (value: Content) => void
  className?: string
  editorContentClassName?: string
  toolbarRight?: ReactNode
}

const Toolbar = ({
  editor,
  rightActions,
}: {
  editor: Editor
  rightActions?: ReactNode
}) => (
  <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-2">
    <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
      <div className="flex w-max items-center gap-px">
        <SectionOne editor={editor} activeLevels={[1, 2, 3, 4, 5, 6]} />

        <ToolbarSeparator />

        <SectionTwo
          editor={editor}
          activeActions={[
            "bold",
            "italic",
            "underline",
            "strikethrough",
            "code",
            "clearFormatting",
          ]}
          mainActionCount={3}
        />

        <ToolbarSeparator />

        <SectionThree editor={editor} />

        <ToolbarSeparator />

        <SectionFour
          editor={editor}
          activeActions={["orderedList", "bulletList"]}
          mainActionCount={0}
        />

        <ToolbarSeparator />

        <SectionFive
          editor={editor}
          activeActions={["codeBlock", "blockquote", "horizontalRule"]}
          mainActionCount={0}
        />
      </div>
    </div>
    {rightActions ? (
      <>
        <ToolbarSeparator />
        <div className="flex shrink-0 items-center gap-2">
          {rightActions}
        </div>
      </>
    ) : null}
  </div>
)

export const MinimalTiptapEditor = ({
  value,
  onChange,
  className,
  editorContentClassName,
  toolbarRight,
  ...props
}: MinimalTiptapProps) => {
  const editor = useMinimalTiptapEditor({
    value,
    onUpdate: onChange,
    ...props,
  })

  if (!editor) {
    return null
  }

  return (
    <EditorContext.Provider value={{ editor }}>
      <MainMinimalTiptapEditor
        editor={editor}
        className={className}
        editorContentClassName={editorContentClassName}
        toolbarRight={toolbarRight}
      />
    </EditorContext.Provider>
  )
}

MinimalTiptapEditor.displayName = "MinimalTiptapEditor"

export default MinimalTiptapEditor

export const MainMinimalTiptapEditor = ({
  editor: providedEditor,
  className,
  editorContentClassName,
  toolbarRight,
}: MinimalTiptapProps & { editor: Editor }) => {
  const { editor } = useTiptapEditor(providedEditor)

  if (!editor) {
    return null
  }

  return (
    <MeasuredContainer
      as="div"
      name="editor"
      className={cn(
        "min-data-[orientation=vertical]:h-72 flex h-auto w-full flex-col rounded-md",
        className
      )}
    >
      <Toolbar editor={editor} rightActions={toolbarRight} />
      <EditorContent
        editor={editor}
        className={cn("minimal-tiptap-editor", editorContentClassName)}
      />
      <LinkBubbleMenu editor={editor} />
    </MeasuredContainer>
  )
}
