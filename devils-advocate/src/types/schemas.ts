/**
 * Core Type Definitions & Typed Schemas for Devil's Advocate Agent
 */

export type FindingClassification =
  | 'Confirmed Defect'
  | 'Evidence-Backed Risk'
  | 'Unverified Hypothesis'
  | 'Requirement Ambiguity'
  | 'Missing Validation'
  | 'No Issue Found';

export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low';

export type ConfidenceLabel = 'Confirmed' | 'High' | 'Medium' | 'Low';

export type VerificationStatus =
  | 'Reproduced'
  | 'Disproved'
  | 'Partially Investigated'
  | 'Not Tested';

export interface EvidenceItem {
  id: string;
  sourceType: 'code' | 'requirement' | 'architecture_doc' | 'test_result' | 'incident_history' | 'git_diff';
  location: string; // e.g. "functions/src/services/gradingService.ts#L45-L62"
  snippet?: string;
  relevance: string;
}

export interface Finding {
  id: string;
  title: string;
  classification: FindingClassification;
  severity: SeverityLevel;
  severityRationale: string;
  confidence: number; // 0.0 - 1.0
  confidenceLabel: ConfidenceLabel;
  affectedAreas: string[];
  evidence: EvidenceItem[];
  failureScenario: string;
  reproductionSteps?: string;
  recommendedMitigation: string;
  suggestedOwner: 'backend-dev' | 'frontend-dev' | 'qa-engineer' | 'tech-lead' | 'product-owner' | 'project-manager';
  uncertaintyAndLimitations: string;
  verificationStatus: VerificationStatus;
  compositeRiskScore: number; // 0.0 - 1.0 (Calculated via transparent formula)
}

export type AssumptionStatus = 'Validated' | 'Unverified' | 'Challenged' | 'Invalidated';
export type AssumptionImpact = 'Catastrophic' | 'Major' | 'Moderate' | 'Minor';

export interface Assumption {
  id: string;
  description: string;
  source: string;
  ownerRole?: string;
  confidence: number; // 0.0 - 1.0
  affectedComponents: string[];
  validationStatus: AssumptionStatus;
  impactIfFalse: AssumptionImpact;
  invalidationEvents: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationEvidence {
  type: 'code_pattern' | 'test_coverage' | 'architecture_doc' | 'runtime_check' | 'incident_log';
  reference: string;
  supportsHypothesis: boolean;
  notes: string;
}

export interface InvestigationResult {
  hypothesisId: string;
  hypothesisStatement: string;
  evaluatedEvidence: InvestigationEvidence[];
  safeExecutionResult?: {
    command: string;
    exitCode: number;
    output: string;
    verified: boolean;
  };
  conclusion: FindingClassification;
  confidence: number;
  limitations: string[];
}

export interface RolePerspective {
  role: 'Developer' | 'QA Engineer' | 'Tech Lead / Architect' | 'Product Owner' | 'Project Manager';
  stance: string;
  keyConcerns: string[];
  proposedMitigation: string;
  acceptableTradeOffs: string[];
}

export interface CrossRoleDebate {
  topic: string;
  perspectives: RolePerspective[];
  consensusPoints: string[];
  frictionPoints: string[];
  requiredEvidenceToDecide: string[];
}

export interface CausalityStep {
  step: number;
  event: string;
  contributingFactor: string;
}

export interface EarlyWarningSignal {
  phase: string;
  signal: string;
  telemetrySource: string;
}

export interface PreventativeAction {
  priority: 'P0' | 'P1' | 'P2';
  action: string;
  owner: string;
}

export interface FutureAutopsy {
  initiativeName: string;
  simulatedFailureDate: string;
  imaginedFailure: string;
  severityLevel: 'Catastrophic' | 'Severe' | 'Moderate';
  chainOfCausality: CausalityStep[];
  brokenAssumptions: string[];
  earlyWarningSignals: EarlyWarningSignal[];
  preventativeActions: PreventativeAction[];
  explicitHypotheticalDisclaimer: string;
}

export interface ChangeImpact {
  targetChange: string;
  affectedComponents: string[];
  challengedAssumptions: string[];
  missingOrRelevantTests: string[];
  changedBusinessRules: string[];
  downstreamConsumers: string[];
  recurringBugRisks: string[];
  requiredReviewers: string[];
}

export interface HistoricalFailurePattern {
  id: string;
  title: string;
  date: string;
  rootCause: string;
  affectedLayer: 'backend' | 'frontend' | 'database' | 'queue' | 'auth';
  keywords: string[];
  failureSignature: string; // regex or heuristic signature
  mitigationApplied: string;
  recurrenceCount: number;
  feedbackScore?: number; // User acceptance feedback (1.0 = helpful, -1.0 = dismissed)
}

export interface RiskAssessment {
  assessmentId: string;
  mode: 'PullRequest' | 'Requirement' | 'Sprint' | 'Release' | 'Incident' | 'OnDemand';
  target: string;
  overallRiskLevel: SeverityLevel;
  findings: Finding[];
  assumptionsAudited: Assumption[];
  crossRoleDebate?: CrossRoleDebate;
  futureAutopsy?: FutureAutopsy;
  changeImpact?: ChangeImpact;
  executiveSummary: string;
  actionableRecommendations: string[];
  generatedAt: string;
}
