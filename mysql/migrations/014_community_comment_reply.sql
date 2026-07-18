-- Tambah dukungan balas komentar (reply) berjenjang di feed komunitas.
-- JANGAN dijalankan otomatis — konfirmasi dulu sebelum:
--   mysql -u ... -p ... < mysql/migrations/014_community_comment_reply.sql

SET NAMES utf8mb4;

ALTER TABLE community_post_comments
  ADD COLUMN parent_id BIGINT NULL DEFAULT NULL AFTER post_id,
  ADD KEY idx_comments_parent (parent_id),
  ADD CONSTRAINT fk_comment_parent
    FOREIGN KEY (parent_id) REFERENCES community_post_comments (id) ON DELETE CASCADE;
