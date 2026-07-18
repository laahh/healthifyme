-- Community (AYO-style, inti tanpa booking/payment).
-- JANGAN dijalankan otomatis — konfirmasi dulu sebelum:
--   mysql -u root -p health_app < mysql/migrations/007_community.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS community_sports (
  sport_key VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  icon VARCHAR(64) NOT NULL DEFAULT 'sports',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (sport_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS communities (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  sport_key VARCHAR(64) NOT NULL,
  description TEXT NULL,
  banner_url VARCHAR(1024) NULL,
  logo_url VARCHAR(1024) NULL,
  city VARCHAR(255) NULL,
  created_by_user_id BIGINT NULL,
  member_count INT NOT NULL DEFAULT 0,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  is_popular TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_communities_slug (slug),
  KEY idx_communities_sport (sport_key),
  KEY idx_communities_popular (is_popular, member_count DESC),
  KEY idx_communities_city (city),
  CONSTRAINT fk_communities_sport FOREIGN KEY (sport_key) REFERENCES community_sports (sport_key),
  CONSTRAINT fk_communities_creator FOREIGN KEY (created_by_user_id) REFERENCES employee_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_members (
  id BIGINT NOT NULL AUTO_INCREMENT,
  community_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'member' COMMENT 'owner, admin, member',
  joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_community_members (community_id, user_id),
  KEY idx_community_members_user (user_id),
  CONSTRAINT fk_cm_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  community_id BIGINT NULL,
  event_type VARCHAR(32) NOT NULL DEFAULT 'open_play' COMMENT 'open_play, coaching',
  title VARCHAR(255) NOT NULL,
  sport_key VARCHAR(64) NOT NULL,
  starts_at DATETIME(3) NOT NULL,
  place VARCHAR(255) NULL,
  capacity INT NOT NULL DEFAULT 20,
  fee_note VARCHAR(255) NULL,
  created_by_user_id BIGINT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open' COMMENT 'open, full, cancelled, done',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ce_community (community_id, starts_at),
  KEY idx_ce_type (event_type, starts_at),
  KEY idx_ce_sport (sport_key),
  CONSTRAINT fk_ce_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE SET NULL,
  CONSTRAINT fk_ce_sport FOREIGN KEY (sport_key) REFERENCES community_sports (sport_key),
  CONSTRAINT fk_ce_creator FOREIGN KEY (created_by_user_id) REFERENCES employee_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_event_rsvps (
  id BIGINT NOT NULL AUTO_INCREMENT,
  event_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'joined' COMMENT 'joined, cancelled',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_rsvp (event_id, user_id),
  KEY idx_rsvp_user (user_id),
  CONSTRAINT fk_rsvp_event FOREIGN KEY (event_id) REFERENCES community_events (id) ON DELETE CASCADE,
  CONSTRAINT fk_rsvp_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_posts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  community_id BIGINT NOT NULL,
  author_user_id BIGINT NOT NULL,
  body TEXT NOT NULL,
  image_url VARCHAR(1024) NULL,
  sport_key VARCHAR(64) NULL,
  like_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_posts_community (community_id, created_at DESC),
  CONSTRAINT fk_posts_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
  CONSTRAINT fk_posts_author FOREIGN KEY (author_user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_post_likes (
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT fk_like_post FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_like_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_post_comments (
  id BIGINT NOT NULL AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_comments_post (post_id, created_at),
  CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_chat_rooms (
  id BIGINT NOT NULL AUTO_INCREMENT,
  community_id BIGINT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_chat_room_community (community_id),
  CONSTRAINT fk_chat_room_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_chat_messages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  room_id BIGINT NOT NULL,
  sender_user_id BIGINT NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_chat_messages_room (room_id, created_at),
  CONSTRAINT fk_chat_msg_room FOREIGN KEY (room_id) REFERENCES community_chat_rooms (id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_msg_sender FOREIGN KEY (sender_user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_sparring_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  from_community_id BIGINT NULL,
  to_community_id BIGINT NULL,
  sport_key VARCHAR(64) NOT NULL,
  proposed_at DATETIME(3) NOT NULL,
  place VARCHAR(255) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending' COMMENT 'pending, accepted, declined, done',
  score_home INT NULL,
  score_away INT NULL,
  created_by_user_id BIGINT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sparring_status (status, proposed_at),
  CONSTRAINT fk_sparring_from FOREIGN KEY (from_community_id) REFERENCES communities (id) ON DELETE SET NULL,
  CONSTRAINT fk_sparring_to FOREIGN KEY (to_community_id) REFERENCES communities (id) ON DELETE SET NULL,
  CONSTRAINT fk_sparring_sport FOREIGN KEY (sport_key) REFERENCES community_sports (sport_key),
  CONSTRAINT fk_sparring_creator FOREIGN KEY (created_by_user_id) REFERENCES employee_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_player_stats (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  community_id BIGINT NULL,
  matches INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  goals INT NOT NULL DEFAULT 0,
  assists INT NOT NULL DEFAULT 0,
  level_points INT NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_player_stats (user_id, community_id),
  KEY idx_player_stats_points (level_points DESC),
  CONSTRAINT fk_stats_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_stats_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_badges (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  description VARCHAR(512) NULL,
  icon VARCHAR(64) NOT NULL DEFAULT 'military_tech',
  PRIMARY KEY (id),
  UNIQUE KEY uq_badge_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_user_badges (
  user_id BIGINT NOT NULL,
  badge_id BIGINT NOT NULL,
  awarded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, badge_id),
  CONSTRAINT fk_ub_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_ub_badge FOREIGN KEY (badge_id) REFERENCES community_badges (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_competitions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  sport_key VARCHAR(64) NOT NULL,
  starts_at DATETIME(3) NULL,
  ends_at DATETIME(3) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open' COMMENT 'open, ongoing, finished',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_comp_sport (sport_key),
  CONSTRAINT fk_comp_sport FOREIGN KEY (sport_key) REFERENCES community_sports (sport_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_competition_entries (
  id BIGINT NOT NULL AUTO_INCREMENT,
  competition_id BIGINT NOT NULL,
  community_id BIGINT NULL,
  user_id BIGINT NULL,
  points INT NOT NULL DEFAULT 0,
  rank_no INT NULL,
  PRIMARY KEY (id),
  KEY idx_comp_entries (competition_id, points DESC),
  CONSTRAINT fk_ce_comp FOREIGN KEY (competition_id) REFERENCES community_competitions (id) ON DELETE CASCADE,
  CONSTRAINT fk_ce_ent_community FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
  CONSTRAINT fk_ce_ent_user FOREIGN KEY (user_id) REFERENCES employee_profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO community_sports (sport_key, name, icon, sort_order) VALUES
  ('padel', 'Padel', 'sports_tennis', 1),
  ('tennis', 'Tennis', 'sports_tennis', 2),
  ('badminton', 'Badminton', 'sports_tennis', 3),
  ('mini_soccer', 'Mini Soccer', 'sports_soccer', 4),
  ('sepak_bola', 'Sepak Bola', 'sports_soccer', 5),
  ('basketball', 'Basketball', 'sports_basketball', 6),
  ('futsal', 'Futsal', 'sports_soccer', 7),
  ('running', 'Running', 'directions_run', 8),
  ('volleyball', 'Volley', 'sports_volleyball', 9),
  ('yoga', 'Yoga', 'self_improvement', 10),
  ('fitness', 'Fitness', 'fitness_center', 11),
  ('pickleball', 'Pickleball', 'sports_tennis', 12)
ON DUPLICATE KEY UPDATE name = VALUES(name), icon = VALUES(icon), sort_order = VALUES(sort_order);

INSERT INTO community_badges (code, name, description, icon) VALUES
  ('first_join', 'First Join', 'Bergabung ke komunitas pertama', 'emoji_events'),
  ('event_regular', 'Event Regular', 'Ikut 5 open play', 'calendar_month'),
  ('sparring_winner', 'Sparring Winner', 'Menang sparring', 'military_tech'),
  ('social_butterfly', 'Social Butterfly', 'Aktif posting di komunitas', 'forum')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO communities (name, slug, sport_key, description, banner_url, logo_url, city, member_count, is_public, is_popular) VALUES
  ('Tennis BSD Santuy', 'tennis-bsd-santuy', 'tennis', 'Komunitas tennis santai di BSD',
   'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&auto=format&fit=crop&q=80',
   'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=200&auto=format&fit=crop&q=80',
   'Kota Tangerang Selatan', 465, 1, 1),
  ('Futsal Jakarta Night', 'futsal-jakarta-night', 'futsal', 'Main bareng malam hari',
   'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80',
   'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=200&auto=format&fit=crop&q=80',
   'Jakarta Selatan', 312, 1, 1),
  ('Badminton Weekend Club', 'badminton-weekend-club', 'badminton', 'Weekend smash bareng',
   'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop&q=80',
   'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=200&auto=format&fit=crop&q=80',
   'Bekasi', 228, 1, 1),
  ('Padel Ciracas', 'padel-ciracas', 'padel', 'Komunitas padel Ciracas',
   'https://images.unsplash.com/photo-1617083277581-d7fc93cae14e?w=800&auto=format&fit=crop&q=80',
   NULL, 'Jakarta Timur', 156, 1, 1),
  ('Mini Soccer Depok', 'mini-soccer-depok', 'mini_soccer', 'Sparring & main bareng Depok',
   'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&auto=format&fit=crop&q=80',
   NULL, 'Depok', 189, 1, 0),
  ('Running Sunday Morning', 'running-sunday-morning', 'running', 'Lari pagi minggu',
   'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&auto=format&fit=crop&q=80',
   NULL, 'Jakarta Pusat', 520, 1, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO community_chat_rooms (community_id)
SELECT id FROM communities c
WHERE NOT EXISTS (SELECT 1 FROM community_chat_rooms r WHERE r.community_id = c.id);

INSERT INTO community_competitions (name, sport_key, starts_at, ends_at, status) VALUES
  ('Liga Futsal WELL 2026', 'futsal', DATE_ADD(NOW(3), INTERVAL 7 DAY), DATE_ADD(NOW(3), INTERVAL 60 DAY), 'open'),
  ('Open Tennis Series', 'tennis', DATE_ADD(NOW(3), INTERVAL 14 DAY), DATE_ADD(NOW(3), INTERVAL 45 DAY), 'open');
