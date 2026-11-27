-- =====================================================================
-- FitSync: Fitness Activity Monitoring and Management System
-- MySQL schema (Laboratory Activity 04 data dictionary + Version 2.0 extensions)
--
-- Usage:
--   mysql -u root -p < database/schema.sql
--   or: cd backend && npm run db:init   (uses DB_* values from backend/.env)
--
-- Safe to run more than once: every statement uses IF NOT EXISTS and
-- no table is dropped. Table and column names follow Lab 04 exactly;
-- the API exposes them in camelCase (e.g. FullName -> fullName,
-- ProfileImage -> profileImg).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS fitsync_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fitsync_db;

-- ---------------------------------------------------------------------
-- Users: members, trainers and administrators
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Users (
  UserID        INT           NOT NULL AUTO_INCREMENT,
  FullName      VARCHAR(100)  NOT NULL,
  Email         VARCHAR(100)  NOT NULL,
  Role          VARCHAR(10)   NOT NULL,
  CreatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PasswordHash  VARCHAR(255)  NOT NULL,
  ProfileImage  VARCHAR(255)  NULL,
  IsActive      BOOLEAN       NOT NULL DEFAULT TRUE,
  CONSTRAINT PK_Users PRIMARY KEY (UserID),
  CONSTRAINT UQ_Users_Email UNIQUE (Email),
  CONSTRAINT CHK_Users_Role CHECK (Role IN ('Member', 'Trainer', 'Admin'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- TrainerAssignments: which trainer monitors which member
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS TrainerAssignments (
  AssignmentID  INT       NOT NULL AUTO_INCREMENT,
  TrainerID     INT       NOT NULL,
  MemberID      INT       NOT NULL,
  AssignedAt    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT PK_TrainerAssignments PRIMARY KEY (AssignmentID),
  -- Addition: a trainer can only be assigned to the same member once (Lab 05 409 response)
  CONSTRAINT UQ_TrainerAssignments_Pair UNIQUE (TrainerID, MemberID),
  CONSTRAINT FK_TrainerAssignments_Trainer FOREIGN KEY (TrainerID)
    REFERENCES Users (UserID) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT FK_TrainerAssignments_Member FOREIGN KEY (MemberID)
    REFERENCES Users (UserID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- Exercises: exercise catalog managed by administrators
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Exercises (
  ExerciseID    INT           NOT NULL AUTO_INCREMENT,
  ExerciseName  VARCHAR(100)  NOT NULL,
  Category      VARCHAR(100)  NOT NULL,
  Description   VARCHAR(255)  NULL,
  -- Extension (migration 001, External Fitness API): source and licence
  -- attribution of exercises imported from wger. All NULL for local exercises.
  -- Existing databases get these columns with `npm run db:migrate`.
  ExternalSource VARCHAR(20)  NULL,
  ExternalID     INT          NULL,
  SourceUrl      VARCHAR(255) NULL,
  LicenseName    VARCHAR(100) NULL,
  LicenseUrl     VARCHAR(255) NULL,
  LicenseAuthor  VARCHAR(255) NULL,
  ImportedAt     DATETIME     NULL,
  CONSTRAINT PK_Exercises PRIMARY KEY (ExerciseID),
  CONSTRAINT UQ_Exercises_External UNIQUE (ExternalSource, ExternalID),
  CONSTRAINT CHK_Exercises_ExternalPair CHECK (
    (ExternalSource IS NULL AND ExternalID IS NULL) OR (ExternalSource IS NOT NULL AND ExternalID IS NOT NULL))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- WorkoutPlans: plans created by a trainer for an assigned member
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkoutPlans (
  PlanID     INT           NOT NULL AUTO_INCREMENT,
  TrainerID  INT           NOT NULL,
  MemberID   INT           NOT NULL,
  PlanName   VARCHAR(100)  NOT NULL,
  CreatedAt  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT PK_WorkoutPlans PRIMARY KEY (PlanID),
  CONSTRAINT FK_WorkoutPlans_Trainer FOREIGN KEY (TrainerID)
    REFERENCES Users (UserID) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT FK_WorkoutPlans_Member FOREIGN KEY (MemberID)
    REFERENCES Users (UserID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- PlanExercises: exercises included in a workout plan (with targets)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PlanExercises (
  PlanExerciseID  INT  NOT NULL AUTO_INCREMENT,
  PlanID          INT  NOT NULL,
  ExerciseID      INT  NOT NULL,
  TargetSets      INT  NOT NULL,
  TargetReps      INT  NOT NULL,
  -- Extension (migration 003): total minutes for a TIMED exercise; NULL =
  -- repetition-based (every Lab 04 row). When set, completion compares sets
  -- and minutes and ignores repetitions.
  TargetDurationMinutes INT NULL COMMENT 'Total minutes for a timed exercise; NULL = repetition-based',
  CONSTRAINT PK_PlanExercises PRIMARY KEY (PlanExerciseID),
  CONSTRAINT FK_PlanExercises_Plan FOREIGN KEY (PlanID)
    REFERENCES WorkoutPlans (PlanID) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT FK_PlanExercises_Exercise FOREIGN KEY (ExerciseID)
    REFERENCES Exercises (ExerciseID) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT CHK_PlanExercises_TargetSets CHECK (TargetSets > 0),
  CONSTRAINT CHK_PlanExercises_TargetReps CHECK (TargetReps > 0),
  CONSTRAINT CHK_PlanExercises_TargetDuration CHECK (TargetDurationMinutes IS NULL OR TargetDurationMinutes > 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- WorkoutLogs: workouts recorded by members
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkoutLogs (
  LogID            INT   NOT NULL AUTO_INCREMENT,
  MemberID         INT   NOT NULL,
  ExerciseID       INT   NOT NULL,
  WorkoutDate      DATE  NOT NULL,
  Sets             INT   NOT NULL,
  Repetitions      INT   NOT NULL,
  DurationMinutes  INT   NOT NULL,
  CONSTRAINT PK_WorkoutLogs PRIMARY KEY (LogID),
  CONSTRAINT FK_WorkoutLogs_Member FOREIGN KEY (MemberID)
    REFERENCES Users (UserID) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT FK_WorkoutLogs_Exercise FOREIGN KEY (ExerciseID)
    REFERENCES Exercises (ExerciseID) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT CHK_WorkoutLogs_Sets CHECK (Sets > 0),
  CONSTRAINT CHK_WorkoutLogs_Repetitions CHECK (Repetitions >= 0),
  CONSTRAINT CHK_WorkoutLogs_Duration CHECK (DurationMinutes >= 0),
  INDEX IX_WorkoutLogs_Member_Date (MemberID, WorkoutDate)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- ProgressRecords: body weight and notes recorded by members
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ProgressRecords (
  ProgressID  INT           NOT NULL AUTO_INCREMENT,
  MemberID    INT           NOT NULL,
  RecordDate  DATE          NOT NULL,
  WeightKg    DECIMAL(5,2)  NULL,
  Notes       VARCHAR(255)  NULL,
  CONSTRAINT PK_ProgressRecords PRIMARY KEY (ProgressID),
  CONSTRAINT FK_ProgressRecords_Member FOREIGN KEY (MemberID)
    REFERENCES Users (UserID) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT CHK_ProgressRecords_Weight CHECK (WeightKg IS NULL OR WeightKg > 0),
  INDEX IX_ProgressRecords_Member_Date (MemberID, RecordDate)
) ENGINE = InnoDB;

-- =====================================================================
-- Version 2.0 extension tables (migration 002, fitness management).
-- They extend the Lab 04 design; existing databases get them with
-- `npm run db:migrate`. Rules that involve foreign-key columns are
-- enforced by the API (MySQL 8 forbids CHECKs on columns with FK actions).
-- =====================================================================

-- ---------------------------------------------------------------------
-- WorkoutCompletions: a workout log counted toward a prescribed plan exercise
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkoutCompletions (
  CompletionID    INT           NOT NULL AUTO_INCREMENT,
  LogID           INT           NOT NULL,
  PlanExerciseID  INT           NULL,
  PlanID          INT           NULL,
  PlanNameSnapshot VARCHAR(100) NOT NULL,
  PrescribedSets  INT           NOT NULL,
  PrescribedReps  INT           NOT NULL,
  CreatedAt       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PrescribedDurationMinutes INT NULL COMMENT 'Snapshot of TargetDurationMinutes; NULL = repetition-based',
  CONSTRAINT PK_WorkoutCompletions PRIMARY KEY (CompletionID),
  CONSTRAINT UQ_WorkoutCompletions_Log UNIQUE (LogID),
  CONSTRAINT FK_WorkoutCompletions_Log FOREIGN KEY (LogID)
    REFERENCES WorkoutLogs (LogID) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT FK_WorkoutCompletions_PlanExercise FOREIGN KEY (PlanExerciseID)
    REFERENCES PlanExercises (PlanExerciseID) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT FK_WorkoutCompletions_Plan FOREIGN KEY (PlanID)
    REFERENCES WorkoutPlans (PlanID) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT CHK_WorkoutCompletions_PrescribedSets CHECK (PrescribedSets > 0),
  CONSTRAINT CHK_WorkoutCompletions_PrescribedReps CHECK (PrescribedReps > 0),
  CONSTRAINT CHK_WorkoutCompletions_PrescribedDuration CHECK (PrescribedDurationMinutes IS NULL OR PrescribedDurationMinutes > 0),
  INDEX IX_WorkoutCompletions_PlanExercise (PlanExerciseID),
  INDEX IX_WorkoutCompletions_Plan (PlanID)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- FitnessGoals: member goals; progress is calculated from logs and records
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
-- TrainerFeedback: trainer notes to assigned members (read receipts, no chat)
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
