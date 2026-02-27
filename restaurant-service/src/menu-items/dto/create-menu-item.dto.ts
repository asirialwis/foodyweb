import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateMenuItemDto {
  @ApiProperty({ example: 'Margherita Pizza', description: 'Menu item name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Classic pizza with tomato sauce and mozzarella',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 12.99, description: 'Price of the item' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    example: 'main',
    description: 'Category (appetizer, main, dessert, beverage)',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    example: '60d5ec49f1b2c8b1f8e4e1a1',
    description: 'Restaurant ID',
  })
  @IsString()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({
    example: 'https://example.com/pizza.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiProperty({
    example: 20,
    description: 'Preparation time in minutes',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  preparationTime?: number;

  @ApiProperty({
    example: ['flour', 'tomato', 'mozzarella', 'basil'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ingredients?: string[];

  @ApiProperty({ example: ['gluten', 'dairy'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[];
}
