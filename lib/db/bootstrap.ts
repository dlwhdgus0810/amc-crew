/**
 * PGlite(로컬 개발 폴백) 전용 스키마 부트스트랩.
 * 프로덕션(Neon)은 `npm run db:push`(drizzle-kit)로 스키마를 관리하고, 이 DDL은 쓰지 않는다.
 * lib/db/schema.ts를 바꾸면 여기도 함께 갱신할 것.
 */
export const BOOTSTRAP_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  kakao_name text NOT NULL,
  nickname text,
  name_en text,
  avatar text,
  kakao_name_history jsonb NOT NULL DEFAULT '[]',
  birthday text,
  gender text,
  locale text,
  last_seen timestamptz,
  venmo text,
  zelle text,
  news_alerts boolean NOT NULL DEFAULT false,
  show_past_private boolean NOT NULL DEFAULT false,
  show_presence boolean NOT NULL DEFAULT true,
  banned_until timestamptz,
  ban_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id uuid PRIMARY KEY,
  category text NOT NULL,
  author_id text NOT NULL REFERENCES users(id),
  co_host_id text REFERENCES users(id),
  allow_nicknames boolean NOT NULL DEFAULT false,
  weekday integer NOT NULL,
  start_date text NOT NULL,
  title text,
  title_meta jsonb,
  start_time text NOT NULL,
  end_time text,
  location text NOT NULL,
  description text,
  capacity integer,
  visibility text NOT NULL DEFAULT 'public',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recurring_rules_active_idx ON recurring_rules (active, category);

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY,
  category text NOT NULL,
  author_id text NOT NULL REFERENCES users(id),
  co_host_id text REFERENCES users(id),
  allow_nicknames boolean NOT NULL DEFAULT false,
  title text,
  title_meta jsonb,
  recurring_rule_id uuid REFERENCES recurring_rules(id) ON DELETE SET NULL,
  amc_showtime_id text,
  visibility text NOT NULL DEFAULT 'public',
  -- null이면 「날짜 미정」 (사람부터 모으는 모임) — lib/db/schema.ts의 주석 참고
  date text,
  start_time text,
  end_time text,
  location text NOT NULL,
  description text,
  capacity integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_category_date_idx ON posts (category, date);

CREATE TABLE IF NOT EXISTS post_participants (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id uuid PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  parent_id uuid,
  body text NOT NULL,
  anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_comments_post_idx ON post_comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id uuid NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_photos (
  id uuid PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  pathname text NOT NULL,
  width integer,
  height integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_photos_post_idx ON post_photos (post_id, created_at);

CREATE TABLE IF NOT EXISTS post_ratings (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  score integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id text NOT NULL REFERENCES users(id),
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id text NOT NULL REFERENCES users(id),
  category text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

CREATE TABLE IF NOT EXISTS friendships (
  user_a text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  a_shows_presence boolean NOT NULL DEFAULT true,
  b_shows_presence boolean NOT NULL DEFAULT true,
  a_shows_meetups text NOT NULL DEFAULT 'all',
  b_shows_meetups text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  PRIMARY KEY (user_a, user_b)
);
CREATE INDEX IF NOT EXISTS friendships_b_idx ON friendships (user_b, status);

CREATE TABLE IF NOT EXISTS category_requests (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  name text NOT NULL,
  color text NOT NULL,
  description text NOT NULL,
  feature_request text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS category_requests_status_idx ON category_requests (status, created_at);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY,
  number serial NOT NULL,
  user_id text NOT NULL REFERENCES users(id),
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'open',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets (status, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  kind text,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications (user_id, read);

CREATE TABLE IF NOT EXISTS translations (
  hash text NOT NULL,
  target text NOT NULL,
  source text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hash, target)
);

CREATE TABLE IF NOT EXISTS hidden_categories (
  category text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category_signups (
  category text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (category, user_id)
);

CREATE TABLE IF NOT EXISTS notices (
  id uuid PRIMARY KEY,
  title_ko text NOT NULL,
  title_en text,
  title_es text,
  body_ko text,
  body_en text,
  body_es text,
  targets jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notice_reads (
  notice_id uuid NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);

CREATE TABLE IF NOT EXISTS presence_sessions (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS presence_sessions_user_ended_idx ON presence_sessions (user_id, ended_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY,
  short_code text UNIQUE,
  post_id uuid NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  payee_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settlement_items (
  id uuid PRIMARY KEY,
  settlement_id uuid NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount_cents integer NOT NULL,
  scope text NOT NULL DEFAULT 'all',
  extra_people integer NOT NULL DEFAULT 0,
  sort integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS settlement_items_settlement_idx ON settlement_items (settlement_id, sort);

CREATE TABLE IF NOT EXISTS settlement_members (
  settlement_id uuid NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  PRIMARY KEY (settlement_id, user_id)
);

CREATE TABLE IF NOT EXISTS settlement_item_members (
  item_id uuid NOT NULL REFERENCES settlement_items(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  PRIMARY KEY (item_id, user_id)
);
`;
