import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { PaymentStatus } from '../schemas/order.schema';

export class UpdatePaymentStatusDto {
  @ApiProperty({
    description: 'New payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
  })
  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  paymentStatus!: PaymentStatus;
}
