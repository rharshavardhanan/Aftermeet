import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const SECRET = 'test-secret-for-e2e';
const USER = {
  id: 'user_123',
  name: 'Ada',
  email: 'ada@example.com',
  image: null,
  onboardingCompleted: true,
};

function token(payload: object, secret = SECRET): string {
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '5m' });
}

describe('Users /me (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.API_JWT_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: { findUnique: jest.fn().mockResolvedValue(USER) },
        $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the profile for a valid bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token({ sub: USER.id, email: USER.email })}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(USER);
  });

  it('401s when no token is provided', async () => {
    const res = await request(app.getHttpServer()).get('/me');
    expect(res.status).toBe(401);
  });

  it('401s for a token signed with the wrong secret', async () => {
    const res = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token({ sub: USER.id }, 'wrong-secret')}`);
    expect(res.status).toBe(401);
  });
});
