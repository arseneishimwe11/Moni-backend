import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditModule } from './app/audit.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const logger = new Logger('AuditService');
  
  const app = await NestFactory.create(AuditModule);
  const configService = app.get(ConfigService);

  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [configService.get('RABBITMQ_URL')],
      queue: 'audit_queue',
      queueOptions: {
        durable: true
      },
    },
  });

  app.use(helmet());
  app.use(compression());
  
  app.enableCors({
    origin: configService.get('ALLOWED_ORIGINS').split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  app.setGlobalPrefix('api/v1/audit');

  const config = new DocumentBuilder()
    .setTitle('Moni Audit Service')
    .setDescription('Audit Trail and Activity Logging API')
    .setVersion('1.0')
    .addTag('audit')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.startAllMicroservices();
  
  const port = configService.get<number>('AUDIT_SERVICE_PORT', 3004);
  await app.listen(port);

  logger.log(`📝 Audit service running on port ${port}`);
  logger.log(`📚 API documentation available at /api/docs`);
  logger.log(`🎯 Microservice consumer started`);
}

bootstrap();
