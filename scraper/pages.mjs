// 검색엔진용 지역별 정적 페이지 + 사이트맵 생성 (수집 때마다 갱신)
// docs/r/<광역>/index.html, docs/r/<광역>/<동네>/index.html, docs/sitemap.xml
import { mkdir, writeFile, rm } from 'node:fs/promises';

const SITE = 'https://hoopguest.kro.kr';
const DOCS = new URL('../docs/', import.meta.url);
const GA_ID = 'G-0DWSLR5007';

export const R1 = { 서울: 'seoul', 경기: 'gyeonggi', 인천: 'incheon' };
// [표시명(데이터 region2), 슬러그, 위도, 경도]
export const DISTRICTS = {
  서울: [['강남', 'gangnam', 37.517, 127.047], ['강동', 'gangdong', 37.530, 127.124], ['강북', 'gangbuk', 37.640, 127.026], ['강서', 'gangseo', 37.551, 126.850], ['관악', 'gwanak', 37.478, 126.952], ['광진', 'gwangjin', 37.539, 127.082], ['구로', 'guro', 37.496, 126.888], ['금천', 'geumcheon', 37.457, 126.896], ['노원', 'nowon', 37.654, 127.057], ['도봉', 'dobong', 37.669, 127.047], ['동대문', 'dongdaemun', 37.574, 127.040], ['동작', 'dongjak', 37.512, 126.939], ['마포', 'mapo', 37.566, 126.902], ['서대문', 'seodaemun', 37.579, 126.937], ['서초', 'seocho', 37.484, 127.032], ['성동', 'seongdong', 37.563, 127.037], ['성북', 'seongbuk', 37.589, 127.017], ['송파', 'songpa', 37.515, 127.106], ['양천', 'yangcheon', 37.517, 126.866], ['영등포', 'yeongdeungpo', 37.526, 126.896], ['용산', 'yongsan', 37.532, 126.991], ['은평', 'eunpyeong', 37.603, 126.929], ['종로', 'jongno', 37.574, 126.979], ['중구', 'jung-gu', 37.564, 126.998], ['중랑', 'jungnang', 37.607, 127.093]],
  인천: [['부평', 'bupyeong', 37.507, 126.722], ['남동', 'namdong', 37.447, 126.731], ['연수', 'yeonsu', 37.410, 126.678], ['계양', 'gyeyang', 37.537, 126.738], ['서해', 'seohae', 37.533, 126.652], ['검단', 'geomdan', 37.598, 126.662], ['미추홀', 'michuhol', 37.464, 126.651], ['제물포', 'jemulpo', 37.474, 126.632], ['영종', 'yeongjong', 37.492, 126.530]],
  경기: [['수원', 'suwon', 37.264, 127.029], ['성남', 'seongnam', 37.420, 127.127], ['용인', 'yongin', 37.280, 127.120], ['고양', 'goyang', 37.658, 126.832], ['부천', 'bucheon', 37.503, 126.766], ['안양', 'anyang', 37.394, 126.957], ['안산', 'ansan', 37.322, 126.831], ['화성', 'hwaseong', 37.200, 126.980], ['평택', 'pyeongtaek', 36.992, 127.113], ['의정부', 'uijeongbu', 37.738, 127.034], ['남양주', 'namyangju', 37.636, 127.217], ['시흥', 'siheung', 37.380, 126.803], ['파주', 'paju', 37.760, 126.780], ['김포', 'gimpo', 37.615, 126.716], ['광명', 'gwangmyeong', 37.479, 126.865], ['군포', 'gunpo', 37.362, 126.935], ['하남', 'hanam', 37.539, 127.215], ['오산', 'osan', 37.150, 127.077], ['이천', 'icheon', 37.272, 127.435], ['안성', 'anseong', 37.008, 127.280], ['구리', 'guri', 37.594, 127.130], ['의왕', 'uiwang', 37.345, 126.968], ['양주', 'yangju', 37.785, 127.046], ['포천', 'pocheon', 37.895, 127.200], ['동두천', 'dongducheon', 37.904, 127.061], ['과천', 'gwacheon', 37.429, 126.988], ['여주', 'yeoju', 37.298, 127.637], ['양평', 'yangpyeong', 37.492, 127.488], ['가평', 'gapyeong', 37.832, 127.511], ['경기광주', 'gwangju', 37.429, 127.255]],
};
const BOARD_NAME = { guest: '게스트', pickup: '픽업게임', match: '연습경기·교류전' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// a, b = [광역, 동네, 슬러그, 위도, 경도]
const km = (a, b) => { const R = 6371, t = x => x * Math.PI / 180; const h = Math.sin(t(b[3] - a[3]) / 2) ** 2 + Math.cos(t(a[3])) * Math.cos(t(b[3])) * Math.sin(t(b[4] - a[4]) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const unent = s => String(s ?? '').replace(/&(amp|lt|gt|quot|#34|#39);/g, (_, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#34': '"', '#39': "'" }[k]));
const where = p => p.region2 ? label(p.region1, p.region2) : (p.region1 || '');
const label = (r1, d) => d === '경기광주' ? '경기 광주' : `${r1} ${d}`;
function dayLabel(ymd, today) {
  if (!ymd) return '날짜 미정';
  const [y, m, d] = ymd.split('-').map(Number), w = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const t = new Date(Date.parse(today + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
  return `${ymd === today ? '오늘 · ' : ymd === t ? '내일 · ' : ''}${m}/${d} (${w})`;
}

function page({ path, title, desc, h1, intro, posts, today, updated, crumbs, links, cta, home }) {
  const url = `${SITE}${path}`;
  const groups = new Map();
  for (const p of posts) { const k = p.date || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  const list = posts.length ? [...groups].map(([d, ps]) => `<h2>${esc(dayLabel(d, today))} <small>${ps.length}건</small></h2><ul>${ps.map(p => `<li><span class="t">${esc(p.start || p.slot || '시간 미정')}</span><a href="${esc(p.url)}" rel="nofollow noopener" target="_blank">${esc(unent(p.title))}</a><span class="m">${home && p.region2 !== home ? `<b class="near">근처 ${esc(where(p))}</b> · ` : ''}${p.src === 'naver' ? '네이버 농심카페' : '다음 BDR 동아리농구방'} · ${BOARD_NAME[p.board] || '게스트'}</span></li>`).join('')}</ul>`).join('')
    : '<p class="empty">지금은 모집 글이 없어요. 가까운 지역이나 전체 목록을 확인해 보세요.</p>';
  const ld = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: h1, numberOfItems: posts.length, itemListElement: posts.slice(0, 30).map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: unent(p.title), url: p.url })) }];
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:locale" content="ko_KR"><meta property="og:site_name" content="훕게스트">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/og.png">
<meta name="theme-color" content="#E0201B"><link rel="icon" href="/ball.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>
:root{--bg:#FFFDF6;--text:#0E0E10;--sub:#4E4E55;--line:#0E0E10;--accent:#C8161B;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#121214;--text:#F4F1E8;--sub:#B4B0A8;--line:#F4F1E8;--accent:#FF7A6E;--card:#1C1C20}}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 "Noto Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.w{max-width:720px;margin:0 auto;padding:0 16px 40px}
header{background:#E0201B;color:#fff;padding:18px 0 16px;border-bottom:3px solid #0E0E10}
header a{color:#fff;font-weight:700;text-decoration:none}
nav.bc{font-size:13px;margin:14px 0 4px;color:var(--sub)} nav.bc a{color:var(--sub)}
h1{font-size:24px;line-height:1.3;margin:6px 0 8px}
.intro{color:var(--sub);margin:0 0 14px}
.cta{display:inline-block;background:#C8161B;color:#fff;font-weight:700;padding:11px 16px;border:3px solid var(--line);text-decoration:none;box-shadow:4px 4px 0 var(--line);margin:4px 0 8px}
h2{font-size:17px;margin:24px 0 8px;padding-bottom:4px;border-bottom:2px solid var(--line)} h2 small{font-size:13px;color:var(--sub);font-weight:500}
ul{list-style:none;margin:0;padding:0}
li{background:var(--card);border:2px solid var(--line);padding:10px 12px;margin-bottom:8px;display:grid;grid-template-columns:auto 1fr;gap:2px 12px}
li .t{font-weight:700;grid-row:span 2;min-width:44px}
li a{color:var(--text);text-decoration:none;word-break:keep-all;overflow-wrap:anywhere} li a:hover{text-decoration:underline}
li .m{font-size:13px;color:var(--sub)} li .near{color:var(--text)}
.empty{padding:20px;border:2px dashed var(--line);background:var(--card)}
.links{margin-top:28px} .links h2{font-size:15px} .links a{display:inline-block;margin:4px 10px 4px 0;color:var(--text)}
footer{font-size:13px;color:var(--sub);margin-top:28px;line-height:1.6}
a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
</style>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}if(location.hostname==='hoopguest.kro.kr'){const s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';document.head.appendChild(s);gtag('js',new Date());gtag('config','${GA_ID}')}</script>
</head><body>
<header><div class="w" style="padding-bottom:0"><a href="/">🏀 훕게스트</a></div></header>
<main class="w">
<nav class="bc" aria-label="위치">${crumbs.map(([n, u], i) => i === crumbs.length - 1 ? esc(n) : `<a href="${u}">${esc(n)}</a> › `).join('')}</nav>
<h1>${esc(h1)}</h1>
<p class="intro">${esc(intro)}</p>
<a class="cta" href="${esc(cta)}">날짜·시간 필터로 보기 →</a>
${list}
<section class="links">${links.map(([t, ls]) => `<h2>${esc(t)}</h2><p>${ls.map(([n, u]) => `<a href="${u}">${esc(n)}</a>`).join('')}</p>`).join('')}</section>
<footer>다음카페 [BDR]동아리농구방과 네이버 카페 NSB 농심카페(운영진 허락)의 공개 글 제목만 모아 30분마다 갱신하는 비공식 사이트입니다. 비용·장소·연락처는 원문에서 확인하세요. 마지막 갱신: ${esc(new Date(Date.parse(updated) + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' '))} (KST)</footer>
</main></body></html>`;
}


// 글 하나 공유용 페이지 /p/<키>/ — 카톡 등에 링크를 보내면 미리보기에 일시·동네가 보이게
export const postSlug = key => String(key).replace(/[^A-Za-z0-9]/g, '-');
function postPage(p, today) {
  const path = `/p/${postSlug(p.key)}/`, url = `${SITE}${path}`;
  const t = unent(p.title);
  const abs = ymd => { const [y, m, d] = ymd.split('-').map(Number); return `${m}/${d} (${WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`; }; // 공유 미리보기는 '오늘·내일' 대신 날짜로
  const when = [p.date ? abs(p.date) : '날짜는 원문 확인', p.start ? `${p.start}${p.end ? '~' + p.end : ''}` : ''].filter(Boolean).join(' ');
  const place = where(p) || '지역은 원문 확인';
  const kind = BOARD_NAME[p.board] || '게스트';
  const src = p.src === 'naver' ? '네이버 농심카페' : '다음 BDR 동아리농구방';
  const ogTitle = `🏀 ${when} · ${place} ${kind} 모집`;
  const desc = `${t} — ${src} 글이에요. 훕게스트에서 수도권 농구 게스트·픽업게임·교류전 모집 글을 한눈에 모아봐요.`;
  const q = new URLSearchParams();
  if (p.region1) q.set('r', p.region1);
  if (p.region2) q.set('r2', p.region2);
  if (p.date && p.date >= today) q.set('d', p.date);
  if (p.board && p.board !== 'guest') q.set('b', p.board);
  const more = `/?${q}`;
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ogTitle)} | 훕게스트</title>
<meta name="description" content="${esc(desc)}"><meta name="robots" content="noindex,follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:locale" content="ko_KR"><meta property="og:site_name" content="훕게스트">
<meta property="og:title" content="${esc(ogTitle)}"><meta property="og:description" content="${esc(t)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#E0201B"><link rel="icon" href="/ball.svg" type="image/svg+xml">
<style>
:root{--bg:#FFFDF6;--text:#0E0E10;--sub:#4E4E55;--line:#0E0E10;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#121214;--text:#F4F1E8;--sub:#B4B0A8;--line:#F4F1E8;--card:#1C1C20}}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 "Noto Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.w{max-width:560px;margin:0 auto;padding:0 16px 40px}
header{background:#E0201B;color:#fff;padding:16px 0;border-bottom:3px solid #0E0E10}
header a{color:#fff;font-weight:700;text-decoration:none}
.c{margin:20px 0 14px;background:var(--card);border:3px solid var(--line);box-shadow:5px 5px 0 var(--line);padding:16px}
.when{font-size:22px;font-weight:800;line-height:1.3}
.where{display:inline-block;margin:8px 0 10px;background:#FFE14D;color:#0E0E10;font-weight:700;font-size:14px;padding:2px 8px;border:2px solid #0E0E10}
.t{font-size:16px;word-break:keep-all;overflow-wrap:anywhere;margin:0 0 6px}
.m{font-size:13px;color:var(--sub)}
.x{margin:0 0 10px;padding:6px 10px;border:2px dashed var(--line);font-weight:700}
.b{display:block;text-align:center;font-weight:700;padding:13px 16px;border:3px solid var(--line);text-decoration:none;margin:10px 0}
.b1{background:#C8161B;color:#fff;box-shadow:4px 4px 0 var(--line)}
.b2{background:var(--card);color:var(--text)}
p.f{font-size:13px;color:var(--sub);margin-top:22px;line-height:1.6}
a:focus-visible{outline:3px solid #E0201B;outline-offset:2px}
</style>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}if(location.hostname==='hoopguest.kro.kr'){const s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id=${GA_ID}';document.head.appendChild(s);gtag('js',new Date());gtag('config','${GA_ID}');gtag('event','shared_post_view',{post_id:'${esc(p.key)}'})}</script>
</head><body>
<header><div class="w" style="padding-bottom:0"><a href="/">🏀 훕게스트</a></div></header>
<main class="w">
<div class="c">
${p.closed ? '<p class="x">마감됐다고 표시된 글이에요. 아래에서 다른 글을 찾아보세요.</p>' : ''}<div class="when">${esc(when)}</div>
<span class="where">${esc(place)} · ${esc(kind)}</span>
<p class="t">${esc(t)}</p>
<div class="m">${esc(src)} 글 · 비용·장소·연락처는 원문에서 확인하세요</div>
</div>
<a class="b b1" href="${esc(p.url)}" rel="nofollow noopener">카페 원문 보고 신청하기 →</a>
<a class="b b2" href="${esc(more)}">${esc(p.region2 ? place : '수도권')} 다른 모집 글 더 보기</a>
<p class="f">훕게스트는 다음카페 [BDR]동아리농구방과 네이버 NSB 농심카페(운영진 허락)의 농구 게스트·픽업게임·교류전 모집 글 제목을 모아 30분마다 갱신하는 비공식 사이트예요. 지역·날짜·시간대로 골라 보고, 새 글 알림도 받을 수 있어요.</p>
</main></body></html>`;
}

export async function buildPages(data) {
  const today = data.today, updated = data.updated;
  const live = data.posts.filter(p => !p.closed && (p.date ? p.date >= today : (Date.parse(updated) - Date.parse(p.posted)) / 864e5 <= 2))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.start || '99').localeCompare(b.start || '99'));
  const ymdK = today.replace(/-/g, '.');
  const out = []; // [path, html]
  const all = Object.entries(DISTRICTS).flatMap(([r1, ds]) => ds.map(d => [r1, ...d]));
  const r1Links = Object.entries(R1).map(([r, s]) => [`${r} 농구 게스트`, `/r/${s}/`]);
  for (const [r1, s1] of Object.entries(R1)) {
    const ps = live.filter(p => p.region1 === r1);
    const byD = DISTRICTS[r1].map(([n, s]) => [`${n === '경기광주' ? '광주' : n} (${ps.filter(p => p.region2 === n).length})`, `/r/${s1}/${s}/`]);
    out.push([`/r/${s1}/`, page({
      path: `/r/${s1}/`, today, updated,
      title: `${r1} 농구 게스트 모집 · 픽업게임 · 교류전 | 훕게스트`,
      desc: `${r1} 지역 농구 게스트 구인, 픽업게임, 연습경기·교류전 모집 글 ${ps.length}건을 날짜·시간순으로 모았어요. ${ymdK} 기준, 30분마다 갱신.`,
      h1: `${r1} 농구 게스트 · 픽업게임 · 교류전`,
      intro: `${r1} 지역에서 지금 올라온 농구 게스트 구함, 픽업게임, 연습경기 모집 글이에요. 제목을 누르면 카페 원문으로 이동해요.`,
      posts: ps, crumbs: [['홈', '/'], [`${r1}`, `/r/${s1}/`]],
      links: [[`${r1} 동네별`, byD], ['다른 지역', r1Links.filter(([, u]) => u !== `/r/${s1}/`)]],
      cta: `/?r=${encodeURIComponent(r1)}`,
    })]);
    for (const [n, s, la, lo] of DISTRICTS[r1]) {
      const me = [r1, n, s, la, lo];
      const near = all.filter(d => d[1] !== n).map(d => [d, km(me, d)]).sort((a, b) => a[1] - b[1]).slice(0, 8);
      const nearNames = new Set([n, ...near.slice(0, 5).map(([d]) => d[1])]);
      const mine = live.filter(p => p.region1 === r1 && p.region2 === n);
      const nearby = live.filter(p => p.region2 && nearNames.has(p.region2) && !(p.region1 === r1 && p.region2 === n));
      const nm = label(r1, n);
      out.push([`/r/${s1}/${s}/`, page({
        path: `/r/${s1}/${s}/`, today, updated,
        title: `${nm} 농구 게스트 모집 · 픽업게임 · 교류전 | 훕게스트`,
        desc: `${nm} 농구 게스트 구함·픽업게임·교류전 모집 글을 날짜·시간순으로 모아봐요.${mine.length ? ` 지금 ${mine.length}건` : ''}${nearby.length ? `${mine.length ? ',' : ' 지금'} 근처 지역 ${nearby.length}건` : ''}. 30분마다 갱신.`,
        h1: `${nm} 농구 게스트 · 픽업게임`,
        intro: mine.length >= 3 ? `${nm}에서 지금 모집 중인 농구 게스트·픽업게임·교류전 글 ${mine.length}건이에요.` : mine.length ? `${nm} 글 ${mine.length}건과 가까운 지역 글을 함께 보여 드려요.` : `${nm}에는 지금 모집 글이 없어요. 가까운 지역 글을 대신 보여 드려요.`,
        posts: mine.length >= 3 ? mine : [...mine, ...nearby].slice(0, 40),
        crumbs: [['홈', '/'], [r1, `/r/${s1}/`], [nm, `/r/${s1}/${s}/`]],
        links: [['가까운 지역', near.map(([d]) => [label(d[0], d[1]), `/r/${R1[d[0]]}/${d[2]}/`])], ['광역 지역', r1Links]],
        cta: `/?r=${encodeURIComponent('내 근처')}&h=${encodeURIComponent(n)}&km=10`, home: n,
      })]);
    }
  }
  await rm(new URL('r/', DOCS), { recursive: true, force: true });
  // 글별 공유 페이지 (검색 노출 안 함, 사이트맵 제외)
  await rm(new URL('p/', DOCS), { recursive: true, force: true });
  for (const p of data.posts) {
    if (!p.key) continue;
    const dir = new URL(`p/${postSlug(p.key)}/`, DOCS);
    await mkdir(dir, { recursive: true });
    await writeFile(new URL('index.html', dir), postPage(p, today));
  }
  for (const [path, html] of out) {
    const dir = new URL('.' + path, DOCS);
    await mkdir(dir, { recursive: true });
    await writeFile(new URL('index.html', dir), html);
  }
  const lastmod = updated.slice(0, 10);
  const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}/</loc><lastmod>${lastmod}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>\n${out.map(([p]) => `  <url><loc>${SITE}${p}</loc><lastmod>${lastmod}</lastmod><changefreq>hourly</changefreq><priority>${p.split('/').length === 4 ? '0.8' : '0.6'}</priority></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(new URL('sitemap.xml', DOCS), sm);
  return out.length;
}
