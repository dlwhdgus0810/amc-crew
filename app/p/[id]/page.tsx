import type { Metadata } from 'next';
import { getPostView } from '@/lib/db/posts';
import { getCategory } from '@/lib/categories';
import PostClient from './post-client';

export const dynamic = 'force-dynamic';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function describeWhen(date: string, startTime: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const [h, min] = startTime.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${m}/${d}(${wd}) ${ampm} ${h12}:${String(min).padStart(2, '0')}`;
}

// 카카오톡 등에 공유했을 때 미리보기(OG)용 메타데이터
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostView(id);
  if (!post) return { title: '모임을 찾을 수 없어요 — Kansas Korean' };

  const cat = getCategory(post.category);
  const titlePart = post.title ? ` 〈${post.title}〉` : '';
  const title = `${cat?.name ?? post.category} 모임${titlePart} · ${describeWhen(post.date, post.startTime)}`;
  const metaPart = post.titleMeta
    ? [
        post.titleMeta.rating ? `★ ${post.titleMeta.rating.toFixed(1)}` : null,
        post.titleMeta.director ? `감독 ${post.titleMeta.director}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const description = `${metaPart ? `${metaPart} · ` : ''}${post.location} · ${post.participants.length}명 참여 중${
    post.capacity != null ? ` (정원 ${post.capacity}명)` : ''
  } — 링크를 눌러 바로 참가하세요`;
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
