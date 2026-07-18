-- Strava detail enrichment: HR, speed/power, full polyline, laps, splits, streams, photos.
-- JANGAN dijalankan otomatis — konfirmasi dulu sebelum apply.
-- Prasyarat: mysql/migrations/011_strava.sql sudah dijalankan.
--
-- Contoh (setelah konfirmasi):
--   mysql -u root -p health_app < mysql/migrations/017_strava_detail.sql

SET NAMES utf8mb4;

ALTER TABLE strava_activities
  ADD COLUMN has_heartrate TINYINT(1) NULL DEFAULT NULL AFTER calories,
  ADD COLUMN average_heartrate DOUBLE NULL AFTER has_heartrate,
  ADD COLUMN max_heartrate DOUBLE NULL AFTER average_heartrate,
  ADD COLUMN average_speed DOUBLE NULL AFTER max_heartrate,
  ADD COLUMN max_speed DOUBLE NULL AFTER average_speed,
  ADD COLUMN average_cadence DOUBLE NULL AFTER max_speed,
  ADD COLUMN average_watts DOUBLE NULL AFTER average_cadence,
  ADD COLUMN max_watts DOUBLE NULL AFTER average_watts,
  ADD COLUMN weighted_average_watts DOUBLE NULL AFTER max_watts,
  ADD COLUMN kilojoules DOUBLE NULL AFTER weighted_average_watts,
  ADD COLUMN device_watts TINYINT(1) NULL AFTER kilojoules,
  ADD COLUMN suffer_score INT NULL AFTER device_watts,
  ADD COLUMN workout_type INT NULL AFTER suffer_score,
  ADD COLUMN trainer TINYINT(1) NULL AFTER workout_type,
  ADD COLUMN commute TINYINT(1) NULL AFTER trainer,
  ADD COLUMN manual TINYINT(1) NULL AFTER commute,
  ADD COLUMN private TINYINT(1) NULL AFTER manual,
  ADD COLUMN visibility VARCHAR(32) NULL AFTER private,
  ADD COLUMN gear_id VARCHAR(64) NULL AFTER visibility,
  ADD COLUMN device_name VARCHAR(128) NULL AFTER gear_id,
  ADD COLUMN kudos_count INT NULL AFTER device_name,
  ADD COLUMN comment_count INT NULL AFTER kudos_count,
  ADD COLUMN pr_count INT NULL AFTER comment_count,
  ADD COLUMN achievement_count INT NULL AFTER pr_count,
  ADD COLUMN photo_count INT NULL AFTER achievement_count,
  ADD COLUMN start_lat DOUBLE NULL AFTER photo_count,
  ADD COLUMN start_lng DOUBLE NULL AFTER start_lat,
  ADD COLUMN end_lat DOUBLE NULL AFTER start_lng,
  ADD COLUMN end_lng DOUBLE NULL AFTER end_lat,
  ADD COLUMN location_city VARCHAR(128) NULL AFTER end_lng,
  ADD COLUMN location_state VARCHAR(128) NULL AFTER location_city,
  ADD COLUMN location_country VARCHAR(128) NULL AFTER location_state,
  ADD COLUMN map_polyline MEDIUMTEXT NULL AFTER map_summary_polyline,
  ADD COLUMN detail_synced_at DATETIME(3) NULL AFTER synced_at,
  ADD COLUMN streams_synced_at DATETIME(3) NULL AFTER detail_synced_at;

CREATE TABLE IF NOT EXISTS strava_activity_laps (
  activity_id BIGINT NOT NULL,
  lap_index INT NOT NULL,
  name VARCHAR(255) NULL,
  distance_m DOUBLE NULL,
  moving_time_s INT NULL,
  elapsed_time_s INT NULL,
  total_elevation_gain DOUBLE NULL,
  average_speed DOUBLE NULL,
  max_speed DOUBLE NULL,
  average_heartrate DOUBLE NULL,
  max_heartrate DOUBLE NULL,
  average_cadence DOUBLE NULL,
  average_watts DOUBLE NULL,
  lap_index_strava INT NULL,
  start_index INT NULL,
  end_index INT NULL,
  raw_json JSON NULL,
  PRIMARY KEY (activity_id, lap_index),
  CONSTRAINT fk_strava_lap_activity FOREIGN KEY (activity_id) REFERENCES strava_activities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS strava_activity_splits (
  activity_id BIGINT NOT NULL,
  split_type VARCHAR(16) NOT NULL COMMENT 'metric | standard',
  split_index INT NOT NULL,
  distance_m DOUBLE NULL,
  elapsed_time_s INT NULL,
  moving_time_s INT NULL,
  elevation_difference DOUBLE NULL,
  average_speed DOUBLE NULL,
  average_heartrate DOUBLE NULL,
  pace_zone INT NULL,
  PRIMARY KEY (activity_id, split_type, split_index),
  CONSTRAINT fk_strava_split_activity FOREIGN KEY (activity_id) REFERENCES strava_activities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS strava_activity_streams (
  activity_id BIGINT NOT NULL,
  stream_type VARCHAR(32) NOT NULL COMMENT 'time|latlng|altitude|heartrate|velocity_smooth|cadence|watts|distance',
  data_json MEDIUMTEXT NOT NULL,
  original_size INT NULL,
  resolution VARCHAR(16) NULL,
  series_type VARCHAR(32) NULL,
  PRIMARY KEY (activity_id, stream_type),
  CONSTRAINT fk_strava_stream_activity FOREIGN KEY (activity_id) REFERENCES strava_activities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS strava_activity_photos (
  id BIGINT NOT NULL COMMENT 'Strava unique photo id',
  activity_id BIGINT NOT NULL,
  unique_id VARCHAR(64) NULL,
  urls_json JSON NULL,
  caption VARCHAR(512) NULL,
  source INT NULL,
  created_at_strava DATETIME(3) NULL,
  synced_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_strava_photo_activity (activity_id),
  CONSTRAINT fk_strava_photo_activity FOREIGN KEY (activity_id) REFERENCES strava_activities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
