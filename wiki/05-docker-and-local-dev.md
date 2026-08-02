# Docker & local dev

## The problem: "it works on my machine"

A backend needs specific versions of a runtime, specific libraries, and often other services (a database, an auth system) running alongside it. Getting all of that installed identically on two different developers' laptops — and matching what actually runs in production — is a classic source of bugs that only happen for one person. **Docker** solves this by packaging an app and everything it needs into a **container**: a lightweight, isolated bundle that runs the same way regardless of what's installed on the host machine.

A useful mental model: a container is like a shipping container for software — the contents don't care what ship (machine) they're loaded onto, because the container itself carries everything it needs.

## Emulators: pretending to be the cloud, locally

Grade-M8's backend depends on real cloud services in production — a live database, a live auth system, a task queue. You don't want every developer's day-to-day work modifying the real production database, and you don't want to need an internet connection and cloud credentials just to run the app locally. Firebase provides an **emulator suite**: local programs that behave like the real cloud services (same API surface, same rules), but run entirely on your own machine with fake, disposable data.

Docker's role here is to wrap "start the emulator suite" into a container, so running the entire local backend — API server, database emulator, auth emulator — is one command, identical for both developers, instead of each of them independently installing and configuring the Firebase tooling by hand.

## docker-compose: running more than one container together

A real backend setup is often more than one container working together. **docker-compose** is a way of describing, in one config file, what containers to run and how they connect, so `docker compose up` brings up the whole local stack in one step rather than starting each piece manually in the right order.

## What "local" actually means here

Running the backend locally in Docker means: the Express server, the Firestore emulator, and the Auth emulator all run on your laptop, and your local frontend points at them instead of the real cloud project. Nothing here touches the real dev/prod Firebase projects (see [Deployment & environments](./09-deployment-environments.md)) unless you explicitly configure it to. One thing to know upfront for Grade-M8 specifically: the AI grading step calls out to a real machine over the real internet even in local dev — that one piece isn't emulated, because there's no local stand-in for "a language model hosted on someone's PC." Everything else can be fully offline.

## Data persistence between runs

An emulator's data normally lives only in memory and vanishes when the container stops — fine for a quick test, annoying if you want to keep the exams/subjects you set up yesterday. Emulators support **exporting and importing state** to/from disk, and Docker containers can mount a **volume** (a folder on your real machine, attached to the container) so that exported data survives even when the container itself is destroyed and recreated. Stopping a container gracefully (rather than force-killing it) matters here — an export-on-shutdown only completes if the container is given the chance to shut down cleanly.

Next: [Async jobs & queues](./06-async-jobs-and-queues.md) — why the AI grading step can't just happen inline in an HTTP request.
