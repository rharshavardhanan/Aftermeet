import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const SECRET = 'test-secret-for-e2e';
const bearer = () =>
  `Bearer ${jwt.sign({ sub: 'user_1' }, SECRET, { algorithm: 'HS256', expiresIn: '5m' })}`;

describe('Extension (e2e)', () => {
  let app: INestApplication;
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });

  beforeAll(async () => {
    process.env.API_JWT_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        extensionSession: {
          findFirst: jest.fn().mockResolvedValue(null),
          updateMany,
          create: jest.fn(),
          update: jest.fn(),
        },
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

  it('GET /extension/session requires auth', async () => {
    const res = await request(app.getHttpServer()).get('/extension/session');
    expect(res.status).toBe(401);
  });

  it('GET /extension/session reports not-connected with no active session', async () => {
    const res = await request(app.getHttpServer())
      .get('/extension/session')
      .set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: false, session: null });
  });

  it('POST /extension/session end marks sessions ended', async () => {
    const res = await request(app.getHttpServer())
      .post('/extension/session')
      .set('Authorization', bearer())
      .send({ action: 'end', platform: 'meet' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, connected: false });
    expect(updateMany).toHaveBeenCalled();
  });
});
