# 🎬 Odyssey Crew

친구들끼리 **The Odyssey** (AMC Town Center 20, Leawood KS) 볼 시간을 맞추는 앱.

각자 가능한 상영 회차를 선택하면, **같은 요일·같은 회차**를 고른 사람들끼리 자동으로 그룹이 만들어집니다.

## 페이지

| 경로 | 설명 |
|------|------|
| `/` | 카카오 로그인 후 가능한 회차 선택·저장. 각 회차에 몇 명이 선택했는지(👥) 표시 |
| `/groups` | 그룹 매칭 결과 — 2명 이상 겹친 회차가 위에, 혼자인 회차는 아래에 표시 |
| `/admin` | 스케줄 편집 (회차 추가/삭제, AMC API 새로고침). `ADMIN_KEY` 필요 |

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

3. **Upstash Redis 연결**
   - Vercel 프로젝트 → **Storage** 탭 → **Create Database** → **Upstash Redis** (무료 플랜 충분)
   - 연결하면 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 환경변수가 자동 주입됩니다.
     - 만약 `KV_REST_API_URL` 형태로 주입되면 Vercel의 환경변수 화면에서 위 두 이름으로 별칭을 추가하세요.

4. **환경변수 설정** (Vercel → Settings → Environment Variables)
   - `ADMIN_KEY` — 관리자 페이지용 비밀 키 (아무 문자열)
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

Redis 환경변수가 없으면 메모리 저장소로 동작합니다 (재시작 시 초기화, 개발용).

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
