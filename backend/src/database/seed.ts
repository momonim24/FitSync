/**
 * Development seed script — fills the database with FICTIONAL demo data.
 *
 *   npm run db:seed              # only runs when the Users table is empty
 *   npm run db:seed -- --reset   # deletes ALL FitSync rows first (test databases only)
 *   npm run db:seed -- --reset --confirm-reset=fitsync_db   # explicit override for the main database
 *
 * Admin and Trainer accounts cannot be created through public registration,
 * so this script is the secure way to bootstrap them in development.
 * Passwords come from SEED_ADMIN_PASSWORD / SEED_TRAINER_PASSWORD /
 * SEED_MEMBER_PASSWORD in .env. If one is blank, a random password is
 * generated and printed once — nothing is hardcoded in source control.
 */
import '../config/timezone';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { buildDatabaseOptions } from '../config/database.config';
import { Role } from '../common/enums';
import { daysFromToday, localDateOf } from '../common/utils/date.util';
import { Exercise } from '../exercises/entities/exercise.entity';
import { PlanExercise } from '../plan-exercises/entities/plan-exercise.entity';
import { ProgressRecord } from '../progress-records/entities/progress-record.entity';
import { TrainerAssignment } from '../trainer-assignments/entities/trainer-assignment.entity';
import { User } from '../users/entities/user.entity';
import { WorkoutLog } from '../workout-logs/entities/workout-log.entity';
import { WorkoutPlan } from '../workout-plans/entities/workout-plan.entity';
import { FitnessGoal } from '../fitness-goals/entities/fitness-goal.entity';
import { TrainerFeedback } from '../trainer-feedback/entities/trainer-feedback.entity';
import { WorkoutCompletion } from '../workout-completions/entities/workout-completion.entity';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

function resolvePassword(envKey: string): { value: string; generated: boolean } {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) {
    if (!PASSWORD_RULE.test(fromEnv)) {
      throw new Error(`${envKey} must be 8-72 characters and contain a letter and a number.`);
    }
    return { value: fromEnv, generated: false };
  }
  return { value: `${randomBytes(9).toString('base64url')}a1`, generated: true };
}

/** Small deterministic pseudo-random generator so the demo data is repeatable. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXERCISES: Array<Pick<Exercise, 'exerciseName' | 'category' | 'description'>> = [
  { exerciseName: 'Squat', category: 'Strength', description: 'Lower-body exercise targeting quads, glutes and hamstrings.' },
  { exerciseName: 'Bench Press', category: 'Strength', description: 'Horizontal press for chest, shoulders and triceps.' },
  { exerciseName: 'Deadlift', category: 'Strength', description: 'Hip-hinge lift for the posterior chain.' },
  { exerciseName: 'Push-up', category: 'Strength', description: 'Bodyweight press for chest, shoulders and core.' },
  { exerciseName: 'Pull-up', category: 'Strength', description: 'Vertical pull for back and biceps.' },
  { exerciseName: 'Walking Lunges', category: 'Strength', description: 'Unilateral leg exercise that improves balance.' },
  { exerciseName: 'Overhead Press', category: 'Strength', description: 'Standing shoulder press with barbell or dumbbells.' },
  { exerciseName: 'Bent-over Row', category: 'Strength', description: 'Horizontal pull for the upper back.' },
  { exerciseName: 'Plank', category: 'Core', description: 'Core strengthening exercise held in a straight-arm or forearm position.' },
  { exerciseName: 'Crunches', category: 'Core', description: 'Abdominal flexion exercise.' },
  { exerciseName: 'Russian Twist', category: 'Core', description: 'Rotational core exercise.' },
  { exerciseName: 'Treadmill Run', category: 'Cardio', description: 'Steady-state running for aerobic endurance.' },
  { exerciseName: 'Stationary Cycling', category: 'Cardio', description: 'Low-impact cardio on a bike.' },
  { exerciseName: 'Jump Rope', category: 'Cardio', description: 'Skipping rope for coordination and conditioning.' },
  { exerciseName: 'Rowing Machine', category: 'Cardio', description: 'Full-body cardio on an ergometer.' },
  { exerciseName: 'Burpees', category: 'HIIT', description: 'Explosive full-body conditioning movement.' },
  { exerciseName: 'Mountain Climbers', category: 'HIIT', description: 'Fast-paced core and cardio drill.' },
  { exerciseName: 'Yoga Flow', category: 'Flexibility', description: 'Sequence of poses for mobility and recovery.' },
  { exerciseName: 'Hamstring Stretch', category: 'Flexibility', description: 'Static stretch for the back of the legs.' },
];

async function seed() {
  const reset = process.argv.includes('--reset');
  const dataSource = new DataSource(buildDatabaseOptions());
  await dataSource.initialize();

  try {
    const users = dataSource.getRepository(User);
    const existingUsers = await users.count();

    if (existingUsers > 0 && !reset) {
      console.log(
        `The database "${process.env.DB_NAME}" already contains ${existingUsers} user(s); nothing was changed.\n` +
          'To wipe ALL FitSync data and reseed, run: npm run db:seed -- --reset',
      );
      return;
    }

    if (reset) {
      // Safeguard: wiping a database whose name does not contain "test" (for
      // example the main fitsync_db) needs an explicit confirmation that
      // repeats the database name: --confirm-reset=<DB_NAME>.
      const database = String(process.env.DB_NAME ?? 'fitsync_db');
      const confirmed = process.argv.includes(`--confirm-reset=${database}`);
      if (!/test/i.test(database) && !confirmed) {
        console.error(
          `Refusing to reset "${database}": --reset deletes ALL FitSync data.\n` +
            `If you really want to wipe this database, run:\n` +
            `  npm run db:seed -- --reset --confirm-reset=${database}\n` +
            'Test databases (names containing "test") can be reset without confirmation.',
        );
        process.exitCode = 1;
        return;
      }
      console.log(`Removing existing FitSync rows from "${database}" (--reset)...`);
      // Children first so foreign keys are never violated.
      for (const table of [
        'TrainerFeedback',
        'FitnessGoals',
        'WorkoutCompletions',
        'PlanExercises',
        'WorkoutLogs',
        'ProgressRecords',
        'WorkoutPlans',
        'TrainerAssignments',
        'Exercises',
        'Users',
      ]) {
        await dataSource.query(`DELETE FROM \`${table}\``);
        await dataSource.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`);
      }
    }

    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    const adminPw = resolvePassword('SEED_ADMIN_PASSWORD');
    const trainerPw = resolvePassword('SEED_TRAINER_PASSWORD');
    const memberPw = resolvePassword('SEED_MEMBER_PASSWORD');
    const [adminHash, trainerHash, memberHash] = await Promise.all([
      bcrypt.hash(adminPw.value, rounds),
      bcrypt.hash(trainerPw.value, rounds),
      bcrypt.hash(memberPw.value, rounds),
    ]);

    // ---- Users (all fictional) ------------------------------------------
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
    const make = (fullName: string, email: string, role: Role, passwordHash: string, createdDaysAgo: number) =>
      users.create({ fullName, email, role, passwordHash, profileImg: null, isActive: true, createdAt: daysAgo(createdDaysAgo) });

    const admin = await users.save(make('Alex Rivera', 'admin@fitsync.test', Role.Admin, adminHash, 120));
    const [maria, daniel] = await users.save([
      make('Maria Santos', 'maria.santos@fitsync.test', Role.Trainer, trainerHash, 110),
      make('Daniel Lim', 'daniel.lim@fitsync.test', Role.Trainer, trainerHash, 100),
    ]);
    const [juan, ana, mark, bea, carlo] = await users.save([
      make('Juan Dela Cruz', 'juan@fitsync.test', Role.Member, memberHash, 90),
      make('Ana Garcia', 'ana.garcia@fitsync.test', Role.Member, memberHash, 75),
      make('Mark Villanueva', 'mark.villanueva@fitsync.test', Role.Member, memberHash, 60),
      make('Bea Mendoza', 'bea.mendoza@fitsync.test', Role.Member, memberHash, 45),
      make('Carlo Bautista', 'carlo.bautista@fitsync.test', Role.Member, memberHash, 10),
    ]);
    const inactive = await users.save(
      make('Lea Fernandez', 'lea.fernandez@fitsync.test', Role.Member, memberHash, 30),
    );
    inactive.isActive = false;
    await users.save(inactive);

    // ---- Exercises -------------------------------------------------------
    const exercises = await dataSource.getRepository(Exercise).save(EXERCISES);
    const ex = (name: string) => exercises.find((e) => e.exerciseName === name)!;

    // ---- Trainer assignments ---------------------------------------------
    await dataSource.getRepository(TrainerAssignment).save([
      { trainerId: maria.userId, memberId: juan.userId, assignedAt: daysAgo(85) },
      { trainerId: maria.userId, memberId: ana.userId, assignedAt: daysAgo(70) },
      { trainerId: maria.userId, memberId: mark.userId, assignedAt: daysAgo(55) },
      { trainerId: daniel.userId, memberId: mark.userId, assignedAt: daysAgo(50) },
      { trainerId: daniel.userId, memberId: bea.userId, assignedAt: daysAgo(40) },
    ]);

    // ---- Workout plans + plan exercises ------------------------------------
    const planRepo = dataSource.getRepository(WorkoutPlan);
    const planExerciseRepo = dataSource.getRepository(PlanExercise);
    // [exercise, target sets, target reps, target minutes for timed exercises (migration 003)]
    const plans: Array<[User, User, string, Array<[string, number, number, number?]>]> = [
      [maria, juan, 'Beginner Strength Foundations', [['Squat', 3, 12], ['Push-up', 3, 10], ['Bent-over Row', 3, 10], ['Crunches', 3, 15]]],
      [maria, ana, 'Cardio Endurance Builder', [['Treadmill Run', 1, 1, 30], ['Jump Rope', 3, 50], ['Mountain Climbers', 3, 20]]],
      [maria, mark, 'Lower Body Strength', [['Deadlift', 4, 6], ['Walking Lunges', 3, 12], ['Squat', 4, 8]]],
      [daniel, mark, 'Upper Body Power', [['Bench Press', 4, 8], ['Pull-up', 4, 6], ['Overhead Press', 3, 10]]],
      [daniel, bea, 'Core & Mobility', [['Plank', 3, 1, 3], ['Russian Twist', 3, 20], ['Yoga Flow', 1, 1, 20], ['Hamstring Stretch', 2, 3]]],
    ];
    let planOffset = 80;
    for (const [trainer, member, planName, items] of plans) {
      const plan = await planRepo.save({ trainerId: trainer.userId, memberId: member.userId, planName, createdAt: daysAgo(planOffset) });
      planOffset -= 10;
      await planExerciseRepo.save(
        items.map(([name, targetSets, targetReps, minutes]) => ({ planId: plan.planId, exerciseId: ex(name).exerciseId, targetSets, targetReps, targetDurationMinutes: minutes ?? null })),
      );
    }

    // ---- Workout logs (last 6 weeks) --------------------------------------
    const random = createRandom(116);
    const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
    const routines: Array<[User, string[], number]> = [
      [juan, ['Squat', 'Push-up', 'Bent-over Row', 'Crunches', 'Treadmill Run'], 0.55],
      [ana, ['Treadmill Run', 'Jump Rope', 'Mountain Climbers', 'Stationary Cycling', 'Plank'], 0.6],
      [mark, ['Deadlift', 'Bench Press', 'Pull-up', 'Overhead Press', 'Walking Lunges', 'Squat'], 0.5],
      [bea, ['Plank', 'Russian Twist', 'Yoga Flow', 'Hamstring Stretch', 'Rowing Machine'], 0.45],
      [carlo, ['Push-up', 'Jump Rope'], 0.15],
    ];
    const logs: Partial<WorkoutLog>[] = [];
    for (const [member, names, frequency] of routines) {
      for (let day = 41; day >= 0; day--) {
        if (random() > frequency) continue;
        const count = 1 + Math.floor(random() * 3);
        for (let i = 0; i < count; i++) {
          const exercise = ex(pick(names));
          const isCardio = ['Cardio', 'Flexibility'].includes(exercise.category);
          logs.push({
            memberId: member.userId,
            exerciseId: exercise.exerciseId,
            workoutDate: daysFromToday(-day),
            sets: isCardio ? 1 : 3 + Math.floor(random() * 2),
            repetitions: isCardio ? 0 : 8 + Math.floor(random() * 5),
            durationMinutes: isCardio ? 20 + Math.floor(random() * 25) : 10 + Math.floor(random() * 11),
          });
        }
      }
    }
    await dataSource.getRepository(WorkoutLog).save(logs, { chunk: 100 });

    // ---- Progress records (weekly) ----------------------------------------
    const progress: Partial<ProgressRecord>[] = [];
    const weightPlans: Array<[User, number, number, string[]]> = [
      [juan, 78.4, -0.5, ['Started the strength plan', 'Squat form improving', 'Improved endurance']],
      [ana, 62.0, -0.3, ['Ran 5 km without stopping', 'Feeling more energetic']],
      [mark, 84.6, -0.25, ['New deadlift personal record', 'Better sleep this week']],
      [bea, 57.8, 0.1, ['Hip mobility improved', 'Holding plank longer']],
    ];
    for (const [member, start, weeklyChange, notes] of weightPlans) {
      for (let week = 7; week >= 0; week--) {
        const step = 7 - week;
        const noise = (random() - 0.5) * 0.4;
        progress.push({
          memberId: member.userId,
          recordDate: daysFromToday(-week * 7),
          weightKg: Math.round((start + weeklyChange * step + noise) * 10) / 10,
          notes: step % 3 === 0 ? notes[(step / 3) % notes.length] : null,
        });
      }
    }
    await dataSource.getRepository(ProgressRecord).save(progress);

    // ======================================================================
    // Version 2.0 demo data (fictional). A SEPARATE random generator keeps the
    // original seven tables exactly as before.
    // ======================================================================
    const random2 = createRandom(2026);

    // ---- Workout completions: count most plan-matching workouts toward the plan
    const savedPlans = await planRepo.find({ relations: { planExercises: true } });
    const savedLogs = await dataSource.getRepository(WorkoutLog).find({ order: { workoutDate: 'ASC', logId: 'ASC' } });
    const completionRepo = dataSource.getRepository(WorkoutCompletion);
    const completions: Partial<WorkoutCompletion>[] = [];
    const linked = new Set<number>();
    for (const plan of savedPlans) {
      const countsFrom = localDateOf(plan.createdAt);
      for (const pe of plan.planExercises ?? []) {
        for (const log of savedLogs) {
          if (log.memberId !== plan.memberId || log.exerciseId !== pe.exerciseId || log.workoutDate < countsFrom || linked.has(log.logId)) continue;
          if (random2() > 0.75) continue; // some workouts are done outside the plan
          linked.add(log.logId);
          completions.push({ createdAt: new Date(`${log.workoutDate}T12:00:00Z`), logId: log.logId, planExerciseId: pe.planExerciseId, planId: plan.planId, planName: plan.planName, prescribedSets: pe.targetSets, prescribedReps: pe.targetReps, prescribedDurationMinutes: pe.targetDurationMinutes });
        }
      }
    }
    await completionRepo.save(completions, { chunk: 100 });

    // ---- Fitness goals (weekly goals run whole 7-day weeks) --------------------
    const goal = (member: User, goalType: FitnessGoal['goalType'], goalName: string, targetValue: number, startOffset: number, days: number, startingValue: number | null = null, status: FitnessGoal['status'] = 'Active') => ({
      memberId: member.userId,
      goalType,
      goalName,
      startingValue,
      targetValue,
      startDate: daysFromToday(startOffset),
      targetDate: daysFromToday(startOffset + days - 1),
      status,
      closedAt: status === 'Active' ? null : daysAgo(5),
      createdAt: daysAgo(Math.max(0, -startOffset)),
      updatedAt: daysAgo(status === 'Active' ? Math.max(0, -startOffset) : 5),
    });
    const goalRepo = dataSource.getRepository(FitnessGoal);
    const goals = await goalRepo.save([
      goal(juan, 'TargetWeight', 'Reach 74 kg', 74, -42, 100, 78.4),
      goal(juan, 'WeeklyWorkouts', 'Train 3 days a week', 3, -35, 56),
      goal(ana, 'WeeklyMinutes', '150 active minutes a week', 150, -28, 42),
      goal(ana, 'TargetWeight', 'Reach 60 kg', 60, -60, 90, 62.5, 'Cancelled'),
      goal(mark, 'TargetWeight', 'Get down to 83 kg', 83, -49, 77, 84.6),
      goal(bea, 'TargetWeight', 'Gain 0.6 kg of muscle', 58.4, -42, 84, 57.8),
      goal(bea, 'WeeklyWorkouts', 'Four mobility days a week', 4, -14, 28),
      goal(carlo, 'WeeklyWorkouts', 'Work out twice a week', 2, -21, 28),
    ]);
    const goalOf = (member: User, type: FitnessGoal['goalType']) => goals.find((g) => g.memberId === member.userId && g.goalType === type && g.status === 'Active')!;

    // ---- Trainer feedback (some read, some new) ------------------------------
    const planOf = (member: User, trainer: User) => savedPlans.find((p) => p.memberId === member.userId && p.trainerId === trainer.userId)!;
    const note = (trainer: User, member: User, feedbackType: TrainerFeedback['feedbackType'], feedbackMessage: string, daysBack: number, read: boolean, about?: { goal?: FitnessGoal; plan?: WorkoutPlan }) => ({
      trainerId: trainer.userId,
      memberId: member.userId,
      feedbackType,
      feedbackMessage,
      relatedGoalId: about?.goal?.goalId ?? null,
      relatedPlanId: about?.plan?.planId ?? null,
      createdAt: daysAgo(daysBack),
      updatedAt: daysAgo(daysBack),
      readAt: read ? daysAgo(Math.max(0, daysBack - 1)) : null,
    });
    const feedback = await dataSource.getRepository(TrainerFeedback).save([
      note(maria, juan, 'Encouragement', 'Great consistency over the last two weeks. Keep the three training days going!', 9, true, { goal: goalOf(juan, 'WeeklyWorkouts') }),
      note(maria, juan, 'Guidance', 'On squats, aim for the full 12 reps before adding weight. Log each session from your plan so we can track it.', 3, false, { plan: planOf(juan, maria) }),
      note(maria, juan, 'General', 'Your weight trend is moving in the right direction. Remember to record your weight once a week.', 1, false, { goal: goalOf(juan, 'TargetWeight') }),
      note(maria, ana, 'Encouragement', 'Excellent cardio volume this month.', 6, true, { plan: planOf(ana, maria) }),
      note(maria, mark, 'Guidance', 'Deadlift technique looked solid. Keep rest periods around two minutes.', 4, false, { plan: planOf(mark, maria) }),
      note(daniel, mark, 'General', 'Upper body plan updated next week — keep logging your pull-ups.', 2, true, { plan: planOf(mark, daniel) }),
      note(daniel, bea, 'Concern', 'You missed a few mobility days last week. Let me know if the schedule needs adjusting.', 5, false, { goal: goalOf(bea, 'WeeklyWorkouts') }),
    ]);

    console.log('\nFitSync demo data created (fictional).');
    console.log(`  ${await users.count()} users, ${exercises.length} exercises, ${plans.length} plans, ${logs.length} workout logs, ${progress.length} progress records\n`);
    console.log(`  Version 2.0: ${completions.length} workout completions, ${goals.length} fitness goals, ${feedback.length} trainer feedback entries\n`);
    console.log('Demo accounts:');
    const show = (label: string, emails: string[], pw: { value: string; generated: boolean }) =>
      console.log(`  ${label.padEnd(8)} ${emails.join(', ')}\n           password: ${pw.generated ? pw.value + '   (generated — save it now, it is not stored anywhere)' : '(value of the matching SEED_*_PASSWORD in .env)'}`);
    show('Admin', [admin.email], adminPw);
    show('Trainer', [maria.email, daniel.email], trainerPw);
    show('Member', [juan.email, ana.email, mark.email, bea.email, carlo.email], memberPw);
    console.log(`  Inactive demo member (login is rejected): ${inactive.email}`);
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: Error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
