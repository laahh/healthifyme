-- Perpanjang community_posts.image_url agar bisa simpan data URL hasil upload foto (kompres).
-- JANGAN dijalankan otomatis — konfirmasi dulu sebelum:
--   mysql -u ... -p ... < mysql/migrations/013_community_post_image_text.sql

SET NAMES utf8mb4;

ALTER TABLE community_posts
  MODIFY COLUMN image_url MEDIUMTEXT NULL;
