import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { of } from 'rxjs';
import { Order, OrderDocument, OrderStatus, PaymentStatus } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @Inject('RESTAURANT_SERVICE') private readonly restaurantClient: ClientProxy,
    @Inject('DELIVERY_SERVICE') private readonly deliveryClient: ClientProxy,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<OrderDocument> {
    // Validate restaurant exists via RabbitMQ
    try {
      const restaurant = await firstValueFrom(
        this.restaurantClient
          .send('validate_restaurant', { restaurantId: createOrderDto.restaurantId })
          .pipe(
            timeout(5000),
            catchError((err) => {
              this.logger.warn(`Failed to validate restaurant: ${err.message}`);
              return of(null);
            }),
          ),
      );

      if (restaurant && !restaurant.valid) {
        throw new BadRequestException('Restaurant is not active or does not exist');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(
        `Failed to validate restaurant ${createOrderDto.restaurantId}: ${error}`,
      );
    }

    // Create the order
    const order = new this.orderModel(createOrderDto);
    const savedOrder = await order.save();

    // Create delivery via RabbitMQ
    try {
      const delivery = await firstValueFrom(
        this.deliveryClient
          .send('create_delivery', {
            orderId: savedOrder._id.toString(),
            restaurantId: createOrderDto.restaurantId,
            deliveryAddress: createOrderDto.deliveryAddress,
            userId: createOrderDto.userId,
          })
          .pipe(
            timeout(5000),
            catchError((err) => {
              this.logger.warn(`Failed to create delivery: ${err.message}`);
              return of(null);
            }),
          ),
      );

      if (delivery) {
        savedOrder.deliveryId = delivery._id ?? delivery.id;
        await savedOrder.save();
      }
    } catch (error) {
      this.logger.warn(`Failed to create delivery for order ${savedOrder._id}: ${error}`);
    }

    return savedOrder;
  }

  async findAll(query: {
    userId?: string;
    restaurantId?: string;
    status?: OrderStatus;
    page?: number;
    limit?: number;
  }): Promise<{ orders: OrderDocument[]; total: number }> {
    const filter: Record<string, unknown> = {};

    if (query.userId) filter.userId = query.userId;
    if (query.restaurantId) filter.restaurantId = query.restaurantId;
    if (query.status) filter.status = query.status;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return { orders, total };
  }

  async findById(id: string): Promise<OrderDocument> {
    const order = await this.orderModel.findById(id).exec();
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async findByUserId(userId: string): Promise<OrderDocument[]> {
    return this.orderModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByRestaurantId(restaurantId: string): Promise<OrderDocument[]> {
    return this.orderModel
      .find({ restaurantId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<OrderDocument> {
    const order = await this.findById(id);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot update status of a cancelled order');
    }
    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Cannot update status of a delivered order');
    }

    order.status = status;

    // Set estimated delivery time when order is confirmed
    if (status === OrderStatus.CONFIRMED && !order.estimatedDeliveryTime) {
      const estimatedTime = new Date();
      estimatedTime.setMinutes(estimatedTime.getMinutes() + 45);
      order.estimatedDeliveryTime = estimatedTime;
    }

    return order.save();
  }

  async updatePaymentStatus(
    id: string,
    paymentStatus: PaymentStatus,
  ): Promise<OrderDocument> {
    const order = await this.findById(id);
    order.paymentStatus = paymentStatus;

    // If payment failed, cancel the order
    if (paymentStatus === PaymentStatus.FAILED) {
      order.status = OrderStatus.CANCELLED;
    }

    return order.save();
  }

  async cancelOrder(id: string): Promise<OrderDocument> {
    const order = await this.findById(id);

    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.PICKED_UP
    ) {
      throw new BadRequestException(
        'Cannot cancel an order that has been picked up or delivered',
      );
    }

    order.status = OrderStatus.CANCELLED;

    // If payment was made, mark for refund
    if (order.paymentStatus === PaymentStatus.PAID) {
      order.paymentStatus = PaymentStatus.REFUNDED;
    }

    // Notify Delivery Service to cancel delivery via RabbitMQ event
    if (order.deliveryId) {
      this.deliveryClient.emit('cancel_delivery', {
        deliveryId: order.deliveryId,
        orderId: id,
        reason: 'Order cancelled by user',
      });
      this.logger.log(`Emitted cancel_delivery event for delivery ${order.deliveryId}`);
    }

    return order.save();
  }
}
