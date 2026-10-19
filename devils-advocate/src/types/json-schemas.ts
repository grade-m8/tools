/**
 * JSON Schema Definitions for Devil's Advocate
 * Conforms to JSON Schema Draft 7 / 2020-12
 */

export const FindingJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Finding',
  type: 'object',
  required: [
    'id',
    'title',
    'classification',
    'severity',
    'severityRationale',
    'confidence',
    'confidenceLabel',
    'affectedAreas',
    'evidence',
    'failureScenario',
    'recommendedMitigation',
    'suggestedOwner',
    'uncertaintyAndLimitations',
    'verificationStatus',
    'compositeRiskScore'
  ],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    classification: {
      type: 'string',
      enum: [
        'Confirmed Defect',
        'Evidence-Backed Risk',
        'Unverified Hypothesis',
        'Requirement Ambiguity',
        'Missing Validation',
        'No Issue Found'
      ]
    },
    severity: {
      type: 'string',
      enum: ['Critical', 'High', 'Medium', 'Low']
    },
    severityRationale: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    confidenceLabel: {
      type: 'string',
      enum: ['Confirmed', 'High', 'Medium', 'Low']
    },
    affectedAreas: {
      type: 'array',
      items: { type: 'string' }
    },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'sourceType', 'location', 'relevance'],
        properties: {
          id: { type: 'string' },
          sourceType: {
            type: 'string',
            enum: ['code', 'requirement', 'architecture_doc', 'test_result', 'incident_history', 'git_diff']
          },
          location: { type: 'string' },
          snippet: { type: 'string' },
          relevance: { type: 'string' }
        }
      }
    },
    failureScenario: { type: 'string' },
    reproductionSteps: { type: 'string' },
    recommendedMitigation: { type: 'string' },
    suggestedOwner: {
      type: 'string',
      enum: ['backend-dev', 'frontend-dev', 'qa-engineer', 'tech-lead', 'product-owner', 'project-manager']
    },
    uncertaintyAndLimitations: { type: 'string' },
    verificationStatus: {
      type: 'string',
      enum: ['Reproduced', 'Disproved', 'Partially Investigated', 'Not Tested']
    },
    compositeRiskScore: { type: 'number', minimum: 0, maximum: 1 }
  }
} as const;

export const AssumptionJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Assumption',
  type: 'object',
  required: [
    'id',
    'description',
    'source',
    'confidence',
    'affectedComponents',
    'validationStatus',
    'impactIfFalse',
    'invalidationEvents',
    'createdAt',
    'updatedAt'
  ],
  properties: {
    id: { type: 'string' },
    description: { type: 'string' },
    source: { type: 'string' },
    ownerRole: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    affectedComponents: {
      type: 'array',
      items: { type: 'string' }
    },
    validationStatus: {
      type: 'string',
      enum: ['Validated', 'Unverified', 'Challenged', 'Invalidated']
    },
    impactIfFalse: {
      type: 'string',
      enum: ['Catastrophic', 'Major', 'Moderate', 'Minor']
    },
    invalidationEvents: {
      type: 'array',
      items: { type: 'string' }
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
} as const;

export const RiskAssessmentJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'RiskAssessment',
  type: 'object',
  required: [
    'assessmentId',
    'mode',
    'target',
    'overallRiskLevel',
    'findings',
    'assumptionsAudited',
    'executiveSummary',
    'actionableRecommendations',
    'generatedAt'
  ],
  properties: {
    assessmentId: { type: 'string' },
    mode: {
      type: 'string',
      enum: ['PullRequest', 'Requirement', 'Sprint', 'Release', 'Incident', 'OnDemand']
    },
    target: { type: 'string' },
    overallRiskLevel: {
      type: 'string',
      enum: ['Critical', 'High', 'Medium', 'Low']
    },
    findings: {
      type: 'array',
      items: FindingJsonSchema
    },
    assumptionsAudited: {
      type: 'array',
      items: AssumptionJsonSchema
    },
    executiveSummary: { type: 'string' },
    actionableRecommendations: {
      type: 'array',
      items: { type: 'string' }
    },
    generatedAt: { type: 'string', format: 'date-time' }
  }
} as const;
