-- =====================================================================
-- FitSync migration 003 — Duration targets for timed plan exercises
-- (Version 2.0 quality update)
--
-- Purpose
--   Lab 04 prescribes every plan exercise as TargetSets × TargetReps (both
--   NOT NULL, > 0). Timed exercises (plank, treadmill run, yoga flow) have
--   no meaningful repetition count, so they could only be completed by
--   logging artificial repetitions. This migration adds an OPTIONAL total
--   duration target. When it is set, completion compares sets and minutes
--   and ignores repetitions; when it is NULL (every existing row) the
--   original repetition-based rule applies unchanged.
--
-- Safety
--   * Additive only: two NULL-able columns and two CHECK constraints.
--     Existing rows keep NULL, so their behaviour does not change.
--   * TargetSets / TargetReps keep their Lab 04 definition (NOT NULL, > 0).
--   * Apply with `cd backend && npm run db:migrate` (checks
--     information_schema first; safe to run repeatedly), or run each
--     statement once in phpMyAdmin.
-- =====================================================================

ALTER TABLE PlanExercises
  ADD COLUMN TargetDurationMinutes INT NULL COMMENT 'Total minutes for a timed exercise; NULL = repetition-based';

ALTER TABLE PlanExercises
  ADD CONSTRAINT CHK_PlanExercises_TargetDuration CHECK (TargetDurationMinutes IS NULL OR TargetDurationMinutes > 0);

-- Snapshot of the duration target when a workout is counted (history).
ALTER TABLE WorkoutCompletions
  ADD COLUMN PrescribedDurationMinutes INT NULL COMMENT 'Snapshot of TargetDurationMinutes; NULL = repetition-based';

ALTER TABLE WorkoutCompletions
  ADD CONSTRAINT CHK_WorkoutCompletions_PrescribedDuration CHECK (PrescribedDurationMinutes IS NULL OR PrescribedDurationMinutes > 0);
