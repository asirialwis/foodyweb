import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DeliveryStatus } from '../schemas/delivery.schema';

export class UpdateDeliveryStatusDto {
  @ApiProperty({
    enum: DeliveryStatus,
    example: DeliveryStatus.IN_TRANSIT,
    description: 'New delivery status',
  })
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;
}
