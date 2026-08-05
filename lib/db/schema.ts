import { boolean, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { TitleMeta } from '../tmdb';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // 카카오 회원번호
  kakaoName: text('kakao_name').notNull(),
  nickname: text('nickname'), // null이면 카카오 닉네임 폴백
  // 프로필 사진 — 브라우저에서 256px로 줄인 data URL. 친구 규모라 별도 저장소를 두지 않는다.
  avatar: text('avatar'),
  kakaoNameHistory: jsonb('kakao_name_history').$type<{ name: string; at: string }[]>().notNull().default([]),
  birthday: text('birthday'), // YYYY-MM-DD, null이면 온보딩 미완료
  gender: text('gender'), // 'male' | 'female', null이면 온보딩 미완료
  locale: text('locale'), // 'ko' | 'en', null이면 기본(한국어) — 알림 문구도 이 언어로 만든다
  /**
   * 마지막으로 앱을 보고 있던 시각 — 관리자 화면의 "지금 접속 중"에만 쓴다.
   * 일부러 최신 시각 하나만 덮어쓴다. 이력을 쌓으면 "누가 언제 들어왔나" 기록이 되어버린다.
   */
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  /** Venmo 아이디 — 정산에서 "보내기" 링크를 만들 때만 쓴다 (@ 없이 저장) */
  venmo: text('venmo'),
  /**
   * Zelle로 받을 전화번호나 이메일.
   * Zelle은 공개 API도 딥링크도 없어서 링크를 만들 수 없다 — 화면에 띄우고 복사시키는 게 전부다.
   */
  zelle: text('zelle'),
  /** 새 소식(업데이트)을 카카오톡으로 받을지 — 기본은 꺼짐, 프로필에서 켠다 */
  newsAlerts: boolean('news_alerts').notNull().default(false),
  /**
   * 이미 끝난 비공개 모임을 캘린더·지난 모임 목록에 띄울지 — 기본은 꺼짐.
   *
   * 비공개 모임은 끝나고 나면 대개 남에게 보일 이유가 없는 기록이다. 그런데 캘린더는
   * 지난 날짜도 함께 그리는 화면이라, 켜 두지 않으면 옆 사람 화면에 지난 비공개 모임이
   * 그대로 남는다. 보고 싶은 사람만 켠다.
   */
  showPastPrivate: boolean('show_past_private').notNull().default(false),
  /**
   * 친구들에게 "접속 중"으로 보일지 — 기본은 보임.
   *
   * 친구별 스위치(friendships.a/b_shows_presence)와는 층이 다르다. 저건 "이 사람에게만
   * 감추기"고, 이건 한 번에 전부 끄는 것이다. 둘 중 하나라도 꺼져 있으면 안 보인다.
   *
   * 신호(lastSeen·presence_sessions)는 이 값과 무관하게 그대로 쌓인다 — 끄는 것은
   * 남에게 보이는 표시일 뿐이라, 껐다고 접속 기록까지 비면 관리자 표가 거짓말이 된다.
   */
  showPresence: boolean('show_presence').notNull().default(true),
  /**
   * 이 시각까지 앱을 쓸 수 없다 (관리자가 정한 정지 기간).
   * 지나간 시각이면 정지가 아니다 — 풀어줄 때 따로 지우지 않아도 저절로 풀린다.
   */
  bannedUntil: timestamp('banned_until', { withTimezone: true }),
  /** 정지 사유 — 본인 화면에 그대로 보여준다 (왜 막혔는지 모르면 같은 일이 반복된다) */
  banReason: text('ban_reason'),
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
    /** 같이 여는 사람 — 다음 주 회차에도 그대로 이어진다 */
    coHostId: text('co_host_id').references(() => users.id),
    /** 닉네임 허용 여부도 다음 주 회차로 이어진다 */
    allowNicknames: boolean('allow_nicknames').notNull().default(false),
    weekday: integer('weekday').notNull(), // 0=일 ~ 6=토
    startDate: text('start_date').notNull(), // 첫 회차 날짜 (이전 날짜는 생성하지 않음)
    title: text('title'),
    titleMeta: jsonb('title_meta').$type<TitleMeta>(),
    startTime: text('start_time').notNull(), // HH:mm
    endTime: text('end_time'), // HH:mm — 안 적어도 된다 (lib/dates.ts의 effectiveEnd 참고)
    location: text('location').notNull(),
    description: text('description'),
    capacity: integer('capacity'),
    // 규칙에서 열리는 회차의 공개 범위 — 비공개로 만든 정기 모임은 다음 주도 비공개여야 한다
    visibility: text('visibility').notNull().default('public'),
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
    /**
     * 같이 연 사람 (최대 한 명 — 주최자 + 이 사람으로 둘까지).
     * 호스트 점수는 참가 인원을 호스트 수로 나눠 갖는다 (lib/db/hosting.ts).
     */
    coHostId: text('co_host_id').references(() => users.id),
    /**
     * 이 모임 안에서 닉네임으로 보여도 되는지. 기본은 실명 모임(false)이다 —
     * 같이 노는 사람들끼리 누가 누군지 모르면 명단이 제 구실을 못 한다.
     * 켜면 그 모임의 이름·댓글·참가자 명단이 각자의 닉네임으로 보인다 (설정한 사람만).
     */
    allowNicknames: boolean('allow_nicknames').notNull().default(false),
    title: text('title'), // 뭐 볼지/뭐 할지 (카테고리에 titleLabel이 있을 때만 사용)
    titleMeta: jsonb('title_meta').$type<TitleMeta>(), // TMDB 메타 (평점·감독·출연·포스터), 검색으로 고른 경우만
    // 정기 모임에서 생성된 회차면 규칙 id (규칙 삭제 시 회차는 남기고 연결만 끊는다)
    recurringRuleId: uuid('recurring_rule_id').references(() => recurringRules.id, { onDelete: 'set null' }),
    // AMC 회차에서 만든 모임이면 그 회차 id — 같은 회차로 두 번 만들지 않기 위해 쓴다
    amcShowtimeId: text('amc_showtime_id'),

    /**
     * 공개 범위. 'public'은 카테고리 피드에 보이고 구독자에게 알림이 간다.
     * 'link'는 링크(/p/<id>)를 아는 사람만 열 수 있고, 목록·알림·홈 요약에서 빠진다.
     */
    visibility: text('visibility').notNull().default('public'),

    date: text('date').notNull(), // YYYY-MM-DD (사전순 = 시간순)
    startTime: text('start_time').notNull(), // HH:mm
    endTime: text('end_time'), // HH:mm — 안 적어도 된다 (lib/dates.ts의 effectiveEnd 참고)
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
    /**
     * 닉네임을 감추고 남긴 댓글.
     * 가리는 것은 화면에 보이는 닉네임뿐이다 — userId는 응답에 그대로 나간다.
     * 본인이 지울 수 있어야 하고, 도배를 막을 수단도 필요하기 때문.
     * (그래서 참가자 목록의 id와 맞춰보면 누구인지 알 수 있다. 친구들끼리 쓰는 앱이라
     *  "이름만 안 보이면 된다"로 충분하다고 보고 둔 선택이다.)
     */
    anonymous: boolean('anonymous').notNull().default(false),
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

/**
 * 모임 사진 — 한 모임에 여러 장, 여러 사람이, 언제든.
 *
 * 안내문 한 장과 다녀와서 찍은 사진을 따로 두지 않는다. 만들면서 고른 것도 그냥 첫 사진이고,
 * 카드에 실리는 것도 그 첫 장이다 — 나눠 두면 「어느 쪽에 올려야 하나」를 매번 묻게 된다.
 *
 * 사진은 Vercel Blob에 있고 여기에는 주소만 있다. 아바타를 data URL로 담았다가 겪은 일이
 * lib/db/posts.ts:171에 적혀 있다 — 이건 그 교훈을 지킨 것이다.
 *
 * 담는 것은 주소가 아니라 경로다 — 스토어가 비공개라 주소는 서명해야 열리고 유효기간이 있다.
 */
export const postPhotos = pgTable(
  'post_photos',
  {
    id: uuid('id').primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    /** 올린 사람 */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 저장소 안의 경로. 서명(읽기)과 삭제 둘 다 이걸 쓴다 */
    pathname: text('pathname').notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('post_photos_post_idx').on(t.postId, t.createdAt)]
);

/**
 * 무비나잇 평점 — 한 사람이 한 모임에 한 번, 끝난 뒤에만.
 *
 * 점수는 0~100 정수다. 화면에서는 10점 만점 0.1 단위로 보여주는데(8.4 → 84), 실수로
 * 담아 두면 평균에서 소수점 오차가 붙고 "8.299999"가 새어 나온다. 정수로 담고 나눌 때만
 * 소수로 바꾼다.
 *
 * 모임에 붙는 점수지 영화에 붙는 점수가 아니다 — 같은 영화를 두 번 보면 각각 따로 매긴다.
 */
export const postRatings = pgTable(
  'post_ratings',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 0~100 (= 0.0~10.0) */
    score: integer('score').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })]
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

/**
 * 친구 — 한 쌍에 한 줄. 늘 user_a < user_b 순으로 넣어서 (A→B)와 (B→A)가 같은 줄이 된다.
 *
 * 방향을 그대로 저장하면 두 사람이 같은 순간에 서로를 추가할 때 줄이 둘로 갈라진다.
 * 순서를 고정해 두면 그 경우 기본키가 부딪히고, 부딪힌 자리에서 바로 수락으로 바뀐다.
 * 순서는 lib/db/friends.ts의 pair() 한 곳에서만 정한다.
 *
 * 거절·취소·친구 끊기는 셋 다 줄을 지운다 — 남겨 둘 이유가 있는 상태가 아니다.
 */
export const friendships = pgTable(
  'friendships',
  {
    userA: text('user_a')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userB: text('user_b')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 누가 먼저 걸었는지 — 수락할 수 있는 사람(반대편)을 가리는 데 쓴다 */
    requestedBy: text('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'), // pending | accepted
    /*
     * 내 접속 상태를 이 친구에게 보여줄지. 한 쌍에 줄이 하나뿐이라 방향마다 칸을 따로 둔다 —
     * 내가 숨긴다고 상대까지 안 보이게 되면 안 된다. 기본은 서로 보임.
     */
    aShowsPresence: boolean('a_shows_presence').notNull().default(true),
    bShowsPresence: boolean('b_shows_presence').notNull().default(true),
    /*
     * 내 모임을 이 친구에게 어디까지 보여줄지. 접속 표시와 같은 이유로 방향마다 따로 둔다.
     * all(예정+지난) | upcoming(예정만) | none(숨김). 비공개 모임은 어느 값에서도 나가지 않는다.
     */
    aShowsMeetups: text('a_shows_meetups').notNull().default('all'),
    bShowsMeetups: text('b_shows_meetups').notNull().default('all'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  // 기본키가 user_a 쪽 조회를 덮으므로 반대쪽만 따로 깐다 ("내 친구"는 양쪽을 다 본다)
  (t) => [primaryKey({ columns: [t.userA, t.userB] }), index('friendships_b_idx').on(t.userB, t.status)]
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

/**
 * 건의함 티켓 — 사소한 개선부터 새 기능까지 뭐든 받는다.
 * 카테고리 제안(category_requests)은 이름·색이 필요한 별도 양식이라 따로 둔다.
 */
export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey(),
    // 발급 번호 — 사람이 부르기 위한 것 (#12). uuid와 별개로 순번을 매긴다.
    number: serial('number').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(), // feature | improve | bug | other
    title: text('title').notNull(),
    body: text('body'),
    status: text('status').notNull().default('open'), // open | planned | done | declined
    adminNote: text('admin_note'), // 관리자 답변
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tickets_status_idx').on(t.status, t.createdAt)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(), // 앱에서 생성
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    /**
     * 알림 종류 — 눌렀을 때 어디로 보낼지 정하는 데만 쓴다. 값은 lib/notif-kinds.ts에 모아 둔다.
     * 'settle'은 정산 카드로, 'friend_join'·'added'·'invite'는 모임 화면으로,
     * 'friend_req'·'friend_ok'는 친구 화면으로. null이면 예전처럼 카테고리 피드.
     */
    kind: text('kind'),
    message: text('message').notNull(),
    read: boolean('read').notNull().default(false),
    /**
     * 사용자가 지운 시각. 실제로 지우지 않고 표시만 한다 —
     * 본인 화면과 뱃지 숫자에서는 빠지고, 관리자 화면에서만 보인다.
     */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_read_idx').on(t.userId, t.read)]
);

/**
 * 접속 구간 — 신호(하트비트)가 이어지는 동안을 한 줄로 묶는다.
 *
 * 신호 하나당 한 줄씩 쌓으면 1분에 한 줄씩 늘어난다. 대신 직전 신호와 간격이
 * PRESENCE_GAP 안이면 그 줄의 ended_at만 늘리고, 더 벌어졌으면 새 줄을 만든다.
 * 그래서 줄 수 = 접속 횟수이고, ended_at - started_at 이 곧 머문 시간이다.
 */
export const presenceSessions = pgTable(
  'presence_sessions',
  {
    id: uuid('id').primaryKey(), // 앱에서 생성
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
  },
  // 조회는 늘 "이 사람의 최근 구간" 또는 "최근 N일" 이라 (user, ended) 순서가 맞다
  (t) => [index('presence_sessions_user_ended_idx').on(t.userId, t.endedAt)]
);

/**
 * 웹 푸시 구독 — 기기 하나가 한 줄이다 (폰과 태블릿은 따로 잡힌다).
 *
 * endpoint가 곧 그 기기의 주소이자 고유값이다. 브라우저가 구독을 갱신하면 새 endpoint가
 * 나오므로 옛 줄은 발송이 404/410으로 실패할 때 지운다 (lib/push.ts).
 * 사용자를 지우면 구독도 같이 지운다 — 남겨두면 주인 없는 주소로 계속 쏘게 된다.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    endpoint: text('endpoint').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // 브라우저가 준 암호화 키 — 이게 있어야 알림 내용을 그 기기만 읽을 수 있게 봉인한다
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // 발송은 늘 "이 사람들의 구독 전부"라 user_id로 찾는다
  (t) => [index('push_subscriptions_user_idx').on(t.userId)]
);

/**
 * 모임 정산 — 한 모임에 하나. 돈을 받을 사람(payee)이 만든다.
 *
 * 금액은 센트 정수로 둔다. 달러를 소수로 저장하면 3명이 10달러를 나눌 때
 * 반올림이 어긋나 합계가 원금과 안 맞는다.
 */
export const settlements = pgTable('settlements', {
  id: uuid('id').primaryKey(),
  /**
   * 짧은 링크 주소 (/v/<code>) — 앱 밖의 사람에게 전달하는 Venmo 링크에 쓴다.
   * 금액이 박힌 venmo.com 주소는 96자까지 늘어나 알림 본문에서 읽기 어렵다.
   * 우리 도메인이라 카카오 메시지에서 주소가 바뀌지도 않는다.
   */
  shortCode: text('short_code').unique(),
  postId: uuid('post_id')
    .notNull()
    .unique()
    .references(() => posts.id, { onDelete: 'cascade' }),
  payeeId: text('payee_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 정산 항목. 하나의 정산에 여러 개가 붙는다.
 * scope='all'이면 참가자 전원이 나눠 내고, 'some'이면 settlement_item_members에 적힌 사람만 낸다
 * (내기에서 진 사람들만 내는 경우).
 */
export const settlementItems = pgTable(
  'settlement_items',
  {
    id: uuid('id').primaryKey(),
    settlementId: uuid('settlement_id')
      .notNull()
      .references(() => settlements.id, { onDelete: 'cascade' }),
    label: text('label').notNull(), // 예: 레인비, 내기
    // 총 금액. 인원수로 나누는 것은 읽을 때 계산한다 (사람이 빠지면 몫도 따라 바뀐다)
    amountCents: integer('amount_cents').notNull(),
    scope: text('scope').notNull().default('all'), // all | some
    /** 이 앱에 없는 사람 몇 명까지 같이 나눌지 — 머릿수만 늘리고 청구는 하지 않는다 */
    extraPeople: integer('extra_people').notNull().default(0),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [index('settlement_items_settlement_idx').on(t.settlementId, t.sort)]
);

/** scope='some' 항목을 나눠 낼 사람들 */
/**
 * 모임에는 없지만 이 정산에는 들어가는 사람 (내 친구).
 *
 * 같이 밥은 먹었는데 모임에는 이름이 없는 경우가 있다. 참가자로 넣어 버리면
 * 그 모임에 갔던 것으로 기록이 남으니, 정산에만 얹는다.
 */
export const settlementMembers = pgTable(
  'settlement_members',
  {
    settlementId: uuid('settlement_id')
      .notNull()
      .references(() => settlements.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.settlementId, t.userId] })]
);

export const settlementItemMembers = pgTable(
  'settlement_item_members',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => settlementItems.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.userId] })]
);
