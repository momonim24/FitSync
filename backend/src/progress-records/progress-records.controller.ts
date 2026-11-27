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
import { MemberDateRangeQueryDto } from '../common/dto/date-range-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { sendPaginated } from '../common/utils/pagination.util';
import { CreateProgressRecordDto, UpdateProgressRecordDto } from './dto/progress-record.dto';
import { ProgressRecord } from './entities/progress-record.entity';
import { ProgressRecordsService } from './progress-records.service';

/** /api/v1/progress-records */
@Controller('progress-records')
export class ProgressRecordsController {
  constructor(private readonly service: ProgressRecordsService) {}

  /** Lab 05 #11 — Add progress record (Member). */
  @Roles(Role.Member)
  @Post()
  create(@Body() dto: CreateProgressRecordDto, @CurrentUser() user: AuthUser): Promise<ProgressRecord> {
    return this.service.create(dto, user);
  }

  /** List progress records (?memberId, ?from, ?to, ?page, ?limit). */
  @Get()
  async findAll(
    @Query() query: MemberDateRangeQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ProgressRecord[]> {
    return sendPaginated(res, await this.service.findAll(query, user));
  }

  /** Lab 05 #12 — View progress record (Member/Trainer). */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<ProgressRecord> {
    return this.service.findOne(id, user);
  }

  @Roles(Role.Member)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProgressRecordDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ProgressRecord> {
    return this.service.update(id, dto, user);
  }

  @Roles(Role.Member, Role.Admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<void> {
    return this.service.remove(id, user);
  }
}
