import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DevilsAdvocateOrchestrator } from '../src/engine/orchestrator.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenariosPath = path.join(__dirname, '..', 'data', 'evaluation-scenarios.json');

test('Evaluation Dataset - All 5 realistic engineering scenarios evaluate as expected', () => {
  assert.ok(fs.existsSync(scenariosPath), 'Evaluation dataset file must exist');
  const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf-8'));
  assert.strictEqual(scenarios.length, 5);

  const orchestrator = new DevilsAdvocateOrchestrator();

  for (const scenario of scenarios) {
    if (scenario.targetType === 'PullRequest') {
      const assessment = orchestrator.investigatePullRequest(
        scenario.name,
        scenario.inputDiff,
        ['functions/src/services/gradingService.ts']
      );

      for (const expected of scenario.expectedFindings || []) {
        const match = assessment.findings.find(f =>
          f.title.includes(expected.titleSubstring) ||
          f.classification === expected.classification
        );
        assert.ok(
          match,
          `Scenario ${scenario.scenarioId} expected finding with classification "${expected.classification}"`
        );
        assert.strictEqual(match?.classification, expected.classification);
      }
    } else if (scenario.targetType === 'Requirement') {
      const assessment = orchestrator.challengeRequirement(scenario.name, scenario.inputSpec);
      for (const expected of scenario.expectedFindings || []) {
        const match = assessment.findings.find(f => f.classification === expected.classification);
        assert.ok(
          match,
          `Scenario ${scenario.scenarioId} expected finding with classification "${expected.classification}"`
        );
      }
    } else if (scenario.targetType === 'Sprint') {
      const assessment = orchestrator.runSprintPremortem(scenario.name, scenario.inputBacklog);
      assert.ok(assessment.futureAutopsy);
      assert.strictEqual(assessment.futureAutopsy?.severityLevel, scenario.expectedAutopsy.severityLevel);
      assert.ok(
        assessment.futureAutopsy?.brokenAssumptions.some(a =>
          a.includes(scenario.expectedAutopsy.expectedBrokenAssumption)
        )
      );
    } else if (scenario.targetType === 'Release') {
      const assessment = orchestrator.assessReleaseRisk(scenario.name, scenario.inputScope);
      assert.ok(assessment.findings.length > 0);
    }
  }
});
