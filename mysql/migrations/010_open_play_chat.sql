-- Chat Main Bareng (per event, tanpa room terpisah).
-- JANGAN dijalankan otomatis — konfirmasi dulu sebelum:
--   mysql -u root -p health_app < mysql/migrations/010_open_play_chat.sql
-- Prasyarat: 008_main_bareng.sql.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS open_play_messages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  sender_user_id BIGINT NOT NULL,
  body TEXT NULL,
  image_url MEDIUMTEXT NULL COMMENT 'URL atau data URL foto (terkompres)',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_opm_event_created (event_id, created_at),
  CONSTRAINT fk_opm_event FOREIGN KEY (event_id) REFERENCES open_play_events (id) ON DELETE CASCADE,
  CONSTRAINT fk_opm_sender FOREIGN KEY (sender_user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
