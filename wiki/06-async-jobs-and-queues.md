# Async jobs & queues

## Why not just do it inline?

The simplest possible design for AI grading would be: student submits, the server calls the AI model right there in the same request, waits for the answer, writes the grade, then responds. This is **synchronous** — the request blocks until the whole chain finishes.

This breaks down for a few concrete reasons:

- An exam might have many questions; grading all of them means many slow AI calls back-to-back, and HTTP requests have realistic timeout limits — a student's browser (and various infrastructure in between) will give up waiting long before grading finishes.
- The AI model here runs on a single, remotely-hosted machine — it can't usefully serve many simultaneous "please wait right now" requests at once. If thirty students submit within the same minute, thirty synchronous requests would either queue up invisibly (everyone's browser hangs) or overwhelm the machine.
- If the AI call fails partway (the model's offline, the connection drops), a synchronous design has no natural place to retry — the request already failed and the student is staring at an error.

## The async alternative: return fast, work happens later

Instead, submitting an exam does the minimum needed to acknowledge the submission and immediately hands off the actual grading work to a **queue**, then responds to the student right away ("submitted!") without waiting for grading to finish at all. A separate background process picks work off that queue over time and does the slow part.

This is what **asynchronous** means here: the action that kicks off the work and the work itself are decoupled in time. The student doesn't wait for grading; they find out it's done later, through a different mechanism (a live status update, or checking back).

## One task per unit of work

Rather than one giant "grade this whole exam" job, Grade-M8 enqueues **one job per answer** — each question's response is graded independently. This means partial progress is visible (three of five questions graded, two still pending) rather than all-or-nothing, and it naturally limits how much work happens at once (the queue can be configured to only let a handful of jobs run concurrently, matching what the single remote AI machine can actually handle).

## Retries and dead-letters

Background work fails sometimes — a network blip, the remote AI machine being temporarily offline. A queue system typically retries a failed job automatically, with increasing delay between attempts (backoff), rather than giving up on the first failure or hammering the failing service repeatedly. But retrying forever isn't right either — after some number of attempts, a job is marked as a **dead letter**: permanently failed, not retried further, and surfaced somewhere a human can see and act on it (in Grade-M8, this becomes a visible "AI unavailable" state with a manual retry option for the teacher).

## How the student/teacher finds out work finished

If the client isn't waiting on the original request anymore, how does the UI update once grading actually completes? Grade-M8 uses a **live update** mechanism (Firestore's realtime listening feature) for this one specific case — the frontend subscribes directly to the submission's status field and gets pushed an update the instant the backend changes it, without needing to repeatedly ask "is it done yet?" This is the one deliberate exception to "frontend never touches the database directly" mentioned in [Databases & Firestore](./03-databases-and-firestore.md) — narrow in scope, and protected by database security rules rather than the backend API, since there's no backend request involved in receiving the update at all.

Next: [Frontend basics](./07-frontend-basics.md) — how the screen the student/teacher actually sees is built.
