import test from 'node:test';
import assert from 'node:assert';
import type { Finding, Assumption, RiskAssessment } from '../src/types/schemas.ts';
import { FindingJsonSchema, AssumptionJsonSchema, RiskAssessmentJsonSchema } from '../src/types/json-schemas.ts';

test('Typed Schemas - Finding structure compliance', () => {
  const sampleFinding: Finding = {
    id: 'FIND-001',
    title: 'Non-Idempotent Concurrent Task Worker',
    classification: 'Confirmed Defect',
    severity: 'Critical',
    severityRationale: 'Causes score clobbering',
    confidence: 0.95,
    confidenceLabel: 'Confirmed',
    affectedAreas: ['services/gradingService.ts'],
    evidence: [
      {
        id: 'EV-1',
        sourceType: 'code',
        location: 'services/gradingService.ts#L45',
        relevance: 'Missing transaction wrapper'
      }
    ],
    failureScenario: 'Concurrent request overwrites state',
    reproductionSteps: 'Fire two concurrent tasks',
    recommendedMitigation: 'Wrap in db.runTransaction()',
    suggestedOwner: 'backend-dev',
    uncertaintyAndLimitations: 'Dependent on queue settings',
    verificationStatus: 'Reproduced',
    compositeRiskScore: 0.88
  };

  assert.strictEqual(sampleFinding.classification, 'Confirmed Defect');
  assert.strictEqual(sampleFinding.severity, 'Critical');
  assert.strictEqual(sampleFinding.confidence, 0.95);
  assert.ok(sampleFinding.compositeRiskScore > 0.8);
});

test('JSON Schema - Finding schema contains required fields', () => {
  assert.ok(FindingJsonSchema.required.includes('id'));
  assert.ok(FindingJsonSchema.required.includes('classification'));
  assert.ok(FindingJsonSchema.required.includes('severity'));
  assert.ok(FindingJsonSchema.required.includes('compositeRiskScore'));
  assert.ok(FindingJsonSchema.required.includes('verificationStatus'));
});

test('JSON Schema - Assumption schema contains required fields', () => {
  assert.ok(AssumptionJsonSchema.required.includes('id'));
  assert.ok(AssumptionJsonSchema.required.includes('description'));
  assert.ok(AssumptionJsonSchema.required.includes('validationStatus'));
  assert.ok(AssumptionJsonSchema.required.includes('impactIfFalse'));
});
