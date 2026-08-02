---
name: teach
description: On-demand concept walkthrough for a junior dev on the Grade-M8 rebuild. Pulls the relevant wiki page(s), adapts depth to what they already know, and checks understanding at the end instead of just explaining and moving on. Use whenever a dev asks "what is X," "why does this work this way," or "walk me through this."
---

# Teach a concept

This skill structures an explanation so it's consistent with the wiki and actually lands, rather than being generated fresh (and potentially differently) every time. Follow `../../../MENTOR.md` throughout — this skill is the mechanism for the "explain" half of that agreement, not a separate policy.

## Usage

```
/teach <topic or question>
```

Examples: `/teach what is a REST API`, `/teach why can't the frontend just delete from the database directly`, `/teach walk me through the grading pipeline`

## Steps

1. **Find the right altitude.** Check `../../../wiki/glossary.md` and the numbered wiki pages for anything matching the topic. If the question is really about *this specific codebase's* code rather than a general concept, that's still in scope — explain the code, but explain it in terms of the general concept first (e.g. "this is validating the request body — see REST APIs on why that happens at the boundary" before walking the specific lines).

2. **Gauge what they already know**, briefly — if it's not obvious from how the question was asked, a quick check ("have you run into REST APIs before, or is this the first time?") avoids both over-explaining to someone who already gets it and under-explaining to someone who doesn't.

3. **Explain, plain language first.** Introduce new terms by describing what they do before naming them (per `MENTOR.md`). Use the wiki page's explanation as the base — don't contradict it; if you think the wiki's explanation is actually wrong or outdated, say so and go fix the wiki page rather than silently diverging from it.

4. **Connect it to what they're actually working on**, if there's a concrete task in play — an abstract explanation of REST APIs lands better paired with "and that's why the endpoint you're building needs a status code for the missing-field case."

5. **Check understanding without asking "does that make sense."** Ask them to apply the idea to something small and concrete instead — predict an outcome, point at where something belongs, restate it in their own words. Treat a wrong or shaky answer as useful signal pointing at the specific gap, not as a sign to repeat the whole explanation from the top.

6. **Flag if this was a foundational concept**, per `MENTOR.md`'s foundational-vs-incidental distinction — worth remembering, worth revisiting later if it doesn't fully stick on the first pass.

## What NOT to do

- Don't turn this into an assigned exercise or curriculum step unless the dev explicitly asks for practice material — this skill is reactive, answering the question actually asked.
- Don't withhold writing real code if what they actually need alongside the explanation is a working example — MENTOR.md's teaching stance is not a restriction on capability.
