import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RestaurantDocument = Restaurant & Document;

@Schema({ _id: false })
export class Address {
  @Prop()
  street: string;

  @Prop()
  city: string;

  @Prop()
  state: string;

  @Prop()
  zipCode: string;

  @Prop()
  country: string;
}

@Schema({ _id: false })
export class OpeningHours {
  @Prop()
  open: string;

  @Prop()
  close: string;
}

@Schema({ timestamps: true })
export class Restaurant {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ type: [String] })
  cuisine: string[];

  @Prop({ type: Address })
  address: Address;

  @Prop()
  phone: string;

  @Prop()
  email: string;

  @Prop({ required: true })
  ownerId: string;

  @Prop({ default: 0 })
  rating: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: OpeningHours })
  openingHours: OpeningHours;

  @Prop()
  imageUrl: string;
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);
