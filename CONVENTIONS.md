# Grade-M8 conventions (as built)

This is the source of truth for **how the code on `dev` is actually written**. Agents, skills, and reviewers check against this file. `MENTOR.md` governs *how Claude works with the devs*; `wiki/` explains *concepts*; this file says *what the code does and should keep doing*.

Last synced against `dev`: backend `e0880c2`, frontend `4b5a782` (2026-09-24).

**Keeping it true:** when a PR deliberately changes a convention, update this file in the same change set (or open a `tools` PR right after). If code and this file disagree and nobody decided to change the convention, the code is wrong. If they disagree because the team decided otherwise, this file is wrong — fix it.

Sections: [Backend](#backend) · [Frontend](#frontend) · [Cross-ticket contracts](#cross-ticket-contracts) · [Cross-repo contract](#cross-repo-contract) · [Testing & CI](#testing--ci) · [Planned, not built yet](#planned-not-built-yet) · [Known debt](#known-debt)

---

## Backend

Repo `grade-m8/backend`. Node 20, TypeScript, Firebase Cloud Functions v2 + Express 5, Firestore via the Admin SDK. Source in `functions/src/`.

### Layout

| Layer | Path | Naming |
|---|---|---|
| Routes | `route/<domain>Routes.ts` | Exports one `onRequest` function per domain (`users`, `subjects`, `exams`), each wrapping its own Express app; re-exported from `index.ts` |
| Controllers | `controller/<domain>/<action>.ts` | One file per endpoint, function named by the action (`createExam`, `getProfile`) — no `Controller` suffix |
| Services | `service/<domain>/<domain>Service.ts` | Class, dependencies injected via constructor |
| Repository interfaces | `types/<domain>/<domain>Repo.ts` | e.g. `ExamRepository` |
| Repository implementations | `repository/<domain>/firestore<Domain>Repo.ts` | e.g. `FirestoreExamRepo` |
| Firestore converters | `repository/<domain>/<entity>DataConverter.ts` | `toFirestore` / `fromFirestore` |
| Domain types & DTOs | `types/<domain>/*.ts` | `CreateXDto`, `UpdateXDto`, `XDetail` |
| DI wiring | `di/container.ts` | The **only** place that calls `new` on repos/services; controllers import the ready instances |
| Env config | `config/env.ts` → `getEnv()` | Validates required vars, caches |
| Helpers | `lib/` (e.g. `withTimeout.ts`), `controller/controllerUtils.ts` (`extractPathParamId`) | |
| Scripts | `scripts/seed.ts`, `scripts/seedAdmin.ts` | `npm run seed`, `npm run seed:admin` |

URLs are therefore `https://<region>-<project>.cloudfunctions.net/<domain>/<path>` (locally `http://localhost:5001/<project>/us-central1/<domain>/<path>`). There is no `/api/v1` prefix.

### Layering rules

- routes → controllers → services → repositories. **Only repositories query Firestore.**
- **Routes**: `router.use(authMiddleware)` once, then `requireRoles([...])` per route. No logic.
- **Controllers**: check `req.user`, extract/validate input, call the service, map the result to HTTP. No business rules.
- **Services**: business rules, ownership checks, timestamps, computed fields. Never import `firebase-functions`, `express`, or HTTP error helpers. Importing `Timestamp` from `firebase-admin/firestore` is accepted.
- **Repositories**: query construction only, always through a typed `withConverter`, except partial updates (below).

### Validation (no Zod)

There is **no schema library**. Validation is hand-written in the controller, once:

- Required-field checks in a local `hasMissingFields(data)` helper:
  - strings: `!data.field?.trim()` (rejects `""` and whitespace-only)
  - numbers: `data.field == null` — **never `!data.field`**, since `0` is valid
- Path params via `extractPathParamId(req, name)` (trims, returns `undefined` if empty).
- **Partial updates (PATCH/PUT) must whitelist fields** — `ALLOWED_UPDATE_FIELDS` + `Object.fromEntries(Object.entries(body).filter(...))`, see `controller/exam/updateExam.ts`. Never pass `req.body` (or `req.body as Dto`) straight to a service: `as` is compile-time only and Firestore `merge` would write whatever the client sent (mass assignment).
- **Immutable after creation** — never whitelisted: ids, owner fields (`teacherId`, `studentId`), parent references (`subjectId`), `status`, `createdAt`, `publishedAt`. Status changes go through a dedicated service method (e.g. `replaceQuestionsAndPublish`).

Adopting Zod later is a legitimate team decision; if it happens, update this section and `scaffold-resource` together.

### Errors

- Domain errors are **returned, not thrown**: services return `T | AppError` (enum in `types/error/error.ts`). Controllers do `if (isAppError(result)) return mapAndReturnDomainError(res, result)`.
- Transport/validation errors in controllers and middleware use `HttpErrors.*` (`controller/errors/httpErrors.ts`).
- Response body is always `{ error: string, message: string }`. Messages are in Spanish.
- Adding an `AppError` member requires a case in `mapAppErrorToHttp` (the `never` check enforces it).

### Auth & roles

- Roles are Firebase custom claims: **`'Admin' | 'Professor' | 'Student'`** (`types/user/userRole.ts`). Exact strings, English, capitalized.
- `authMiddleware` verifies the Bearer ID token and sets `req.user = { uid, role, token }`.
- `requireRoles([...])`: **Admin passes every check** (`hasPermission`). Don't list `'Admin'` explicitly.
- Routes without `requireRoles` (e.g. `GET /exams/:id`) must enforce role/ownership in the controller or service.
- **Ownership** is checked in the service (`requireOwnedExam`, `getOne`), not assumed from the role. A route gated to `Professor` still has to verify *this* professor owns *this* resource — including the *target* resource when something is being moved or linked.
- Student-facing reads must strip teacher-only data: `StudentQuestion = Omit<Question, 'idealAnswer'>`.
- Users are created by an Admin via `POST /users` (role in the body). The first admin is created with `npm run seed:admin` (`scripts/seedAdmin.ts`), outside the HTTP API.
- After a role change the client must force-refresh the token (`getIdToken(true)`).

### Firestore

- Imports are modular: `import { getFirestore, Timestamp, type CollectionReference } from 'firebase-admin/firestore'`. **Not** `import { firestore } from 'firebase-admin'` + `Timestamp = firestore.Timestamp` (resolves to `undefined` at runtime in some paths — see backend PR #38).
- Top-level collections with id references (`exams.subjectId`); subcollections only for data always edited as a set with the parent (`exams/{id}/questions`, `exams/{id}/criteria`).
- Full-set replacement (criteria, questions) uses a batch: delete existing docs, write new ones.
- **Partial updates** use `.set(patch, { merge: true })` on a collection reference **without the converter** — a converter maps every field and would write `undefined` for missing ones.
- Never write `undefined` into Firestore; optional fields become `?? null` in converters.
- Composite queries need an entry in `firestore.indexes.json`.

### Config

Backend env vars (`.env.example`, read by `getEnv()`): `LMSTUDIO_URL`, `LMSTUDIO_SHARED_SECRET`, `LMSTUDIO_MODEL`, `GRADING_MAX_ATTEMPTS` (optional, default 5). `seed:admin` also needs `ADMIN_EMAIL` and `ADMIN_PASSWORD` (read from `backend/.env`). Emulator vars for local dev. Firebase projects: `default` = prod (`grade-prod-f94ca`), `dev` = `grade-dev-7d44b`.

Local dev uses Docker (`docker compose up`) wrapping the emulators. Docker is **not** used for tests.

---

## Frontend

Repo `grade-m8/frontend`. React 19 + Vite + TypeScript, Tailwind v4, Shadcn primitives, React Router, Firebase Auth. Path alias `@/` → `src/`.

### Layout

| What | Path |
|---|---|
| Pages (route targets) | `pages/<Area>/<Name>Page.tsx` (e.g. `pages/Subjects/SubjectsPage.tsx`, `pages/exams/ExamEditor.tsx`) |
| Components | `components/{ui,layout,data-display,forms,handler}/` — `ui/` holds Shadcn primitives |
| Hooks | `hooks/use<Thing>.ts` — filename matches the exported hook |
| Auth state | `context/AuthContext.ts`, `context/AuthProvider.tsx`, consumed via `hooks/useAuth.ts` |
| Routing | `routes/AppRouter.tsx`, `routes/ProtectedRoutes.tsx`, `routes/RedirectIfAuthenticated.tsx` |
| API layer | `services/apiClient.ts` (shared typed fetch helper) + `services/<resource>Service.ts` |
| Error messages | `services/error.ts` (`mapAuthErrorMessage`, `getApiErrorMessage`) |
| Types | `types/<domain>.ts`, `types/<domain>Dto.ts`, `types/role.ts` |

### Talking to the backend

- **Every call goes through `apiClient`** (`get/post/put/patch<T>`), which attaches the Firebase ID token and throws `new Error(body.error)` on non-2xx. No raw `fetch`, no `httpsCallable` (the backend is REST `onRequest` — callables were removed in frontend PR #84).
- One `services/<resource>Service.ts` per backend domain; function names mirror the backend service/endpoint (`replaceQuestions`, `replaceQuestionsAndPublish`, `listOwnedExams`).
- Pass DTOs as-is — don't re-wrap them (`apiClient.put(url, dto)`, not `{ criteria: dto }`).
- Parameters the backend requires are required in the TS signature (no `?`).
- Services don't catch. **`try/catch` lives in hooks/pages**, which set error state and/or `toast.error(...)` with a user-facing Spanish message (`getApiErrorMessage`). A failed request is never shown as a 403, and never swallowed with only `console.error`.
- No data-fetching/caching library, no global state library. Plain `useState` + `useEffect`/`useCallback` in a hook, exposing `{ data, isLoading, error, reload }`.

### Auth, roles, routing

- `types/role.ts` mirrors the backend roles exactly: `'Admin' | 'Professor' | 'Student'`, validated with `isRole()`.
- `AuthProvider` is the single source of session state (`user`, `role`, `profile`, `loading`), driven by `onAuthStateChanged`.
- **Role is async**: while `loading` or `!user || !role`, render a loading state or return silently — never redirect or treat it as "forbidden" on that first render.
- Every page that shows role-restricted content sits under `<ProtectedRoutes allowedRoles={[...]}>` in `AppRouter.tsx`. Admin passes automatically — don't add `'Admin'` to `allowedRoles`.
- The frontend gate is UX only; the endpoints the page calls must enforce the same roles on the backend.
- Every path passed to `navigate()` must exist in `AppRouter.tsx` (unknown paths fall to `*` → `/`, which can loop with `RedirectIfAuthenticated`).
- Login errors never reveal whether an email exists (one message for wrong email/password).

### UI & design system

- `grade-m8/design-system` (Storybook, cloned as sibling `../design-system/`) is the visual reference. **Never import from it.** Check it (and the Figma/ticket screenshot) before building a component or page.
- Shadcn primitives in `components/ui/` are reused before writing new primitives. Watch their default styles (e.g. `Card` adds `ring-1`/`rounded-xl`) when the design is flat.
- **Colors come only from the tokens in `src/index.css` (`@theme`).** Allowed: palette classes (`bg-teal-50`, `text-neutral-700`, `border-danger-500`), semantic classes (`bg-surface-card`, `text-text-secondary`, `bg-action-primary`), and `[var(--color-…)]` pointing at a token. **Not allowed:** hex/rgb literals or arbitrary colors (`bg-[#0a6565]`). Semantic tokens are preferred for new components where one fits; palette classes are accepted (they're what most of the app uses today).
- Typography/elevation also from tokens: `text-h1…h3`, `text-body`, `text-label`, `text-micro`, `shadow-hard`, `shadow-pop`, etc.
- Shadcn variant tokens (`primary`, `secondary`, `muted`, `destructive`, …) are mapped in `@theme inline`; if a Shadcn variant looks unstyled, add the mapping there instead of hand-coloring the component.
- Components: one exported component per file (small private sub-components in the same file are fine), props typed with an interface, no `any`. TSDoc is not required.
- Forms: show field errors on blur **and** after a submit attempt (not only when "touched").
- **Alignment is checked in every state**, including when validation errors are showing. Fields side by side in one row share the same label and field top line: rows of fields use `items-start`, never `items-end`/`items-center`, because an error message under one field would push the others out of line (frontend PR #110: "Criterio de evaluación" vs "Peso relativo"). An icon next to a single line of text is vertically centered with it (`items-center` on that row). No horizontal scroll at desktop widths. The browser test measures all of this with a 2px tolerance.
- Truncated text gets a `title` attribute; interactive elements get `cursor-pointer`.

### Hygiene (enforced in review)

- No `console.log` in committed code (and never tokens or user data).
- No commented-out code blocks.
- `===` only.
- Error messages match the operation (no copy-pasted "failed to fetch" in `enroll`).

---

## Cross-ticket contracts

Tickets are linked with GitHub issue dependencies ("blocked by" / "blocking"). When a ticket builds something another ticket will use (a component, hook, service function, type or route), the PR is reviewed against **that next ticket** too, not only its own:

- **Controlled components.** State the consumer owns (which item is being edited, selection, open/closed) comes in as props and goes out through callbacks. No copying a prop into local `useState` (frontend#117: `QuestionCard` copied `isEditing`, so the #70 editor couldn't enforce one-question-at-a-time).
- **Callbacks carry identity.** `onEdit(id)`, `onDelete(id)`, not `onEdit()`, so the parent knows which item acted.
- **Emitted data is complete.** What a component hands back (`onSave(question)`) includes every field the backend requires to persist it (frontend#117: `title` had no input, but `Question.title` is required).
- **Names and types the next ticket will import exist as the ticket says** (frontend#84: `replaceQuestionsAndPublish` for the wizard's last step).
- **A consumer uses what its blockers built, as designed**: import the component, pass the props it expects, don't rebuild it or work around its contract. If the contract doesn't fit, fix the component (or flag it) instead of patching around it in the page.

## Cross-repo contract

There is no shared package. Types are mirrored by hand:

| Backend | Frontend |
|---|---|
| `functions/src/types/exam/{exam,question,rubricCriterion,examDto}.ts` | `src/types/exam.ts`, `src/types/examDto.ts` |
| `functions/src/types/subject/subject.ts`, `enrollment/enrollment.ts` | `src/types/subject.ts` |
| `functions/src/types/user/{user,userRole}.ts` | `src/types/role.ts`, `UserProfile` in `src/services/userService.ts` |

Rules:
- A PR that changes a backend type or DTO shape updates the frontend mirror (or links the frontend PR that does).
- Firestore `Timestamp` on the backend is `string` on the frontend (serialized over JSON).
- DTO wrappers match exactly (`ReplaceCriteriaDto = { criteria: [...] }` on both sides).
- Role strings are identical on both sides.
- Role lists match: a frontend route's `allowedRoles` equals the roles the backend accepts on the endpoints it calls (remember both sides give Admin a pass).
- Frontend env: `VITE_FIREBASE_*`, `VITE_USE_EMULATORS`, `VITE_API_BASE_URL` (falls back to the local Functions emulator URL).

---

## Testing & CI

**Backend**
- Jest + ts-jest, `maxWorkers: 1`. Unit tests in `functions/test/unit/<name>.test.ts`, typed mock factories in `functions/test/mock/Mock<Interface>.ts` exporting `makeMock<Interface>()`. Never inside `src/`, no global `setup.ts`, no Docker.
- Scope: services, controllers, middleware, converters. New or changed service/controller logic ships with unit tests.
- `npm test` (root) → `functions` Jest. `npm --prefix functions run test:coverage` for coverage.
- CI (`.github/workflows/pr-checks.yml`, PRs to `main`/`dev`): `lint` → `format:check` → `typecheck` → `test` → `build`.
- CD (`cd-deploy.yml`): push to `dev` deploys the dev project; push to `main` deploys prod (functions, rules, indexes).

**Frontend**
- **No automated tests in the repo** (no Jest, no UI/E2E). Don't request them and don't add a test runner without a team decision.
- The PR automation runs AI-driven browser checks from `tools` (`pr-browser-test`, against local emulators). They live entirely in `tools/`: nothing is added to the frontend repo, and a failing check shows up in the review comment, not as a CI status.
- CI (`.github/workflows/ci.yml`, push/PR to `main`/`dev`): `lint` → `tsc --noEmit` → `build`.

**Both:** Husky + lint-staged pre-commit (ESLint fix + Prettier). PRs target `dev`; `dev` → `main` for releases. Keep branches merged with `origin/dev` before review so the diff only shows the ticket's changes.

---

## Planned, not built yet

These conventions stand but the code doesn't exist yet. Reviewers must **not** flag their absence; they apply once a PR introduces the feature.

- **Grading pipeline**: one Cloud Task per answer, enqueued only on final submit; failures re-throw so Cloud Tasks retries with backoff; after `GRADING_MAX_ATTEMPTS` → `dead_letter`, answer `failed`, UI shows "IA NO DISPONIBLE" with a manual retry. Types exist: `types/grading/gradingJob.ts`, `types/submission/*`.
- **Analysis items**: `source: 'ai'` items are never mutated or deleted; teacher edits create a `source: 'teacher'` item with `supersedes: <itemId>` (`types/submission/analysisItem.ts`).
- **Live status**: one frontend hook reading the submission status with `onSnapshot` — the only client-direct Firestore read, secured by `firestore.rules`.
- **LMStudio response parsing**: parsed model output is validated (type guard or schema) before anything is written; a validation failure is a task failure.
- Submission / answer endpoints and the teacher review flow.

---

## Known debt

Real gaps between this file and `dev`. Reviewers should flag them **only when the PR touches the affected lines/files** (or makes them worse), not on every PR.

| Area | Debt | Where |
|---|---|---|
| Backend tests | Only `userService`, `auth.middleware`, `sanity` have tests. No tests for exam/subject services or controllers. `jest.config.cjs` has no `collectCoverageFrom`. No `test:emulators` script and no `functions/test/integration/` yet (the `backend-test-setup` skill describes the target setup). | `functions/test/`, `package.json` |
| Firestore rules | Still the default test-mode rule (`allow read, write: if request.time < 2026-09-19`) — expired; needs real deny-by-default rules before the live-status listener ships. | `firestore.rules` |
| CORS | Every router uses `cors({ origin: true })` (reflects any origin) instead of an allow-list of the frontend origins. | `route/*Routes.ts` |
| Firestore imports | Legacy `import { firestore } from 'firebase-admin'` alias still in 12 files (types, converters, `firestoreSubjectRepo`, `firestoreExamRepo`). | `types/**`, `repository/**` |
| Exports | `UserRepository`, `ExamRepository` use `export default` instead of named exports. | `types/user/userRepo.ts`, `types/exam/examRepo.ts` |
| Admin access | `getExam` rejects Admin ("Rol no autorizado") although Admin passes every other gate and can open `/teacher/exams/*` on the frontend. | `controller/exam/getExam.ts` |
| Error codes | Two code styles for the same error: `EXAM_NOT_FOUND` (`mapAndReturnDomainError`) vs `exam-not-found` (`HttpErrors`). The frontend maps both. `apiClient` drops the HTTP status. | `controller/errors/*`, `services/apiClient.ts` |
| Frontend 403 | `ProtectedRoutes` redirects a wrong role to `/` instead of `/403` (the route exists). | `routes/ProtectedRoutes.tsx` |
| Frontend leftovers | `services/firebase.ts` still initializes `getFunctions`/`connectFunctionsEmulator` (unused) and has `console.log`s; `SubjectExamsPage.tsx` has `console.log` placeholders; `types/exam.ts` TODOs mention Callable Functions. | frontend |
| Backend env | `.env.example` lacks `ADMIN_EMAIL` / `ADMIN_PASSWORD`, which `seedAdmin.ts` requires. | `backend/.env.example` |
| Frontend env | `.env.example` lacks `VITE_API_BASE_URL` and misspells `VITE_FIREBASE_MEASSUREMENT_ID` (code reads `MEASUREMENT_ID`). | `frontend/.env.example` |
| Type drift | `Subject.teacherEmail` optional on the frontend, required on the backend; `Question.type` exists only on the frontend; `createdAt`/`enrolledAt` typed `unknown` on the frontend. | `src/types/*` |
| Design tokens | Most components use palette classes rather than semantic tokens (accepted, see UI section). | frontend |
