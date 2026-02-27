import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrderDocument = Order & Document;

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  PICKED_UP = 'picked_up',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Schema()
export class OrderItem {
  @Prop({ required: true })
  menuItemId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  quantity!: number;

  @Prop({ required: true })
  price!: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema()
export class DeliveryAddress {
  @Prop({ required: true })
  street!: string;

  @Prop({ required: true })
  city!: string;

  @Prop({ required: true })
  state!: string;

  @Prop({ required: true })
  zipCode!: string;

  @Prop({ required: true })
  country!: string;
}

export const DeliveryAddressSchema =
  SchemaFactory.createForClass(DeliveryAddress);

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  restaurantId!: string;

  @Prop({ type: [OrderItemSchema], required: true })
  items!: OrderItem[];

  @Prop({ required: true })
  totalAmount!: number;

  @Prop({
    type: String,
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus!: PaymentStatus;

  @Prop()
  paymentMethod?: string;

  @Prop({ type: DeliveryAddressSchema, required: true })
  deliveryAddress!: DeliveryAddress;

  @Prop()
  specialInstructions?: string;

  @Prop()
  estimatedDeliveryTime?: Date;

  @Prop()
  deliveryId?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
