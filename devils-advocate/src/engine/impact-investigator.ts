import type { ChangeImpact } from '../types/schemas.ts';
import { AssumptionRadar } from './assumption-radar.ts';
import { HistoricalFailureMemory } from './historical-memory.ts';

export class ChangeImpactInvestigator {
  private assumptionRadar: AssumptionRadar;
  private historicalMemory: HistoricalFailureMemory;

  constructor(assumptionRadar: AssumptionRadar, historicalMemory: HistoricalFailureMemory) {
    this.assumptionRadar = assumptionRadar;
    this.historicalMemory = historicalMemory;
  }

  public analyzeChange(
    targetChange: string,
    changedFiles: string[],
    changeContent: string
  ): ChangeImpact {
    const lower = `${targetChange} ${changeContent}`.toLowerCase();

    // 1. Determine affected components
    const affectedComponents: string[] = [];
    for (const file of changedFiles) {
      if (file.includes('grading') || file.includes('evaluation')) {
        affectedComponents.push('Grading Engine & Async Queue');
      } else if (file.includes('auth') || file.includes('role')) {
        affectedComponents.push('Authentication & Role-Gating System');
      } else if (file.includes('submission') || file.includes('exam')) {
        affectedComponents.push('Exam Submission Lifecycle');
      } else if (file.includes('database') || file.includes('repository')) {
        affectedComponents.push('Firestore Persistence Layer');
      } else if (file.includes('frontend') || file.includes('routes') || file.includes('components')) {
        affectedComponents.push('Frontend UI & Routing Seam');
      } else {
        affectedComponents.push(file);
      }
    }
    const uniqueAffected = Array.from(new Set(affectedComponents));

    // 2. Audit assumptions
    const { challenged, invalidated } = this.assumptionRadar.auditAssumptionsAgainstContext(
      changeContent,
      changedFiles
    );
    const challengedDescriptions = [...invalidated, ...challenged].map(
      a => `[${a.id}] ${a.description} (${a.validationStatus})`
    );

    // 3. Tests relevant or missing
    const missingOrRelevantTests: string[] = [];
    if (lower.includes('grade') || lower.includes('cloud task') || lower.includes('queue')) {
      missingOrRelevantTests.push('functions/test/unit/services/gradingService.test.ts (Missing concurrent duplicate task delivery test)');
      missingOrRelevantTests.push('functions/test/unit/repositories/evaluationRepository.test.ts (Verify supersede immutability)');
    }
    if (lower.includes('auth') || lower.includes('role')) {
      missingOrRelevantTests.push('functions/test/integration/routes/authRoleGates.test.ts (Verify 403 on missing role claim)');
    }
    if (missingOrRelevantTests.length === 0) {
      missingOrRelevantTests.push('Unit test suite covering failure paths and error status transitions');
    }

    // 4. Changed business rules
    const changedBusinessRules: string[] = [];
    if (lower.includes('grade') || lower.includes('rubric')) {
      changedBusinessRules.push('Evaluation scoring calculation or status lifecycle modified.');
    }
    if (lower.includes('deadline') || lower.includes('late')) {
      changedBusinessRules.push('Submission deadline cutoff or late submission penalty rules altered.');
    }
    if (lower.includes('role') || lower.includes('permission')) {
      changedBusinessRules.push('Access control policy or custom claim authorization rules changed.');
    }
    if (changedBusinessRules.length === 0) {
      changedBusinessRules.push('Operational workflow or validation criteria modified.');
    }

    // 5. Downstream consumers
    const downstreamConsumers: string[] = [];
    if (changedFiles.some(f => f.includes('backend') || f.includes('services') || f.includes('routes'))) {
      downstreamConsumers.push('React Frontend API client (src/services/api.ts)');
      downstreamConsumers.push('Grade-M8 Professor Gradebook dashboard');
      downstreamConsumers.push('Student Exam Results portal');
    }
    if (changedFiles.some(f => f.includes('firestore') || f.includes('schema'))) {
      downstreamConsumers.push('Cloud Functions triggers and scheduled cron jobs');
      downstreamConsumers.push('Data export & analytics pipelines');
    }

    // 6. Check historical bugs that may recur
    const matchedHistory = this.historicalMemory.searchPatterns(changeContent);
    const recurringBugRisks = matchedHistory.map(
      m => `[${m.pattern.id}] ${m.pattern.title} (Match score: ${m.matchScore.toFixed(2)}): ${m.pattern.rootCause}`
    );

    // 7. Required reviewers
    const requiredReviewers: string[] = ['tech-lead'];
    if (changedFiles.some(f => f.includes('backend') || f.includes('functions'))) {
      requiredReviewers.push('backend-dev', 'qa-engineer');
    }
    if (changedFiles.some(f => f.includes('frontend') || f.includes('src/components'))) {
      requiredReviewers.push('frontend-dev');
    }
    if (lower.includes('role') || lower.includes('auth') || lower.includes('token')) {
      requiredReviewers.push('security-reviewer');
    }
    if (lower.includes('deadline') || lower.includes('rubric') || lower.includes('feature')) {
      requiredReviewers.push('product-owner');
    }

    return {
      targetChange,
      affectedComponents: uniqueAffected,
      challengedAssumptions: challengedDescriptions,
      missingOrRelevantTests,
      changedBusinessRules,
      downstreamConsumers,
      recurringBugRisks,
      requiredReviewers: Array.from(new Set(requiredReviewers))
    };
  }
}
