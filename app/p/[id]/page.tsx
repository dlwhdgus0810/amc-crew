import type { Metadata } from 'next';
import { getPostView } from '@/lib/db/posts';
import { catName } from '@/lib/categories';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { dateLabelShort, timeLabel } from '@/lib/datefmt';
import PostClient from './post-client';

export const dynamic = 'force-dynamic';

const T = {
  notFound: { ko: '모임을 찾을 수 없어요 — Kansas Korean', en: 'Meetup not found — Kansas Korean' },
  title: { ko: '{cat} 모임{title} · {when}', en: '{cat} meetup{title} · {when}' },
  director: { ko: '감독 {name}', en: 'Dir. {name}' },
  joined: { ko: '{n}명 참여 중', en: '{n} joined' },
  capacity: { ko: ' (정원 {n}명)', en: ' (capacity {n})' },
  cta: { ko: ' — 링크를 눌러 바로 참가하세요', en: ' — tap the link to join' },
};

// 카카오톡 등에 공유했을 때 미리보기(OG)용 메타데이터
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [post, locale] = await Promise.all([getPostView(id), getLocale()]);
  if (!post) return { title: pick(locale, T.notFound) };

  const title = pick(locale, T.title, {
    cat: catName(post.category, locale),
    title: post.title ? ` 〈${post.title}〉` : '',
    when: `${dateLabelShort(post.date, locale)} ${timeLabel(post.startTime, locale)}`,
  });
  const metaPart = post.titleMeta
    ? [
        post.titleMeta.rating ? `★ ${post.titleMeta.rating.toFixed(1)}` : null,
        post.titleMeta.director ? pick(locale, T.director, { name: post.titleMeta.director }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const description = `${metaPart ? `${metaPart} · ` : ''}${post.location} · ${pick(locale, T.joined, {
    n: post.participants.length,
  })}${post.capacity != null ? pick(locale, T.capacity, { n: post.capacity }) : ''}${pick(locale, T.cta)}`;
  return {
    title: `${title} — Kansas Korean`,
    description,
    openGraph: { title, description },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostClient id={id} />;
}
