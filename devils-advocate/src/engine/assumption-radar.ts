import type { Assumption, AssumptionStatus, AssumptionImpact } from '../types/schemas.ts';

export class AssumptionRadar {
  private registry: Map<string, Assumption> = new Map();

  constructor(initialAssumptions?: Assumption[]) {
    if (initialAssumptions && initialAssumptions.length > 0) {
      for (const a of initialAssumptions) {
        this.registry.set(a.id, a);
      }
    } else {
      this.loadDefaultGradeM8Assumptions();
    }
  }

  private loadDefaultGradeM8Assumptions(): void {
    const defaults: Omit<Assumption, 'createdAt' | 'updatedAt'>[] = [
      {
        id: 'ASM-001',
        description: 'Cloud Tasks delivery is at-least-once, requiring all grading handlers to be strictly idempotent.',
        source: 'wiki/10-grade-m8-architecture.md#grading-pipeline',
        ownerRole: 'backend-dev',
        confidence: 0.95,
        affectedComponents: ['functions/src/services/gradingService.ts', 'Cloud Tasks queue'],
        validationStatus: 'Validated',
        impactIfFalse: 'Catastrophic',
        invalidationEvents: ['Duplicate grading job causes multiple score overwrites', 'Non-idempotent counter increments']
      },
      {
        id: 'ASM-002',
        description: 'AI-generated analysis items are immutable historical records; teacher edits must create new supersede records rather than mutating existing AI rows.',
        source: 'wiki/10-grade-m8-architecture.md#analysisItems',
        ownerRole: 'backend-dev',
        confidence: 0.9,
        affectedComponents: ['functions/src/repositories/evaluationRepository.ts', 'analysisItems collection'],
        validationStatus: 'Validated',
        impactIfFalse: 'Major',
        invalidationEvents: ['Direct updateDoc on analysisItem with source=ai', 'Loss of pedagogical audit trail']
      },
      {
        id: 'ASM-003',
        description: 'Only repositories may invoke the Firebase Admin Firestore SDK; controllers and services must remain completely decoupled from DB queries.',
        source: 'wiki/03-databases-and-firestore.md#layering',
        ownerRole: 'tech-lead',
        confidence: 0.95,
        affectedComponents: ['backend/controllers', 'backend/services', 'backend/repositories'],
        validationStatus: 'Validated',
        impactIfFalse: 'Major',
        invalidationEvents: ['Service directly calling db.collection()', 'Controller querying Firestore']
      },
      {
        id: 'ASM-004',
        description: 'Frontend role guards in React routes are UI convenience only and must be strictly re-validated on every backend endpoint via custom claims.',
        source: 'wiki/04-auth-and-roles.md#double-gating',
        ownerRole: 'tech-lead',
        confidence: 0.98,
        affectedComponents: ['ProtectedRoutes.tsx', 'functions/src/middlewares/authMiddleware.ts'],
        validationStatus: 'Validated',
        impactIfFalse: 'Catastrophic',
        invalidationEvents: ['Backend endpoint missing requireRole middleware', 'Unchecked token claims']
      },
      {
        id: 'ASM-005',
        description: 'Database schema changes in Firestore are strictly additive to support rolling deployments without downtime or broken legacy clients.',
        source: 'wiki/09-deployment-environments.md#migrations',
        ownerRole: 'tech-lead',
        confidence: 0.85,
        affectedComponents: ['firestore.indexes.json', 'data models'],
        validationStatus: 'Validated',
        impactIfFalse: 'Major',
        invalidationEvents: ['Renaming fields without migration fallback', 'Dropping collection without backward compatibility']
      }
    ];

    const now = new Date().toISOString();
    for (const d of defaults) {
      this.registry.set(d.id, { ...d, createdAt: now, updatedAt: now });
    }
  }

  public registerAssumption(data: Omit<Assumption, 'id' | 'createdAt' | 'updatedAt'>): Assumption {
    const id = `ASM-${String(this.registry.size + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();
    const assumption: Assumption = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.registry.set(id, assumption);
    return assumption;
  }

  public getAssumption(id: string): Assumption | undefined {
    return this.registry.get(id);
  }

  public listAssumptions(filter?: { status?: AssumptionStatus; component?: string }): Assumption[] {
    let list = Array.from(this.registry.values());
    if (filter?.status) {
      list = list.filter(a => a.validationStatus === filter.status);
    }
    if (filter?.component) {
      list = list.filter(a => a.affectedComponents.some(c => c.toLowerCase().includes(filter.component!.toLowerCase())));
    }
    return list;
  }

  public updateStatus(id: string, status: AssumptionStatus, reason: string): Assumption {
    const assumption = this.registry.get(id);
    if (!assumption) {
      throw new Error(`Assumption with ID ${id} not found.`);
    }
    assumption.validationStatus = status;
    assumption.updatedAt = new Date().toISOString();
    assumption.invalidationEvents.push(`[${new Date().toISOString()}] Status changed to ${status}: ${reason}`);
    this.registry.set(id, assumption);
    return assumption;
  }

  public auditAssumptionsAgainstContext(
    contextText: string,
    touchedFiles: string[] = []
  ): { challenged: Assumption[]; invalidated: Assumption[]; intact: Assumption[] } {
    const challenged: Assumption[] = [];
    const invalidated: Assumption[] = [];
    const intact: Assumption[] = [];

    const lowerContext = contextText.toLowerCase();

    for (const assumption of this.registry.values()) {
      let isChallenged = false;
      let isInvalidated = false;

      // 1. Direct component touch
      const touchesComponent = touchedFiles.some(file =>
        assumption.affectedComponents.some(comp => file.toLowerCase().includes(comp.toLowerCase()))
      );

      // 2. Specific heuristic triggers
      if (assumption.id === 'ASM-001') {
        // Concurrency / idempotency
        if (
          lowerContext.includes('retry') ||
          lowerContext.includes('cloud task') ||
          lowerContext.includes('queue') ||
          lowerContext.includes('double click') ||
          lowerContext.includes('increment(') ||
          lowerContext.includes('concurrent')
        ) {
          if (lowerContext.includes('without transaction') || lowerContext.includes('non-idempotent') || lowerContext.includes('overwrite')) {
            isInvalidated = true;
          } else {
            isChallenged = true;
          }
        }
      } else if (assumption.id === 'ASM-002') {
        // AI item mutation
        if (
          (lowerContext.includes('analysisitem') || lowerContext.includes('analysis_items')) &&
          (lowerContext.includes('update(') || lowerContext.includes('deleted') || lowerContext.includes('remove') || lowerContext.includes('patch'))
        ) {
          if (lowerContext.includes('source: "ai"') || lowerContext.includes("source: 'ai'") || lowerContext.includes('overwrite ai')) {
            isInvalidated = true;
          } else {
            isChallenged = true;
          }
        }
      } else if (assumption.id === 'ASM-003') {
        // DB access layering
        if (
          (lowerContext.includes('controller') || lowerContext.includes('service')) &&
          (lowerContext.includes('firestore') || lowerContext.includes('getdoc') || lowerContext.includes('db.collection'))
        ) {
          isInvalidated = true;
        }
      } else if (assumption.id === 'ASM-004') {
        // Role gating
        if (
          lowerContext.includes('route') &&
          !lowerContext.includes('requirerole') &&
          !lowerContext.includes('authenticate') &&
          touchesComponent
        ) {
          isChallenged = true;
        }
      } else if (assumption.id === 'ASM-005') {
        // Backward compatibility
        if (
          lowerContext.includes('drop column') ||
          lowerContext.includes('rename') ||
          lowerContext.includes('delete field') ||
          lowerContext.includes('breaking migration')
        ) {
          isInvalidated = true;
        }
      }

      if (isInvalidated) {
        invalidated.push(assumption);
      } else if (isChallenged || touchesComponent) {
        challenged.push(assumption);
      } else {
        intact.push(assumption);
      }
    }

    return { challenged, invalidated, intact };
  }

  public exportRegistry(): Assumption[] {
    return Array.from(this.registry.values());
  }
}
