# Grade-M8 architecture

This page ties every earlier concept to this specific product. It describes *what* the system needs to do and *why* it's shaped the way it is — not literal code, since you'll be writing that yourselves.

## The product, in one paragraph

A teacher creates a subject and, within it, exams made of free-text questions and a grading rubric (a set of weighted criteria describing what a good answer looks like). Students enroll in subjects, take exams, and submit answers. Once submitted, each answer is graded automatically by an AI model against the rubric — producing a score and a written justification per criterion — and the teacher then reviews, and can override, any of the AI's grading before it's considered final. Nothing the AI decides is treated as the final word without a human able to see and change it.

## Three separate repos, one shared idea, no shared code

The system is split into three independent projects: a **design system** (a Storybook of components and screens derived from Figma — reference material only, never imported by the running app), a **frontend** (the actual app users interact with), and a **backend** (the API and database). None of the three import from each other as code dependencies. This is a deliberate tradeoff: full independence between repos (no shared build tooling, no version-lockstep releases) at the cost of some duplicated effort — matching entity types and design tokens have to be manually kept in sync by hand whenever one side changes, rather than automatically. If that duplication ever becomes a recurring source of bugs, it's worth revisiting with the project owner rather than silently working around it.

## The entities (what lives in the database)

Roughly, in the order a teacher would create them:

- **Users** — everyone who logs in, each with a role (teacher, student, or admin) that determines what they can do (see [Auth & roles](./04-auth-and-roles.md)).
- **Subjects** — a course a teacher owns; students enroll into it.
- **Exams**, belonging to a subject — each exam has a set of **questions** (the actual prompts) and a set of **rubric criteria** (what's being graded for, and how heavily each criterion counts).
- **Submissions** — one per student per exam attempt, tracking its own lifecycle (started, submitted, being graded, reviewed, or errored) and rolling up a running score as its individual answers get graded.
- **Answers**, belonging to a submission, one per question — each tracks its own grading status independently, since grading happens per-answer, not all at once (see [Async jobs & queues](./06-async-jobs-and-queues.md)).
- **Analysis items**, belonging to an answer — the actual per-criterion scoring detail (points awarded/deducted, and why). Crucially, an AI-produced analysis item is never edited or deleted when a teacher disagrees — the teacher's correction is stored as a *new* item that supersedes it, so the original AI output is always still there for auditing later. Nothing about "what the AI actually said" is ever lost, even after a human overrides it.

Most of these are stored as independent top-level records referencing each other by ID (denormalized, per [Databases & Firestore](./03-databases-and-firestore.md)) rather than deeply nested — the exception is a small number of "always edited as a full set with their parent" cases, like an exam's questions/criteria, or a submission's answers, which are naturally nested.

## The grading pipeline end to end

1. A student finishes an exam and submits. The submission is validated (all questions answered) and flips from "in progress" to "submitted," then immediately to "grading."
2. One background job is enqueued **per answer**, not one job for the whole exam — this bounds how much work happens concurrently against a single, remotely-hosted AI model, and lets progress be visible answer-by-answer rather than all-or-nothing.
3. Each job builds a prompt from that question, its ideal answer, the relevant rubric criteria, and the student's actual response, and sends it to the AI model running on a remote, self-hosted machine reachable over a secure tunnel — not a cloud AI vendor.
4. On success, the AI's response is parsed into scored analysis items, the answer is marked graded, and — inside a database transaction — the parent submission's running total and completed-count are updated together, atomically, with the answer write (see the transactions section of [Databases & Firestore](./03-databases-and-firestore.md)).
5. On failure, the background job system's own retry mechanism handles retrying with backoff; after enough failed attempts, the answer is marked permanently failed and surfaced to the teacher as a distinct, visible "AI unavailable" state with a manual retry action — never a silent, invisible failure.
6. The student/teacher's screen learns about grading progress through a live update mechanism, not by repeatedly asking — the one deliberate exception to "the frontend only ever talks to the backend API" described in [Databases & Firestore](./03-databases-and-firestore.md) and [Async jobs & queues](./06-async-jobs-and-queues.md).
7. Once every answer is graded (or has failed out), the submission becomes "reviewed" (or "error," if something dead-lettered) and the teacher can inspect it, agreeing with or correcting any of the AI's scoring.

## Why the AI model is reached over a tunnel, not a cloud AI API

The model runs on a real physical machine (not a cloud AI vendor's infrastructure), so the backend needs a way to reach a service on someone's home/personal network from the outside world, securely, without that network needing to expose ports directly to the internet. A tunnel is software running on that machine that opens an *outbound* connection to a relay service, which then proxies inbound requests down that connection — the practical effect is a stable, real URL the backend can call, without ever needing inbound firewall/router changes on the model's own network. Because that URL is otherwise reachable by anyone who discovers it, every request also carries a shared secret the model-side service checks before doing any work, so the tunnel alone isn't the only thing standing between the model and the open internet.

## Why the API layer is structured the way it's described in the working agreement

The backend's layering (routes → controllers → services → repositories, only repositories touching the database) exists so that each concern is isolated: routes handle only "which URL/verb maps to which handler," controllers handle only "parse the request, call the right logic, shape the response," services hold the actual business rules, and repositories are the only code allowed to actually query the database. The practical payoff: if the database technology or a query's shape ever needs to change, that change is contained to one layer, and you always know where to look for "the real logic" versus "the database plumbing" versus "the HTTP plumbing" — a genuinely useful habit even outside this specific project.
