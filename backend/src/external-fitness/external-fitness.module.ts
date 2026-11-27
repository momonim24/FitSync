import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Exercise } from '../exercises/entities/exercise.entity';
import { ExternalFitnessController } from './external-fitness.controller';
import { ExternalFitnessService } from './external-fitness.service';
import { WgerClient } from './wger.client';

@Module({
  imports: [TypeOrmModule.forFeature([Exercise])],
  controllers: [ExternalFitnessController],
  providers: [ExternalFitnessService, WgerClient],
})
export class ExternalFitnessModule {}
