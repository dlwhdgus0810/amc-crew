# 모임 사진 — 플라이어 한 장 + 끝난 뒤 단체사진

> **상태: 계획. 아직 아무것도 안 만들었다.** (2026-08-05)
>
> 시작하려면 먼저 Vercel 대시보드에서 Blob 스토어를 만들고 `BLOB_READ_WRITE_TOKEN`을
> `.env.local`과 Vercel 환경변수에 넣어야 한다. 그전까지는 1~2단계(스키마·순수 헬퍼)까지만
> 진행할 수 있다.
>
> 만들고 나면 이 문서와 실제가 어긋나는 곳이 생긴다. 그때 고치거나 지울 것 —
> 낡은 계획서는 코드보다 더 헷갈리게 만든다.

## Context

정재호 님 건의(#9)다. 두 가지를 함께 물었는데 성격이 다르다.

- **플라이어** — 모임을 만들 때 한 장. 쿠폰·안내문 같은 것. 모임의 *내용*이라 제목·장소와 같은 자리에서 편집되고, 호스트가 정한다.
- **단체사진** — 모임이 끝난 뒤 여러 장, 여러 사람이. 모임의 *기록*이라 평점·댓글과 같은 성격이다.

그래서 저장 방식도 둘로 나눈다: 플라이어는 `posts`의 칸 하나, 단체사진은 새 표.

**이 기능의 진짜 작업량은 저장소를 붙이는 것이다.** 지금 이 앱에는 파일 저장소가 없다. 유일한 이미지 경로인 프로필 사진은 브라우저에서 256px로 줄인 **data URL을 Postgres `text` 칸에** 넣는다(`app/profile/profile-client.tsx:206`). 그 방식은 이미 한 번 사고를 냈다 — `lib/db/posts.ts:171`에 「avatar가 data URL이라 회원 한 명이 수십 KB다」라는 주석과 함께 좁은 select로 고친 흔적이 남아 있다. 단체사진은 규모가 다르다. 지난 모임 목록은 한 번에 30개를 읽고, Vercel 서버리스는 요청 본문이 4.5MB에서 잘린다.

**정해진 것**
| | |
|---|---|
| 저장소 | **Vercel Blob** (아직 미프로비저닝 — `BLOB_READ_WRITE_TOKEN` 없음) |
| 보기 | 로그인한 회원이면 안 간 모임 사진도 봄 (참가자 명단·댓글과 같은 기준) |
| 올리기 | 그 모임에 **참가한 사람만** |
| 비로그인 | 아무것도 안 나감 — 플라이어 URL도, 사진 수도 |

---

## 1. 저장소 — 브라우저가 곧바로 올린다

```
브라우저 ─① POST /api/blob/upload (토큰 요청)→ 우리 라우트 (여기서 권한 판정)
        ←② 짧게 사는 클라이언트 토큰──────────
        ─③ PUT https://<store>.public.blob.vercel-storage.com/… (실제 바이트)→ Blob
        ─④ POST /api/posts/<id>/photos {url,…}→ 우리 라우트 (행 저장)
```

바이트를 서버리스로 통과시키지 않는 이유: 4.5MB 벽에 걸리고, 대역폭을 두 번(들어오고 나가고) 물고, `upload()`가 주는 진행률을 버리게 된다.

**`app/api/blob/upload/route.ts`** — `handleUpload`의 `onBeforeGenerateToken`이 유일한 관문이다. 여기서 나간 토큰은 브라우저가 저장소에 직접 쓰게 해 주므로 판정을 전부 여기서 끝낸다:

1. `getSessionUser()` → 401, `banGuard()` (다른 모든 변경 라우트와 같음)
2. `clientPayload` = `{ kind: 'flyer' | 'photo', postId? }`
3. **photo**: `getPost` → 404 / `isPastSlot(...)`이 참 / `isParticipant(postId, user.id)`(`lib/db/posts.ts:643`) 또는 관리자 / 장수 상한 미만
4. **flyer**: 로그인·정지만 확인 (§4에서 이유)
5. `pathname` 정규식 고정 — 토큰이 그 경로에 묶이므로 안 막으면 저장소 아무 데나 쓸 수 있다
6. `{ allowedContentTypes: ['image/jpeg'], maximumSizeInBytes: 4_000_000, addRandomSuffix: true }`

JPEG만 받아도 되는 이유는 클라이언트가 canvas로 항상 재인코딩하기 때문이다(§3). 덤으로 EXIF의 GPS가 떨어져 나간다 — 친구 집에서 찍은 사진에는 그게 중요하다.

**`onUploadCompleted`에 DB 쓰기를 넣지 말 것.** Blob이 우리 배포본으로 되전화하는 방식이라 **localhost에서는 아예 안 불린다.** 프로덕션에서만 되는 기능이 된다. 행은 ④에서 평범한 앱 요청으로 저장하고, 이 콜백은 로그만 남긴다.

**개발 환경 주의**: `lib/db/index.ts:33`에 따라 dev는 원격 DB를 무시하고 PGlite(메모리)를 쓴다. 그런데 Blob은 진짜 저장소다 — **dev 업로드는 구조적으로 전부 고아**다. 경로에 `dev/` 접두사를 붙이고 청소가 걷어가게 한다.

---

## 2. 스키마

**플라이어 = `posts`의 칸** (`lib/db/schema.ts` posts 76-117, `capacity` 뒤)

```ts
/** 모임 포스터 한 장 (쿠폰·안내문). Vercel Blob 공개 URL — 사진 자체를 여기 담지 않는다 */
flyerUrl: text('flyer_url'),
```

카드 목록이 이걸 그린다. `listPosts`는 이미 post 행을 통째로 읽고(`lib/db/posts.ts:140`), neon-http는 질의 하나에 왕복 하나다(`:190` 주석). 칸이면 **왕복이 안 늘고**, 별도 표면 가장 뜨거운 읽기 경로에 배처가 하나 더 붙는다. 값은 모임당 하나뿐이고 제목·장소와 같은 폼에서 편집된다.

**단체사진 = 새 표** (`post_ratings` 뒤)

```ts
export const postPhotos = pgTable('post_photos', {
  id: uuid('id').primaryKey(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),   // 올린 사람
  url: text('url').notNull(),
  pathname: text('pathname').notNull(),   // 지울 때 URL을 다시 파싱하지 않으려고
  width: integer('width'), height: integer('height'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('post_photos_post_idx').on(t.postId, t.createdAt)]);
```

`lib/db/bootstrap.ts`에도 같은 DDL을 손으로 넣는다(파일 머리말이 요구). 그다음 `npm run db:push`.

---

## 3. 클라이언트 준비 — `lib/photo-client.ts`

아바타의 `shrink()`(`app/profile/profile-client.tsx:206`)를 일반화하되 셋을 바꾼다:

- **정사각 크롭 안 함.** 아바타는 가운데를 잘라 정사각으로 만든다. 플라이어는 포스터고 단체사진은 단체다 — 긴 변만 1600으로 맞추고 비율을 지킨다
- **`createImageBitmap(file, { imageOrientation: 'from-image' })`.** EXIF 회전을 확실히 적용하고, 1200만 화소를 메인 스레드 밖에서 푼다. 없으면 기존 `<img>` 경로로 떨어진다
- **data URL이 아니라 Blob 반환.** `upload()`가 Blob을 그대로 받고, base64의 33% 부풀림이 없다

결과는 장당 200~500KB. **순차 업로드**로 올린다 — 열 장을 병렬로 올리면 폰 데이터에서 서로 막혀 진행률이 거짓말이 되고, 실패 하나가 묶음 전체를 끌고 내려간다.

**HEIC**: 아이폰 기본 포맷이다. `accept="image/*"`면 iOS Safari가 대개 JPEG로 바꿔 내보내지만, 파일 앱에서 고르거나 안드로이드·데스크톱이면 `createImageBitmap`이 그냥 던진다. **전용 문구**로 안내한다(「아이폰 설정 › 카메라 › 포맷을 높은 호환성으로」). `heic2any` 같은 wasm 1.5MB를 열두 명짜리 앱의 모든 페이지에 얹지 않는다.

---

## 4. 만들 때는 postId가 없다

플라이어는 모임을 만드는 화면에서 고르는데 그때는 postId가 없다. 그래서:

- 업로드 경로는 `flyers/<올린 사람 id>/<uuid>.jpg`, 업로드 시점 권한은 「로그인·정지 아님」뿐 — 회원이면 누구나 모임을 만들 수 있으니 그게 딱 필요한 권한이다
- **진짜 검사는 URL을 저장할 때** 한다: `POST /api/posts`와 `PATCH /api/posts/[id]`가 `flyerUrl`을 받을 때 우리 저장소의 `flyers/` 아래인지 확인하고, PATCH는 기존 호스트 검사(`app/api/posts/[id]/route.ts:45`)를 그대로 탄다

이러면 만들기와 수정이 한 경로가 되고 저장 버튼도 하나다. 대가는 취소된 폼에 남는 고아 한 장 — 청소가 걷어간다.

---

## 5. 지우기 — CASCADE는 Blob을 모른다

| 언제 | 무엇 |
|---|---|
| 사진 한 장 | 행 먼저 지우고 `del(url)`은 try/catch. **순서가 중요** — 반대로 하면 404를 가리키는 행이 영원히 깨진 이미지로 남는다 |
| 플라이어 교체·제거 | `updatePost` 성공 **후** 옛 URL `del`. 실패했는데 화면에 있는 사진을 지우면 안 된다 |
| 모임 삭제 | 배치 전에 URL을 모아 두고 성공 후 `del(배열)` |
| 청소 | `app/api/admin/blob-sweep/route.ts` — `list()`에서 DB에 있는 URL을 빼고, **24시간 지난 것만** 지운다. 나이 제한이 없으면 ③~④ 사이의 업로드를 잡아먹는다 |

지울 수 있는 사람: **올린 사람 · 그 모임 호스트 · 관리자**.

---

## 6. 읽기 경로

`shellOf()`(`lib/db/posts.ts:323`)는 「로그인 여부와 무관하게 같은 부분」이다. 플라이어는 회원 전용이므로 **거기 넣지 않는다.** `settle`·`rating`과 같은 방식으로 두 반환 지점에 각각 넣는다:

- 비로그인 분기(`:222`) → `flyerUrl: null, photoCount: 0`
- 로그인 분기(`:302`) → 실제 값

확인한 것: `getPostView(id)`를 뷰어 없이 부르는 곳은 **OG 이미지 하나뿐**(`app/p/[id]/opengraph-image.tsx:28`)이다. 즉 플라이어는 카톡 링크 미리보기에 절대 안 실린다. 나중에 「플라이어를 OG 이미지로 쓰자」는 얘기가 나오면, 그건 링크를 가진 누구에게나 — 비공개 모임까지 — 공개하는 결정이다.

`lib/db/photos.ts`는 `lib/db/ratings.ts`와 같은 꼴로 둔다:
- `photoCounts(postIds)` — `buildViews`의 기존 `Promise.all`(`:255`)에 끼워 **왕복 없이**. 평점처럼 끝난 모임만 센다
- `listPhotos(postId)` — 모임 상세에서만. 올린 사람 이름은 `post.participants`에서 찾되 `?? '알 수 없음'` 폴백이 필요하다(명단은 나중에 고칠 수 있어서 올린 사람이 참가자가 아니게 될 수 있다)

---

## 7. 화면

| 어디 | 무엇 |
|---|---|
| 만들기 시트 | 제목 섹션 바로 뒤 `form-section` — 포스터는 「이게 뭔지」에 답하므로 인원수 뒤가 아니라 제목 옆이다. 미리보기는 기존 `.title-meta-box`(`category-client.tsx:883`) 모양 |
| 모임 카드 | 무비나잇 포스터와 같은 자리. 둘 다 있으면 **TMDB 포스터 우선**(영화의 정체성이고 카드는 훑어보는 것) — 취향 문제라 뒤집어도 됨 |
| 모임 상세 | 카드 안 제목 블록 아래 |
| 사진 패널 | `app/photo-panel.tsx` — `RatingPanel`(`post-client.tsx:357`)과 `SettlementPanel` 사이. `<h2 id="photos">` + 3열 격자. 카드에서 `/p/<id>#photos`로 연결 |
| 확대 | **`usePosterZoom`을 늘린다.** 파일 머리말(`poster-zoom.tsx:6`)이 「같은 것이 둘이면 어느 쪽이 맞는지 알 수 없다」고 적어 둔 그 얘기다. 스무 장짜리 갤러리에서 한 장씩 닫았다 여는 건 실제로 불평이 나오는 지점 |

`trigger(src, name, children)` 시그니처는 그대로 두고 `triggerAt(items, index, children)`을 더한다 — 기존 호출부 둘은 손대지 않는다.

---

## 8. 순서

| # | 무엇 | 끝나고 확인할 것 |
|---|---|---|
| 0 | Blob 스토어 만들기, `npm i @vercel/blob`, `.env.local`에 토큰 | — |
| 1 | 스키마 + bootstrap DDL | `db:push`, 그리고 dev를 띄워 PGlite가 DDL을 통과하는지 |
| 2 | `lib/photos.ts`(상한·URL 판별) + `lib/photo-client.ts`(축소) | DB를 import하지 않는지 |
| 3 | 토큰 라우트 | 비참가자 403 / 예정 모임 403 / 참가자+끝난 모임 200 |
| 4 | 읽기 층 (`lib/db/photos.ts` + `PostView` 배선) | 로그인·비로그인 SSR HTML 대조 |
| 5 | 플라이어 쓰기 경로 | **플라이어만 고쳤을 때 알림이 안 나가는지** ← 여기가 깨지기 쉬움 |
| 6 | 사진 업로드·삭제 라우트 | 권한 403 셋 + 장수 상한 |
| 7 | 상세 페이지 배선 | `/p/<id>` 소스에 URL이 있고 비로그인엔 없음 |
| 8 | UI 전부 | 아이폰에서 실제 업로드 |
| 9 | 확대 다음/이전 | 기존 호출부 둘이 그대로 동작 |
| 10 | 삭제 + 청소 | 모임 지우면 저장소에서도 사라짐, 청소 두 번 돌리면 두 번째는 0건 |

1~4는 화면에 안 보이는 채로 따로 배포해도 된다. 5와 6은 서로 독립이다.

---

## 검증

- **SSR 통합 테스트에 항목 추가** — 이미 있는 스크립트에 `flyerUrl`/`photoCount`/`photos`가 로그인엔 있고 비로그인엔 없음을 넣는다. 기존 20개와 같이 돌린다
- **알림 오발송** — 플라이어만 바꾸는 PATCH 후 `notifications` 행이 안 늘어나는지 (아래 위험 1)
- **권한** — 비참가자·예정 모임·남의 사진 삭제 각각 403
- **고아** — 청소를 두 번 돌려 두 번째가 0건인지
- 프로덕션 빌드 + `npm run css:fix` (새 `:hover` 규칙이 있으면 필수)

---

## 위험

1. **`onlyCoHostChanged` (`app/api/posts/[id]/route.ts:139-149`).** 가장 그럴듯한 버그. 지금 등식 아홉 개를 이어 붙인 형태고, `flyerUrl`을 안 더하면 **플라이어만 바꿔도 참가자 전원에게 「모임 변경」이 인앱·푸시로 나간다.** 직접 확인함
2. **고아 세 종류** — dev 업로드(구조적), ③~④ 사이에 닫은 탭, 취소된 폼의 플라이어. CASCADE는 행만 지운다
3. **HEIC** — 지금은 업로드가 없어서 조용한 문제. 전용 문구가 필요하다
4. **4.5MB 벽** — 클라이언트 업로드로 피해 가는데, 그래서 코드에 안 보인다. 나중에 누가 「간단히」 multipart로 바꿨다가 큰 사진에서만 터진다. 토큰 라우트에 이유를 주석으로 남길 것
5. **비공개 모임 사진은 URL만 알면 열린다.** Blob 클라이언트 업로드는 `access: 'public'`뿐이다. 완화책은 무작위 접미사와 비로그인에게 URL을 안 내보내는 것. 우리 라우트로 중계하면 접근 제어가 되지만 모든 이미지 바이트가 다시 서버리스를 지난다. **감수하는 선택이지 놓친 게 아니다 — 적어 둘 것**
6. **비용** — 12명 × 연 50모임 × 20장 × 400KB ≈ 연 5GB. 이 규모에선 괜찮지만 상한이 없으면 그게 실패 모드다. `MAX_PHOTOS_PER_POST`와 클라이언트 축소가 유일한 비용 통제다 (Blob 대시보드에는 지출 상한이 없다)
7. **`showPastPrivate`** — 지난 비공개 모임 사진 수는 그 설정을 켠 사람에게만 보인다. 새 누수는 아니지만 버그로 신고될 것

## 손대는 파일

- `lib/db/schema.ts` (posts 76-117, 새 표) + `lib/db/bootstrap.ts` — **반드시 같이**
- `lib/db/posts.ts` — `PostView`(21), 두 반환 지점(222·302), `Promise.all`(255), `createPost`(680·741), `updatePost`(899·944), `deletePost`(1006)
- `app/api/posts/[id]/route.ts` — 특히 **139-149**
- `app/c/[category]/category-client.tsx` — 로컬 `PostView`(199), 폼 상태(299·319·486), 본문(443·512), 시트(819~), 카드(1106~), 액션(1252~)
- `app/p/[id]/post-client.tsx` + `app/p/[id]/page.tsx` — `PostInitial`(108), 패널 자리(365~367)
- 새 파일: `lib/photos.ts`, `lib/photo-client.ts`, `lib/db/photos.ts`, `app/photo-panel.tsx`, `app/api/blob/upload/route.ts`, `app/api/posts/[id]/photos/route.ts`(+`[photoId]`), `app/api/admin/blob-sweep/route.ts`
