/**
 * Application time zone (calendar days and local-time presentation).
 *
 *   Instants (DATETIME columns such as CreatedAt) are STORED IN UTC and
 *   returned by the API as ISO-8601 strings ending in "Z".
 *   Calendar dates (WorkoutDate, RecordDate, report ranges, "today") are
 *   days in the APP time zone, Asia/Manila by default (APP_TIME_ZONE).
 *
 * Import this module first (main.ts, scripts, tests): it pins Node's local
 * time zone, so date math does not depend on the host machine's setting.
 */
import 'dotenv/config';

export const APP_TIME_ZONE = process.env.APP_TIME_ZONE?.trim() || 'Asia/Manila';
process.env.TZ = APP_TIME_ZONE;
