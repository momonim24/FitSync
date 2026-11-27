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
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreatePlanExerciseDto, UpdatePlanExerciseDto } from './dto/plan-exercise.dto';
import { PlanExercise } from './entities/plan-exercise.entity';
import { PlanExercisesService } from './plan-exercises.service';

/** /api/v1/plan-exercises — exercises inside workout plans. */
@Controller('plan-exercises')
export class PlanExercisesController {
  constructor(private readonly service: PlanExercisesService) {}

  /** Lab 05 #14 — Add exercise to plan (Trainer). */
  @Roles(Role.Trainer)
  @Post()
  create(@Body() dto: CreatePlanExerciseDto, @CurrentUser() user: AuthUser): Promise<PlanExercise> {
    return this.service.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<PlanExercise> {
    return this.service.findOne(id, user);
  }

  @Roles(Role.Trainer)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanExerciseDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PlanExercise> {
    return this.service.update(id, dto, user);
  }

  @Roles(Role.Trainer, Role.Admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<void> {
    return this.service.remove(id, user);
  }
}
