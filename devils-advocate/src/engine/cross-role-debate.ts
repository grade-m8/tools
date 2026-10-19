import type { CrossRoleDebate, RolePerspective } from '../types/schemas.ts';

export class CrossRoleDebateEngine {
  /**
   * Generates a multi-perspective cross-role debate around a technical or product decision.
   */
  public debateDecision(topic: string, contextDescription: string): CrossRoleDebate {
    const lower = `${topic} ${contextDescription}`.toLowerCase();

    const devPerspective: RolePerspective = {
      role: 'Developer',
      stance: lower.includes('quick') || lower.includes('workaround')
        ? 'Resistant to hasty shortcuts; demands clear types and clean separation of concerns.'
        : 'Focused on clean implementation, low cognitive load, and deterministic error handling.',
      keyConcerns: [
        'How much boilerplate and cognitive overhead does this add to daily work?',
        'Are error boundaries and database transaction failures explicitly handled without hanging requests?',
        'Can this be written without violating the 4-layer backend architecture (routes/controllers/services/repos)?'
      ],
      proposedMitigation: 'Implement typed repository interfaces with Zod schemas at controller boundary; keep business logic strictly in service layer.',
      acceptableTradeOffs: ['Slightly more initial boilerplate in exchange for bulletproof typing and zero runtime DB leaks.']
    };

    const qaPerspective: RolePerspective = {
      role: 'QA Engineer',
      stance: 'Deeply skeptical of "happy path" assumptions; demands testability and deterministic reproducer harnesses.',
      keyConcerns: [
        'How will we test this without spinning up external cloud services or emulators during unit testing?',
        'What happens under network timeouts, duplicate event delivery, or partial failure midway through execution?',
        'Where are the edge-case test suites for empty inputs, concurrent submissions, and permission denials?'
      ],
      proposedMitigation: 'Provide deterministic mock factories and unit tests verifying edge states; ensure test runs complete in <10s locally.',
      acceptableTradeOffs: ['Deferring end-to-end browser tests for v1 as long as service/repository unit tests achieve 100% boundary coverage.']
    };

    const techLeadPerspective: RolePerspective = {
      role: 'Tech Lead / Architect',
      stance: 'Guarding long-term architectural integrity, non-functional requirements, and preventing architectural drift from wiki/10-grade-m8-architecture.md.',
      keyConcerns: [
        'Does this introduce hidden coupling between frontend and backend, or violate Firestore indexing limits?',
        'Are we violating the rule that analysisItems must be immutable audit trails superseded only by teacher edits?',
        'Is this backward-compatible with ongoing sessions, or does it require coordinated downtime?'
      ],
      proposedMitigation: 'Enforce transactional consistency in Firestore; verify against firestore.indexes.json and wiki architecture guidelines.',
      acceptableTradeOffs: ['Rejecting premature caching or global state libraries in favor of simple, predictable request-response cycles.']
    };

    const productOwnerPerspective: RolePerspective = {
      role: 'Product Owner',
      stance: 'Advocating for student and professor user experience, clarity of feedback, and minimal friction during high-stakes exams.',
      keyConcerns: [
        'If a grading worker takes 45 seconds or fails, what does the student see on their screen?',
        'Can a student accidentally submit an incomplete exam without a confirmation modal warning them?',
        'Does this change cause professors to lose grades or feedback they painstakingly typed?'
      ],
      proposedMitigation: 'Provide clear intermediate UI states (e.g. "Grading in progress... you will receive an alert") and safeguard manual teacher inputs.',
      acceptableTradeOffs: ['Accepting an asynchronous completion delay in exchange for zero lost student answers.']
    };

    const projectManagerPerspective: RolePerspective = {
      role: 'Project Manager',
      stance: 'Focused on delivery commitments, external dependency availability, blocker mitigation, and milestone risk.',
      keyConcerns: [
        'Does this change depend on unmerged PRs or external cloud infrastructure that could blow past the release sprint?',
        'What is the blast radius if this fails in staging — will it block other devs from testing?',
        'Have we budgeted time for bug remediation if testing reveals concurrency flaws?'
      ],
      proposedMitigation: 'Feature-flag or stage the rollout; verify rollback procedures before merging to dev/main.',
      acceptableTradeOffs: ['Scoping down non-essential bells and whistles to lock down core reliability on time.']
    };

    // Determine consensus and friction points
    const consensusPoints: string[] = [
      'Unanimous agreement that student submissions and grading data must never be permanently lost or silently corrupted.',
      'Agreement that backend must enforce security and transactional validation rather than relying on frontend checks.',
      'Agreement that automated unit tests must verify error recovery paths before promotion.'
    ];

    const frictionPoints: string[] = [
      'Dev vs. PM: Developer wants additional refactoring for architectural purity, while PM is concerned about sprint deadline slippage.',
      'QA vs. PO: QA insists on handling obscure distributed network split scenarios before launch; PO prefers shipping to beta users to validate core usability.',
      'Tech Lead vs. Dev: Tech Lead forbids direct Firestore queries in services; Dev argues it would save 20 lines of code today.'
    ];

    const requiredEvidenceToDecide: string[] = [
      'Benchmark latency and failure rate of LMStudio/Gemini inference under simulated 20-student concurrent load.',
      'Verify whether Cloud Tasks emulator behaves identically to Google Cloud production queue during retry storms.',
      'Formal acceptance criteria sign-off on timeout behavior from Product Owner.'
    ];

    return {
      topic,
      perspectives: [
        devPerspective,
        qaPerspective,
        techLeadPerspective,
        productOwnerPerspective,
        projectManagerPerspective
      ],
      consensusPoints,
      frictionPoints,
      requiredEvidenceToDecide
    };
  }
}
