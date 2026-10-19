# 👹 Devil’s Advocate — Adversarial Software Engineering AI Agent

> **"Do not merely tell the team what could go wrong. Investigate whether it can go wrong, explain why, and provide actionable evidence or a concrete way to verify the risk."**

Devil’s Advocate is an adversarial software engineering agent designed for the Grade-M8 rebuild and modern distributed web architectures. It proactively challenges assumptions, formulates falsifiable failure hypotheses, discovers blind spots, simulates future catastrophes (Future Autopsies / Premortems), and generates actionable, evidence-backed findings across technical, quality, product, and delivery dimensions.

---

## 🏛️ System Architecture

Devil’s Advocate is architected as a modular, pipe-and-filter adversarial intelligence engine with strict read-only execution safeguards:

```
                                      ┌──────────────────────────────────────────────┐
                                      │         Event Triggers / Input Context       │
                                      │  (PR Diffs, Requirements, Sprints, Releases) │
                                      └──────────────────────┬───────────────────────┘
                                                             │
                                                             ▼
                                      ┌──────────────────────────────────────────────┐
                                      │        DevilsAdvocateOrchestrator            │
                                      │    (Coordinates 6 Proactive Modes)           │
                                      └──────┬───────────────┬────────────────┬──────┘
                                             │               │                │
                      ┌──────────────────────┘               │                └──────────────────────┐
                      ▼                                      ▼                                       ▼
        ┌──────────────────────────┐           ┌──────────────────────────┐            ┌──────────────────────────┐
        │     Assumption Radar     │           │   Context Retriever      │            │  Historical Memory       │
        │  Tracks & Audits Project │           │  Safe Git diff, repo AST,│            │  Searchable Postmortems  │
        │  Assumptions (ASM-001..5)│           │  wiki architecture docs  │            │  Pattern Recurrence Match│
        └─────────────┬────────────┘           └─────────────┬────────────┘            └─────────────┬────────────┘
                      │                                      │                                       │
                      └──────────────────────────────┬───────┴───────────────────────────────────────┘
                                                     ▼
                                      ┌──────────────────────────────┐
                                      │ Evidence-Based Risk          │
                                      │ Investigator & Scenario Gen  │
                                      │ (Falsifiable Hypotheses)     │
                                      └──────────────┬───────────────┘
                                                     │
                      ┌──────────────────────────────┴──────────────────────────────┐
                      ▼                                                             ▼
        ┌──────────────────────────┐                                  ┌──────────────────────────┐
        │ Cross-Role Debate Engine │                                  │ Future Autopsy Simulator │
        │ Dev / QA / Arch / PO / PM│                                  │ Pre-Mortem Simulation &  │
        │ Viewpoint Synthesis      │                                  │ Early Warning Signals    │
        └─────────────┬────────────┘                                  └─────────────┬────────────┘
                      │                                                             │
                      └──────────────────────────────┬──────────────────────────────┘
                                                     ▼
                                      ┌──────────────────────────────┐
                                      │ Transparent Risk Prioritizer │
                                      │ Separates Impact from Conf.  │
                                      │ Suppression Audit Log        │
                                      └──────────────┬───────────────┘
                                                     │
                                                     ▼
                                      ┌──────────────────────────────┐
                                      │ Auditable Markdown & JSON    │
                                      │ Reports (Section 8 Standard) │
                                      └──────────────────────────────┘
```

---

## 🚀 Proactive Operating Modes

1. **Mode 1: Pull Request Investigation (`pr`)**  
   Audits git diffs for race conditions, non-idempotent task processing, missing transaction wrappers, and unhandled async rejections.
2. **Mode 2: Requirement Challenge (`req`)**  
   Challenges user stories and specs for missing timezones, undefined error handling, contradictory acceptance criteria, and edge states.
3. **Mode 3: Sprint Premortem (`premortem`)**  
   Simulates a "Future Autopsy" 30–60 days in the future, exposing chain-of-causality failure sequences before sprint commitment.
4. **Mode 4: Release Risk Assessment (`release`)**  
   Evaluates breaking schema migrations, backward compatibility, environment variables, and rollback safety.
5. **Mode 5: Incident Pattern Detection (`incident`)**  
   Matches new postmortems against historical incident patterns to prevent systemic regression.
6. **Mode 6: On-Demand Investigation (`ask`)**  
   Adversarial inquiry engine for questions like *"Challenge this architecture"* or *"What happens if two students submit at the exact same millisecond?"*

---

## 🛠️ CLI Usage & Quickstart

```bash
# Display help and usage
devils-advocate --help

# Mode 1: Audit a Pull Request or Git Diff
node src/cli/cli.ts pr HEAD "PR #42: Async Evaluation Worker"

# Mode 2: Challenge a Requirement or User Story
node src/cli/cli.ts req "Students must submit homework before 23:59 on Sunday." "Homework Deadline Story"

# Mode 3: Run a Sprint Premortem (Future Autopsy)
node src/cli/cli.ts premortem "Sprint 14 Finals Week" "500 concurrent students submitting exams"

# Mode 4: Assess Release Candidate Risk
node src/cli/cli.ts release "v1.2.0-rc1" "Refactored Firestore schema with renamed fields"

# Mode 5: Inspect Incident Patterns
node src/cli/cli.ts incident data/historical-incidents.json "Gemini Quota Outage"

# Audit Active Assumption Radar
node src/cli/cli.ts radar list
node src/cli/cli.ts radar audit "async function updateAIReport() { await db.collection('analysisItems').update(...) }"

# Export typed JSON for CI/CD integrations
node src/cli/cli.ts pr HEAD --json
```

---

## 🧪 Automated Test Suite

Devil's Advocate is thoroughly verified with Node's native test runner (`node:test`) and zero external dependencies:

```bash
npm test
```

### Test Coverage Highlights:
- **`tests/schemas.test.ts`**: Verifies data structure compliance for Findings, Assumptions, Debates, Autopsies, and JSON schemas.
- **`tests/assumption-radar.test.ts`**: Verifies registration, invalidation auditing, and mutation event logging.
- **`tests/risk-investigator.test.ts`**: Verifies deterministic hypothesis falsification, Firestore concurrency detection, and risk suppression.
- **`tests/cross-role-debate.test.ts`**: Verifies 5-perspective synthesis with distinct stances and friction points.
- **`tests/future-autopsy.test.ts`**: Verifies premortem simulation, chain of causality, early warning signals, and P0 preventative actions.
- **`tests/orchestrator.test.ts`**: Verifies end-to-end orchestration of all 6 operating modes and Markdown report generation.
- **`tests/scenarios.test.ts`**: Validates 5 realistic end-to-end software engineering scenarios against `data/evaluation-scenarios.json`.

---

## 📋 Standard Finding Format (Section 8)

Every finding produced by Devil's Advocate conforms to an auditable contract:

- **Title**: Concise description of the potential defect or vulnerability.
- **Classification**: `Confirmed Defect` | `Evidence-Backed Risk` | `Unverified Hypothesis` | `Requirement Ambiguity` | `Missing Validation` | `No Issue Found`
- **Severity**: `Critical` | `High` | `Medium` | `Low` (with explicit rationale).
- **Confidence**: `Confirmed` (1.0) | `High` (0.8) | `Medium` (0.5) | `Low` (0.2).
- **Affected Areas**: Code files, endpoints, collections, or specifications.
- **Evidence**: Concrete code line references, architecture doc citations (`wiki/10-grade-m8-architecture.md`), or test logs.
- **Failure Scenario**: Step-by-step causality sequence explaining how the failure unfolds.
- **Reproduction Steps**: Deterministic test case or reproducible steps.
- **Recommended Mitigation**: Actionable engineering remedy.
- **Suggested Owner**: `backend-dev` | `frontend-dev` | `qa-engineer` | `tech-lead` | `product-owner` | `project-manager`.
- **Uncertainty & Limitations**: Explicit statement of what remains unverified.
- **Verification Status**: `Reproduced` | `Disproved` | `Partially Investigated` | `Not Tested`.
- **Composite Risk Score**: Transparent calculation separating impact from confidence.

---

## 🔒 Safety, Guardrails & Trust

1. **Read-Only Non-Destructive Guardrail**: The agent never modifies production databases, deletes branches, or executes destructive commands.
2. **Untrusted Input Isolation**: PR text, user stories, and third-party inputs are treated as data, preventing prompt injection or policy overrides.
3. **No Autonomous Merging or Release Decisions**: Devil's Advocate informs decisions with evidence; it does not block releases unilaterally.
4. **Pedagogical Alignment (`MENTOR.md`)**: Findings explain *why* an architectural invariant exists rather than delivering blunt criticism.
