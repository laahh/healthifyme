-- Hasil tes PVT, memori kerja, dan sesi gabungan (kesimpulan layak bekerja).
-- mysql -u root -p your_db < mysql/migrations/004_cognitive_tests.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS cognitive_pvt_results (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  client_id VARCHAR(64) NOT NULL COMMENT 'UUID dari aplikasi',
  session_id VARCHAR(64) NULL COMMENT 'UUID sesi lengkap bila ada',
  trials INT NOT NULL DEFAULT 0,
  valid_trials INT NOT NULL DEFAULT 0,
  mean_rt_ms INT NOT NULL DEFAULT 0,
  median_rt_ms INT NOT NULL DEFAULT 0,
  lapses INT NOT NULL DEFAULT 0,
  false_starts INT NOT NULL DEFAULT 0,
  passed TINYINT(1) NULL COMMENT '1=lulus skrining, 0=tidak, NULL=tidak dinilai',
  evaluation_label VARCHAR(512) NULL,
  raw_payload JSON NULL,
  tested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cognitive_pvt_user_client (user_id, client_id),
  KEY idx_cognitive_pvt_user_tested (user_id, tested_at DESC),
  KEY idx_cognitive_pvt_session (user_id, session_id),
  CONSTRAINT fk_cognitive_pvt_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cognitive_memory_results (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NULL,
  rounds INT NOT NULL DEFAULT 0,
  rounds_correct INT NOT NULL DEFAULT 0,
  max_span INT NOT NULL DEFAULT 0,
  sum_correct_lengths INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  passed TINYINT(1) NULL,
  evaluation_label VARCHAR(512) NULL,
  raw_payload JSON NULL,
  tested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cognitive_mem_user_client (user_id, client_id),
  KEY idx_cognitive_mem_user_tested (user_id, tested_at DESC),
  KEY idx_cognitive_mem_session (user_id, session_id),
  CONSTRAINT fk_cognitive_mem_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cognitive_test_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  session_id VARCHAR(64) NOT NULL COMMENT 'UUID sesi dari aplikasi',
  overall_level VARCHAR(32) NOT NULL DEFAULT '' COMMENT 'layak | waspada | tidak_layak',
  overall_json JSON NOT NULL,
  pvt_json JSON NULL,
  memory_json JSON NULL,
  tested_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cognitive_session_user (user_id, session_id),
  KEY idx_cognitive_session_user_tested (user_id, tested_at DESC),
  CONSTRAINT fk_cognitive_session_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
