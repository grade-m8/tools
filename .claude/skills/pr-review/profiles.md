# Task profiles

The review criteria depend on **what kind of task** the PR implements. `pr-review` (step 4) and `pr-browser-test` (step 2) classify each PR into one or more **profiles** and apply that profile's criteria on top of the **base**. Every rule here refers to a section of `CONVENTIONS.md`, which holds the full text.

## Classifying

Use two signals and apply **every** profile either one points to:

1. **The ticket title** (the intent): the prefix `[Backend]`, `[Frontend]`, `[Integración]`, `[HOTFIX]`, `[Capacitación]`, and then the first matching keyword in the table below.
2. **The changed files** (what the PR actually does): the paths in the table below.

If the two disagree (e.g. a `[Frontend]` "component" ticket whose PR also rewrites a service), apply both profiles and mention the mismatch as a scope question, not as a finding. A ticket can be filed in the "wrong" repo (some `[Backend]` tickets live in `frontend` issues): trust the PR's repo and files.

| Profile | Title keywords (after the prefix) | Changed paths |
|---|---|---|
| `be-types` | Tipos, DTOs, Definición de | backend `functions/src/types/**`, except repository/service interfaces (`*Repo.ts`, `*Service.ts`) |
| `be-repository` | Repositorio, Modelo | backend `functions/src/repository/**`, `functions/src/types/**/*Repo.ts` |
| `be-service` | Servicio, Reglas de Negocio, Lógica | backend `functions/src/service/**`, `functions/src/types/**/*Service.ts` |
| `be-controller` | Controlador, Rutas, endpoints, Cableado, inyecciones | backend `functions/src/controller/**`, `route/**`, `middleware/**`, `di/**`, `index.ts` |
| `be-tests` | Tests, Pruebas, Suite, TASK-TEST | backend `functions/test/**` only |
| `fe-types` | Tipos, Interfaces | frontend `src/types/**` only |
| `fe-component` | Componente, Tarjeta, Banner, Modal, Indicadores, Card, Stepper | frontend `src/components/**` without a new route using it |
| `fe-view` | Vista, Página, Pantalla, Paso | frontend `src/pages/**`, `src/routes/**` |
| `integration` | prefix `[Integración]`, or SDK, Servicio API, Datos Reales | frontend `src/services/**`, `src/hooks/**` calling the API, `src/context/**` |
| `infra` | CI, CD, Pipeline, Configuración, linters, Variables de Entorno, Deployment | `.github/**`, `firebase.json`, `*.config.*`, `package.json` scripts, `config/**`, `.env.example` |
| `hotfix` | prefix `[HOTFIX]`, or Fix / FIX / hotfix | (any) |
| `training` | prefix `[Capacitación]` | (any) |

`training` skips the review: post nothing, and report "ticket de capacitación: sin revisión automática". `hotfix` **replaces** the other profiles' style and scope criteria (see below), but keeps their correctness and security criteria.

## Base (every profile)

- Ticket fulfillment, and ticket-vs-reality notes (`qa-ticket-reviewer`).
- **Cross-ticket contracts**, both directions (`CONVENTIONS.md` → Cross-ticket contracts).
- Branch hygiene, CI status, and hygiene (`console.log`, commented-out code, `==`, misleading names).
- Security: `security-reviewer` for every backend profile. For frontend profiles, only when auth, routes, services or context change.

## Backend profiles

### `be-types`
- **Must check:** server-owned fields (ids, owner ids, `status`, timestamps) excluded from create/update DTOs; the **frontend mirror** (`src/types/*`) updated, or the frontend PR linked (Cross-repo contract); student-facing variants omit teacher-only data (`idealAnswer`); names match what downstream tickets will import.
- **Reviewers:** `qa`, `integration-dev` (always, so it can compare both repos).
- **Tests:** none required for pure types.
- **Blocker when:** a mirror mismatch that breaks the frontend at runtime; a server-owned field accepted from the client.

### `be-repository`
- **Must check:** typed `withConverter`; partial updates with `.set(patch, { merge: true })` **without** the converter; never write `undefined` (optional → `?? null`); batch replacement for subcollections; `firestore.indexes.json` for new composite queries; modular `firebase-admin/firestore` imports (Backend → Firestore).
- **Reviewers:** `qa`, `security-reviewer`.
- **Tests:** converter unit tests for new converters.
- **Blocker when:** a runtime Firestore error path (`undefined` values, converter on a partial update, `update()` where upsert is needed).

### `be-service`
- **Must check:** business rules here, not in controllers; **ownership** checks (including the target resource when moving or linking); returns `T | AppError` (new `AppError` members mapped in `errorMapping.ts`); no `firebase-functions`/HTTP imports; dependencies injected via `di/container.ts` (Backend → Layering rules, Errors, Auth & roles).
- **Reviewers:** `qa`, `security-reviewer`.
- **Tests:** unit tests for new or changed service logic, **required** (`functions/test/unit`, mocks in `functions/test/mock`).
- **Blocker when:** a missing ownership check; missing unit tests for new logic.

### `be-controller`
- **Must check:** `authMiddleware` + `requireRoles`, or explicit role handling in the controller/service; hand-written validation (`?.trim()`, `== null` for numbers); **`ALLOWED_UPDATE_FIELDS` whitelist** for PATCH/PUT, never `req.body as Dto`; immutable fields never whitelisted; `{ error, message }` bodies via `HttpErrors` / `mapAndReturnDomainError`; the new function exported from `index.ts`; frontend `services/*Service.ts` parity (Backend → Validation, Auth & roles, Errors).
- **Reviewers:** `qa`, `security-reviewer`, `integration-dev` (when a route or response shape changes).
- **Tests:** controller unit tests for 401/400/403/success paths.
- **Blocker when:** mass assignment; a route without auth or role enforcement; a response shape the frontend already relies on changes without the mirror.

### `be-tests`
- **Must check:** tests in `functions/test/unit`, mocks from `functions/test/mock` (`makeMock<Interface>()`); no Docker and no global `setup.ts`; assertions that would fail if the code broke (no `it.skip`, no empty expectations); all three roles covered for role logic (Testing & CI).
- **Reviewers:** `qa`.
- **Blocker when:** tests that can't fail, or tests that change production code to pass.

## Frontend profiles

### `fe-types`
- **Must check:** parity with the backend types they mirror (backend `Timestamp` → `string`); DTO wrappers identical; names the downstream tickets will import (Cross-repo contract, Cross-ticket contracts).
- **Reviewers:** `qa`, `integration-dev`.
- **Browser:** no.

### `fe-component`
- **Must check:** props exactly as the ticket specifies; **controlled** when a parent owns the state; callbacks pass IDs; emitted data complete; **fitness for the downstream ticket** that will use it (read it and its PR); design fidelity against the ticket screenshot or `design-system`; tokens only (no hex); Shadcn defaults that fight a flat design (`Card` ring); alignment rules (items-start for field rows, icon centering); `title` on truncated text (Frontend → UI & design system, Cross-ticket contracts).
- **Reviewers:** `qa` (with the `design-system` clone).
- **Browser:** always. On its route if one already renders it, otherwise in a **component harness** (fixed props, every state at 1440/768/375 px): layout, overflow, clipping and responsiveness, not flows. Flows stay judged by the contract and code.
- **Blocker when:** the downstream ticket can't be implemented as written without changing this component.

### `fe-view`
- **Must check:** route registered in `AppRouter.tsx` inside `ProtectedRoutes` with the right roles (backend enforces the same); loading/empty/error/populated states; waits for the role before redirecting; `navigate()` targets exist; uses the components its upstream tickets built, as designed; layout alignment in every state (Frontend → Auth, roles, routing; UI & design system).
- **Reviewers:** `qa`, `security-reviewer` when routes or roles change.
- **Browser:** **yes**, with the `layout` audit. Also end to end when data comes from the API (see `integration`).
- **Blocker when:** a role-restricted page left unprotected; a ticket criterion failing in the browser; a navigation dead end.

### `integration`
- **Must check:** every call through `services/*Service.ts` → `apiClient` (verb, path, body exactly as the backend controller reads it, no re-wrapped DTOs); required params non-optional; `try/catch` in hooks with a user-facing error; types matching the backend at the commit the frontend targets; the backend branch the ticket depends on (Frontend → Talking to the backend; Cross-repo contract).
- **Reviewers:** `qa`, `integration-dev` (**always**, with the backend clone), `security-reviewer` when auth or context change.
- **Browser:** **yes, end to end, mandatory**: Functions emulator on, real API calls, `api-error` checks for each endpoint used.
- **Blocker when:** a payload or response mismatch (400/404 at runtime); an API failure that leaves the UI stuck.

## Other profiles

### `infra`
- **Must check:** CI still runs on PRs to `dev` and `main`; no secrets committed; deploy targets (`dev` vs prod) correct; scripts referenced by CI exist; `.env.example` lists every variable the code reads (Testing & CI, Config).
- **Reviewers:** `qa`, `security-reviewer` (secrets, permissions).
- **Browser:** no.
- **Blocker when:** a committed secret; CI or CD pointing at the wrong project; a required check silently removed.

### `hotfix`
- **Must check:** the root cause is what's fixed (not a symptom); the fix is minimal; nothing else regresses (check callers of the changed code); a test or browser check that would have caught it, when cheap.
- **Skip:** style, naming, scope-creep and refactor suggestions, unless they are the bug.
- **Reviewers:** `qa`, plus `security-reviewer` if the fix touches auth, and `integration-dev` if it touches the contract.
- **Browser:** only to reproduce the fixed flow, if it's a frontend fix.
