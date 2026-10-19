import type { Finding, SeverityLevel, ConfidenceLabel } from '../types/schemas.ts';

export interface PrioritizationWeights {
  impact: number;
  likelihood: number;
  exposure: number;
  detectabilityInversion: number;
  confidence: number;
}

export interface SuppressedRisk {
  findingId: string;
  rationale: string;
  acceptedBy: string;
  expiresAt?: string;
  timestamp: string;
}

export class RiskPrioritizer {
  private weights: PrioritizationWeights;
  private suppressedRisks: Map<string, SuppressedRisk> = new Map();

  constructor(
    customWeights: Partial<PrioritizationWeights> = {},
    initialSuppressed: SuppressedRisk[] = []
  ) {
    this.weights = {
      impact: customWeights.impact ?? 0.35,
      likelihood: customWeights.likelihood ?? 0.25,
      exposure: customWeights.exposure ?? 0.15,
      detectabilityInversion: customWeights.detectabilityInversion ?? 0.15,
      confidence: customWeights.confidence ?? 0.10
    };
    for (const s of initialSuppressed) {
      this.suppressedRisks.set(s.findingId, s);
    }
  }

  public getImpactValue(severity: SeverityLevel): number {
    switch (severity) {
      case 'Critical':
        return 1.0;
      case 'High':
        return 0.75;
      case 'Medium':
        return 0.50;
      case 'Low':
        return 0.25;
      default:
        return 0.25;
    }
  }

  public getConfidenceLabel(confidence: number): ConfidenceLabel {
    if (confidence >= 0.95) return 'Confirmed';
    if (confidence >= 0.75) return 'High';
    if (confidence >= 0.45) return 'Medium';
    return 'Low';
  }

  /**
   * Transparently computes a composite risk score between 0.0 and 1.0.
   * Explicitly separates Severity (potential impact) from Confidence (evidential certainty).
   */
  public calculateCompositeScore(
    severity: SeverityLevel,
    confidence: number,
    likelihood: number = 0.5,
    exposure: number = 0.5,
    detectability: number = 0.5
  ): number {
    const impactVal = this.getImpactValue(severity);
    const detectabilityInversion = 1.0 - Math.min(Math.max(detectability, 0), 1);

    const score =
      impactVal * this.weights.impact +
      likelihood * this.weights.likelihood +
      exposure * this.weights.exposure +
      detectabilityInversion * this.weights.detectabilityInversion +
      confidence * this.weights.confidence;

    return Number(Math.min(Math.max(score, 0.0), 1.0).toFixed(3));
  }

  /**
   * Sorts findings by descending priority score, excluding active suppressed risks.
   */
  public prioritize(findings: Finding[], minScoreThreshold: number = 0.3): Finding[] {
    const active = findings.filter(f => !this.isSuppressed(f.id));
    return active
      .filter(f => f.compositeRiskScore >= minScoreThreshold)
      .sort((a, b) => b.compositeRiskScore - a.compositeRiskScore);
  }

  public suppressRisk(findingId: string, rationale: string, acceptedBy: string, expiresAt?: string): SuppressedRisk {
    const entry: SuppressedRisk = {
      findingId,
      rationale,
      acceptedBy,
      expiresAt,
      timestamp: new Date().toISOString()
    };
    this.suppressedRisks.set(findingId, entry);
    return entry;
  }

  public isSuppressed(findingId: string): boolean {
    const entry = this.suppressedRisks.get(findingId);
    if (!entry) return false;
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) {
      this.suppressedRisks.delete(findingId);
      return false;
    }
    return true;
  }

  public listSuppressed(): SuppressedRisk[] {
    return Array.from(this.suppressedRisks.values());
  }
}
