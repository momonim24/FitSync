import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { sendPaginated } from '../common/utils/pagination.util';
import { CreateTrainerFeedbackDto, TrainerFeedbackQueryDto, UpdateTrainerFeedbackDto } from './dto/trainer-feedback.dto';
import { TrainerFeedbackService } from './trainer-feedback.service';

/**
 * /api/v1/trainer-feedback — Version 2.0 trainer feedback (not a chat:
 * trainers write, members read and acknowledge). Administrators receive
 * aggregate counts only, through the admin dashboard and report.
 */
@Controller('trainer-feedback')
export class TrainerFeedbackController {
  constructor(private readonly service: TrainerFeedbackService) {}

  /** Give feedback to an assigned member, optionally about a goal or plan (Trainer). */
  @Roles(Role.Trainer)
  @Post()
  create(@Body() dto: CreateTrainerFeedbackDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  /** Feedback history (?memberId, ?unread, ?relatedGoalId, ?relatedPlanId, ?page, ?limit). Members also get X-Unread-Count. */
  @Roles(Role.Member, Role.Trainer)
  @Get()
  async findAll(@Query() query: TrainerFeedbackQueryDto, @CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.findAll(query, user);
    if (result.unread !== null) res.setHeader('X-Unread-Count', String(result.unread));
    return sendPaginated(res, result);
  }

  @Roles(Role.Member, Role.Trainer)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  /** Edit own feedback while still assigned (Trainer). */
  @Roles(Role.Trainer)
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTrainerFeedbackDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  /** Mark feedback as read (Member, recipient). */
  @Roles(Role.Member)
  @Patch(':id/read')
  markRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.service.markRead(id, user);
  }

  /** Remove own feedback while still assigned (Trainer). */
  @Roles(Role.Trainer)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<void> {
    return this.service.remove(id, user);
  }
}
