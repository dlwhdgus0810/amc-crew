import { HomeView } from './home-view';

export const dynamic = 'force-dynamic';

/** 홈 — 알맹이는 app/home-view.tsx에 있다 (미리보기가 같은 것을 쓴다) */
export default async function HubPage() {
  return <HomeView />;
}
