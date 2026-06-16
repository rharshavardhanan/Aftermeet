import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ExtractionService } from '../src/ai/extraction.service';

const SECRET = 'test-secret-for-e2e';
const USER_ID = 'user_123';

function bearer(): string {
  return `Bearer ${jwt.sign({ sub: USER_ID }, SECRET, { algorithm: 'HS256', expiresIn: '5m' })}`;
}

const EXTRACTION = {
  title: 'Q3 sync',
  participants: ['Ada'],
  summary: 'We locked the date.',
  decisions: [],
  actionItems: [
    {
      title: 'Send the deck',
      assignee: 'Ada',
      dueDate: null,
      urgency: 'MEDIUM' as const,
      confidence: 0.9,
      sourceQuote: 'Ada will send the deck',
    },
  ],
  deadlines: [],
  risks: [],
  followupEmail: 'Hi team, ...',
  mom: {
    title: 'Q3 sync',
    participants: ['Ada'],
    date: '2026-06-16',
    agenda: [],
    discussionSummary: 'x',
    decisions: [],
    actionItems: [],
    nextMeeting: null,
    notes: null,
  },
  overallConfidence: 0.9,
};

describe('Meetings process (e2e)', () => {
  let app: INestApplication;
  const meetingCreate = jest.fn().mockResolvedValue({ id: 'm1' });
  const taskCreateMany = jest.fn().mockResolvedValue({ count: 1 });
  const billingUpdate = jest.fn().mockResolvedValue({});
  const activityCreate = jest.fn().mockResolvedValue({});

  beforeAll(async () => {
    process.env.API_JWT_SECRET = SECRET;
    const tx = {
      meeting: { create: meetingCreate },
      task: { createMany: taskCreateMany },
      billing: { update: billingUpdate },
      activityLog: { create: activityCreate },
    };
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ExtractionService)
      .useValue({
        extract: jest
          .fn()
          .mockResolvedValue({ data: EXTRACTION, model: 'gemini', tokensUsed: 10 }),
      })
      .overrideProvider(PrismaService)
      .useValue({
        membership: {
          findFirst: jest.fn().mockResolvedValue({
            workspace: {
              id: 'ws1',
              billing: { id: 'b1', plan: 'FREE', meetingsUsed: 0, meetingsLimit: 10 },
            },
          }),
        },
        userPreference: { findUnique: jest.fn().mockResolvedValue({ priority: 'tasks' }) },
        $transaction: jest.fn().mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx)),
        $queryRaw: jest.fn(),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a too-short transcript with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', bearer())
      .send({ transcript: 'too short' });
    expect(res.status).toBe(400);
  });

  it('processes a transcript and persists a meeting + tasks', async () => {
    const res = await request(app.getHttpServer())
      .post('/meetings')
      .set('Authorization', bearer())
      .send({ title: 'Q3', transcript: 'This is a sufficiently long transcript to analyze.' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ meetingId: 'm1' });
    expect(meetingCreate).toHaveBeenCalled();
    expect(taskCreateMany).toHaveBeenCalled();
    expect(billingUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { meetingsUsed: { increment: 1 } },
    });
  });
});
