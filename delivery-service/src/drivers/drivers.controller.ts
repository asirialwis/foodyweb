import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { DriversService } from './drivers.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { LocationDto } from '../deliveries/dto/create-delivery.dto';
import { VehicleType } from './schemas/driver.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Drivers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @ApiOperation({ summary: 'Register as a delivery driver' })
  @ApiResponse({ status: 201, description: 'Driver registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createDriverDto: CreateDriverDto) {
    return this.driversService.create(createDriverDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all drivers with optional filters' })
  @ApiResponse({ status: 200, description: 'List of drivers' })
  @ApiQuery({ name: 'isAvailable', required: false, type: Boolean })
  @ApiQuery({ name: 'vehicleType', enum: VehicleType, required: false })
  findAll(
    @Query('isAvailable') isAvailable?: string,
    @Query('vehicleType') vehicleType?: VehicleType,
  ) {
    const parsedAvailable =
      isAvailable !== undefined ? isAvailable === 'true' : undefined;
    return this.driversService.findAll({
      isAvailable: parsedAvailable,
      vehicleType,
    });
  }

  @Get('available')
  @ApiOperation({ summary: 'Find all available and verified drivers' })
  @ApiResponse({ status: 200, description: 'List of available drivers' })
  findAvailable() {
    return this.driversService.findAvailable();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a driver by ID' })
  @ApiResponse({ status: 200, description: 'Driver found' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  findById(@Param('id') id: string) {
    return this.driversService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update driver details' })
  @ApiResponse({ status: 200, description: 'Driver updated successfully' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  update(
    @Param('id') id: string,
    @Body() updateDriverDto: UpdateDriverDto,
  ) {
    return this.driversService.update(id, updateDriverDto);
  }

  @Patch(':id/location')
  @ApiOperation({ summary: 'Update driver current GPS location' })
  @ApiResponse({ status: 200, description: 'Location updated successfully' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  updateLocation(
    @Param('id') id: string,
    @Body() locationDto: LocationDto,
  ) {
    return this.driversService.updateLocation(id, locationDto);
  }

  @Patch(':id/availability')
  @ApiOperation({ summary: 'Toggle driver availability' })
  @ApiResponse({ status: 200, description: 'Availability updated' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  updateAvailability(
    @Param('id') id: string,
    @Body('isAvailable') isAvailable: boolean,
  ) {
    return this.driversService.updateAvailability(id, isAvailable);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a driver' })
  @ApiResponse({ status: 200, description: 'Driver deleted successfully' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  remove(@Param('id') id: string) {
    return this.driversService.remove(id);
  }
}
