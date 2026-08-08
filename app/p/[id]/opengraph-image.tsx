import { ImageResponse } from 'next/og';
import { getPostView } from '@/lib/db/posts';
import { catName, getCategory } from '@/lib/categories';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { whenLabelShort } from '@/lib/datefmt';
import { OG_SIZE, loadFonts } from '@/lib/og';

/*
 * 모임 링크를 붙였을 때 뜨는 미리보기 카드.
 * 앱 안의 카테고리 카드와 같은 모양이라, 링크만 봐도 무슨 모임인지 색으로 먼저 안다.
 */

export const alt = 'Kansas Korean';
export const size = OG_SIZE;
export const contentType = 'image/png';
// PGlite(로컬 폴백)는 edge에서 못 돌아간다 — 조회가 들어가는 이미지는 node에서 그린다
export const runtime = 'nodejs';

const T = {
  people: { ko: '{n}명 참여 중', en: '{n} joined', es: '{n} apuntados' },
  cap: { ko: '{n}/{cap}명', en: '{n}/{cap}', es: '{n}/{cap}' },
  notFound: { ko: '지난 모임이거나 없는 링크예요', en: 'This meetup is gone', es: 'Esta quedada ya no existe' },
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, locale] = await Promise.all([getPostView(id), getLocale()]);
  const cat = post ? getCategory(post.category) : undefined;

  const bg = cat?.color ?? '#101010';
  const fg = cat?.fg ?? '#F6F4EE';
  const label = cat?.en ?? 'KANSAS KOREAN';
  const heading = post ? `${catName(post.category, locale)} ${cat?.emoji ?? ''}` : 'Kansas Korean';
  const when = post ? whenLabelShort(post.date, post.startTime, locale) : '';
  const where = post?.location ?? pick(locale, T.notFound);
  const title = post?.title ? `〈${post.title}〉` : '';
  const count = post
    ? post.capacity != null
      ? pick(locale, T.cap, { n: post.participantCount, cap: post.capacity })
      : pick(locale, T.people, { n: post.participantCount })
    : '';

  const fonts = await loadFonts(`${heading}${when}${where}${title}${count}${label}Kansas Korean`);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: bg,
          color: fg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          fontFamily: 'IBM Plex Sans KR',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 30, letterSpacing: 8, opacity: 0.75 }}>{label}</div>
          <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -2 }}>{heading}</div>
          {title && <div style={{ fontSize: 44, opacity: 0.9 }}>{title}</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 카드 아래쪽 가로줄 — 앱의 카테고리 카드와 같은 자리 */}
          <div style={{ width: '100%', height: 2, background: fg, opacity: 0.25 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 40 }}>
            {when && <span style={{ fontWeight: 700 }}>{when}</span>}
            <span style={{ opacity: 0.85 }}>{where}</span>
            {count && <span style={{ marginLeft: 'auto', opacity: 0.85 }}>{count}</span>}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length > 0 ? fonts : undefined }
  );
}
