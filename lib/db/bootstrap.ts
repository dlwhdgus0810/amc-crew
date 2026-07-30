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
  avatar text,
  kakao_name_history jsonb NOT NULL DEFAULT '[]',
  birthday text,
  gender text,
  locale text,
  kakao_access_token text,
  kakao_token_expires_at timestamptz,
  kakao_refresh_token text,
  kakao_talk_message boolean,
  last_seen timestamptz,
  venmo text,
  zelle text,
  news_alerts boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recurring_rules (
  id uuid PRIMARY KEY,
  category text NOT NULL,
  author_id text NOT NULL REFERENCES users(id),
  weekday integer NOT NULL,
  start_date text NOT NULL,
  title text,
  title_meta jsonb,
  start_time text NOT NULL,
  end_time text NOT NULL,
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
  title text,
  title_meta jsonb,
  recurring_rule_id uuid REFERENCES recurring_rules(id) ON DELETE SET NULL,
  amc_showtime_id text,
  visibility text NOT NULL DEFAULT 'public',
  date text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
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
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications (user_id, read);

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
  sort integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS settlement_items_settlement_idx ON settlement_items (settlement_id, sort);

CREATE TABLE IF NOT EXISTS settlement_item_members (
  item_id uuid NOT NULL REFERENCES settlement_items(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  PRIMARY KEY (item_id, user_id)
);
`;
