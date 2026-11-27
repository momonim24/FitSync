import { Controller, Get, Param, ParseIntPipe, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { sendPaginated } from '../common/utils/pagination.util';
import { Exercise } from '../exercises/entities/exercise.entity';
import { ExternalExerciseQueryDto } from './dto/external-exercise.dto';
import { ExternalExercise, ExternalFitnessService, Named } from './external-fitness.service';

/**
 * /api/v1/external-fitness — the External Fitness API from Laboratory
 * Activity 03, backed by the public wger exercise database (https://wger.de).
 * Every authenticated role may browse; only admins may import.
 *
 * Responses carry `X-Data-Source: wger` and `X-Cache: HIT | MISS | STALE`.
 */
@Controller('external-fitness')
export class ExternalFitnessController {
  constructor(private readonly service: ExternalFitnessService) {}

  /** Browse / search wger exercises (?search, ?category, ?equipment, ?page, ?limit). */
  @Get('exercises')
  async list(@Query() query: ExternalExerciseQueryDto, @Res({ passthrough: true }) res: Response): Promise<ExternalExercise[]> {
    const result = await this.service.list(query);
    res.setHeader('X-Data-Source', 'wger');
    res.setHeader('X-Cache', result.cache);
    return sendPaginated(res, result);
  }

  /** One wger exercise with full description, muscles, equipment, images and attribution. */
  @Get('exercises/:id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response): Promise<ExternalExercise> {
    const { item, cache } = await this.service.findOne(id);
    res.setHeader('X-Data-Source', 'wger');
    res.setHeader('X-Cache', cache);
    return item;
  }

  /** Admin: copy a wger exercise into the local catalog (201, or 409 if already there). */
  @Roles(Role.Admin)
  @Post('exercises/:id/import')
  importExercise(@Param('id', ParseIntPipe) id: number): Promise<Exercise> {
    return this.service.importExercise(id);
  }

  /** wger exercise categories (for the category filter). */
  @Get('categories')
  categories(@Res({ passthrough: true }) res: Response): Promise<Named[]> {
    res.setHeader('X-Data-Source', 'wger');
    return this.service.categories();
  }

  /** wger equipment types (for the equipment filter). */
  @Get('equipment')
  equipment(@Res({ passthrough: true }) res: Response): Promise<Named[]> {
    res.setHeader('X-Data-Source', 'wger');
    return this.service.equipment();
  }
}
