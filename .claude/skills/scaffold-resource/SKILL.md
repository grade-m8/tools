---
name: scaffold-resource
description: Generate a new REST resource vertical slice (types/DTOs, repository, service, one controller per endpoint, routes) for the Grade-M8 backend, following the layered architecture in MENTOR.md and this repo's established resource pattern. Ends with a plain-language walkthrough of what was generated, for junior devs new to backend structure.
---

# Scaffold a backend resource

Use this skill when adding a new Firestore-backed REST resource to the rebuild's `backend/` repo (e.g. "exams," "enrollments"). It generates the mechanical wiring for one resource, following `../../../CONVENTIONS.md` (→ Backend) and the layering described in `../../../wiki/10-grade-m8-architecture.md` — you (or the requesting dev) still fill in real business logic and choose correct role gating.

## Usage

```
/scaffold-resource <ResourceName> <field:type>[,<field:type>...]
```

Example: `/scaffold-resource Enrollment subjectId:string,studentId:string,status:'active'|'dropped'`

## Before generating: confirm the pattern exists to copy from

This skill assumes at least one resource already exists in the target `backend/` repo to use as the concrete pattern reference (read its types/repository/service/controller/route files first, adjusting for however that first resource actually ended up being structured — don't assume specifics not confirmed in the real files). If no resource exists yet, this is the *first* one — build it directly from the layering rules below and the entity's fields, and it becomes the reference for every scaffold call after it.

## What to generate

Given `<ResourceName>` (PascalCase, e.g. `Enrollment`) and its field list, create these files under `functions/src/`, copying the shape of the existing `exam` domain:

1. **Types** — `types/<domain>/<entity>.ts` (the entity, dates as Firestore `Timestamp`) and the DTOs (`Create<Entity>Dto`, and `Update<Entity>Dto` if the resource supports partial updates), derived with `Omit`/`Partial` so server-owned fields (ids, owner ids, `status`, `createdAt`) can't come from the client. Plus the repository interface in `types/<domain>/<domain>Repo.ts`.

2. **A repository** — `repository/<domain>/<entity>DataConverter.ts` and `repository/<domain>/firestore<Domain>Repo.ts`, the *only* files allowed to query the database for this resource (create, find-by-id, and whatever list queries the resource's natural access patterns need — ask which fields need list-by queries if it's not obvious, e.g. "list enrollments by subject"). Partial updates use `.set(patch, { merge: true })` without the converter. See [Databases & Firestore](../../../wiki/03-databases-and-firestore.md) for why this boundary exists.

3. **A service** — `service/<domain>/<domain>Service.ts`, wrapping the repository with real business logic (timestamps, computed fields, ownership and cross-resource checks). It returns `T | AppError` instead of throwing; add any new `AppError` members to `types/error/error.ts` and map them in `controller/errors/errorMapping.ts`. Register repo and service in `di/container.ts`.

4. **Controllers** — one file per endpoint, `controller/<domain>/<action>.ts`, named by the action (`createEnrollment`). Each checks `req.user`, validates input by hand — this is the only place validation lives (see [REST APIs](../../../wiki/02-rest-apis.md) on why validation happens once, at the boundary): a local `hasMissingFields` (`?.trim()` for strings, `== null` for numbers) and, for updates, an `ALLOWED_UPDATE_FIELDS` whitelist. Then it calls the service and maps the result (`isAppError` → `mapAndReturnDomainError`, else `res.status(...).json(...)`). No business logic here — an `if` about the domain belongs in the service. There is no Zod in this project; don't add it.

5. **A routes file** — `route/<domain>Routes.ts`: `router.use(authMiddleware)`, one route per controller gated with `requireRoles([...])` (see [Auth & roles](../../../wiki/04-auth-and-roles.md)) — check with the requesting dev which roles should reach each endpoint if it isn't already decided; don't guess. Admin passes automatically. Wrap it in an Express app exported with `onRequest`, copying an existing routes file.

Then re-export the new function from `index.ts`.

## The teaching step (required, not optional)

After generating the files, walk through what got created in plain terms before moving on: which layer does what, why the repository is the only one touching the database, and where the dev should go add the actual logic. If this is the dev's first time using this skill, ask whether they want to read through each file with an explanation before running the app, or run it first and ask questions as they come up — per `MENTOR.md`'s "ask which mode" default.

## What NOT to do

- Don't invent fields, endpoints, or role rules that weren't specified — ask rather than guessing.
- Don't add tests, docs, or abstractions beyond the files above + mounting — this skill is mechanical scaffolding, not a full feature implementation.
- Don't touch database security rules unless the resource genuinely needs a new client-direct read pattern (rare — see the one documented exception in [Async jobs & queues](../../../wiki/06-async-jobs-and-queues.md); most resources are API-only).
