# Auth & roles

## Two different questions

"Auth" actually bundles two separate questions that are easy to conflate:

- **Authentication**: *who are you?* — proving identity, usually by logging in with a password (or Google/etc).
- **Authorization**: *given who you are, what are you allowed to do?* — e.g. "you're logged in as a student, so you can't create an exam."

Grade-M8 uses Firebase for authentication and a **role** system for authorization.

## Tokens: proving identity on every request

Logging in happens once. But the server is stateless between requests — it doesn't "remember" that you logged in five minutes ago the way a human would remember a conversation. So instead, after login, the client is handed a **token**: a signed piece of data that says, in effect, "this is user X, and this was issued by a source the server trusts." The client attaches this token to every subsequent request (as a header). The server verifies the signature — cheaply, without needing to ask the auth provider "is this still valid?" on every single request — and now knows who's asking.

Tokens expire and get refreshed periodically, which is invisible to the user in normal operation but explains why "being logged in" isn't a single permanent state — it's a token that keeps quietly renewing itself.

## Roles: where "what can you do" lives

A **role** (`teacher`, `student`, `admin` in Grade-M8) is a label attached to a user that authorization decisions are based on. The important design question is: *where does the role actually live*, because that determines how trustworthy it is.

- Storing role as a plain field in the database, read by the frontend, is **not sufficient on its own** for security — the frontend is running on the user's own machine; a motivated user can inspect and change what their own client-side code does or believes.
- The trustworthy source is the **token itself** — Firebase supports attaching **custom claims** (arbitrary extra data, like a role) directly to a user's auth token, signed by Firebase. Because the token is cryptographically signed, the server can trust the role claim inside it without a separate database lookup, and the user can't forge it themselves.

A subtlety worth knowing ahead of time: if a user's role changes (e.g. an admin promotes them to teacher), their *existing* token still has the old role baked in until they get a fresh one — the client has to explicitly force a token refresh after a role change for the new role to take effect. If this isn't done, "I just made them a teacher and it's not working" is almost always this.

## Two layers of enforcement, one load-bearing

Grade-M8 checks authorization in two places:

1. **The backend**, on every relevant endpoint — verify the token, then check the role is allowed to do this specific thing. This is the layer that actually matters; it's where real logic and database access happens.
2. **Database-level security rules**, which matter *only* for the one case where the frontend reads data directly from the database without going through the backend (see [Async jobs & queues](./06-async-jobs-and-queues.md)) — everywhere else, requests go through the backend API, which bypasses these rules entirely (the backend uses admin-level database access, since it's a trusted server, not an end-user client). Don't rely on database rules as your only line of defense for anything reachable through the API — they're a backstop for the one client-direct-read case, not the primary enforcement mechanism.

## Bootstrapping: the chicken-and-egg problem

If "only an admin can grant the admin role" is a rule enforced by the API, how does the *first* admin ever get created? Something has to set that first role outside the normal request flow — typically a one-off script run manually with elevated credentials, used exactly once (or rarely) to seed the first admin, after which everything else goes through the normal role-granting endpoint.

Next: [Docker & local dev](./05-docker-and-local-dev.md) — how you run a backend, database, and auth system on your own laptop without touching anything real.
