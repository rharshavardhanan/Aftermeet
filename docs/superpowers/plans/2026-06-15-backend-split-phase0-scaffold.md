# Backend Split — Phase 0: Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a deployable NestJS backend (`backend/api/`) wired to the existing Supabase Postgres via the existing Prisma schema, with a health endpoint, global validation + error handling + CORS, and give the Next.js frontend an `NEXT_PUBLIC_API_BASE_URL` it can reach — all with **zero behavior change** to the current app.

**Architecture:** A new NestJS app lives at `backend/api/`, reusing the existing `backend/prisma/schema.prisma` (no schema changes in this phase). It exposes `GET /health` (process + DB check). Global `ValidationPipe`, an exception filter for consistent JSON errors, and a CORS allow-list are configured up front. The monolith at `frontend/web/` keeps working unchanged; it only gains an env var and a tiny typed health-check client used by a test. This is the strangler foundation — no monolith endpoints are moved yet.

**Tech Stack:** NestJS 11, TypeScript, Prisma 6 (`@prisma/client`), Jest + supertest, `@nestjs/config`, `class-validator`/`class-transformer`. Node 20.18.0. npm.

**Reference spec:** `docs/superpowers/specs/2026-06-15-frontend-backend-split-design.md`

---

## File structure (created/modified this phase)

```
backend/api/                         ← NEW NestJS app
  package.json                       app deps + scripts (prisma schema -> ../prisma)
  tsconfig.json                      TS config
  tsconfig.build.json                build-only TS config
  nest-cli.json                      Nest CLI config
  .env.example                       DATABASE_URL/DIRECT_URL/PORT/CORS_ORIGINS
  .gitignore                         node_modules, dist, .env
  src/
    main.ts                          bootstrap: CORS, ValidationPipe, port
    app.module.ts                    root module (Config, Prisma, Health)
    common/
      http-exception.filter.ts       global filter -> { error, statusCode }
    prisma/
      prisma.module.ts               global PrismaModule
      prisma.service.ts              PrismaClient lifecycle (connect/disconnect)
    health/
      health.module.ts
      health.controller.ts           GET /health
      health.service.ts              SELECT 1 DB check
  test/
    health.e2e-spec.ts               supertest: GET /health -> 200
    jest-e2e.json                    e2e jest config
frontend/web/
  .env.example                       + NEXT_PUBLIC_API_BASE_URL (MODIFY)
  lib/api-client.ts                  NEW: tiny typed fetch wrapper (health only for now)
  lib/__tests__/api-client.test.ts   NEW: unit test for the wrapper
render.yaml                          + second service: aftermeet-api (MODIFY)
ARCHITECTURE.md                      note the backend service exists (MODIFY, end of phase)
```

---

## Task 1: Scaffold the NestJS project skeleton

**Files:**
- Create: `backend/api/package.json`
- Create: `backend/api/tsconfig.json`
- Create: `backend/api/tsconfig.build.json`
- Create: `backend/api/nest-cli.json`
- Create: `backend/api/.gitignore`
- Create: `backend/api/.env.example`

- [ ] **Step 1: Create `backend/api/package.json`**

```json
{
  "name": "aftermeet-api",
  "version": "0.1.0",
  "private": true,
  "description": "Aftermeet backend API (NestJS).",
  "prisma": {
    "schema": "../prisma/schema.prisma"
  },
  "scripts": {
    "build": "prisma generate && nest build",
    "start": "node dist/main.js",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main.js",
    "postinstall": "prisma generate",
    "db:generate": "prisma generate",
    "lint": "eslint \"{src,test}/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@prisma/client": "^6.1.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.5",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "prisma": "^6.1.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Create `backend/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 3: Create `backend/api/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

- [ ] **Step 4: Create `backend/api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create `backend/api/.gitignore`**

```gitignore
node_modules
dist
.env
*.log
```

- [ ] **Step 6: Create `backend/api/.env.example`**

```bash
# Backend API (NestJS) — copy to .env and fill in.
PORT=4001

# Database (Supabase Postgres) — same values as frontend/web/.env
DATABASE_URL=
DIRECT_URL=

# Comma-separated CORS allow-list (frontend origin + meeting hosts).
# meet.google.com and *.zoom.us are always allowed by pattern in code.
CORS_ORIGINS=http://localhost:4000
```

- [ ] **Step 7: Install dependencies**

Run: `cd backend/api && npm install`
Expected: installs without error; `node_modules/` and `package-lock.json` created. (`postinstall` runs `prisma generate`; it may warn that no client is generated yet until Task 2 sets the schema path — the `prisma` field in `package.json` points it at `../prisma/schema.prisma`, so it should succeed and generate the client.)

- [ ] **Step 8: Commit**

```bash
cd /Users/harshavardhanan/meeting-to-tasks
git add backend/api/package.json backend/api/package-lock.json backend/api/tsconfig.json backend/api/tsconfig.build.json backend/api/nest-cli.json backend/api/.gitignore backend/api/.env.example
git commit -m "chore(api): scaffold NestJS project skeleton"
```

---

## Task 2: PrismaModule + PrismaService (reuse existing schema)

**Files:**
- Create: `backend/api/src/prisma/prisma.service.ts`
- Create: `backend/api/src/prisma/prisma.module.ts`
- Test: covered indirectly by the health e2e in Task 3 (DB connectivity).

- [ ] **Step 1: Create `backend/api/src/prisma/prisma.service.ts`**

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Create `backend/api/src/prisma/prisma.module.ts`**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Verify the Prisma client is generated against the shared schema**

Run: `cd backend/api && npm run db:generate`
Expected: "Generated Prisma Client" referencing `../prisma/schema.prisma`. If it errors that the schema is not found, confirm the `prisma.schema` field in `package.json` is `../prisma/schema.prisma`.

- [ ] **Step 4: Commit**

```bash
cd /Users/harshavardhanan/meeting-to-tasks
git add backend/api/src/prisma/prisma.service.ts backend/api/src/prisma/prisma.module.ts
git commit -m "feat(api): add global PrismaModule reusing shared schema"
```

---

## Task 3: Health module (process + DB check) — TDD

**Files:**
- Create: `backend/api/src/health/health.service.ts`
- Create: `backend/api/src/health/health.controller.ts`
- Create: `backend/api/src/health/health.module.ts`
- Create: `backend/api/src/app.module.ts`
- Create: `backend/api/src/main.ts`
- Create: `backend/api/test/jest-e2e.json`
- Test: `backend/api/test/health.e2e-spec.ts`

- [ ] **Step 1: Create the e2e Jest config `backend/api/test/jest-e2e.json`**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

- [ ] **Step 2: Write the failing e2e test `backend/api/test/health.e2e-spec.ts`**

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Stub the DB check so the test does not require a live database.
      .overrideProvider(PrismaService)
      .useValue({
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

  it('GET /health returns 200 with status ok and db up', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });
});
```

- [ ] **Step 3: Create `backend/api/src/health/health.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{ status: 'ok'; db: 'up' | 'down' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch {
      return { status: 'ok', db: 'down' };
    }
  }
}
```

- [ ] **Step 4: Create `backend/api/src/health/health.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check() {
    return this.health.check();
  }
}
```

- [ ] **Step 5: Create `backend/api/src/health/health.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
```

- [ ] **Step 6: Create `backend/api/src/app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 7: Create `backend/api/src/main.ts`** (bootstrap with CORS + validation; exception filter wired in Task 4)

```ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function parseCorsOrigins(): (string | RegExp)[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Meeting hosts the extension runs on are always allowed.
  return [...fromEnv, /^https:\/\/meet\.google\.com$/, /^https:\/\/[\w-]+\.zoom\.us$/];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: parseCorsOrigins(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  const port = Number(process.env.PORT ?? 4001);
  await app.listen(port);
}
void bootstrap();
```

- [ ] **Step 8: Run the e2e test to verify it passes**

Run: `cd backend/api && npm run test:e2e -- health`
Expected: PASS — `GET /health returns 200 with status ok and db up`.

- [ ] **Step 9: Smoke-run the server against the real DB (manual)**

Run: `cd backend/api && cp .env.example .env` then fill `DATABASE_URL`/`DIRECT_URL` (copy from `frontend/web/.env`), then `npm run build && PORT=4001 npm run start` and in another shell `curl -s localhost:4001/health`.
Expected: `{"status":"ok","db":"up"}`. Stop the server after verifying.

- [ ] **Step 10: Commit**

```bash
cd /Users/harshavardhanan/meeting-to-tasks
git add backend/api/src/health backend/api/src/app.module.ts backend/api/src/main.ts backend/api/test/health.e2e-spec.ts backend/api/test/jest-e2e.json
git commit -m "feat(api): add health endpoint with DB check (e2e tested)"
```

---

## Task 4: Global exception filter for consistent JSON errors — TDD

**Files:**
- Create: `backend/api/src/common/http-exception.filter.ts`
- Modify: `backend/api/src/main.ts` (register the filter globally)
- Test: `backend/api/test/exception-filter.e2e-spec.ts`

- [ ] **Step 1: Write the failing e2e test `backend/api/test/exception-filter.e2e-spec.ts`**

```ts
import { Controller, Get, INestApplication, NotFoundException } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend/api && npm run test:e2e -- exception-filter`
Expected: FAIL — cannot find module `../src/common/http-exception.filter`.

- [ ] **Step 3: Create `backend/api/src/common/http-exception.filter.ts`**

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let error = 'Internal server error';
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        error = body;
      } else if (body && typeof body === 'object' && 'message' in body) {
        const message = (body as { message: string | string[] }).message;
        error = Array.isArray(message) ? message.join('; ') : message;
      }
    } else {
      this.logger.error(exception);
    }

    res.status(status).json({ error, statusCode: status });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend/api && npm run test:e2e -- exception-filter`
Expected: PASS.

- [ ] **Step 5: Register the filter globally — modify `backend/api/src/main.ts`**

Add the import at the top:

```ts
import { HttpExceptionFilter } from './common/http-exception.filter';
```

And register it immediately after `app.useGlobalPipes(...)` in `bootstrap()`:

```ts
  app.useGlobalFilters(new HttpExceptionFilter());
```

- [ ] **Step 6: Run the full e2e suite to confirm nothing regressed**

Run: `cd backend/api && npm run test:e2e`
Expected: PASS — both `health` and `exception-filter` suites green.

- [ ] **Step 7: Commit**

```bash
cd /Users/harshavardhanan/meeting-to-tasks
git add backend/api/src/common/http-exception.filter.ts backend/api/src/main.ts backend/api/test/exception-filter.e2e-spec.ts
git commit -m "feat(api): add global exception filter for consistent JSON errors"
```

---

## Task 5: Add the backend as a second Render service

**Files:**
- Modify: `render.yaml` (append a second `web` service `aftermeet-api`)

- [ ] **Step 1: Append the backend service to `render.yaml`**

Add this entry under the existing `services:` list (after the `aftermeet` service block):

```yaml
  - type: web
    name: aftermeet-api
    runtime: node
    plan: free
    region: oregon
    rootDir: backend/api
    buildCommand: npm install && npm run build
    startCommand: npm run start:prod
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: "20.18.0"
      - key: PORT
        value: "4001"
      - key: DATABASE_URL
        sync: false
      - key: DIRECT_URL
        sync: false
      - key: CORS_ORIGINS # set to your Vercel frontend origin once deployed
        sync: false
```

- [ ] **Step 2: Validate YAML parses**

Run: `cd /Users/harshavardhanan/meeting-to-tasks && node -e "const f=require('fs').readFileSync('render.yaml','utf8'); console.log('services:', (f.match(/- type: web/g)||[]).length)"`
Expected: `services: 2`.

- [ ] **Step 3: Commit**

```bash
cd /Users/harshavardhanan/meeting-to-tasks
git add render.yaml
git commit -m "chore(deploy): add aftermeet-api backend service to render blueprint"
```

---

## Task 6: Wire the frontend with an API base URL + typed health client — TDD

**Files:**
- Modify: `frontend/web/.env.example` (add `NEXT_PUBLIC_API_BASE_URL`)
- Create: `frontend/web/lib/api-client.ts`
- Test: `frontend/web/lib/__tests__/api-client.test.ts`

> Note: the frontend has no test runner configured yet. This task adds a single
> dependency-free test runnable with Node's built-in test runner, so we do not
> introduce Jest into the Next.js app in this phase.

- [ ] **Step 1: Add the env var to `frontend/web/.env.example`**

Append under a new section at the end of the file:

```bash
# ── Backend API (Phase 0 split) ─────────────────────────────────
# Base URL of the NestJS backend. Local dev: http://localhost:4001
# Deployed: your Render backend URL, e.g. https://aftermeet-api.onrender.com
NEXT_PUBLIC_API_BASE_URL=http://localhost:4001
```

- [ ] **Step 2: Write the failing test `frontend/web/lib/__tests__/api-client.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl, getHealth } from '../api-client';

test('apiUrl joins base and path without double slashes', () => {
  assert.equal(
    apiUrl('/health', 'http://localhost:4001'),
    'http://localhost:4001/health',
  );
  assert.equal(
    apiUrl('health', 'http://localhost:4001/'),
    'http://localhost:4001/health',
  );
});

test('getHealth parses the backend health payload', async () => {
  const fakeFetch = async () =>
    new Response(JSON.stringify({ status: 'ok', db: 'up' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  const result = await getHealth('http://localhost:4001', fakeFetch);
  assert.deepEqual(result, { status: 'ok', db: 'up' });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend/web && node --test --experimental-strip-types lib/__tests__/api-client.test.ts`
Expected: FAIL — cannot find module `../api-client`.

- [ ] **Step 4: Create `frontend/web/lib/api-client.ts`**

```ts
// Minimal typed client for the NestJS backend. Phase 0 only exposes the health
// check; later phases add authenticated resource calls. Reads the base URL from
// NEXT_PUBLIC_API_BASE_URL so it works in both browser and server contexts.

export interface HealthResponse {
  status: 'ok';
  db: 'up' | 'down';
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4001';

/** Join a base origin and a path with exactly one slash between them. */
export function apiUrl(path: string, base: string = DEFAULT_BASE): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** Fetch the backend health status. `base`/`fetchImpl` are injectable for tests. */
export async function getHealth(
  base: string = DEFAULT_BASE,
  fetchImpl: FetchLike = fetch,
): Promise<HealthResponse> {
  const res = await fetchImpl(apiUrl('/health', base));
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return (await res.json()) as HealthResponse;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend/web && node --test --experimental-strip-types lib/__tests__/api-client.test.ts`
Expected: PASS — both tests green. (If the installed Node rejects `--experimental-strip-types`, compile-free fallback: run `npx tsx --test lib/__tests__/api-client.test.ts`.)

- [ ] **Step 6: Confirm the frontend still builds (no behavior change)**

Run: `cd frontend/web && npm run typecheck`
Expected: PASS — no type errors introduced.

- [ ] **Step 7: Commit**

```bash
cd /Users/harshavardhanan/meeting-to-tasks
git add frontend/web/.env.example frontend/web/lib/api-client.ts frontend/web/lib/__tests__/api-client.test.ts
git commit -m "feat(web): add API base URL + typed health client for backend split"
```

---

## Task 7: Document the new backend service in ARCHITECTURE.md

**Files:**
- Modify: `ARCHITECTURE.md` (add a short note that the standalone backend now exists and is being migrated to incrementally)

- [ ] **Step 1: Add a migration note near the top of `ARCHITECTURE.md`**

Insert this blockquote immediately after the first paragraph (after the line ending "every client is a thin frontend over it."):

```markdown
> **Migration in progress (2026-06):** the backend is being extracted from the
> Next.js monolith into a standalone **NestJS** service at `backend/api/`
> (deployed separately on Render), with the Next.js app moving to frontend-only
> on Vercel and **Supabase Auth (bearer JWT)** replacing NextAuth. This is a
> strangler migration — see `docs/superpowers/specs/2026-06-15-frontend-backend-split-design.md`.
> Phase 0 (this commit) adds the backend skeleton (`GET /health`) without moving
> any endpoints yet.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/harshavardhanan/meeting-to-tasks
git add ARCHITECTURE.md
git commit -m "docs: note the standalone backend migration in ARCHITECTURE"
```

---

## Phase 0 done — definition of done

- `cd backend/api && npm run test:e2e` → all suites pass.
- `cd backend/api && npm run build` → compiles to `dist/`.
- `curl localhost:4001/health` (with `.env` filled) → `{"status":"ok","db":"up"}`.
- `cd frontend/web && npm run typecheck` → passes; the monolith still runs unchanged.
- `render.yaml` defines two services.

**Next phase:** Phase 1 — Auth cutover (Supabase Auth + `JwtAuthGuard` + email-keyed user migration). Gets its own plan.
```
