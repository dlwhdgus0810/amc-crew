import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // 카카오 회원번호
  kakaoName: text('kakao_name').notNull(),
  nickname: text('nickname'), // null이면 카카오 닉네임 폴백
  kakaoNameHistory: jsonb('kakao_name_history').$type<{ name: string; at: string }[]>().notNull().default([]),
  birthday: text('birthday'), // YYYY-MM-DD, null이면 온보딩 미완료
  gender: text('gender'), // 'male' | 'female', null이면 온보딩 미완료
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey(), // 앱에서 crypto.randomUUID()로 생성 (batch 트랜잭션용)
    category: text('category').notNull(),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id),
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
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('post_comments_post_idx').on(t.postId, t.createdAt)]
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
