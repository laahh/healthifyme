-- Goal Planner: tipe goal, konfigurasi perhitungan, target harian, skor, rekomendasi.
-- Jalankan setelah migrasi sebelumnya:
--   mysql -u root -p health_app < mysql/migrations/006_goal_planner.sql

SET NAMES utf8mb4;

ALTER TABLE user_profiles
  ADD COLUMN gender VARCHAR(16) NULL COMMENT 'male, female, other' AFTER address,
  ADD COLUMN height_cm DECIMAL(5, 2) NULL AFTER gender,
  ADD COLUMN weight_kg DECIMAL(6, 2) NULL AFTER height_cm,
  ADD COLUMN activity_level VARCHAR(32) NULL DEFAULT 'moderate' COMMENT 'low, moderate, high, very_high' AFTER weight_kg,
  ADD COLUMN exercise_preferences TEXT NULL AFTER activity_level,
  ADD COLUMN food_restrictions TEXT NULL AFTER exercise_preferences,
  ADD COLUMN timezone VARCHAR(64) NULL DEFAULT 'Asia/Jakarta' AFTER food_restrictions;

CREATE TABLE IF NOT EXISTS activity_level_multipliers (
  level_code VARCHAR(32) NOT NULL,
  multiplier DECIMAL(6, 4) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (level_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO activity_level_multipliers (level_code, multiplier, sort_order) VALUES
  ('low', 1.2000, 1),
  ('moderate', 1.3750, 2),
  ('high', 1.5500, 3),
  ('very_high', 1.7250, 4)
ON DUPLICATE KEY UPDATE multiplier = VALUES(multiplier), sort_order = VALUES(sort_order);

CREATE TABLE IF NOT EXISTS goal_types (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_goal_types_code (code),
  KEY idx_goal_types_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goal_calculation_configs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  goal_type_code VARCHAR(64) NOT NULL,
  calorie_mode VARCHAR(32) NOT NULL DEFAULT 'MAINTAIN' COMMENT 'DEFICIT, SURPLUS, MAINTAIN, SOFT_DEFICIT',
  calorie_adjustment_percent DECIMAL(6, 2) NOT NULL DEFAULT 0 COMMENT 'Defisit/surplus dasar % TDEE (sebelum intensitas)',
  soft_deficit_percent DECIMAL(6, 2) NOT NULL DEFAULT 0 COMMENT 'Untuk HEALTHY_LIFESTYLE',
  protein_multiplier_per_kg DECIMAL(8, 4) NOT NULL DEFAULT 1.2000,
  fat_percent_of_calories DECIMAL(6, 2) NOT NULL DEFAULT 25.00,
  default_exercise_min_per_day INT NOT NULL DEFAULT 30,
  default_workout_per_week INT NOT NULL DEFAULT 3,
  default_steps_per_day INT NOT NULL DEFAULT 8000,
  exercise_min_bonus INT NOT NULL DEFAULT 0 COMMENT 'Tambahan menit untuk ACTIVE_LIFESTYLE',
  steps_bonus INT NOT NULL DEFAULT 0,
  workout_week_bonus INT NOT NULL DEFAULT 0,
  default_water_ml INT NOT NULL DEFAULT 2500,
  default_sugar_limit_g DECIMAL(8, 2) NOT NULL DEFAULT 50.00,
  default_sodium_limit_mg DECIMAL(10, 2) NOT NULL DEFAULT 2300.00,
  intensity_easy_factor DECIMAL(6, 4) NOT NULL DEFAULT 0.6700,
  intensity_normal_factor DECIMAL(6, 4) NOT NULL DEFAULT 1.0000,
  intensity_aggressive_factor DECIMAL(6, 4) NOT NULL DEFAULT 1.3300,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_goal_calc_goal_code (goal_type_code),
  CONSTRAINT fk_goal_calc_goal_type FOREIGN KEY (goal_type_code) REFERENCES goal_types (code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_goals (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  goal_type_id BIGINT NOT NULL,
  goal_name VARCHAR(255) NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  target_date DATE NOT NULL,
  start_weight_kg DECIMAL(6, 2) NOT NULL,
  target_weight_kg DECIMAL(6, 2) NOT NULL,
  target_body_fat_percent DECIMAL(5, 2) NULL,
  target_workout_per_week INT NULL,
  target_steps_per_day INT NULL,
  intensity_level VARCHAR(16) NOT NULL DEFAULT 'normal' COMMENT 'easy, normal, aggressive',
  activity_level VARCHAR(32) NOT NULL DEFAULT 'moderate',
  exercise_preferences TEXT NULL,
  food_restrictions TEXT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft' COMMENT 'draft, active, paused, completed, cancelled',
  notes TEXT NULL,
  active_marker TINYINT GENERATED ALWAYS AS (CASE WHEN status = 'active' THEN 1 ELSE NULL END) STORED,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_goals_one_active (user_id, active_marker),
  KEY idx_user_goals_user_status (user_id, status),
  KEY idx_user_goals_dates (user_id, start_date, target_date),
  CONSTRAINT fk_user_goals_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_goals_type FOREIGN KEY (goal_type_id) REFERENCES goal_types (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goal_daily_targets (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_goal_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  target_date DATE NOT NULL,
  calorie_target DECIMAL(10, 2) NOT NULL,
  protein_target_g DECIMAL(10, 4) NOT NULL,
  carb_target_g DECIMAL(10, 4) NOT NULL,
  fat_target_g DECIMAL(10, 4) NOT NULL,
  sugar_limit_g DECIMAL(10, 4) NOT NULL,
  sodium_limit_mg DECIMAL(12, 4) NOT NULL,
  water_target_ml DECIMAL(12, 4) NOT NULL,
  step_target INT NOT NULL DEFAULT 0,
  exercise_duration_target_min INT NOT NULL DEFAULT 0,
  workout_plan_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_goal_daily_one (user_goal_id, target_date),
  KEY idx_goal_daily_user_date (user_id, target_date),
  CONSTRAINT fk_goal_daily_goal FOREIGN KEY (user_goal_id) REFERENCES user_goals (id) ON DELETE CASCADE,
  CONSTRAINT fk_goal_daily_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goal_milestones (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_goal_id BIGINT NOT NULL,
  milestone_date DATE NOT NULL,
  expected_weight_kg DECIMAL(6, 2) NOT NULL,
  expected_body_fat_percent DECIMAL(5, 2) NULL,
  expected_workout_count INT NULL,
  expected_avg_calorie DECIMAL(10, 2) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_milestones_goal (user_goal_id, milestone_date),
  CONSTRAINT fk_milestones_goal FOREIGN KEY (user_goal_id) REFERENCES user_goals (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_health_scores (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_goal_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  score_date DATE NOT NULL,
  calorie_score DECIMAL(6, 2) NOT NULL DEFAULT 0,
  protein_score DECIMAL(6, 2) NOT NULL DEFAULT 0,
  macro_score DECIMAL(6, 2) NOT NULL DEFAULT 0,
  exercise_score DECIMAL(6, 2) NOT NULL DEFAULT 0,
  consistency_score DECIMAL(6, 2) NOT NULL DEFAULT 0,
  habit_score DECIMAL(6, 2) NOT NULL DEFAULT 0,
  total_score DECIMAL(6, 2) NOT NULL DEFAULT 0,
  category VARCHAR(32) NOT NULL DEFAULT 'poor' COMMENT 'excellent, good, need_improvement, poor',
  calorie_actual DECIMAL(12, 2) NULL,
  protein_actual_g DECIMAL(12, 4) NULL,
  carb_actual_g DECIMAL(12, 4) NULL,
  fat_actual_g DECIMAL(12, 4) NULL,
  exercise_actual_min INT NOT NULL DEFAULT 0,
  steps_actual INT NULL,
  water_actual_ml DECIMAL(12, 4) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_daily_score_goal_date (user_goal_id, score_date),
  KEY idx_daily_score_user_date (user_id, score_date),
  CONSTRAINT fk_daily_score_goal FOREIGN KEY (user_goal_id) REFERENCES user_goals (id) ON DELETE CASCADE,
  CONSTRAINT fk_daily_score_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recommendation_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_goal_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  recommendation_date DATE NOT NULL,
  category VARCHAR(32) NOT NULL COMMENT 'food, exercise, recovery, adjustment',
  code VARCHAR(64) NOT NULL DEFAULT '',
  title VARCHAR(512) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  payload_json JSON NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'unread' COMMENT 'unread, read, accepted, dismissed',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_rec_user_date (user_id, recommendation_date),
  KEY idx_rec_goal_date (user_goal_id, recommendation_date),
  CONSTRAINT fk_rec_goal FOREIGN KEY (user_goal_id) REFERENCES user_goals (id) ON DELETE CASCADE,
  CONSTRAINT fk_rec_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS goal_adjustment_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_goal_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  adjustment_date DATE NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  adjustment_reason VARCHAR(512) NOT NULL DEFAULT '',
  adjusted_by VARCHAR(64) NOT NULL DEFAULT 'system',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_adj_goal (user_goal_id),
  CONSTRAINT fk_adj_goal FOREIGN KEY (user_goal_id) REFERENCES user_goals (id) ON DELETE CASCADE,
  CONSTRAINT fk_adj_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed goal types
INSERT INTO goal_types (code, name, description, is_active) VALUES
  ('WEIGHT_LOSS', 'Turun berat badan', 'Defisit kalori terukur dengan protein adekuat.', 1),
  ('MAINTAIN_WEIGHT', 'Menjaga berat badan', 'Energi seimbang dengan aktivitas rutin.', 1),
  ('MUSCLE_GAIN', 'Menaikkan massa otot', 'Surplus kalori ringan dan protein tinggi.', 1),
  ('ACTIVE_LIFESTYLE', 'Lebih aktif berolahraga', 'Pertahankan energi, tingkatkan gerak & latihan.', 1),
  ('HEALTHY_LIFESTYLE', 'Hidup lebih sehat', 'Pola makan seimbang dan defisit lembut opsional.', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  is_active = VALUES(is_active);

INSERT INTO goal_calculation_configs (
  goal_type_code, calorie_mode, calorie_adjustment_percent, soft_deficit_percent,
  protein_multiplier_per_kg, fat_percent_of_calories,
  default_exercise_min_per_day, default_workout_per_week, default_steps_per_day,
  exercise_min_bonus, steps_bonus, workout_week_bonus,
  default_water_ml, default_sugar_limit_g, default_sodium_limit_mg,
  intensity_easy_factor, intensity_normal_factor, intensity_aggressive_factor,
  is_active
) VALUES
  ('WEIGHT_LOSS', 'DEFICIT', 15.00, 0, 1.6000, 25.00, 35, 4, 9000, 0, 0, 0, 2600, 50, 2300, 0.67, 1.00, 1.33, 1),
  ('MAINTAIN_WEIGHT', 'MAINTAIN', 0, 0, 1.2000, 25.00, 30, 3, 8000, 0, 0, 0, 2500, 50, 2300, 0.67, 1.00, 1.33, 1),
  ('MUSCLE_GAIN', 'SURPLUS', 10.00, 0, 1.8000, 25.00, 40, 5, 8500, 0, 0, 1, 2800, 50, 2300, 0.50, 1.00, 1.50, 1),
  ('ACTIVE_LIFESTYLE', 'MAINTAIN', 0, 0, 1.3000, 25.00, 45, 5, 11000, 15, 2000, 1, 2700, 50, 2300, 0.80, 1.00, 1.20, 1),
  ('HEALTHY_LIFESTYLE', 'SOFT_DEFICIT', 0, 5.00, 1.2500, 25.00, 35, 4, 9000, 0, 500, 0, 2600, 50, 2300, 0.80, 1.00, 1.15, 1)
ON DUPLICATE KEY UPDATE
  calorie_mode = VALUES(calorie_mode),
  calorie_adjustment_percent = VALUES(calorie_adjustment_percent),
  soft_deficit_percent = VALUES(soft_deficit_percent),
  protein_multiplier_per_kg = VALUES(protein_multiplier_per_kg),
  fat_percent_of_calories = VALUES(fat_percent_of_calories),
  default_exercise_min_per_day = VALUES(default_exercise_min_per_day),
  default_workout_per_week = VALUES(default_workout_per_week),
  default_steps_per_day = VALUES(default_steps_per_day),
  exercise_min_bonus = VALUES(exercise_min_bonus),
  steps_bonus = VALUES(steps_bonus),
  workout_week_bonus = VALUES(workout_week_bonus),
  default_water_ml = VALUES(default_water_ml),
  default_sugar_limit_g = VALUES(default_sugar_limit_g),
  default_sodium_limit_mg = VALUES(default_sodium_limit_mg),
  intensity_easy_factor = VALUES(intensity_easy_factor),
  intensity_normal_factor = VALUES(intensity_normal_factor),
  intensity_aggressive_factor = VALUES(intensity_aggressive_factor),
  is_active = VALUES(is_active);
