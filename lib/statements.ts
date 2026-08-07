import {Msg} from './i18n';

/**
 * 홈 첫 줄 — 날마다 바뀐다.
 *
 * 고정 문구는 두 번째 방문부터 읽히지 않는다. 그렇다고 아무 말이나 돌리면
 * 광고 문구가 되므로, 이 앱에서 실제로 일어나는 일만 적는다 —
 * 모임을 열고, 사람을 모으고, 나가서 만나는 일.
 *
 * 두 줄 구성은 그대로다: 첫 줄이 사실, 둘째 줄이 그래서 뭘 하자는 말.
 */
export interface Statement {
    top: Msg;
    bottom: Msg;
}

export const STATEMENTS: Statement[] = [
    {
        top: {ko: '아무도 몰라도 괜찮아요.', en: 'It’s fine if you don’t know anyone.'},
        bottom: {ko: '당신은 환영받기 위해 태어난 사람.', en: 'You were born to be welcomed.'},
    },
    {
        top: {ko: '잘하지 않아도 됩니다.', en: 'You don’t have to be good at it.'},
        bottom: {ko: '초보도 낄 자리를 만들어 둡니다.', en: 'There’s room for beginners here.'},
    },
    {
        top: {ko: '드루와,', en: 'Come on in,'},
        bottom: {ko: '드루와!', en: 'Come on in!'},
    },
    {
        top: {ko: '오늘 뭐 하지?', en: 'What should we do today?'},
        bottom: {ko: '그 질문을 여기서 같이 풉니다.', en: 'That’s the question we answer here.'},
    },
    {
        top: {ko: '가고 싶은 모임이 없으면,', en: 'If nothing here looks good,'},
        bottom: {ko: '가고 싶은 모임을 여세요.', en: 'make the one you’d want to go to.'},
    },
    {
        top: {ko: '오늘 저녁, 비어 있나요?', en: 'Free this evening?'},
        bottom: {ko: '누군가는 지금 사람을 찾고 있습니다.', en: 'Someone is looking for people right now.'},
    },
    {
        top: {ko: '날짜와 장소만 정하면 됩니다.', en: 'A date and a place — that’s all it takes.'},
        bottom: {ko: '모임 만들기는 30초면 끝납니다.', en: 'Posting a meetup takes thirty seconds.'},
    },

    {
        top: {ko: '밥, 커피, 공놀이, 영화.', en: 'Meals, coffee, ball games, movies.'},
        bottom: {ko: '핑계는 뭐든 좋습니다.', en: 'Any excuse works.'},
    },
    {
        top: {ko: '주말은 금방 지나갑니다.', en: 'The weekend goes fast.'},
        bottom: {ko: '미리 잡아두면 안 놓칩니다.', en: 'Lock it in and you won’t miss it.'},
    },
    {
        top: {ko: '아는 얼굴이 늘어갑니다.', en: 'More familiar faces every week.'},
        bottom: {ko: '한 번 같이 놀면 친구가 됩니다.', en: 'One meetup and you’re friends.'},
    },
    {
        top: {ko: '두 명이어도 모임입니다.', en: 'Two people is a meetup.'},
        bottom: {ko: '많이 모여야 하는 건 아닙니다.', en: 'It doesn’t have to be a crowd.'},
    },

    {
        top: {ko: '먼저 열면 사람이 모입니다.', en: 'Open one and people show up.'},
        bottom: {ko: '한 명이 시작해야 시작됩니다.', en: 'Someone has to go first.'},
    },
    {
        top: {ko: '혼자 하면 운동, 같이 하면 약속.', en: 'Alone it’s exercise. Together it’s plans.'},
        bottom: {ko: '약속이 있어야 나가게 됩니다.', en: 'Plans are what get you out the door.'},
    },
    {
        top: {ko: '이번 주에 한 번은 만납시다.', en: 'Let’s meet at least once this week.'},
        bottom: {ko: '달력에 하나만 있어도 한 주가 다릅니다.', en: 'One thing on the calendar changes the week.'},
    },
];

/**
 * 첫 줄(STATEMENTS[0])이 뜨는 날.
 *
 * 이게 없으면 순서가 목록 길이에 딸려간다 — 문구를 하나 더하는 순간 나머지가 전부
 * 다른 날로 밀린다. 기준 날짜를 박아 두면 목록이 길어져도 오늘 뜰 줄이 바뀌지 않는다.
 */
const ANCHOR = '2026-08-03';

const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

/**
 * 그날의 문구.
 *
 * 날짜를 세어 고른다 — 무작위가 아니라서 같은 날 열면 누구나 같은 줄을 보고,
 * 화면을 다시 그려도 문구가 바뀌지 않는다.
 */
export function statementOfDay(today: string): Statement {
    const n = STATEMENTS.length;
    const i = (((dayNumber(today) - dayNumber(ANCHOR)) % n) + n) % n;
    return STATEMENTS[i]!;
}
