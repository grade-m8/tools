import test from 'node:test';
import assert from 'node:assert';
import { AssumptionRadar } from '../src/engine/assumption-radar.ts';

test('AssumptionRadar - initializes with Grade-M8 foundational assumptions', () => {
  const radar = new AssumptionRadar();
  const assumptions = radar.exportRegistry();

  assert.ok(assumptions.length >= 5);
  const asm1 = radar.getAssumption('ASM-001');
  assert.ok(asm1);
  assert.strictEqual(asm1?.validationStatus, 'Validated');
  assert.strictEqual(asm1?.impactIfFalse, 'Catastrophic');
});

test('AssumptionRadar - registers new custom assumption', () => {
  const radar = new AssumptionRadar();
  const custom = radar.registerAssumption({
    description: 'Redis is only used for temporary caching and never as source of truth',
    source: 'wiki/architecture',
    ownerRole: 'tech-lead',
    confidence: 0.9,
    affectedComponents: ['cacheService.ts'],
    validationStatus: 'Validated',
    impactIfFalse: 'Major',
    invalidationEvents: ['Redis used as primary database']
  });

  assert.ok(custom.id.startsWith('ASM-'));
  assert.strictEqual(custom.validationStatus, 'Validated');
  assert.strictEqual(radar.getAssumption(custom.id)?.description, custom.description);
});

test('AssumptionRadar - audits context and detects invalidated assumptions', () => {
  const radar = new AssumptionRadar();

  const diffWithOverwrite = `
    async function updateAIReport(id, data) {
      // Overwrite AI items directly in collection
      await db.collection('analysisItems').doc(id).update({ score: data.score, source: 'ai' });
    }
  `;

  const audit = radar.auditAssumptionsAgainstContext(diffWithOverwrite, ['functions/src/repositories/evaluationRepository.ts']);

  assert.ok(audit.invalidated.some(a => a.id === 'ASM-002'));
});

test('AssumptionRadar - status update records audit history', () => {
  const radar = new AssumptionRadar();
  const updated = radar.updateStatus('ASM-001', 'Challenged', 'Load test revealed race condition');

  assert.strictEqual(updated.validationStatus, 'Challenged');
  assert.ok(updated.invalidationEvents.some(e => e.includes('Load test revealed race condition')));
});
