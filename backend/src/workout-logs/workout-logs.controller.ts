import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { sendPaginated } from '../common/utils/pagination.util';
import { CreateWorkoutLogDto, UpdateWorkoutLogDto, WorkoutLogQueryDto } from './dto/workout-log.dto';
import { WorkoutLog } from './entities/workout-log.entity';
import { WorkoutLogsService } from './workout-logs.service';

/** /api/v1/workout-logs */
@Controller('workout-logs')
export class WorkoutLogsController {
  constructor(private readonly service: WorkoutLogsService) {}

  /** Lab 05 #9 — Record workout (Member). */
  @Roles(Role.Member)
  @Post()
  create(@Body() dto: CreateWorkoutLogDto, @CurrentUser() user: AuthUser): Promise<WorkoutLog> {
    return this.service.create(dto, user);
  }

  /** Lab 05 #10 — View workout history (?memberId, ?exerciseId, ?from, ?to, ?page, ?limit). */
  @Get()
  async findAll(
    @Query() query: WorkoutLogQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<WorkoutLog[]> {
    return sendPaginated(res, await this.service.findAll(query, user));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<WorkoutLog> {
    return this.service.findOne(id, user);
  }

  @Roles(Role.Member)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkoutLogDto,
    @CurrentUser() user: AuthUser,
  ): Promise<WorkoutLog> {
    return this.service.update(id, dto, user);
  }

  @Roles(Role.Member, Role.Admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<void> {
    return this.service.remove(id, user);
  }
}
