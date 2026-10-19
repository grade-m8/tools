---
name: align-problem-with-agent
description: Analyzes a specific task or problem, searches the repository roster in tools/.agents/agents/ to find the best specialized agent, and crafts an actionable, ready-to-run prompt tailored to that agent's scope, tools, and conventions.
---

# Align Problem with Agent

Use this skill when decomposing a complex goal or task and assigning it to the most qualified agent in the `tools/.agents/agents/` (or `.claude/agents/`) roster. It bridges the gap between high-level task definitions and concrete, ready-to-dispatch agent prompts.

## Purpose

Rather than giving an agent a generic prompt or assigning tasks blindly, this skill:
1. Matches task requirements against existing agents' domains, tools, and constraints.
2. Respects agent boundaries and avoids duplicating responsibilities.
3. Crafts a tailored prompt with full context, explicit constraints, input artifacts, and expected output deliverables.

## Workflow

### 1. Inspect Available Agents
- List and examine the agents in `tools/.agents/agents/` (or `.claude/agents/`).
- Read the agent's frontmatter (`name`, `description`, `tools`) and boundary sections.
- Identify what the agent owns, what tools it has access to, and which adjacent agents it hands off to.

### 2. Match Problem to Agent
Evaluate candidate agents based on:
- **Domain ownership**: Does the task fall squarely within the agent's defined responsibility (e.g., Firestore schema/indexes -> `firestore-rules-data-architect`; REST endpoint -> `backend-dev` or `feature-scaffolder`; UI layout -> `frontend-ui-designer`; SAST review -> `security-reviewer`)?
- **Tool compatibility**: Does the agent possess the required tool permissions (e.g., `Write/Edit` for implementation, `Read/Grep/Glob` for read-only audits)?
- **Anti-overlap check**: If a task spans multiple boundaries, split the task rather than assigning an out-of-scope task to a single agent (e.g., split full-stack features into backend, frontend, and integration tasks).
- **Fallback / Gaps**: If no specialized agent exists for an unusual domain, assign the closest relevant generalist or propose scaffolding a new agent via `agent-builder`.

### 3. Generate Tailored Prompt
Craft a ready-to-run prompt for the chosen agent using the following structure:

```markdown
### Prompt para: `<agent-name>`

**Objetivo**: <Descripción concisa y sin ambigüedades de lo que debe lograrse>

**Contexto y Entradas**:
- Archivos o especificaciones de entrada: `<rutas o referencias>`
- Requisitos previos cumplidos: `<dependencias o tareas previas>`

**Instrucciones y Alcance**:
1. <Paso 1 concreto respetando las convenciones del agente>
2. <Paso 2 concreto>
3. <Restricciones explícitas: qué NO debe tocar o hacer>

**Entregables Esperados**:
- `<Artefactos, archivos generados/modificados o reporte de salida>`
- `<Criterios de validación o verificación>`
```

## What NOT to do

- Don't assign tasks to non-existent agents without checking the roster in `tools/.agents/agents/`.
- Don't generate vague prompts (e.g., "build the frontend"); provide precise context, file paths, constraints, and criteria.
- Don't violate least-privilege tool boundaries (e.g., don't ask a read-only agent to edit files).
- Don't force an agent to perform tasks outside its scope when another specialized agent exists.
