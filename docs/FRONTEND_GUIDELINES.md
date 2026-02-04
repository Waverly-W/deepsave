# Frontend Guidelines (FRONTEND_GUIDELINES.md)

## 1. Visual Design System
*   **Colors**:
    *   Primary: Deep Blue/Violet (Cyberpunk undertones, but professional).
    *   Background: `#09090b` (Zinc 950) - Very dark, not pitch black.
    *   Surface: `#18181b` (Zinc 900).
    *   Text: `#e4e4e7` (Zinc 200) for body, White for headers.
*   **Spacing**:
    *   Use Tailwind's scale. Default padding `p-4` or `p-6`.
    *   Consistent gaps: `gap-4` for cards, `gap-2` for list items.
*   **Typography**:
    *   Headings: `Inter` (font-sans), Bold (`font-bold`).
    *   Body: `Inter` or `System UI`.
    *   Reading Mode: `Noto Serif` (font-serif) for article content.

## 2. Component Usage (shadcn/ui)
*   **Buttons**:
    *   Action: `default` (Solid color).
    *   Cancel/Secondary: `outline` or `ghost`.
    *   Destructive: `destructive` (Red).
*   **Inputs**:
    *   All forms must use `Form` wrapper from shadcn (react-hook-form integration).
    *   Show inline validation errors.
*   **Toast**:
    *   Use `sonner` or `use-toast` for async feedback.
    *   "Item saved" -> Success (Green icon).
    *   "Connection failed" -> Error (Red icon).

## 3. State Management Rules
*   **Server State (React Query)**:
    *   Keys: `['items', { status: 'archived' }]`.
    *   Mutations: Must invalidate queries on success (`queryClient.invalidateQueries`).
*   **Client State (Zustand)**:
    *   Use only for UI state (e.g., Sidebar open/close, Modal visibility, current Reading settings).
    *   **Do not** put massive data arrays in Zustand.

## 4. Mobile Responsiveness
*   **Grid System**:
    *   Desktop: 3-4 columns (`grid-cols-4`).
    *   Tablet: 2 columns (`grid-cols-2`).
    *   Mobile: 1 column (`grid-cols-1`).
*   **Navigation**:
    *   Desktop: Sidebar (Left).
    *   Mobile: Bottom Tab Bar or Hamburger Menu (Sheet).
