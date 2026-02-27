import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { MessagePattern, EventPattern, Payload } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrderStatus } from './schemas/order.schema';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  // ==================== RabbitMQ Message Handlers ====================

  @MessagePattern('get_order')
  async handleGetOrder(@Payload() data: { orderId: string }) {
    this.logger.log(`[RabbitMQ] Getting order: ${data.orderId}`);
    try {
      return await this.ordersService.findById(data.orderId);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Get order failed: ${error}`);
      return null;
    }
  }

  @MessagePattern('get_orders_by_user')
  async handleGetOrdersByUser(@Payload() data: { userId: string }) {
    this.logger.log(`[RabbitMQ] Getting orders for user: ${data.userId}`);
    try {
      return await this.ordersService.findByUserId(data.userId);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Get orders by user failed: ${error}`);
      return [];
    }
  }

  @EventPattern('delivery_status_updated')
  async handleDeliveryStatusUpdated(
    @Payload() data: { orderId: string; status: string },
  ) {
    this.logger.log(
      `[RabbitMQ] Delivery status updated for order ${data.orderId}: ${data.status}`,
    );
    try {
      const orderStatus = this.mapDeliveryStatusToOrderStatus(data.status);
      if (orderStatus) {
        await this.ordersService.updateStatus(data.orderId, orderStatus);
        this.logger.log(`Order ${data.orderId} status updated to ${orderStatus}`);
      }
    } catch (error) {
      this.logger.error(
        `[RabbitMQ] Failed to update order from delivery status: ${error}`,
      );
    }
  }

  private mapDeliveryStatusToOrderStatus(deliveryStatus: string): OrderStatus | null {
    switch (deliveryStatus) {
      case 'picked_up':
        return OrderStatus.PICKED_UP;
      case 'in_transit':
        return OrderStatus.PICKED_UP;
      case 'delivered':
        return OrderStatus.DELIVERED;
      case 'failed':
        return OrderStatus.CANCELLED;
      default:
        return null;
    }
  }

  // ==================== REST API Endpoints ====================

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all orders with optional filters' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'restaurantId', required: false, description: 'Filter by restaurant ID' })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus, description: 'Filter by order status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'List of orders' })
  findAll(
    @Query('userId') userId?: string,
    @Query('restaurantId') restaurantId?: string,
    @Query('status') status?: OrderStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.findAll({
      userId,
      restaurantId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get orders by user ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'List of user orders' })
  findByUserId(@Param('userId') userId: string) {
    return this.ordersService.findByUserId(userId);
  }

  @Get('restaurant/:restaurantId')
  @ApiOperation({ summary: 'Get orders by restaurant ID' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({ status: 200, description: 'List of restaurant orders' })
  findByRestaurantId(@Param('restaurantId') restaurantId: string) {
    return this.ordersService.findByRestaurantId(restaurantId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status update' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto.status);
  }

  @Patch(':id/payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update payment status' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Payment status updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  updatePaymentStatus(
    @Param('id') id: string,
    @Body() updatePaymentStatusDto: UpdatePaymentStatusDto,
  ) {
    return this.ordersService.updatePaymentStatus(
      id,
      updatePaymentStatusDto.paymentStatus,
    );
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel this order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  cancelOrder(@Param('id') id: string) {
    return this.ordersService.cancelOrder(id);
  }
}
