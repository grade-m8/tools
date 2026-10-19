import test from 'node:test';
import assert from 'node:assert';
import { DevilsAdvocateOrchestrator } from '../src/engine/orchestrator.ts';

test('DevilsAdvocateOrchestrator - runs Mode 1 (Pull Request Investigation)', () => {
  const orchestrator = new DevilsAdvocateOrchestrator();
  const diff = `
    router.post('/grade', async (req, res) => {
      // Missing requireRole
      const doc = await db.collection('submissions').doc(req.body.id).get();
      await db.collection('submissions').doc(req.body.id).update({
        totalSubmissions: doc.data().totalSubmissions + 1
      });
    });
  `;

  const assessment = orchestrator.investigatePullRequest('PR #42: Add Grading Route', diff, ['functions/src/routes/gradingRoutes.ts']);

  assert.strictEqual(assessment.mode, 'PullRequest');
  assert.ok(assessment.findings.length >= 1);
  assert.ok(assessment.changeImpact);
  assert.ok(assessment.crossRoleDebate);

  const report = orchestrator.formatAssessmentReport(assessment);
  assert.ok(report.includes('Devil\'s Advocate Adversarial Risk Assessment'));
  assert.ok(report.includes('Adversarial Findings'));
});

test('DevilsAdvocateOrchestrator - runs Mode 2 (Requirement Challenge)', () => {
  const orchestrator = new DevilsAdvocateOrchestrator();
  const spec = 'Students have until deadline 23:59 to submit their exams.';
  const assessment = orchestrator.challengeRequirement('Student Exam Cutoff Story', spec);

  assert.strictEqual(assessment.mode, 'Requirement');
  assert.ok(assessment.findings.some(f => f.classification === 'Requirement Ambiguity'));
});

test('DevilsAdvocateOrchestrator - runs Mode 3 (Sprint Premortem)', () => {
  const orchestrator = new DevilsAdvocateOrchestrator();
  const assessment = orchestrator.runSprintPremortem('Sprint 15', 'Implement high-speed grading pipeline for 500 students');

  assert.strictEqual(assessment.mode, 'Sprint');
  assert.ok(assessment.futureAutopsy);
  assert.ok(assessment.futureAutopsy?.chainOfCausality.length >= 3);
});

test('DevilsAdvocateOrchestrator - runs Mode 4 (Release Risk Assessment)', () => {
  const orchestrator = new DevilsAdvocateOrchestrator();
  const assessment = orchestrator.assessReleaseRisk('v1.0.0', 'Production Release Scope with Firestore Schema updates');

  assert.strictEqual(assessment.mode, 'Release');
  assert.ok(assessment.changeImpact);
});

test('DevilsAdvocateOrchestrator - runs Mode 5 (Incident Pattern Detection)', () => {
  const orchestrator = new DevilsAdvocateOrchestrator();
  const postmortem = 'Postmortem: Gemini API rate limit exceeded due to 429 quota exhaustion during simultaneous Cloud Tasks dispatch.';
  const assessment = orchestrator.detectIncidentPatterns('INC-2026-004 Postmortem', postmortem);

  assert.strictEqual(assessment.mode, 'Incident');
  assert.ok(assessment.actionableRecommendations.length > 0);
});

test('DevilsAdvocateOrchestrator - runs Mode 6 (On-Demand Investigation)', () => {
  const orchestrator = new DevilsAdvocateOrchestrator();
  const assessment = orchestrator.investigateOnDemand('What happens if two students submit at the exact same millisecond?');

  assert.strictEqual(assessment.mode, 'OnDemand');
  assert.ok(assessment.findings.length > 0);
});
