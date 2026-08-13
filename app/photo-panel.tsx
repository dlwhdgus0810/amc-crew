'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './i18n';
import { usePosterZoom, type Zoomed } from './poster-zoom';
import { UnreadableImageError, uploadPhoto } from '@/lib/photo-client';
import { MAX_PER_BATCH, MAX_PHOTOS_PER_POST } from '@/lib/photos';

/**
 * 모임 사진 — 가기 전 안내문도, 다녀와서 찍은 것도 여기 같이 쌓인다.
 *
 * 둘을 나누지 않는 이유: 나눠 두면 올릴 때마다 「어느 쪽에 넣어야 하나」를 묻게 된다.
 * 카드에는 첫 장만 실리고, 나머지는 눌러서 넘겨 본다.
 *
 * 카드와 달리 여기서는 격자로 늘어놓는다 — 올리고 지우는 것은 결국 「어느 것을」 골라야
 * 하는 일이라 한 장씩 보여선 안 된다.
 */

const T = {
  unknown: { ko: '알 수 없음', en: 'Unknown', es: 'Desconocido' },
  heading: { ko: '사진', en: 'Photos', es: 'Fotos' },
  none: { ko: '아직 사진이 없어요.', en: 'No photos yet.', es: 'Aún no hay fotos.' },
  add: { ko: '사진 올리기', en: 'Add photos', es: 'Añadir fotos' },
  uploading: { ko: '{done}/{total} 올리는 중…', en: 'Uploading {done}/{total}…', es: 'Subiendo {done}/{total}…' },
  onlyThere: {
    ko: '이 모임에 참가한 사람만 사진을 올릴 수 있어요.',
    en: 'Only people in the meetup can add photos.',
    es: 'Solo quien está en la quedada puede añadir fotos.',
  },
  full: { ko: '사진은 {n}장까지 올릴 수 있어요.', en: 'Up to {n} photos per meetup.', es: 'Hasta {n} fotos por quedada.' },
  tooMany: { ko: '한 번에 {n}장까지 고를 수 있어요.', en: 'Pick up to {n} at a time.', es: 'Elige hasta {n} a la vez.' },
  failed: { ko: '올리지 못했어요.', en: 'Couldn’t upload that.', es: 'No se pudo subir.' },
  /* 사진은 올라갔는데 원본만 못 올린 경우 — 막지 않고 알려만 준다 */
  origFailed: {
    ko: '사진은 올라갔는데 원본은 저장하지 못했어요 ({why}). 「원본 받기」가 이 사진에는 안 붙어요.',
    en: 'The photo went up but the original didn’t ({why}). This one won’t have a download link.',
    es: 'La foto se subió pero el original no ({why}). Esta no tendrá enlace de descarga.',
  },
  heic: {
    ko: '이 사진 형식(HEIC)은 못 읽어요. 아이폰 설정 › 카메라 › 포맷을 「높은 호환성」으로 바꾸거나, 사진을 한 번 편집해 저장한 뒤 올려주세요.',
    en: 'That photo format (HEIC) can’t be read. Switch iPhone Settings › Camera › Formats to “Most Compatible”, or edit and save the photo once, then try again.',
    es: 'No se puede leer ese formato (HEIC). Cambia Ajustes › Cámara › Formatos a «Más compatible» en el iPhone, o edita y guarda la foto una vez y vuelve a intentarlo.',
  },
  del: { ko: '지우기', en: 'Remove', es: 'Quitar' },
  delFailed: { ko: '지우지 못했어요.', en: 'Couldn’t remove that.', es: 'No se pudo quitar.' },
  by: { ko: '{name} 올림', en: 'by {name}', es: 'de {name}' },
};

export interface PhotoItem {
  id: string;
  userId: string;
  url: string;
  /** 받기 주소 — 원본이 있으면 그 파일, 없으면 보이는 사진 */
  downloadUrl?: string | null;
  /** 그 주소가 올린 파일 그대로인지 */
  downloadIsOriginal?: boolean;
}

export default function PhotoPanel({
  postId,
  photos,
  participants,
  isHost,
  isAdmin,
  currentUserId,
  label,
}: {
  postId: string;
  photos: PhotoItem[];
  participants: { id: string; name: string }[];
  /** 이 모임의 호스트인지 — 남의 사진도 지울 수 있다 */
  isHost: boolean;
  isAdmin: boolean;
  currentUserId?: string;
  /** 확대했을 때 위에 적을 이름 (모임 제목) */
  label: string;
}) {
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const zoom = usePosterZoom();
  const t = useT();

  const inMeetup = Boolean(currentUserId && participants.some((p) => p.id === currentUserId));
  const canAdd = inMeetup || isAdmin;
  const nameOf = (userId: string) => participants.find((p) => p.id === userId)?.name ?? t(T.unknown);

  // 확대 창에 넘길 목록 — 격자 순서 그대로다
  const items: Zoomed[] = photos.map((p) => ({
    src: p.url,
    name: label,
    by: t(T.by, { name: nameOf(p.userId) }),
    downloadUrl: p.downloadUrl ?? null,
    downloadIsOriginal: Boolean(p.downloadIsOriginal),
  }));

  async function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const list = [...files];
    if (list.length > MAX_PER_BATCH) return setError(t(T.tooMany, { n: MAX_PER_BATCH }));
    if (photos.length + list.length > MAX_PHOTOS_PER_POST) {
      return setError(t(T.full, { n: MAX_PHOTOS_PER_POST }));
    }

    /*
     * 한 장씩 차례로 올린다. 열 장을 한꺼번에 올리면 폰 데이터에서 서로 막혀 진행률이
     * 거짓말이 되고, 한 장이 실패했을 때 어느 것이 실패했는지도 알 수 없다.
     */
    setBusy({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      try {
        const up = await uploadPhoto(list[i]!, currentUserId!, postId);
        // 사진은 올라갔다 — 원본만 빠졌으면 멈추지 않고 알려만 준다
        if (up.originalError) setError(t(T.origFailed, { why: up.originalError }));
        // 바이트는 저장소에 갔고, 모임에 매다는 것은 여기서
        const res = await fetch(`/api/posts/${postId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // display는 미리보기용 Blob이라 서버로 보내지 않는다
          body: JSON.stringify({
            pathname: up.pathname,
            originalPathname: up.originalPathname,
            width: up.width,
            height: up.height,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? t(T.failed));
      } catch (e) {
        setError(e instanceof UnreadableImageError ? t(T.heic) : e instanceof Error ? e.message : t(T.failed));
        break;
      }
      setBusy({ done: i + 1, total: list.length });
    }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = '';
    router.refresh();
  }

  async function remove(photo: PhotoItem) {
    setError(null);
    const res = await fetch(`/api/posts/${postId}/photos/${photo.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? t(T.delFailed));
      return;
    }
    router.refresh();
  }

  return (
    <>
      <h2 id="photos" style={{ scrollMarginTop: 72 }}>
        {t(T.heading)} {photos.length > 0 ? photos.length : ''}
      </h2>

      <div className="card">
        {photos.length === 0 && (
          <p className="hint" style={{ margin: '0 0 10px' }}>
            {t(T.none)}
          </p>
        )}

        {photos.length > 0 && (
          <div className="photo-grid">
            {photos.map((p, i) => (
              <div key={p.id} className="photo-cell">
                {zoom.triggerAt(
                  items,
                  i,
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" loading="lazy" />
                )}
                {/* 올린 사람과 호스트만 — 서버가 다시 확인한다 */}
                {(p.userId === currentUserId || isHost || isAdmin) && (
                  <button className="photo-del" aria-label={t(T.del)} onClick={() => remove(p)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canAdd ? (
          <div className="field-row" style={{ marginTop: 12 }}>
            <label className="secondary photo-pick">
              {busy ? t(T.uploading, { done: busy.done, total: busy.total }) : t(T.add)}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                disabled={Boolean(busy)}
                onChange={(e) => pick(e.target.files)}
              />
            </label>
          </div>
        ) : (
          <p className="hint" style={{ marginBottom: 0 }}>
            {t(T.onlyThere)}
          </p>
        )}

        {error && <div className="msg err">{error}</div>}
      </div>

      {zoom.overlay}
    </>
  );
}
