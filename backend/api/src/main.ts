import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

function parseCorsOrigins(): (string | RegExp)[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Meeting hosts the extension runs on are always allowed.
  return [
    ...fromEnv,
    /^https:\/\/meet\.google\.com$/,
    /^https:\/\/[\w-]+\.zoom\.us$/,
  ];
}

async function bootstrap() {
  // rawBody: true preserves the raw request buffer for Stripe webhook signature
  // verification (req.rawBody) while still parsing JSON for normal routes.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({
    origin: parseCorsOrigins(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  const port = Number(process.env.PORT ?? 4001);
  await app.listen(port);
}
void bootstrap();
