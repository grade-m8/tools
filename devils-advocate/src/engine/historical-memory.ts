import type { HistoricalFailurePattern } from '../types/schemas.ts';

export class HistoricalFailureMemory {
  private patterns: Map<string, HistoricalFailurePattern> = new Map();

  constructor(initialPatterns?: HistoricalFailurePattern[]) {
    if (initialPatterns && initialPatterns.length > 0) {
      for (const p of initialPatterns) {
        this.patterns.set(p.id, p);
      }
    } else {
      this.loadSeedPatterns();
    }
  }

  private loadSeedPatterns(): void {
    const seeds: HistoricalFailurePattern[] = [
      {
        id: 'INC-2026-001',
        title: 'Grading Counter Desynchronization Under Heavy Submission Load',
        date: '2026-03-12',
        rootCause: 'Concurrent requests executed non-transactional increment without Firestore FieldValue.increment() or runTransaction() lock',
        affectedLayer: 'backend',
        keywords: ['counter', 'submit', 'exam', 'race condition', 'increment', 'totalSubmissions'],
        failureSignature: '(increment|totalSubmissions|score)\\s*\\+\\s*1',
        mitigationApplied: 'Replaced manual read-increment-write with FieldValue.increment(1) inside Firestore runTransaction()',
        recurrenceCount: 2,
        feedbackScore: 1.0
      },
      {
        id: 'INC-2026-002',
        title: 'Silent AI Feedback Clashing with Teacher Manual Review',
        date: '2026-04-05',
        rootCause: 'Asynchronous retry worker replaced entire analysisItems array instead of appending new record with source=ai',
        affectedLayer: 'database',
        keywords: ['analysisItems', 'teacher', 'ai', 'grading', 'feedback', 'overwrite'],
        failureSignature: 'updateDoc.*analysisItems.*\\b(ai|eval)\\b',
        mitigationApplied: 'Enforced append-only audit trail: teacher manual edits supersede AI records by creating new item',
        recurrenceCount: 1,
        feedbackScore: 0.9
      },
      {
        id: 'INC-2026-003',
        title: 'Broken Role Gate on Evaluation Export Endpoint',
        date: '2026-05-18',
        rootCause: 'Route added to express router without requireRole("professor") middleware, allowing authenticated student to view class exam answers',
        affectedLayer: 'auth',
        keywords: ['export', 'evaluation', 'route', 'middleware', 'role', 'student', 'claims'],
        failureSignature: 'router\\.(get|post)\\([\'"][^\'"]*export[^\'"]*\\s*,\\s*(?!.*requireRole)',
        mitigationApplied: 'Added requireRole middleware guard and added automated integration test in test/routes',
        recurrenceCount: 1,
        feedbackScore: 1.0
      },
      {
        id: 'INC-2026-004',
        title: 'Cloud Task Queue Thundering Herd on Gemini API',
        date: '2026-06-22',
        rootCause: 'Exam deadline reached for 200 students simultaneously, firing 200 concurrent Cloud Tasks to external LLM without rate limit throttle',
        affectedLayer: 'queue',
        keywords: ['queue', 'cloud task', 'rate limit', '429', 'llm', 'gemini', 'lmstudio', 'quota'],
        failureSignature: 'cloudTasksClient\\.createTask',
        mitigationApplied: 'Configured maxConcurrentDispatches: 5 and maxDispatchesPerSecond: 2 on Cloud Tasks queue config',
        recurrenceCount: 1,
        feedbackScore: 0.85
      }
    ];

    for (const s of seeds) {
      this.patterns.set(s.id, s);
    }
  }

  public registerPattern(pattern: HistoricalFailurePattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  /**
   * Searches for historical failure patterns matching context text or keywords.
   */
  public searchPatterns(contextText: string, affectedLayer?: string): { pattern: HistoricalFailurePattern; matchScore: number; reason: string }[] {
    const matches: { pattern: HistoricalFailurePattern; matchScore: number; reason: string }[] = [];
    const lower = contextText.toLowerCase();

    for (const p of this.patterns.values()) {
      if (affectedLayer && p.affectedLayer !== affectedLayer) {
        continue;
      }

      let score = 0;
      const matchedKeywords: string[] = [];

      for (const kw of p.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          score += 1;
          matchedKeywords.push(kw);
        }
      }

      // Check regex signature if available
      try {
        const regex = new RegExp(p.failureSignature, 'i');
        if (regex.test(contextText)) {
          score += 3;
          matchedKeywords.push(`regex signature match: /${p.failureSignature}/`);
        }
      } catch {
        // Safe regex fallback
      }

      if (score >= 2) {
        const normalizedScore = Math.min(score / 5, 1.0);
        matches.push({
          pattern: p,
          matchScore: normalizedScore,
          reason: `Matched historical pattern '${p.title}' via: ${matchedKeywords.join(', ')}`
        });
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Records human feedback on pattern recommendation usefulness
   */
  public recordFeedback(patternId: string, helpful: boolean): void {
    const p = this.patterns.get(patternId);
    if (p) {
      const current = p.feedbackScore ?? 0.5;
      p.feedbackScore = helpful ? Math.min(current + 0.1, 1.0) : Math.max(current - 0.2, -1.0);
    }
  }

  public listPatterns(): HistoricalFailurePattern[] {
    return Array.from(this.patterns.values());
  }
}
