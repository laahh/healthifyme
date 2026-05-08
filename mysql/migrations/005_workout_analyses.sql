-- Analisis olahraga (screenshot fitness), selaras user_history.item_id.
-- Jalankan setelah schema dasar + migrasi sebelumnya:
--   mysql -u root -p health_app < mysql/migrations/005_workout_analyses.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS workout_analyses (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  client_item_id VARCHAR(128) NOT NULL COMMENT 'ID item di app = user_history.item_id',
  activity_type VARCHAR(512) NOT NULL DEFAULT '',
  calories_kcal DECIMAL(12, 2) NULL COMMENT 'Estimasi kkal dari app',
  nutrition_notes_short VARCHAR(512) NULL COMMENT 'Ringkas nutritionNotes (caption)',
  summary_text MEDIUMTEXT NULL COMMENT 'workoutSummary / teks panjang AI',
  date_line VARCHAR(255) NULL,
  time_range VARCHAR(255) NULL,
  location VARCHAR(512) NULL,
  workout_time VARCHAR(128) NULL,
  distance VARCHAR(128) NULL,
  active_kilocalories VARCHAR(128) NULL,
  total_kilocalories VARCHAR(128) NULL,
  elevation_gain VARCHAR(128) NULL,
  avg_power VARCHAR(128) NULL,
  avg_cadence VARCHAR(128) NULL,
  avg_pace VARCHAR(128) NULL,
  avg_heart_rate VARCHAR(128) NULL,
  raw_metrics_json JSON NULL COMMENT 'Objek workoutMetrics dari app',
  raw_ai_json JSON NULL COMMENT 'Payload item tanpa image (audit)',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_workout_analyses_user_client (user_id, client_item_id),
  KEY idx_workout_analyses_user_created (user_id, created_at DESC),
  CONSTRAINT fk_workout_analyses_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
