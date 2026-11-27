import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { TrainerAssignment } from './entities/trainer-assignment.entity';
import { TrainerAssignmentsController } from './trainer-assignments.controller';
import { TrainerAssignmentsService } from './trainer-assignments.service';

@Module({
  imports: [TypeOrmModule.forFeature([TrainerAssignment, User])],
  controllers: [TrainerAssignmentsController],
  providers: [TrainerAssignmentsService],
  // Exported so other modules can verify trainer-member assignments.
  exports: [TrainerAssignmentsService],
})
export class TrainerAssignmentsModule {}
