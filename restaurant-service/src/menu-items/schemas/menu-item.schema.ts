import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type MenuItemDocument = MenuItem & Document;

@Schema({ timestamps: true })
export class MenuItem {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  category: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
  })
  restaurantId: MongooseSchema.Types.ObjectId;

  @Prop()
  imageUrl: string;

  @Prop({ default: true })
  isAvailable: boolean;

  @Prop()
  preparationTime: number;

  @Prop({ type: [String] })
  ingredients: string[];

  @Prop({ type: [String] })
  allergens: string[];
}

export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);
