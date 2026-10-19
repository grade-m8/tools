export interface FailureScenarioConfig {
  contextCategory:
    | 'concurrency'
    | 'retries_and_duplicates'
    | 'distributed_partial_failure'
    | 'network_timeout'
    | 'stale_data'
    | 'invalid_state_transition'
    | 'auth_boundary'
    | 'schema_migration'
    | 'timezone_and_dates'
    | 'configuration_drift';
  trigger: string;
  underlyingMechanism: string;
  concreteImpact: string;
  whyRelevant: string;
}

export class FailureScenarioGenerator {
  /**
   * Generates tailored failure scenarios based on detected keywords, touched files, or feature descriptions.
   */
  public generateScenarios(contextText: string, touchedFiles: string[] = []): FailureScenarioConfig[] {
    const scenarios: FailureScenarioConfig[] = [];
    const lower = contextText.toLowerCase();

    // 1. Concurrency & Race Conditions
    if (
      lower.includes('grad') ||
      lower.includes('submit') ||
      lower.includes('evaluat') ||
      lower.includes('counter') ||
      lower.includes('enroll') ||
      touchedFiles.some(f => f.includes('grading') || f.includes('submission'))
    ) {
      scenarios.push({
        contextCategory: 'concurrency',
        trigger: 'Two concurrent requests arrive within 15 milliseconds (e.g., student double-clicking submit or retry loop firing simultaneously)',
        underlyingMechanism: 'Non-transactional Firestore read-then-write sequence lacks optimistic locking or mutex token',
        concreteImpact: 'First mutation is silently clobbered by the second; student score or submission status corrupts without error logs',
        whyRelevant: 'Grade-M8 uses Firestore where document writes outside runTransaction() exhibit last-write-wins clobbering under race conditions (wiki/03-databases-and-firestore.md)'
      });
    }

    // 2. Retries & Duplicate Requests
    if (
      lower.includes('task') ||
      lower.includes('queue') ||
      lower.includes('webhook') ||
      lower.includes('cloud task') ||
      lower.includes('retry')
    ) {
      scenarios.push({
        contextCategory: 'retries_and_duplicates',
        trigger: 'Cloud Tasks worker takes 61 seconds on a 60s HTTP timeout and Cloud Tasks triggers automatic redelivery',
        underlyingMechanism: 'Grading endpoint lacks idempotency token check at entry; begins duplicate LLM inference and duplicate DB appends',
        concreteImpact: 'Duplicate charges on LMStudio/Gemini tokens, redundant evaluations spawned, and potential deadlock on student evaluation document',
        whyRelevant: 'Cloud Tasks guarantees at-least-once delivery; network blips or long LLM inferences routinely cause retried tasks (wiki/10-grade-m8-architecture.md)'
      });
    }

    // 3. Stale Data & Mutating Historical Records
    if (
      lower.includes('analysis') ||
      lower.includes('teacher') ||
      lower.includes('override') ||
      lower.includes('feedback') ||
      touchedFiles.some(f => f.includes('analysis') || f.includes('teacher'))
    ) {
      scenarios.push({
        contextCategory: 'stale_data',
        trigger: 'Teacher edits feedback while an asynchronous AI grading retry job is still completing in background',
        underlyingMechanism: 'Background worker overwrites the whole analysisItems array instead of appending a new superseded record',
        concreteImpact: 'Teacher manual grades and pedagogical remarks are completely erased by the belated AI worker output',
        whyRelevant: 'Grade-M8 architecture explicitly mandates that analysisItems must never be overwritten, only superseded by teacher edits (wiki/10-grade-m8-architecture.md)'
      });
    }

    // 4. Invalid State Transitions
    if (
      lower.includes('status') ||
      lower.includes('draft') ||
      lower.includes('published') ||
      lower.includes('submitted') ||
      lower.includes('state')
    ) {
      scenarios.push({
        contextCategory: 'invalid_state_transition',
        trigger: 'Client fires "grade" or "publish" action while exam submission status is still "in_progress" or "draft"',
        underlyingMechanism: 'Service assumes front-end only enables button in valid states and skips state-machine precondition guard',
        concreteImpact: 'Partial exam with empty questions is permanently sealed and marked completed with 0/100 score',
        whyRelevant: 'Direct API invocation or stale browser tabs can post actions out-of-order; backend state machine must reject invalid transitions'
      });
    }

    // 5. Timezone & Date Boundaries
    if (
      lower.includes('deadline') ||
      lower.includes('due') ||
      lower.includes('date') ||
      lower.includes('midnight') ||
      lower.includes('expires') ||
      lower.includes('cutoff') ||
      lower.includes('23:59')
    ) {
      scenarios.push({
        contextCategory: 'timezone_and_dates',
        trigger: 'Student submits at 23:59 local time (UTC-3), but backend server evaluates Date.now() against UTC midnight deadline',
        underlyingMechanism: 'Timestamp comparison uses raw ISO strings or system server timezone without normalizing student assignment timezone',
        concreteImpact: 'Legitimate on-time student submissions are marked late and penalized or rejected entirely',
        whyRelevant: 'Grade-M8 students and professors operate across varying local school timezones while Cloud Functions execute in UTC'
      });
    }

    // 6. Schema Migration & Backward Compatibility
    if (
      lower.includes('migration') ||
      lower.includes('schema') ||
      lower.includes('rename') ||
      lower.includes('column') ||
      lower.includes('field') ||
      touchedFiles.some(f => f.includes('firestore.indexes') || f.includes('schema'))
    ) {
      scenarios.push({
        contextCategory: 'schema_migration',
        trigger: 'Backend deploys with renamed field "submissionDate" -> "submittedAt", while old frontend sessions remain cached in browser',
        underlyingMechanism: 'New backend controller expects new key, rejecting old payload or writing documents missing backward-compatible aliases',
        concreteImpact: 'Users on existing tabs receive 400 Bad Request or null pointer crashes during active exam sessions',
        whyRelevant: 'Single-page web applications (React) stay open for days on student laptops; backend contracts must support rolling transitions'
      });
    }

    // Default general-systems scenario if none matched
    if (scenarios.length === 0) {
      scenarios.push({
        contextCategory: 'distributed_partial_failure',
        trigger: 'External LLM service (LMStudio or API) returns 503 or socket hangup midway through streaming evaluation',
        underlyingMechanism: 'Uncaught Promise rejection inside asynchronous loop without fallback status update to "failed_needs_retry"',
        concreteImpact: 'Student exam hangs permanently in "grading" spinner state with no recourse and no alert generated for professors',
        whyRelevant: 'Local and cloud AI backends have high variance in availability and latency; grading workers must handle unexpected socket termination'
      });
    }

    return scenarios;
  }
}
