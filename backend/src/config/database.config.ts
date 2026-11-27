import { DataSourceOptions } from 'typeorm';
import { UtcTimestampsSubscriber } from '../common/utc-timestamps.subscriber';
import { Exercise } from '../exercises/entities/exercise.entity';
import { PlanExercise } from '../plan-exercises/entities/plan-exercise.entity';
import { ProgressRecord } from '../progress-records/entities/progress-record.entity';
import { TrainerAssignment } from '../trainer-assignments/entities/trainer-assignment.entity';
import { User } from '../users/entities/user.entity';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';
import { WorkoutCompletion } from '../workout-completions/entities/workout-completion.entity';
import { FitnessGoal } from '../fitness-goals/entities/fitness-goal.entity';
import { TrainerFeedback } from '../trainer-feedback/entities/trainer-feedback.entity';

/** The seven Lab 04 entities plus the Version 2.0 extension entities (migration 002). */
export const ENTITIES = [
  User,
  TrainerAssignment,
  Exercise,
  WorkoutPlan,
  PlanExercise,
  WorkoutLog,
  ProgressRecord,
  WorkoutCompletion,
  FitnessGoal,
  TrainerFeedback,
];

/**
 * Builds the TypeORM MySQL connection options from environment variables.
 * Shared by the NestJS app, the seed script and the e2e tests so they all
 * connect the same way.
 */
export function buildDatabaseOptions(
  env: NodeJS.ProcessEnv = process.env,
): DataSourceOptions {
  return {
    type: 'mysql',
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 3306),
    username: env.DB_USERNAME ?? 'root',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME ?? 'fitsync_db',
    entities: ENTITIES,
    // Every CreatedAt / UpdatedAt is written by the app as a UTC instant.
    subscribers: [UtcTimestampsSubscriber],
    // The schema is owned by database/schema.sql (npm run db:init), so TypeORM
    // never alters tables automatically.
    synchronize: false,
    // Store and read DATETIME values as UTC (the subscriber makes sure the
    // app, not MySQL's CURRENT_TIMESTAMP default, provides them).
    timezone: 'Z',
    // Return DATE columns as 'YYYY-MM-DD' strings (no timezone shifting).
    dateStrings: ['DATE'],
    charset: 'utf8mb4_unicode_ci',
    logging: env.DB_LOGGING === 'true',
  };
}
