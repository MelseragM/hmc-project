import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { AppConfig } from '@core/config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const appCfg = config.getOrThrow<AppConfig>('app');

  // Security & performance hardening
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: appCfg.corsOrigins.includes('*') ? true : appCfg.corsOrigins,
    credentials: true,
  });

  // All routes under /{prefix} (e.g. /api/v1)
  app.setGlobalPrefix(appCfg.apiPrefix);
  app.enableShutdownHooks();

  // OpenAPI / Swagger UI at /docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('HMC Sanaad B2E API')
    .setDescription(
      'NestJS backend re-exposing the 71 Sanaad operations over Oracle XXHMC_SND_* (14 modules).',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(appCfg.port);
  Logger.log(
    `Sanaad backend listening on http://localhost:${appCfg.port}/${appCfg.apiPrefix} (Swagger: /docs)`,
    'Bootstrap',
  );
}

void bootstrap();
