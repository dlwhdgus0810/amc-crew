import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { TitleMeta } from '../tmdb';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // 카카오 회원번호
  kakaoName: text('kakao_name').notNull(),
  nickname: text('nickname'), // null이면 카카오 닉네임 폴백
  kakaoNameHistory: jsonb('kakao_name_history').$type<{ name: string; at: string }[]>().notNull().default([]),
  birthday: text('birthday'), // YYYY-MM-DD, null이면 온보딩 미완료
  gender: text('gender'), // 'male' | 'female', null이면 온보딩 미완료
  locale: text('locale'), // 'ko' | 'en', null이면 기본(한국어) — 알림 문구도 이 언어로 만든다
  // 카카오톡 "나에게 보내기" 알림용 토큰 (로그인마다 갱신)
  kakaoAccessToken: text('kakao_access_token'),
  kakaoTokenExpiresAt: timestamp('kakao_token_expires_at', { withTimezone: true }),
  kakaoRefreshToken: text('kakao_refresh_token'),
  kakaoTalkMessage: boolean('kakao_talk_message'), // talk_message 동의 여부 (null=미확인, false=미동의)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** 정기 모임 규칙. 크론이 이 규칙을 보고 실제 posts 행을 미리 만들어 둔다. */
export const recurringRules = pgTable(
  'recurring_rules',
  {
    id: uuid('id').primaryKey(),
    category: text('category').notNull(),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id),
    weekday: integer('weekday').notNull(), // 0=일 ~ 6=토
    startDate: text('start_date').notNull(), // 첫 회차 날짜 (이전 날짜는 생성하지 않음)
    title: text('title'),
    titleMeta: jsonb('title_meta').$type<TitleMeta>(),
    startTime: text('start_time').notNull(), // HH:mm
    endTime: text('end_time').notNull(), // HH:mm
    location: text('location').notNull(),
    description: text('description'),
    capacity: integer('capacity'),
    active: boolean('active').notNull().default(true), // 중단해도 행은 남긴다 (생성된 회차의 참조 유지)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('recurring_rules_active_idx').on(t.active, t.category)]
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey(), // 앱에서 crypto.randomUUID()로 생성 (batch 트랜잭션용)
    category: text('category').notNull(),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id),
    title: text('title'), // 뭐 볼지/뭐 할지 (카테고리에 titleLabel이 있을 때만 사용)
    titleMeta: jsonb('title_meta').$type<TitleMeta>(), // TMDB 메타 (평점·감독·출연·포스터), 검색으로 고른 경우만
    // 정기 모임에서 생성된 회차면 규칙 id (규칙 삭제 시 회차는 남기고 연결만 끊는다)
    recurringRuleId: uuid('recurring_rule_id').references(() => recurringRules.id, { onDelete: 'set null' }),
    // AMC 회차에서 만든 모임이면 그 회차 id — 같은 회차로 두 번 만들지 않기 위해 쓴다
    amcShowtimeId: text('amc_showtime_id'),

    date: text('date').notNull(), // YYYY-MM-DD (사전순 = 시간순)
    startTime: text('start_time').notNull(), // HH:mm
    endTime: text('end_time').notNull(), // HH:mm
    location: text('location').notNull(),
    description: text('description'),
    capacity: integer('capacity'), // 정원. null이면 무제한
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('posts_category_date_idx').on(t.category, t.date)]
);

export const postParticipants = pgTable(
  'post_participants',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })]
);

export const postComments = pgTable(
  'post_comments',
  {
    id: uuid('id').primaryKey(), // 앱에서 생성
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    // 답글이면 원 댓글 id. 한 단계만 쓴다 (답글의 답글도 같은 줄에 붙인다)
    parentId: uuid('parent_id'),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('post_comments_post_idx').on(t.postId, t.createdAt)]
);

/** 댓글 좋아요(하트) — 한 사람이 한 댓글에 한 번 */
export const commentLikes = pgTable(
  'comment_likes',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => postComments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })]
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    category: text('category').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.category] })]
);

/** 즐겨찾기 — 홈에 먼저 띄울 카테고리. 알림을 받는 subscriptions와는 별개다. */
export const favorites = pgTable(
  'favorites',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    category: text('category').notNull(),
    sort: integer('sort').notNull().default(0), // 홈에 뜨는 순서 (드래그로 바꾼다)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.category] })]
);

/** 사용자가 제안한 새 카테고리. 관리자가 검토 후 lib/categories.ts에 반영한다. */
export const categoryRequests = pgTable(
  'category_requests',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(), // 예: 등산
    color: text('color').notNull(), // #RRGGBB — 카테고리 시그니처 컬러
    description: text('description').notNull(), // 부제목 (예: 같이 오를 사람 모집)
    featureRequest: text('feature_request'), // 원하는 기능 (예: 무비나잇처럼 영화 검색 API 연결)
    status: text('status').notNull().default('pending'), // pending | approved | rejected
    adminNote: text('admin_note'), // 관리자 답변 (반려 사유 등)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('category_requests_status_idx').on(t.status, t.createdAt)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(), // 앱에서 생성
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_read_idx').on(t.userId, t.read)]
);
