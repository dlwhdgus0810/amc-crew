import {Msg} from './i18n';

/**
 * 업데이트 소식.
 *
 * DB를 쓰지 않는다 — 배포할 때마다 이 파일에 항목을 얹으면 그게 곧 발행이다.
 *
 * 쓸 때 지킬 것
 *  - 커밋 메시지를 옮기지 말 것. "참여자 줄에 얼굴이 보여요"가
 *    "feat(feed): faces instead of names"보다 백 배 낫다.
 *  - notable은 아껴 쓸 것. 이게 붙은 항목만 홈에 카드가 뜬다. 사소한 수정까지
 *    알리면 사람들이 카드를 닫는 법부터 배운다.
 */
export interface ChangelogEntry {
  /**
   * YYYY-MM-DDTHH:mm (앱 시간대). 목록 정렬, "읽음" 판정, 화면 표기를 다 이걸로 한다.
   * ISO 문자열이라 사전순 비교가 곧 시간순 비교다 — 하루에 여러 번 올려도 순서가 선다.
   */
  at: string;
  title: Msg;
  items: Msg[];
  /** 홈에 "새 소식" 카드를 띄울 만한 묶음인지 */
  notable?: boolean;
}

/** 최신이 맨 위 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    at: '2026-07-30T15:52',
    title: { ko: '정산이 조금 더 똑똑해졌어요', en: 'Settle-ups got a bit smarter' },
    items: [
      {
        ko: '앱에 없는 사람도 인원수로 더할 수 있어요. 친구 두 명이 더 있었다면 2를 넣으면 그만큼 나눠서 계산돼요.',
        en: 'You can add people who aren’t in the app — put 2 if two extra friends chipped in, and the split accounts for them.',
      },
      {
        ko: '알림에 보내기 링크가 같이 와요. 카톡에서 바로 눌러 Venmo를 열 수 있어요.',
        en: 'The alert now carries a pay link, so you can open Venmo straight from KakaoTalk.',
      },
      {
        ko: '금액 칸에는 나눈 값이 아니라 총 금액을 넣어주세요. 인원수대로 알아서 나눠요.',
        en: 'Put the total in the amount box, not each person’s share — it divides by the head count for you.',
      },
    ],
  },
  {
    at: '2026-07-30T14:47',
    notable: true,
    title: { ko: '모임 끝나고 정산하기', en: 'Settle up after a meetup' },
    items: [
      {
        ko: '돈을 낸 사람이 모임에서 정산을 만들면, 각자에게 얼마 보내면 되는지 알림이 가요.',
        en: 'Whoever paid can start a settle-up, and everyone gets an alert with their own share.',
      },
      {
        ko: '항목마다 전원이 나눌지, 고른 사람만 낼지 정할 수 있어요. 내기에서 진 사람들만 내는 것도 돼요.',
        en: 'Each line can be split by everyone or just the people you pick — handy when only the losers of a bet pay.',
      },
      {
        ko: '프로필 → 받을 계좌에 Venmo나 Zelle을 넣어두세요. 넣어두면 상대가 한 번에 보낼 수 있어요.',
        en: 'Add your Venmo or Zelle under Profile → How you get paid, so people can send it in one tap.',
      },
      {
        ko: '정산 내용은 그 모임에 참가한 사람만 볼 수 있어요.',
        en: 'Only people who joined that meetup can see the split.',
      },
    ],
  },
  {
    at: '2026-07-30T10:58',
    title: { ko: '앱 아이콘에 안 읽은 알림 수', en: 'Unread count on the app icon' },
    items: [
      {
        ko: '안 읽은 알림이 있으면 홈 화면 아이콘에 숫자가 붙어요. 알림 탭에서 읽으면 사라져요.',
        en: 'The home-screen icon shows how many alerts you haven’t read. It clears once you open the alerts tab.',
      },
      {
        ko: '앱 푸시 알림을 켠 분에게만 보여요. 홈 화면에 추가한 앱에서만 나타나거든요.',
        en: 'Only if you turned on app push notifications — the badge lives on the home-screen icon.',
      },
    ],
  },
  {
    at: '2026-07-30T10:47',
    title: { ko: '카테고리마다 이모지', en: 'An emoji for every category' },
    items: [
      {
        ko: '카테고리 이름 옆에 이모지가 붙었어요. 축구 ⚽ 테니스 🎾 무비나잇 🍿 처럼요.',
        en: 'Category names now carry an emoji — ⚽ Soccer, 🎾 Tennis, 🍿 Movie Night, and so on.',
      },
    ],
  },
  {
    at: '2026-07-30T10:20',
    notable: true,
    title: { ko: '앱으로 바로 오는 알림', en: 'Alerts straight from the app' },
    items: [
      {
        ko: '홈 화면에 추가한 앱으로 알림을 바로 받을 수 있어요. 프로필 → 앱 푸시 알림에서 켜세요. 카카오톡 알림과 함께 받아도 되고, 하나만 받아도 돼요.',
        en: 'Get alerts straight from the app on your home screen — turn it on in Profile → App push notifications. Keep KakaoTalk alerts too, or just one of them.',
      },
      {
        ko: '아이폰은 홈 화면에 추가해야 켤 수 있어요. 사파리 공유 버튼 → "홈 화면에 추가"를 먼저 해주세요.',
        en: 'On iPhone it only works once the app is on your home screen — Share → “Add to Home Screen” first.',
      },
      {
        ko: '상영표에서 포스터를 누르면 크게 볼 수 있어요.',
        en: 'Tap a poster in the showtimes list to see it full size.',
      },
    ],
  },
  {
    at: '2026-07-30T09:02',
    notable: true,
    title: { ko: '상영표에 포스터와 평점', en: 'Posters and ratings on the showtimes list' },
    items: [
      {
        ko: '상영표에 포스터가 뜨고, 평점·감독·주연 배우도 같이 보여요. 뭘 볼지 고르기 편해졌어요.',
        en: 'Showtimes now come with a poster, a rating, the director, and the top cast — easier to pick what to watch.',
      },
      {
        ko: '자정 넘은 심야 상영도 고를 수 있어요. 그날 밤 목록 맨 뒤에 붙어요.',
        en: 'After-midnight showtimes are pickable now — they sit at the end of that night’s list.',
      },
      {
        ko: '매진된 회차는 매진이라고 알려주고, 취소된 회차는 아예 안 보여요.',
        en: 'Sold-out showtimes say so, and canceled ones no longer appear at all.',
      },
    ],
  },
  {
    at: '2026-07-30T01:24',
    notable: true,
    title: { ko: '리더보드와 호스트 스티커', en: 'A leaderboard, and host stickers' },
    items: [
      {
        ko: '모임을 열면 프로필 사진에 스티커가 붙어요. 1회 🌱, 3회 ⭐, 5회 🔥, 10회 👑!',
        en: 'Hosting meetups earns a sticker on your photo — 🌱 at 1, ⭐ at 3, 🔥 at 5, 👑 at 10!',
      },
      {
        ko: '둘러보기의 🏆 리더보드에서 누가 모임을 많이 열었는지 볼 수 있어요.',
        en: 'The 🏆 Leaderboard in Browse shows who hosts the most.',
      },
    ],
  },
  {
    at: '2026-07-29T13:48',
    notable: true,
    title: { ko: '익명 댓글과 쪽지', en: 'Anonymous comments, and 쪽지' },
    items: [
      {
        ko: '댓글을 익명으로 남길 수 있어요. 입력칸 아래 "익명으로"를 체크하면 다른 사람에게 닉네임이 안 보여요.',
        en: 'You can comment anonymously — tick “Anonymously” under the box and others won’t see your nickname.',
      },
      {
        ko: '건의함의 쪽지가 생겼어요. 그냥 안부나 아무거나 적어도 돼요.',
        en: '“Kind words” in the suggestion box is now “Note” — a note about anything at all.',
      },
    ],
  },
  {
    at: '2026-07-29T11:30',
    notable: true,
    title: { ko: 'AMC가 무비나잇 안으로', en: 'AMC moved inside Movie Night' },
    items: [
      {
        ko: 'AMC 카드를 없애고 무비나잇 안에서 열도록 했어요. 어차피 회차를 골라 만든 모임도 무비나잇으로 들어왔거든요.',
        en: 'The AMC card is gone; you open the showtime picker from inside Movie Night. Meetups made from a showtime already landed there anyway.',
      },
      {
        ko: '새 소식 알림을 켜면 업데이트를 카카오톡으로 받아볼 수 있어요. 프로필에서 켜고 끌 수 있어요.',
        en: 'Turn on update alerts to get them on KakaoTalk. Toggle it in Profile.',
      },
    ],
  },
  {
    at: '2026-07-29T09:00',
    notable: true,
    title: { ko: '캘린더와 새 카테고리', en: 'A calendar, and two new categories' },
    items: [
      {
        ko: '캘린더 탭이 생겼어요. 모든 카테고리의 모임을 주·월 단위로 한눈에 봐요.',
        en: 'A Calendar tab — every category’s meetups by week or month.',
      },
      {
        ko: '헬스장과 테니스 카테고리를 추가했어요. (테니스는 sarah 예지 park 님 제안이에요)',
        en: 'Gym and Tennis categories. (Tennis was sarah 예지 park’s idea.)',
      },
      {
        ko: '모임 장소를 누르면 지도로 바로 넘어가요. 길찾기까지 한 번에요.',
        en: 'Tap a meetup’s place to open it in Maps and get directions.',
      },
      {
        ko: '링크를 아는 사람만 볼 수 있는 비공개 모임을 만들 수 있어요.',
        en: 'You can make a meetup that only people with the link can see.',
      },
      {
        ko: '모임 카드에서 참여자 프로필 사진이 바로 보여요. 눌러야 이름이 나와요.',
        en: 'Meetup cards show participants’ profile photo; tap for names.',
      },
      {
        ko: '프로필 사진을 설정할 수 있고, 즐겨찾기 순서도 프로필에서 바꿔요.',
        en: 'Set a profile photo, and reorder favourites from Profile.',
      },
      {
        ko: '건의함이 생겼어요. 사소한 개선부터 원하는 기능까지 남겨주세요.',
        en: 'A suggestion box — tell us anything, however small.',
      },
    ],
  },
];

/** 홈 카드를 띄울 기준이 되는 가장 최근 소식 (없으면 null) */
export function latestNotable(): ChangelogEntry | null {
  return CHANGELOG.find((e) => e.notable) ?? null;
}
