// BDR 동아리농구방 '게스트 구인' 게시판 목록(제목) 수집 → docs/data.json
// 본문·작성자·연락처는 수집하지 않음. Node 20+ (내장 fetch)
import { readFile, writeFile } from 'node:fs/promises';
import { parsePost, postedAt, kstYmd } from './parser.mjs';

const GRPID = 'IGaj';           // dongarry 카페 내부 ID
const FLDID = 'Dilr';           // 게스트 구인 게시판
const PAGE_SIZE = 50;
const MAX_PAGES = 8;            // 최대 400건
const DELAY_MS = 1500;          // 요청 간격
const OUT = new URL('../docs/data.json', import.meta.url);
const API = 'https://m.cafe.daum.net/api/v1/common-articles';
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(page, afterBbsDepth) {
  const q = new URLSearchParams({ grpid: GRPID, fldid: FLDID, pageSize: PAGE_SIZE, targetPage: page });
  if (afterBbsDepth) q.set('afterBbsDepth', afterBbsDepth);
  const res = await fetch(`${API}?${q}`, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': `https://m.cafe.daum.net/dongarry/${FLDID}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} (page ${page})`);
  const json = await res.json();
  if (!Array.isArray(json.articles)) throw new Error(`unexpected response (page ${page})`);
  return json.articles;
}

async function loadPrev() {
  try { return JSON.parse(await readFile(OUT, 'utf8')); } catch { return { posts: [] }; }
}

async function main() {
  const now = Date.now();
  const today = kstYmd(new Date(now).toISOString());
  const prev = await loadPrev();

  const raw = [];
  let depth = null;
  for (let p = 1; p <= MAX_PAGES; p++) {
    const arts = await fetchPage(p, depth);
    if (!arts.length) break;
    raw.push(...arts);
    depth = arts.at(-1).bbsDepth;
    // 게시 3일 이상 지난 글이 나오면 중단
    const last = postedAt(arts.at(-1).articleElapsedTime, now);
    if ((now - Date.parse(last)) / 864e5 > 3) break;
    await sleep(DELAY_MS);
  }
  if (!raw.length) throw new Error('수집 0건 — 기존 data.json 유지');

  const fresh = raw.filter(a => !a.isNotice && !a.hasParentArticle).map(a => {
    const posted = postedAt(a.articleElapsedTime, now);
    return {
      id: a.dataid,
      title: a.title.trim(),
      url: `https://m.cafe.daum.net/dongarry/${FLDID}/${a.dataid}`,
      posted,
      views: a.viewCount,
      ...parsePost(a.title, a.headCont, kstYmd(posted)),
    };
  });

  // 삭제 감지: 이번에 훑은 id 범위 안에 있는데 목록에 없으면 카페에서 삭제된 글
  const freshIds = new Set(fresh.map(p => p.id));
  const minId = Math.min(...freshIds);
  const canDetect = fresh.length >= 20; // 응답이 비정상적으로 적으면 삭제 판단 보류
  const kept = prev.posts.filter(p => !(canDetect && p.id >= minId && !freshIds.has(p.id)));
  const removed = prev.posts.length - kept.length;

  // 병합: 새로 받은 글 우선, 이전 글은 게시시각 유지
  const byId = new Map(kept.map(p => [p.id, p]));
  for (const p of fresh) {
    const old = byId.get(p.id);
    byId.set(p.id, old ? { ...p, posted: old.posted } : p);
  }

  const yesterday = kstYmd(new Date(now - 864e5).toISOString());
  const posts = [...byId.values()]
    .filter(p => p.date ? p.date >= yesterday : (now - Date.parse(p.posted)) / 864e5 <= 3)
    .sort((a, b) => b.id - a.id);

  // 같은 제목 재게시는 최신 1건만
  const seen = new Set();
  const dedup = posts.filter(p => {
    const k = p.title.replace(/\s+/g, '');
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  await writeFile(OUT, JSON.stringify({ updated: new Date(now).toISOString(), today, source: `https://m.cafe.daum.net/dongarry/${FLDID}`, posts: dedup }, null, 0));
  console.log(`fetched=${raw.length} fresh=${fresh.length} removed=${removed} saved=${dedup.length}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
