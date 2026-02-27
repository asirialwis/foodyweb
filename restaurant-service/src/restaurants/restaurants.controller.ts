import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Restaurants')
@Controller('restaurants')
export class RestaurantsController {
  private readonly logger = new Logger(RestaurantsController.name);

  constructor(private readonly restaurantsService: RestaurantsService) {}

  // ==================== RabbitMQ Message Handlers ====================

  @MessagePattern('get_restaurant')
  async handleGetRestaurant(@Payload() data: { restaurantId: string }) {
    this.logger.log(`[RabbitMQ] Getting restaurant: ${data.restaurantId}`);
    try {
      const restaurant = await this.restaurantsService.findById(data.restaurantId);
      return {
        id: restaurant._id,
        name: restaurant.name,
        description: restaurant.description,
        cuisine: restaurant.cuisine,
        address: restaurant.address,
        phone: restaurant.phone,
        ownerId: restaurant.ownerId,
        rating: restaurant.rating,
        isActive: restaurant.isActive,
        openingHours: restaurant.openingHours,
      };
    } catch (error) {
      this.logger.error(`[RabbitMQ] Get restaurant failed: ${error}`);
      return null;
    }
  }

  @MessagePattern('validate_restaurant')
  async handleValidateRestaurant(@Payload() data: { restaurantId: string }) {
    this.logger.log(`[RabbitMQ] Validating restaurant: ${data.restaurantId}`);
    try {
      const restaurant = await this.restaurantsService.findById(data.restaurantId);
      return {
        id: restaurant._id,
        name: restaurant.name,
        isActive: restaurant.isActive,
        valid: !!restaurant && restaurant.isActive,
      };
    } catch (error) {
      this.logger.error(`[RabbitMQ] Restaurant validation failed: ${error}`);
      return { valid: false };
    }
  }

  // ==================== REST API Endpoints ====================

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new restaurant' })
  @ApiResponse({ status: 201, description: 'Restaurant created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createRestaurantDto: CreateRestaurantDto) {
    return this.restaurantsService.create(createRestaurantDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all restaurants with optional filters' })
  @ApiQuery({ name: 'cuisine', required: false, description: 'Filter by cuisine type' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiResponse({ status: 200, description: 'List of restaurants' })
  findAll(
    @Query('cuisine') cuisine?: string,
    @Query('isActive') isActive?: string,
  ) {
    const filters: { cuisine?: string; isActive?: boolean } = {};
    if (cuisine) filters.cuisine = cuisine;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    return this.restaurantsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a restaurant by ID' })
  @ApiResponse({ status: 200, description: 'Restaurant found' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  findOne(@Param('id') id: string) {
    return this.restaurantsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a restaurant' })
  @ApiResponse({ status: 200, description: 'Restaurant updated successfully' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  update(
    @Param('id') id: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
  ) {
    return this.restaurantsService.update(id, updateRestaurantDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a restaurant' })
  @ApiResponse({ status: 200, description: 'Restaurant deleted successfully' })
  @ApiResponse({ status: 404, description: 'Restaurant not found' })
  remove(@Param('id') id: string) {
    return this.restaurantsService.remove(id);
  }
}
