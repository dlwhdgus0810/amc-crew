// API 에러 문구 — 클라이언트가 그대로 화면에 띄우므로 요청자 언어(locale 쿠키)로 내려준다.

import { NextResponse } from 'next/server';
import { Msg, pick } from './i18n';
import { getLocale } from './locale';

/** 여러 라우트가 함께 쓰는 문구 */
export const E = {
  loginRequired: { ko: '카카오 로그인이 필요해요.', en: 'Please log in with Kakao.' },
  postNotFound: { ko: '포스트를 찾을 수 없어요.', en: 'Meetup not found.' },
  notifNotFound: { ko: '알림을 찾을 수 없어요.', en: 'Alert not found.' },
  badCategory: { ko: '올바르지 않은 카테고리입니다.', en: 'Unknown category.' },
  badRequest: { ko: '요청 형식이 올바르지 않습니다.', en: 'Malformed request.' },
  badDateTime: { ko: '날짜와 시간을 올바르게 입력해주세요.', en: 'Enter a valid date and time.' },
  endBeforeStart: { ko: '종료 시간은 시작 시간보다 늦어야 해요.', en: 'The end time must be after the start time.' },
  pastSlot: { ko: '이미 지난 시간으로는 모임을 만들 수 없어요.', en: 'You can’t create a meetup in the past.' },
  pastMove: { ko: '지난 날짜로는 옮길 수 없어요.', en: 'You can’t move a meetup into the past.' },
  location: { ko: '장소는 1~100자로 입력해주세요.', en: 'Place must be 1–100 characters.' },
  memo: { ko: '메모는 500자 이하로 입력해주세요.', en: 'Note must be 500 characters or fewer.' },
  title: { ko: '제목은 100자 이하로 입력해주세요.', en: 'Title must be 100 characters or fewer.' },
  capacity: { ko: '정원은 2~99 사이 숫자로 입력해주세요.', en: 'Capacity must be a number between 2 and 99.' },
  capacityBelowJoined: {
    ko: '현재 참가 인원({n}명)보다 적게 설정할 수 없어요.',
    en: 'Capacity can’t be lower than the current number of participants ({n}).',
  },
  postFull: { ko: '정원이 가득 차서 마감된 모임이에요.', en: 'This meetup is full.' },
  authorCantLeave: {
    ko: '작성자는 참가를 취소할 수 없어요. 대신 포스트를 삭제해주세요.',
    en: 'The host can’t leave — delete the meetup instead.',
  },
  authorOnlyEdit: { ko: '작성자만 수정할 수 있어요.', en: 'Only the host can edit this.' },
  authorOnlyDelete: { ko: '작성자만 삭제할 수 있어요.', en: 'Only the host can delete this.' },
  comment: { ko: '댓글은 1~300자로 입력해주세요.', en: 'Comments must be 1–300 characters.' },
  commentNotFound: { ko: '댓글을 찾을 수 없어요.', en: 'Comment not found.' },
  commentOwnerOnly: { ko: '본인 댓글만 삭제할 수 있어요.', en: 'You can only delete your own comments.' },
  ruleNotFound: { ko: '반복 설정을 찾을 수 없어요.', en: 'Repeat setting not found.' },
  ruleOwnerOnly: { ko: '만든 사람만 반복을 중단할 수 있어요.', en: 'Only the host can stop the repeat.' },
  adminOnly: { ko: '관리자만 사용할 수 있어요.', en: 'Admins only.' },
  adminOnlyReview: { ko: '관리자만 검토할 수 있어요.', en: 'Only admins can review suggestions.' },
  requestNotFound: { ko: '제안을 찾을 수 없어요.', en: 'Suggestion not found.' },
  nickname: { ko: '닉네임은 20자 이하로 입력해주세요.', en: 'Nickname must be 20 characters or fewer.' },
  nicknameBad: { ko: 'nickname이 올바르지 않습니다.', en: 'Invalid nickname.' },
  birthday: { ko: '생년월일을 올바르게 입력해주세요.', en: 'Enter a valid date of birth.' },
  gender: { ko: '성별을 선택해주세요.', en: 'Choose a gender.' },
  locale: { ko: '지원하지 않는 언어입니다.', en: 'Unsupported language.' },
  noChange: { ko: '변경할 내용이 없습니다.', en: 'Nothing to update.' },
  kakaoRelogin: { ko: '카카오 재로그인이 필요해요.', en: 'Please log in with Kakao again.' },
  kakaoConsentCheck: {
    ko: '카카오에서 동의 상태를 확인하지 못했어요. 잠시 후 다시 시도해주세요.',
    en: 'Couldn’t check your Kakao consent. Please try again shortly.',
  },
  kakaoRevoke: {
    ko: '카카오에서 동의를 철회하지 못했어요. 잠시 후 다시 시도해주세요.',
    en: 'Couldn’t revoke Kakao consent. Please try again shortly.',
  },
  catName: { ko: '카테고리 이름은 1~20자로 입력해주세요.', en: 'Category name must be 1–20 characters.' },
  catColor: { ko: '색상을 골라주세요.', en: 'Pick a colour.' },
  catDesc: { ko: '부제목은 1~50자로 입력해주세요.', en: 'Subtitle must be 1–50 characters.' },
  catFeature: { ko: '원하는 기능은 1000자 이하로 입력해주세요.', en: 'Feature request must be 1000 characters or fewer.' },
  catExists: { ko: '이미 있는 카테고리예요.', en: 'That category already exists.' },
  badStatus: { ko: '상태 값이 올바르지 않습니다.', en: 'Invalid status.' },
  avatarType: { ko: '이미지 파일만 올릴 수 있어요.', en: 'Only image files can be uploaded.' },
  avatarSize: { ko: '사진 용량이 너무 커요. 다른 사진을 골라주세요.', en: 'That photo is too large. Please pick another.' },
  ticketNotFound: { ko: '건의를 찾을 수 없어요.', en: 'Ticket not found.' },
  ticketTitle: { ko: '한 줄 요약을 1~80자로 입력해주세요.', en: 'The summary must be 1–80 characters.' },
  ticketBody: { ko: '자세한 내용은 2000자 이하로 입력해주세요.', en: 'Details must be 2000 characters or fewer.' },
  ticketKind: { ko: '건의 종류를 골라주세요.', en: 'Pick a ticket type.' },
  adminNote: { ko: '답변은 500자 이하로 입력해주세요.', en: 'Reply must be 500 characters or fewer.' },
  tmdbSearch: { ko: '검색에 실패했어요.', en: 'Search failed.' },
  tmdbDetail: { ko: '상세 조회에 실패했어요.', en: 'Couldn’t load the details.' },
  tmdbOff: { ko: 'TMDB_API_KEY가 설정되지 않았어요.', en: 'TMDB_API_KEY is not configured.' },
  showtimesRequired: {
    ko: '가능한 상영 회차를 1개 이상 선택해주세요.',
    en: 'Pick at least one showtime.',
  },
  showtimesInvalid: {
    ko: '유효한 회차가 없습니다. 새로고침 후 다시 시도해주세요.',
    en: 'No valid showtimes. Refresh and try again.',
  },
  participantNotFound: { ko: '해당 참여자를 찾을 수 없어요.', en: 'Participant not found.' },
  adminKey: { ko: '관리자 키가 올바르지 않습니다.', en: 'Invalid admin key.' },
  scheduleArray: { ko: 'schedule 배열이 필요합니다.', en: 'A schedule array is required.' },
  scheduleShape: { ko: '형식이 올바르지 않은 항목이 있습니다.', en: 'Some entries have an invalid shape.' },
  userIdShowtimes: { ko: 'userId와 showtimeIds가 필요합니다.', en: 'userId and showtimeIds are required.' },
  kakaoKeyMissing: {
    ko: 'KAKAO_REST_API_KEY 환경변수가 설정되지 않았어요.',
    en: 'KAKAO_REST_API_KEY is not configured.',
  },
  pushNotConfigured: {
    ko: '푸시 알림이 아직 설정되지 않았어요. 잠시 후 다시 시도해주세요.',
    en: 'Push notifications are not configured yet. Please try again later.',
  },
  amcNotConfigured: {
    ko: 'AMC API가 설정되지 않았습니다. AMC_VENDOR_KEY와 AMC_THEATRE_ID 환경변수를 설정하세요.',
    en: 'The AMC API is not configured. Set AMC_VENDOR_KEY and AMC_THEATRE_ID.',
  },
  amcNoShowtimes: {
    ko: 'AMC API에서 The Odyssey 회차를 찾지 못했습니다.',
    en: 'No The Odyssey showtimes found via the AMC API.',
  },
};

/** 요청자 언어로 에러 JSON을 만든다 */
export async function errJson(msg: Msg, status: number, vars?: Record<string, string | number>) {
  return NextResponse.json({ error: pick(await getLocale(), msg, vars) }, { status });
}
