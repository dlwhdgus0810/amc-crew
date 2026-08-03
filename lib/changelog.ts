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
  /**
   * 시간과 무관하게 목록 맨 위에 두고, 홈 카드에도 계속 이 항목을 띄운다.
   * 뒤에 소식이 더 쌓여도 묻히면 안 되는 큰 기능에만 쓴다 — 하나만 붙일 것.
   */
  pin?: boolean;
}

/** 적을 때는 최신이 맨 위 (화면 순서는 아래 CHANGELOG가 정한다) */
const ENTRIES: ChangelogEntry[] = [
  {
    at: '2026-08-03T15:40',
    notable: true,
    title: { ko: '호스트 순위가 사람 수로 바뀌었어요', en: 'Host ranking now counts people' },
    items: [
      {
        ko: '몇 번 열었는지가 아니라 몇 명이 모였는지로 세요. 두 명 모인 모임 열 번보다 열 명 모인 모임 두 번이 더 큰 일이니까요.',
        en: 'It counts how many people turned up, not how many meetups you opened.',
      },
      {
        ko: '모임을 만들 때 친구 한 명을 「같이 여는 사람」으로 고를 수 있어요. 그 모임 점수는 둘이 반씩 나눠 가져요 — 10명이면 각각 5점이에요.',
        en: 'Pick one friend as a co-host and you split that meetup’s points — ten people means five each.',
      },
      {
        ko: '같이 연 사람도 그 모임을 고칠 수 있어요. 같이 열 사람을 바꾸는 건 만든 사람만 할 수 있어요.',
        en: 'A co-host can edit the meetup. Only the person who made it can change who the co-host is.',
      },
      {
        ko: '등급은 5 · 15 · 30 · 60점부터예요. 세는 방법이 바뀌어서 지금 점수는 예전과 달라요.',
        en: 'Tiers start at 5 · 15 · 30 · 60 points. Your number will look different — it’s counted a new way.',
      },
      {
        ko: '지난 모임에도 같이 연 사람을 뒤늦게 넣을 수 있어요. 지난 모임 카드의 「수정」을 누르세요.',
        en: 'You can add a co-host to a meetup that already happened — tap Edit on its card.',
      },
    ],
  },
  {
    at: '2026-08-03T15:35',
    title: { ko: '지난 모임은 지울 수 없어요', en: 'Past meetups can’t be deleted' },
    items: [
      {
        ko: '이미 끝난 모임은 아무도 지울 수 없어요. 만든 사람도, 관리자도요.',
        en: 'Once a meetup has happened, nobody can delete it — not even the person who made it.',
      },
      {
        ko: '지난 모임은 기록이에요. 누가 언제 뭘 했는지, 호스트 점수가 어디서 왔는지가 거기 남아 있어요.',
        en: 'They’re the record — of who did what, and where the host points came from.',
      },
    ],
  },
  {
    at: '2026-08-03T15:30',
    title: { ko: '닉네임으로 노는 모임', en: 'Nickname meetups' },
    items: [
      {
        ko: '모임을 만들 때 「닉네임 허용」을 켜면, 그 모임에서만 닉네임을 정해둔 사람이 닉네임으로 보여요.',
        en: 'Tick “Allow nicknames” when you make a meetup and, just there, people show up under the nickname they set.',
      },
      {
        ko: '기본은 실명이에요. 켠 모임에서만 달라지고, 닉네임을 안 정한 사람은 그대로예요.',
        en: 'Real names by default — only that meetup changes, and only for people who set one.',
      },
    ],
  },
  {
    at: '2026-08-02T16:41',
    notable: true,
    title: { ko: '모임에 없는 친구도 정산에', en: 'Settle up with friends who weren’t in the meetup' },
    items: [
      {
        ko: '같이 냈는데 모임에 이름이 없는 친구를 정산에 넣을 수 있어요. 정산 고치기에서 「＋ 친구 넣기」를 누르세요.',
        en: 'Add a friend who chipped in but isn’t in the meetup — tap “+ Add a friend” while editing the split.',
      },
      {
        ko: '넣은 친구도 1인당 계산에 들어가고, 얼마 보내면 되는지 알림을 받아요. 모임 참가자로 들어가지는 않아요.',
        en: 'They count toward each person’s share and get their own alert — without joining the meetup.',
      },
    ],
  },
  {
    at: '2026-08-02T16:20',
    title: { ko: '리더보드에 참가 순위도', en: 'A joined ranking on the leaderboard' },
    items: [
      {
        ko: '리더보드에서 「참여 순위」를 눌러 모임에 많이 참가한 순위를 볼 수 있어요.',
        en: 'Tap “Joined” on the leaderboard to see who turns up the most.',
      },
    ],
  },
  {
    at: '2026-08-02T16:15',
    title: { ko: '링크를 보내면 카드가 떠요', en: 'Links now show a card' },
    items: [
      {
        ko: '모임 링크를 카톡에 붙이면 그 카테고리 색으로 된 카드가 떠요. 날짜·장소·참가 인원까지 그림에 들어가 있어요.',
        en: 'Paste a meetup link in a chat and it shows a card in that category’s colour, with the date, place and headcount on it.',
      },
      {
        ko: '카테고리 링크도 마찬가지예요. 무슨 모임인지 링크만 봐도 알 수 있어요.',
        en: 'Category links too — you can tell what it is without opening it.',
      },
    ],
  },
  {
    at: '2026-08-02T15:49',
    notable: true,
    title: { ko: '친구가 가는 모임 보기', en: 'See where your friends are going' },
    items: [
      {
        ko: '친구 화면에서 이름을 누르면 그 친구의 예정된 모임과 지난 모임을 볼 수 있어요. 같이 갔던 모임에는 「같이 감」이 붙어요.',
        en: 'Tap a name in Friends to see their upcoming and past meetups — the ones you both went to are marked “Together”.',
      },
      {
        ko: '친구마다 내 모임을 어디까지 보여줄지 정할 수 있어요. 전부 · 예정만 · 숨김 중에 고르면 돼요.',
        en: 'For each friend you choose how much of yours they see: all, upcoming only, or hidden.',
      },
      {
        ko: '비공개 모임은 어느 경우에도 친구에게 보이지 않아요.',
        en: 'Private meetups never appear there, whichever setting you pick.',
      },
      {
        ko: '접속 상태 설정도 같은 화면으로 옮겼어요. 둘 다 내 쪽만 바뀌고, 상대에게는 알리지 않아요.',
        en: 'The online-visibility setting moved to that screen too. Both are one-way, and nobody is told.',
      },
    ],
  },
  {
    at: '2026-08-01T18:37',
    title: { ko: '생일파티 카테고리', en: 'A Birthday Party category' },
    items: [
      {
        ko: '생일파티 🎂 카테고리가 생겼어요. 박진욱 님이 제안해주셨어요.',
        en: 'A Birthday Party 🎂 category — 박진욱’s idea.',
      },
      {
        ko: '모임을 만들 때 누구 생일인지 적어두면 카드에 같이 보여요.',
        en: 'Note whose birthday it is when you create one, and it shows on the card.',
      },
    ],
  },
  {
    at: '2026-08-01T16:50',
    title: { ko: '접속 중인 걸 누구에게 보여줄지 고를 수 있어요', en: 'Choose who sees you online' },
    items: [
      {
        ko: '친구 화면의 내 친구 목록에서 사람마다 「내 접속 보임」을 눌러 끌 수 있어요. 지금까지처럼 모두에게 보이는 게 기본이에요.',
        en: 'In your friends list, tap “They see you” on anyone to turn it off. It stays on by default, as before.',
      },
      {
        ko: '감춘 친구에게는 그냥 접속 중이 아닌 것으로 보여요. 감췄다는 건 알려지지 않아요.',
        en: 'To them you simply look offline — they’re never told you hid it.',
      },
      {
        ko: '한쪽 방향만 바뀌어요. 내가 감춰도 그 친구가 접속 중인 건 그대로 보여요.',
        en: 'It only works one way — you still see them when they’re online.',
      },
    ],
  },
  {
    at: '2026-08-01T02:31',
    title: { ko: '종료 시간은 안 적어도 돼요', en: 'The end time is optional now' },
    items: [
      {
        ko: '모임을 만들 때 종료 시간을 비워둘 수 있어요. 언제 끝날지 모르는 모임도 그냥 올리세요.',
        en: 'You can leave the end time blank — post it even when you don’t know how long it’ll run.',
      },
      {
        ko: '비워두면 카드에 시작 시간만 보이고, 시작 3시간 뒤에 지난 모임으로 넘어가요.',
        en: 'The card then shows just the start time, and it moves to Past three hours after it starts.',
      },
    ],
  },
  {
    at: '2026-08-01T01:49',
    notable: true,
    title: { ko: '러닝 크루와 게임', en: 'Running Crew and Game' },
    items: [
      {
        ko: '러닝 크루 🏃 카테고리가 생겼어요. 지유 님이 제안해주셨어요.',
        en: 'A Running Crew 🏃 category — 지유’s idea.',
      },
      {
        ko: '게임 🎮 카테고리가 생겼어요. 라민 야말 님이 제안해주셨어요.',
        en: 'A Game 🎮 category — 라민 야말’s idea.',
      },
      {
        ko: '게임 모임을 만들 때 리그 오브 레전드·오버워치를 눌러서 고를 수 있어요. 다른 게임은 그 아래 칸에 직접 적으면 돼요.',
        en: 'Making a game meetup, tap League of Legends or Overwatch — or type any other game in the box below.',
      },
    ],
  },
  {
    at: '2026-07-31T19:59',
    notable: true,
    title: { ko: '친구가 생겼어요', en: 'Friends' },
    items: [
      {
        ko: '같은 모임에서 만난 사람에게 친구 요청을 보낼 수 있어요. 모임 카드의 참가자 수를 눌러 이름을 펼치고, 그 이름을 한 번 더 누르면 돼요.',
        en: 'You can add anyone you’ve shared a meetup with — tap the headcount on a meetup card to open the names, then tap a name.',
      },
      {
        ko: '친구가 어떤 모임에 들어가면 알림 탭에 알려드려요. 카톡이나 폰 알림으로는 울리지 않아요.',
        en: 'When a friend joins a meetup it shows up in your alerts tab — it won’t buzz your phone or KakaoTalk.',
      },
      {
        ko: '같이 가기로 한 친구를 대신 넣어줄 수 있어요. 참가자 명단의 ＋친구를 누르세요.',
        en: 'You can put a friend into a meetup yourself — tap ＋친구 in the participant list.',
      },
      {
        ko: '지금 앱을 보고 있는 친구가 누구인지 볼 수 있어요. 친구끼리만 보여요.',
        en: 'See which of your friends are in the app right now — friends only.',
      },
      {
        ko: '비공개 모임을 만들 때 어떤 친구에게 알릴지 고를 수 있어요. 고른 친구에게만 링크가 담긴 알림이 가요.',
        en: 'When you make a private meetup you pick which friends hear about it — only they get the link.',
      },
      {
        ko: '친구는 알림 탭 맨 위의 "친구"에서 볼 수 있어요.',
        en: 'Everything friend-related lives under “Friends” at the top of the alerts tab.',
      },
    ],
  },
  {
    at: '2026-07-30T21:41',
    notable: true,
    title: { ko: '정산 알림과 비공개 범위', en: 'Settle-up alerts, and what guests can see' },
    items: [
      {
        ko: '정산 알림을 누르면 바로 정산 카드로 가요. 모임을 찾아 들어갈 필요 없이 보낼 금액이 먼저 보여요.',
        en: 'Tapping a settle-up alert now lands on the settlement card, so what you owe is the first thing you see.',
      },
      {
        ko: '알림에는 Venmo 아이디만 적어요. 링크는 모임 화면에 금액까지 채워져 있으니 거기서 누르면 돼요.',
        en: 'The alert just names the Venmo handle — the link with the amount filled in lives on the meetup screen.',
      },
      {
        ko: '정산 항목을 여러 개 적어도 알림을 보내기 전에 1인당 얼마인지 미리 보여줘요.',
        en: 'However many items you add, you see each person’s share before any alert goes out.',
      },
      {
        ko: '로그인하지 않은 사람에게는 모임의 시간·장소·인원수만 보여요. 참가자 명단과 누가 열었는지는 회원끼리만 봐요.',
        en: 'Signed-out visitors see only a meetup’s time, place and headcount — the guest list and host stay between members.',
      },
    ],
  },
  {
    at: '2026-07-30T15:52',
    title: { ko: '정산이 조금 더 똑똑해졌어요', en: 'Settle-ups got a bit smarter' },
    items: [
      {
        ko: '앱에 없는 사람도 인원수로 더할 수 있어요. 친구 두 명이 더 있었다면 2를 넣으면 그만큼 나눠서 계산돼요.',
        en: 'You can add people who aren’t in the app — put 2 if two extra friends chipped in, and the split accounts for them.',
      },
      {
        ko: '알림에 받는 사람의 Venmo·Zelle 아이디가 같이 와요.',
        en: 'The alert names the payee’s Venmo and Zelle handles.',
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

/** 화면에 뿌리는 순서 — 고정한 항목이 먼저, 나머지는 최신순 */
export const CHANGELOG: ChangelogEntry[] = [...ENTRIES].sort(
  (a, b) => Number(Boolean(b.pin)) - Number(Boolean(a.pin)) || b.at.localeCompare(a.at)
);

/** 홈 카드에 띄울 소식 — 고정한 게 있으면 그것부터 (없으면 가장 최근 notable) */
export function latestNotable(): ChangelogEntry | null {
  return CHANGELOG.find((e) => e.notable) ?? null;
}

/** 시간상 가장 최근 소식 — 고정과 무관하다 (카톡 발송처럼 "이번에 새로 올라온 것"이 필요한 곳) */
export function newestEntry(): ChangelogEntry | null {
  return [...ENTRIES].sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}

/**
 * 소식 전체에서 가장 최근 시각.
 *
 * 홈 카드를 "새 것이 있을 때만" 띄우는 기준은 이쪽이다. 카드에 보이는 항목(고정된 것)의
 * 시각으로 재면, 그 뒤에 새 소식이 아무리 쌓여도 이미 닫은 사람에게는 다시 뜨지 않는다.
 */
export function latestAt(): string | null {
  return newestEntry()?.at ?? null;
}
