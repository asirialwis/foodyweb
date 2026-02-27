import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleType } from '../schemas/driver.schema';
import { LocationDto } from '../../deliveries/dto/create-delivery.dto';

export class CreateDriverDto {
  @ApiProperty({ example: '64f1a2b3c4d5e6f7a8b9c0d1', description: 'User ID from User Service' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: VehicleType, example: VehicleType.CAR })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty({ required: false, example: 'ABC-1234' })
  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @ApiProperty({ required: false, example: 'DL-12345678' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiProperty({ required: false, type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  currentLocation?: LocationDto;
}
