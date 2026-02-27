import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Restaurant,
  RestaurantDocument,
} from './schemas/restaurant.schema';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
  ) {}

  async create(
    createRestaurantDto: CreateRestaurantDto,
  ): Promise<RestaurantDocument> {
    const restaurant = new this.restaurantModel(createRestaurantDto);
    return restaurant.save();
  }

  async findAll(filters?: {
    cuisine?: string;
    isActive?: boolean;
  }): Promise<RestaurantDocument[]> {
    const query: Record<string, any> = {};

    if (filters?.cuisine) {
      query.cuisine = { $in: [filters.cuisine] };
    }
    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    return this.restaurantModel.find(query).exec();
  }

  async findById(id: string): Promise<RestaurantDocument> {
    const restaurant = await this.restaurantModel.findById(id).exec();
    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID "${id}" not found`);
    }
    return restaurant;
  }

  async findByOwnerId(ownerId: string): Promise<RestaurantDocument[]> {
    return this.restaurantModel.find({ ownerId }).exec();
  }

  async update(
    id: string,
    updateRestaurantDto: UpdateRestaurantDto,
  ): Promise<RestaurantDocument> {
    const restaurant = await this.restaurantModel
      .findByIdAndUpdate(id, updateRestaurantDto, { new: true })
      .exec();
    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID "${id}" not found`);
    }
    return restaurant;
  }

  async remove(id: string): Promise<RestaurantDocument> {
    const restaurant = await this.restaurantModel
      .findByIdAndDelete(id)
      .exec();
    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID "${id}" not found`);
    }
    return restaurant;
  }

  async updateRating(
    id: string,
    rating: number,
  ): Promise<RestaurantDocument> {
    const restaurant = await this.restaurantModel
      .findByIdAndUpdate(id, { rating }, { new: true })
      .exec();
    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID "${id}" not found`);
    }
    return restaurant;
  }
}
