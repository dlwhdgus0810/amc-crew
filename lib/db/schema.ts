import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type { TitleMeta } from '../tmdb';

/**
 * 지운 시각 — null이면 살아 있다.
 *
 * 사람이 쓴 것(모임·댓글·사진·공지·정산)은 행을 지우지 않고 이 칸에 시각을 적는다.
 * 모임 하나를 지우면 CASCADE로 그 모임의 댓글·사진·정산·평점까지 같이 사라졌고,
 * 사진은 저장소의 파일까지 지웠다 — 잘못 누르면 되돌릴 방법이 없었다.
 *
 * **읽는 자리마다 `isNull(...deletedAt)`을 붙여야 한다.** 한 곳만 빠뜨리면 지운 것이
 * 도로 보인다. 알림(notifications)이 먼저 쓰던 방식과 같다.
 *
 * 껐다 켜는 것(참가·구독·즐겨찾기·평점·명단·친구)에는 붙이지 않는다. 그쪽은 남길
 * 내용이 없고, (모임,사람)이 기본키라 죽은 행이 남으면 다시 참가할 때 부딪힌다.
 *
 * 함수인 이유: drizzle의 칸 빌더는 테이블마다 새로 만들어야 한다. 하나를 여러 테이블에
 * 나눠 쓰면 상태가 섞인다.
 */
const deletedAt = () => timestamp('deleted_at', { withTimezone: true });

export const users = pgTable('users', {
  id: text('id').primaryKey(), // 카카오 회원번호
  kakaoName: text('kakao_name').notNull(),
  nickname: text('nickname'), // null이면 카카오 닉네임 폴백
  /**
   * 영어 이름 — 한국어가 아닌 언어로 보는 사람에게 이 이름이 먼저 나온다.
   *
   * 이름이 카카오 닉네임에서 오다 보니 대부분 한글이고, 한국어가 아직 익숙하지 않은
   * 회원에게는 명단이 읽을 수 없는 글자로만 남는다. 별명이 아니라 같은 사람의 이름을
   * 다른 글자로 적어 둔 것이라, 실명만 쓰는 모임(allow_nicknames=false)에서도 그대로 나온다.
   */
  nameEn: text('name_en'),
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
  /**
   * 등급 알림을 어디까지 보냈나 — 순위표별로 마지막으로 알린 등급의 min.
   * `{ host: 15, join: 5, contrib: 0 }` 꼴이고, 등급이 없으면 0이다.
   *
   * **칸이 비어 있는 것과 0인 것이 다르다.** 비어 있으면 「아직 안 재봤다」라서
   * 그 회원의 지금 등급을 조용히 적어 두기만 하고 알리지 않는다 — 이 기능을 켠 날
   * 이미 오래전에 받은 등급이 서른 명에게 한꺼번에 울리는 것을 막는 자리다
   * (lib/db/tiers.ts). 순위표를 새로 하나 더 만들어도 같은 규칙이 그대로 먹는다.
   */
  tierSeen: jsonb('tier_seen').$type<Record<string, number>>(),
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

    /**
     * 이 모임의 사진을 회원 누구나 볼 수 있는지. 기본은 false — 참가자와 관리자만이다.
     *
     * 사진은 같이 논 사람들 사이의 것이라는 게 기본값이고, 여는 것은 **그 모임을 연
     * 사람의 판단**이다. 그래서 켜는 사람은 호스트·같이 연 사람·관리자로 한정한다.
     * 참가자 아무나 켤 수 있으면 「내가 찍힌 사진」을 남이 공개하는 일이 된다.
     *
     * visibility와는 별개다. 비공개(link) 모임도 켤 수 있다 — 다만 그러면 그 모임이
     * 있었다는 사실과 명단의 얼굴들이 모아보기에 나간다. 켤 때 화면에서 그렇게 적어 준다.
     *
     * 익명 카테고리(별보러가자)에서는 이 스위치를 아예 안 그린다. 사진에는 얼굴이
     * 찍히므로, 이름을 가려 둔 자리에서 사진만 공개하면 가린 의미가 없다.
     */
    photosPublic: boolean('photos_public').notNull().default(false),

    /**
     * YYYY-MM-DD (사전순 = 시간순). **null이면 「날짜 미정」 — 사람부터 모으는 모임이다.**
     *
     * 독서나눔처럼 번개로 시작할 수 없는 종목 때문에 열어 뒀다. 몇 명 모이면 그때
     * 날짜를 잡는 식이라, 없는 날짜를 아무거나 적어 두면 캘린더가 거짓말을 한다.
     *
     * null이 어디서 어떻게 빠지는지는 대부분 SQL이 알아서 한다 — 날짜 비교는 null에
     * 대해 참이 되지 않으므로 캘린더·다음 모임 요약·순위 집계·오늘 알림에서 저절로
     * 빠진다. 목록에 **넣는** 쪽만 따로 적어 준다(lib/db/posts.ts의 listPosts).
     * JS로 비교하는 곳(isPastSlot)은 null을 「안 지났음」으로 본다.
     */
    date: text('date'),
    /** HH:mm — 날짜가 미정이면 이것도 없다 (둘은 늘 같이 있거나 같이 없다) */
    startTime: text('start_time'),
    endTime: text('end_time'), // HH:mm — 안 적어도 된다 (lib/dates.ts의 effectiveEnd 참고)
    /**
     * 마지막 날 (YYYY-MM-DD). **null이면 하루짜리 모임이다.**
     *
     * 여행처럼 여러 날 이어지는 모임을 위해 열었다. 시각과는 다른 축이다 — 여행은
     * 「8월 5일 오전 8시」가 아니라 「8월 5일부터 9일까지」다. 그래서 여행 카테고리는
     * 시각 칸을 아예 안 그리고 이 칸만 받는다 (lib/categories.ts의 dateRange).
     *
     * **끝났는지는 이 날로 본다.** date만 보면 3박 4일 여행이 출발 다음 날부터 「지난
     * 모임」으로 내려간다 — 아직 가 있는데. lib/dates.ts의 isPastSlot과 목록 질의
     * (lib/db/posts.ts)가 둘 다 COALESCE(end_date, date)를 쓴다.
     *
     * 캘린더에는 시작일 하루만 찍힌다. 여러 날에 걸쳐 칠하려면 캘린더가 날짜마다 범위를
     * 훑어야 하는데, 이 칸을 쓰는 카테고리가 하나뿐인 지금은 값이 안 맞는다.
     */
    endDate: text('end_date'),
    /**
     * 숙소 (선택). lodgingLabel이 있는 카테고리에서만 칸이 생긴다 (지금은 여행).
     *
     * location과 따로 두는 이유: 여행에서 location은 **출발 전에 만나는 곳**이고 숙소는
     * 가서 머무는 곳이다. 한 칸에 넣으면 「어디로 모여요」와 「어디서 자요」가 섞여서
     * 출발 아침에 아무도 어디로 갈지 모른다.
     */
    lodging: text('lodging'),
    /**
     * 위 숙소 주소를 좌표로 바꿔 둔 것 — 사진 타임라인이 「숙소」 라벨을 붙일 때 쓴다.
     *
     * 주소는 사람이 자유롭게 쓰는 칸이라 그때그때 좌표로 바꿀 수 없다(바깥에 물어봐야
     * 하고 초당 한 번 제한이 있다). 그래서 백필 때 **모임당 한 번** 물어보고 여기 적어 둔다
     * (app/api/admin/photo-place). 못 찾는 주소면 null이고, 그러면 라벨이 안 붙을 뿐이다.
     *
     * 라벨을 사진에 박아 두지 않고 좌표로 남기는 이유: 「숙소」는 번역되는 말이라
     * (ko/en/es) 글자로 저장하면 한 언어에 갇힌다. 좌표로 두면 그릴 때 고른다.
     */
    lodgingLat: doublePrecision('lodging_lat'),
    lodgingLon: doublePrecision('lodging_lon'),
    location: text('location').notNull(),
    description: text('description'),
    capacity: integer('capacity'), // 정원. null이면 무제한
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: deletedAt(),
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
    deletedAt: deletedAt(),
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
    /**
     * 고른 파일 그대로의 경로 — 「원본 받기」가 이걸 준다.
     *
     * 위 pathname은 브라우저가 올리면서 줄여 구운 것이라 화면에 뿌리기 좋고,
     * 이건 손대지 않은 파일이라 화질이 그대로다. HEIC일 수도 있어서 화면에는 못 쓴다
     * (크롬·안드로이드가 못 연다) — 그래서 두 벌이 필요하다.
     *
     * 이 칸이 생기기 전에 올린 사진은 null이다. 그때는 「원본 받기」가 안 뜬다.
     */
    originalPathname: text('original_pathname'),
    /**
     * 격자에 뿌릴 작은 사진(긴 변 400px) — 모아보기·모임 화면·카드가 이걸 쓴다.
     *
     * 왜 세 벌이 되었나: 격자 한 칸은 폰에서 110px 남짓인데 거기에 1600px짜리
     * 화면용(중앙값 642KB)을 넣고 있었다. 첫 화면 열두 칸이 7.5MB였고, 그게 모아보기가
     * 느리던 이유다. 400px 한 장이면 30KB 언저리다.
     *
     * 화면용을 더 줄여 해결할 수는 없다 — 크게 보기가 같은 파일을 쓴다. 격자와 확대는
     * 필요한 크기가 다르니 파일을 나눈다.
     *
     * 이 칸이 생기기 전에 올린 사진은 null이고, 그때는 격자도 화면용을 쓴다(느릴 뿐
     * 깨지지 않는다). 관리자 화면의 백필이 채워 준다.
     */
    thumbPathname: text('thumb_pathname'),
    width: integer('width'),
    height: integer('height'),
    /*
     * 찍은 시각과 찍은 자리 — 여행 타임라인이 쓴다.
     *
     * 파일 안(EXIF)에 원래 들어 있는 값이다. 화면용·썸네일은 캔버스로 다시 구우면서
     * EXIF가 통째로 날아가므로, 손 안 댄 원본을 올릴 때 한 번 읽어 여기 옮겨 적는다
     * (lib/exif.ts). 원본을 못 올린 사진은 영영 null이다.
     *
     * **여행 카테고리에서만 채운다** (lib/categories.ts의 timeline). 좌표는 「우리집」이라고
     * 안 써도 그 집이 어디인지 말해 버리는 값이라, 쓸 데가 있는 자리에만 남긴다.
     * 서버가 카테고리를 보고 거른다 — 브라우저가 보낸 값을 그냥 담지 않는다.
     */
    takenAt: timestamp('taken_at', { withTimezone: true }),
    /**
     * 찍은 자리의 UTC 오프셋(분). -300 = 미국 중부 여름.
     *
     * 이게 있어야 카메라가 보여 준 벽시계 시각을 되살릴 수 있다. 보는 사람이 어느
     * 시간대에 있든 「8/14 저녁 7시」는 그때 거기서의 7시여야 한다.
     * 못 읽었으면 null이고, 그때 takenAt에는 벽시계 시각이 UTC인 척 담겨 있다.
     */
    takenOffset: integer('taken_offset'),
    lat: doublePrecision('lat'),
    lon: doublePrecision('lon'),
    /**
     * 그 좌표의 이름 — 「SomiSomi」나 「The Colony, TX」.
     *
     * 좌표만으로는 이름이 안 나와서 바깥(Nominatim)에 물어봐야 한다. 좌표는 안 변하니
     * 한 번 묻고 여기 적어 두면 끝이다 — 그리는 자리에서는 절대 안 묻는다.
     *
     * **사진 낱장이 아니라 「자리」마다 한 번씩 묻는다.** 같은 자리 사진들은 300m 안에
     * 있어서 이름이 같고, 열한 장을 낱개로 물으면 일곱 번이면 될 것을 열한 번 묻는다
     * (lib/photo-timeline.ts, app/api/admin/photo-place).
     *
     * 못 찾았거나 아직 안 물어본 사진은 null이다 — 그때는 시각만 보여준다.
     */
    place: text('place'),
    /**
     * 위 이름을 **어느 길로 얻었는지** — 'osm' | 'google' | 'manual'.
     *
     * 「어느 API가 이 글자를 만들었나」가 아니라 「어느 파이프라인이 이 자리를 다 봤나」다.
     * 구글 키가 있을 때는 가게 이름을 구글에 묻고 못 찾으면 도시 이름을 OSM에서 받는데,
     * 그렇게 나온 「Carrollton, TX」도 'google'로 적는다 — 구글까지 물어본 자리라는 뜻이라야
     * 다시 물어볼 자리를 고를 수 있다.
     *
     * 이게 있어야 하는 이유: 키가 나중에 생기면 이미 붙은 OSM 이름을 다시 물어 올려야 하고,
     * 사람이 손으로 고친 이름은 그때 덮이면 안 된다.
     */
    placeSource: text('place_source'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** 지워도 저장소의 파일은 남긴다 — 되살릴 때 깨진 그림이 되지 않도록 (lib/db/photos.ts) */
    deletedAt: deletedAt(),
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

/**
 * 모임 한줄 후기 — 다녀온 사람이 남기는 글.
 *
 * 위 post_ratings와 따로 두는 이유가 둘이다. 저건 무비나잇 전용이고(lib/ratings.ts의
 * RATABLE_CATEGORIES), 점수가 notNull이라 글만 남길 수가 없다.
 *
 * **점수는 안 받는다.** 열두어 명이 서로 아는 모임에서 모임에 점수를 매기기 시작하면
 * 연 사람이 평가받는 꼴이 된다. 무비나잇 별점은 영화에 매기는 것이라 결이 다르다.
 *
 * 한 사람이 한 모임에 한 줄(PK). 고치면 덮어쓴다 — 같은 모임에 여러 줄을 쌓으면
 * 모아보기가 한 사람 목소리로 채워진다.
 */
export const postReviews = pgTable(
  'post_reviews',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** 고친 시각 — 모아보기는 이 순서로 보여준다 (고친 글이 위로 온다) */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: deletedAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] }), index('post_reviews_recent_idx').on(t.updatedAt)]
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
    /**
     * 정산 알림이면 **어느 정산인지** (그 밖에는 null).
     *
     * post_id만으로는 못 가린다 — 한 모임에 정산이 여러 개라(schema.ts의 settlements)
     * 「이 사람에게 마지막으로 언제 알렸나」가 정산끼리 섞인다. 그러면 다시 알리기 화면이
     * 다른 정산 때문에 「방금 보냈다」고 말해서, 받을 사람이 안 눌러도 되는 줄 안다.
     *
     * 굳이 정산만 칸을 갖는 이유: 사람마다 금액이 달라서 정산은 알림이 사람 단위로 나가는
     * 유일한 종류다. 나머지는 모임 하나에 문구 하나라 post_id로 충분하다.
     */
    settlementId: uuid('settlement_id').references(() => settlements.id, { onDelete: 'cascade' }),
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
export const settlements = pgTable(
  'settlements',
  {
  id: uuid('id').primaryKey(),
  /**
   * 짧은 링크 주소 (/v/<code>) — 앱 밖의 사람에게 전달하는 Venmo 링크에 쓴다.
   * 금액이 박힌 venmo.com 주소는 96자까지 늘어나 알림 본문에서 읽기 어렵다.
   * 우리 도메인이라 카카오 메시지에서 주소가 바뀌지도 않는다.
   */
  shortCode: text('short_code').unique(),
  /**
   * **한 모임에 여러 개 붙는다** (예전에는 unique였다).
   *
   * 여행에서 한 사람이 여러 번 결제하고, 결제마다 나눠 내는 사람이 다르다 — 숙소는
   * 다섯 명, 렌터카는 셋, 저녁은 넷. 정산 하나에 항목을 여러 개 넣는 것으로는 안 되는데,
   * 받을 사람이 정산마다 다르기 때문이다. 그래서 「정산 = 한 사람이 한 번 받을 것」이다.
   */
  postId: uuid('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  payeeId: text('payee_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * 지운 정산. 행은 남기고 표시만 한다 — 항목·명단도 그대로 붙어 있다.
   *
   * 예전에는 post_id가 unique라 지운 자리를 되살려 썼는데, 이제는 정산이 여러 개라
   * 새로 만들면 그냥 새 행이다. 지운 것은 지운 채로 남는다.
   */
  deletedAt: deletedAt(),
}, (t) => [index('settlements_post_idx').on(t.postId, t.createdAt)]);

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

/**
 * 「보냈다」 표시 — 정산 하나에서 **낸 사람 한 명이 한 줄**이다.
 *
 * 열 명이 넘게 나눠 내는 정산이 있는데, 받는 사람은 벤모 알림 목록과 명단을 번갈아 보며
 * 누가 아직 안 냈는지 세고 있었다. 줄이 있으면 냈고 없으면 안 낸 것이다.
 *
 * **누가 표시했는지(marked_by)를 같이 적는다.** 낸 사람이 스스로 「보냈어요」를 누른 것과
 * 받은 사람이 「받았어요」로 확인한 것은 무게가 다르다 — 벤모는 바로 꽂히지만 현금이나
 * Zelle은 며칠 걸리기도 해서, 받은 사람이 확인한 줄만 진짜 끝난 것이다. 두 상태를
 * 따로 두는 대신 이 칸 하나로 구분한다.
 *
 * 정산을 지우면 같이 사라진다. 표시만 남아 봐야 가리킬 곳이 없다.
 */
export const settlementPaid = pgTable(
  'settlement_paid',
  {
    settlementId: uuid('settlement_id')
      .notNull()
      .references(() => settlements.id, { onDelete: 'cascade' }),
    /** 낸 사람 */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 표시한 사람 — 본인이거나 받을 사람이다 */
    markedBy: text('marked_by')
      .notNull()
      .references(() => users.id),
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
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

/**
 * 산 테마 — 한 사람이 한 테마를 한 줄로 갖는다.
 *
 * 달란트는 따로 쌓아 두지 않는다. **활동에서 계산해 내고 산 값을 빼는 방식**이다
 * (lib/db/shop.ts) — 잔액을 칸에 들고 있으면 모임이 지워지거나 점수 규칙이 바뀔 때
 * 그 칸과 실제 활동이 어긋나고, 어긋난 뒤에는 무엇이 맞는지 알 방법이 없다.
 *
 * 그래서 **그때 낸 값(coins)을 같이 적는다.** 값을 나중에 올리거나 내려도 이미 산
 * 사람의 잔액이 따라 움직이면 안 된다.
 */
export const themePurchases = pgTable(
  'theme_purchases',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** lib/card-theme.ts의 CardTheme 값 */
    theme: text('theme').notNull(),
    /** 살 때 낸 값 — 나중에 값이 바뀌어도 이 줄은 그대로다 */
    coins: integer('coins').notNull(),
    /**
     * 선물이면 **낸 사람**. 자기가 산 것이면 null이다.
     *
     * 값을 낸 사람과 갖는 사람이 달라서 칸이 하나 더 필요하다. 이 줄의 coins는 낸
     * 사람의 지갑에서 빠지고(lib/db/shop.ts의 walletOf), 받은 사람은 갖기만 한다.
     */
    gifterId: text('gifter_id').references(() => users.id, { onDelete: 'set null' }),
    boughtAt: timestamp('bought_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.theme] })]
);

/**
 * 관리자가 감춰 둔 카테고리.
 *
 * 열네 장이 늘 다 보일 필요는 없다 — 계절이 지난 종목이나 당분간 안 여는 것을 내려두면
 * 홈과 둘러보기가 지금 굴러가는 것들로 좁혀진다. 카테고리 자체는 코드에 그대로 남고
 * 주소(/c/<slug>)로도 열리므로, 이건 지우는 것이 아니라 목록에서 빼는 것이다.
 */
/**
 * 번역 캐시 — 같은 글을 두 번 번역해 값을 두 번 치르지 않으려고 둔다.
 *
 * 글에 붙이지 않고 **글자 자체**에 붙인다(원문 해시 + 대상 언어). 그래서 서로 다른 모임에
 * 같은 댓글이 달려도 한 번만 번역되고, 원문이 고쳐지면 해시가 달라져 저절로 새 줄이 된다 —
 * 낡은 번역이 남아 원문과 어긋날 일이 없다. 지워야 할 옛 줄은 그냥 안 읽히고 남는다.
 *
 * 원문(source)도 같이 담는다. 해시만으로는 무엇이 번역된 것인지 사람이 알아볼 수 없고,
 * 만에 하나 해시가 부딪혔을 때 알아차릴 방법도 없다.
 */
export const translations = pgTable(
  'translations',
  {
    /** 원문의 sha256 (hex) */
    hash: text('hash').notNull(),
    /** 어느 언어로 옮긴 것인지 — 'ko' | 'en' | 'es' */
    target: text('target').notNull(),
    source: text('source').notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.hash, t.target] })]
);

export const hiddenCategories = pgTable('hidden_categories', {
  category: text('category').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 카테고리 참가신청 — 「사람이 먼저, 모임은 그다음」인 카테고리에서 쓴다.
 *
 * 독서나눔처럼 번개로 시작할 수 없는 종목이 있다. 누가 호스트로 나서서 날짜를 잡는
 * 순서가 아니라, 할 사람이 몇 명 모이고 나서 그 사람들끼리 상의해 모임을 만든다.
 * 그래서 이 명단은 모임(posts)이 아니라 **카테고리에** 붙는다.
 *
 * 모임이 만들어져도 명단은 그대로 둔다 — 「독서나눔 할 사람」 명단이라 다음 회차에도
 * 그대로 쓰인다. 빠지려면 본인이 신청을 취소한다.
 */
export const categorySignups = pgTable(
  'category_signups',
  {
    category: text('category').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.category, t.userId] })]
);

/**
 * 관리자가 올리는 공지 — 앱을 열면 한 번 뜨는 알림창.
 *
 * 새 소식(lib/changelog.ts)과는 다르다. 저건 "무엇이 바뀌었나"를 코드와 함께 배포하는
 * 기록이고, 이건 "이렇게 해주세요"를 그때그때 띄우는 말이다. 그래서 코드가 아니라 DB에 있다.
 *
 * 여러 줄을 쌓아 둘 수 있지만 화면에 뜨는 것은 켜져 있는 것 중 가장 최근 하나뿐이다 —
 * 알림창이 둘 겹치면 어느 것도 제대로 안 읽힌다.
 */
export const notices = pgTable('notices', {
  id: uuid('id').primaryKey(),
  /**
   * 앱이 쓰는 세 언어로 적는다 — 앱 어디에도 한국어만 나오는 화면은 없다.
   *
   * 한국어 말고는 비워 둘 수 있고, 비어 있으면 적혀 있는 다른 언어를 그대로 보여준다.
   * 번역이 늦었다고 공지가 안 뜨는 것보다는 낫다 — 다른 언어로 보는 사람도 한국어를 읽는다.
   */
  titleKo: text('title_ko').notNull(),
  titleEn: text('title_en'),
  titleEs: text('title_es'),
  /** 본문 — 제목만으로 충분하면 비워 둔다 */
  bodyKo: text('body_ko'),
  bodyEn: text('body_en'),
  bodyEs: text('body_es'),
  /**
   * 「보러 가기」가 데려갈 앱 안의 경로 (`/photos`처럼). 비워 두면 버튼 없이 「알겠어요」만.
   *
   * 공지가 「이렇게 해주세요」인데 어디로 가야 하는지는 안 적혀 있으면, 읽은 사람이
   * 탭바를 뒤져 찾아내야 한다. 새 화면을 알릴 때가 특히 그렇다 — 알리는 목적이
   * 「가 보게 하는 것」인데 가는 길을 안 주면 절반만 한 셈이다.
   *
   * 앱 안 경로만 받는다(`/`로 시작, `//`는 거른다). 밖으로 나가는 주소를 넣을 수 있으면
   * 공지 하나로 회원 전체를 임의의 사이트에 보내는 길이 된다 — 로그인 복귀 경로를
   * 같은 이유로 거르는 lib/auth.ts의 safeNextPath와 같은 규칙이다.
   */
  linkPath: text('link_path'),
  /**
   * 이 공지를 볼 사람들. 빈 배열이면 전체 —
   * 기본이 전체이고, 골라 담는 것은 올리기 전에 나한테만 띄워 보려고 두는 장치다.
   *
   * 표를 따로 두지 않은 이유: 열두어 명짜리 명단이고, 이걸로 무언가를 조회할 일이 없다.
   * 누가 봤는지는 여기 남지 않는다 (읽음 표시는 각자의 기기에만 있다).
   */
  targets: jsonb('targets').$type<string[]>().notNull().default([]),
  /** 내려도 지우지 않는다 — 무슨 공지를 언제 올렸는지가 남아야 한다 */
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * 마지막으로 손댄 시각.
   *
   * "이 사람이 이 공지를 봤는가"의 열쇠가 (id, updatedAt)이라, 내용을 고치면
   * 한 번 닫았던 사람에게도 다시 뜬다. 고쳤다는 건 다시 읽혀야 한다는 뜻이다.
   */
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * active와는 다른 칸이다. active=false는 「내렸다」 — 관리자 목록에는 그대로 남는다.
   * 이건 「지웠다」 — 관리자 목록에서도 사라진다. 되살릴 수 있다는 점만 달라진다.
   */
  deletedAt: deletedAt(),
});

/**
 * 공지를 확인한 사람 — 「알겠어요」를 누른 순간 한 줄.
 *
 * 이걸 두는 이유가 둘이다. 하나는 올린 쪽에서 「다들 봤나」를 알 수 있어야 해서고,
 * 다른 하나는 읽음 표시가 기기가 아니라 사람에게 붙어야 폰에서 닫은 것을 노트북이 알아서다.
 *
 * 「눌렀다」이지 「읽었다」가 아니다 — 그 차이는 화면 문구가 감당한다.
 *
 * seenAt은 지운 시각이 아니라 판정 기준이다: 공지의 updatedAt이 이보다 나중이면
 * 내용이 그 뒤에 바뀐 것이므로 다시 띄운다. 그래서 「어느 판을 봤나」를 따로 담지 않는다.
 */
export const noticeReads = pgTable(
  'notice_reads',
  {
    noticeId: uuid('notice_id')
      .notNull()
      .references(() => notices.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.noticeId, t.userId] })]
);
