---
name: scaffold-page
description: Generate a new frontend route/page for the Grade-M8 rebuild, following the routing, data-fetching, and role-gating conventions in MENTOR.md. Ends with a plain-language walkthrough for junior devs new to frontend structure.
---

# Scaffold a frontend page

Use this skill when adding a new screen/route to the rebuild's `frontend/` repo (e.g. a new teacher-only detail page). It generates the mechanical wiring for one page — you (or the requesting dev) still build the real UI and logic inside it.

## Usage

```
/scaffold-page <PageName> <route-path> <roles-allowed>
```

Example: `/scaffold-page ExamDetail /teacher/exams/:examId Professor`

Roles are `Professor` and `Student` (exact strings); `Admin` passes every gate automatically, so don't list it.

## Before generating: confirm the pattern exists to copy from

Read at least one existing page in the target `frontend/` repo first (its component structure, how it fetches data, how it's wired into the route table) and match that concrete pattern rather than inventing a new one. If none exists yet, this is the first page — build it directly from the conventions below, and it becomes the reference afterward.

Also check `../../../../design-system/src/screens/` for a matching composed screen (Login, PanelDeControl, MisCursos, ConfiguracionExamenIA, EditorDePreguntas, TomarExamen, Auditoria, EntregasDelExamen, MisExamenes — each a `.stories.tsx`) before laying out the page — it shows how the individual components combine into this exact screen's structure, which components it's built from, and what states/variants each needs, so the page's structure isn't guessed at from scratch. This is the composition-level counterpart to what `scaffold-component` uses for a single component; see [Design systems & tokens](../../../wiki/08-design-systems-and-tokens.md).

## What to generate

1. **A page component** in `src/pages/<Area>/<Name>Page.tsx` — following the loading/success/error state pattern described in [Frontend basics](../../../wiki/07-frontend-basics.md): the data loading lives in a `src/hooks/use<Thing>.ts` hook with plain state (no data-fetching library — see `CONVENTIONS.md` → Frontend), a `useEffect`-driven fetch, `try/catch` in the hook with a user-facing `toast.error`/error state, and conditional rendering per state in the page. While auth is still resolving (`!user || !role`), the hook waits instead of fetching or redirecting.

2. **A typed API call** — in `src/services/<resource>Service.ts`, calling the shared `apiClient` (`apiClient.get/post/put/patch<T>`) — no raw `fetch`, no `httpsCallable` (see [REST APIs](../../../wiki/02-rest-apis.md) for the request/response shape it should expect back from the backend). Types go in `src/types/`, mirroring the backend's. Don't add a data-fetching/caching library — that's a deliberate project-wide choice, not an oversight to "fix."

3. **A route table entry** in `src/routes/AppRouter.tsx`, inside a `<ProtectedRoutes allowedRoles={[...]}>` group for the given allowed roles (see [Auth & roles](../../../wiki/04-auth-and-roles.md)) — redirecting anyone else away rather than rendering the page and hoping the backend rejects it. The backend must independently enforce the same role check on any endpoint this page calls — the frontend gate is a UX nicety, never the real security boundary.

## The teaching step (required, not optional)

After generating, explain what got created and why it's structured this way — particularly *why* the frontend role-gate isn't sufficient on its own and the backend has to check too, since that's a common point of confusion for developers new to auth. Ask whether the dev wants a walkthrough now or wants to start editing and ask questions as they go, per `MENTOR.md`.

## What NOT to do

- Don't invent UI beyond a bare skeleton — the visual design should be hand-ported from the design system per the `scaffold-component` skill, not invented here.
- Don't add a shared cache layer, global state library, or data-fetching library "to be safe" — flag it to the requesting dev instead if a specific page's needs seem to genuinely require one.
