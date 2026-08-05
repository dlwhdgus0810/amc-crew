import { del } from '@vercel/blob';

/**
 * 저장소에서 파일을 지운다. 서버 전용.
 *
 * 언제나 삼킨다. 사진 행은 이미 지워졌거나 모임이 사라진 뒤에 부르는 자리라, 여기서 던지면
 * 「지웠는데 실패했다고 나온다」가 된다. 못 지운 파일은 주인 없는 채로 남고,
 * 그건 청소(app/api/admin/blob-sweep)가 걷어간다.
 *
 * 순서도 부르는 쪽이 지킨다: **행을 먼저 지우고 그다음 파일**이다. 반대로 하면 실패했을 때
 * 없는 파일을 가리키는 행이 남아 영영 깨진 그림으로 보인다.
 */
export async function deleteBlobs(urls: string[]): Promise<void> {
  const list = urls.filter(Boolean);
  if (list.length === 0) return;
  try {
    await del(list);
  } catch (e) {
    console.error('[blob] 삭제 실패 (청소가 걷어간다):', e instanceof Error ? e.message : e);
  }
}
