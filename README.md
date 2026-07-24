# 🎯 Odyssey Crew

친구들끼리 **취미 모임**을 만들고 같이 놀 사람을 모으는 앱.

- **영화 🎬** — The Odyssey (AMC Town Center 20) 회차 맞추기: 가능한 회차를 선택하면 같은 회차끼리 자동 그룹 매칭
- **피클볼 🥒 · 볼링 🎳 · 축구 ⚽** — 날짜/시간/장소를 정해 모임 포스트를 올리고, 다른 사람이 참가 등록
- **구독·알림 🔔** — 취미를 구독하면 새 모임이 올라올 때 인앱 알림 수신

## 페이지

| 경로 | 설명 |
|------|------|
| `/` | 홈 — 취미 카테고리 선택, 구독 토글, 카카오 로그인/닉네임 설정 |
| `/c/pickleball` 등 | 취미별 모임 피드 — 모임 만들기, 참가/취소, 삭제(작성자·관리자) |
| `/notifications` | 인앱 알림 목록 (진입 시 자동 읽음 처리) |
| `/movie` | 카카오 로그인 후 가능한 영화 회차 선택·저장 |
| `/movie/groups` | 영화 그룹 매칭 결과 — 2명 이상 겹친 회차가 위에 표시 |
| `/admin` | 영화 스케줄 편집 (회차 추가/삭제, AMC API 새로고침). `ADMIN_KEY` 필요 |

## 저장소 구조

- **Postgres (Neon + Drizzle)** — 사용자 프로필(닉네임), 모임 포스트, 참가, 구독, 알림
- **Upstash Redis** — 영화 스케줄·회차 선택 (기존 기능 전용)

## 배포하기 (Vercel + Upstash)

1. **GitHub에 푸시**
   ```bash
   cd odyssey-crew
   git init && git add -A && git commit -m "init"
   # GitHub에 새 repo 만든 뒤:
   git remote add origin https://github.com/<유저명>/odyssey-crew.git
   git push -u origin main
   ```

2. **Vercel에서 Import**
   - [vercel.com/new](https://vercel.com/new) → 방금 만든 repo 선택 → Deploy
   - 프레임워크는 Next.js로 자동 인식됩니다.

3. **Upstash Redis 연결** (영화 기능용)
   - Vercel 프로젝트 → **Storage** 탭 → **Create Database** → **Upstash Redis** (무료 플랜 충분)
   - `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` 또는 `KV_REST_API_URL`/`KV_REST_API_TOKEN` 어느 이름으로 주입돼도 인식합니다.

3-1. **Neon Postgres 연결** (모임/구독/알림/프로필용)
   - Vercel 프로젝트 → **Storage** 탭 → **Create Database** → **Neon Postgres** (무료 플랜 충분)
   - 연결하면 `DATABASE_URL`(또는 `POSTGRES_URL`) 환경변수가 자동 주입됩니다.
   - 로컬에서 테이블 생성: `.env.local`에 `DATABASE_URL`을 넣고 (`vercel env pull`로 받아도 됨)
     ```bash
     npm run db:push   # lib/db/schema.ts 기준으로 Neon에 테이블 생성 (스키마 변경 때마다 재실행)
     ```

4. **환경변수 설정** (Vercel → Settings → Environment Variables)
   - `ADMIN_KEY` — 관리자 페이지(영화 스케줄 편집)용 비밀 키 (아무 문자열)
   - `ADMIN_KAKAO_ID` — 관리자로 인정할 카카오 회원번호 (쉼표로 여러 명 가능). 로그인 후 `/api/auth/me`의 `user.id`로 확인
   - `KAKAO_REST_API_KEY` — 카카오 로그인용 REST API 키 (아래 "카카오 로그인 설정" 참고)
   - (선택) `KAKAO_CLIENT_SECRET` — 카카오 앱에서 Client Secret을 활성화한 경우
   - `AUTH_SECRET` — 세션 쿠키 서명용 비밀 키 (`openssl rand -base64 32` 등으로 생성)
   - (선택) `AMC_VENDOR_KEY`, `AMC_THEATRE_ID` — 아래 "AMC API 연동" 참고

5. **Redeploy** 후 나온 URL을 친구들한테 공유하면 끝!

## 카카오 로그인 설정

이름 입력 대신 **카카오 로그인만** 지원합니다. 선택 데이터는 카카오 회원번호 기준으로 저장되고, 표시 이름은 카카오 닉네임을 사용합니다.

1. [developers.kakao.com](https://developers.kakao.com) → **내 애플리케이션** → 앱 추가
2. **앱 설정 → 플랫폼 → Web** 에 사이트 도메인 등록 (`http://localhost:3000`, 배포 URL)
3. **제품 설정 → 카카오 로그인** 활성화 후 Redirect URI 등록:
   - `http://localhost:3000/api/auth/callback` (로컬)
   - `https://<배포 도메인>/api/auth/callback` (프로덕션)
4. **제품 설정 → 카카오 로그인 → 동의항목** 에서 **닉네임(profile_nickname)** 을 필수 동의로 설정
5. **앱 설정 → 앱 키** 의 **REST API 키**를 `KAKAO_REST_API_KEY` 환경변수에 입력
6. (권장) **제품 설정 → 카카오 로그인 → 보안** 에서 Client Secret 활성화 후 `KAKAO_CLIENT_SECRET`에 입력

## 로컬 개발

```bash
npm install
npm run dev   # http://localhost:3000
```

환경변수가 없으면 폴백으로 동작합니다 (재시작 시 초기화, 개발용):
- Redis 미설정 → 영화 데이터는 메모리 저장소
- `DATABASE_URL` 미설정 → 모임/알림/프로필은 PGlite(인메모리 Postgres)

## 스케줄 데이터

- 시드 데이터는 **2026-07-22에 AMC 공식 사이트에서 직접 수집한 실제 스케줄** (7/22~7/25 확정, 7/26은 토요일 패턴 기반 추정)입니다.
- IMAX with Laser관은 매일 `10:00am / 2:00pm / 6:00pm / 10:00pm` 고정 패턴이에요.
- 이후 주차 스케줄은 `/admin`에서 추가하거나, AMC API로 새로고침하세요.

## AMC 공식 API 연동 (선택)

1. [developers.amctheatres.com](https://developers.amctheatres.com)에서 Vendor Key를 신청합니다 (승인 필요, 문의: developers@amctheatres.com).
2. 키를 받으면:
   - `AMC_VENDOR_KEY` 환경변수에 키 입력
   - 극장 ID 조회: `GET https://api.amctheatres.com/v2/theatres?name=town-center` (헤더 `X-AMC-Vendor-Key` 포함) → AMC Town Center 20의 `id`를 `AMC_THEATRE_ID`에 입력
3. `/admin`에서 관리자 키 입력 후 **"AMC에서 새로고침"** 버튼을 누르면 향후 7일치 The Odyssey 회차를 실시간으로 가져와 저장합니다.
4. 응답 필드가 문서와 다르면 `lib/amc.ts`의 `mapAmcShowtime()`만 수정하면 됩니다.

### 샌드박스 키로 먼저 테스트하기

프로덕션 키 승인 전에 샌드박스 키로 연동 코드를 검증할 수 있습니다:

```
AMC_API_BASE=https://api.sandbox-amctheatres.com/v2
AMC_VENDOR_KEY=<샌드박스 키>
AMC_THEATRE_ID=<샌드박스 극장 ID>   # GET /v2/theatres 로 조회 (테스트 극장 5곳)
AMC_MOVIE_MATCH=.*                  # 샌드박스에 The Odyssey가 없으면 전체 영화로 테스트
```

샌드박스는 시뮬레이션 데이터라서 실제 Town Center 20 스케줄은 나오지 않습니다.
연동이 확인되면 위 변수를 지우고(또는 프로덕션 값으로 바꾸고) 재배포하세요.

## 주의사항

- 그룹 매칭 기준은 "같은 상영 회차(같은 날짜+시간+포맷)"입니다.
- 계정 구분은 카카오 회원번호 기준이라 닉네임이 같아도 다른 사람으로 취급됩니다.
- 카카오 로그인 도입 이전에 이름으로 저장된 선택 데이터는 더 이상 표시되지 않습니다 (각자 로그인해서 다시 선택해야 해요).
- 선택 삭제는 본인 것만 가능합니다 ("그룹 보기" 페이지의 참여자 목록에서).
