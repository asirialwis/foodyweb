import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeliveryDocument = Delivery & Document;

export enum DeliveryStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Delivery {
  @Prop({ required: true })
  orderId: string;

  @Prop()
  driverId: string;

  @Prop({
    type: String,
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  @Prop(
    raw({
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    }),
  )
  pickupAddress: Record<string, string>;

  @Prop(
    raw({
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    }),
  )
  deliveryAddress: Record<string, string>;

  @Prop()
  estimatedDeliveryTime: Date;

  @Prop()
  actualDeliveryTime: Date;

  @Prop(
    raw({
      latitude: { type: Number },
      longitude: { type: Number },
    }),
  )
  currentLocation: Record<string, number>;

  @Prop()
  distance: number;

  @Prop()
  deliveryFee: number;

  @Prop()
  notes: string;
}

export const DeliverySchema = SchemaFactory.createForClass(Delivery);
