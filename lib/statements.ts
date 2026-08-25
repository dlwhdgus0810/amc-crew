import {Msg} from './i18n';
import {Weather} from './weather';

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
        top: {ko: '아무도 몰라도 괜찮아요.', en: 'It’s fine if you don’t know anyone.', es: 'No pasa nada si no conoces a nadie.'},
        bottom: {ko: '당신은 환영받기 위해 태어난 사람.', en: 'You were born to be welcomed.', es: 'Aquí siempre cabe uno más.'},
    },
    {
        top: {ko: '잘하지 않아도 됩니다.', en: 'You don’t have to be good at it.', es: 'No hace falta que se te dé bien.'},
        bottom: {ko: '초보도 낄 자리를 만들어 둡니다.', en: 'There’s room for beginners here.', es: 'Aquí hay sitio para quien empieza.'},
    },
    {
        top: {ko: '드루와,', en: 'Come on in,', es: 'Pásate,'},
        bottom: {ko: '드루와!', en: 'Come on in!', es: '¡Pásate!'},
    },
    {
        top: {ko: '오늘 뭐 하지?', en: 'What should we do today?', es: '¿Qué hacemos hoy?'},
        bottom: {ko: '그 질문을 여기서 같이 풉니다.', en: 'That’s the question we answer here.', es: 'Esa es la pregunta que se responde aquí.'},
    },
    {
        top: {ko: '가고 싶은 모임이 없으면,', en: 'If nothing here looks good,', es: 'Si nada te convence,'},
        bottom: {ko: '가고 싶은 모임을 여세요.', en: 'make the one you’d want to go to.', es: 'crea la quedada a la que tú irías.'},
    },
    {
        top: {ko: '오늘 저녁, 비어 있나요?', en: 'Free this evening?', es: '¿Libre esta tarde?'},
        bottom: {ko: '누군가는 지금 사람을 찾고 있습니다.', en: 'Someone is looking for people right now.', es: 'Alguien está buscando gente ahora mismo.'},
    },
    {
        top: {ko: '날짜와 장소만 정하면 됩니다.', en: 'A date and a place — that’s all it takes.', es: 'Una fecha y un sitio: no hace falta más.'},
        bottom: {ko: '모임 만들기는 30초면 끝납니다.', en: 'Posting a meetup takes thirty seconds.', es: 'Crear una quedada lleva treinta segundos.'},
    },

    {
        top: {ko: '밥, 커피, 공놀이, 영화.', en: 'Meals, coffee, ball games, movies.', es: 'Comidas, cafés, partidos, cine.'},
        bottom: {ko: '핑계는 뭐든 좋습니다.', en: 'Any excuse works.', es: 'Cualquier excusa vale.'},
    },
    {
        top: {ko: '주말은 금방 지나갑니다.', en: 'The weekend goes fast.', es: 'El fin de semana se va volando.'},
        bottom: {ko: '미리 잡아두면 안 놓칩니다.', en: 'Lock it in and you won’t miss it.', es: 'Ciérralo y no se te escapa.'},
    },
    {
        top: {ko: '아는 얼굴이 늘어갑니다.', en: 'More familiar faces every week.', es: 'Cada semana, más caras conocidas.'},
        bottom: {ko: '한 번 같이 놀면 친구가 됩니다.', en: 'One meetup and you’re friends.', es: 'Una quedada y ya sois amigos.'},
    },
    {
        top: {ko: '두 명이어도 모임입니다.', en: 'Two people is a meetup.', es: 'Con dos ya es una quedada.'},
        bottom: {ko: '많이 모여야 하는 건 아닙니다.', en: 'It doesn’t have to be a crowd.', es: 'No hace falta ser multitud.'},
    },

    {
        top: {ko: '먼저 열면 사람이 모입니다.', en: 'Open one and people show up.', es: 'Ábrela y la gente aparece.'},
        bottom: {ko: '한 명이 시작해야 시작됩니다.', en: 'Someone has to go first.', es: 'Alguien tiene que dar el primer paso.'},
    },
    {
        top: {ko: '혼자 하면 운동, 같이 하면 약속.', en: 'Alone it’s exercise. Together it’s plans.', es: 'Solo es ejercicio. Juntos son planes.'},
        bottom: {ko: '약속이 있어야 나가게 됩니다.', en: 'Plans are what get you out the door.', es: 'Los planes son los que te sacan de casa.'},
    },
    {
        top: {ko: '이번 주에 한 번은 만납시다.', en: 'Let’s meet at least once this week.', es: 'Quedemos al menos una vez esta semana.'},
        bottom: {ko: '달력에 하나만 있어도 한 주가 다릅니다.', en: 'One thing on the calendar changes the week.', es: 'Una cosa en el calendario te cambia la semana.'},
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
/**
 * 시즌 테마일 때 대신 도는 줄.
 *
 * 목록을 통째로 갈아 끼운다 — 기본 문구에 몇 개를 섞으면 봄 테마를 켜 놓고도 열흘에
 * 한 번만 봄 문구가 나온다. 그러면 테마를 켠 티가 안 난다.
 *
 * 도는 방식은 같다. 날짜로 골라서 같은 날 열면 누구나 같은 줄을 본다.
 */
const SEASON_STATEMENTS: Record<string, Statement[]> = {
    cherryblossom: [
        {
            top: {ko: '꽃은 오래 안 갑니다.', en: 'The blossoms don’t last.', es: 'Las flores no duran.'},
            bottom: {ko: '이번 주말에 보러 가요.', en: 'Let’s go see them this weekend.', es: 'Vamos a verlas este finde.'},
        },
        {
            top: {ko: '날이 풀렸어요.', en: 'It’s warmed up.', es: 'Ha entrado el buen tiempo.'},
            bottom: {ko: '이제 밖에서 만나도 됩니다.', en: 'We can meet outside now.', es: 'Ya podemos quedar fuera.'},
        },
        {
            top: {ko: '겨우내 안 본 얼굴이 있죠.', en: 'Some faces you haven’t seen all winter.', es: 'Hay caras que no ves desde el invierno.'},
            bottom: {ko: '봄이니까 한 번 부르세요.', en: 'It’s spring — call them out.', es: 'Es primavera: escríbeles.'},
        },
        {
            top: {ko: '벚꽃 아래 자리 잡고,', en: 'Find a spot under the blossoms,', es: 'Busca un sitio bajo los cerezos,'},
            bottom: {ko: '아무거나 먹으면 됩니다.', en: 'and eat whatever you brought.', es: 'y come lo que sea.'},
        },
        {
            top: {ko: '오늘 안 나가면,', en: 'If you don’t go out today,', es: 'Si hoy no sales,'},
            bottom: {ko: '내년에 또 이 말을 합니다.', en: 'you’ll be saying this again next year.', es: 'volverás a decir esto el año que viene.'},
        },
    ],
    autumn: [
        {
            /* 벚꽃의 「꽃은 오래 안 갑니다」와 짝이다 — 아래 줄은 일부러 같은 말이다.
               봄에 지는 것과 가을에 지는 것이 같은 이유로 급하다 */
            top: {ko: '단풍은 기다려 주지 않습니다.', en: 'The colors won’t wait.', es: 'Los colores no esperan.'},
            bottom: {ko: '이번 주말에 보러 가요.', en: 'Let’s go see them this weekend.', es: 'Vamos a verlos este finde.'},
        },
        {
            top: {ko: '낮이 짧아지고 있어요.', en: 'The days are getting shorter.', es: 'Los días se acortan.'},
            bottom: {ko: '약속은 미리 잡는 게 좋겠죠.', en: 'Worth making plans early.', es: 'Mejor quedar con tiempo.'},
        },
        {
            top: {ko: '선선할 때 안 나가면', en: 'If you don’t go out while it’s cool,', es: 'Si no sales ahora que refresca,'},
            bottom: {ko: '곧 추워서 못 나갑니다.', en: 'soon it’ll be too cold to.', es: 'pronto hará demasiado frío.'},
        },
        {
            top: {ko: '밖이 제일 예쁠 때입니다.', en: 'Everything out there is at its best.', es: 'Ahí fuera todo está en su mejor momento.'},
            bottom: {ko: '사진은 같이 찍어야 남아요.', en: 'Photos last when someone else is in them.', es: 'Las fotos duran si sale alguien más.'},
        },
        {
            top: {ko: '가을은 짧습니다.', en: 'Autumn is short.', es: 'El otoño es corto.'},
            bottom: {ko: '핑계 댈 시간도 짧아요.', en: 'So is the time for excuses.', es: 'El tiempo para excusas, también.'},
        },
    ],
    winter: [
        {
            top: {ko: '눈 온다고 미루면,', en: 'Put it off because of the snow,', es: 'Si lo aplazas por la nieve,'},
            bottom: {ko: '봄에나 만납니다.', en: 'and you’ll meet in spring.', es: 'os veréis en primavera.'},
        },
        {
            top: {ko: '밖이 추울수록', en: 'The colder it is out there,', es: 'Cuanto más frío hace fuera,'},
            bottom: {ko: '안이 따뜻합니다.', en: 'the warmer it is in here.', es: 'más calienta estar dentro.'},
        },
        {
            top: {ko: '해가 일찍 집니다.', en: 'The sun goes down early.', es: 'Anochece pronto.'},
            bottom: {ko: '그만큼 저녁이 길어요.', en: 'Which makes the evening long.', es: 'Lo que alarga la tarde.'},
        },
        {
            top: {ko: '겨울엔 약속이 줄죠.', en: 'Plans thin out in winter.', es: 'En invierno los planes escasean.'},
            bottom: {ko: '그래서 먼저 부르는 겁니다.', en: 'That’s exactly why you ask first.', es: 'Por eso escribes tú primero.'},
        },
        {
            /* 장마의 「우산 하나면 됩니다」와 짝이다 — 계절만 바뀌고 하는 말은 같다 */
            top: {ko: '두꺼운 옷 하나면 됩니다.', en: 'One warm coat is enough.', es: 'Con un buen abrigo basta.'},
            bottom: {ko: '나머지는 여기서 정해요.', en: 'The rest gets decided here.', es: 'Lo demás se decide aquí.'},
        },
    ],
    rainyseason: [
        {
            top: {ko: '비 온다고 취소하지 않아요.', en: 'Rain isn’t a cancellation.', es: 'La lluvia no cancela nada.'},
            bottom: {ko: '지붕 있는 데로 옮기면 됩니다.', en: 'We just move somewhere with a roof.', es: 'Nos movemos a un sitio con techo.'},
        },
        {
            top: {ko: '창밖은 비,', en: 'Rain outside,', es: 'Fuera llueve,'},
            bottom: {ko: '안에는 사람.', en: 'people inside.', es: 'dentro hay gente.'},
        },
        {
            top: {ko: '장마엔 집에 있기 쉽죠.', en: 'It’s easy to stay in during the rains.', es: 'En temporada de lluvias es fácil quedarse en casa.'},
            bottom: {ko: '그래서 더 부르는 겁니다.', en: 'That’s exactly why we ask.', es: 'Por eso justamente escribimos.'},
        },
        {
            top: {ko: '우산 하나면 됩니다.', en: 'One umbrella is enough.', es: 'Con un paraguas basta.'},
            bottom: {ko: '나머지는 여기서 정해요.', en: 'The rest gets decided here.', es: 'Lo demás se decide aquí.'},
        },
        {
            top: {ko: '빗소리 들으며 뭐 하죠?', en: 'What do you do with rain in the background?', es: '¿Qué haces con la lluvia de fondo?'},
            bottom: {ko: '커피든 영화든, 같이요.', en: 'Coffee, a film — together.', es: 'Café o peli, pero juntos.'},
        },
    ],
};

/**
 * 그날의 문구.
 *
 * 날짜를 세어 고른다 — 무작위가 아니라서 같은 날 열면 누구나 같은 줄을 보고,
 * 화면을 다시 그려도 문구가 바뀌지 않는다.
 *
 * 시즌 테마면 그쪽 목록에서 고른다. 기준 날짜(ANCHOR)는 같이 쓴다 — 목록 길이가
 * 달라서 어차피 다른 줄이 나오고, 기준을 따로 두면 테마를 껐다 켤 때마다 순서가 튄다.
 */
export function statementOfDay(today: string, theme?: string): Statement {
    const list = (theme && SEASON_STATEMENTS[theme]) || STATEMENTS;
    const n = list.length;
    const i = (((dayNumber(today) - dayNumber(ANCHOR)) % n) + n) % n;
    return list[i]!;
}

/**
 * 머리 제목 아래 한 줄 — 계절마다 재는 것이 다르다.
 *
 * 봄은 개화율, 여름은 강수, 가을은 단풍, 겨울은 기온이다. 눈금선은 값만큼 차서
 * (fill) 숫자를 안 읽어도 어느 쯤인지 보인다. 겨울만 퍼센트가 아니라 온도라
 * 채울 값이 없고, 대신 체감을 sub로 옆에 붙인다.
 *
 * **여름과 겨울은 실제 날씨다** (lib/weather.ts의 Open-Meteo). 아래 숫자는 날씨를 못
 * 받아 왔을 때 쓰는 값이다 — 값이 없다고 줄이 사라지면 그게 더 이상하다.
 *
 * 봄(개화)과 가을(단풍)은 고정값이다. 퍼센트를 주는 데가 없어서 적산온도로 세거나
 * 주마다 여기를 손으로 고쳐야 한다. 주 단위로 움직이는 값이라 그래도 된다.
 */
export interface SeasonStat {
    label: Msg;
    /** 겨울의 「체감 -14°」 — 있으면 라벨 옆에 한 단계 진하게 붙는다 */
    sub?: Msg;
    /** 눈금선이 차는 정도. 겨울은 온도라 채우지 않는다 */
    fill: string;
}

const SEASON_STATS: Record<'petal' | 'rain' | 'leaf' | 'snow', SeasonStat> = {
    petal: {
        label: {ko: '개화 90%', en: 'BLOOM 90%', es: 'FLORACIÓN 90%'},
        fill: '90%',
    },
    rain: {
        label: {ko: '강수 80% 습도 88%', en: 'RAIN 80% HUMIDITY 88%', es: 'LLUVIA 80% HUMEDAD 88%'},
        fill: '80%',
    },
    leaf: {
        label: {ko: '단풍 60%', en: 'FOLIAGE 60%', es: 'FOLLAJE 60%'},
        fill: '60%',
    },
    snow: {
        label: {ko: '-8°', en: '-8°', es: '-8°'},
        sub: {ko: '체감 -14°', en: 'FEELS -14°', es: 'SENSACIÓN -14°'},
        fill: '100%',
    },
};

/**
 * 단풍이 제일 짙은 날 — 캔자스는 10월 하순이다.
 *
 * 날짜 하나라 API가 필요 없다. 해마다 며칠씩 다르지만 상태줄이 받을 정밀도가 아니다 —
 * 「이제 곧」인지 「지났는지」만 말하면 된다.
 */
const LEAF_PEAK = {month: 10, day: 25};

/** 눈금이 차기 시작하는 시점 — 이만큼 남았을 때부터 채운다 */
const LEAF_RUNUP_DAYS = 60;
/** 지나고 나서 D+로 세는 기간. 넘으면 내년 것을 센다 */
const LEAF_AFTER_DAYS = 30;

const DAY_MS = 86400000;

/**
 * 단풍 D-day.
 *
 * 지나고 30일까지는 D+로 세고(막 지난 것은 지났다고 말해야 한다), 그 뒤로는 내년
 * 것을 센다 — 3월에 「D+130」은 아무 말도 아니다.
 */
function leafDday(today: string): SeasonStat {
    const [y, m, d] = today.split('-').map(Number);
    const now = Date.UTC(y!, m! - 1, d!);
    const peakOf = (year: number) => Date.UTC(year, LEAF_PEAK.month - 1, LEAF_PEAK.day);
    let left = Math.round((peakOf(y!) - now) / DAY_MS);
    if (left < -LEAF_AFTER_DAYS) left = Math.round((peakOf(y! + 1) - now) / DAY_MS);

    const label = (word: string, today_: string) =>
        left === 0 ? `${word} ${today_}` : left > 0 ? `${word} D-${left}` : `${word} D+${-left}`;
    return {
        label: {
            ko: label('단풍', 'D-DAY'),
            en: label('FOLIAGE', 'TODAY'),
            es: label('FOLLAJE', 'HOY'),
        },
        /* 남은 날이 줄수록 찬다. 지나고 나면 가득 — 단풍이 든 것이다 */
        fill: `${Math.max(0, Math.min(100, Math.round(((LEAF_RUNUP_DAYS - left) / LEAF_RUNUP_DAYS) * 100)))}%`,
    };
}

/**
 * 시즌 테마가 아니면 없다 — 그때는 이 줄을 아예 안 그린다.
 *
 * 계절마다 값이 오는 데가 다르다:
 *   여름·겨울  날씨 (w). 못 받아 왔으면 위 고정값 그대로다 — 상태줄은 장식이라
 *              값이 없다고 줄이 사라지면 그게 더 이상하다.
 *   가을       날짜만으로 센다 (leafDday). 부를 데가 없다.
 *   봄         아직 고정값이다.
 */
export function seasonStat(
    kind: 'petal' | 'rain' | 'leaf' | 'snow' | null,
    today: string,
    w?: Weather | null
): SeasonStat | null {
    const base = kind ? SEASON_STATS[kind] : null;
    if (!base) return null;
    if (kind === 'leaf') return leafDday(today);
    if (!w) return base;
    /* 소수점은 안 보인다 — 10px 글씨에 「-8.3°」는 읽는 값이 아니라 얼룩이다 */
    const n = (v: number) => Math.round(v);
    if (kind === 'snow') {
        return {
            label: {ko: `${n(w.temp)}°`, en: `${n(w.temp)}°`, es: `${n(w.temp)}°`},
            sub: {
                ko: `체감 ${n(w.feels)}°`,
                en: `FEELS ${n(w.feels)}°`,
                es: `SENSACIÓN ${n(w.feels)}°`,
            },
            fill: base.fill,
        };
    }
    if (kind === 'rain') {
        return {
            label: {
                ko: `강수 ${n(w.rain)}% 습도 ${n(w.humidity)}%`,
                en: `RAIN ${n(w.rain)}% HUMIDITY ${n(w.humidity)}%`,
                es: `LLUVIA ${n(w.rain)}% HUMEDAD ${n(w.humidity)}%`,
            },
            /* 눈금은 강수 확률을 따른다 — 둘 중 「오늘 어떤가」에 가까운 쪽이다 */
            fill: `${Math.max(0, Math.min(100, n(w.rain)))}%`,
        };
    }
    return base;
}
