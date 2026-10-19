---
name: plan-with-user-input
description: Guides the agent to actively consult the user during the planning phase, asking clarifying questions on ambiguities, constraints, scope, and technical preferences before finalizing an execution plan.
---

# Plan with User Input

Use this skill when receiving a complex, ambiguous, or multi-faceted task request. Rather than jumping directly to conclusions or assuming unspoken constraints, this skill modifies the agent's behavior to engage in an interactive discovery dialogue with the user before finalizing the execution plan.

## Purpose

Complex projects often contain critical unknowns—budget, existing infrastructure, target audience, business priorities, or performance requirements. This skill ensures:
1. High-impact unknowns are surfaced early.
2. The user is actively involved in defining boundaries and scope.
3. The resulting plan is accurate, realistic, and tailored to the user's real situation.

## Workflow

### 1. Identify Critical Unknowns & Decision Nodes
Before laying out steps, review the request against common blind spots:
- **Scope & Deliverables**: Is the target an MVP, a proof of concept, or production-grade system?
- **Constraints & Budget**: Are there constraints on time, hosting costs, paid third-party APIs, or team size?
- **Existing Assets**: Does a codebase, brand identity, database schema, or design system already exist, or is this starting from scratch?
- **Target Audience & Market**: Who are the primary users, and what are the key success metrics?
- **Technical & Architectural Preferences**: Are specific languages, cloud providers, or frameworks preferred or required?

### 2. Formulate Concise Clarifying Questions
Group questions into a focused, easy-to-answer format:
- Limit the inquiry to **2–4 high-leverage questions** (avoid exhausting questionnaires).
- Use plain language first (per `MENTOR.md`).
- Provide concrete options or smart defaults where applicable so the user can reply quickly.

Example structure:
> "Para armar el plan más efectivo y ajustado a tus necesidades, necesito confirmar algunos puntos clave:
> 1. **Alcance inicial**: ¿Buscamos un MVP rápido o una arquitectura lista para escalar en producción?
> 2. **Estado actual**: ¿Ya cuentas con marca, diseño o catálogo, o comenzamos desde cero?
> 3. **Presupuesto / Proveedores**: ¿Hay preferencia por alguna plataforma o servicios gratuitos/open-source?"

### 3. Integrate Feedback into Plan Formulation
Once the user responds:
- Acknowledge their choices and constraints explicitly.
- Use their answers to filter out unnecessary tasks and prioritize critical ones.
- Reflect their specific decisions in the dependency graph and agent assignments.
- If the user provides partial or ambiguous answers, make a stated sensible assumption and proceed with the plan, noting the assumption clearly.

## What NOT to do

- Don't ask trivial or rhetorical questions ("Are you ready to begin?").
- Don't dump an overwhelming checklist of 15 questions; stick to high-leverage decision points.
- Don't silently ignore user answers once they provide them.
- Don't commit to a monolithic plan without verifying load-bearing assumptions first.
