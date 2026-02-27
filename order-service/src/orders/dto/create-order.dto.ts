import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty({ description: 'Menu item ID from the restaurant', example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  menuItemId!: string;

  @ApiProperty({ description: 'Name of the menu item', example: 'Margherita Pizza' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Quantity ordered', example: 2 })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Price per item', example: 12.99 })
  @IsNumber()
  @Min(0)
  price!: number;
}

export class AddressDto {
  @ApiProperty({ description: 'Street address', example: '123 Main St' })
  @IsString()
  @IsNotEmpty()
  street!: string;

  @ApiProperty({ description: 'City', example: 'New York' })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({ description: 'State', example: 'NY' })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiProperty({ description: 'Zip code', example: '10001' })
  @IsString()
  @IsNotEmpty()
  zipCode!: string;

  @ApiProperty({ description: 'Country', example: 'US' })
  @IsString()
  @IsNotEmpty()
  country!: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'User ID placing the order', example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ description: 'Restaurant ID', example: '507f1f77bcf86cd799439012' })
  @IsString()
  @IsNotEmpty()
  restaurantId!: string;

  @ApiProperty({ description: 'Order items', type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiProperty({ description: 'Total order amount', example: 25.98 })
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @ApiProperty({ description: 'Payment method', example: 'credit_card', enum: ['credit_card', 'cash', 'digital_wallet'] })
  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;

  @ApiProperty({ description: 'Delivery address', type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  deliveryAddress!: AddressDto;

  @ApiPropertyOptional({ description: 'Special instructions for the order', example: 'No onions please' })
  @IsString()
  @IsOptional()
  specialInstructions?: string;
}
