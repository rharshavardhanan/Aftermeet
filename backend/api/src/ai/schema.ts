import { z } from 'zod';

// The contract the model must satisfy. Ported verbatim from the monolith.
export const taskSchema = z.object({
  title: z.string().min(1),
  assignee: z.string().nullable(),
  dueDate: z.string().nullable(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  confidence: z.number().min(0).max(1),
  sourceQuote: z.string().nullable(),
});

export const decisionSchema = z.object({
  decision: z.string().min(1),
  rationale: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export const deadlineSchema = z.object({
  what: z.string().min(1),
  date: z.string().nullable(),
  owner: z.string().nullable(),
});

export const riskSchema = z.object({
  risk: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

export const momSchema = z.object({
  title: z.string(),
  participants: z.array(z.string()),
  date: z.string().nullable(),
  agenda: z.array(z.string()),
  discussionSummary: z.string(),
  decisions: z.array(z.string()),
  actionItems: z.array(z.string()),
  nextMeeting: z.string().nullable(),
  notes: z.string().nullable(),
});

export const extractionSchema = z.object({
  title: z.string(),
  participants: z.array(z.string()),
  summary: z.string(),
  decisions: z.array(decisionSchema),
  actionItems: z.array(taskSchema),
  deadlines: z.array(deadlineSchema),
  risks: z.array(riskSchema),
  followupEmail: z.string(),
  mom: momSchema,
  overallConfidence: z.number().min(0).max(1),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedTask = z.infer<typeof taskSchema>;
export type Mom = z.infer<typeof momSchema>;

// JSON Schema handed to the model via response_format. Kept in sync with zod.
export const extractionJsonSchema = {
  name: 'meeting_extraction',
  strict: false,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'title',
      'participants',
      'summary',
      'decisions',
      'actionItems',
      'deadlines',
      'risks',
      'followupEmail',
      'mom',
      'overallConfidence',
    ],
    properties: {
      title: { type: 'string' },
      participants: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' },
      decisions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['decision', 'rationale', 'confidence'],
          properties: {
            decision: { type: 'string' },
            rationale: { type: ['string', 'null'] },
            confidence: { type: 'number' },
          },
        },
      },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'assignee', 'dueDate', 'urgency', 'confidence', 'sourceQuote'],
          properties: {
            title: { type: 'string' },
            assignee: { type: ['string', 'null'] },
            dueDate: { type: ['string', 'null'] },
            urgency: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
            confidence: { type: 'number' },
            sourceQuote: { type: ['string', 'null'] },
          },
        },
      },
      deadlines: {
        type: 'array',
        items: {
          type: 'object',
          required: ['what', 'date', 'owner'],
          properties: {
            what: { type: 'string' },
            date: { type: ['string', 'null'] },
            owner: { type: ['string', 'null'] },
          },
        },
      },
      risks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['risk', 'severity'],
          properties: {
            risk: { type: 'string' },
            severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          },
        },
      },
      followupEmail: { type: 'string' },
      mom: {
        type: 'object',
        required: [
          'title',
          'participants',
          'date',
          'agenda',
          'discussionSummary',
          'decisions',
          'actionItems',
          'nextMeeting',
          'notes',
        ],
        properties: {
          title: { type: 'string' },
          participants: { type: 'array', items: { type: 'string' } },
          date: { type: ['string', 'null'] },
          agenda: { type: 'array', items: { type: 'string' } },
          discussionSummary: { type: 'string' },
          decisions: { type: 'array', items: { type: 'string' } },
          actionItems: { type: 'array', items: { type: 'string' } },
          nextMeeting: { type: ['string', 'null'] },
          notes: { type: ['string', 'null'] },
        },
      },
      overallConfidence: { type: 'number' },
    },
  },
} as const;
