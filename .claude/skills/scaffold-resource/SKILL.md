---
name: scaffold-resource
description: Generate a new REST resource vertical slice (Zod schema, repository, service, controller, routes) for the Grade-M8 backend, following the layered architecture in MENTOR.md and this repo's established resource pattern. Ends with a plain-language walkthrough of what was generated, for junior devs new to backend structure.
---

# Scaffold a backend resource

Use this skill when adding a new Firestore-backed REST resource to the rebuild's `backend/` repo (e.g. "exams," "enrollments"). It generates the mechanical wiring for one resource, following the layering described in `../../wiki/10-grade-m8-architecture.md` and `../../MENTOR.md` — you (or the requesting dev) still fill in real business logic and choose correct role gating.

## Usage

```
/scaffold-resource <ResourceName> <field:type>[,<field:type>...]
```

Example: `/scaffold-resource Enrollment subjectId:string,studentId:string,status:'active'|'dropped'`

## Before generating: confirm the pattern exists to copy from

This skill assumes at least one resource already exists in the target `backend/` repo to use as the concrete pattern reference (read its schema/repository/service/controller/route files first, adjusting for however that first resource actually ended up being structured — don't assume specifics not confirmed in the real files). If no resource exists yet, this is the *first* one — build it directly from the layering rules below and the entity's fields, and it becomes the reference for every scaffold call after it.

## What to generate

Given `<ResourceName>` (PascalCase, e.g. `Enrollment`) and its field list, create five files:

1. **A schema file** — request/response validation (Zod, per the project's stack) for creating (and, if the resource supports partial updates, updating) the resource, built from the given fields. This is the only place shape validation lives — see [REST APIs](../../wiki/02-rest-apis.md) on why validation happens once, at the boundary.

2. **A repository file** — the *only* file allowed to query the database for this resource (create, find-by-id, and whatever list queries the resource's natural access patterns need — ask which fields need list-by queries if it's not obvious, e.g. "list enrollments by subject"). See [Databases & Firestore](../../wiki/03-databases-and-firestore.md) for why this boundary exists.

3. **A service file** — wraps the repository with real business logic (timestamps, computed fields, cross-resource checks). Keep it as thin as the reference resource unless this one genuinely needs more — don't invent validation the schema already covers.

4. **A controller file** — parses the request against the schema, calls the service, shapes the HTTP response (status code + body, per [REST APIs](../../wiki/02-rest-apis.md)). No business logic here — an `if` belongs in the service, not here.

5. **A routes file** — one route per controller method, gated with authentication + the appropriate role check (see [Auth & roles](../../wiki/04-auth-and-roles.md)) — check with the requesting dev which roles should reach each endpoint if it isn't already decided; don't guess.

Then mount the new router alongside the other resources' routers.

## The teaching step (required, not optional)

After generating the files, walk through what got created in plain terms before moving on: which layer does what, why the repository is the only one touching the database, and where the dev should go add the actual logic. If this is the dev's first time using this skill, ask whether they want to read through each file with an explanation before running the app, or run it first and ask questions as they come up — per `MENTOR.md`'s "ask which mode" default.

## What NOT to do

- Don't invent fields, endpoints, or role rules that weren't specified — ask rather than guessing.
- Don't add tests, docs, or abstractions beyond the five files + mounting — this skill is mechanical scaffolding, not a full feature implementation.
- Don't touch database security rules unless the resource genuinely needs a new client-direct read pattern (rare — see the one documented exception in [Async jobs & queues](../../wiki/06-async-jobs-and-queues.md); most resources are API-only).
