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
  // The service now owns the whole pipeline (chunk -> transcribe -> refine)
  // and returns the final text. No language is ever passed in.
  const transcribe = jest
    .fn()
    .mockResolvedValue({ text: 'Speaker 1: வணக்கம், let us start the sync.', language: null });

  beforeAll(async () => {
    process.env.API_JWT_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TranscriptionService)
      .useValue({ transcribe })
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

  it('POST /transcribe requires auth', async () => {
    const res = await request(app.getHttpServer()).post('/transcribe');
    expect(res.status).toBe(401);
  });

  it('POST /transcribe transcribes an uploaded clip automatically (no language hint)', async () => {
    const res = await request(app.getHttpServer())
      .post('/transcribe')
      .set('Authorization', bearer())
      .attach('audio', Buffer.from('fake-audio-bytes'), {
        filename: 'call.webm',
        contentType: 'audio/webm',
      });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      text: 'Speaker 1: வணக்கம், let us start the sync.',
      language: null,
    });
    // Service is called with a file path + mimetype — never a language.
    expect(transcribe).toHaveBeenCalledTimes(1);
    const args = transcribe.mock.calls[0];
    expect(typeof args[0]).toBe('string'); // disk path
    expect(args[1]).toBe('audio/webm');
    expect(args).toHaveLength(2);
  });
});
