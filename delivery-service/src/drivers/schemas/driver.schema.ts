import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DriverDocument = Driver & Document;

export enum VehicleType {
  BICYCLE = 'bicycle',
  MOTORCYCLE = 'motorcycle',
  CAR = 'car',
}

@Schema({ timestamps: true })
export class Driver {
  @Prop({ required: true })
  userId: string;

  @Prop({ type: String, enum: VehicleType, required: true })
  vehicleType: VehicleType;

  @Prop()
  vehicleNumber: string;

  @Prop()
  licenseNumber: string;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop(
    raw({
      latitude: { type: Number },
      longitude: { type: Number },
    }),
  )
  currentLocation: Record<string, number>;

  @Prop({ default: 0 })
  rating: number;

  @Prop({ default: 0 })
  totalDeliveries: number;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);
