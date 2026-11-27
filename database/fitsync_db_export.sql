-- =====================================================================
-- FitSync: Fitness Activity Monitoring and Management System
-- Database export for submission (final Version 2.0 schema + fictional demo data)
--
-- Source      : fitsync_db (10.4.32-MariaDB), exported 2026-11-26
-- Contents    : 10 tables with primary keys, foreign keys, UNIQUE and CHECK
--               constraints and indexes:
--                 7 Lab 04 tables (Users, TrainerAssignments, Exercises,
--                 WorkoutPlans, PlanExercises, WorkoutLogs, ProgressRecords)
--                 migration 001: external exercise source columns (Exercises)
--                 migration 002: WorkoutCompletions, FitnessGoals,
--                                TrainerFeedback (Version 2.0)
--                 migration 003: duration targets for timed exercises
--                                (PlanExercises / WorkoutCompletions)
-- Demo data   : all accounts are fictional (@fitsync.test). One real account
--               registered through the app, and every row linked to it, was
--               EXCLUDED from this file. The Version 2.0 tables have no rows
--               in fitsync_db yet; run the seed script for Version 2.0 demo data.
-- Timestamps  : DATETIME values are UTC instants (the app displays them in
--               Asia/Manila time).
-- Passwords   : stored only as bcrypt hashes (PasswordHash); no plaintext
--               passwords, JWT secrets, tokens or other credentials.
--
-- Restore (replaces the FitSync tables in fitsync_db):
--   mysql -u root -p < database/fitsync_db_export.sql
--   or phpMyAdmin > Import. Tables are dropped and recreated if they exist.
-- To log in with your own demo passwords instead, run
--   cd backend && npm run db:seed -- --reset
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `fitsync_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `fitsync_db`;

-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: fitsync_export_stage
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Exercises`
--

DROP TABLE IF EXISTS `Exercises`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Exercises` (
  `ExerciseID` int(11) NOT NULL AUTO_INCREMENT,
  `ExerciseName` varchar(100) NOT NULL,
  `Category` varchar(100) NOT NULL,
  `Description` varchar(255) DEFAULT NULL,
  `ExternalSource` varchar(20) DEFAULT NULL COMMENT 'Provider of imported content, e.g. wger; NULL = local exercise',
  `ExternalID` int(11) DEFAULT NULL COMMENT 'Exercise ID at the external provider',
  `SourceUrl` varchar(255) DEFAULT NULL COMMENT 'Public page of the original exercise',
  `LicenseName` varchar(100) DEFAULT NULL COMMENT 'Licence of the imported text, e.g. CC-BY-SA 4',
  `LicenseUrl` varchar(255) DEFAULT NULL COMMENT 'Link to the licence text',
  `LicenseAuthor` varchar(255) DEFAULT NULL COMMENT 'Author(s) credited by the provider',
  `ImportedAt` datetime DEFAULT NULL COMMENT 'When an administrator imported the exercise (UTC)',
  PRIMARY KEY (`ExerciseID`),
  UNIQUE KEY `UQ_Exercises_External` (`ExternalSource`,`ExternalID`),
  CONSTRAINT `CHK_Exercises_ExternalPair` CHECK (`ExternalSource` is null and `ExternalID` is null or `ExternalSource` is not null and `ExternalID` is not null)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Exercises`
--

LOCK TABLES `Exercises` WRITE;
/*!40000 ALTER TABLE `Exercises` DISABLE KEYS */;
INSERT INTO `Exercises` VALUES (1,'Squat','Strength','Lower-body exercise targeting quads, glutes and hamstrings.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(2,'Bench Press','Strength','Horizontal press for chest, shoulders and triceps.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(3,'Deadlift','Strength','Hip-hinge lift for the posterior chain.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(4,'Push-up','Strength','Bodyweight press for chest, shoulders and core.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(5,'Pull-up','Strength','Vertical pull for back and biceps.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(6,'Walking Lunges','Strength','Unilateral leg exercise that improves balance.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(7,'Overhead Press','Strength','Standing shoulder press with barbell or dumbbells.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(8,'Bent-over Row','Strength','Horizontal pull for the upper back.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(9,'Plank','Core','Core strengthening exercise held in a straight-arm or forearm position.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(10,'Crunches','Core','Abdominal flexion exercise.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(11,'Russian Twist','Core','Rotational core exercise.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(12,'Treadmill Run','Cardio','Steady-state running for aerobic endurance.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(13,'Stationary Cycling','Cardio','Low-impact cardio on a bike.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(14,'Jump Rope','Cardio','Skipping rope for coordination and conditioning.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(15,'Rowing Machine','Cardio','Full-body cardio on an ergometer.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(16,'Burpees','HIIT','Explosive full-body conditioning movement.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(17,'Mountain Climbers','HIIT','Fast-paced core and cardio drill.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(18,'Yoga Flow','Flexibility','Sequence of poses for mobility and recovery.',NULL,NULL,NULL,NULL,NULL,NULL,NULL),(19,'Hamstring Stretch','Flexibility','Static stretch for the back of the legs.',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `Exercises` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `FitnessGoals`
--

DROP TABLE IF EXISTS `FitnessGoals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `FitnessGoals` (
  `GoalID` int(11) NOT NULL AUTO_INCREMENT,
  `MemberID` int(11) NOT NULL,
  `GoalType` varchar(20) NOT NULL,
  `GoalName` varchar(100) NOT NULL,
  `StartingValue` decimal(6,2) DEFAULT NULL,
  `TargetValue` decimal(6,2) NOT NULL,
  `StartDate` date NOT NULL,
  `TargetDate` date NOT NULL,
  `Status` varchar(10) NOT NULL DEFAULT 'Active',
  `ClosedAt` datetime DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  `UpdatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`GoalID`),
  KEY `IX_FitnessGoals_Member_Status` (`MemberID`,`Status`),
  CONSTRAINT `FK_FitnessGoals_Member` FOREIGN KEY (`MemberID`) REFERENCES `Users` (`UserID`) ON UPDATE CASCADE,
  CONSTRAINT `CHK_FitnessGoals_Type` CHECK (`GoalType` in ('TargetWeight','WeeklyWorkouts','WeeklyMinutes')),
  CONSTRAINT `CHK_FitnessGoals_Status` CHECK (`Status` in ('Active','Completed','Missed','Cancelled')),
  CONSTRAINT `CHK_FitnessGoals_Target` CHECK (`TargetValue` > 0),
  CONSTRAINT `CHK_FitnessGoals_Starting` CHECK (`StartingValue` is null or `StartingValue` > 0),
  CONSTRAINT `CHK_FitnessGoals_WeightStart` CHECK (`GoalType` <> 'TargetWeight' or `StartingValue` is not null),
  CONSTRAINT `CHK_FitnessGoals_Dates` CHECK (`TargetDate` > `StartDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `FitnessGoals`
--

LOCK TABLES `FitnessGoals` WRITE;
/*!40000 ALTER TABLE `FitnessGoals` DISABLE KEYS */;
/*!40000 ALTER TABLE `FitnessGoals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PlanExercises`
--

DROP TABLE IF EXISTS `PlanExercises`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `PlanExercises` (
  `PlanExerciseID` int(11) NOT NULL AUTO_INCREMENT,
  `PlanID` int(11) NOT NULL,
  `ExerciseID` int(11) NOT NULL,
  `TargetSets` int(11) NOT NULL,
  `TargetReps` int(11) NOT NULL,
  `TargetDurationMinutes` int(11) DEFAULT NULL COMMENT 'Total minutes for a timed exercise; NULL = repetition-based',
  PRIMARY KEY (`PlanExerciseID`),
  KEY `FK_PlanExercises_Plan` (`PlanID`),
  KEY `FK_PlanExercises_Exercise` (`ExerciseID`),
  CONSTRAINT `FK_PlanExercises_Exercise` FOREIGN KEY (`ExerciseID`) REFERENCES `Exercises` (`ExerciseID`) ON UPDATE CASCADE,
  CONSTRAINT `FK_PlanExercises_Plan` FOREIGN KEY (`PlanID`) REFERENCES `WorkoutPlans` (`PlanID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CHK_PlanExercises_TargetSets` CHECK (`TargetSets` > 0),
  CONSTRAINT `CHK_PlanExercises_TargetReps` CHECK (`TargetReps` > 0),
  CONSTRAINT `CHK_PlanExercises_TargetDuration` CHECK (`TargetDurationMinutes` is null or `TargetDurationMinutes` > 0)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PlanExercises`
--

LOCK TABLES `PlanExercises` WRITE;
/*!40000 ALTER TABLE `PlanExercises` DISABLE KEYS */;
INSERT INTO `PlanExercises` VALUES (1,1,1,3,12,NULL),(2,1,4,3,10,NULL),(3,1,8,3,10,NULL),(4,1,10,3,15,NULL),(5,2,12,1,1,NULL),(6,2,14,3,50,NULL),(7,2,17,3,20,NULL),(8,3,3,4,6,NULL),(9,3,6,3,12,NULL),(10,3,1,4,8,NULL),(11,4,2,4,8,NULL),(12,4,5,4,6,NULL),(13,4,7,3,10,NULL),(14,5,9,3,1,NULL),(15,5,11,3,20,NULL),(16,5,18,1,1,NULL),(17,5,19,2,3,NULL);
/*!40000 ALTER TABLE `PlanExercises` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProgressRecords`
--

DROP TABLE IF EXISTS `ProgressRecords`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ProgressRecords` (
  `ProgressID` int(11) NOT NULL AUTO_INCREMENT,
  `MemberID` int(11) NOT NULL,
  `RecordDate` date NOT NULL,
  `WeightKg` decimal(5,2) DEFAULT NULL,
  `Notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ProgressID`),
  KEY `IX_ProgressRecords_Member_Date` (`MemberID`,`RecordDate`),
  CONSTRAINT `FK_ProgressRecords_Member` FOREIGN KEY (`MemberID`) REFERENCES `Users` (`UserID`) ON UPDATE CASCADE,
  CONSTRAINT `CHK_ProgressRecords_Weight` CHECK (`WeightKg` is null or `WeightKg` > 0)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProgressRecords`
--

LOCK TABLES `ProgressRecords` WRITE;
/*!40000 ALTER TABLE `ProgressRecords` DISABLE KEYS */;
INSERT INTO `ProgressRecords` VALUES (1,4,'2026-10-08',78.60,'Started the strength plan'),(2,4,'2026-10-15',78.00,NULL),(3,4,'2026-10-22',77.20,NULL),(4,4,'2026-10-29',76.70,'Squat form improving'),(5,4,'2026-11-05',76.30,NULL),(6,4,'2026-11-12',76.00,NULL),(7,4,'2026-11-19',75.40,'Improved endurance'),(8,4,'2026-11-26',74.80,NULL),(9,5,'2026-10-08',61.90,'Ran 5 km without stopping'),(10,5,'2026-10-15',61.90,NULL),(11,5,'2026-10-22',61.50,NULL),(12,5,'2026-10-29',61.10,'Feeling more energetic'),(13,5,'2026-11-05',61.00,NULL),(14,5,'2026-11-12',60.60,NULL),(15,5,'2026-11-19',60.20,'Ran 5 km without stopping'),(16,5,'2026-11-26',60.00,NULL),(17,6,'2026-10-08',84.70,'New deadlift personal record'),(18,6,'2026-10-15',84.50,NULL),(19,6,'2026-10-22',83.90,NULL),(20,6,'2026-10-29',83.80,'Better sleep this week'),(21,6,'2026-11-05',83.60,NULL),(22,6,'2026-11-12',83.30,NULL),(23,6,'2026-11-19',83.10,'New deadlift personal record'),(24,6,'2026-11-26',82.90,NULL),(25,7,'2026-10-08',57.70,'Hip mobility improved'),(26,7,'2026-10-15',57.80,NULL),(27,7,'2026-10-22',58.00,NULL),(28,7,'2026-10-29',58.30,'Holding plank longer'),(29,7,'2026-11-05',58.30,NULL),(30,7,'2026-11-12',58.30,NULL),(31,7,'2026-11-19',58.30,'Hip mobility improved'),(32,7,'2026-11-26',58.50,NULL);
/*!40000 ALTER TABLE `ProgressRecords` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `TrainerAssignments`
--

DROP TABLE IF EXISTS `TrainerAssignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `TrainerAssignments` (
  `AssignmentID` int(11) NOT NULL AUTO_INCREMENT,
  `TrainerID` int(11) NOT NULL,
  `MemberID` int(11) NOT NULL,
  `AssignedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`AssignmentID`),
  UNIQUE KEY `UQ_TrainerAssignments_Pair` (`TrainerID`,`MemberID`),
  KEY `FK_TrainerAssignments_Member` (`MemberID`),
  CONSTRAINT `FK_TrainerAssignments_Member` FOREIGN KEY (`MemberID`) REFERENCES `Users` (`UserID`) ON UPDATE CASCADE,
  CONSTRAINT `FK_TrainerAssignments_Trainer` FOREIGN KEY (`TrainerID`) REFERENCES `Users` (`UserID`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `TrainerAssignments`
--

LOCK TABLES `TrainerAssignments` WRITE;
/*!40000 ALTER TABLE `TrainerAssignments` DISABLE KEYS */;
INSERT INTO `TrainerAssignments` VALUES (1,2,4,'2026-09-02 06:02:38'),(2,2,5,'2026-09-17 06:02:38'),(3,2,6,'2026-10-02 06:02:38'),(4,3,6,'2026-10-07 06:02:38');
/*!40000 ALTER TABLE `TrainerAssignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `TrainerFeedback`
--

DROP TABLE IF EXISTS `TrainerFeedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `TrainerFeedback` (
  `FeedbackID` int(11) NOT NULL AUTO_INCREMENT,
  `TrainerID` int(11) NOT NULL,
  `MemberID` int(11) NOT NULL,
  `RelatedGoalID` int(11) DEFAULT NULL,
  `RelatedPlanID` int(11) DEFAULT NULL,
  `FeedbackType` varchar(15) NOT NULL,
  `FeedbackMessage` varchar(1000) NOT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  `UpdatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `ReadAt` datetime DEFAULT NULL,
  PRIMARY KEY (`FeedbackID`),
  KEY `IX_TrainerFeedback_Member_Created` (`MemberID`,`CreatedAt`),
  KEY `IX_TrainerFeedback_Trainer_Created` (`TrainerID`,`CreatedAt`),
  KEY `IX_TrainerFeedback_Goal` (`RelatedGoalID`),
  KEY `IX_TrainerFeedback_Plan` (`RelatedPlanID`),
  CONSTRAINT `FK_TrainerFeedback_Goal` FOREIGN KEY (`RelatedGoalID`) REFERENCES `FitnessGoals` (`GoalID`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `FK_TrainerFeedback_Member` FOREIGN KEY (`MemberID`) REFERENCES `Users` (`UserID`) ON UPDATE CASCADE,
  CONSTRAINT `FK_TrainerFeedback_Plan` FOREIGN KEY (`RelatedPlanID`) REFERENCES `WorkoutPlans` (`PlanID`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `FK_TrainerFeedback_Trainer` FOREIGN KEY (`TrainerID`) REFERENCES `Users` (`UserID`) ON UPDATE CASCADE,
  CONSTRAINT `CHK_TrainerFeedback_Type` CHECK (`FeedbackType` in ('General','Encouragement','Guidance','Concern')),
  CONSTRAINT `CHK_TrainerFeedback_Message` CHECK (char_length(`FeedbackMessage`) >= 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `TrainerFeedback`
--

LOCK TABLES `TrainerFeedback` WRITE;
/*!40000 ALTER TABLE `TrainerFeedback` DISABLE KEYS */;
/*!40000 ALTER TABLE `TrainerFeedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Users`
--

DROP TABLE IF EXISTS `Users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Users` (
  `UserID` int(11) NOT NULL AUTO_INCREMENT,
  `FullName` varchar(100) NOT NULL,
  `Email` varchar(100) NOT NULL,
  `Role` varchar(10) NOT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  `PasswordHash` varchar(255) NOT NULL,
  `ProfileImage` varchar(255) DEFAULT NULL,
  `IsActive` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `UQ_Users_Email` (`Email`),
  CONSTRAINT `CHK_Users_Role` CHECK (`Role` in ('Member','Trainer','Admin'))
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Users`
--

LOCK TABLES `Users` WRITE;
/*!40000 ALTER TABLE `Users` DISABLE KEYS */;
INSERT INTO `Users` VALUES (1,'Alex Rivera','admin@fitsync.test','Admin','2026-07-29 06:02:37','$2b$10$OVJt1knziMA9Hvx/3d8uRuel6cvpdR19.YIfFXspMgPp0d/WdJTDW',NULL,1),(2,'Maria Santos','maria.santos@fitsync.test','Trainer','2026-08-08 06:02:37','$2b$10$BgAhV3QzCvu/6Viso2n9auWFYpbWZotrNiS7U9KtPHmR/lehbsr7q',NULL,1),(3,'Daniel Lim','daniel.lim@fitsync.test','Trainer','2026-08-18 06:02:37','$2b$10$BgAhV3QzCvu/6Viso2n9auWFYpbWZotrNiS7U9KtPHmR/lehbsr7q',NULL,1),(4,'Juan Dela Cruz','juan@fitsync.test','Member','2026-08-28 06:02:37','$2b$10$cDIkQXZuYPYfRCfd5/3HZ.tqiRBD5YWMtTnNcn01BKCJVzvlXzbYK',NULL,1),(5,'Ana Garcia','ana.garcia@fitsync.test','Member','2026-09-12 06:02:37','$2b$10$cDIkQXZuYPYfRCfd5/3HZ.tqiRBD5YWMtTnNcn01BKCJVzvlXzbYK',NULL,1),(6,'Mark Villanueva','mark.villanueva@fitsync.test','Member','2026-09-27 06:02:37','$2b$10$cDIkQXZuYPYfRCfd5/3HZ.tqiRBD5YWMtTnNcn01BKCJVzvlXzbYK',NULL,1),(7,'Bea Mendoza','bea.mendoza@fitsync.test','Member','2026-10-12 06:02:37','$2b$10$cDIkQXZuYPYfRCfd5/3HZ.tqiRBD5YWMtTnNcn01BKCJVzvlXzbYK',NULL,1),(8,'Carlo Bautista','carlo.bautista@fitsync.test','Member','2026-11-16 06:02:37','$2b$10$cDIkQXZuYPYfRCfd5/3HZ.tqiRBD5YWMtTnNcn01BKCJVzvlXzbYK',NULL,1),(9,'Lea Fernandez','lea.fernandez@fitsync.test','Member','2026-10-27 06:02:37','$2b$10$cDIkQXZuYPYfRCfd5/3HZ.tqiRBD5YWMtTnNcn01BKCJVzvlXzbYK',NULL,0);
/*!40000 ALTER TABLE `Users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `WorkoutCompletions`
--

DROP TABLE IF EXISTS `WorkoutCompletions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `WorkoutCompletions` (
  `CompletionID` int(11) NOT NULL AUTO_INCREMENT,
  `LogID` int(11) NOT NULL,
  `PlanExerciseID` int(11) DEFAULT NULL,
  `PlanID` int(11) DEFAULT NULL,
  `PlanNameSnapshot` varchar(100) NOT NULL,
  `PrescribedSets` int(11) NOT NULL,
  `PrescribedReps` int(11) NOT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  `PrescribedDurationMinutes` int(11) DEFAULT NULL COMMENT 'Snapshot of TargetDurationMinutes; NULL = repetition-based',
  PRIMARY KEY (`CompletionID`),
  UNIQUE KEY `UQ_WorkoutCompletions_Log` (`LogID`),
  KEY `IX_WorkoutCompletions_PlanExercise` (`PlanExerciseID`),
  KEY `IX_WorkoutCompletions_Plan` (`PlanID`),
  CONSTRAINT `FK_WorkoutCompletions_Log` FOREIGN KEY (`LogID`) REFERENCES `WorkoutLogs` (`LogID`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_WorkoutCompletions_Plan` FOREIGN KEY (`PlanID`) REFERENCES `WorkoutPlans` (`PlanID`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `FK_WorkoutCompletions_PlanExercise` FOREIGN KEY (`PlanExerciseID`) REFERENCES `PlanExercises` (`PlanExerciseID`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CHK_WorkoutCompletions_PrescribedSets` CHECK (`PrescribedSets` > 0),
  CONSTRAINT `CHK_WorkoutCompletions_PrescribedReps` CHECK (`PrescribedReps` > 0),
  CONSTRAINT `CHK_WorkoutCompletions_PrescribedDuration` CHECK (`PrescribedDurationMinutes` is null or `PrescribedDurationMinutes` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `WorkoutCompletions`
--

LOCK TABLES `WorkoutCompletions` WRITE;
/*!40000 ALTER TABLE `WorkoutCompletions` DISABLE KEYS */;
/*!40000 ALTER TABLE `WorkoutCompletions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `WorkoutLogs`
--

DROP TABLE IF EXISTS `WorkoutLogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `WorkoutLogs` (
  `LogID` int(11) NOT NULL AUTO_INCREMENT,
  `MemberID` int(11) NOT NULL,
  `ExerciseID` int(11) NOT NULL,
  `WorkoutDate` date NOT NULL,
  `Sets` int(11) NOT NULL,
  `Repetitions` int(11) NOT NULL,
  `DurationMinutes` int(11) NOT NULL,
  PRIMARY KEY (`LogID`),
  KEY `FK_WorkoutLogs_Exercise` (`ExerciseID`),
  KEY `IX_WorkoutLogs_Member_Date` (`MemberID`,`WorkoutDate`),
  CONSTRAINT `FK_WorkoutLogs_Exercise` FOREIGN KEY (`ExerciseID`) REFERENCES `Exercises` (`ExerciseID`) ON UPDATE CASCADE,
  CONSTRAINT `FK_WorkoutLogs_Member` FOREIGN KEY (`MemberID`) REFERENCES `Users` (`UserID`) ON UPDATE CASCADE,
  CONSTRAINT `CHK_WorkoutLogs_Sets` CHECK (`Sets` > 0),
  CONSTRAINT `CHK_WorkoutLogs_Repetitions` CHECK (`Repetitions` >= 0),
  CONSTRAINT `CHK_WorkoutLogs_Duration` CHECK (`DurationMinutes` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=212 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `WorkoutLogs`
--

LOCK TABLES `WorkoutLogs` WRITE;
/*!40000 ALTER TABLE `WorkoutLogs` DISABLE KEYS */;
INSERT INTO `WorkoutLogs` VALUES (1,4,12,'2026-10-18',1,0,20),(2,4,10,'2026-10-18',4,10,17),(3,4,12,'2026-10-18',1,0,31),(4,4,4,'2026-10-19',3,11,18),(5,4,8,'2026-10-19',3,12,19),(6,4,4,'2026-10-19',4,11,10),(7,4,4,'2026-10-20',3,12,10),(8,4,10,'2026-10-21',3,11,19),(9,4,12,'2026-10-24',1,0,37),(10,4,4,'2026-10-24',3,10,14),(11,4,12,'2026-10-26',1,0,41),(12,4,8,'2026-10-26',4,11,11),(13,4,12,'2026-10-26',1,0,39),(14,4,10,'2026-10-27',3,11,11),(15,4,4,'2026-10-27',4,9,17),(16,4,8,'2026-10-27',4,9,17),(17,4,1,'2026-10-28',4,9,15),(18,4,8,'2026-10-29',4,12,12),(19,4,10,'2026-10-31',3,9,18),(20,4,4,'2026-10-31',3,8,20),(21,4,10,'2026-11-01',4,10,10),(22,4,1,'2026-11-01',3,12,13),(23,4,12,'2026-11-02',1,0,44),(24,4,10,'2026-11-04',4,9,13),(25,4,10,'2026-11-04',3,9,13),(26,4,1,'2026-11-05',4,11,11),(27,4,1,'2026-11-05',3,8,15),(28,4,8,'2026-11-05',3,9,19),(29,4,8,'2026-11-09',4,8,11),(30,4,1,'2026-11-10',4,11,11),(31,4,10,'2026-11-10',3,11,14),(32,4,10,'2026-11-10',4,10,14),(33,4,10,'2026-11-11',3,10,16),(34,4,10,'2026-11-12',3,8,10),(35,4,12,'2026-11-13',1,0,22),(36,4,12,'2026-11-14',1,0,29),(37,4,12,'2026-11-14',1,0,32),(38,4,4,'2026-11-16',3,10,13),(39,4,10,'2026-11-16',4,10,11),(40,4,1,'2026-11-17',3,8,16),(41,4,4,'2026-11-19',4,10,18),(42,4,1,'2026-11-23',4,9,14),(43,4,1,'2026-11-23',3,9,18),(44,4,4,'2026-11-26',3,10,10),(45,4,1,'2026-11-26',4,10,19),(46,4,4,'2026-11-26',4,10,12),(47,5,17,'2026-10-16',3,12,10),(48,5,14,'2026-10-16',1,0,40),(49,5,17,'2026-10-17',4,10,20),(50,5,17,'2026-10-17',3,11,12),(51,5,17,'2026-10-19',3,9,12),(52,5,14,'2026-10-19',1,0,42),(53,5,12,'2026-10-20',1,0,40),(54,5,9,'2026-10-21',3,8,20),(55,5,14,'2026-10-21',1,0,27),(56,5,13,'2026-10-21',1,0,28),(57,5,9,'2026-10-22',3,8,18),(58,5,17,'2026-10-22',3,8,15),(59,5,17,'2026-10-22',4,8,10),(60,5,13,'2026-10-23',1,0,25),(61,5,12,'2026-10-23',1,0,21),(62,5,9,'2026-10-23',4,10,16),(63,5,12,'2026-10-24',1,0,40),(64,5,13,'2026-10-24',1,0,27),(65,5,9,'2026-10-26',4,8,19),(66,5,9,'2026-10-28',4,8,20),(67,5,14,'2026-10-28',1,0,29),(68,5,13,'2026-10-29',1,0,43),(69,5,12,'2026-10-29',1,0,29),(70,5,13,'2026-10-31',1,0,33),(71,5,13,'2026-10-31',1,0,43),(72,5,9,'2026-11-04',3,11,16),(73,5,14,'2026-11-04',1,0,40),(74,5,9,'2026-11-05',3,8,12),(75,5,17,'2026-11-05',4,8,12),(76,5,9,'2026-11-08',4,10,19),(77,5,9,'2026-11-08',4,12,16),(78,5,13,'2026-11-08',1,0,42),(79,5,14,'2026-11-09',1,0,33),(80,5,14,'2026-11-10',1,0,29),(81,5,13,'2026-11-11',1,0,44),(82,5,9,'2026-11-11',4,9,12),(83,5,17,'2026-11-11',3,8,20),(84,5,17,'2026-11-13',4,8,13),(85,5,14,'2026-11-13',1,0,39),(86,5,17,'2026-11-14',3,10,11),(87,5,14,'2026-11-15',1,0,39),(88,5,14,'2026-11-15',1,0,24),(89,5,17,'2026-11-15',4,11,11),(90,5,12,'2026-11-16',1,0,38),(91,5,17,'2026-11-16',3,10,10),(92,5,9,'2026-11-17',3,11,11),(93,5,13,'2026-11-17',1,0,40),(94,5,13,'2026-11-17',1,0,34),(95,5,17,'2026-11-18',3,9,14),(96,5,13,'2026-11-18',1,0,41),(97,5,9,'2026-11-19',4,9,11),(98,5,14,'2026-11-19',1,0,27),(99,5,17,'2026-11-20',4,11,18),(100,5,9,'2026-11-21',3,11,17),(101,5,14,'2026-11-21',1,0,28),(102,5,9,'2026-11-22',3,8,15),(103,5,12,'2026-11-22',1,0,20),(104,5,17,'2026-11-24',3,9,11),(105,5,13,'2026-11-24',1,0,30),(106,5,13,'2026-11-24',1,0,41),(107,5,12,'2026-11-26',1,0,30),(108,5,13,'2026-11-26',1,0,40),(109,6,6,'2026-10-16',4,8,19),(110,6,6,'2026-10-16',4,11,20),(111,6,6,'2026-10-16',4,8,18),(112,6,3,'2026-10-17',4,8,17),(113,6,5,'2026-10-19',3,12,11),(114,6,5,'2026-10-19',3,8,18),(115,6,5,'2026-10-19',3,9,19),(116,6,7,'2026-10-21',4,12,19),(117,6,1,'2026-10-23',3,11,20),(118,6,2,'2026-10-23',3,9,11),(119,6,2,'2026-10-23',3,11,20),(120,6,3,'2026-10-25',3,8,13),(121,6,3,'2026-10-25',3,8,17),(122,6,2,'2026-10-26',3,12,16),(123,6,2,'2026-10-26',3,10,17),(124,6,7,'2026-10-27',4,9,14),(125,6,1,'2026-10-27',3,8,15),(126,6,5,'2026-10-28',4,11,13),(127,6,6,'2026-10-30',4,10,10),(128,6,3,'2026-10-30',3,12,19),(129,6,2,'2026-10-31',3,11,15),(130,6,7,'2026-10-31',3,11,14),(131,6,5,'2026-11-01',3,11,14),(132,6,1,'2026-11-03',4,12,10),(133,6,5,'2026-11-04',3,12,17),(134,6,1,'2026-11-04',4,8,17),(135,6,6,'2026-11-06',3,12,18),(136,6,7,'2026-11-06',4,11,10),(137,6,3,'2026-11-07',3,11,18),(138,6,5,'2026-11-09',3,8,18),(139,6,5,'2026-11-09',3,8,13),(140,6,2,'2026-11-09',4,12,15),(141,6,6,'2026-11-10',4,12,13),(142,6,7,'2026-11-10',3,9,14),(143,6,2,'2026-11-12',3,8,10),(144,6,5,'2026-11-13',3,11,14),(145,6,1,'2026-11-15',4,9,18),(146,6,7,'2026-11-15',3,11,11),(147,6,1,'2026-11-15',4,12,10),(148,6,7,'2026-11-17',4,10,18),(149,6,7,'2026-11-17',3,11,18),(150,6,7,'2026-11-17',3,11,16),(151,6,7,'2026-11-19',3,8,16),(152,6,3,'2026-11-19',3,10,13),(153,6,3,'2026-11-23',4,12,12),(154,6,1,'2026-11-26',3,12,12),(155,6,6,'2026-11-26',4,8,12),(156,6,3,'2026-11-26',3,8,15),(157,7,19,'2026-10-18',1,0,35),(158,7,9,'2026-10-18',4,8,15),(159,7,18,'2026-10-18',1,0,40),(160,7,18,'2026-10-20',1,0,39),(161,7,18,'2026-10-20',1,0,26),(162,7,19,'2026-10-20',1,0,39),(163,7,18,'2026-10-22',1,0,40),(164,7,18,'2026-10-23',1,0,38),(165,7,15,'2026-10-25',1,0,22),(166,7,18,'2026-10-26',1,0,20),(167,7,11,'2026-10-26',3,12,14),(168,7,9,'2026-10-27',3,9,12),(169,7,11,'2026-10-27',4,12,20),(170,7,18,'2026-10-29',1,0,23),(171,7,11,'2026-10-30',4,12,19),(172,7,19,'2026-10-31',1,0,21),(173,7,15,'2026-10-31',1,0,27),(174,7,18,'2026-11-06',1,0,44),(175,7,9,'2026-11-06',4,12,10),(176,7,15,'2026-11-07',1,0,26),(177,7,19,'2026-11-07',1,0,26),(178,7,9,'2026-11-08',3,9,11),(179,7,15,'2026-11-09',1,0,39),(180,7,15,'2026-11-09',1,0,39),(181,7,19,'2026-11-09',1,0,23),(182,7,9,'2026-11-10',4,11,11),(183,7,19,'2026-11-10',1,0,38),(184,7,18,'2026-11-11',1,0,27),(185,7,11,'2026-11-11',3,12,17),(186,7,9,'2026-11-14',3,11,15),(187,7,11,'2026-11-14',3,11,20),(188,7,9,'2026-11-14',4,12,14),(189,7,19,'2026-11-17',1,0,38),(190,7,19,'2026-11-21',1,0,28),(191,7,11,'2026-11-22',3,9,17),(192,7,15,'2026-11-24',1,0,36),(193,7,15,'2026-11-24',1,0,43),(194,7,9,'2026-11-24',4,12,17),(195,7,15,'2026-11-25',1,0,30),(196,7,11,'2026-11-25',4,11,11),(197,7,9,'2026-11-25',4,12,12),(198,8,4,'2026-10-29',3,12,10),(199,8,14,'2026-10-30',1,0,41),(200,8,4,'2026-10-30',3,11,20),(201,8,14,'2026-10-30',1,0,27),(202,8,4,'2026-11-06',3,9,18),(203,8,14,'2026-11-06',1,0,43),(204,8,14,'2026-11-09',1,0,29),(205,8,14,'2026-11-09',1,0,32),(206,8,4,'2026-11-10',4,9,18),(207,8,14,'2026-11-10',1,0,21);
/*!40000 ALTER TABLE `WorkoutLogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `WorkoutPlans`
--

DROP TABLE IF EXISTS `WorkoutPlans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `WorkoutPlans` (
  `PlanID` int(11) NOT NULL AUTO_INCREMENT,
  `TrainerID` int(11) NOT NULL,
  `MemberID` int(11) NOT NULL,
  `PlanName` varchar(100) NOT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`PlanID`),
  KEY `FK_WorkoutPlans_Trainer` (`TrainerID`),
  KEY `FK_WorkoutPlans_Member` (`MemberID`),
  CONSTRAINT `FK_WorkoutPlans_Member` FOREIGN KEY (`MemberID`) REFERENCES `Users` (`UserID`) ON UPDATE CASCADE,
  CONSTRAINT `FK_WorkoutPlans_Trainer` FOREIGN KEY (`TrainerID`) REFERENCES `Users` (`UserID`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `WorkoutPlans`
--

LOCK TABLES `WorkoutPlans` WRITE;
/*!40000 ALTER TABLE `WorkoutPlans` DISABLE KEYS */;
INSERT INTO `WorkoutPlans` VALUES (1,2,4,'Beginner Strength Foundations','2026-09-07 06:02:38'),(2,2,5,'Cardio Endurance Builder','2026-09-17 06:02:38'),(3,2,6,'Lower Body Strength','2026-09-27 06:02:38'),(4,3,6,'Upper Body Power','2026-10-07 06:02:38'),(5,3,7,'Core & Mobility','2026-10-17 06:02:38');
/*!40000 ALTER TABLE `WorkoutPlans` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed
