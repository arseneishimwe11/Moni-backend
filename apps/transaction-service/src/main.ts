import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransactionModule } from './app/transaction.module';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('TransactionService');
  const app = await NestFactory.create(TransactionModule);
  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: configService.get('ALLOWED_ORIGINS').split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Global pipes and prefixes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Moni Transaction Service')
    .setDescription('Payment and Transaction Processing API')
    .setVersion('1.0')
    .addTag('transactions')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Server Setup
  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  logger.log(`🚀 Transaction service running on port ${port}`);
  logger.log(`📚 API documentation available at /api/docs`);
}

bootstrap();
