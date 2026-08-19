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
    at: '2026-08-19T12:30',
    notable: true,
    title: { ko: '테마 상점이 생겼어요', en: 'There’s a theme shop now' },
    items: [
      {
        ko: '리더보드 오른쪽 위 「테마 상점」으로 들어가요. 그동안 모임을 열고, 나가고, 사진과 댓글을 남긴 만큼 코인이 쌓여 있어요 — 따로 모을 것 없이 이미 쌓인 거예요.',
        en: 'Open it from “Theme shop”, top right of the leaderboard. Coins are already there — everything you’ve hosted, shown up for, and left behind has been adding up.',
      },
      {
        ko: '코인은 주최 점수 + 정성 점수 + 참여 횟수×3이에요. 참여에만 3을 곱하는 건 눈금이 달라서예요 — 모임 한 번 여는 것과 한 번 나가는 것은 점수가 붙는 속도가 아주 달라요.',
        en: 'Coins are hosting + contributions + turnout×3. Turnout is tripled because the scales differ: hosting a meetup and showing up to one earn points at very different speeds.',
      },
      {
        ko: '지금은 「여름 · 장마」 하나를 50코인에 팔아요. 비 오는 창밖 같은 청회색 테마인데, 카드 안에 실제로 비가 내리고 아래에 물이 차올라요. 글씨도 고운바탕으로 바뀌고요.',
        en: 'Right now there’s one: “Summer · Rainy season”, 50 coins. Slate blue like a rainy window — rain actually falls inside each card and water pools at the bottom. The type changes too.',
      },
      {
        ko: '산 테마는 프로필의 「카드 테마」에서 골라요. 고른 테마는 그 기기에서만 보여요 — 다른 사람 화면은 그대로예요.',
        en: 'Pick what you own under “Card theme” in your profile. Your pick shows on that device only — everyone else sees theirs.',
      },
    ],
  },
  {
    at: '2026-08-19T10:00',
    notable: true,
    title: { ko: '정산에 「보냈어요」를 찍을 수 있어요', en: 'Mark a settle-up as sent' },
    items: [
      {
        ko: '보내고 나서 자기 줄의 「보냈어요」를 눌러주세요. 받는 사람이 벤모 알림과 명단을 번갈아 보며 누가 냈는지 세지 않아도 돼요 — 열 명 넘게 나눠 내는 정산도 있으니까요.',
        en: 'After you send, tap “I sent it” on your own line. Whoever’s collecting no longer has to flip between their payment app and the list — some of these are split more than ten ways.',
      },
      {
        ko: '낸 줄은 흐려져요. 남은 줄만 또렷하게 남아서, 세지 않아도 누가 아직인지 보여요. 명단 위에 「4/9명 보냄」도 적혀 있고, 정산을 접어 둬도 그 숫자는 보여요.',
        en: 'Paid lines fade out, so only the ones still owing stay sharp — you don’t have to count. There’s a “4/9 sent” line above the list, and it shows even when the settle-up is collapsed.',
      },
      {
        ko: '받는 사람은 남의 줄도 눌러서 「받았어요」로 바꿀 수 있어요. 현금으로 받았거나 잘못 눌린 걸 정리할 때 쓰세요. 본인이 찍은 것은 「보냄」, 받은 사람이 확인한 것은 「확인」으로 갈려서 보여요.',
        en: 'If you’re collecting, you can tick other people’s lines as received — for cash, or to fix a mistap. “Sent” means they said so; “Received” means you confirmed it.',
      },
      {
        ko: '다시 알리기를 열면 아직 안 낸 사람만 골라져 있어요. 낸 사람에게 또 보내라고 알리는 건 재촉이 아니라 실수니까요.',
        en: 'The reminder picker now starts with only the people who haven’t paid. Nudging someone who already paid isn’t pushy, it’s just wrong.',
      },
    ],
  },
  {
    at: '2026-08-19T09:45',
    title: { ko: '후기는 50자부터예요', en: 'Reviews start at 50 characters' },
    items: [
      {
        ko: '「재밌었어요」 한 마디는 쓴 사람에게도 읽는 사람에게도 남는 게 없어서, 쉰 자를 채워야 올라가게 했어요. 그 길이면 무엇이 어땠는지에 「그래서 다음엔」까지 적게 돼요.',
        en: 'A four-word review leaves nothing behind for anyone, so it now takes fifty characters. That’s about enough to say what it was like and what you’d do next time.',
      },
      {
        ko: '쓰는 칸 옆에 「50자 더」처럼 모자란 만큼이 보여요. 다 채우면 남은 글자 수로 바뀌어요.',
        en: 'The counter shows how many you still need, then flips to how many you have left.',
      },
      {
        ko: '이미 올라간 짧은 후기는 그대로 있어요. 지난 걸 다시 쓰게 하는 규칙이 아니라 앞으로 쓸 것에만 걸리는 문턱이에요.',
        en: 'Reviews already up stay as they are — this only applies to new ones.',
      },
    ],
  },
  {
    at: '2026-08-19T09:30',
    title: { ko: '「기여도」가 「정성」이 됐어요', en: '“Contributed” is now “Care”' },
    items: [
      {
        ko: '「기여도」는 인사고과에서 쓰는 말 같아서 바꿨어요. 세는 것도 사진 올리고 댓글 달고 카테고리 제안한 것이라, 「기여 정도」보다 「정성」이 실제로 하는 일에 가까워요.',
        en: 'The old name read like a performance review. What it counts is photos, comments and proposals — closer to care than to a score.',
      },
      {
        ko: '점수도 조정했어요. 승인된 카테고리 제안이 7점, 후기가 3점이에요 (사진과 댓글은 그대로 1점씩).',
        en: 'The weights changed too: an approved category proposal is 7, a review 3 (photos and comments stay at 1).',
      },
      {
        ko: '등급 배지 안에 색이 들어갔어요. 새싹은 잎 초록, 도장은 인주 빨강, 왕관과 트로피는 금색 — 그림에 맞는 색이에요.',
        en: 'The tier badges are filled in now — leaf green for the sprout, ink red for the stamp, gold for the crown and trophy. Each one gets the color of the thing it draws.',
      },
      {
        ko: '등급이 오르면 다음 날 아침에 알려드려요. 점수는 모임이 끝나야 오르는 거라 그때그때가 아니라 하루에 한 번 모아서 봐요.',
        en: 'When you move up a tier, you’ll hear about it the next morning. Points only move once a meetup is over, so it’s checked once a day rather than moment to moment.',
      },
    ],
  },
  {
    at: '2026-08-18T17:30',
    title: { ko: '자잘한 손질 둘', en: 'Two small fixes' },
    items: [
      {
        ko: '후기 페이지에서 여행이 「8/14(금) ~ 8/16(일)」로 나와요. 시작한 날만 찍혀서 하루짜리처럼 보였어요.',
        en: 'On the Reviews page a trip now reads “Fri Aug 14 ~ Sun Aug 16”. It used to show only the first day, as if it were a one-day thing.',
      },
      {
        ko: '모아보기에서 여행 사진의 날짜 글씨가 다른 카테고리와 같은 크기가 됐어요. 여행 묶음만 유난히 커 보였어요.',
        en: 'In Keepsakes, the dates inside a trip’s photos are the same size as everything else now — that one group used to shout.',
      },
    ],
  },
  {
    at: '2026-08-18T17:00',
    title: { ko: '리더보드에 순위가 둘 늘었어요', en: 'Two more boards on the leaderboard' },
    items: [
      {
        ko: '「기여도」 — 사진·댓글·후기·승인된 카테고리 제안을 셉니다. 승인된 제안 10점, 후기 5점, 사진과 댓글은 1점씩이에요.',
        en: '“Contributed” — photos, comments, reviews, and approved category proposals. An approved proposal is 10, a review 5, a photo or comment 1 each.',
      },
      {
        ko: '사진과 댓글은 「한 모임에서」 5점·3점까지만 세요. 한 번에 몰아 올리는 것보다 여러 모임에 조금씩 남기는 쪽이 높아져요.',
        en: 'Photos and comments count up to 5 and 3 per meetup — leaving a little across many meetups beats dumping a pile into one.',
      },
      {
        ko: '「카테고리」 — 어느 종목이 실제로 많이 굴러갔는지. 몇 번 모였는지로 세고 연인원도 같이 보여줘요. 비공개 모임은 세지 않아요.',
        en: '“Categories” — which ones actually kept going. Ranked by how many meetups happened, with the total turnout beside it. Private meetups aren’t counted.',
      },
      {
        ko: '참여와 기여도에도 등급 스티커가 붙어요. 문턱은 각자 달라요 — 참여는 3·8·15·25회, 기여도는 5·15·30·60점이에요.',
        en: 'Turnout and contributions get tier stickers too, on their own scales — 3/8/15/25 for turnout, 5/15/30/60 points for contributions.',
      },
    ],
  },
  {
    at: '2026-08-18T14:00',
    notable: true,
    title: { ko: '후기는 이름 없이 올라가요', en: 'Reviews go up without your name' },
    items: [
      {
        ko: '이제 모든 후기에 이름이 안 붙어요. 아쉬웠던 점도 편하게 적어주세요 — 열여섯 명이 서로 아는 사이라, 이름이 붙어 있으면 좋은 말만 남게 되니까요. 점수를 안 매기는 것과 같은 이유예요.',
        en: 'No review carries a name anymore. Say the awkward parts too — we all know each other here, and with a name attached only the nice things get written. Same reason there are no scores.',
      },
      {
        ko: '자기가 쓴 후기는 자기에게만 이름이 보여요. 고치거나 지우려면 찾을 수 있어야 하니까요.',
        en: 'You still see your own name on your own review — you need to find it to change or delete it.',
      },
      {
        ko: '비공개 모임의 후기도 모아보기에 올라와요. 이름이 없으니 누가 어디에 갔는지는 드러나지 않아요. 대신 그 모임으로 들어가는 링크는 안 붙어요 — 부르지 않은 사람에게 초대가 나가면 안 되니까요.',
        en: 'Reviews from private meetups show up in Keepsakes too. With no name on them, they don’t reveal who went where. They just don’t link into the meetup — an invitation shouldn’t go out to someone who wasn’t asked.',
      },
      {
        ko: '기여도 순위에서 후기는 5점으로 세지만, 누가 몇 개 썼는지는 적지 않아요.',
        en: 'A review is worth 5 points on the contributions board, but we don’t list how many anyone wrote.',
      },
    ],
  },
  {
    at: '2026-08-18T09:00',
    notable: true,
    title: { ko: '이삿짐센터가 생겼어요', en: 'There’s a Moving Crew now' },
    items: [
      {
        ko: '이사 도와줄 사람을 찾는 자리예요. 루민 님이 제안했어요.',
        en: 'A place to ask for hands on moving day. 루민 suggested it.',
      },
      {
        ko: '「짐 있는 곳」과 「이사 갈 곳」을 따로 적어요 — 도우러 가는 사람은 어디로 갈지, 얼마나 멀리 옮기는지 둘 다 알아야 하니까요.',
        en: 'You write where the stuff is and where it’s going — whoever comes needs both: where to show up, and how far it all has to travel.',
      },
      {
        ko: '둘러보기의 카드가 색깔 순서로 늘어서요. 빨강에서 시작해 한 바퀴 돌아 분홍으로 돌아와요.',
        en: 'The cards in Browse are in color order now — starting at red, all the way around, back to pink.',
      },
    ],
  },
  {
    at: '2026-08-17T21:00',
    notable: true,
    title: { ko: '여행 사진이 찍은 순서로 늘어서요', en: 'Trip photos line up in the order you took them' },
    items: [
      {
        ko: '격자 대신 날짜별로, 그날 멈춘 자리별로 늘어서요. 사진에 원래 들어 있던 시각과 좌표를 읽는 거라 따로 적을 건 없어요.',
        en: 'Instead of a grid, they group by day and by each place you stopped. It reads the time and coordinates already inside the photo — you don’t type anything.',
      },
      {
        ko: '자리마다 이름이 붙어요 — 「Somisomi」, 「Carrollton, TX」처럼요. 숙소 근처에서 찍은 것은 「숙소」라고 나와요.',
        en: 'Each stop gets a name — “Somisomi”, “Carrollton, TX”. Anything taken near where you stayed just says “Where we stayed”.',
      },
      {
        ko: '이름이 틀렸으면 눌러서 고칠 수 있어요. 거기 있던 사람만 아는 게 있으니까요.',
        en: 'If a name is wrong, tap it and fix it. Some things only the people who were there know.',
      },
      {
        ko: '모아보기에서도 여행 사진은 같은 모양으로 보여요.',
        en: 'Keepsakes shows trip photos the same way.',
      },
      {
        ko: '카톡으로 받은 사진은 시각과 자리가 지워져 있어서 안 늘어서요. 사진 앱에서 직접 골라 올려주세요.',
        en: 'Photos forwarded through KakaoTalk arrive with the time and place stripped out, so they can’t line up. Pick them straight from your photo app instead.',
      },
    ],
  },
  {
    at: '2026-08-17T18:00',
    notable: true,
    title: { ko: '정산을 여러 개 올릴 수 있어요', en: 'A meetup can have more than one settle-up' },
    items: [
      {
        ko: '한 사람이 여러 번 결제했거나, 여러 사람이 각자 낸 것도 각각 올릴 수 있어요. 정산마다 받는 사람이 달라도 돼요.',
        en: 'One person paying several times, or several people each paying — each goes up separately, and each can have a different person collecting.',
      },
      {
        ko: '정산이 많으면 접혀요. 접힌 줄에 누가 받는지, 총액, 내 몫이 다 적혀 있어서 대개 펼치지 않아도 돼요.',
        en: 'When there are several, they come collapsed. The one line shows who’s collecting, the total, and your share — usually that’s all you need.',
      },
      {
        ko: '맨 위에 「보낼 돈 · 받을 돈」 한 줄이 생겼어요. 같은 사람에게 갈 돈은 묶어서 보여줘요 — 어차피 한 번에 보내니까요.',
        en: 'There’s a line at the top: what you send, and what you get back. Money going to the same person is added up, since you’ll send it in one go anyway.',
      },
    ],
  },
  {
    at: '2026-08-17T14:00',
    title: { ko: '여행 카테고리가 생겼어요', en: 'There’s a Trip category now' },
    items: [
      { ko: '정재호 님이 제안했어요.', en: '정재호 suggested it.' },
      {
        ko: '시각 대신 날짜 범위로 만들어요 — 8/14(금) ~ 8/16(일). 숙소도 적을 수 있어요.',
        en: 'You set a date range instead of a start time — Fri Aug 14 ~ Sun Aug 16. There’s a spot for where you’re staying, too.',
      },
      {
        ko: '예정과 지난을 나누지 않고 한 줄로, 최신 여행부터 보여줘요.',
        en: 'No upcoming/past tabs — one list, newest trip first.',
      },
    ],
  },
  {
    at: '2026-08-14T10:00',
    title: { ko: '사진을 회원 모두에게 열 수 있어요', en: 'You can open a meetup’s photos to everyone' },
    items: [
      {
        ko: '한 모임에 20장까지 바로 보여요. 전에는 6장에서 끊겼어요.',
        en: 'Up to twenty photos show at once — it used to stop at six.',
      },
      {
        ko: '방장과 관리자가 그 모임 사진을 회원 전체에게 열 수 있어요. 비공개 모임이나 익명 모임도요.',
        en: 'Hosts and admins can open a meetup’s photos to every member — private and anonymous meetups too.',
      },
      {
        ko: '열어도 모임 자체는 안 열려요. 안 갔던 사람은 사진만 보고, 그 모임 페이지로는 못 들어가고 원본도 못 받아요.',
        en: 'Opening the photos doesn’t open the meetup. People who weren’t there see the photos only — they can’t reach the meetup page, and they can’t take the originals.',
      },
      {
        ko: '모아보기에서 열려 있는 모임에는 「전체공개」가 붙어요.',
        en: 'In Keepsakes, an opened meetup is marked “Open to all”.',
      },
    ],
  },
  {
    at: '2026-08-13T22:00',
    notable: true,
    title: { ko: '사진을 폰에 그대로 받을 수 있어요', en: 'Photos save straight to your phone' },
    items: [
      {
        ko: '「원본 받기」가 앱을 벗어나지 않아요. 전에는 딴 화면으로 튕겨서 돌아올 방법이 없었어요.',
        en: 'Saving the original no longer throws you out of the app. It used to land on a page with no way back.',
      },
      {
        ko: '여러 장이면 「n장 전부 받기」가 붙어요. 압축 파일이 아니라 사진 그대로라 사진 앱에 바로 들어가요.',
        en: 'With more than one there’s “Download all n”. They come as photos, not a zip, so they land in your photo app.',
      },
      {
        ko: '모아보기가 빨라졌어요. 격자에 작은 사진을 쓰게 해서 첫 화면이 훨씬 가벼워졌어요.',
        en: 'Keepsakes got faster — the grid uses a small copy now, so the first screenful is a fraction of what it was.',
      },
    ],
  },
  {
    at: '2026-08-13T16:30',
    title: { ko: '알림은 프로필 맨 위 오른쪽에 있어요', en: 'Alerts are at the top right of Profile' },
    items: [
      {
        ko: '알림함이 프로필 한참 아래에 있어서 끝까지 내려야 닿았어요. 이제 프로필을 열면 제목 옆에 🔔 버튼이 바로 보여요.',
        en: 'The alerts screen was buried at the bottom of Profile. Now there’s a 🔔 button right next to the title.',
      },
      {
        ko: '안 읽은 게 있으면 그 버튼에 숫자로 같이 보여요.',
        en: 'If anything’s unread, the count sits on the button.',
      },
    ],
  },
  {
    at: '2026-08-13T15:00',
    notable: true,
    title: { ko: '모임 후기를 남기고, 모아 볼 수 있어요', en: 'Leave a review, and read everyone else’s' },
    items: [
      {
        ko: '다녀온 모임에 한 줄씩 남길 수 있어요. 모임 화면 아래에 칸이 생겼어요. 점수는 안 매겨요 — 열두어 명이 서로 아는 사이라, 모임에 점수를 붙이기 시작하면 서로 눈치를 보게 되니까요.',
        en: 'You can leave a line on a meetup you went to — there’s a box at the bottom of the meetup page. No scores: we all know each other here, and rating each other’s meetups would just make everyone careful.',
      },
      {
        ko: '쓰는 건 다녀온 사람만, 읽는 건 회원 모두예요. 「저기 재미있었대」를 보고 다음에 가보는 게 후기의 쓸모라서요.',
        en: 'Only people who were there can write one, but everyone can read them — the point is that you see “that one was fun” and go next time.',
      },
      {
        ko: '아래 탭바의 알림이 프로필 안으로 들어갔어요. 알림이 오면 프로필 칸에 점이 하나 뜨고, 프로필 → 알림에서 지금처럼 볼 수 있어요.',
        en: 'Alerts moved into Profile. A dot appears on the Profile tab when something arrives, and Profile → Alerts is the same screen as before.',
      },
      {
        ko: '비워진 자리는 「모아보기」예요. 사진과 후기를 따로 모아 봐요. 사진은 지금 규칙 그대로 — 내가 갔던 모임 것만 보여요.',
        en: 'That tab is now Keepsakes — photos and reviews, each on its own page. Photos follow the same rule as always: only from meetups you were at.',
      },
      {
        ko: '모임 카드에도 「후기 2」처럼 보여요. 아직 하나도 없으면 다녀오신 분에게만 「후기 남기기」가 떠요.',
        en: 'Meetup cards show a count like “Reviews 2”. When there are none yet, only people who were there see “Leave a review”.',
      },
      {
        ko: '별보러가자처럼 익명인 곳의 후기는 「익명」으로만 보여요. 얼굴도 안 보이고요.',
        en: 'Reviews from anonymous categories show as “Anonymous”, with no face.',
      },
    ],
  },
  {
    at: '2026-08-13T13:20',
    title: { ko: '모임이 바뀌면 무엇이 바뀌었는지 알려줘요', en: 'Edit alerts now say what changed' },
    items: [
      {
        ko: '전에는 「모임이 변경됐어요」 한 줄뿐이라, 열어보기 전에는 뭐가 달라졌는지 알 수 없었어요.',
        en: 'It used to just say “this meetup changed”, so you had to open it to find out what.',
      },
      {
        ko: '이제 시간·장소·제목처럼 실제로 바뀐 것만 알림에 같이 적어줘요.',
        en: 'Now the alert lists what actually changed — the time, the place, the title.',
      },
    ],
  },
  {
    at: '2026-08-13T12:30',
    notable: true,
    title: { ko: '사진을 올린 그대로 받을 수 있어요', en: 'Photos download exactly as they were uploaded' },
    items: [
      {
        ko: '사진을 크게 보고 「원본 받기」를 누르면, 올린 분이 올린 파일 그대로 받아요. 앱이 줄이거나 다시 저장하지 않은 파일이에요.',
        en: 'Open a photo and tap “Download original” to get the exact file the uploader picked — not resized, not re-saved by the app.',
      },
      {
        ko: '화면에 보이는 사진은 지금처럼 줄여서 보여줘요. 넘길 때 빨리 떠야 하니까요. 줄이는 건 보여줄 때뿐이고, 받을 때는 원본이에요.',
        en: 'What you see on screen is still the smaller version, so it loads fast. The shrinking is only for showing — downloads are the original.',
      },
      {
        ko: '올린 사람이 아니어도 받을 수 있어요. 같이 갔던 모임의 사진이면 다 받을 수 있어요.',
        en: 'You don’t have to be the one who uploaded it — any photo from a meetup you were at.',
      },
      {
        ko: '이 기능이 생기기 전에 올라간 사진은 원본이 따로 없어서 「사진 받기」로 나와요. 그때는 보이는 크기 그대로 받아요.',
        en: 'Photos uploaded before this exists have no stored original, so the button reads “Download photo” and gives you the size you see.',
      },
    ],
  },
  {
    at: '2026-08-13T11:30',
    title: { ko: '설치한 앱에서 화면을 더 넓게 써요', en: 'The installed app uses more of the screen' },
    items: [
      {
        ko: '홈 화면에 추가해서 쓰시는 분들은 맨 위 「Kansas Korean」 줄이 이제 안 보여요. 아래 탭바만으로 다 다닐 수 있어서, 그 줄은 자리만 차지하고 있었어요.',
        en: 'If you added the app to your home screen, the “Kansas Korean” bar at the top is gone — the tabs at the bottom already get you everywhere.',
      },
      {
        ko: '페이지마다 제각각이던 제목 위아래 여백을 하나로 맞췄어요.',
        en: 'The spacing above and below page titles is the same everywhere now.',
      },
      {
        ko: '모임을 만들거나 고칠 때, 그리고 사진을 크게 볼 때는 아래 탭바가 안 나와요. 저장 버튼을 가리고 있었거든요.',
        en: 'The bottom tabs hide while you’re creating or editing a meetup, and while a photo is zoomed — they were covering the save button.',
      },
      {
        ko: '둘러보기를 격자로 볼 때 아이콘이 제목 위로 올라타던 것도 고쳤어요.',
        en: 'Fixed the Browse grid, where the icons were landing on top of the titles.',
      },
    ],
  },
  {
    at: '2026-08-12T12:20',
    title: { ko: 'Venmo·Zelle은 안 쓰는 칸을 비워두세요', en: 'Leave the payment box you don’t use empty' },
    items: [
      {
        ko: '둘 중 하나만 쓰신다면 안 쓰는 칸은 그냥 비워두세요. 비워두면 정산 화면에서 그 줄이 아예 안 나와요.',
        en: 'If you only use one of them, leave the other box blank — that line simply won’t appear on the settle-up screen.',
      },
      {
        ko: '안 쓴다는 뜻으로 「Zelle」이나 「없음」처럼 적어두면, 앱은 그걸 아이디로 읽어서 보내기 링크를 그 이름의 모르는 사람에게 걸어요. 그래서 프로필과 정산 화면에 안내를 적어뒀어요.',
        en: 'Typing something like “Zelle” or “none” to mean “I don’t use this” doesn’t work — the app reads it as a handle and points the pay link at a stranger by that name. There’s a note about it on both screens now.',
      },
      {
        ko: '저장해 둔 Zelle 전화번호는 숫자를 끊어서 보여줘요 — 옮겨 적을 때 틀리지 않게요.',
        en: 'Saved Zelle phone numbers are shown with dashes, so they’re harder to mistype.',
      },
    ],
  },
  {
    at: '2026-08-12T10:45',
    title: { ko: '비공개 모임 초대는 빈 채로 시작해요', en: 'Private invites start with nobody picked' },
    items: [
      {
        ko: '전에는 친구가 전부 선택된 채로 열려서, 그대로 만들면 친구 모두에게 초대가 갔어요.',
        en: 'It used to open with every friend already checked, so making the meetup invited all of them.',
      },
      {
        ko: '이제 아무도 선택되지 않은 채로 열려요. 부를 사람만 골라주세요.',
        en: 'Now it opens empty — pick only the people you want there.',
      },
    ],
  },
  {
    at: '2026-08-10T21:00',
    notable: true,
    title: { ko: '한국어를 몰라도 읽을 수 있어요', en: 'Translation feature is added.' },
    items: [
      {
        ko: '댓글이나 모임 설명 아래에 「번역 보기」가 생겼어요. 눌러야 나오고, 원문은 그대로 위에 남아 있어요.',
        en: 'There’s a “See translation” line under comments and meetup descriptions. You tap it, and the original stays right above.',
      },
      {
        ko: '읽는 언어와 글자가 다를 때만 보여요. 한국어로 보는 분에게 한국어 댓글마다 붙어 있으면 시끄러우니까요.',
        en: 'It only shows when the writing isn’t in the language you’re reading in.',
      },
      {
        ko: '한 번 옮긴 글은 저장해 둬서, 다음 사람은 누르자마자 바로 나와요.',
        en: 'Once something has been translated, the next person sees it instantly.',
      },
    ],
  },
  {
    at: '2026-08-09T18:00',
    notable: true,
    title: { ko: '8월 12일 일식 — 별보러가자 🌌', en: 'Aug 12 eclipse — Chasing the Stars 🌌' },
    items: [
      {
        ko: '내일 모레가 일식이라 하루짜리 카드를 하나 열었어요. 둘러보기 맨 끝에 있어요.',
        en: 'There’s an eclipse day after tomorrow, so there’s a one-day card for it — last one in Browse.',
      },
      {
        ko: '여기는 전부 익명이에요. 연 사람도, 명단도, 댓글도 「익명」으로만 보여요. 얼굴도 안 보이고요.',
        en: 'Everything here is anonymous — the host, the roster, the comments. No faces either.',
      },
      {
        ko: '그래서 여기서는 정산을 못 열고, 명단에서 친구를 추가하거나 대신 넣을 수도 없어요. 순위표에도 안 들어가요. 전부 이름이 드러나는 길이라서요.',
        en: 'So there are no settle-ups, no adding people from the roster, and it doesn’t count toward the rankings — each of those would put a name on screen.',
      },
      {
        ko: '들어가면 밤하늘 소리가 깔려요. 오른쪽 위 ♪를 누르면 꺼지고, 한 번 끄면 다시 안 켜져요. 음원이 아니라 앱이 그 자리에서 만들어내는 소리예요.',
        en: 'A night-sky ambience fades in when you open it. The ♪ at the top right turns it off for good. It isn’t a track — the app makes the sound on the spot.',
      },
      {
        ko: '일식이 끝나면 이 카드는 목록에서 내려요. 그날 남긴 사진과 댓글은 그대로 있어요.',
        en: 'The card comes down after the eclipse. Whatever you leave there stays.',
      },
    ],
  },
  {
    at: '2026-08-09T11:00',
    notable: true,
    title: { ko: '영어 이름을 적어 둘 수 있어요', en: 'You can add an English name' },
    items: [
      {
        ko: '이름이 카카오 닉네임에서 오다 보니 명단이 거의 한글이에요. 한국어가 아직 익숙하지 않은 분들에게는 그게 읽을 수 없는 글자로만 보여요.',
        en: 'Names come from Kakao, so most of them are in Hangul — which, if you don’t read Korean yet, is just shapes.',
      },
      {
        ko: '프로필 → 영어 이름에 적어 두면, 앱을 English나 Español로 보는 분들에게 그 이름으로 보여요. 한국어로 보는 분들에게는 지금 이름 그대로예요.',
        en: 'Profile → English name. Anyone reading the app in English or Spanish sees that name instead. Korean readers see your name exactly as before.',
      },
      {
        ko: '모임 명단, 댓글, 친구, 순위표, 정산은 물론 알림 문구 속 이름까지 각자 보는 언어로 나와요.',
        en: 'Rosters, comments, friends, rankings, settlements — and the names inside notifications — all follow the language each person is reading in.',
      },
      {
        ko: '안 적어도 괜찮아요. 비워 두면 지금과 똑같아요.',
        en: 'Leaving it blank is fine — nothing changes.',
      },
    ],
  },
  {
    at: '2026-08-07T14:20',
    title: { ko: '앱 이야기는 건의함으로 해주세요', en: 'Ask about the app inside the app' },
    items: [
      {
        ko: '앱에 대한 문의·건의·오류 제보는 개인적으로 말고 앱 안의 건의함을 써주세요. 프로필 → 건의함이에요.',
        en: 'Questions, ideas and bug reports about the app go in the app’s suggestion box — Profile → Suggestions — not to me personally.',
      },
      {
        ko: '개인적으로 오면 저만 보고 흘러가요. 건의함에 넣으면 번호가 붙고 「접수됨 → 반영 예정 → 반영됨」이 남아서, 어떻게 됐는지 두 분 다 확인할 수 있어요.',
        en: 'Sent privately, it just scrolls away in a chat. In the suggestion box it gets a number and a status — received, planned, shipped — so we can both see where it went.',
      },
      {
        ko: '개인적으로 문의하시면 5분 정지 사유가 될 수 있어요. 5분이에요, 금방 풀려요.',
        en: 'Asking privately can earn you a five-minute suspension. Five minutes — you’ll live.',
      },
    ],
  },
  {
    at: '2026-08-07T14:00',
    notable: true,
    title: { ko: '독서나눔이 생겼어요', en: 'Book Club is here' },
    items: [
      {
        ko: '정인건 님이 제안한 카테고리예요. 둘러보기에서 축구와 테니스 사이에 있어요.',
        en: 'Suggested by 정인건. You’ll find it between Soccer and Tennis.',
      },
      {
        ko: '시작하는 방법이 다른 모임들과 달라요. 누가 날짜를 잡아 여는 게 아니라 5명이 모여야 시작해요. 들어가서 「참가신청」을 누르면 명단에 이름이 올라가요.',
        en: 'It starts differently from the rest. Nobody picks a date and opens it — five people have to gather first. Tap “Count me in” to get on the list.',
      },
      {
        ko: '5명이 차면 신청한 분들께 알림이 가고, 그 명단에서 바로 모임을 만들 수 있어요. 만들면 신청한 분들이 모두 참가자로 들어가요. 무슨 책을 읽을지와 날짜는 그 다섯이 같이 정하시면 돼요.',
        en: 'At five, everyone on the list gets an alert and can create the meetup right from it — and everyone on the list joins automatically. The book and the date are yours to settle together.',
      },
      {
        ko: '만들어진 모임에는 7명까지 들어올 수 있어요. 늦게 오셔도 자리가 있으면 참가할 수 있어요.',
        en: 'A meetup holds up to seven, so there’s room to join late if a seat is free.',
      },
      {
        ko: '신청할 때와 참가할 때 안내가 한 번 떠요. 정해진 분량은 읽고 오고 되도록 빠지지 않는 게 이 모임의 전제라서요.',
        en: 'Signing up and joining both show a short promise first — reading the agreed pages and turning up is what makes this one work.',
      },
      {
        ko: '아직 모임이 없어도 신청한 사람이 있으면 홈에 카드가 떠요. 일정 자리에 「2명 참가신청」처럼 보여요.',
        en: 'Even with no meetup yet, the card shows up at home once someone signs up — the schedule line reads “2 signed up”.',
      },
    ],
  },
  {
    at: '2026-08-06T14:00',
    title: { ko: 'Venmo 메모에 정산 내역이 적혀요', en: 'Venmo notes now say what the money is for' },
    items: [
      {
        ko: '정산에서 Venmo 아이디를 누르면 메모에 모임 이름만 들어갔는데, 이제 내가 내는 항목과 금액도 같이 적혀요. (예: 볼링 8/5(수) · 레인비 $12.00, 신발 대여 $3.00)',
        en: 'Tapping a Venmo handle used to fill the note with just the meetup. Now it carries your own items and amounts too — “Bowling Wed Aug 5 · Lane fee $12.00, Shoes $3.00”.',
      },
      {
        ko: '메모의 빈칸이 +로 보이던 것도 고쳤어요.',
        en: 'The spaces that showed up as + signs are fixed as well.',
      },
    ],
  },
  {
    at: '2026-08-06T12:00',
    title: { ko: '중요한 안내는 팝업으로 떠요', en: 'Important notices come as a popup' },
    items: [
      {
        ko: '꼭 보셔야 하는 안내는 앱을 열 때 화면 가운데에 한 번 떠요. 「알겠어요」를 누르면 그 안내는 다시 안 떠요.',
        en: 'Anything you really need to see appears once in the middle of the screen when you open the app. Tap “Got it” and it won’t come back.',
      },
      {
        ko: '새 소식과는 달라요 — 새 소식은 「무엇이 바뀌었나」, 공지는 「이렇게 해주세요」예요.',
        en: 'It’s not the same as What’s New: that one is what changed, this one is what to do.',
      },
    ],
  },
  {
    at: '2026-08-05T16:30',
    title: { ko: '점수가 같으면 공동 순위예요', en: 'Ties share a rank now' },
    items: [
      {
        ko: '리더보드에서 점수가 같은데도 순서대로 1, 2, 3등을 매기고 있었어요. 이제 같은 점수는 같은 등수예요.',
        en: 'The leaderboard used to number people 1, 2, 3 down the list even when their scores were level. Equal scores now share a rank.',
      },
      {
        ko: '예를 들어 8점 · 8점 · 6점 · 6점 · 5점이면 8점 두 분이 공동 1등, 6점 두 분이 공동 3등, 5점이 5등이에요. 그래서 은메달을 받는 사람이 없을 수도 있어요.',
        en: 'So with 8, 8, 6, 6, 5 the two 8s are joint first, the two 6s are joint third, and the 5 is fifth — which means nobody may hold the silver.',
      },
      {
        ko: '점수는 그대로예요. 등수를 세는 방법만 바뀌었어요.',
        en: 'Nobody’s score changed — only the way ranks are counted.',
      },
    ],
  },
  {
    at: '2026-08-05T16:00',
    notable: true,
    title: { ko: '모임에 사진을 올릴 수 있어요', en: 'Photos on meetups' },
    items: [
      {
        ko: '정재호 님이 건의한 기능이에요. 모임에 참가한 사람이면 누구나 사진을 올릴 수 있어요.',
        en: 'Suggested by 정재호. Anyone in a meetup can add photos to it.',
      },
      {
        ko: '언제 올려도 돼요. 만들면서 안내문이나 쿠폰을 한 장 걸어도 되고, 다녀와서 그날 찍은 걸 올려도 돼요. 나눠 두지 않았어요.',
        en: 'Any time — a flyer or coupon when you create it, the photos from the day afterwards. They all go in the same place.',
      },
      {
        ko: '모임 카드에 한 장이 보여요. 누르면 크게 뜨고 좌우로 넘겨서 나머지를 봐요. 사진이 없는 모임은 예전과 똑같이 보여요.',
        en: 'One shows on the meetup card. Tap it to open it big and swipe through the rest. Meetups without photos look exactly as before.',
      },
      {
        ko: '만든 뒤에는 모임 화면에서, 그리고 「수정」에서도 넣고 뺄 수 있어요. 수정 중에는 고르는 즉시 붙고 ✕를 누르면 즉시 빠져요 — 저장을 안 눌러도 돼요.',
        en: 'Afterwards you can add and remove them on the meetup page, or in Edit. In Edit they’re added the moment you pick one and gone the moment you tap ✕ — no need to hit save.',
      },
      {
        ko: '사진은 그 모임에 참가한 사람에게만 보여요. 다른 회원에게는 사진이 있다는 것조차 안 보이고, 주소를 알아도 열리지 않아요 — 비공개 모임 사진도 밖으로 새지 않아요.',
        en: 'Photos are visible only to people in that meetup. Other members can’t even tell there are any, and knowing the address isn’t enough to open one — so photos from private meetups stay in.',
      },
      {
        ko: '올린 사람은 언제든 지울 수 있어요. 아이폰 사진이 안 올라가면 설정 › 카메라 › 포맷을 「높은 호환성」으로 바꿔주세요.',
        en: 'Whoever added a photo can remove it any time. If an iPhone photo won’t upload, switch Settings › Camera › Formats to “Most Compatible”.',
      },
    ],
  },
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
