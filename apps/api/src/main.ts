import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded, NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

/** Callbacks do Task e importação histórica trazem anexos em base64 (até 50 MB, igual ao Luxus Task). */
const BODY_LIMITS: Array<{ prefix: string; limit: string }> = [
  { prefix: '/api/integrations/', limit: '50mb' },
  { prefix: '/api/sales/import', limit: '10mb' },
  { prefix: '/api/sales', limit: '5mb' },
];
const DEFAULT_BODY_LIMIT = '1mb';

function bodyParsers() {
  const parsers = new Map<string, ReturnType<typeof json>[]>();
  const parsersFor = (limit: string) => {
    if (!parsers.has(limit)) {
      parsers.set(limit, [json({ limit }), urlencoded({ extended: true, limit })]);
    }
    return parsers.get(limit)!;
  };
  return (req: Request, res: Response, next: NextFunction) => {
    const limit = BODY_LIMITS.find((rule) => req.path.startsWith(rule.prefix))?.limit ?? DEFAULT_BODY_LIMIT;
    const [jsonParser, formParser] = parsersFor(limit);
    jsonParser(req, res, (error?: unknown) => (error ? next(error) : formParser(req, res, next)));
  };
}

function parseTrustProxy(raw: string | undefined): boolean | number | string {
  const value = (raw ?? '1').trim();
  if (value === 'true') return true;
  if (value === 'false' || value === '') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const configService = app.get(ConfigService);

  app.set('trust proxy', parseTrustProxy(configService.get<string>('TRUST_PROXY')));
  app.use(bodyParsers());
  app.use(helmet());
  app.enableCors({
    origin: configService
      .get<string>('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api', {
    exclude: [{ path: '', method: RequestMethod.GET }],
  });

  const swaggerEnabled = configService.get('NODE_ENV') !== 'production'
    || configService.get<string>('ENABLE_SWAGGER') === 'true';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Luxus Parceiros API')
      .setDescription('API do sistema Luxus Parceiros')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT ?? configService.get('API_PORT') ?? 3001);
  await app.listen(port, '0.0.0.0');

  console.log(`API rodando na porta ${port}`);
  console.log(`Health: http://0.0.0.0:${port}/api/health`);
}

bootstrap().catch((error) => {
  console.error('Falha ao iniciar API:', error);
  process.exit(1);
});
