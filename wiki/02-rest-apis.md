# REST APIs

## Resources, not actions

A **REST** API is organized around **resources** — nouns, not verbs. Grade-M8 has resources like subjects, exams, submissions. Instead of an endpoint called `createExam`, REST uses the URL to name the resource (`/exams`) and the **HTTP verb** to say what you're doing to it:

| Verb | Meaning | Example |
|---|---|---|
| `GET` | read | `GET /exams` — list exams |
| `POST` | create | `POST /exams` — create a new exam |
| `PATCH` | partial update | `PATCH /exams/:id` — change some fields |
| `PUT` | full replace | `PUT /exams/:id/questions` — replace the whole question set at once |
| `DELETE` | remove | (Grade-M8 deliberately doesn't use this one — see below) |

The same URL means different things depending on the verb: `GET /exams/123` reads exam 123, `PATCH /exams/123` edits it. This consistency is the entire point of REST — once you know the convention, you can guess most of an API's shape without reading docs.

## Why no DELETE?

Deleting a row in a spreadsheet is easy to undo — deleting a graded exam that students have already taken is not something you want a bug to do silently and permanently. A common pattern (and the one this project uses) is **soft-delete**: instead of removing the record, you flip a field like `active: false` or `status: 'closed'`. The data stays in the database, queries filter it out by default, and nothing is unrecoverable by accident.

## The request body and response body

For `POST`/`PATCH`/`PUT`, the client sends data in the request's **body**, formatted as **JSON** — text that looks like a JavaScript object: `{"title": "Midterm", "durationMinutes": 60}`. The server reads that, validates it, does the work, and sends back a JSON body too — either the resulting resource, or an error.

## Status codes: the outcome, at a glance

Before even reading the response body, the **status code** tells you the category of outcome:

- **2xx** — it worked (`200 OK`, `201 Created`).
- **4xx** — the client did something wrong (`400` bad input, `401` not logged in, `403` logged in but not allowed, `404` doesn't exist).
- **5xx** — the server broke (`500` — a bug, not the client's fault).

A well-behaved API is consistent about this: every error, regardless of what caused it, comes back with an appropriate status code and a predictable error shape (a message explaining what went wrong), rather than the client having to guess by parsing text.

## Validation: don't trust the body

Anything arriving in a request body came from outside your program — even if it's "just the frontend you wrote," someone can call your API directly with any payload they want (browser dev tools, or a tool like `curl`, make this trivial). Every endpoint that accepts a body should **validate its shape** before doing anything with it — check the right fields are present, the right types, reasonable values — and reject it with a `400` if not. This validation happens once, at the boundary where the request enters the server, not scattered deeper in the code assuming "it's probably fine by now."

## Auth on every request

Almost every endpoint requires proving who's asking (see [Auth & roles](./04-auth-and-roles.md)) before doing anything — the client attaches a token to the request, the server checks it's valid before even looking at the body, and separately checks whether *this particular user* is allowed to do *this particular thing* (a student calling the "create exam" endpoint should get a `403`, not have the server attempt it and fail some other way).

Next: [Databases & Firestore](./03-databases-and-firestore.md) — where the data an API reads/writes actually lives.
