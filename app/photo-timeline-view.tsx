'use client';

import type { ReactNode } from 'react';
import { useLocale, useT } from './i18n';
import { dateLabelShort, timeLabel } from '@/lib/datefmt';
import { mapsPointUrl } from '@/lib/maps';
import { buildTimeline, distanceMeters, type Stop, type TimelineInput } from '@/lib/photo-timeline';

/**
 * 사진을 찍은 순서로 늘어놓는 그림 — 모임 상세와 모아보기가 **같은 것**을 쓴다.
 *
 * 두 화면에 따로 그리면 하나만 고쳐 놓고 다른 하나를 잊는다. 자리를 나누는 규칙도
 * 「숙소」를 고르는 반경도 여기 한 벌만 있어야 한다.
 *
 * 사진 칸 자체는 안 그린다(renderCell). 상세는 지우기 버튼이 붙고 모아보기는 안 붙는데,
 * 그 차이까지 여기서 알 필요는 없다 — 이 파일이 아는 것은 「언제 어디서」뿐이다.
 */

const T = {
  here: { ko: '지도', en: 'Map', es: 'Mapa' },
  atLodging: { ko: '숙소', en: 'Where we stayed', es: 'Alojamiento' },
  undated: { ko: '시각을 모르는 사진', en: 'No time on these', es: 'Sin hora' },
};

/** 숙소로 볼 거리(m) — 주소를 좌표로 바꿀 때의 오차와 GPS가 튀는 폭을 합쳐 잡았다 */
const AT_LODGING_M = 200;

export interface TimelinePhoto extends TimelineInput {
  id: string;
  place?: string | null;
}

export default function PhotoTimelineView<P extends TimelinePhoto>({
  photos,
  lodgingAt,
  renderCell,
}: {
  photos: P[];
  /** 있으면 이 근처 자리에는 이름 대신 「숙소」가 붙는다 */
  lodgingAt?: { lat: number; lon: number } | null;
  renderCell: (photo: P) => ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  const tl = buildTimeline(photos);

  /** 사진에 적힌 이름 중 제일 많은 것. 가장자리 사진이 옆 가게 위에 떨어질 수 있어서 다수결이다 */
  function nameOf(stop: Stop<P>): string | null {
    const count = new Map<string, number>();
    for (const p of stop.photos) if (p.place) count.set(p.place, (count.get(p.place) ?? 0) + 1);
    let best: string | null = null;
    let most = 0;
    for (const [name, n] of count) if (n > most) [best, most] = [name, n];
    return best;
  }

  /** 숙소 근처인가 — 그렇다면 이름 대신 「숙소」라고 부른다 */
  function isLodging(stop: Stop<P>): boolean {
    if (!lodgingAt || stop.lat == null || stop.lon == null) return false;
    return distanceMeters(stop.lat, stop.lon, lodgingAt.lat, lodgingAt.lon) <= AT_LODGING_M;
  }

  return (
    <div className="tl">
      {tl.days.map((day) => (
        <section key={day.date} className="tl-day">
          <h3 className="tl-date">{dateLabelShort(day.date, locale)}</h3>
          {day.stops.map((stop) => {
            const name = nameOf(stop);
            /*
             * 보여 주는 이름과 지도에 넘기는 이름이 다르다. 화면에는 「숙소」가 낫지만,
             * 지도에 「숙소」를 검색시키면 엉뚱한 데가 나온다 — 거기엔 진짜 이름을 준다.
             */
            const label = isLodging(stop) ? t(T.atLodging) : name;
            return (
              <div key={`${day.date} ${stop.time}`} className="tl-stop">
                <div className="tl-when">
                  <span className="tl-time">
                    {timeLabel(stop.time, locale)}
                    {stop.endTime !== stop.time && ` – ${timeLabel(stop.endTime, locale)}`}
                  </span>
                  {label && <span className="tl-place">{label}</span>}
                  {stop.lat != null && stop.lon != null && (
                    <a
                      className="tl-map"
                      href={mapsPointUrl(stop.lat, stop.lon, name)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t(T.here)}
                    </a>
                  )}
                </div>
                <div className="photo-grid">{stop.photos.map(renderCell)}</div>
              </div>
            );
          })}
        </section>
      ))}

      {/* 시각을 모르는 사진도 사라지면 안 된다 — 스크린샷이거나 원본이 없는 것들이다 */}
      {tl.undated.length > 0 && (
        <section className="tl-day">
          <h3 className="tl-date">{t(T.undated)}</h3>
          <div className="photo-grid">{tl.undated.map(renderCell)}</div>
        </section>
      )}
    </div>
  );
}
