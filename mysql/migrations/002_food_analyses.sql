-- Tambah tabel analisis makanan (tanpa drop data lain).
-- Jalankan setelah schema dasar sudah ada:
--   mysql -u root -p health_app < mysql/migrations/002_food_analyses.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS food_analyses (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  client_item_id VARCHAR(128) NULL COMMENT 'ID item di app, selaras user_history.item_id',
  food_name VARCHAR(512) NOT NULL DEFAULT '',
  nutrition_notes TEXT NULL,
  total_calories DECIMAL(12, 2) NULL,
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
  raw_ai_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_food_analyses_user_created (user_id, created_at DESC),
  KEY idx_food_analyses_client_item (user_id, client_item_id),
  CONSTRAINT fk_food_analyses_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS food_analysis_components (
  id BIGINT NOT NULL AUTO_INCREMENT,
  analysis_id BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  component_name VARCHAR(255) NOT NULL DEFAULT '',
  component_detail VARCHAR(768) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_fac_analysis (analysis_id),
  CONSTRAINT fk_fac_analysis FOREIGN KEY (analysis_id) REFERENCES food_analyses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
