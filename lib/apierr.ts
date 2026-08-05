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
  rosterHostOnly: {
    ko: '명단에서 빼는 건 지난 모임에서 호스트만 할 수 있어요.',
    en: 'Only a host can remove someone, and only from a past meetup.',
  },
  notParticipant: { ko: '그 사람은 이 모임 명단에 없어요.', en: 'They aren’t in this meetup.' },
  adminOnly: { ko: '관리자만 사용할 수 있어요.', en: 'Admins only.' },
  adminOnlyReview: { ko: '관리자만 검토할 수 있어요.', en: 'Only admins can review suggestions.' },
  requestNotFound: { ko: '제안을 찾을 수 없어요.', en: 'Suggestion not found.' },
  nickname: { ko: '닉네임은 20자 이하로 입력해주세요.', en: 'Nickname must be 20 characters or fewer.' },
  nicknameBad: { ko: '닉네임 형식이 올바르지 않아요.', en: 'That nickname isn’t valid.' },
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
  banned: {
    ko: '지금은 앱을 쓸 수 없어요. {left} 뒤에 다시 쓸 수 있어요.',
    en: 'You can’t use the app right now — it opens back up in {left}.',
  },
  banAdmin: { ko: '관리자는 정지할 수 없어요.', en: 'Admins can’t be suspended.' },
  banMinutes: { ko: '정지 기간이 올바르지 않아요.', en: 'That isn’t a valid duration.' },
  pastDelete: {
    ko: '이미 지난 모임은 지울 수 없어요. 기록으로 남겨둬요. (지워야 한다면 관리자에게 말해주세요)',
    en: 'A meetup that already happened can’t be deleted — it stays as a record. Ask an admin if it really has to go.',
  },
  coHostIsAuthor: {
    ko: '모임을 만든 사람은 같이 여는 사람으로 넣을 수 없어요.',
    en: 'The person who made the meetup is already a host.',
  },
  coHostNotFriend: {
    ko: '같이 여는 사람은 친구 중에서 고를 수 있어요.',
    en: 'You can only co-host with a friend.',
  },
  friendSelf: { ko: '자기 자신에게는 친구 요청을 보낼 수 없어요.', en: 'You can’t send yourself a friend request.' },
  friendNoShared: {
    ko: '같은 모임에서 만난 사람에게만 친구 요청을 보낼 수 있어요.',
    en: 'You can only add someone you’ve shared a meetup with.',
  },
  friendExists: { ko: '이미 친구이거나 보낸 요청이 있어요.', en: 'You’re already friends, or a request is pending.' },
  friendNotFound: { ko: '친구 요청을 찾을 수 없어요.', en: 'Friend request not found.' },
  friendNotFriend: { ko: '친구만 모임에 넣을 수 있어요.', en: 'You can only add a friend to a meetup.' },
  friendAddOnly: {
    ko: '이 모임에 참가한 사람만 친구를 넣을 수 있어요.',
    en: 'Only someone in the meetup can add a friend to it.',
  },
  friendAlreadyIn: { ko: '이미 이 모임에 참가하고 있어요.', en: 'They’re already in this meetup.' },
  friendAddPast: { ko: '지난 모임에는 넣을 수 없어요.', en: 'You can’t add anyone to a past meetup.' },
  ratingClosed: {
    ko: '모임이 끝난 뒤에 평점을 매길 수 있어요.',
    en: 'You can rate this once the meetup is over.',
  },
  ratingParticipantOnly: {
    ko: '이 모임에 참가한 사람만 평점을 매길 수 있어요.',
    en: 'Only someone who was at the meetup can rate it.',
  },
  ratingScore: {
    ko: '평점은 0.0~10.0 사이, 0.1 단위로 매겨주세요.',
    en: 'Ratings run 0.0–10.0 in steps of 0.1.',
  },
  settleNotFound: { ko: '정산을 찾을 수 없어요.', en: 'No settle-up found.' },
  settleParticipantOnly: {
    ko: '모임에 참가한 사람만 정산을 만들 수 있어요.',
    en: 'Only someone in the meetup can start a settle-up.',
  },
  settleOwnerOnly: {
    ko: '정산을 만든 사람만 고칠 수 있어요.',
    en: 'Only whoever started the settle-up can change it.',
  },
  settleItems: { ko: '정산 항목을 1~10개로 입력해주세요.', en: 'Add between 1 and 10 items.' },
  settleLabel: { ko: '항목 이름을 1~40자로 입력해주세요.', en: 'Each item needs a name of 1–40 characters.' },
  settleAmount: {
    ko: '금액을 올바르게 입력해주세요 (예: 12.50).',
    en: 'Enter a valid amount (e.g. 12.50).',
  },
  settleMembers: { ko: '나눠 낼 사람을 한 명 이상 골라주세요.', en: 'Pick at least one person to split with.' },
  settleExtra: {
    ko: '추가 인원은 0~50명 사이 숫자로 입력해주세요.',
    en: 'Extra people must be a whole number between 0 and 50.',
  },
  venmoId: {
    ko: 'Venmo 아이디는 영문·숫자·밑줄·하이픈 1~30자예요.',
    en: 'A Venmo username is 1–30 characters of letters, numbers, underscores or hyphens.',
  },
  zelleId: {
    ko: 'Zelle은 전화번호나 이메일로 60자 이내로 입력해주세요.',
    en: 'Zelle takes a phone number or email, up to 60 characters.',
  },
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
