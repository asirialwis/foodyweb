import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MenuItem, MenuItemDocument } from './schemas/menu-item.schema';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectModel(MenuItem.name)
    private readonly menuItemModel: Model<MenuItemDocument>,
  ) {}

  async create(
    createMenuItemDto: CreateMenuItemDto,
  ): Promise<MenuItemDocument> {
    const menuItem = new this.menuItemModel(createMenuItemDto);
    return menuItem.save();
  }

  async findAll(filters?: {
    restaurantId?: string;
    category?: string;
    isAvailable?: boolean;
  }): Promise<MenuItemDocument[]> {
    const query: Record<string, any> = {};

    if (filters?.restaurantId) {
      query.restaurantId = filters.restaurantId;
    }
    if (filters?.category) {
      query.category = filters.category;
    }
    if (filters?.isAvailable !== undefined) {
      query.isAvailable = filters.isAvailable;
    }

    return this.menuItemModel.find(query).exec();
  }

  async findById(id: string): Promise<MenuItemDocument> {
    const menuItem = await this.menuItemModel.findById(id).exec();
    if (!menuItem) {
      throw new NotFoundException(`Menu item with ID "${id}" not found`);
    }
    return menuItem;
  }

  async findByRestaurantId(
    restaurantId: string,
  ): Promise<MenuItemDocument[]> {
    return this.menuItemModel.find({ restaurantId }).exec();
  }

  async findByCategory(category: string): Promise<MenuItemDocument[]> {
    return this.menuItemModel.find({ category }).exec();
  }

  async update(
    id: string,
    updateMenuItemDto: UpdateMenuItemDto,
  ): Promise<MenuItemDocument> {
    const menuItem = await this.menuItemModel
      .findByIdAndUpdate(id, updateMenuItemDto, { new: true })
      .exec();
    if (!menuItem) {
      throw new NotFoundException(`Menu item with ID "${id}" not found`);
    }
    return menuItem;
  }

  async remove(id: string): Promise<MenuItemDocument> {
    const menuItem = await this.menuItemModel
      .findByIdAndDelete(id)
      .exec();
    if (!menuItem) {
      throw new NotFoundException(`Menu item with ID "${id}" not found`);
    }
    return menuItem;
  }

  async updateAvailability(
    id: string,
    isAvailable: boolean,
  ): Promise<MenuItemDocument> {
    const menuItem = await this.menuItemModel
      .findByIdAndUpdate(id, { isAvailable }, { new: true })
      .exec();
    if (!menuItem) {
      throw new NotFoundException(`Menu item with ID "${id}" not found`);
    }
    return menuItem;
  }
}
