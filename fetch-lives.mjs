// 치지직 라이브 목록을 받아 lives.json 으로 저장해요.
// GitHub Actions 에서만 돌아요. 비밀키는 저장소 Settings > Secrets 에 넣어 둬요.
//   CHZZK_CLIENT_ID, CHZZK_CLIENT_SECRET
import { writeFile } from "node:fs/promises";

const ID = process.env.CHZZK_CLIENT_ID, SECRET = process.env.CHZZK_CLIENT_SECRET;
const PAGES = Number(process.env.LIVE_PAGES || 15); // 20개씩 × 15쪽 = 최대 300개
if (!ID || !SECRET) { console.log("CHZZK_CLIENT_ID / CHZZK_CLIENT_SECRET 가 없어서 건너뛰어요"); process.exit(0); }

const keep = l => ({
  liveId: l.liveId, liveTitle: l.liveTitle, liveThumbnailImageUrl: l.liveThumbnailImageUrl,
  concurrentUserCount: l.concurrentUserCount, openDate: l.openDate, adult: l.adult, tags: (l.tags || []).slice(0, 5),
  liveCategoryValue: l.liveCategoryValue, channelId: l.channelId, channelName: l.channelName, channelImageUrl: l.channelImageUrl
});

const lives = [], seen = new Set();
let next = "";
for (let p = 0; p < PAGES; p++) {
  const url = "https://openapi.chzzk.naver.com/open/v1/lives?size=20" + (next ? "&next=" + encodeURIComponent(next) : "");
  const r = await fetch(url, { headers: { "Client-Id": ID, "Client-Secret": SECRET, "Content-Type": "application/json" } });
  if (!r.ok) { console.log("치지직 응답 오류", r.status, await r.text()); if (!lives.length) process.exit(1); break; }
  const j = await r.json(), c = j.content || {};
  for (const l of c.data || []) if (!seen.has(l.liveId)) { seen.add(l.liveId); lives.push(keep(l)); }
  next = c.page && c.page.next; if (!next) break;
}
await writeFile("lives.json", JSON.stringify({ updatedAt: Date.now(), lives }));
console.log("라이브", lives.length, "개 저장");
