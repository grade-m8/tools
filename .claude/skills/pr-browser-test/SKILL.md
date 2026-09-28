---
name: pr-browser-test
description: Browser end-to-end test of one grade-m8 frontend PR against local Firebase emulators; writes a plan, screenshots and a report to review-artifacts/ for pr-review. Usage: /pr-browser-test <pr-url> [--sha <commit>]
disable-model-invocation: true
argument-hint: <pr-url> [--sha <commit>]
---

# Browser test for a frontend PR

Reads the PR and its ticket, writes an **execution plan**, starts the app with local emulators, runs the plan in a headless browser, and leaves a **report** for `pr-review` to fold into its comment. Arguments: `$ARGUMENTS`.

This session runs the PR's code, so it runs under the review guard's **browser mode**. It may run the stack and drive the browser on `localhost`, write only to `review-artifacts/`, and never post to GitHub. Start it with `--settings .claude/browser-test.settings.json --mcp-config .claude/browser-test.mcp.json` (see `.claude/hooks/README.md`).

- Run one plain command per `Bash` call. Pipes, `;`, `&&` and redirects are denied.
- `--sha <commit>`: test that commit instead of the PR head (backtesting).
- `<tools>` below means this repo's root, which is the project directory.

Work through the steps in order. Each ends on its **done when**.

## 1. Confirm browser mode

1. `Write` `<tools>/review-artifacts/_guard/check.md` with any content. It must **succeed**.
2. `Write` `/tmp/grade-m8-review-canary.txt`. It must be **denied** by the review guard.

**Done when** both behave as described. Otherwise **stop** and report "browser-test guard not active — aborted".

## 2. Load the PR and scope the run

`gh pr view <n> --repo grade-m8/frontend --json number,title,body,author,headRefName,headRefOid,baseRefName,files,closingIssuesReferences`

- Only `grade-m8/frontend` PRs. For anything else, stop and report it.
- `sha` = `--sha` if given, else `headRefOid`; `sha7` = its first 7 characters. The **run** name is `frontend-pr-<n>-<sha7>`, and its artifacts dir is `<tools>/review-artifacts/<run>/`.
- **Classify the task** with `../pr-review/profiles.md` (ticket title plus changed files), the same way `pr-review` does. The profiles decide the run:
  - `fe-view` or `integration` → **in scope**.
  - `fe-component` → in scope **only if** a route already renders the component (search `src/pages/` and `src/routes/` for it). Otherwise write a one-line `report.md` ("componente sin ruta: se evalúa por contrato y código, sin pruebas en navegador") and stop.
  - `hotfix` on the frontend → in scope, but plan only the fixed flow and its neighbours.
  - `training`, or only backend/types/infra profiles → write a one-line `report.md` ("sin cambios de UI: no se ejecutaron pruebas en navegador") and stop.
- **Integrated** (end to end with the Functions emulator, step 4) when the profiles include `integration`, and also for `fe-view` when its screens load data from the API. An `integration` run **must** be end to end: if the backend can't start, the whole run is `bloqueado`, not a UI-only run.
- **Backend branch**: `dev`, unless the PR body or ticket links an open backend PR (`grade-m8/backend/pull/<m>` or `backend#<m>`). In that case use that PR's head, because the frontend change depends on it.

Read the ticket (`closingIssuesReferences`, or the number at the start of the branch name) with `gh issue view <issue> --repo grade-m8/frontend --comments`, and the diff with `gh pr diff <n> --repo grade-m8/frontend`.

**Done when** you know the run name, the profiles, whether the PR is in scope and integrated, the backend branch, and the ticket's acceptance criteria as a list.

## 3. Write the execution plan

Clone the frontend (step 4.1) first if you need to read code beyond the diff. Read `src/routes/AppRouter.tsx`, `src/routes/ProtectedRoutes.tsx`, every changed page and component, and the backend's `functions/src/scripts/seed.ts` for the available data.

Write `<tools>/review-artifacts/<run>/plan.md` with up to **12 scenarios**. Each gets an ID (`S01`…), a title in Spanish, the role and user, preconditions, numbered steps, the expected result, and a **source** (`ticket: <criterion>` or `trap: <name>`).

Cover, in this order:
1. **Ticket criteria**: each acceptance criterion the browser can show gets at least one scenario (happy path first).
2. **States** of each changed screen: loading, empty, error, populated. This is the `gherkin-writer` method.
3. **Traps** (known regressions in this project), whenever the changed screens are exposed to them:
   - `reload`: reload (F5) on a protected page while logged in → the page loads, with no 403 and no redirect to `/`.
   - `wrong-role`: a user without the route's role opens its URL → redirected, and the page doesn't render.
   - `api-error`: the screen's API call fails (injected 500) → an error message or toast appears and the spinner stops.
   - `form-submit`: submitting with required fields empty → errors visible without touching the fields.
   - `navigation`: every link or button the change adds leads to a registered route, not `*` → `/`.
   - `layout`: every changed screen passes the **layout audit** (step 5) in each state it can reach (initial, with validation errors, filled, empty list), at 1440px and 1024px wide. Always include this one for changed pages and components.

**Users** (created by `seed.ts`, all with password `Password123!`): Professor `prof.turing@gradem8.com` (owns the seeded subjects and exams), Professor `prof.hopper@gradem8.com`, Students `ada.lovelace@gradem8.com`, `linus.torvalds@gradem8.com`, `margaret.hamilton@gradem8.com`, Admin `admin@gradem8.com` (created in step 4).

**Done when** every ticket criterion maps to a scenario or is marked "no testeable en navegador: <why>", and every changed route has a `wrong-role` scenario.

## 4. Start the stack

All clones go under `/tmp/grade-m8-review-ctx/` (`mkdir -p /tmp/grade-m8-review-ctx` first). If a clone dir already exists from an earlier run, reuse it: skip the clone and check out the right commit. The shell returns to the project directory after every call, so each command names its clone explicitly (`--prefix`, `--config`, `-C`). Never rely on `cd`.

1. **Frontend at `sha`**: `gh repo clone grade-m8/frontend /tmp/grade-m8-review-ctx/<run>`, then `git -C … fetch origin pull/<n>/head:pr-<n>`, then `git -C … checkout --detach <sha>`.
2. **Backend** at the branch from step 2: `gh repo clone grade-m8/backend /tmp/grade-m8-review-ctx/<run>-backend -- --branch <branch>`. For a backend PR head, fetch `pull/<m>/head` and check it out like the frontend.
3. **Install**, without lifecycle scripts: `npm --prefix <frontend> ci --ignore-scripts`, `npm --prefix <backend> ci --ignore-scripts`, `npm --prefix <backend>/functions ci --ignore-scripts`.
4. **Config**: `cp <backend>/.env.example <backend>/.env`. For integrated runs: `npm --prefix <backend>/functions run build`.
   Then `Read` `<backend>/firebase.json` and `Write` `<backend>/firebase.review.json`: the same content, with `emulators.functions.port` set to **5101** and `emulators.ui.enabled` set to `false`. Other local projects use 5001. Keep the Auth port at 9099, because the frontend hardcodes it.
5. **Java**: run `java -version`. If it's older than 21, run `/usr/libexec/java_home -v 21+` (macOS) and prefix the emulator command with `PATH=<that path>/bin:$PATH`.
6. **Emulators**, **in the background**: `npx --yes firebase-tools emulators:start --config <backend>/firebase.review.json --only auth,firestore,functions --project demo-grade-m8` (for runs that aren't integrated, `--only auth,firestore`). Background output may be buffered (a command wrapper can hold it until exit), so check readiness by polling instead: `curl -s http://127.0.0.1:4400/emulators` must list `auth`, `firestore` and, for integrated runs, `functions`. Then `curl -s http://127.0.0.1:5101/demo-grade-m8/us-central1/exams/owned` should answer with an `unauthenticated` JSON error. Poll a few times. If it's still not ready after about 20 checks, read the background output for the error.
7. **Seed**: `npm --prefix <backend> run seed`, then `ADMIN_EMAIL=admin@gradem8.com ADMIN_PASSWORD=Password123! npm --prefix <backend> run seed:admin`.
8. **Frontend**, **in the background**: `VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-grade-m8 VITE_FIREBASE_API_KEY=demo-key VITE_FIREBASE_AUTH_DOMAIN=localhost VITE_API_BASE_URL=http://localhost:5101/demo-grade-m8/us-central1 npm --prefix <frontend> run dev -- --port 5173 --strictPort`. Poll `curl -sf http://localhost:5173/` until it succeeds.

**Done when** `curl -sf http://localhost:5173/` succeeds, the emulator output says all emulators are ready, and both seed commands finished without errors. If a command is denied, a port is already taken, or the stack fails to start, record the exact command and error in the report, mark every scenario `bloqueado`, and go to step 7. Don't look for another way to run it. **Never stop, kill or restart a process this session didn't start**: other projects on the machine own their ports.

## 5. Run the plan in the browser

Use the Playwright tools (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`, `browser_wait_for`, `browser_evaluate`, `browser_take_screenshot`, `browser_console_messages`, `browser_network_requests`, `browser_close`). Base URL: `http://localhost:5173`.

For each scenario:
- Start clean: `browser_close`, then log in through the landing page as the scenario's user.
- Work from `browser_snapshot` (the accessibility tree) to find elements. Check the expected result with `browser_wait_for` or the snapshot text, not by assumption.
- **Injecting an API error** (`api-error`): after logging in, use `browser_evaluate` to wrap `window.fetch` so requests whose URL contains the target path (e.g. `/subjects/owned`) resolve to `new Response(JSON.stringify({ error: 'internal-error', message: 'x' }), { status: 500 })`. Then reach the screen by **clicking** inside the app, not by reloading (a reload restores `fetch`).
- **On a failure**, or when the console shows an uncaught error: `browser_take_screenshot` with filename `review-artifacts/<run>/<ID>-fail.png`, then collect `browser_console_messages` and the failing `browser_network_requests`.
- On a pass for a `ticket:` scenario, take `review-artifacts/<run>/<ID>-ok.png` as evidence.
- **Layout audit** (`layout` scenarios, and at every state a scenario reaches on a changed screen, including the error state after submitting): `Read` `layout-audit.js` (next to this skill) and pass its **whole content, unchanged,** as the `function` of `browser_evaluate`. It measures the page and returns `findings` (`field-row`, `control-size`, `icon-text`, `overflow`, each with `deltaPx`, the row, its `align-items`, and the fields involved). It also outlines the offending elements in red. Any finding makes the scenario a `falla`. Take the screenshot right after the audit (`review-artifacts/<run>/<ID>-layout-<state>-<width>.png`) so the outline is visible, and record each finding with the state and width. Switch width with `browser_resize` (1440×900, then 1024×900).

Screenshot filenames are resolved from the project directory, so always start them with `review-artifacts/<run>/`. Anything else ends up outside the gitignored folder.

**Done when** every scenario in `plan.md` is `ok`, `falla` or `bloqueado`, and each `falla` has a screenshot, the expected vs. actual result, and its console and network evidence.

## 6. Save a re-runnable script

Write `<tools>/review-artifacts/<run>/scenarios.spec.ts`: a Playwright Test file with one `test()` per executed scenario, repeating the steps you actually took. Use `getByRole` / `getByLabel` / `getByText` locators and the same users. Put a header comment explaining how to start the stack (the step 4 commands) and run it (`npx playwright test <file>`). It's for a person to reproduce failures; nothing runs it automatically.

**Done when** each executed scenario appears in the file.

## 7. Write the report and shut down

Write `<tools>/review-artifacts/<run>/report.md`:

```markdown
# Pruebas en navegador — frontend#<n> @ <sha7>

- Backend: <branch or backend PR> · Modo: <integrado | solo UI> · Tipo de tarea: <profiles> · Fecha: <date>
- Resultado: <ok> ok · <falla> fallas · <bloqueado> bloqueados

| ID | Escenario | Rol | Resultado | Evidencia |
|---|---|---|---|---|

## Fallas

### <ID> — <title>
- **Impacto sugerido:** blocker (ticket criterion) | major (trap, including every `layout` finding) | minor (cosmetic)
- **Layout (if any):** check · Δpx · state · width · fields · `align-items` of the row
- **Pasos:** …
- **Esperado:** … · **Obtenido:** …
- **Consola / red:** …
- **Captura:** `review-artifacts/<run>/<ID>-fail.png`
```

Then stop the frontend and emulator background tasks **this session started** (and nothing else), and call `browser_close`.

**Done when** `report.md` exists, both background tasks are stopped, and you've reported one line: `frontend#<n> @ <sha7>: <ok>/<falla>/<bloqueado> — review-artifacts/<run>/`.
