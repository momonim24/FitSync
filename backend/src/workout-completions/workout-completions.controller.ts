import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { sendPaginated } from '../common/utils/pagination.util';
import { AdherenceQueryDto, CompletionPeriodQueryDto, CreateWorkoutCompletionDto, WorkoutCompletionQueryDto } from './dto/workout-completion.dto';
import { WorkoutCompletionsService } from './workout-completions.service';

/**
 * /api/v1/workout-completions — Version 2.0 workout plan completion tracking.
 * (A workout can also be counted while it is recorded: POST /workout-logs
 * with the optional planExerciseId.)
 */
@Controller('workout-completions')
export class WorkoutCompletionsController {
  constructor(private readonly service: WorkoutCompletionsService) {}

  /** Count an already recorded workout toward a prescribed plan exercise (Member, own log + own plan). */
  @Roles(Role.Member)
  @Post()
  create(@Body() dto: CreateWorkoutCompletionDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  /** Completion history (?memberId, ?planId, ?from, ?to, ?page, ?limit), scoped like workout logs. */
  @Get()
  async findAll(@Query() query: WorkoutCompletionQueryDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    return sendPaginated(res, await this.service.findAll(query, user));
  }

  /** Adherence per member (?memberId, ?period=week|month|custom, ?from, ?to). */
  @Get('adherence')
  adherence(@Query() query: AdherenceQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.adherence(query, user);
  }

  /** Stop counting a workout toward its plan; the workout log itself is kept (Member, own). */
  @Roles(Role.Member)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<void> {
    return this.service.remove(id, user);
  }
}

/** /api/v1/workout-plans/:id/completion — nested read-only view of one plan's completion. */
@Controller('workout-plans')
export class PlanCompletionController {
  constructor(private readonly service: WorkoutCompletionsService) {}

  /** Prescribed vs actual for each plan exercise in a period (default: last 7 days). */
  @Get(':id/completion')
  completion(@Param('id', ParseIntPipe) id: number, @Query() query: CompletionPeriodQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.planCompletion(id, query, user);
  }
}
