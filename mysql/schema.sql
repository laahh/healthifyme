-- MySQL 8+ schema for Project Aplikasi Health API
-- Identitas login = employee_profiles (SID / kode_sid + password_hash dari SID).
-- Run: mysql -u root -p your_db < mysql/schema.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS cognitive_test_sessions;
DROP TABLE IF EXISTS cognitive_memory_results;
DROP TABLE IF EXISTS cognitive_pvt_results;
DROP TABLE IF EXISTS food_analysis_components;
DROP TABLE IF EXISTS food_analyses;
DROP TABLE IF EXISTS workout_analyses;
DROP TABLE IF EXISTS user_history;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS employee_profiles;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE employee_profiles (
  id BIGINT NOT NULL,
  nik VARCHAR(64) NULL,
  foto TEXT NULL,
  nama VARCHAR(255) NULL,
  site VARCHAR(255) NULL,
  usia INT NULL,
  divisi VARCHAR(255) NULL,
  mainkon VARCHAR(255) NULL,
  dedikasi VARCHAR(255) NULL,
  dept_dic BIGINT NULL,
  kategori VARCHAR(255) NULL,
  kode_sid VARCHAR(64) NOT NULL,
  masa_kerja INT NULL,
  departement VARCHAR(255) NULL,
  work_permit VARCHAR(255) NULL,
  dept_mainkon VARCHAR(255) NULL,
  id_perusahaan BIGINT NULL,
  level_jabatan VARCHAR(255) NULL,
  status_permit VARCHAR(255) NULL,
  dic_perusahaan BIGINT NULL,
  id_work_permit BIGINT NULL,
  nama_perusahaan VARCHAR(255) NULL,
  status_karyawan VARCHAR(255) NULL,
  kategori_karyawan VARCHAR(255) NULL,
  jabatan_fungsional VARCHAR(255) NULL,
  jabatan_struktural VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  membership_tier VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
  avatar_url VARCHAR(512) NOT NULL DEFAULT '',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_employee_kode_sid (kode_sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_profiles (
  user_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(64) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL DEFAULT '',
  address JSON NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_profiles_employee FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_history (
  user_id BIGINT NOT NULL,
  item_id VARCHAR(128) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, item_id),
  KEY idx_user_history_created (user_id, created_at DESC),
  CONSTRAINT fk_user_history_employee FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cognitive_pvt_results (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NULL,
  trials INT NOT NULL DEFAULT 0,
  valid_trials INT NOT NULL DEFAULT 0,
  mean_rt_ms INT NOT NULL DEFAULT 0,
  median_rt_ms INT NOT NULL DEFAULT 0,
  lapses INT NOT NULL DEFAULT 0,
  false_starts INT NOT NULL DEFAULT 0,
  passed TINYINT(1) NULL,
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

CREATE TABLE cognitive_memory_results (
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

CREATE TABLE cognitive_test_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  overall_level VARCHAR(32) NOT NULL DEFAULT '',
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

-- Hasil analisis AI makanan (ringkasan nutrisi + catatan), terpisah dari blob JSON user_history untuk query/report.
CREATE TABLE food_analyses (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  client_item_id VARCHAR(128) NULL COMMENT 'ID item di app (localStorage history id), untuk sinkron dengan user_history.item_id',
  food_name VARCHAR(512) NOT NULL DEFAULT '',
  nutrition_notes TEXT NULL COMMENT 'Catatan / saran konsumsi dari AI',
  total_calories DECIMAL(12, 2) NULL COMMENT 'Energi Kkal',
  protein_g DECIMAL(12, 4) NULL,
  fats_g DECIMAL(12, 4) NULL,
  carbs_g DECIMAL(12, 4) NULL,
  fiber_g DECIMAL(12, 4) NULL,
  water_ml DECIMAL(12, 4) NULL,
  vit_a_re DECIMAL(12, 4) NULL,
  vit_d_mcg DECIMAL(12, 4) NULL,
  vit_e_mg DECIMAL(12, 4) NULL,
  vit_k_mcg DECIMAL(12, 4) NULL,
  vit_c_mg DECIMAL(12, 4) NULL,
  raw_ai_json JSON NULL COMMENT 'Salinan objek analisis dari AI (opsional, audit)',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_food_analyses_user_created (user_id, created_at DESC),
  KEY idx_food_analyses_client_item (user_id, client_item_id),
  CONSTRAINT fk_food_analyses_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Komponen per hidangan (Nasi putih, Rendang, …) untuk satu food_analyses.
CREATE TABLE food_analysis_components (
  id BIGINT NOT NULL AUTO_INCREMENT,
  analysis_id BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  component_name VARCHAR(255) NOT NULL DEFAULT '',
  component_detail VARCHAR(768) NOT NULL DEFAULT '' COMMENT 'Mis. 1 porsi (150g) • 200 kkal',
  PRIMARY KEY (id),
  KEY idx_fac_analysis (analysis_id),
  CONSTRAINT fk_fac_analysis FOREIGN KEY (analysis_id) REFERENCES food_analyses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analisis olahraga (screenshot fitness), selaras user_history.item_id.
CREATE TABLE workout_analyses (
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
