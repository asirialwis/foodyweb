import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Connect RabbitMQ microservice (hybrid app)
  const rmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rmqUrl],
      queue: 'restaurant_queue',
      queueOptions: { durable: true },
    },
  });

  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: 'Too many requests from this IP, please try again later.',
    }),
  );
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Restaurant Service API')
    .setDescription('Food Ordering App - Restaurant Service')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.startAllMicroservices();
  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`Restaurant Service is running on: http://localhost:${port}`);
  console.log(`Restaurant Service RabbitMQ consumer connected to: ${rmqUrl}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api`);
}
bootstrap();
