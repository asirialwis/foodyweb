import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { MenuItemsModule } from './menu-items/menu-items.module';
import { HealthModule } from './health/health.module';
import { RmqModule } from './rmq/rmq.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>(
          'MONGODB_URI',
          'mongodb://localhost:27017/restaurant-service',
        ),
      }),
      inject: [ConfigService],
    }),
    RmqModule,
    RestaurantsModule,
    MenuItemsModule,
    HealthModule,
  ],
})
export class AppModule {}
