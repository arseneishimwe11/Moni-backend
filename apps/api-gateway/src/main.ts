import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GatewayModule } from './app/gateway.module';
import compression from 'compression';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  
  // Global prefix
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);
  
  app.use(helmet());
  app.use(compression());
  
  // CORS configuration
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  Logger.log(
    `🚀 API Gateway is running on: http://localhost:${port}/${globalPrefix}`
  );
}

bootstrap();
