-- Main Bareng (Open Play standalone).
-- JANGAN dijalankan otomatis — konfirmasi dulu sebelum:
--   mysql -u root -p health_app < mysql/migrations/008_main_bareng.sql
-- Prasyarat: 007_community.sql (community_sports + employee_profiles).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS open_play_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  sport_key VARCHAR(64) NOT NULL,
  starts_at DATETIME(3) NOT NULL,
  ends_at DATETIME(3) NULL,
  place VARCHAR(255) NULL,
  city VARCHAR(128) NULL,
  address_note VARCHAR(512) NULL,
  capacity INT NOT NULL DEFAULT 8,
  skill_level VARCHAR(32) NULL COMMENT 'beginner, intermediate, all',
  fee_note VARCHAR(255) NULL,
  description TEXT NULL,
  cover_url MEDIUMTEXT NULL,
  host_user_id BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open' COMMENT 'open, full, cancelled, done',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ope_status_starts (status, starts_at),
  KEY idx_ope_sport_starts (sport_key, starts_at),
  KEY idx_ope_city_starts (city, starts_at),
  KEY idx_ope_host (host_user_id),
  CONSTRAINT fk_ope_sport FOREIGN KEY (sport_key) REFERENCES community_sports (sport_key),
  CONSTRAINT fk_ope_host FOREIGN KEY (host_user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS open_play_participants (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending, approved, rejected, cancelled, waitlist',
  note VARCHAR(255) NULL,
  decided_by_user_id BIGINT NULL,
  decided_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_opp_event_user (event_id, user_id),
  KEY idx_opp_user (user_id),
  KEY idx_opp_event_status (event_id, status),
  CONSTRAINT fk_opp_event FOREIGN KEY (event_id) REFERENCES open_play_events (id) ON DELETE CASCADE,
  CONSTRAINT fk_opp_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_opp_decider FOREIGN KEY (decided_by_user_id) REFERENCES employee_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
