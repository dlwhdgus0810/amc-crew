'use client';

import { useState, type ReactNode } from 'react';
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
 *
 * 이름 고치기(onRename)도 마찬가지로 받아서 쓴다. 모아보기에서는 안 넘겨서 못 고친다 —
 * 거기에는 안 갔던 모임도 섞여 있고, 무엇보다 그 자리가 어느 모임 것인지도 안 준다.
 */

const T = {
  here: { ko: '지도', en: 'Map', es: 'Mapa' },
  name: { ko: '이름 붙이기', en: 'Name this', es: 'Poner nombre' },
  placeholder: { ko: '여기 어디였어요?', en: 'Where was this?', es: '¿Dónde fue esto?' },
  save: { ko: '저장', en: 'Save', es: 'Guardar' },
  cancel: { ko: '취소', en: 'Cancel', es: 'Cancelar' },
  saveFailed: { ko: '저장하지 못했어요.', en: 'Couldn’t save that.', es: 'No se pudo guardar.' },
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
  onRename,
}: {
  photos: P[];
  /** 있으면 이 근처 자리에는 이름 대신 「숙소」가 붙는다 */
  lodgingAt?: { lat: number; lon: number } | null;
  renderCell: (photo: P) => ReactNode;
  /**
   * 이름을 손으로 고칠 수 있으면 넘긴다 — 안 넘기면 읽기만 된다.
   *
   * 자리에는 이름표가 없어서 그 자리의 사진 id를 통째로 넘긴다. 빈 문자열이면 지우는 것이고,
   * 지우면 다음 백필이 다시 자동으로 붙인다 (app/api/posts/[id]/photos/place).
   */
  onRename?: (photoIds: string[], place: string) => Promise<void>;
}) {
  const t = useT();
  const locale = useLocale();
  const tl = buildTimeline(photos);
  /** 지금 고치고 있는 자리 (날짜+시각이 열쇠다 — 자리에는 id가 없다) */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(key: string, photoIds: string[]) {
    if (!onRename) return;
    setBusy(true);
    setError(null);
    try {
      await onRename(photoIds, draft);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t(T.saveFailed));
    } finally {
      setBusy(false);
    }
  }

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
            const key = `${day.date} ${stop.time}`;
            const ids = stop.photos.map((p) => p.id);
            return (
              <div key={key} className="tl-stop">
                <div className="tl-when">
                  <span className="tl-time">
                    {timeLabel(stop.time, locale)}
                    {stop.endTime !== stop.time && ` – ${timeLabel(stop.endTime, locale)}`}
                  </span>
                  {/*
                    * 이름을 고칠 수 있으면 눌러서 고친다. 「숙소」는 우리가 붙인 말이라
                    * 고치기 시작하면 그 자리의 진짜 이름(name)에서 시작한다.
                    */}
                  {onRename && editing !== key && (
                    <button
                      className={label ? 'tl-place tl-place-edit' : 'tl-name-btn'}
                      onClick={() => {
                        setEditing(key);
                        setDraft(name ?? '');
                        setError(null);
                      }}
                    >
                      {label ?? t(T.name)}
                    </button>
                  )}
                  {!onRename && label && <span className="tl-place">{label}</span>}
                  {editing !== key && stop.lat != null && stop.lon != null && (
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

                {editing === key && (
                  <div className="tl-edit">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={t(T.placeholder)}
                      maxLength={60}
                      autoFocus
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void save(key, ids);
                        if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                    <button className="secondary" disabled={busy} onClick={() => void save(key, ids)}>
                      {t(T.save)}
                    </button>
                    <button className="link-btn" disabled={busy} onClick={() => setEditing(null)}>
                      {t(T.cancel)}
                    </button>
                  </div>
                )}
                {editing === key && error && <div className="msg err">{error}</div>}

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
