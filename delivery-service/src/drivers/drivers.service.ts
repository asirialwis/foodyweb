import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Driver, DriverDocument, VehicleType } from './schemas/driver.schema';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { LocationDto } from '../deliveries/dto/create-delivery.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
  ) {}

  async create(createDriverDto: CreateDriverDto): Promise<DriverDocument> {
    const driver = new this.driverModel(createDriverDto);
    return driver.save();
  }

  async findAll(query: {
    isAvailable?: boolean;
    vehicleType?: VehicleType;
  }): Promise<DriverDocument[]> {
    const filter: Record<string, unknown> = {};
    if (query.isAvailable !== undefined) {
      filter.isAvailable = query.isAvailable;
    }
    if (query.vehicleType) {
      filter.vehicleType = query.vehicleType;
    }
    return this.driverModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<DriverDocument> {
    const driver = await this.driverModel.findById(id).exec();
    if (!driver) {
      throw new NotFoundException(`Driver with ID "${id}" not found`);
    }
    return driver;
  }

  async findByUserId(userId: string): Promise<DriverDocument> {
    const driver = await this.driverModel.findOne({ userId }).exec();
    if (!driver) {
      throw new NotFoundException(`Driver for user "${userId}" not found`);
    }
    return driver;
  }

  async findAvailable(): Promise<DriverDocument[]> {
    return this.driverModel
      .find({ isAvailable: true, isVerified: true })
      .exec();
  }

  async update(
    id: string,
    updateDriverDto: UpdateDriverDto,
  ): Promise<DriverDocument> {
    const driver = await this.driverModel
      .findByIdAndUpdate(id, updateDriverDto, { new: true })
      .exec();
    if (!driver) {
      throw new NotFoundException(`Driver with ID "${id}" not found`);
    }
    return driver;
  }

  async updateLocation(
    id: string,
    location: LocationDto,
  ): Promise<DriverDocument> {
    await this.findById(id);
    const updated = await this.driverModel
      .findByIdAndUpdate(id, { currentLocation: location }, { new: true })
      .exec();
    return updated!;
  }

  async updateAvailability(
    id: string,
    isAvailable: boolean,
  ): Promise<DriverDocument> {
    await this.findById(id);
    const updated = await this.driverModel
      .findByIdAndUpdate(id, { isAvailable }, { new: true })
      .exec();
    return updated!;
  }

  async updateRating(
    id: string,
    rating: number,
  ): Promise<DriverDocument> {
    await this.findById(id);
    const updated = await this.driverModel
      .findByIdAndUpdate(id, { rating }, { new: true })
      .exec();
    return updated!;
  }

  async remove(id: string): Promise<DriverDocument> {
    const driver = await this.driverModel.findByIdAndDelete(id).exec();
    if (!driver) {
      throw new NotFoundException(`Driver with ID "${id}" not found`);
    }
    return driver;
  }
}
