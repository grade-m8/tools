import type { FutureAutopsy, CausalityStep, EarlyWarningSignal, PreventativeAction } from '../types/schemas.ts';

export class FutureAutopsySimulator {
  /**
   * Simulates a hypothetical future engineering premortem.
   */
  public simulateAutopsy(initiativeName: string, contextDescription: string): FutureAutopsy {
    const lower = `${initiativeName} ${contextDescription}`.toLowerCase();

    // Set simulated incident date 45 days in future
    const futureDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let imaginedFailure = `Catastrophic Outage during Finals Week: System stalls while processing 500 concurrent student exam submissions for ${initiativeName}.`;
    let severityLevel: 'Catastrophic' | 'Severe' | 'Moderate' = 'Catastrophic';

    const chainOfCausality: CausalityStep[] = [
      {
        step: 1,
        event: 'Sprint commitment assumed external LLM and Cloud Tasks would process grading within standard 3-second SLA without load testing.',
        contributingFactor: 'Optimistic planning bias; lack of load-test harness for asynchronous queues.'
      },
      {
        step: 2,
        event: 'PR merged without idempotency keys on the Cloud Tasks endpoint; retry policy left at default exponential backoff without circuit breaker.',
        contributingFactor: 'Review focused only on happy-path business logic; concurrency edge cases overlooked.'
      },
      {
        step: 3,
        event: 'During peak exam submission hour, external API latency jumped from 2s to 12s, causing queue workers to back up and trigger automatic Cloud Tasks retries.',
        contributingFactor: 'External provider rate limiting (HTTP 429) coupled with unthrottled concurrent dispatches.'
      },
      {
        step: 4,
        event: 'Retried tasks initiated duplicate grading passes on the same student answers, creating race conditions on the evaluation documents.',
        contributingFactor: 'Absence of Firestore document locking or atomic precondition check on submission status.'
      },
      {
        step: 5,
        event: 'Professors attempting to review grades observed erratic fluctuating scores, blank answers, and stalled spinners; final exam grades delayed by 48 hours.',
        contributingFactor: 'Silent clobbering of teacher edits and lack of dead-letter queue alerting.'
      }
    ];

    if (lower.includes('auth') || lower.includes('security') || lower.includes('claim')) {
      imaginedFailure = `Security Incident: Unauthorized exam answer leaks via unauthenticated REST endpoint in ${initiativeName}.`;
      chainOfCausality[1] = {
        step: 2,
        event: 'Frontend route was protected with role guard, but backend endpoint omitted requireRole("professor") middleware.',
        contributingFactor: 'False sense of security created by UI-only permission checks (wiki/04-auth-and-roles.md).'
      };
    } else if (lower.includes('migration') || lower.includes('schema') || lower.includes('database')) {
      imaginedFailure = `Data Corruption Incident: Destructive Firestore schema migration renders in-flight exams ungradable in ${initiativeName}.`;
      chainOfCausality[1] = {
        step: 2,
        event: 'Field renamed in database model without additive backward-compatibility fallback for existing documents.',
        contributingFactor: 'Assumption that all users refresh their web browsers simultaneously upon deploy.'
      };
    }

    const brokenAssumptions: string[] = [
      'Assumption ASM-001 ("Cloud Tasks delivery is at-least-once, requiring all grading handlers to be strictly idempotent") was violated in the queue receiver.',
      'Assumption ASM-002 ("AI analysisItems are immutable records superseded only by teacher edits") was broken by asynchronous retry overwrites.',
      'Implicit assumption that external AI service would maintain <5s latency under peak student load proved false.'
    ];

    const earlyWarningSignals: EarlyWarningSignal[] = [
      {
        phase: 'PR Review / Code Stage',
        signal: 'Absence of transaction wrappers or idempotency keys in grading service code.',
        telemetrySource: 'Static analysis & Devils Advocate Mode 1 PR audit.'
      },
      {
        phase: 'Staging Integration',
        signal: 'Simulated 5 concurrent submissions to the same exam produce non-deterministic score overwrites in Firestore emulator.',
        telemetrySource: 'Automated concurrency test suite.'
      },
      {
        phase: 'Pre-Release Telemetry',
        signal: 'Cloud Tasks queue depth increases steadily while processing rate drops to zero during simulated latency injection.',
        telemetrySource: 'GCP Cloud Monitoring queue metrics.'
      }
    ];

    const preventativeActions: PreventativeAction[] = [
      {
        priority: 'P0',
        action: 'Wrap all evaluation mutations in Firestore runTransaction() and enforce unique idempotency tokens on task payloads.',
        owner: 'backend-dev'
      },
      {
        priority: 'P0',
        action: 'Configure Cloud Tasks queue with maxConcurrentDispatches: 5 and wire up a Dead Letter Queue (DLQ) with Sentry alert.',
        owner: 'firebase-expert'
      },
      {
        priority: 'P1',
        action: 'Author automated Jest test reproducing rapid duplicate task delivery to verify idempotent response.',
        owner: 'qa-engineer'
      },
      {
        priority: 'P1',
        action: 'Implement UI toast and status banner when async grading exceeds 10 seconds to manage user expectations.',
        owner: 'frontend-dev'
      }
    ];

    return {
      initiativeName,
      simulatedFailureDate: futureDate,
      imaginedFailure,
      severityLevel,
      chainOfCausality,
      brokenAssumptions,
      earlyWarningSignals,
      preventativeActions,
      explicitHypotheticalDisclaimer:
        'IMPORTANT: This scenario is an intentional, evidence-informed PRE-MORTEM SIMULATION. It is explicitly hypothetical and designed to expose architectural blind spots before code is committed or deployed. It does not represent an actual past outage.'
    };
  }
}
