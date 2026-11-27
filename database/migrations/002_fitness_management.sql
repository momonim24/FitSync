-- =====================================================================
-- FitSync migration 002 — Fitness management (Version 2.0)
--
-- Purpose
--   Adds normalized tables for the Version 2.0 enhancements. They EXTEND
--   the Lab 04 design: the original seven tables, their columns and their
--   rows are not changed.
--
--     WorkoutCompletions  links a WorkoutLogs row to the PlanExercises row
--                         it fulfils (workout plan completion tracking)
--     FitnessGoals        member goals (target weight, weekly workouts,
--                         weekly minutes) measured from existing data
--     TrainerFeedback     trainer notes to assigned members, optionally about
--                         a goal or plan, with read receipts
--
-- Safety
--   * Additive only: CREATE TABLE IF NOT EXISTS. Nothing is dropped,
--     renamed, altered or rewritten, and no existing row is touched.
--   * Repeatable: running the file again skips tables that already exist.
--   * Apply with `cd backend && npm run db:migrate` (applies 001 and 002,
--     logs every step), or run this file once in phpMyAdmin / mysql.
--   * MySQL 8 forbids CHECK constraints on columns that have foreign-key
--     referential actions, so rules that involve FK columns (for example
--     "a log can only count toward the member's own plan") are enforced by
--     the API instead. Every CHECK below uses non-FK columns only and works
--     on both MySQL 8 and MariaDB 10.4+.
-- =====================================================================

-- ---------------------------------------------------------------------
-- WorkoutCompletions: one workout log counted toward one prescribed plan
-- exercise. Completion status is derived from the linked log's actual sets
-- and repetitions compared with the prescription copied here.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkoutCompletions (
  CompletionID    INT           NOT NULL AUTO_INCREMENT,
  -- The workout that was performed. Deleting the log deletes the link, so
  -- completion is recalculated automatically.
  LogID           INT           NOT NULL,
  -- The prescription it fulfils. NULL once the trainer removes the exercise
  -- from the plan or deletes the plan (the history row is kept).
  PlanExerciseID  INT           NULL,
  PlanID          INT           NULL,
  -- Snapshot of the prescription when the workout was counted, so history
  -- keeps its meaning after the plan is edited or deleted.
  PlanNameSnapshot VARCHAR(100) NOT NULL,
  PrescribedSets  INT           NOT NULL,
  PrescribedReps  INT           NOT NULL,
  CreatedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT PK_WorkoutCompletions PRIMARY KEY (CompletionID),
  -- A workout counts toward at most one prescription (no double counting).
  CONSTRAINT UQ_WorkoutCompletions_Log UNIQUE (LogID),
  CONSTRAINT FK_WorkoutCompletions_Log FOREIGN KEY (LogID)
    REFERENCES WorkoutLogs (LogID) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT FK_WorkoutCompletions_PlanExercise FOREIGN KEY (PlanExerciseID)
    REFERENCES PlanExercises (PlanExerciseID) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT FK_WorkoutCompletions_Plan FOREIGN KEY (PlanID)
    REFERENCES WorkoutPlans (PlanID) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT CHK_WorkoutCompletions_PrescribedSets CHECK (PrescribedSets > 0),
  CONSTRAINT CHK_WorkoutCompletions_PrescribedReps CHECK (PrescribedReps > 0),
  INDEX IX_WorkoutCompletions_PlanExercise (PlanExerciseID),
  INDEX IX_WorkoutCompletions_Plan (PlanID)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- FitnessGoals: a member's goal. Progress is CALCULATED from existing
-- WorkoutLogs / ProgressRecords (nothing is entered twice); only the goal
-- definition and its lifecycle status are stored.
--   TargetWeight    StartingValue/TargetValue in kg (loss or gain)
--   WeeklyWorkouts  TargetValue = workout days per 7-day goal week
--   WeeklyMinutes   TargetValue = training minutes per 7-day goal week
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS FitnessGoals (
  GoalID         INT           NOT NULL AUTO_INCREMENT,
  MemberID       INT           NOT NULL,
  GoalType       VARCHAR(20)   NOT NULL,
  GoalName       VARCHAR(100)  NOT NULL,
  StartingValue  DECIMAL(6,2)  NULL,
  TargetValue    DECIMAL(6,2)  NOT NULL,
  StartDate      DATE          NOT NULL,
  TargetDate     DATE          NOT NULL,
  Status         VARCHAR(10)   NOT NULL DEFAULT 'Active',
  -- When the goal left Active (Completed, Missed or Cancelled).
  ClosedAt       DATETIME      NULL,
  CreatedAt      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT PK_FitnessGoals PRIMARY KEY (GoalID),
  CONSTRAINT FK_FitnessGoals_Member FOREIGN KEY (MemberID)
    REFERENCES Users (UserID) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT CHK_FitnessGoals_Type CHECK (GoalType IN ('TargetWeight', 'WeeklyWorkouts', 'WeeklyMinutes')),
  CONSTRAINT CHK_FitnessGoals_Status CHECK (Status IN ('Active', 'Completed', 'Missed', 'Cancelled')),
  CONSTRAINT CHK_FitnessGoals_Target CHECK (TargetValue > 0),
  CONSTRAINT CHK_FitnessGoals_Starting CHECK (StartingValue IS NULL OR StartingValue > 0),
  CONSTRAINT CHK_FitnessGoals_WeightStart CHECK (GoalType <> 'TargetWeight' OR StartingValue IS NOT NULL),
  CONSTRAINT CHK_FitnessGoals_Dates CHECK (TargetDate > StartDate),
  INDEX IX_FitnessGoals_Member_Status (MemberID, Status)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- TrainerFeedback: a trainer's note to an assigned member, optionally about
-- one of the member's goals or workout plans. Not a chat: members read and
-- acknowledge (ReadAt); only the author edits or deletes.
-- Trainer/member roles, the assignment, "goal/plan belongs to this member"
-- and "at most one of goal/plan" are enforced by the API (FK columns).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TrainerFeedback (
  FeedbackID       INT            NOT NULL AUTO_INCREMENT,
  TrainerID        INT            NOT NULL,
  MemberID         INT            NOT NULL,
  RelatedGoalID    INT            NULL,
  RelatedPlanID    INT            NULL,
  FeedbackType     VARCHAR(15)    NOT NULL,
  FeedbackMessage  VARCHAR(1000)  NOT NULL,
  CreatedAt        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UpdatedAt        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ReadAt           DATETIME       NULL,
  CONSTRAINT PK_TrainerFeedback PRIMARY KEY (FeedbackID),
  CONSTRAINT FK_TrainerFeedback_Trainer FOREIGN KEY (TrainerID)
    REFERENCES Users (UserID) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT FK_TrainerFeedback_Member FOREIGN KEY (MemberID)
    REFERENCES Users (UserID) ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Feedback history outlives the goal/plan it referred to.
  CONSTRAINT FK_TrainerFeedback_Goal FOREIGN KEY (RelatedGoalID)
    REFERENCES FitnessGoals (GoalID) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT FK_TrainerFeedback_Plan FOREIGN KEY (RelatedPlanID)
    REFERENCES WorkoutPlans (PlanID) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT CHK_TrainerFeedback_Type CHECK (FeedbackType IN ('General', 'Encouragement', 'Guidance', 'Concern')),
  CONSTRAINT CHK_TrainerFeedback_Message CHECK (CHAR_LENGTH(FeedbackMessage) >= 2),
  INDEX IX_TrainerFeedback_Member_Created (MemberID, CreatedAt),
  INDEX IX_TrainerFeedback_Trainer_Created (TrainerID, CreatedAt),
  INDEX IX_TrainerFeedback_Goal (RelatedGoalID),
  INDEX IX_TrainerFeedback_Plan (RelatedPlanID)
) ENGINE = InnoDB;
