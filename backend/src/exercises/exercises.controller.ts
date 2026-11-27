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
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { sendPaginated } from '../common/utils/pagination.util';
import { CreateExerciseDto, ExerciseQueryDto } from './dto/exercise.dto';
import { Exercise } from './entities/exercise.entity';
import { ExercisesService } from './exercises.service';

/** /api/v1/exercises — read by any authenticated user, managed by admins. */
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly service: ExercisesService) {}

  /** Lab 05 #5 — View exercises (Authenticated). */
  @Get()
  async findAll(@Query() query: ExerciseQueryDto, @Res({ passthrough: true }) res: Response): Promise<Exercise[]> {
    return sendPaginated(res, await this.service.findAll(query));
  }

  /** Distinct categories for filters and forms. */
  @Get('categories')
  categories(): Promise<string[]> {
    return this.service.categories();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Exercise> {
    return this.service.findOne(id);
  }

  /** Lab 05 #6 — Add exercise (Admin). */
  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateExerciseDto): Promise<Exercise> {
    return this.service.create(dto);
  }

  @Roles(Role.Admin)
  @Put(':id')
  replace(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateExerciseDto): Promise<Exercise> {
    return this.service.replace(id, dto);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
