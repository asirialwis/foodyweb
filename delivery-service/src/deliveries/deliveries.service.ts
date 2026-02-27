import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { Delivery, DeliveryDocument, DeliveryStatus } from './schemas/delivery.schema';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { LocationDto } from './dto/create-delivery.dto';

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    @InjectModel(Delivery.name)
    private readonly deliveryModel: Model<DeliveryDocument>,
    @Inject('ORDER_SERVICE') private readonly orderClient: ClientProxy,
  ) {}

  async create(createDeliveryDto: CreateDeliveryDto): Promise<DeliveryDocument> {
    const delivery = new this.deliveryModel(createDeliveryDto);
    return delivery.save();
  }

  async findAll(query: {
    status?: DeliveryStatus;
    driverId?: string;
  }): Promise<DeliveryDocument[]> {
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter.status = query.status;
    }
    if (query.driverId) {
      filter.driverId = query.driverId;
    }
    return this.deliveryModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<DeliveryDocument> {
    const delivery = await this.deliveryModel.findById(id).exec();
    if (!delivery) {
      throw new NotFoundException(`Delivery with ID "${id}" not found`);
    }
    return delivery;
  }

  async findByOrderId(orderId: string): Promise<DeliveryDocument> {
    const delivery = await this.deliveryModel.findOne({ orderId }).exec();
    if (!delivery) {
      throw new NotFoundException(
        `Delivery for order "${orderId}" not found`,
      );
    }
    return delivery;
  }

  async findByDriverId(driverId: string): Promise<DeliveryDocument[]> {
    return this.deliveryModel
      .find({ driverId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(
    id: string,
    status: DeliveryStatus,
  ): Promise<DeliveryDocument> {
    const delivery = await this.findById(id);

    const update: Record<string, unknown> = { status };

    if (status === DeliveryStatus.DELIVERED) {
      update.actualDeliveryTime = new Date();
    }

    const updated = await this.deliveryModel
      .findByIdAndUpdate(id, update, { new: true })
      .exec();

    // Notify Order Service about status change via RabbitMQ event
    const orderStatus = this.mapDeliveryStatusToOrderStatus(status);
    this.orderClient.emit('delivery_status_updated', {
      orderId: delivery.orderId,
      deliveryId: id,
      status: orderStatus,
      deliveryStatus: status,
      timestamp: new Date().toISOString(),
    });
    this.logger.log(
      `Emitted delivery_status_updated event for order ${delivery.orderId}: ${status}`,
    );

    return updated!;
  }

  async assignDriver(
    id: string,
    driverId: string,
  ): Promise<DeliveryDocument> {
    await this.findById(id);

    const updated = await this.deliveryModel
      .findByIdAndUpdate(
        id,
        { driverId, status: DeliveryStatus.ASSIGNED },
        { new: true },
      )
      .exec();

    return updated!;
  }

  async updateLocation(
    id: string,
    location: LocationDto,
  ): Promise<DeliveryDocument> {
    await this.findById(id);

    const updated = await this.deliveryModel
      .findByIdAndUpdate(
        id,
        { currentLocation: location },
        { new: true },
      )
      .exec();

    return updated!;
  }

  private mapDeliveryStatusToOrderStatus(deliveryStatus: DeliveryStatus): string {
    switch (deliveryStatus) {
      case DeliveryStatus.PICKED_UP:
        return 'picked_up';
      case DeliveryStatus.IN_TRANSIT:
        return 'in_transit';
      case DeliveryStatus.DELIVERED:
        return 'delivered';
      case DeliveryStatus.FAILED:
        return 'cancelled';
      default:
        return 'in_progress';
    }
  }
}
