-- =====================================================================
-- FitSync migration 001 — External exercise source & attribution
-- (Lab alignment upgrade: External Fitness API, Laboratory Activity 03)
--
-- Purpose
--   Exercises imported from the wger Fitness API must keep their external
--   identifier (to prevent duplicate imports) and their licence attribution
--   (required by the Creative Commons licences wger content is published
--   under). These columns EXTEND the Lab 04 Exercises table; the original
--   seven tables and all original columns are unchanged.
--
-- Safety
--   * Additive only: every new column is NULL-able, so existing rows are
--     untouched (they simply have NULL = "local exercise").
--   * Nothing is dropped, renamed or rewritten.
--   * Apply with `cd backend && npm run db:migrate`, which checks
--     information_schema first and skips anything that already exists
--     (safe to run repeatedly, works on MySQL 8 and MariaDB 10.4).
--   * This file documents the exact DDL for manual application, e.g. in
--     phpMyAdmin. Run each statement once.
-- =====================================================================

ALTER TABLE Exercises
  ADD COLUMN ExternalSource VARCHAR(20)  NULL COMMENT 'Provider of imported content, e.g. wger; NULL = local exercise',
  ADD COLUMN ExternalID     INT          NULL COMMENT 'Exercise ID at the external provider',
  ADD COLUMN SourceUrl      VARCHAR(255) NULL COMMENT 'Public page of the original exercise',
  ADD COLUMN LicenseName    VARCHAR(100) NULL COMMENT 'Licence of the imported text, e.g. CC-BY-SA 4',
  ADD COLUMN LicenseUrl     VARCHAR(255) NULL COMMENT 'Link to the licence text',
  ADD COLUMN LicenseAuthor  VARCHAR(255) NULL COMMENT 'Author(s) credited by the provider',
  ADD COLUMN ImportedAt     DATETIME     NULL COMMENT 'When an administrator imported the exercise (UTC)';

-- One local row per external exercise (NULL pairs are allowed many times).
ALTER TABLE Exercises
  ADD CONSTRAINT UQ_Exercises_External UNIQUE (ExternalSource, ExternalID);

-- Source and ID are either both present (imported) or both NULL (local).
ALTER TABLE Exercises
  ADD CONSTRAINT CHK_Exercises_ExternalPair
  CHECK ((ExternalSource IS NULL AND ExternalID IS NULL) OR (ExternalSource IS NOT NULL AND ExternalID IS NOT NULL));
