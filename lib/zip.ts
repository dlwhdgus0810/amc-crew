/**
 * 압축하지 않는 ZIP 만들기 (store) — 사진 여러 장을 한 파일로 묶어 내려보낼 때 쓴다.
 *
 * 라이브러리를 안 쓴 이유: 넣을 것이 JPEG뿐이라 압축이 아무 일도 안 한다(이미 압축된
 * 형식이라 오히려 커지기도 한다). 압축을 뺀 ZIP은 규격이 짧아서, 의존성을 하나 더
 * 들이는 것보다 여기 백 줄을 두는 편이 낫다.
 *
 * **한 번에 한 장만 메모리에 올린다.** 파일을 통째로 모아 두고 마지막에 내보내면
 * 30장짜리 모임에서 수백 MB가 함수 메모리에 쌓인다. 한 장 받아 쓰고 흘려보내는 식이라
 * 쓰는 메모리는 「가장 큰 사진 한 장」에서 멈춘다.
 *
 * zip64는 안 쓴다. 넣는 장수가 정해져 있고(모임당 60장) 4GB를 넘을 수 없어서다.
 */

/* CRC-32 (IEEE) — ZIP이 파일마다 요구한다 */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP은 리틀 엔디안이다 */
function u32(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}
function u16(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff];
}

export interface ZipEntry {
  /** ZIP 안에 남을 이름 */
  name: string;
  /** 그 파일의 바이트를 가져온다. 못 가져오면 null — 그 장만 빠지고 나머지는 묶인다 */
  fetch: () => Promise<Uint8Array | null>;
}

/**
 * 파일들을 ZIP 한 덩어리로 흘려보낸다.
 *
 * 전체 길이를 미리 알 수 없으므로 Content-Length 없이 나간다(청크 전송). 그래서 받는
 * 쪽에 진행률이 안 뜨는데, 길이를 알려면 모든 파일을 먼저 받아 재야 해서 그게 더 나쁘다.
 */
export function zipStream(entries: ZipEntry[]): ReadableStream<Uint8Array> {
  // 날짜 자리는 고정한다 — 파일마다 원래 시각을 넣어도 읽는 쪽에서 쓰이지 않는다
  const DOS_TIME = 0;
  const DOS_DATE = 33; // 1980-01-01

  return new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const central: number[] = [];
      let offset = 0;
      let count = 0;

      for (const entry of entries) {
        const body = await entry.fetch();
        if (!body) continue; // 못 받은 장은 건너뛴다 — 한 장 때문에 묶음 전체를 버리지 않는다

        const nameBytes = enc.encode(entry.name);
        const crc = crc32(body);
        const size = body.length;

        // 로컬 파일 헤더
        const local = [
          ...u32(0x04034b50),
          ...u16(20), // 풀려면 필요한 버전 (2.0)
          ...u16(0), // 플래그 없음 — 길이와 CRC를 데이터 앞에 다 적는다
          ...u16(0), // 방식 0 = store (압축 안 함)
          ...u16(DOS_TIME),
          ...u16(DOS_DATE),
          ...u32(crc),
          ...u32(size),
          ...u32(size),
          ...u16(nameBytes.length),
          ...u16(0), // extra 없음
        ];
        controller.enqueue(new Uint8Array(local));
        controller.enqueue(nameBytes);
        controller.enqueue(body);

        // 중앙 디렉터리에 넣을 같은 정보 — 끝에 몰아서 쓴다
        central.push(
          ...u32(0x02014b50),
          ...u16(20), // 만든 버전
          ...u16(20),
          ...u16(0),
          ...u16(0),
          ...u16(DOS_TIME),
          ...u16(DOS_DATE),
          ...u32(crc),
          ...u32(size),
          ...u32(size),
          ...u16(nameBytes.length),
          ...u16(0),
          ...u16(0), // 주석 없음
          ...u16(0), // 디스크 번호
          ...u16(0), // 내부 속성
          ...u32(0), // 외부 속성
          ...u32(offset),
          ...nameBytes
        );
        offset += local.length + nameBytes.length + size;
        count++;
      }

      const centralBytes = new Uint8Array(central);
      controller.enqueue(centralBytes);
      controller.enqueue(
        new Uint8Array([
          ...u32(0x06054b50), // 끝 기록 (EOCD)
          ...u16(0),
          ...u16(0),
          ...u16(count),
          ...u16(count),
          ...u32(centralBytes.length),
          ...u32(offset),
          ...u16(0), // 주석 없음
        ])
      );
      controller.close();
    },
  });
}
