import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Luxus Parceiros API')
    .setDescription('API do sistema Luxus Parceiros')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? configService.get('API_PORT') ?? 3001);
  await app.listen(port, '0.0.0.0');

  console.log(`API rodando na porta ${port}`);
  console.log(`Health: http://0.0.0.0:${port}/api/health`);
}

bootstrap().catch((error) => {
  console.error('Falha ao iniciar API:', error);
  process.exit(1);
});
