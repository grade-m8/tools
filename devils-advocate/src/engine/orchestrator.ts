import type {
  RiskAssessment,
  Finding,
  SeverityLevel,
  CrossRoleDebate,
  FutureAutopsy,
  ChangeImpact,
  Assumption
} from '../types/schemas.ts';
import { AssumptionRadar } from './assumption-radar.ts';
import { FailureScenarioGenerator } from './failure-generator.ts';
import { RiskPrioritizer } from './risk-prioritizer.ts';
import { HistoricalFailureMemory } from './historical-memory.ts';
import { CrossRoleDebateEngine } from './cross-role-debate.ts';
import { FutureAutopsySimulator } from './future-autopsy.ts';
import { ChangeImpactInvestigator } from './impact-investigator.ts';
import { EvidenceBasedRiskInvestigator } from './risk-investigator.ts';
import { ContextRetriever } from './context-retriever.ts';

export class DevilsAdvocateOrchestrator {
  public assumptionRadar: AssumptionRadar;
  public failureGenerator: FailureScenarioGenerator;
  public prioritizer: RiskPrioritizer;
  public historicalMemory: HistoricalFailureMemory;
  public debateEngine: CrossRoleDebateEngine;
  public autopsySimulator: FutureAutopsySimulator;
  public impactInvestigator: ChangeImpactInvestigator;
  public riskInvestigator: EvidenceBasedRiskInvestigator;
  public contextRetriever: ContextRetriever;

  constructor(baseDir: string = process.cwd()) {
    this.assumptionRadar = new AssumptionRadar();
    this.failureGenerator = new FailureScenarioGenerator();
    this.prioritizer = new RiskPrioritizer();
    this.historicalMemory = new HistoricalFailureMemory();
    this.contextRetriever = new ContextRetriever(baseDir);

    this.debateEngine = new CrossRoleDebateEngine();
    this.autopsySimulator = new FutureAutopsySimulator();
    this.impactInvestigator = new ChangeImpactInvestigator(
      this.assumptionRadar,
      this.historicalMemory
    );
    this.riskInvestigator = new EvidenceBasedRiskInvestigator(
      this.prioritizer,
      this.assumptionRadar,
      this.failureGenerator,
      this.historicalMemory
    );
  }

  /**
   * Mode 1: Pull Request Investigation
   */
  public investigatePullRequest(prTitle: string, diffText: string, changedFiles: string[] = []): RiskAssessment {
    const findings = this.riskInvestigator.investigateContext(prTitle, diffText, changedFiles);
    const impact = this.impactInvestigator.analyzeChange(prTitle, changedFiles, diffText);
    const debate = this.debateEngine.debateDecision(`PR Review: ${prTitle}`, diffText);

    const overallSeverity = this.calculateOverallSeverity(findings);

    return {
      assessmentId: `ASSESS-PR-${Date.now()}`,
      mode: 'PullRequest',
      target: prTitle,
      overallRiskLevel: overallSeverity,
      findings,
      assumptionsAudited: this.assumptionRadar.exportRegistry(),
      crossRoleDebate: debate,
      changeImpact: impact,
      executiveSummary: `Adversarial audit completed for PR "${prTitle}". Identified ${findings.length} actionable findings (${findings.filter(f => f.classification === 'Confirmed Defect').length} confirmed defects, ${findings.filter(f => f.classification === 'Evidence-Backed Risk').length} evidence-backed risks).`,
      actionableRecommendations: findings.map(f => `[${f.severity}] ${f.title} -> ${f.recommendedMitigation} (Owner: ${f.suggestedOwner})`),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Mode 2: Requirement Challenge
   */
  public challengeRequirement(storyTitle: string, specText: string): RiskAssessment {
    const findings = this.riskInvestigator.investigateContext(storyTitle, specText, []);
    const debate = this.debateEngine.debateDecision(`Requirement Specification: ${storyTitle}`, specText);

    // Filter or highlight requirement ambiguities
    const overallSeverity = this.calculateOverallSeverity(findings);

    return {
      assessmentId: `ASSESS-REQ-${Date.now()}`,
      mode: 'Requirement',
      target: storyTitle,
      overallRiskLevel: overallSeverity,
      findings,
      assumptionsAudited: this.assumptionRadar.exportRegistry(),
      crossRoleDebate: debate,
      executiveSummary: `Challenged requirements for story "${storyTitle}". Identified ${findings.filter(f => f.classification === 'Requirement Ambiguity').length} requirement ambiguities and undefined edge states before implementation starts.`,
      actionableRecommendations: findings.map(f => `[${f.classification}] ${f.title}: ${f.failureScenario} -> Clarification: ${f.recommendedMitigation}`),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Mode 3: Sprint Premortem
   */
  public runSprintPremortem(sprintName: string, backlogDescription: string): RiskAssessment {
    const autopsy = this.autopsySimulator.simulateAutopsy(sprintName, backlogDescription);
    const findings = this.riskInvestigator.investigateContext(sprintName, backlogDescription, []);
    const debate = this.debateEngine.debateDecision(`Sprint Commitments: ${sprintName}`, backlogDescription);

    return {
      assessmentId: `ASSESS-SPRINT-${Date.now()}`,
      mode: 'Sprint',
      target: sprintName,
      overallRiskLevel: autopsy.severityLevel === 'Catastrophic' ? 'Critical' : 'High',
      findings,
      assumptionsAudited: this.assumptionRadar.exportRegistry(),
      futureAutopsy: autopsy,
      crossRoleDebate: debate,
      executiveSummary: `Future Autopsy generated for sprint "${sprintName}". Simulated catastrophic failure scenario set on ${autopsy.simulatedFailureDate} with ${autopsy.preventativeActions.length} preemptive interventions defined today.`,
      actionableRecommendations: autopsy.preventativeActions.map(a => `[${a.priority}] ${a.action} (Assigned to: ${a.owner})`),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Mode 4: Release Risk Assessment
   */
  public assessReleaseRisk(releaseVersion: string, releaseScopeText: string, changedFiles: string[] = []): RiskAssessment {
    const findings = this.riskInvestigator.investigateContext(releaseVersion, releaseScopeText, changedFiles);
    const impact = this.impactInvestigator.analyzeChange(releaseVersion, changedFiles, releaseScopeText);
    const autopsy = this.autopsySimulator.simulateAutopsy(releaseVersion, releaseScopeText);

    const overallSeverity = this.calculateOverallSeverity(findings);

    return {
      assessmentId: `ASSESS-REL-${Date.now()}`,
      mode: 'Release',
      target: releaseVersion,
      overallRiskLevel: overallSeverity,
      findings,
      assumptionsAudited: this.assumptionRadar.exportRegistry(),
      futureAutopsy: autopsy,
      changeImpact: impact,
      executiveSummary: `Release risk assessment conducted for ${releaseVersion}. Found ${findings.length} risk items. Evaluated backward compatibility, migration reversibility, and external rate limits.`,
      actionableRecommendations: findings.map(f => `[Release Gate] ${f.title}: ${f.recommendedMitigation}`),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Mode 5: Incident Pattern Detection
   */
  public detectIncidentPatterns(incidentTitle: string, incidentReportText: string): RiskAssessment {
    const matches = this.historicalMemory.searchPatterns(incidentReportText);
    const findings = this.riskInvestigator.investigateContext(incidentTitle, incidentReportText, []);

    return {
      assessmentId: `ASSESS-INC-${Date.now()}`,
      mode: 'Incident',
      target: incidentTitle,
      overallRiskLevel: 'High',
      findings,
      assumptionsAudited: this.assumptionRadar.exportRegistry(),
      executiveSummary: `Incident pattern analysis for "${incidentTitle}". Matched ${matches.length} recurring systemic failure patterns from historical incident registry.`,
      actionableRecommendations: matches.map(m => `Learn from [${m.pattern.id}] ${m.pattern.title}: Apply established mitigation "${m.pattern.mitigationApplied}"`),
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Mode 6: On-Demand Investigation
   */
  public investigateOnDemand(query: string, contextDescription: string = ''): RiskAssessment {
    const combined = `${query}\n${contextDescription}`;
    const findings = this.riskInvestigator.investigateContext(query, combined, []);
    const debate = this.debateEngine.debateDecision(query, combined);
    const autopsy = query.toLowerCase().includes('autopsy') || query.toLowerCase().includes('premortem')
      ? this.autopsySimulator.simulateAutopsy(query, combined)
      : undefined;

    return {
      assessmentId: `ASSESS-DEMAND-${Date.now()}`,
      mode: 'OnDemand',
      target: query,
      overallRiskLevel: this.calculateOverallSeverity(findings),
      findings,
      assumptionsAudited: this.assumptionRadar.exportRegistry(),
      crossRoleDebate: debate,
      futureAutopsy: autopsy,
      executiveSummary: `On-demand adversarial investigation for: "${query}".`,
      actionableRecommendations: findings.map(f => `[${f.severity}] ${f.title} -> ${f.recommendedMitigation}`),
      generatedAt: new Date().toISOString()
    };
  }

  private calculateOverallSeverity(findings: Finding[]): SeverityLevel {
    if (findings.some(f => f.severity === 'Critical' && f.classification !== 'No Issue Found')) {
      return 'Critical';
    }
    if (findings.some(f => f.severity === 'High' && f.classification !== 'No Issue Found')) {
      return 'High';
    }
    if (findings.some(f => f.severity === 'Medium' && f.classification !== 'No Issue Found')) {
      return 'Medium';
    }
    return 'Low';
  }

  /**
   * Formats a RiskAssessment into a clean Markdown report conforming to Section 8 format
   */
  public formatAssessmentReport(assessment: RiskAssessment): string {
    const lines: string[] = [];

    lines.push(`# 👹 Devil's Advocate Adversarial Risk Assessment`);
    lines.push(`**Target:** ${assessment.target} | **Mode:** ${assessment.mode} | **Risk Level:** ${assessment.overallRiskLevel}`);
    lines.push(`**Generated At:** ${assessment.generatedAt} | **Assessment ID:** ${assessment.assessmentId}`);
    lines.push('');
    lines.push(`## 📌 Executive Summary`);
    lines.push(assessment.executiveSummary);
    lines.push('');

    // Change Impact if present
    if (assessment.changeImpact) {
      lines.push(`## 🔍 Change Impact Analysis`);
      lines.push(`- **Affected Components:** ${assessment.changeImpact.affectedComponents.join(', ')}`);
      lines.push(`- **Challenged Assumptions:** ${assessment.changeImpact.challengedAssumptions.length > 0 ? assessment.changeImpact.challengedAssumptions.join('; ') : 'None'}`);
      lines.push(`- **Required Reviewers:** ${assessment.changeImpact.requiredReviewers.join(', ')}`);
      lines.push(`- **Missing or Relevant Tests:**`);
      for (const t of assessment.changeImpact.missingOrRelevantTests) {
        lines.push(`  - ${t}`);
      }
      lines.push('');
    }

    // Findings section (Section 8 standard format)
    lines.push(`## ⚠️ Adversarial Findings (${assessment.findings.length})`);
    if (assessment.findings.length === 0) {
      lines.push('No adversarial issues detected within the investigated scope.');
    } else {
      for (const f of assessment.findings) {
        lines.push(`### [${f.id}] ${f.title}`);
        lines.push(`- **Classification:** ${f.classification}`);
        lines.push(`- **Severity:** ${f.severity} — *${f.severityRationale}*`);
        lines.push(`- **Confidence:** ${f.confidenceLabel} (${f.confidence}) — *Composite Risk Score: ${f.compositeRiskScore}*`);
        lines.push(`- **Affected Areas:** ${f.affectedAreas.join(', ')}`);
        lines.push(`- **Evidence:**`);
        for (const ev of f.evidence) {
          lines.push(`  - \`${ev.location}\` (${ev.sourceType}): ${ev.relevance}`);
        }
        lines.push(`- **Failure Scenario:**\n  ${f.failureScenario.replace(/\n/g, '\n  ')}`);
        if (f.reproductionSteps) {
          lines.push(`- **Reproduction Steps:** ${f.reproductionSteps}`);
        }
        lines.push(`- **Recommended Mitigation:** ${f.recommendedMitigation}`);
        lines.push(`- **Suggested Owner:** \`${f.suggestedOwner}\``);
        lines.push(`- **Uncertainty & Limitations:** ${f.uncertaintyAndLimitations}`);
        lines.push(`- **Verification Status:** \`${f.verificationStatus}\``);
        lines.push('');
      }
    }

    // Cross-Role Debate if present
    if (assessment.crossRoleDebate) {
      lines.push(`## ⚔️ Cross-Role Debate Engine`);
      lines.push(`**Topic:** ${assessment.crossRoleDebate.topic}`);
      lines.push('');
      for (const p of assessment.crossRoleDebate.perspectives) {
        lines.push(`#### 👤 Role: ${p.role}`);
        lines.push(`- **Stance:** ${p.stance}`);
        lines.push(`- **Key Concerns:** ${p.keyConcerns.join('; ')}`);
        lines.push(`- **Proposed Mitigation:** ${p.proposedMitigation}`);
        lines.push('');
      }
      lines.push(`### 🤝 Consensus Points:`);
      for (const c of assessment.crossRoleDebate.consensusPoints) {
        lines.push(`- ${c}`);
      }
      lines.push('');
      lines.push(`### 💥 Friction & Divergence:`);
      for (const fr of assessment.crossRoleDebate.frictionPoints) {
        lines.push(`- ${fr}`);
      }
      lines.push('');
      lines.push(`### 📊 Evidence Needed to Resolve:`);
      for (const ev of assessment.crossRoleDebate.requiredEvidenceToDecide) {
        lines.push(`- ${ev}`);
      }
      lines.push('');
    }

    // Future Autopsy if present
    if (assessment.futureAutopsy) {
      const au = assessment.futureAutopsy;
      lines.push(`## 🔮 Future Autopsy (Pre-Mortem Simulation)`);
      lines.push(`> [!WARNING]`);
      lines.push(`> **${au.explicitHypotheticalDisclaimer}**`);
      lines.push('');
      lines.push(`- **Simulated Failure Date:** ${au.simulatedFailureDate}`);
      lines.push(`- **Imagined Catastrophe:** ${au.imaginedFailure} (${au.severityLevel})`);
      lines.push('');
      lines.push(`### ⛓️ Chain of Causality:`);
      for (const step of au.chainOfCausality) {
        lines.push(`  ${step.step}. **${step.event}** — *Factor: ${step.contributingFactor}*`);
      }
      lines.push('');
      lines.push(`### 🚨 Early Warning Signals:`);
      for (const sig of au.earlyWarningSignals) {
        lines.push(`- [${sig.phase}] **${sig.signal}** *(Source: ${sig.telemetrySource})*`);
      }
      lines.push('');
      lines.push(`### 🛡️ Preemptive Interventions:`);
      for (const act of au.preventativeActions) {
        lines.push(`- [${act.priority}] ${act.action} -> **Owner: ${act.owner}**`);
      }
      lines.push('');
    }

    lines.push(`---`);
    lines.push(`*Generated by Devil's Advocate Agent — Adversarial Software Engineering System*`);

    return lines.join('\n');
  }
}
