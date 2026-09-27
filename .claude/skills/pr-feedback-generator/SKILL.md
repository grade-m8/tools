---
name: pr-feedback-generator
description: >-
  Use this skill to turn QA review findings into a GitHub PR comment for the developer, in Spanish,
  explaining each issue and giving hints. Manual mode returns copy-paste Markdown; automated mode
  (called by pr-review) writes the comment body to a file for posting.
---

# PR Feedback Generator Skill

Turns a list of review findings into the PR comment a developer reads. Two modes, same content:

- **Manual** (a person asked for feedback): return the Markdown inside a single ```markdown code block, ready to copy.
- **Automated** (called by `pr-review` with a target path): write the raw Markdown, with no wrapping code block, to that path with the `Write` tool, then return the path. Nothing else is posted from here.

## Tone and Style
- Spanish, formal but approachable, addressed to the PR author: start with `Hola @<author>!`.
- Open with one or two sentences of **specific** praise for what's genuinely good in this PR (a component, a pattern, an edge case handled), then move to the points.
- Close with: "Cualquier cosa avisame y lo revisamos/vemos."

## Feedback Guidelines
- **Explain the "why"**: each point says what happens at runtime or for the user/team, not just which rule it breaks.
- **Hints, not solutions**: point to the direction, the file, or an existing example in the repo to copy (e.g. "fijate cómo lo resuelve `updateExam.ts`"). A short snippet is fine for a one-line fix or to show a pattern generically; don't hand over the finished change.
- **Evidence**: every point names `file:line` and, for convention issues, the `CONVENTIONS.md` section it relies on.
- **Ticket vs. reality**: when a problem comes from the ticket itself (wrong name, missing file, ambiguous param), say so and don't attribute it to the developer.
- **Formatting**: GitHub Flavored Markdown; separate points with `---`.

## Comment structure

```markdown
Hola @<author>!

<1–2 sentences of specific praise>

<one line: whether it's ready to merge or what's left>

---

### 1. <Short title>

* **El escenario:** <what the code does now, with `file:line`>
* **El riesgo:** <what breaks, for whom, when>
* **Qué revisar:** <the hint / direction>

---

### 2. …

---

<Optional "Otros puntos importantes" list: one line each — `file:line` — problem — hint>

<Optional "🧪 Pruebas en navegador" section, when a browser-test report exists: the results table (ID, escenario, rol, resultado), then one line per failure pointing to its full point above and to its screenshot (`review-artifacts/<run>/<ID>-fail.png`, stored on the review runner, since GitHub comments can't take uploads from the CLI)>

<Optional "Sugerencias (no bloqueantes)" list: one line each>

Cualquier cosa avisame y lo revisamos/vemos.
```

Order points most severe first (security, runtime bugs, contract mismatches, ticket gaps, then conventions and hygiene). If there's nothing to fix, say so in two or three lines: praise plus "queda lista para mergear desde mi lado".

## Automated mode additions

When called by `pr-review`, wrap the structure above with a fixed header and footer:

```markdown
> 🤖 **Revisión automática** — generada por IA a partir de `CONVENTIONS.md` y los agentes de QA de `grade-m8/tools`. Es orientativa: la aprobación final la hace una persona del equipo.
>
> **Veredicto:** <Aprobado | Requiere cambios | Rechazado> · **Commit revisado:** `<short sha>` · **Tipo de tarea:** <profiles, e.g. `fe-view` + `integration`>

<comment structure>

<!-- ai-review:repo=<repo> pr=<number> sha=<full head sha> -->
```

The final HTML comment is the marker `pr-review` uses to skip commits it has already reviewed. Keep it the exact last line, with no text after it.
