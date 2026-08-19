'use client';

/* ============================================================
   app/nav.tsx 를 이 파일로 교체하세요.
   2a 플로팅 아일랜드: 좌우 14px 떠 있는 캡슐 안에
   홈 · 둘러보기 · 알림 · 프로필 + ＋(모임 만들기).
   AMC의 회차/그룹과 관리자는 문맥 탭(ContextTabs)으로 내립니다.
   ============================================================ */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useRefreshSession, useViewer } from './session';
import { useT } from './i18n';

/** 프로필이 바뀌었음을 탭바에 알리는 신호 */
export const PROFILE_UPDATED = 'kk-profile-updated';

/*
 * 탭바는 스페인어를 먼저 채웠다 — 언어를 바꿨을 때 제일 먼저, 그리고 어느 화면에서나
 * 보이는 글자라 여기가 비어 있으면 「바뀌긴 한 건가」 싶어진다.
 * 나머지 화면은 아직 영어로 떨어진다 (lib/i18n.ts의 pick).
 */
const T = {
  home: { ko: '홈', en: 'Home', es: 'Inicio' },
  categories: { ko: '둘러보기', en: 'Browse', es: 'Explorar' },
  calendar: { ko: '캘린더', en: 'Calendar', es: 'Calendario' },
  // 탭바에서는 내렸고(프로필 안으로), 문맥 탭에서만 쓴다
  tickets: { ko: '건의함', en: 'Suggestions', es: 'Sugerencias' },
  movienight: { ko: '무비나잇', en: 'Movie Night', es: 'Noche de cine' },
  showtimes: { ko: '회차 고르기', en: 'Showtimes', es: 'Funciones' },
  groups: { ko: '그룹', en: 'Groups', es: 'Grupos' },
  profile: { ko: '프로필', en: 'Profile', es: 'Perfil' },
  admin: { ko: '관리자', en: 'Admin', es: 'Admin' },
  // 탭바에서는 내렸고(프로필 안으로), 프로필 줄과 문맥에서만 쓴다
  notifications: { ko: '알림', en: 'Alerts', es: 'Avisos' },
  /** 새 탭 — 모임이 끝난 뒤에 남는 것들 (사진·후기) */
  keep: { ko: '모아보기', en: 'Keepsakes', es: 'Recuerdos' },
  photos: { ko: '사진', en: 'Photos', es: 'Fotos' },
  reviews: { ko: '후기', en: 'Reviews', es: 'Reseñas' },
  create: { ko: '모임 만들기', en: 'New meetup', es: 'Crear quedada' },
};

/* 20px 라인 아이콘 — 굵기 1.8로 통일. 시즌 테마에서는 --icon-stroke가 이긴다
   (속성이 아니라 style이어야 CSS 변수를 받는다 — app/cat-icon.tsx와 같은 이유) */
const icon = { className: 't-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, style: { strokeWidth: 'var(--icon-stroke, 1.8)' }, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const HomeIcon = () => (
  <svg {...icon} aria-hidden>
    <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
const BrowseIcon = () => (
  <svg {...icon} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="m15 9-2.4 5.6L7 17l2.4-5.6z" />
  </svg>
);
const CalendarIcon = () => (
  <svg {...icon} aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
const BellIcon = () => (
  <svg {...icon} aria-hidden>
    <path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 3h15z" />
    <path d="M10 21h4" />
  </svg>
);
/** 모아보기 — 겹쳐 놓은 사진 두 장 (사진과 후기를 함께 아우르는 자리) */
const KeepIcon = () => (
  <svg {...icon} aria-hidden>
    <rect x="7" y="3.5" width="14" height="11" rx="2" />
    <path d="m10 12 3-3 3 3 2-2" />
    <path d="M17 17.5v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1" />
  </svg>
);

/** 로그인 상태·안 읽은 알림 수 — 세션은 레이아웃이 서버에서 읽어 둔 것을 쓴다 */
function useSession() {
  const pathname = usePathname();
  const router = useRouter();
  const viewer = useViewer();
  const refresh = useRefreshSession();
  const isAdmin = viewer.isAdmin;
  const loggedIn = Boolean(viewer.user);
  const name = viewer.user?.name ?? '';
  const avatar = viewer.avatar;
  /*
   * 안 읽은 수는 서버가 읽어 둔 값에서 시작해, 탭을 옮길 때마다 다시 센다.
   * 레이아웃은 클라이언트 내비게이션에서 다시 그려지지 않아서 배지가 멈춰 있게 된다.
   */
  const [unread, setUnread] = useState(viewer.unread);
  const seeded = useRef(pathname);

  useEffect(() => {
    // 프로필에서 사진·닉네임을 바꾸면 화면을 옮기지 않아도 탭바가 따라오도록
    const onProfile = () => refresh();
    window.addEventListener(PROFILE_UPDATED, onProfile);
    return () => window.removeEventListener(PROFILE_UPDATED, onProfile);
  }, [refresh]);

  useEffect(() => {
    if (loggedIn && viewer.needsOnboarding && pathname !== '/welcome') {
      // 온보딩 후 원래 보던 페이지(공유 링크 등)로 복귀할 수 있게 경로를 넘긴다
      router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
    }
  }, [loggedIn, viewer.needsOnboarding, pathname, router]);

  useEffect(() => {
    // 처음 그린 경로의 값은 서버에서 이미 받아 왔다 — 그때는 한 번 건너뛴다
    if (seeded.current === pathname) {
      seeded.current = '';
      return;
    }
    fetch('/api/notifications/count')
      .then((r) => r.json())
      .then((data) => setUnread(data.unreadCount ?? 0))
      .catch(() => {});
  }, [pathname]);

  /*
   * 홈 화면 아이콘의 숫자 뱃지.
   *
   * 앱이 닫혀 있는 동안에는 서비스 워커가 푸시를 받으며 올려 준다(public/sw.js).
   * 여기서는 앱을 열었을 때 실제 안 읽은 수로 다시 맞춘다 — 다른 기기에서 읽었거나
   * 알림 탭에 들어가 읽음 처리된 경우를 워커는 알 수 없다.
   */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    // 실패는 삼킨다 — 설치 전이거나 알림 권한이 없으면 거부되는데, 고칠 수 있는 문제가 아니다
    const done = unread > 0 ? nav.setAppBadge?.(unread) : nav.clearAppBadge?.();
    done?.catch(() => {});
  }, [unread, loggedIn]);

  return { isAdmin, loggedIn, name, avatar, unread, pathname };
}

/**
 * 모아보기 탭의 NEW 딱지 — **날짜로만 끊는다. 8월 16일까지 모두에게 붙어 있는다.**
 *
 * 처음에는 「한 번 들어가 보면 사라진다」로 했다가 되돌렸다. 사람마다 맞는 대신
 * 올린 쪽에서 지금 딱지가 붙어 있는지를 알 수 없고(자기 기기에서는 이미 사라진다),
 * 새 화면을 알리는 사흘 동안은 눌러 본 사람에게 한 번 더 보여도 손해가 없다.
 *
 * 끝나는 날을 코드에 적어 두는 것은 일부러다. 이 딱지는 사흘 뒤에 지워야 하는
 * 임시 표시라, 지우는 것을 기억에 맡기지 않고 날짜가 대신 지우게 한다.
 *
 * 첫 그림에서는 늘 안 보인다. 서버 시계와 브라우저 시계가 자정 언저리에서 하루씩
 * 어긋날 수 있어서, 켜 둔 채로 그리면 서버와 브라우저의 첫 그림이 달라진다
 * (하이드레이션이 깨진다). 그려진 뒤에 브라우저 시계로 정한다.
 */
const KEEP_NEW_UNTIL = '2026-08-16';

function useKeepNew(): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(new Date().toISOString().slice(0, 10) <= KEEP_NEW_UNTIL);
  }, []);

  return show;
}

/** 떠 있는 하단 탭바 — 좁은 폰에서도 줄바꿈되지 않고, 콘텐츠 위에 얹힌다 */
export default function NavLinks() {
  const { loggedIn, name, avatar, unread, pathname } = useSession();
  const showKeepNew = useKeepNew();
  const t = useT();

  return (
    <nav className="tabbar">
      <span className="tabbar-links">
        <Link href="/" className={pathname === '/' ? 'active' : ''}>
          <HomeIcon />
          <span>{t(T.home)}</span>
        </Link>
        <Link href="/categories" className={pathname.startsWith('/categories') ? 'active' : ''}>
          <BrowseIcon />
          <span>{t(T.categories)}</span>
        </Link>
        <Link href="/calendar" className={pathname.startsWith('/calendar') ? 'active' : ''}>
          <CalendarIcon />
          <span>{t(T.calendar)}</span>
        </Link>
        {/*
          * 알림이 있던 자리 — 알림은 프로필 안으로 들어갔다.
          * 알림은 왔을 때만 보는 화면이라 늘 한 칸을 차지할 이유가 약했고,
          * 그 자리를 모임이 끝난 뒤에 남는 것들(사진·후기)에 준다.
          */}
        <Link
          href="/photos"
          className={pathname.startsWith('/photos') || pathname.startsWith('/reviews') ? 'active' : ''}
        >
          <KeepIcon />
          <span>{t(T.keep)}</span>
          {showKeepNew && <span className="tab-new">NEW</span>}
        </Link>
        {loggedIn ? (
          <Link href="/profile" className={pathname === '/profile' ? 'active' : ''}>
            <span className="t-ava">
              {avatar ? <img src={avatar} alt="" /> : name.slice(0, 1) || '·'}
            </span>
            <span>{t(T.profile)}</span>
            {/*
              * 안 읽은 알림이 있다는 표시. 숫자가 아니라 점 하나다 — 알림함이 프로필
              * 안으로 들어갔으니 몇 개인지는 거기서 보면 되고, 여기서는 「볼 게 있다」만
              * 말하면 된다. 이게 없으면 새 알림을 알 길이 앱 아이콘 뱃지밖에 없다.
              */}
            {unread > 0 && <span className="tab-dot" aria-hidden="true" />}
          </Link>
        ) : (
          <a href="/api/auth/login">
            <span className="t-ava">·</span>
            <span>{t(T.profile)}</span>
          </a>
        )}
      </span>
    </nav>
  );
}

/** 화면 안 문맥 탭 — AMC의 회차/그룹, 관리자 진입 */
export function ContextTabs() {
  /*
   * useSession()이 아니라 컨텍스트를 바로 읽는다 — 여기서 필요한 건 isAdmin뿐인데
   * useSession을 부르면 안 읽은 알림 수까지 따라와서 경로마다 조회가 두 번씩 나갔다.
   */
  const { isAdmin } = useViewer();
  const pathname = usePathname();
  const t = useT();

  const links: { href: string; label: string }[] = [];
  if (pathname.startsWith('/movie')) {
    links.push(
      // AMC는 무비나잇 안의 도구라, 돌아갈 자리를 첫 칸에 둔다
      { href: '/c/movienight', label: t(T.movienight) },
      { href: '/movie', label: t(T.showtimes) },
      { href: '/movie/groups', label: t(T.groups) }
    );
  }
  /*
   * 모아보기 — 사진과 후기를 알약 줄로 갈라 둔다. 탭은 한 칸이고, 주소는 따로다.
   * 둘 다 「모임이 끝난 뒤에 남는 것」이라 한 자리에 두되, 보고 싶은 쪽만 볼 수 있어야 한다.
   */
  if (pathname.startsWith('/photos') || pathname.startsWith('/reviews')) {
    links.push({ href: '/photos', label: t(T.photos) }, { href: '/reviews', label: t(T.reviews) });
  }
  if (pathname.startsWith('/tickets')) links.push({ href: '/tickets', label: t(T.tickets) });
  // 관리자 진입은 프로필 화면에만 둔다 — 모든 화면 위에 띄울 만한 버튼이 아니다
  if (isAdmin && pathname.startsWith('/admin')) links.push({ href: '/admin', label: t(T.admin) });
  if (links.length === 0) return null;

  return (
    <div className="segbar">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
