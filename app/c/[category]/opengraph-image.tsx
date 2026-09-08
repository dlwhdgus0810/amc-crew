import { ImageResponse } from 'next/og';
import { catName, getCategory } from '@/lib/categories';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { OG_SIZE, loadFonts } from '@/lib/og';
import { getRegion } from '@/lib/region-server';
import { REGIONS } from '@/lib/region';

/** 카테고리 링크를 붙였을 때 뜨는 미리보기 — 앱의 카테고리 카드 그대로 */

export const alt = 'category';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const runtime = 'nodejs';

const T = {
  cta: { ko: '같이 놀 사람 찾기', en: 'Find people to join', es: 'Encuentra con quién ir' },
};

export default async function Image({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const [locale, region] = await Promise.all([getLocale(), getRegion()]);
  const cat = getCategory(category);
  const appName = REGIONS[region].name;

  const bg = cat?.color ?? '#101010';
  const fg = cat?.fg ?? '#F6F4EE';
  const label = cat?.en ?? appName.toUpperCase();
  const heading = cat ? `${catName(category, locale)} ${cat.emoji}` : appName;
  const desc = cat ? pick(locale, cat.description) : '';
  const cta = pick(locale, T.cta);

  const fonts = await loadFonts(`${heading}${desc}${label}${cta}${appName}`);

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
          <div style={{ fontSize: 100, fontWeight: 700, letterSpacing: -2 }}>{heading}</div>
          <div style={{ fontSize: 44, opacity: 0.9 }}>{desc}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ width: '100%', height: 2, background: fg, opacity: 0.25 }} />
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 38 }}>
            <span style={{ opacity: 0.85 }}>{cta}</span>
            <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{appName}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length > 0 ? fonts : undefined }
  );
}
