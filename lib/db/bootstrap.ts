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
  kakao_name_history jsonb NOT NULL DEFAULT '[]',
  birthday text,
  gender text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY,
  category text NOT NULL,
  author_id text NOT NULL REFERENCES users(id),
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

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id text NOT NULL REFERENCES users(id),
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications (user_id, read);
`;
