import test from 'node:test';
import assert from 'node:assert';
import { CrossRoleDebateEngine } from '../src/engine/cross-role-debate.ts';

test('CrossRoleDebateEngine - debates decision across 5 distinct professional roles', () => {
  const engine = new CrossRoleDebateEngine();
  const debate = engine.debateDecision(
    'Switching AI grading from Cloud Tasks to in-memory event emitter',
    'Proposal to remove Cloud Tasks and handle retries directly inside node memory to reduce GCP costs'
  );

  assert.strictEqual(debate.perspectives.length, 5);

  const roles = debate.perspectives.map(p => p.role);
  assert.ok(roles.includes('Developer'));
  assert.ok(roles.includes('QA Engineer'));
  assert.ok(roles.includes('Tech Lead / Architect'));
  assert.ok(roles.includes('Product Owner'));
  assert.ok(roles.includes('Project Manager'));

  // Ensure consensus and friction are not artificially empty
  assert.ok(debate.consensusPoints.length > 0);
  assert.ok(debate.frictionPoints.length > 0);
  assert.ok(debate.requiredEvidenceToDecide.length > 0);
});
