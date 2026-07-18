-- Perpanjang banner_url & logo_url agar bisa simpan data URL hasil upload foto.
-- JANGAN dijalankan otomatis — konfirmasi dulu sebelum:
--   mysql -u ... -p ... < mysql/migrations/016_community_banner_logo_text.sql

SET NAMES utf8mb4;

ALTER TABLE communities
  MODIFY COLUMN banner_url MEDIUMTEXT NULL,
  MODIFY COLUMN logo_url MEDIUMTEXT NULL;
