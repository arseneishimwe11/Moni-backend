import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const logger = new Logger('MoniBackend');
  
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Microservices Connection
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [configService.get('RABBITMQ_URL')],
      queue: 'moni_main_queue',
      queueOptions: {
        durable: true
      },
    },
  });

  // Security
  app.use(helmet());
  app.use(compression());
  
  app.enableCors({
    origin: configService.get('ALLOWED_ORIGINS').split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  // API Configuration
  app.setGlobalPrefix('api/v1');

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Moni Backend API')
    .setDescription('Main API Gateway for Moni Financial Services')
    .setVersion('1.0')
    .addTag('moni')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start Services
  await app.startAllMicroservices();
  
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`🚀 Moni Backend running on port ${port}`);
  logger.log(`📚 API documentation available at /api/docs`);
  logger.log(`🌐 Microservices connected`);
}

bootstrap();
