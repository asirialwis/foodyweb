import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
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
import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto, LocationDto } from './dto/create-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { DeliveryStatus } from './schemas/delivery.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Deliveries')
@Controller('deliveries')
export class DeliveriesController {
  private readonly logger = new Logger(DeliveriesController.name);

  constructor(private readonly deliveriesService: DeliveriesService) {}

  // ==================== RabbitMQ Message Handlers ====================

  @MessagePattern('create_delivery')
  async handleCreateDelivery(
    @Payload()
    data: {
      orderId: string;
      restaurantId: string;
      deliveryAddress: any;
      userId: string;
    },
  ) {
    this.logger.log(`[RabbitMQ] Creating delivery for order: ${data.orderId}`);
    try {
      const delivery = await this.deliveriesService.create({
        orderId: data.orderId,
        deliveryAddress: data.deliveryAddress,
        pickupAddress: data.deliveryAddress,
      } as CreateDeliveryDto);
      return {
        _id: delivery._id,
        id: delivery._id,
        orderId: delivery.orderId,
        status: delivery.status,
      };
    } catch (error) {
      this.logger.error(`[RabbitMQ] Create delivery failed: ${error}`);
      return null;
    }
  }

  @MessagePattern('get_delivery')
  async handleGetDelivery(@Payload() data: { deliveryId: string }) {
    this.logger.log(`[RabbitMQ] Getting delivery: ${data.deliveryId}`);
    try {
      return await this.deliveriesService.findById(data.deliveryId);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Get delivery failed: ${error}`);
      return null;
    }
  }

  @MessagePattern('get_delivery_by_order')
  async handleGetDeliveryByOrder(@Payload() data: { orderId: string }) {
    this.logger.log(`[RabbitMQ] Getting delivery for order: ${data.orderId}`);
    try {
      return await this.deliveriesService.findByOrderId(data.orderId);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Get delivery by order failed: ${error}`);
      return null;
    }
  }

  @EventPattern('cancel_delivery')
  async handleCancelDelivery(
    @Payload() data: { deliveryId: string; orderId: string; reason: string },
  ) {
    this.logger.log(
      `[RabbitMQ] Cancelling delivery ${data.deliveryId} for order ${data.orderId}: ${data.reason}`,
    );
    try {
      await this.deliveriesService.updateStatus(
        data.deliveryId,
        DeliveryStatus.FAILED,
      );
      this.logger.log(`Delivery ${data.deliveryId} cancelled successfully`);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Cancel delivery failed: ${error}`);
    }
  }

  // ==================== REST API Endpoints ====================

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new delivery' })
  @ApiResponse({ status: 201, description: 'Delivery created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createDeliveryDto: CreateDeliveryDto) {
    return this.deliveriesService.create(createDeliveryDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all deliveries with optional filters' })
  @ApiResponse({ status: 200, description: 'List of deliveries' })
  @ApiQuery({ name: 'status', enum: DeliveryStatus, required: false })
  @ApiQuery({ name: 'driverId', required: false })
  findAll(
    @Query('status') status?: DeliveryStatus,
    @Query('driverId') driverId?: string,
  ) {
    return this.deliveriesService.findAll({ status, driverId });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a delivery by ID' })
  @ApiResponse({ status: 200, description: 'Delivery found' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  findById(@Param('id') id: string) {
    return this.deliveriesService.findById(id);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get delivery by order ID' })
  @ApiResponse({ status: 200, description: 'Delivery found' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  findByOrderId(@Param('orderId') orderId: string) {
    return this.deliveriesService.findByOrderId(orderId);
  }

  @Get('driver/:driverId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get deliveries by driver ID' })
  @ApiResponse({ status: 200, description: 'List of deliveries for the driver' })
  @ApiParam({ name: 'driverId', description: 'Driver ID' })
  findByDriverId(@Param('driverId') driverId: string) {
    return this.deliveriesService.findByDriverId(driverId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update delivery status' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateDeliveryStatusDto: UpdateDeliveryStatusDto,
  ) {
    return this.deliveriesService.updateStatus(id, updateDeliveryStatusDto.status);
  }

  @Patch(':id/assign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign a driver to a delivery' })
  @ApiResponse({ status: 200, description: 'Driver assigned successfully' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  assignDriver(
    @Param('id') id: string,
    @Body() assignDriverDto: AssignDriverDto,
  ) {
    return this.deliveriesService.assignDriver(id, assignDriverDto.driverId);
  }

  @Patch(':id/location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update delivery current location' })
  @ApiResponse({ status: 200, description: 'Location updated successfully' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  @ApiParam({ name: 'id', description: 'Delivery ID' })
  updateLocation(
    @Param('id') id: string,
    @Body() locationDto: LocationDto,
  ) {
    return this.deliveriesService.updateLocation(id, locationDto);
  }
}
