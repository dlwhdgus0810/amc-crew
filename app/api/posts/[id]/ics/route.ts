import { NextRequest, NextResponse } from 'next/server';
import { getPostView } from '@/lib/db/posts';
import { catName, getCategory } from '@/lib/categories';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';

const T = {
  notFound: { ko: '포스트를 찾을 수 없어요.', en: 'Meetup not found.' },
  summary: { ko: '{emoji} {cat}{title} 모임', en: '{emoji} {cat}{title} meetup' },
  page: { ko: '모임 페이지: {url}', en: 'Meetup page: {url}' },
};

export const dynamic = 'force-dynamic';

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function compact(date: string, time: string): string {
  // 2026-08-22 + 19:30 -> 20260822T193000 (floating local time — 참가자 모두 같은 지역이라 충분)
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

/** 모임을 캘린더 이벤트(.ics)로 다운로드 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, locale] = await Promise.all([getPostView(id), getLocale()]);
  if (!post) {
    return NextResponse.json({ error: pick(locale, T.notFound) }, { status: 404 });
  }

  const summary = pick(locale, T.summary, {
    emoji: getCategory(post.category)?.emoji ?? '',
    cat: catName(post.category, locale),
    title: post.title ? ` 〈${post.title}〉` : '',
  });
  const detailUrl = `${req.nextUrl.origin}/p/${post.id}`;
  const description = [post.description, pick(locale, T.page, { url: detailUrl })]
    .filter(Boolean)
    .join('\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kansas Korean//meetup//KO',
    'BEGIN:VEVENT',
    // UID는 캘린더가 같은 일정으로 인식하는 열쇠라 이름을 바꿔도 그대로 둔다
    // (바꾸면 이미 등록한 사람이 다시 받을 때 중복 일정이 생긴다)
    `UID:${post.id}@odyssey-crew`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${compact(post.date, post.startTime)}`,
    `DTEND:${compact(post.date, post.endTime)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `LOCATION:${icsEscape(post.location)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `URL:${detailUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="meetup-${post.date}.ics"`,
    },
  });
}
