import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'NY' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: '10001' })
  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  @IsNotEmpty()
  country: string;
}

export class LocationDto {
  @ApiProperty({ example: 40.7128 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -74.006 })
  @IsNumber()
  longitude: number;
}

export class CreateDeliveryDto {
  @ApiProperty({ example: '64f1a2b3c4d5e6f7a8b9c0d1', description: 'Order ID from Order Service' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  pickupAddress: AddressDto;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  deliveryAddress: AddressDto;

  @ApiProperty({ required: false, example: '2026-03-01T12:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  estimatedDeliveryTime?: string;

  @ApiProperty({ required: false, example: 5.2, description: 'Distance in km' })
  @IsOptional()
  @IsNumber()
  distance?: number;

  @ApiProperty({ required: false, example: 3.99, description: 'Delivery fee' })
  @IsOptional()
  @IsNumber()
  deliveryFee?: number;

  @ApiProperty({ required: false, example: 'Leave at door' })
  @IsOptional()
  @IsString()
  notes?: string;
}
