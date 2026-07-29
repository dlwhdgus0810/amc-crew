'use client';

import { isMappable, mapsUrl } from '@/lib/maps';
import { useT } from './i18n';

const T = {
  openMap: { ko: '{place} — 지도에서 열기', en: '{place} — open in Maps' },
};

const PinIcon = () => (
  <svg
    className="place-pin"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

/**
 * 모임 장소 — 누르면 지도 검색으로 넘어간다 (폰에서는 지도 앱이 받아간다).
 * "우리집"처럼 검색해도 소용없는 장소는 그냥 글자로 둔다.
 */
export default function PlaceLink({ location }: { location: string }) {
  const t = useT();
  if (!isMappable(location)) return <>{location}</>;

  return (
    <a
      className="place-link"
      href={mapsUrl(location)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t(T.openMap, { place: location })}
    >
      {location}
      <PinIcon />
    </a>
  );
}
