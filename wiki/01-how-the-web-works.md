# How the web works

## The core idea: two programs, one conversation

When you use Grade-M8 in a browser, two separate programs are involved:

- **The client** — the code running in your browser (the frontend). It draws the screen and reacts to clicks.
- **The server** — a program running somewhere else (the backend), usually on a machine you'll never see, that has access to the database and does the "real" work.

They are not the same program and don't share memory. The only way they interact is by sending each other messages over the internet. That's it — that's the whole model. Everything else in this wiki is detail on top of that one idea.

## Requests and responses

Every interaction is a **request/response** pair:

1. The client sends a **request**: "here's what I want" (e.g. "give me the list of exams for subject 123").
2. The server does whatever work is needed (usually: check who's asking, look something up or change something in the database).
3. The server sends back a **response**: the result, or an explanation of why it couldn't do it.

This is always initiated by the client. A server can't just decide to push something to your browser out of nowhere in this basic model (there are exceptions — Grade-M8 uses one, covered in [Async jobs & queues](./06-async-jobs-and-queues.md) — but the default is: client asks, server answers).

## HTTP: the shared language

**HTTP** is the agreed-upon format both sides use to write these requests and responses, so a browser built by one company can talk to a server built by a completely different team without either having to guess. A request has a few key parts:

- A **method/verb** — what kind of thing you're asking for (`GET` to read, `POST` to create, etc — covered in [REST APIs](./02-rest-apis.md)).
- A **URL** — which specific thing on which server.
- **Headers** — metadata about the request (who's asking, what format the body is in, etc).
- Sometimes a **body** — the actual data being sent, e.g. the details of a new exam being created.

A response mirrors that: a **status code** (did it work?), headers, and usually a body (the data you asked for, or an error explanation).

## Why this matters for Grade-M8 specifically

The frontend (React app, in your browser) never touches the database directly. It always goes: frontend → HTTP request → backend (Express server) → backend does the database work → HTTP response → frontend updates the screen. Keeping this boundary strict is why the backend can enforce rules (like "only teachers can create exams") that the frontend can't be trusted to enforce on its own — anyone can open their browser's dev tools and bypass frontend logic, but they can't bypass the server, because the server is the one holding the database credentials.

Next: [REST APIs](./02-rest-apis.md) — the specific shape Grade-M8's requests/responses follow.
