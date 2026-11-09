// 스텔라이브 멤버들의 방송 상태·태그·클립·다시보기를 받아 stellive.json 으로 저장해요.
// GitHub Actions 에서 10분마다 돌아요. members.json 의 멤버만 챙겨요.
import { readFile, writeFile } from "node:fs/promises";

const API = "https://api.chzzk.naver.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = (o, keys, d = "") => { for (const k of keys) if (o && o[k] != null && o[k] !== "") return o[k]; return d; };

const fails = []; // 끝내 실패한 요청 기록
async function get(path) {
  let last = "";
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(API + path, { headers: { "User-Agent": UA, "Accept": "application/json", "Referer": "https://chzzk.naver.com/" } });
      if (r.ok) { const j = await r.json(); return j.content ?? null; }
      last = r.status;
      console.log("  응답", r.status, path, (await r.text()).slice(0, 120).replace(/\s+/g, " "));
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) { last = e.message; console.log("  연결 실패", path, e.message); }
    await sleep(1500 * (t + 1));
  }
  fails.push(path.split("?")[0] + " → " + last);
  return null;
}

// livePlaybackJson 안에서 HLS 영상 주소를 꺼내요 (일반 HLS 먼저, 없으면 저지연 LLHLS)
function hlsOf(pb) {
  try { const media = (typeof pb === "string" ? JSON.parse(pb) : pb || {}).media || []; const m = media.find(x => x.mediaId === "HLS") || media.find(x => x.mediaId === "LLHLS"); return m ? m.path : ""; }
  catch (e) { return ""; }
}

const cfg = JSON.parse(await readFile("members.json", "utf8"));
// 지난번 결과 (API가 잠깐 실패해도 클립이 사라지지 않게)
// 1) 옆에 있는 stellive.json (계속 받기 중에는 바로 전 결과) 2) 없으면 지금 올라가 있는 사이트
let old = {}, oldAt = 0;
async function readOld() {
  try { return JSON.parse(await readFile("stellive.json", "utf8")); } catch (e) {}
  try {
    const host = (await readFile("CNAME", "utf8")).trim();
    const r = await fetch(`https://${host}/stellive.json?t=${Date.now()}`);
    if (r.ok) return await r.json();
  } catch (e) {}
  return null;
}
const oj = await readOld();
if (oj) { oldAt = oj.updatedAt || 0; for (const m of oj.members || []) old[m.name] = m; }

const out = [];
let liveChecked = 0, withId = 0;
for (const m of cfg.members || []) {
  const name = String(m.name || "").trim(); if (!name) continue;
  const prev = old[name] || {};
  let id = String(m.id || "").trim().match(/[0-9a-f]{32}/i)?.[0]?.toLowerCase() || prev.id || "";
  console.log("●", name);

  // 1) 채널 id 찾기 (id가 비어 있으면 이름으로 검색)
  if (!id) {
    const s = await get("/service/v1/search/channels?keyword=" + encodeURIComponent(name) + "&offset=0&size=10&withFirstChannelContent=false");
    const list = (s?.data || []).map(x => x.channel || x).filter(Boolean);
    const hit = list.find(c => c.channelName === name) || list.find(c => c.channelName?.replace(/\s/g, "") === name.replace(/\s/g, "")) || list.find(c => c.verifiedMark && c.channelName?.includes(name));
    if (hit) { id = hit.channelId; console.log("  찾음", hit.channelName, id); } else { console.log("  이름으로 못 찾았어요. members.json 에 id 를 넣어 주세요"); console.log("::warning::" + name + " 채널 id 를 못 찾았어요 (members.json 에 id 를 넣어 주세요)"); }
  }
  const mem = { name, gen: m.gen || "", graduated: !!m.graduated, id, image: prev.image || "", followers: prev.followers || 0, live: null, clips: prev.clips || [], videos: prev.videos || [], lastLive: prev.lastLive || null };
  if (!id) { out.push(mem); continue; }
  withId++;

  // 2) 채널 정보
  const ch = await get(`/service/v1/channels/${id}`);
  if (ch) { mem.image = pick(ch, ["channelImageUrl"], mem.image); mem.followers = pick(ch, ["followerCount"], mem.followers); }

  // 3) 방송 상태
  const f0 = fails.length;
  const lv = await get(`/service/v3/channels/${id}/live-detail`) || await get(`/polling/v2/channels/${id}/live-status`);
  const liveFailed = !lv && fails.length > f0;
  if (!liveFailed) liveChecked++;
  if (lv && String(lv.status || "").toUpperCase() === "OPEN") {
    mem.live = {
      title: pick(lv, ["liveTitle"]), thumb: String(pick(lv, ["liveImageUrl", "defaultThumbnailImageUrl"])).replace("{type}", "720"),
      viewers: pick(lv, ["concurrentUserCount"], 0), openDate: pick(lv, ["openDate"]), category: pick(lv, ["liveCategoryValue"]),
      tags: (lv.tags || []).slice(0, 8), adult: !!lv.adult, hls: hlsOf(lv.livePlaybackJson)
    };
    if (mem.live.hls) { const exp = Number((mem.live.hls.match(/exp=(\d{10})/) || [])[1]); console.log("  영상 주소 받음" + (exp ? " (" + Math.round((exp * 1000 - Date.now()) / 60000) + "분 뒤 만료)" : "")); }
    else console.log("  영상 주소 없음");
    mem.lastLive = { title: mem.live.title, category: mem.live.category, at: Date.now() };
  } else if (liveFailed && prev.live && (prev.liveMiss || 0) < 2) {
    // 확인 자체가 실패했을 땐 '방송 쉼'으로 바꾸지 않고 지난 상태를 최대 2번까지 유지해요
    mem.live = prev.live; mem.liveMiss = (prev.liveMiss || 0) + 1;
    console.log("  방송 상태 확인 실패 → 지난 상태 유지 (" + mem.liveMiss + "회째)");
  }

  // 4) 클립 (최근 순)
  const cl = await get(`/service/v1/channels/${id}/clips?filterType=ALL&orderType=RECENT&size=12`);
  if (cl && Array.isArray(cl.data)) mem.clips = cl.data.map(c => ({
    id: pick(c, ["clipUID", "clipId"]), title: pick(c, ["clipTitle", "title"]), thumb: pick(c, ["thumbnailImageUrl"]),
    duration: pick(c, ["duration"], 0), views: pick(c, ["readCount"], 0), date: pick(c, ["createdDate", "createdAt"])
  })).filter(c => c.id);

  // 5) 다시보기·영상 (최근 순)
  const vd = await get(`/service/v1/channels/${id}/videos?sortType=LATEST&pagingType=PAGE&page=0&size=8&publishDateAt=&videoType=`);
  if (vd && Array.isArray(vd.data)) mem.videos = vd.data.map(v => ({
    no: pick(v, ["videoNo"]), title: pick(v, ["videoTitle", "title"]), thumb: pick(v, ["thumbnailImageUrl"]),
    duration: pick(v, ["duration"], 0), views: pick(v, ["readCount"], 0), date: pick(v, ["publishDate"]), type: pick(v, ["videoType"]),
    category: pick(v, ["videoCategoryValue"])
  })).filter(v => v.no);

  console.log("  ", mem.live ? "방송 중" : "방송 쉼", "· 클립", mem.clips.length, "· 영상", mem.videos.length);
  out.push(mem);
  await sleep(300);
}

const allFailed = withId > 0 && liveChecked === 0;
if (fails.length) { console.log("실패한 요청", fails.length, "건"); fails.slice(0, 15).forEach(f => console.log("  -", f)); console.log("::warning::치지직 요청 " + fails.length + "건 실패 (로그 확인)"); }
if (allFailed) console.log("::warning::방송 상태를 한 명도 못 받았어요. 시각을 갱신하지 않아요 (치지직이 GitHub 서버를 막았을 수 있어요)");
await writeFile("stellive.json", JSON.stringify({ updatedAt: allFailed ? oldAt : Date.now(), members: out }));
console.log("저장 완료:", out.length, "명");
