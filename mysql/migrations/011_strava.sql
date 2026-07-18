-- Strava OAuth connection + synced activities.
-- JANGAN dijalankan otomatis — konfirmasi dulu sebelum:
--   mysql -u root -p health_app < mysql/migrations/011_strava.sql
-- Prasyarat: employee_profiles.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS strava_connections (
  user_id BIGINT NOT NULL,
  athlete_id BIGINT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  scope VARCHAR(255) NULL,
  athlete_firstname VARCHAR(128) NULL,
  athlete_lastname VARCHAR(128) NULL,
  athlete_profile_url VARCHAR(1024) NULL,
  connected_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_synced_at DATETIME(3) NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_strava_athlete (athlete_id),
  CONSTRAINT fk_strava_conn_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS strava_activities (
  id BIGINT NOT NULL COMMENT 'Strava activity id',
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  sport_type VARCHAR(64) NULL,
  type VARCHAR(64) NULL,
  distance_m DOUBLE NOT NULL DEFAULT 0,
  moving_time_s INT NOT NULL DEFAULT 0,
  elapsed_time_s INT NOT NULL DEFAULT 0,
  total_elevation_gain DOUBLE NULL,
  calories DOUBLE NULL,
  start_date DATETIME(3) NOT NULL,
  timezone VARCHAR(64) NULL,
  map_summary_polyline TEXT NULL,
  raw_json JSON NULL,
  synced_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_strava_act_user_start (user_id, start_date DESC),
  CONSTRAINT fk_strava_act_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
