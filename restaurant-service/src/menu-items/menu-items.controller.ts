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
import { MenuItemsService } from './menu-items.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Menu Items')
@Controller('menu-items')
export class MenuItemsController {
  private readonly logger = new Logger(MenuItemsController.name);

  constructor(private readonly menuItemsService: MenuItemsService) {}

  // ==================== RabbitMQ Message Handlers ====================

  @MessagePattern('get_menu_items')
  async handleGetMenuItems(@Payload() data: { restaurantId: string }) {
    this.logger.log(`[RabbitMQ] Getting menu items for restaurant: ${data.restaurantId}`);
    try {
      return await this.menuItemsService.findByRestaurantId(data.restaurantId);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Get menu items failed: ${error}`);
      return [];
    }
  }

  @MessagePattern('get_menu_item')
  async handleGetMenuItem(@Payload() data: { menuItemId: string }) {
    this.logger.log(`[RabbitMQ] Getting menu item: ${data.menuItemId}`);
    try {
      return await this.menuItemsService.findById(data.menuItemId);
    } catch (error) {
      this.logger.error(`[RabbitMQ] Get menu item failed: ${error}`);
      return null;
    }
  }

  // ==================== REST API Endpoints ====================

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new menu item' })
  @ApiResponse({ status: 201, description: 'Menu item created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createMenuItemDto: CreateMenuItemDto) {
    return this.menuItemsService.create(createMenuItemDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all menu items with optional filters' })
  @ApiQuery({ name: 'restaurantId', required: false, description: 'Filter by restaurant ID' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'isAvailable', required: false, type: Boolean, description: 'Filter by availability' })
  @ApiResponse({ status: 200, description: 'List of menu items' })
  findAll(
    @Query('restaurantId') restaurantId?: string,
    @Query('category') category?: string,
    @Query('isAvailable') isAvailable?: string,
  ) {
    const filters: {
      restaurantId?: string;
      category?: string;
      isAvailable?: boolean;
    } = {};
    if (restaurantId) filters.restaurantId = restaurantId;
    if (category) filters.category = category;
    if (isAvailable !== undefined) filters.isAvailable = isAvailable === 'true';
    return this.menuItemsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a menu item by ID' })
  @ApiResponse({ status: 200, description: 'Menu item found' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  findOne(@Param('id') id: string) {
    return this.menuItemsService.findById(id);
  }

  @Get('restaurant/:restaurantId')
  @ApiOperation({ summary: 'Get all menu items for a restaurant' })
  @ApiResponse({ status: 200, description: 'List of menu items for the restaurant' })
  findByRestaurant(@Param('restaurantId') restaurantId: string) {
    return this.menuItemsService.findByRestaurantId(restaurantId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a menu item' })
  @ApiResponse({ status: 200, description: 'Menu item updated successfully' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  update(
    @Param('id') id: string,
    @Body() updateMenuItemDto: UpdateMenuItemDto,
  ) {
    return this.menuItemsService.update(id, updateMenuItemDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a menu item' })
  @ApiResponse({ status: 200, description: 'Menu item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  remove(@Param('id') id: string) {
    return this.menuItemsService.remove(id);
  }
}
