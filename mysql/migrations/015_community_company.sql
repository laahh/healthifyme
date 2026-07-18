-- Tambah kolom perusahaan pada komunitas.
-- JANGAN dijalankan otomatis — konfirmasi dulu sebelum:
--   mysql -u ... -p ... < mysql/migrations/015_community_company.sql

SET NAMES utf8mb4;

ALTER TABLE communities
  ADD COLUMN company VARCHAR(255) NULL AFTER city;
