import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const SECRET = 'test-secret-for-e2e';
const USER_ID = 'user_123';

function bearer(): string {
  return `Bearer ${jwt.sign({ sub: USER_ID }, SECRET, { algorithm: 'HS256', expiresIn: '5m' })}`;
}

describe('Domain endpoints (e2e)', () => {
  let app: INestApplication;
  const taskUpdate = jest.fn().mockResolvedValue({ id: 't1', status: 'DONE' });
  const taskFindFirst = jest.fn().mockResolvedValue({ id: 't1' });

  beforeAll(async () => {
    process.env.API_JWT_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        task: {
          findMany: jest.fn().mockResolvedValue([{ id: 't1', title: 'Ship it' }]),
          findFirst: taskFindFirst,
          update: taskUpdate,
        },
        meeting: {
          findMany: jest.fn().mockResolvedValue([{ id: 'm1', title: 'Sync' }]),
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

  it('GET /tasks requires auth', async () => {
    const res = await request(app.getHttpServer()).get('/tasks');
    expect(res.status).toBe(401);
  });

  it('GET /tasks returns the user open tasks when authed', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks')
      .set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 't1', title: 'Ship it' }]);
  });

  it('POST /tasks/:id/done marks a task done (ownership checked)', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks/t1/done')
      .set('Authorization', bearer())
      .send({ done: true });
    expect(res.status).toBe(201);
    expect(taskFindFirst).toHaveBeenCalledWith({
      where: { id: 't1', userId: USER_ID },
      select: { id: true },
    });
    expect(taskUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'DONE' },
    });
  });

  it('GET /meetings returns the user meetings', async () => {
    const res = await request(app.getHttpServer())
      .get('/meetings')
      .set('Authorization', bearer());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'm1', title: 'Sync' }]);
  });
});
