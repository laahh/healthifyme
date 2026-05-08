-- Katalog latihan + relasi (target/secondary muscle, bagian tubuh, alat, instruksi).
-- Jalankan setelah schema utama: mysql ... < mysql/migrations/003_exercises_catalog.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS muscles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_muscles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS body_parts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_body_parts_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_equipments_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exercises (
  id BIGINT NOT NULL AUTO_INCREMENT,
  exercise_code VARCHAR(64) NULL,
  name VARCHAR(512) NOT NULL,
  gif_url VARCHAR(1024) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_exercises_name (name(191)),
  KEY idx_exercises_code (exercise_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exercise_target_muscles (
  exercise_id BIGINT NOT NULL,
  muscle_id BIGINT NOT NULL,
  PRIMARY KEY (exercise_id, muscle_id),
  KEY idx_etm_muscle (muscle_id),
  CONSTRAINT fk_etm_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
  CONSTRAINT fk_etm_muscle FOREIGN KEY (muscle_id) REFERENCES muscles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exercise_secondary_muscles (
  exercise_id BIGINT NOT NULL,
  muscle_id BIGINT NOT NULL,
  PRIMARY KEY (exercise_id, muscle_id),
  KEY idx_esm_muscle (muscle_id),
  CONSTRAINT fk_esm_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
  CONSTRAINT fk_esm_muscle FOREIGN KEY (muscle_id) REFERENCES muscles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exercise_body_parts (
  exercise_id BIGINT NOT NULL,
  body_part_id BIGINT NOT NULL,
  PRIMARY KEY (exercise_id, body_part_id),
  KEY idx_ebp_part (body_part_id),
  CONSTRAINT fk_ebp_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
  CONSTRAINT fk_ebp_body_part FOREIGN KEY (body_part_id) REFERENCES body_parts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exercise_equipments (
  exercise_id BIGINT NOT NULL,
  equipment_id BIGINT NOT NULL,
  PRIMARY KEY (exercise_id, equipment_id),
  KEY idx_eeq_equipment (equipment_id),
  CONSTRAINT fk_eeq_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
  CONSTRAINT fk_eeq_equipment FOREIGN KEY (equipment_id) REFERENCES equipments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exercise_instructions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  exercise_id BIGINT NOT NULL,
  step_no INT NOT NULL,
  instruction TEXT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exercise_step (exercise_id, step_no),
  KEY idx_ei_exercise (exercise_id),
  CONSTRAINT fk_ei_exercise FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contoh satu latihan (sesuai diagram relasi contoh)
INSERT IGNORE INTO muscles (id, name) VALUES
  (1, 'tulang belakang'),
  (2, 'bahu'),
  (3, 'dada');

INSERT IGNORE INTO body_parts (id, name) VALUES
  (1, 'punggung');

INSERT IGNORE INTO equipments (id, name) VALUES
  (1, 'berat badan');

INSERT IGNORE INTO exercises (id, exercise_code, name, gif_url) VALUES
  (1, 'UPD-001', 'Anjing menghadap ke atas (upward dog)', NULL);

INSERT IGNORE INTO exercise_target_muscles (exercise_id, muscle_id) VALUES (1, 1);
INSERT IGNORE INTO exercise_secondary_muscles (exercise_id, muscle_id) VALUES
  (1, 2),
  (1, 3);
INSERT IGNORE INTO exercise_body_parts (exercise_id, body_part_id) VALUES (1, 1);
INSERT IGNORE INTO exercise_equipments (exercise_id, equipment_id) VALUES (1, 1);

INSERT IGNORE INTO exercise_instructions (exercise_id, step_no, instruction) VALUES
  (1, 1, 'Berbaring telungkup di lantai dengan kaki lurus ke belakang.'),
  (1, 2, 'Letakkan tangan di samping tulang rusuk bawah, jari menghadap depan.'),
  (1, 3, 'Tekan tangan ke lantai dan luruskan lengan, angkat tubuh dan paha dari lantai.'),
  (1, 4, 'Tarik bahu ke belakang dan bawah, buka dada, tatap ke langit-langit.'),
  (1, 5, 'Tahan beberapa napas, lalu turunkan tubuh perlahan ke posisi awal.'),
  (1, 6, 'Ulangi sesuai jumlah repetisi yang diinginkan.');
