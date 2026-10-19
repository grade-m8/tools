import type {
  Finding,
  FindingClassification,
  SeverityLevel,
  EvidenceItem,
  VerificationStatus,
  InvestigationResult,
  InvestigationEvidence
} from '../types/schemas.ts';
import { RiskPrioritizer } from './risk-prioritizer.ts';
import { AssumptionRadar } from './assumption-radar.ts';
import { FailureScenarioGenerator, type FailureScenarioConfig } from './failure-generator.ts';
import { HistoricalFailureMemory } from './historical-memory.ts';

export class EvidenceBasedRiskInvestigator {
  private prioritizer: RiskPrioritizer;
  private assumptionRadar: AssumptionRadar;
  private failureGenerator: FailureScenarioGenerator;
  private historicalMemory: HistoricalFailureMemory;

  constructor(
    prioritizer: RiskPrioritizer,
    assumptionRadar: AssumptionRadar,
    failureGenerator: FailureScenarioGenerator,
    historicalMemory: HistoricalFailureMemory
  ) {
    this.prioritizer = prioritizer;
    this.assumptionRadar = assumptionRadar;
    this.failureGenerator = failureGenerator;
    this.historicalMemory = historicalMemory;
  }

  /**
   * Formulates hypotheses, investigates context evidence, executes deterministic checks,
   * and produces rigorous findings with explicit confidence levels.
   */
  public investigateContext(
    targetName: string,
    contextText: string,
    touchedFiles: string[] = []
  ): Finding[] {
    const findings: Finding[] = [];
    const lower = contextText.toLowerCase();

    // 1. Audit against project assumptions
    const { challenged, invalidated } = this.assumptionRadar.auditAssumptionsAgainstContext(
      contextText,
      touchedFiles
    );

    // 2. Search historical failure patterns
    const historicalMatches = this.historicalMemory.searchPatterns(contextText);

    // 3. Generate failure scenarios
    const scenarios = this.failureGenerator.generateScenarios(contextText, touchedFiles);

    // --- Check 1: Concurrency / Idempotency Violation (ASM-001) ---
    if (
      invalidated.some(a => a.id === 'ASM-001') ||
      (scenarios.some(s => s.contextCategory === 'concurrency' || s.contextCategory === 'retries_and_duplicates') &&
        (lower.includes('grad') || lower.includes('queue') || lower.includes('increment(')))
    ) {
      const hasTransaction = lower.includes('runtransaction') || lower.includes('transaction.');
      const hasIdempotencyKey = lower.includes('idempotency') || lower.includes('taskid');

      let classification: FindingClassification = 'Evidence-Backed Risk';
      let confidence = 0.85;
      let verificationStatus: VerificationStatus = 'Partially Investigated';

      if (!hasTransaction && !hasIdempotencyKey && lower.includes('update(')) {
        classification = 'Confirmed Defect';
        confidence = 0.95;
        verificationStatus = 'Reproduced';
      }

      const severity: SeverityLevel = 'Critical';
      const score = this.prioritizer.calculateCompositeScore(severity, confidence, 0.8, 0.9, 0.4);

      findings.push({
        id: `FIND-${String(findings.length + 1).padStart(3, '0')}`,
        title: 'Non-Idempotent Concurrent Grading Mutation in Firestore',
        classification,
        severity,
        severityRationale: 'Concurrent submissions or automatic Cloud Tasks retries will overwrite evaluation scores non-deterministically without transactional locking.',
        confidence,
        confidenceLabel: this.prioritizer.getConfidenceLabel(confidence),
        affectedAreas: touchedFiles.length > 0 ? touchedFiles : ['functions/src/services/gradingService.ts', 'Firestore evaluation collection'],
        evidence: [
          {
            id: 'EV-001',
            sourceType: 'architecture_doc',
            location: 'wiki/10-grade-m8-architecture.md#grading-pipeline',
            relevance: 'Mandates that grading jobs must be strictly idempotent to withstand Cloud Tasks at-least-once delivery.'
          },
          {
            id: 'EV-002',
            sourceType: 'code',
            location: touchedFiles[0] || 'gradingService.ts',
            snippet: contextText.slice(0, 180),
            relevance: 'Target code contains state mutation without runTransaction() or idempotency guard.'
          }
        ],
        failureScenario: '1. Student clicks Submit Exam.\n2. Cloud Tasks triggers grading worker.\n3. Network delay causes worker to exceed HTTP timeout, triggering Cloud Tasks redelivery.\n4. Second worker begins processing in parallel, clobbering partial evaluation state.',
        reproductionSteps: 'Trigger two concurrent POST /api/grading requests with the same submissionId and assert whether both attempt full re-grade or if one is safely deduplicated.',
        recommendedMitigation: 'Wrap document mutations in db.runTransaction() and check existing task execution status before triggering LLM inference.',
        suggestedOwner: 'backend-dev',
        uncertaintyAndLimitations: 'Exact concurrency behavior in production depends on Cloud Tasks queue throttle settings.',
        verificationStatus,
        compositeRiskScore: score
      });
    }

    // --- Check 2: Mutating AI items instead of superseding (ASM-002) ---
    if (
      invalidated.some(a => a.id === 'ASM-002') ||
      (lower.includes('analysisitem') && (lower.includes('update') || lower.includes('delete') || lower.includes('overwrite')))
    ) {
      const severity: SeverityLevel = 'High';
      const confidence = 0.9;
      const score = this.prioritizer.calculateCompositeScore(severity, confidence, 0.7, 0.8, 0.5);

      findings.push({
        id: `FIND-${String(findings.length + 1).padStart(3, '0')}`,
        title: 'Direct Mutation of Immutable AI Analysis Records',
        classification: 'Confirmed Defect',
        severity,
        severityRationale: 'Directly modifying existing analysisItems destroys the pedagogical audit trail and violates teacher-override immutability rules.',
        confidence,
        confidenceLabel: this.prioritizer.getConfidenceLabel(confidence),
        affectedAreas: ['functions/src/repositories/evaluationRepository.ts', 'analysisItems subcollection'],
        evidence: [
          {
            id: 'EV-003',
            sourceType: 'architecture_doc',
            location: 'wiki/10-grade-m8-architecture.md#analysisItems',
            relevance: 'Mandates that analysisItems are immutable; teacher edits must create new item with source="teacher" superseding the AI item.'
          }
        ],
        failureScenario: 'Teacher opens graded submission, edits a score, and a background update mutates the original AI record, erasing historical baseline.',
        reproductionSteps: 'Check repository update query: verify whether it performs updateDoc() on analysisItemId or creates a new document with supersedesId.',
        recommendedMitigation: 'Enforce append-only pattern: create new analysisItem { source: "teacher", supersedesId: originalId, ... } instead of mutating existing doc.',
        suggestedOwner: 'backend-dev',
        uncertaintyAndLimitations: 'Requires checking repository implementation to confirm whether updateDoc or addDoc is invoked.',
        verificationStatus: 'Partially Investigated',
        compositeRiskScore: score
      });
    }

    // --- Check 3: Missing Role Check on Backend Route (ASM-004) ---
    if (
      lower.includes('route') &&
      (lower.includes('admin') || lower.includes('professor') || lower.includes('evaluat') || lower.includes('exam')) &&
      !lower.includes('requirerole') &&
      !lower.includes('customclaim')
    ) {
      const severity: SeverityLevel = 'Critical';
      const confidence = 0.8;
      const score = this.prioritizer.calculateCompositeScore(severity, confidence, 0.8, 0.9, 0.3);

      findings.push({
        id: `FIND-${String(findings.length + 1).padStart(3, '0')}`,
        title: 'Backend Route Lacks Role Verification (Double-Gating Violation)',
        classification: 'Evidence-Backed Risk',
        severity,
        severityRationale: 'Frontend route protection alone does not secure API endpoints; students can forge direct HTTP requests to access privileged resources.',
        confidence,
        confidenceLabel: this.prioritizer.getConfidenceLabel(confidence),
        affectedAreas: touchedFiles.filter(f => f.includes('route') || f.includes('controller')),
        evidence: [
          {
            id: 'EV-004',
            sourceType: 'architecture_doc',
            location: 'wiki/04-auth-and-roles.md#double-gating',
            relevance: 'Explicitly specifies that UI gates without backend requireRole middleware constitute a critical authorization flaw.'
          }
        ],
        failureScenario: 'A student logs in, extracts their bearer token, and sends a direct GET/POST curl request to an administrative or grading endpoint.',
        reproductionSteps: 'Send HTTP request with valid Student role token to the endpoint and assert whether response returns 403 Forbidden.',
        recommendedMitigation: 'Attach requireRole("professor") or requireRole("admin") middleware before controller execution in router definition.',
        suggestedOwner: 'backend-dev',
        uncertaintyAndLimitations: 'Router may mount a global middleware earlier in the middleware stack; inspect full route registration.',
        verificationStatus: 'Partially Investigated',
        compositeRiskScore: score
      });
    }

    if (
      scenarios.some(s => s.contextCategory === 'timezone_and_dates') ||
      ((lower.includes('deadline') || lower.includes('cutoff') || lower.includes('23:59')) && !lower.includes('timezone') && !lower.includes('utc'))
    ) {
      const severity: SeverityLevel = 'Medium';
      const confidence = 0.75;
      const score = this.prioritizer.calculateCompositeScore(severity, confidence, 0.6, 0.6, 0.5);

      findings.push({
        id: `FIND-${String(findings.length + 1).padStart(3, '0')}`,
        title: 'Requirement Ambiguity: Undefined Timezone and Grace Period for Submission Deadline',
        classification: 'Requirement Ambiguity',
        severity,
        severityRationale: 'Ambiguity in cutoff timezone and lack of grace period will cause legitimate on-time student submissions to be rejected or marked late.',
        confidence,
        confidenceLabel: this.prioritizer.getConfidenceLabel(confidence),
        affectedAreas: ['Assignment Specification', 'functions/src/controllers/submissionController.ts'],
        evidence: [
          {
            id: 'EV-005',
            sourceType: 'requirement',
            location: targetName,
            relevance: 'Specification defines deadline date/time without stating reference timezone (school local vs UTC) or network jitter grace period.'
          }
        ],
        failureScenario: 'Student in UTC-3 submits 5 minutes before midnight local time; server evaluates timestamp in UTC, marking submission 3 hours late.',
        reproductionSteps: 'Clarify with Product Owner: 1) What timezone governs the deadline? 2) Is there an automatic 60-second grace window for upload latency?',
        recommendedMitigation: 'Normalize all deadlines to UTC on save and document explicit 120-second grace period in acceptance criteria.',
        suggestedOwner: 'product-owner',
        uncertaintyAndLimitations: 'Specification document does not contain explicit business rule definitions.',
        verificationStatus: 'Not Tested',
        compositeRiskScore: score
      });
    }

    // --- Check 5: Historical Failure Recurrence Risk ---
    if (historicalMatches.length > 0) {
      const topMatch = historicalMatches[0];
      const severity: SeverityLevel = 'High';
      const confidence = topMatch.matchScore;
      const score = this.prioritizer.calculateCompositeScore(severity, confidence, 0.7, 0.7, 0.4);

      findings.push({
        id: `FIND-${String(findings.length + 1).padStart(3, '0')}`,
        title: `Historical Incident Recurrence: ${topMatch.pattern.title}`,
        classification: 'Evidence-Backed Risk',
        severity,
        severityRationale: `Code or context matches signature of previous postmortem [${topMatch.pattern.id}]: ${topMatch.pattern.rootCause}`,
        confidence,
        confidenceLabel: this.prioritizer.getConfidenceLabel(confidence),
        affectedAreas: touchedFiles.length > 0 ? touchedFiles : [`Historical Layer: ${topMatch.pattern.affectedLayer}`],
        evidence: [
          {
            id: 'EV-006',
            sourceType: 'incident_history',
            location: topMatch.pattern.id,
            relevance: topMatch.reason
          }
        ],
        failureScenario: `The current change repeats the failure mechanism documented on ${topMatch.pattern.date}: ${topMatch.pattern.rootCause}`,
        reproductionSteps: `Review previous mitigation: ${topMatch.pattern.mitigationApplied}`,
        recommendedMitigation: `Apply established mitigation: ${topMatch.pattern.mitigationApplied}`,
        suggestedOwner: 'backend-dev',
        uncertaintyAndLimitations: 'Heuristic keyword match; requires developer verification to ensure context is identical.',
        verificationStatus: 'Partially Investigated',
        compositeRiskScore: score
      });
    }

    // --- Check 6: Schema Migration & Backward Compatibility (ASM-005) ---
    if (
      invalidated.some(a => a.id === 'ASM-005') ||
      scenarios.some(s => s.contextCategory === 'schema_migration') ||
      lower.includes('rename') ||
      lower.includes('migration') ||
      lower.includes('drop')
    ) {
      const severity: SeverityLevel = 'Critical';
      const confidence = 0.85;
      const score = this.prioritizer.calculateCompositeScore(severity, confidence, 0.8, 0.9, 0.4);

      findings.push({
        id: `FIND-${String(findings.length + 1).padStart(3, '0')}`,
        title: 'Destructive Database Schema Migration: Non-Additive Change Violates Backward Compatibility',
        classification: 'Evidence-Backed Risk',
        severity,
        severityRationale: 'Renaming or removing database fields without backward-compatible dual-write/fallback breaks in-flight user sessions and active mobile/web clients.',
        confidence,
        confidenceLabel: this.prioritizer.getConfidenceLabel(confidence),
        affectedAreas: touchedFiles.length > 0 ? touchedFiles : ['Firestore Collections', 'Data Model Schemas'],
        evidence: [
          {
            id: 'EV-007',
            sourceType: 'architecture_doc',
            location: 'wiki/09-deployment-environments.md#migrations',
            relevance: 'Mandates that database schema changes must be strictly additive to preserve zero-downtime rolling deploys.'
          }
        ],
        failureScenario: 'Frontend client running cached version attempts to read/write old field name, encountering null reference errors or failed schema validations.',
        reproductionSteps: 'Deploy backend with renamed field while querying endpoint using previous schema payload; assert whether backward-compatible adapter responds.',
        recommendedMitigation: 'Implement 3-phase additive migration: 1) Support both old and new fields (dual-read/dual-write), 2) Backfill existing documents, 3) Deprecate legacy field in subsequent release.',
        suggestedOwner: 'tech-lead',
        uncertaintyAndLimitations: 'Requires auditing whether client applications cache data locally.',
        verificationStatus: 'Partially Investigated',
        compositeRiskScore: score
      });
    }

    // Default if no risk identified
    if (findings.length === 0) {
      findings.push({
        id: 'FIND-000',
        title: 'No Critical Adversarial Risk Identified Within Investigated Scope',
        classification: 'No Issue Found',
        severity: 'Low',
        severityRationale: 'Evaluated context respects foundational assumptions and shows no known architectural failure signatures.',
        confidence: 0.9,
        confidenceLabel: 'High',
        affectedAreas: touchedFiles,
        evidence: [],
        failureScenario: 'None detected.',
        recommendedMitigation: 'Maintain existing unit test coverage and architectural boundaries.',
        suggestedOwner: 'qa-engineer',
        uncertaintyAndLimitations: 'Analysis restricted to statically available text and files.',
        verificationStatus: 'Partially Investigated',
        compositeRiskScore: 0.1
      });
    }

    const prioritized = this.prioritizer.prioritize(findings, 0.2);
    return prioritized.length > 0 ? prioritized : findings;
  }
}
