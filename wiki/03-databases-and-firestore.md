# Databases & Firestore

## Why not just keep data in memory?

A running program's variables disappear the moment it stops (a crash, a redeploy, a restart). A **database** is a separate system whose entire job is to keep data safe and queryable across restarts, across multiple copies of your server running at once, and across years. Anything that needs to outlive a single request — a user account, an exam, a submitted answer — has to end up in a database, not just a variable.

## Tables vs. documents

The database style most people picture first is a **relational** database (rows and columns, like a spreadsheet, with strict fixed columns per table, e.g. traditional SQL). Firestore is a different style: a **NoSQL document database**.

- A **collection** is roughly what a table is in the spreadsheet model — a named group of similar things. `subjects`, `exams`, `submissions` are collections in Grade-M8.
- A **document** is one record inside a collection — roughly a "row," but instead of fixed columns, a document is a flexible, nested JSON-like object. Different documents in the same collection don't strictly need identical fields (though in practice you keep them consistent by convention, since your code expects a shape).
- Documents can have **subcollections** nested inside them — a document isn't just a flat bag of fields, it can contain further collections of its own child documents.

## Querying

You don't get arbitrary "join any field to any other field" queries the way you would with SQL. You query a collection by filtering on specific fields, and you generally need to know your query patterns ahead of time — Firestore performs best (and sometimes only works at all) when the right **indexes** exist for the filters/sorts you're using. This is a real design constraint: how you're going to *read* the data shapes how you should *store* it, more so than in a relational database.

## Denormalization: on purpose, not by accident

In a relational database, you'd typically store an ID and "join" to look up related data on demand. In Firestore, it's common (and used throughout Grade-M8) to **denormalize** — copy a piece of related data directly onto a document instead of always looking it up separately. For example, a submission document stores `teacherId` directly, even though that's technically derivable by following `examId → exam → teacherId`. Why: it makes a very common read ("show me all submissions for this teacher") a single simple query instead of a lookup-then-lookup-then-lookup chain, and it makes security rules simpler to write. The tradeoff: if the source of truth changes, every denormalized copy needs updating too, or the copies drift out of sync — so you denormalize deliberately, for fields you know won't change often, not everywhere by default.

## Top-level collections vs. subcollections

Grade-M8 mostly uses **top-level collections with a foreign-key-style field** (an exam document has a `subjectId` field pointing at its subject, rather than living nested inside the subject) — this keeps most things queryable independently. **Subcollections** are reserved for data that's always read and written together with its parent as one unit and never needs to be queried independently — an exam's rubric criteria and questions, for instance, are always edited as a full set alongside their exam, so they live nested under it.

## Transactions: all-or-nothing writes

Sometimes a single logical action needs to update more than one document at once, and it matters that either *both* updates happen or *neither* does — e.g. recording a graded answer and rolling its score into the parent submission's running total. If the program crashed between the two writes, you'd end up with a submission whose total doesn't match its answers, permanently. A **transaction** groups multiple reads/writes so the database guarantees they either all succeed together or all fail together, with no in-between state ever visible to anyone else reading the data.

## Only the server touches the database (mostly)

In Grade-M8, the frontend never talks to Firestore directly to read or write app data — it goes through the backend's REST API, which is the only thing holding real database credentials (see [How the web works](./01-how-the-web-works.md)). There's one narrow, deliberate exception for a live status update, covered in [Async jobs & queues](./06-async-jobs-and-queues.md), secured by database-level security rules rather than the backend — that's the exception precisely because it's the *only* case where the client is trusted to read directly.

Next: [Auth & roles](./04-auth-and-roles.md) — how the server knows who's making a request in the first place.
