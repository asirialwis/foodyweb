import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AssignDriverDto {
  @ApiProperty({ example: '64f1a2b3c4d5e6f7a8b9c0d1', description: 'Driver ID to assign' })
  @IsString()
  @IsNotEmpty()
  driverId: string;
}
