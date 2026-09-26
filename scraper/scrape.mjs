// BDR 동아리농구방 게시판 목록(제목) 수집 → docs/data.json
// 게스트 구인 · 픽업게임 · 연습경기. 본문·작성자·연락처는 수집하지 않음. Node 20+ (내장 fetch)
import { readFile, writeFile } from 'node:fs/promises';
import { parsePost, postedAt, kstYmd } from './parser.mjs';

const GRPID = 'IGaj';           // dongarry 카페 내부 ID
export const BOARDS = [
  { fld: 'Dilr', key: 'guest', name: '게스트 구인', pages: 8 },
  { fld: 'IVHA', key: 'pickup', name: '픽업게임', pages: 2 },
  { fld: 'MptT', key: 'match', name: '연습경기', pages: 3 },
];
const PAGE_SIZE = 50;
const DELAY_MS = 1500;          // 요청 간격
const OUT = new URL('../docs/data.json', import.meta.url);
const API = 'https://m.cafe.daum.net/api/v1/common-articles';
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(fld, page, afterBbsDepth) {
  const q = new URLSearchParams({ grpid: GRPID, fldid: fld, pageSize: PAGE_SIZE, targetPage: page });
  if (afterBbsDepth) q.set('afterBbsDepth', afterBbsDepth);
  const res = await fetch(`${API}?${q}`, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': `https://m.cafe.daum.net/dongarry/${fld}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${fld} page ${page})`);
  const json = await res.json();
  if (!Array.isArray(json.articles)) throw new Error(`unexpected response (${fld} page ${page})`);
  return json.articles;
}

async function loadPrev() {
  try {
    const d = JSON.parse(await readFile(OUT, 'utf8'));
    // 구버전 데이터(게시판 구분 없음)는 게스트 구인으로 간주
    d.posts = (d.posts || []).map(p => p.key ? p : { ...p, board: 'guest', key: `Dilr:${p.id}` });
    return d;
  } catch { return { posts: [] }; }
}

async function fetchBoard(b, now) {
  const raw = [];
  let depth = null;
  for (let p = 1; p <= b.pages; p++) {
    const arts = await fetchPage(b.fld, p, depth);
    if (!arts.length) break;
    raw.push(...arts);
    depth = arts.at(-1).bbsDepth;
    const last = postedAt(arts.at(-1).articleElapsedTime, now);
    if ((now - Date.parse(last)) / 864e5 > 3) break; // 게시 3일 지난 글이 나오면 중단
    await sleep(DELAY_MS);
  }
  return raw.filter(a => !a.isNotice && !a.hasParentArticle).map(a => {
    const posted = postedAt(a.articleElapsedTime, now);
    return {
      key: `${b.fld}:${a.dataid}`,
      id: a.dataid,
      board: b.key,
      title: a.title.trim(),
      url: `https://m.cafe.daum.net/dongarry/${b.fld}/${a.dataid}`,
      posted,
      views: a.viewCount,
      head: a.headCont || '',
      ...parsePost(a.title, a.headCont, kstYmd(posted)),
    };
  });
}

async function main() {
  const now = Date.now();
  const today = kstYmd(new Date(now).toISOString());
  const prev = await loadPrev();
  const prevKeys = new Set(prev.posts.map(p => p.key));

  let kept = prev.posts;
  const fresh = [];
  const log = [];
  for (const b of BOARDS) {
    let got;
    try { got = await fetchBoard(b, now); }
    catch (e) { log.push(`${b.key}: 실패(${e.message}) — 기존 유지`); continue; }
    fresh.push(...got);
    // 삭제 감지: 이번에 훑은 id 범위 안인데 목록에 없으면 카페에서 삭제된 글 (응답이 적으면 보류)
    if (got.length >= 10) {
      const ids = new Set(got.map(p => p.id));
      const minId = Math.min(...ids);
      const before = kept.length;
      kept = kept.filter(p => !(p.board === b.key && p.id >= minId && !ids.has(p.id)));
      log.push(`${b.key}: ${got.length}건, 삭제 ${before - kept.length}`);
    } else log.push(`${b.key}: ${got.length}건`);
    await sleep(DELAY_MS);
  }
  if (!fresh.length) throw new Error('수집 0건 — 기존 data.json 유지');

  // 병합: 새로 받은 글 우선, 이전 글은 게시시각 유지
  // 이전 글도 매번 최신 분석 규칙으로 다시 분석 (분석기 개선이 기존 글에도 반영되도록)
  kept = kept.map(p => {
    const n = parsePost(p.title, p.head || '', kstYmd(p.posted));
    if (p.head === undefined && !n.region1) { n.region1 = p.region1; n.region2 = p.region2; } // 말머리 저장 전 글은 기존 지역 유지
    return { ...p, ...n };
  });
  const byKey = new Map(kept.map(p => [p.key, p]));
  for (const p of fresh) {
    const old = byKey.get(p.key);
    byKey.set(p.key, old ? { ...p, posted: old.posted } : p);
  }

  const yesterday = kstYmd(new Date(now - 864e5).toISOString());
  const posts = [...byKey.values()]
    .filter(p => p.date ? p.date >= yesterday : (now - Date.parse(p.posted)) / 864e5 <= 3)
    .sort((a, b) => Date.parse(b.posted) - Date.parse(a.posted) || b.id - a.id);

  // 같은 게시판에서 같은 제목 재게시는 최신 1건만
  const seen = new Set();
  const dedup = posts.filter(p => {
    const k = p.board + p.title.replace(/\s+/g, '');
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  const added = dedup.filter(p => !prevKeys.has(p.key)).map(p => p.key);
  await writeFile(OUT, JSON.stringify({
    updated: new Date(now).toISOString(), today,
    boards: BOARDS.map(({ fld, key, name }) => ({ fld, key, name, url: `https://m.cafe.daum.net/dongarry/${fld}` })),
    added, posts: dedup,
  }));
  console.log(log.join(' / '), `| saved=${dedup.length} added=${added.length}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
