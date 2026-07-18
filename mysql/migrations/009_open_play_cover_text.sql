-- Perpanjang cover_url agar bisa simpan data URL hasil upload (kompres).
-- JANGAN dijalankan otomatis — konfirmasi dulu sebelum:
--   mysql -u root -p health_app < mysql/migrations/009_open_play_cover_text.sql

SET NAMES utf8mb4;

ALTER TABLE open_play_events
  MODIFY COLUMN cover_url MEDIUMTEXT NULL;
