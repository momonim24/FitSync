import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { buildDatabaseOptions } from './config/database.config';
import { validateEnv } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExercisesModule } from './exercises/exercises.module';
import { ExternalFitnessModule } from './external-fitness/external-fitness.module';
import { ReportsModule } from './reports/reports.module';
import { PlanExercisesModule } from './plan-exercises/plan-exercises.module';
import { ProgressRecordsModule } from './progress-records/progress-records.module';
import { TrainerAssignmentsModule } from './trainer-assignments/trainer-assignments.module';
import { User } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';
import { WorkoutLogsModule } from './workout-logs/workout-logs.module';
import { WorkoutPlansModule } from './workout-plans/workout-plans.module';
import { WorkoutCompletionsModule } from './workout-completions/workout-completions.module';
import { FitnessGoalsModule } from './fitness-goals/fitness-goals.module';
import { TrainerFeedbackModule } from './trainer-feedback/trainer-feedback.module';

@Module({
  imports: [
    // Loads backend/.env into process.env and validates it at startup.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),

    // MySQL connection through TypeORM (options built from env variables).
    TypeOrmModule.forRootAsync({ useFactory: () => buildDatabaseOptions(process.env) }),

    // Default rate limit for every route; /auth/login overrides it with a stricter limit.
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: () => Number(process.env.GLOBAL_RATE_LIMIT ?? 300) },
      ],
      errorMessage: 'Too many requests. Please wait a minute and try again.',
    }),

    TypeOrmModule.forFeature([User]),
    AuthModule,
    UsersModule,
    ExercisesModule,
    TrainerAssignmentsModule,
    WorkoutPlansModule,
    PlanExercisesModule,
    WorkoutLogsModule,
    ProgressRecordsModule,
    DashboardModule,
    ExternalFitnessModule,
    ReportsModule,
    // Version 2.0 fitness management
    WorkoutCompletionsModule,
    FitnessGoalsModule,
    TrainerFeedbackModule,
  ],
  controllers: [AppController],
  providers: [
    // Guards run in this order for every request:
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // 1. rate limit        -> 429
    { provide: APP_GUARD, useClass: JwtAuthGuard }, //  2. authentication    -> 401
    { provide: APP_GUARD, useClass: RolesGuard }, //    3. role permission   -> 403
  ],
})
export class AppModule {}
