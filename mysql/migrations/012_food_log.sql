-- Food log hub: meal/source/barcode columns + local catalog.
-- JANGAN dijalankan otomatis — konfirmasi dulu sebelum:
--   mysql -u root -p health_app < mysql/migrations/012_food_log.sql
-- Prasyarat: 002_food_analyses.sql.

SET NAMES utf8mb4;

ALTER TABLE food_analyses
  ADD COLUMN meal_type VARCHAR(16) NULL COMMENT 'breakfast, lunch, dinner, snack' AFTER food_name,
  ADD COLUMN source_type VARCHAR(16) NOT NULL DEFAULT 'photo' COMMENT 'manual, photo, barcode' AFTER meal_type,
  ADD COLUMN barcode VARCHAR(64) NULL AFTER source_type,
  ADD COLUMN serving_label VARCHAR(128) NULL AFTER barcode;

ALTER TABLE food_analyses
  ADD KEY idx_food_analyses_barcode (barcode);

CREATE TABLE IF NOT EXISTS food_catalog (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(128) NULL,
  calories DECIMAL(12, 2) NOT NULL DEFAULT 0,
  protein_g DECIMAL(12, 4) NULL,
  fats_g DECIMAL(12, 4) NULL,
  carbs_g DECIMAL(12, 4) NULL,
  serving_label VARCHAR(128) NOT NULL DEFAULT '100 gr',
  source_label VARCHAR(64) NULL COMMENT 'display only e.g. Fatsecret, Generic',
  is_popular TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_food_catalog_popular (is_popular, sort_order),
  KEY idx_food_catalog_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO food_catalog
  (name, brand, calories, protein_g, fats_g, carbs_g, serving_label, source_label, is_popular, sort_order)
VALUES
  ('Tahu', NULL, 78, 8.0, 4.5, 2.0, '100 gr', 'Fatsecret', 1, 10),
  ('Ayam Goreng (Paha)', NULL, 173, 18.0, 10.0, 2.0, '50 g', 'Generic', 1, 20),
  ('Tempe Goreng', NULL, 225, 14.0, 15.0, 10.0, '100 gram', 'Tempe Goreng', 1, 30),
  ('Dada Ayam', NULL, 165, 31.0, 3.6, 0.0, '100 gr', 'General', 1, 40),
  ('Tempe Goreng', NULL, 82, 5.0, 5.0, 4.0, '1 potong/slice', 'Home Made', 1, 50),
  ('Nasi Putih', NULL, 175, 3.5, 0.3, 39.0, '100 gr', 'Generic', 1, 60),
  ('Nasi Goreng', NULL, 250, 6.0, 8.0, 38.0, '1 porsi', 'Generic', 1, 70),
  ('Telur Dadar', NULL, 150, 10.0, 11.0, 1.0, '1 butir', 'Home Made', 1, 80),
  ('Pisang', NULL, 89, 1.1, 0.3, 23.0, '100 gr', 'Generic', 1, 90),
  ('Roti Tawar', NULL, 70, 2.5, 1.0, 13.0, '1 iris', 'Generic', 1, 100),
  ('Susu UHT Full Cream', NULL, 120, 6.0, 6.5, 9.0, '200 ml', 'Generic', 1, 110),
  ('Indomie Goreng', 'Indomie', 390, 9.0, 18.0, 50.0, '1 bungkus', 'Brand', 1, 120),
  ('Corn Fritter', NULL, 424, 8.0, 22.0, 48.0, '3 fritter', 'Verified', 1, 130),
  ('Sayur Bayam', NULL, 35, 3.0, 0.5, 5.0, '100 gr', 'Generic', 1, 140),
  ('Ikan Bakar', NULL, 180, 28.0, 7.0, 0.0, '100 gr', 'Generic', 1, 150),
  ('Gado-gado', NULL, 280, 12.0, 16.0, 24.0, '1 porsi', 'Home Made', 1, 160),
  ('Sate Ayam', NULL, 220, 20.0, 12.0, 8.0, '5 tusuk', 'Generic', 1, 170),
  ('Kopi Susu', NULL, 90, 2.0, 3.0, 12.0, '1 gelas', 'Generic', 1, 180);
