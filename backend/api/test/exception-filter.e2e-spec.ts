import {
  Controller,
  Get,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';

@Controller('boom')
class BoomController {
  @Get()
  boom() {
    throw new NotFoundException('nope');
  }
}

describe('HttpExceptionFilter (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BoomController],
      providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('formats errors as { error, statusCode }', async () => {
    const res = await request(app.getHttpServer()).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'nope', statusCode: 404 });
  });
});
