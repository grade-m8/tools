import test from 'node:test';
import assert from 'node:assert';
import { FutureAutopsySimulator } from '../src/engine/future-autopsy.ts';

test('FutureAutopsySimulator - produces structured premortem with causality chain', () => {
  const simulator = new FutureAutopsySimulator();
  const autopsy = simulator.simulateAutopsy(
    'Finals Week Async Grading Surge',
    'Scaling up to 1000 concurrent students submitting final exams'
  );

  assert.ok(autopsy.simulatedFailureDate);
  assert.ok(autopsy.imaginedFailure.length > 0);
  assert.ok(autopsy.chainOfCausality.length >= 4);
  assert.ok(autopsy.brokenAssumptions.length >= 2);
  assert.ok(autopsy.earlyWarningSignals.length >= 2);
  assert.ok(autopsy.preventativeActions.length >= 2);
  assert.ok(autopsy.explicitHypotheticalDisclaimer.includes('PRE-MORTEM SIMULATION'));
});
