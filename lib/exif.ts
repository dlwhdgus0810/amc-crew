/**
 * 사진 파일 앞머리에서 찍은 시각과 찍은 자리를 읽는다.
 *
 * 브라우저와 서버 양쪽에서 쓴다 — 올릴 때는 고른 파일에서 바로(lib/photo-client.ts),
 * 이미 올라간 사진은 저장소의 원본 앞부분만 받아서(app/api/admin/photo-exif). 그래서 이
 * 파일은 DOM도 node도 안 쓴다. 바이트만 받는다.
 *
 * **화면용·썸네일에서는 못 읽는다.** 그 둘은 캔버스로 다시 구운 것이라 EXIF가 통째로
 * 떨어져 나간다(lib/photo-client.ts). 남아 있는 것은 손 안 댄 원본뿐이라, 원본을 못 올린
 * 사진은 시각도 자리도 영영 없다.
 *
 * 남이 올린 바이트를 걷는 자리다. 길이를 안 믿고 한 걸음마다 경계를 본다 — 여기서 던지면
 * 사진 올리기가 통째로 막힌다. 못 읽으면 null이지 오류가 아니다.
 */

export interface PhotoExif {
  /**
   * 찍은 순간.
   *
   * 오프셋(아래)을 같이 읽었으면 진짜 그 순간이다. 못 읽었으면 카메라가 적은 벽시계
   * 시각을 UTC인 척 담아 둔다 — 이상해 보이지만, 그리는 쪽이 언제나 `takenOffset ?? 0`만큼
   * 밀어 UTC로 찍어내므로 어느 쪽이든 **카메라가 보여 준 시각 그대로** 나온다.
   * 대신 오프셋이 없는 사진은 다른 시간대 사진과 섞였을 때 순서가 어긋날 수 있다.
   */
  takenAt: Date | null;
  /** 그 자리의 UTC 오프셋(분). 아이폰은 늘 적어 준다 */
  takenOffset: number | null;
  lat: number | null;
  lon: number | null;
}

/** 앞에서 이만큼만 본다. EXIF는 파일 머리에 있고, 원본 한 장을 통째로 받을 이유가 없다 */
export const EXIF_HEAD_BYTES = 256 * 1024;

/** 이 안에 쓸 만한 것이 하나라도 있나 */
export function hasAnyExif(e: PhotoExif | null): e is PhotoExif {
  return Boolean(e && (e.takenAt || (e.lat != null && e.lon != null)));
}

export async function readExifFromBlob(blob: Blob): Promise<PhotoExif | null> {
  try {
    const head = blob.slice(0, EXIF_HEAD_BYTES);
    return readExif(new Uint8Array(await head.arrayBuffer()));
  } catch {
    return null;
  }
}

export function readExif(bytes: Uint8Array): PhotoExif | null {
  try {
    const tiff = tiffStart(bytes);
    if (tiff < 0) return null;
    return parseTiff(bytes, tiff);
  } catch {
    // 깨진 파일이거나 내가 모르는 모양이다. 사진은 그대로 올라가야 한다
    return null;
  }
}

/* ── 어디서부터 TIFF인가 ────────────────────────────────────────────── */

const EXIF_MAGIC = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

function isExifMagic(b: Uint8Array, o: number): boolean {
  return EXIF_MAGIC.every((c, i) => b[o + i] === c);
}

/** II/MM + 42. 이걸로 걸러서 그림 데이터 속 우연한 "Exif"에 안 속는다 */
function looksLikeTiff(b: Uint8Array, o: number): boolean {
  if (o + 4 > b.length) return false;
  if (b[o] === 0x49 && b[o + 1] === 0x49) return b[o + 2] === 42 && b[o + 3] === 0;
  if (b[o] === 0x4d && b[o + 1] === 0x4d) return b[o + 2] === 0 && b[o + 3] === 42;
  return false;
}

function tiffStart(b: Uint8Array): number {
  /*
   * JPEG면 마커를 제대로 걷는다. 그냥 "Exif"를 찾아도 대개 맞지만, 마커를 걸으면
   * 그림 데이터 안의 우연한 일치를 아예 안 지나간다.
   */
  if (b[0] === 0xff && b[1] === 0xd8) {
    let p = 2;
    while (p + 4 <= b.length) {
      if (b[p] !== 0xff) break;
      const marker = b[p + 1]!;
      // SOS·EOI부터는 그림 데이터다 — EXIF는 그 앞에만 있다
      if (marker === 0xda || marker === 0xd9) break;
      // 길이가 없는 마커들
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        p += 2;
        continue;
      }
      const size = ((b[p + 2]! << 8) | b[p + 3]!) >>> 0;
      if (size < 2) break;
      const seg = p + 4;
      if (marker === 0xe1 && isExifMagic(b, seg) && looksLikeTiff(b, seg + 6)) return seg + 6;
      p += 2 + size;
    }
    return -1;
  }

  /*
   * HEIC·AVIF 등. 상자(ISO BMFF) 구조를 다 걷는 대신 Exif 표시를 찾고 바로 뒤가 TIFF
   * 머리인지로 가른다 — 상자를 걷는 값에 비해 얻는 것이 없다.
   */
  const limit = Math.min(b.length, EXIF_HEAD_BYTES) - 14;
  for (let i = 0; i < limit; i++) {
    if (b[i] === 0x45 && isExifMagic(b, i) && looksLikeTiff(b, i + 6)) return i + 6;
  }
  return -1;
}

/* ── TIFF/IFD 걷기 ──────────────────────────────────────────────────── */

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATE_TAKEN = 0x9003; // DateTimeOriginal
const TAG_OFFSET_TAKEN = 0x9011; // OffsetTimeOriginal
const GPS_LAT_REF = 1;
const GPS_LAT = 2;
const GPS_LON_REF = 3;
const GPS_LON = 4;

/** 타입별 한 칸 크기 (모르는 타입은 1로 봐서 그냥 지나가게 둔다) */
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function parseTiff(b: Uint8Array, tiff: number): PhotoExif | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const le = b[tiff] === 0x49;
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);

  /** 한 IFD의 칸들을 훑는다. 값이 4바이트를 넘으면 값은 딴 데 있고 여기엔 그 자리만 적힌다 */
  const walk = (off: number, fn: (tag: number, count: number, valOff: number) => void) => {
    if (off < tiff || off + 2 > b.length) return;
    const n = u16(off);
    // 한 IFD에 수백 칸이 넘어가면 엉뚱한 자리를 IFD로 읽은 것이다
    if (n > 300) return;
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (e + 12 > b.length) return;
      const tag = u16(e);
      const size = (TYPE_SIZE[u16(e + 2)] ?? 1) * u32(e + 4);
      const valOff = size <= 4 ? e + 8 : tiff + u32(e + 8);
      if (valOff < tiff || valOff + Math.min(size, 4) > b.length) continue;
      fn(tag, u32(e + 4), valOff);
    }
  };

  const ascii = (o: number, count: number) => {
    const end = Math.min(o + count, b.length);
    let s = '';
    for (let i = o; i < end && b[i] !== 0; i++) s += String.fromCharCode(b[i]!);
    return s.trim();
  };
  /** 분자/분모 한 쌍. 분모가 0인 사진이 실제로 있다 */
  const rational = (o: number) => {
    if (o + 8 > b.length) return 0;
    const d = u32(o + 4);
    return d === 0 ? 0 : u32(o) / d;
  };
  /** 도·분·초 세 쌍 → 십진 도 */
  const dms = (o: number) => (o + 24 > b.length ? null : rational(o) + rational(o + 8) / 60 + rational(o + 16) / 3600);

  let exifIfd = 0;
  let gpsIfd = 0;
  walk(tiff + u32(tiff + 4), (tag, _count, v) => {
    if (tag === TAG_EXIF_IFD) exifIfd = tiff + u32(v);
    else if (tag === TAG_GPS_IFD) gpsIfd = tiff + u32(v);
  });

  let wall = '';
  let offset = '';
  if (exifIfd) {
    walk(exifIfd, (tag, count, v) => {
      if (tag === TAG_DATE_TAKEN) wall = ascii(v, count);
      else if (tag === TAG_OFFSET_TAKEN) offset = ascii(v, count);
    });
  }

  let lat: number | null = null;
  let lon: number | null = null;
  if (gpsIfd) {
    let latRef = '';
    let lonRef = '';
    walk(gpsIfd, (tag, count, v) => {
      if (tag === GPS_LAT_REF) latRef = ascii(v, count);
      else if (tag === GPS_LON_REF) lonRef = ascii(v, count);
      else if (tag === GPS_LAT) lat = dms(v);
      else if (tag === GPS_LON) lon = dms(v);
    });
    if (lat != null && latRef.toUpperCase() === 'S') lat = -lat;
    if (lon != null && lonRef.toUpperCase() === 'W') lon = -lon;
  }
  /*
   * 0,0은 「모름」이다. 대서양 한가운데를 가리키는 좌표를 실제로 적어 보내는 기기가 있다.
   * 범위를 벗어난 값도 버린다 — 분모 0을 만난 뒤의 찌꺼기일 수 있다.
   */
  if (lat == null || lon == null || (lat === 0 && lon === 0) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    lat = null;
    lon = null;
  }

  const takenOffset = parseOffset(offset);
  const takenAt = parseWall(wall, takenOffset);
  if (!takenAt && lat == null) return null;
  return { takenAt, takenOffset, lat, lon };
}

/** "-05:00" → -300 */
function parseOffset(s: string): number | null {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const mins = Number(m[2]) * 60 + Number(m[3]);
  if (mins > 14 * 60) return null;
  return m[1] === '-' ? -mins : mins;
}

/** "2026:08:14 19:22:44" → 그 순간 (오프셋이 없으면 벽시계 시각을 UTC로 담는다) */
function parseWall(s: string, offsetMin: number | null): Date | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  // 카메라가 시각을 못 맞춘 채로 찍으면 1970년이나 2000년 1월 1일이 박힌다
  if (m[1] === '0000') return null;
  const zone =
    offsetMin == null
      ? 'Z'
      : `${offsetMin < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offsetMin) / 60))}:${pad(Math.abs(offsetMin) % 60)}`;
  const at = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${zone}`);
  return Number.isNaN(at.getTime()) ? null : at;
}

const pad = (n: number) => String(n).padStart(2, '0');
