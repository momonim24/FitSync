import './config/timezone'; // first: pins the app time zone (Asia/Manila by default)
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Hide the "X-Powered-By: Express" header.
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  configureApp(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`FitSync API running at http://localhost:${port}/api/v1`, 'Bootstrap');
}
bootstrap();
