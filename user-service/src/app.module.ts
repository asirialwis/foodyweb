import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>(
          'MONGODB_URI',
          'mongodb://yohanchristmith_db_user:3v0EIW09j3Luew5Y@ac-ccymxzl-shard-00-00.lnhedlm.mongodb.net:27017,ac-ccymxzl-shard-00-01.lnhedlm.mongodb.net:27017,ac-ccymxzl-shard-00-02.lnhedlm.mongodb.net:27017/user-service-db?ssl=true&replicaSet=atlas-xg6nt3-shard-0&authSource=admin&retryWrites=true&w=majority',
        ),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    HealthModule,
  ],
})
export class AppModule {}
