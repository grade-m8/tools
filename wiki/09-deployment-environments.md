# Deployment & environments

## Deploying: making it reachable

Everything described so far can run entirely on a laptop. **Deploying** means publishing a version of the app onto infrastructure that's actually reachable by real users over the internet, running continuously (not just while your laptop happens to be on). The frontend and backend typically deploy to different kinds of hosting, since they're different kinds of programs — a static/interactive site (frontend) versus a server that runs code on demand (backend).

## Why more than one environment

Deploying a change straight to "the version real users are using" the moment it's written is risky — bugs reach real people, real data can get corrupted, and there's no safe place to try something first. The standard fix is to run **separate, isolated copies** of the whole system:

- **Development (dev)** — an environment used for testing changes before they're trusted, with its own database, its own everything, safe to break.
- **Production (prod)** — the real environment real users depend on, changed deliberately and carefully.

These aren't just separate deployments of the same code — they're separate *instances* of every stateful piece too (separate database, separate auth user pool), so that testing something in dev genuinely cannot affect a real user's data in prod. Grade-M8 uses two separate Firebase projects for exactly this reason — "project" here is Firebase's unit of isolation, each with its own database, its own deployed functions, its own everything.

## Config differs per environment, code doesn't

The same code runs in both environments — what differs is configuration: which database it connects to, which URLs it calls, which secrets it uses. This is typically handled through environment variables (values injected at runtime/deploy-time rather than hardcoded), so the exact same built code can run correctly in dev or prod depending on what it's told at startup, rather than needing separate code branches for "if dev do X, if prod do Y."

## Secrets

Some configuration (API keys, shared secrets used to authenticate between services) must never end up in source code or version control — anyone with read access to the repository would then have it, including in the project's full history even if later removed. Cloud platforms provide dedicated **secret management** for this: values stored securely outside the codebase, injected into the running program at deploy time, readable only by the deployed service itself, not by anyone browsing the repo.

## What changes when you go from local to deployed

Locally, you were talking to emulators (see [Docker & local dev](./05-docker-and-local-dev.md)) — fast, free, and disposable. Deployed, you're talking to the real cloud services, which involves real (if often small-scale) cost, real persistence, and real consequences for mistakes. The practice of testing thoroughly in dev before touching prod exists specifically because "real consequences" is no longer hypothetical once you deploy.

Next: [Grade-M8 architecture](./10-grade-m8-architecture.md) — how all of the above concepts combine into this specific product.
