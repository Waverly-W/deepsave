"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

export type NoteWidth = "compact" | "default" | "wide";
export type EditorTextSize = "compact" | "default" | "large";

type PreferencesContextValue = {
  noteWidth: NoteWidth;
  editorTextSize: EditorTextSize;
  setNoteWidth: (value: NoteWidth) => void;
  setEditorTextSize: (value: EditorTextSize) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const NOTE_WIDTH_KEY = "note-width";
const EDITOR_TEXT_SIZE_KEY = "editor-text-size";

function readStoredNoteWidth(): NoteWidth {
  if (typeof window === "undefined") {
    return "default";
  }
  try {
    const stored = localStorage.getItem(NOTE_WIDTH_KEY);
    return stored === "compact" || stored === "wide" ? stored : "default";
  } catch (error) {
    return "default";
  }
}

function readStoredEditorTextSize(): EditorTextSize {
  if (typeof window === "undefined") {
    return "default";
  }
  try {
    const stored = localStorage.getItem(EDITOR_TEXT_SIZE_KEY);
    return stored === "compact" || stored === "large" ? stored : "default";
  } catch (error) {
    return "default";
  }
}

export function PreferencesProvider({
  children
}: {
  children: React.ReactNode;
}) {
  // Keep SSR and first client render in sync to avoid hydration warnings.
  const [noteWidth, setNoteWidth] = useState<NoteWidth>("default");
  const [editorTextSize, setEditorTextSize] = useState<EditorTextSize>("default");

  useEffect(() => {
    const storedNoteWidth = readStoredNoteWidth();
    setNoteWidth((prev) => (prev === storedNoteWidth ? prev : storedNoteWidth));
    const storedEditorTextSize = readStoredEditorTextSize();
    setEditorTextSize((prev) =>
      prev === storedEditorTextSize ? prev : storedEditorTextSize
    );
  }, []);

  useEffect(() => {
    try {
      if (noteWidth === "default") {
        localStorage.removeItem(NOTE_WIDTH_KEY);
      } else {
        localStorage.setItem(NOTE_WIDTH_KEY, noteWidth);
      }
    } catch (error) {
      // Ignore storage failures.
    }
  }, [noteWidth]);

  useEffect(() => {
    try {
      if (editorTextSize === "default") {
        localStorage.removeItem(EDITOR_TEXT_SIZE_KEY);
      } else {
        localStorage.setItem(EDITOR_TEXT_SIZE_KEY, editorTextSize);
      }
    } catch (error) {
      // Ignore storage failures.
    }
  }, [editorTextSize]);

  const value = useMemo(
    () => ({
      noteWidth,
      editorTextSize,
      setNoteWidth,
      setEditorTextSize
    }),
    [noteWidth, editorTextSize]
  );

  return (
    <PreferencesContext.Provider value={value}>
      <div
        className="min-h-screen app-preferences"
        data-note-width={noteWidth}
        data-editor-text-size={editorTextSize}
      >
        {children}
      </div>
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
