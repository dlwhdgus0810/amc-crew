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
    at: '2026-08-05T01:30',
    notable: true,
    title: { ko: '영화 보고 나서 우리끼리 평점을 매겨요', en: 'Rate the film once you’ve seen it' },
    items: [
      {
        ko: '무비나잇 모임이 끝나면 같이 본 사람끼리 10점 만점으로 점수를 매길 수 있어요. 0.1점 단위까지요.',
        en: 'Once a Movie Night is over, everyone who was there can score it out of 10 — down to a tenth of a point.',
      },
      {
        ko: '누가 몇 점 줬는지 서로 보여요. 평균도 같이 나와요.',
        en: 'You can see what everyone else gave, alongside the average.',
      },
      {
        ko: '지난 모임 카드에도 「우리 평점 8.8」이 한 줄로 붙어요. 목록을 내리면서 예전에 본 영화들 점수가 보여요.',
        en: 'Past meetup cards carry the score too, so scrolling the list shows what you thought of everything you’ve watched.',
      },
      {
        ko: '끝난 모임에만 열리고, 그 자리에 있던 사람만 매길 수 있어요. 나중에 고쳐 매기거나 무를 수 있어요.',
        en: 'It opens only after the meetup, only for people who were there, and you can change or clear your score later.',
      },
    ],
  },
  {
    at: '2026-08-05T01:20',
    title: { ko: '예전에 저장해 둔 카카오 토큰을 지웠어요', en: 'Old Kakao tokens are gone' },
    items: [
      {
        ko: '카카오톡 알림을 없애면서 쓸 일이 없어진 값이에요. 안 쓰더라도 남아 있으면 언젠가 새는 쪽이라, 저장해 둔 것까지 통째로 지웠어요.',
        en: 'They stopped being used when KakaoTalk alerts went away. Unused data is still data that can leak, so the stored values are gone too.',
      },
      {
        ko: '로그인에는 아무 영향이 없어요. 지금처럼 카카오로 들어오면 돼요.',
        en: 'Nothing changes about signing in — log in with Kakao exactly as before.',
      },
    ],
  },
  {
    at: '2026-08-04T20:20',
    title: { ko: '화면이 또 빨라졌어요', en: 'Screens got faster again' },
    items: [
      {
        ko: '이제 모든 화면이 서버에서 다 그려진 채로 와요. 「불러오는 중…」을 보고 기다렸다가 내용이 뜨던 게 없어졌어요. 알림함이 마지막이었어요.',
        en: 'Every screen now arrives fully drawn from the server — no more “Loading…” followed by the content popping in. Alerts was the last one.',
      },
      {
        ko: '다 같이 보는 것(카테고리별 다음 모임, 주최·참가 순위)은 서버가 잠시 기억해 뒀다가 그대로 내줘요. 누가 모임을 만들거나 참가하면 그 자리에서 다시 세요.',
        en: 'The things everyone sees the same way — each category’s next meetup, the two rankings — are held for a short while and reused. They’re recounted the moment someone creates or joins a meetup.',
      },
      {
        ko: '무비나잇에서 날짜를 앞뒤로 넘길 때 상영표를 매번 다시 받지 않아요.',
        en: 'Flipping between dates on Movie Night no longer re-downloads the showtimes each time.',
      },
    ],
  },
  {
    at: '2026-08-04T20:00',
    notable: true,
    title: { ko: '둘러보기를 2열로 볼 수 있어요', en: 'Browse in two columns' },
    items: [
      {
        ko: '제목 줄 오른쪽 버튼으로 「한 줄」과 「바둑판(2열)」을 골라요. 고른 배열은 기억해 둬요.',
        en: 'Two buttons at the right of the heading switch between one-per-row and a two-column grid. Your choice is remembered.',
      },
      {
        ko: '2열에서는 카드가 좁아서, 카테고리 그림이 왼쪽 위로 올라가고 ★·🔔은 동그란 테두리 없이 아이콘만 보여요. 켜 둔 것은 하얗게 채워져요.',
        en: 'In the grid the cards are half as wide, so the category icon moves to the top left and ★/🔔 lose their round outlines — just the icons, filled white when they’re on.',
      },
      {
        ko: '카드 열세 장의 색을 같은 밝기로 맞췄어요. 빨강·파랑·보라·분홍만 유독 튀던 게 가라앉아요.',
        en: 'All thirteen cards were levelled to the same brightness — the reds, blues, purples and pinks no longer jump out on their own.',
      },
      {
        ko: '카드 아래 다음 일정에 날짜가 붙어요. 「토 오후 6:00」이 「8/8(토) 오후 6:00」이 됐어요 — 이번 주 토요일인지 다음 주인지 헷갈리지 않아요.',
        en: 'The next-meetup line now carries the date: “Sat 6:00 PM” became “Sat Aug 8 6:00 PM”, so you can tell this Saturday from next.',
      },
    ],
  },
  {
    at: '2026-08-04T19:40',
    title: { ko: '무비나잇 모임 카드에 포스터가 붙어요', en: 'Posters on Movie Night meetup cards' },
    items: [
      {
        ko: '무비나잇 모임 카드 오른쪽에 그 영화 포스터가 보여요.',
        en: 'Movie Night meetup cards now show the film’s poster on the right.',
      },
      {
        ko: '포스터를 누르면 크게 볼 수 있어요. 상영표에서와 똑같아요.',
        en: 'Tap it to see it full size — same as in the showtimes list.',
      },
    ],
  },
  {
    at: '2026-08-04T19:10',
    title: { ko: '순위는 모임이 끝난 뒤에 올라가요', en: 'Points land after the meetup' },
    items: [
      {
        ko: '예정된 모임을 미리 세고 있었어요. 아직 일어나지 않은 일로 점수가 오르고, 취소하면 다시 내려갔어요.',
        en: 'Upcoming meetups were being counted — points went up for something that hadn’t happened, and back down if it was cancelled.',
      },
      {
        ko: '참여 순위는 더했어요. 참가 버튼만 눌러 둬도 순위가 올랐는데, 이제 다녀와야 올라가요.',
        en: 'The join ranking was worse — tapping Join was enough. Now you have to actually go.',
      },
      {
        ko: '그래서 지금 점수가 예전보다 내려가 보일 수 있어요. 빠진 건 아직 안 끝난 모임뿐이고, 끝나면 그대로 올라와요.',
        en: 'Your number may look lower for now. Nothing was removed — the upcoming ones just haven’t landed yet.',
      },
      {
        ko: '모임 카드에서 이름 옆에 붙는 호스트 등급도 같은 기준이에요.',
        en: 'The host badge next to names on meetup cards follows the same rule.',
      },
    ],
  },
  {
    at: '2026-08-04T17:30',
    notable: true,
    title: { ko: '알림이 앱 푸시로 와요 (카톡 알림은 없앴어요)', en: 'Alerts come as app push now (KakaoTalk alerts are gone)' },
    items: [
      {
        ko: '카카오톡으로 보내던 알림을 없앴어요. 이제 앱 푸시와 앱 안 알림함, 둘로 옵니다.',
        en: 'We stopped sending alerts over KakaoTalk. They now come as app push and in the alerts tab.',
      },
      {
        ko: '앱 푸시를 아직 안 켰다면 프로필 → 앱 푸시 알림에서 켜주세요. 안 켜면 앱을 열어야 알림을 볼 수 있어요.',
        en: 'If you haven’t turned push on yet, do it in Profile → App push notifications. Without it you’ll only see alerts when you open the app.',
      },
      {
        ko: '아이폰은 홈 화면에 추가한 다음에야 켤 수 있어요. 사파리 탭에서는 켤 수 없어요.',
        en: 'On iPhone you have to add the app to your home screen first — a Safari tab can’t turn it on.',
      },
      {
        ko: '로그인할 때 카카오에 「메시지 보내기」 권한도 이제 요청하지 않아요.',
        en: 'Logging in no longer asks Kakao for permission to message you.',
      },
    ],
  },
  {
    at: '2026-08-04T16:40',
    title: { ko: '캠핑이 생겼어요', en: 'Camping is here' },
    items: [
      {
        ko: '정재호 님이 제안한 캠핑 카테고리를 넣었어요. 「불멍 5분, 먹방 5시간」',
        en: 'Camping, suggested by 정재호. “Five minutes of fire, five hours of food.”',
      },
      {
        ko: '캠핑 모임에는 사이트 번호를 적을 수 있어요(선택). 어디로 가면 되는지 한 줄로 알려줄 수 있어요.',
        en: 'Camping meetups can carry a site number (optional) — one line that tells everyone where to go.',
      },
      {
        ko: '열세 장이 되면서 카드 색을 조금씩 다시 벌렸어요. 비슷해 보이던 색들이 갈라져요.',
        en: 'With thirteen cards, the colours were re-spaced a little so the close ones pull apart.',
      },
    ],
  },
  {
    at: '2026-08-04T15:20',
    title: { ko: '여기저기 다듬었어요', en: 'A handful of smaller things' },
    items: [
      {
        ko: '익명으로 쓴 댓글이 나에게는 「이름(익명)」으로 보여요. 익명으로 단 걸 잊지 않도록요. 남에게는 그대로 「익명」이에요.',
        en: 'Your own anonymous comments now read “name (anonymous)” to you, so you don’t forget. Others still just see “Anonymous”.',
      },
      {
        ko: '정산에서 받을 사람 Venmo 아이디가 보이고, 누르면 금액까지 채워진 채로 Venmo가 열려요.',
        en: 'Settle-up shows the payee’s Venmo handle — tap it and Venmo opens with the amount filled in.',
      },
      {
        ko: '지난 비공개 모임은 캘린더와 지난 모임 목록에서 안 보여요. 보고 싶으면 프로필 → 지난 비공개 모임에서 켜세요.',
        en: 'Private meetups drop out of your calendar and past lists once they’re over. Turn them back on in Profile → Past private meetups.',
      },
      {
        ko: '리더보드는 닉네임을 정해 둔 사람은 닉네임으로 불러요.',
        en: 'The leaderboard now calls you by your nickname if you set one.',
      },
      {
        ko: '모임 화면의 「Google 캘린더」·「캘린더 파일」은 아이콘이 됐어요. 프로필의 즐겨찾기 순서 칸은 없앴어요 — 홈에서 카드를 끌어서 바꾸면 돼요.',
        en: 'The two calendar links became icons. The favourite-order list left the profile — drag the cards on the home screen instead.',
      },
    ],
  },
  {
    at: '2026-08-04T11:00',
    title: { ko: '화면이 빨라졌어요', en: 'Screens open faster' },
    items: [
      {
        ko: '한 화면을 열 때 서버에 묻는 횟수를 열 번대에서 네 번으로 줄였어요. 모임 목록은 받아오는 양도 4분의 1로 줄었어요.',
        en: 'Opening a screen went from a dozen server round trips to four, and meetup lists now pull a quarter of the data.',
      },
      {
        ko: '보이는 건 그대로예요. 기다리는 시간만 짧아져요.',
        en: 'Nothing looks different — there’s just less waiting.',
      },
    ],
  },
  {
    at: '2026-08-03T18:05',
    title: { ko: '홈 첫 줄이 날마다 바뀌어요', en: 'The line on the home screen changes daily' },
    items: [
      {
        ko: '「취미로 모이는 크루」 자리에 날마다 다른 문구가 떠요. 열다섯 개를 돌리니 보름에 한 바퀴예요.',
        en: 'A different line greets you each day — fifteen of them, so it comes back around every two weeks.',
      },
      {
        ko: '같은 날에는 모두 같은 문구를 봐요. 무작위가 아니라 날짜로 정해져 있어서, 새로고침해도 안 바뀌어요.',
        en: 'Everyone sees the same line on the same day — it’s picked by the date, not at random.',
      },
      {
        ko: '센스 있는 문구를 받습니다. 건의함에 남겨주시면 넣을게요. 채택되면 그날 홈에 뜹니다.',
        en: 'Got a good one? Drop it in the suggestion box — if it lands, it goes up on the home screen.',
      },
      {
        ko: '카테고리 카드 밑줄도 종목마다 다른 말로 바꿨어요(축구 「숨차면 걸어도 됩니다」). 이것도 추천받습니다.',
        en: 'Category cards got their own lines too — “Walk when you need to.” for soccer. Suggestions welcome for these as well.',
      },
    ],
  },
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
        ko: '이미 끝난 모임은 만든 사람도 지울 수 없어요.',
        en: 'Once a meetup has happened, even the person who made it can’t delete it.',
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
