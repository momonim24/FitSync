import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { sendPaginated } from '../common/utils/pagination.util';
import { CreateTrainerAssignmentDto, TrainerAssignmentQueryDto } from './dto/trainer-assignment.dto';
import { TrainerAssignment } from './entities/trainer-assignment.entity';
import { TrainerAssignmentsService } from './trainer-assignments.service';

/** /api/v1/trainer-assignments */
@Controller('trainer-assignments')
export class TrainerAssignmentsController {
  constructor(private readonly service: TrainerAssignmentsService) {}

  /** Lab 05 #13 — Assign trainer (Admin). */
  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateTrainerAssignmentDto): Promise<TrainerAssignment> {
    return this.service.create(dto);
  }

  /** List assignments, scoped by role (?trainerId, ?memberId, ?page, ?limit). */
  @Get()
  async findAll(
    @Query() query: TrainerAssignmentQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TrainerAssignment[]> {
    return sendPaginated(res, await this.service.findAll(query, user));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<TrainerAssignment> {
    return this.service.findOne(id, user);
  }

  /** Replace an assignment's trainer/member pair (Admin). */
  @Roles(Role.Admin)
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTrainerAssignmentDto): Promise<TrainerAssignment> {
    return this.service.update(id, dto);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
