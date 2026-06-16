import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TranscriptionService } from '../src/transcription/transcription.service';

const SECRET = 'test-secret-for-e2e';

function bearer(): string {
  return `Bearer ${jwt.sign({ sub: 'user_1' }, SECRET, { algorithm: 'HS256', expiresIn: '5m' })}`;
}

describe('Transcription (e2e)', () => {
  let app: INestApplication;
  const transcribe = jest
    .fn()
    .mockResolvedValue({ text: 'raw text', language: 'ta' });
  const refine = jest.fn().mockResolvedValue('Refined: வணக்கம்');

  beforeAll(async () => {
    process.env.API_JWT_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TranscriptionService)
      .useValue({ transcribe, refine })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: jest.fn(), onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /languages includes Tamil (whisper) and Odia (gemini fallback)', async () => {
    const res = await request(app.getHttpServer())
      .get('/languages')
      .set('Authorization', bearer());
    expect(res.status).toBe(200);
    const ta = res.body.find((l: { code: string }) => l.code === 'ta');
    const or = res.body.find((l: { code: string }) => l.code === 'or');
    expect(ta).toEqual({ code: 'ta', label: 'Tamil', whisper: true });
    expect(or).toEqual({ code: 'or', label: 'Odia', whisper: false });
    expect(res.body.length).toBeGreaterThanOrEqual(30);
  });

  it('POST /transcribe requires auth', async () => {
    const res = await request(app.getHttpServer()).post('/transcribe');
    expect(res.status).toBe(401);
  });

  it('POST /transcribe transcribes + refines an uploaded clip with a language hint', async () => {
    const res = await request(app.getHttpServer())
      .post('/transcribe')
      .set('Authorization', bearer())
      .field('language', 'ta')
      .attach('audio', Buffer.from('fake-audio-bytes'), {
        filename: 'call.webm',
        contentType: 'audio/webm',
      });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ text: 'Refined: வணக்கம்', language: 'ta' });
    expect(transcribe).toHaveBeenCalled();
    expect(refine).toHaveBeenCalledWith('raw text', 'ta');
  });
});
