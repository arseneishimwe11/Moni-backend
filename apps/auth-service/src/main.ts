import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from './app/auth.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const logger = new Logger('AuthService');
  const app = await NestFactory.create(AuthModule);
  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet());
  app.use(compression());

  app.enableCors({
    origin: configService.get('ALLOWED_ORIGINS').split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });
  
  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Each IP limited to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later',
    })
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    })
  );

  // API versioning and prefix
  app.setGlobalPrefix('api/v1/auth');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Moni Auth Service')
    .setDescription('Authentication and Authorization API')
    .setVersion('1.0')
    .addTag('auth')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start server
  const port = configService.get<number>('AUTH_SERVICE_PORT') || 3002;
  await app.listen(port);

  logger.log(`🔐 Auth service running on port ${port}`);
  logger.log(`📚 API documentation available at /api/docs`);
}

bootstrap();
