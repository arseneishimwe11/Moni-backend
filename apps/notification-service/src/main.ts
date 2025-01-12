import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationModule } from './app/notification.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('NotificationService');
  const app = await NestFactory.create(NotificationModule);
  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: configService.get('ALLOWED_ORIGINS').split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Moni Notification Service')
    .setDescription('Notification Management API')
    .setVersion('1.0')
    .addTag('notifications')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start server
  const port = configService.get<number>('PORT') || 3002;
  await app.listen(port);
  
  logger.log(`🚀 Notification service running on port ${port}`);
  logger.log(`📚 API documentation available at /api/docs`);
}

bootstrap();
