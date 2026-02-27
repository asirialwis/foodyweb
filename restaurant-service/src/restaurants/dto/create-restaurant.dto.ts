import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsEmail,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @ApiProperty({ example: '123 Main St', required: false })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiProperty({ example: 'New York', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ example: 'NY', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ example: '10001', required: false })
  @IsOptional()
  @IsString()
  zipCode?: string;

  @ApiProperty({ example: 'USA', required: false })
  @IsOptional()
  @IsString()
  country?: string;
}

class OpeningHoursDto {
  @ApiProperty({ example: '09:00', required: false })
  @IsOptional()
  @IsString()
  open?: string;

  @ApiProperty({ example: '22:00', required: false })
  @IsOptional()
  @IsString()
  close?: string;
}

export class CreateRestaurantDto {
  @ApiProperty({ example: 'Pizza Palace', description: 'Restaurant name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Best pizza in town',
    description: 'Restaurant description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: ['Italian', 'Pizza'],
    description: 'Types of cuisine',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cuisine?: string[];

  @ApiProperty({ type: AddressDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiProperty({ example: '+1-555-0123', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'contact@pizzapalace.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '60d5ec49f1b2c8b1f8e4e1a1',
    description: 'Owner user ID',
  })
  @IsString()
  @IsNotEmpty()
  ownerId: string;

  @ApiProperty({ example: 4.5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: OpeningHoursDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => OpeningHoursDto)
  openingHours?: OpeningHoursDto;

  @ApiProperty({
    example: 'https://example.com/image.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
