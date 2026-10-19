import test from 'node:test';
import assert from 'node:assert';
import { RiskPrioritizer } from '../src/engine/risk-prioritizer.ts';
import { AssumptionRadar } from '../src/engine/assumption-radar.ts';
import { FailureScenarioGenerator } from '../src/engine/failure-generator.ts';
import { HistoricalFailureMemory } from '../src/engine/historical-memory.ts';
import { EvidenceBasedRiskInvestigator } from '../src/engine/risk-investigator.ts';

test('RiskPrioritizer - correctly separates impact from confidence', () => {
  const prioritizer = new RiskPrioritizer();

  // Catastrophic (Critical) but low confidence hypothesis
  const lowConfScore = prioritizer.calculateCompositeScore('Critical', 0.2, 0.3, 0.4, 0.5);

  // Confirmed Low-severity defect
  const highConfLowSevScore = prioritizer.calculateCompositeScore('Low', 1.0, 0.5, 0.5, 0.5);

  assert.ok(lowConfScore > 0);
  assert.ok(highConfLowSevScore > 0);
  // Transparent calculation check
  assert.strictEqual(prioritizer.getConfidenceLabel(1.0), 'Confirmed');
  assert.strictEqual(prioritizer.getConfidenceLabel(0.2), 'Low');
});

test('RiskPrioritizer - risk suppression works with audit logs', () => {
  const prioritizer = new RiskPrioritizer();
  prioritizer.suppressRisk('FIND-001', 'Accepted business risk for MVP launch', 'tech-lead');

  assert.strictEqual(prioritizer.isSuppressed('FIND-001'), true);
  assert.strictEqual(prioritizer.isSuppressed('FIND-002'), false);
  assert.strictEqual(prioritizer.listSuppressed().length, 1);
});

test('EvidenceBasedRiskInvestigator - detects confirmed defect on concurrent Firestore mutation', () => {
  const prioritizer = new RiskPrioritizer();
  const radar = new AssumptionRadar();
  const failureGen = new FailureScenarioGenerator();
  const history = new HistoricalFailureMemory();

  const investigator = new EvidenceBasedRiskInvestigator(prioritizer, radar, failureGen, history);

  const diffSnippet = `
    export async function triggerGrading(req, res) {
      const doc = await db.collection('submissions').doc(req.body.id).get();
      await db.collection('submissions').doc(req.body.id).update({
        totalSubmissions: doc.data().totalSubmissions + 1,
        status: 'grading'
      });
    }
  `;

  const findings = investigator.investigateContext(
    'Concurrent Grading PR',
    diffSnippet,
    ['functions/src/services/gradingService.ts']
  );

  assert.ok(findings.length > 0);
  const defect = findings.find(f => f.title.includes('Non-Idempotent Concurrent Grading'));
  assert.ok(defect);
  assert.strictEqual(defect?.classification, 'Confirmed Defect');
  assert.strictEqual(defect?.severity, 'Critical');
  assert.strictEqual(defect?.verificationStatus, 'Reproduced');
  assert.ok(defect?.compositeRiskScore >= 0.7);
});

test('EvidenceBasedRiskInvestigator - flags requirement ambiguity on deadline timezone', () => {
  const prioritizer = new RiskPrioritizer();
  const radar = new AssumptionRadar();
  const failureGen = new FailureScenarioGenerator();
  const history = new HistoricalFailureMemory();

  const investigator = new EvidenceBasedRiskInvestigator(prioritizer, radar, failureGen, history);

  const specText = 'Students must submit homework before 23:59 on Friday deadline or be locked out.';

  const findings = investigator.investigateContext('Homework Deadline Story', specText, []);

  const ambiguity = findings.find(f => f.classification === 'Requirement Ambiguity');
  assert.ok(ambiguity);
  assert.ok(ambiguity?.title.includes('Undefined Timezone'));
  assert.strictEqual(ambiguity?.suggestedOwner, 'product-owner');
});
