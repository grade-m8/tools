---
name: pr-feedback-generator
description: >-
  Use this skill to generate a raw Markdown file containing PR feedback for a developer.
  It formats the output specifically for GitHub PR comments, explaining issues and providing hints.
---

# PR Feedback Generator Skill

When the user asks you to generate feedback for a PR (often after a QA review), you must generate a raw Markdown snippet that the user can copy and paste directly into GitHub.

## Tone and Style
-   **Formal but approachable**.
-   **Greeting**: Always start by greeting the developer (e.g., "Hola @[username] / Hola equipo,").
-   **Sign-off**: Always close with something like: "Cualquier cosa avisame y lo revisamos/vemos." or similar.

## Feedback Guidelines
-   **Explain the "Why"**: Clearly explain what failed or what needs improvement based on the QA analysis.
-   **Provide Hints, Not Solutions**: Give the developer a hint or direction on how to fix the issue. **DO NOT** give them the exact code solution unless it is a very subtle/trivial fix (like a typo or a one-line syntax correction).
-   **Formatting**: Use standard GitHub Flavored Markdown (`#`, `##`, `*`, `> `, code blocks ` ``` `, etc.) so it renders beautifully in the PR comment.

## Output Format
Generate a markdown code block containing ONLY the raw markdown text so it's easy to copy.

Example Structure:
```markdown
Hola, revisé tu PR y tengo algunos comentarios para que veamos antes de aprobarla.

### 📝 Cumplimiento del Ticket
- Aquí explicas si faltó algo del ticket.

### 🛠️ Arquitectura y Código
- Aquí das los hints sobre cómo mejorar la duplicación o la estructura, sin darles el código hecho.

Cualquier cosa avisame y lo revisamos/vemos.
```
