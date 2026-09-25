// BDR 게스트 모아보기 — 알림 서버 (Cloudflare Workers 무료 플랜)
// - POST /subscribe, /unsubscribe : 웹 푸시 구독 저장/삭제 (알림 주소 + 조건만 저장)
// - GET  /vapid                   : 푸시 공개키 (최초 요청 때 자동 생성해 KV에 보관)
// - cron(10분마다)                : 사이트 data.json의 새 글 확인 → 조건 맞는 구독자에게 푸시
//                                   + 매시 0·30분엔 GitHub 수집 워크플로 실행 요청
// 바인딩: KV "SUBS" / 시크릿: GH_TOKEN(선택, 워크플로 실행 권한)
const SITE = 'https://bdrguest.kro.kr';
const REPO = 'jodandan/bdr-guest';
const WORKFLOW = 'scrape.yml';
// 사이트 HTTPS 인증서 발급 전·장애 시에도 읽히도록 저장소 원본을 직접 읽는다
const DATA_URL = `https://raw.githubusercontent.com/${REPO}/main/docs/data.json`;
const ORIGINS = [SITE, 'http://bdrguest.kro.kr', 'http://localhost:8766'];

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = s => new TextEncoder().encode(s);
async function sha(s) { return b64u(await crypto.subtle.digest('SHA-256', enc(s))).slice(0, 32); }

function cors(req) {
  const o = req.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : SITE,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });

// ---- VAPID ----
async function vapid(env) {
  let v = await env.SUBS.get('vapid', 'json');
  if (!v) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    v = { priv: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)) };
    await env.SUBS.put('vapid', JSON.stringify(v));
  }
  return v;
}
export async function vapidJwt(v, endpoint, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: SITE })));
  const key = await crypto.subtle.importKey('jwk', v.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}
// 내용 없는 푸시(tickle): 알림 내용은 기기의 서비스워커가 사이트 목록을 읽어 조건에 맞게 만든다
async function push(v, sub) {
  const jwt = await vapidJwt(v, sub.endpoint);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { 'Authorization': `vapid t=${jwt}, k=${v.pub}`, 'TTL': '21600', 'Urgency': 'high', 'Content-Length': '0' },
  });
  return r.status;
}

// ---- 조건 매칭 (사이트/서비스워커와 같은 규칙) ----
export function matches(f, p) {
  if (p.closed) return false;
  if (f.boards?.length && !f.boards.includes(p.board || 'guest')) return false;
  if (f.regions?.length) { if (!f.regions.includes(p.region2 || '기타')) return false; }
  else if (f.r1 && f.r1 !== '전체' && (p.region1 || '기타') !== f.r1) return false;
  if (f.slots?.length && !f.slots.includes(p.slot)) return false;
  if (f.week && f.week !== '전체') {
    if (!p.date) return false;
    const w = new Date(p.date + 'T00:00:00Z').getUTCDay();
    if ((f.week === '주말') !== (w === 0 || w === 6)) return false;
  }
  return true;
}
function cleanFilters(f = {}) {
  const arr = (a, n = 40) => Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.length <= 20).slice(0, n) : [];
  return {
    boards: arr(f.boards, 3), r1: typeof f.r1 === 'string' ? f.r1.slice(0, 10) : '전체',
    regions: arr(f.regions), slots: arr(f.slots, 3), week: ['주말', '평일'].includes(f.week) ? f.week : '전체',
  };
}

async function listSubs(env) {
  const out = []; let cursor;
  do {
    const r = await env.SUBS.list({ prefix: 'sub:', cursor });
    for (const k of r.keys) { const v = await env.SUBS.get(k.name, 'json'); if (v) out.push({ id: k.name, ...v }); }
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return out;
}

// 새 글 확인 → 푸시
export async function checkAndPush(env, now = Date.now()) {
  const res = await fetch(`${DATA_URL}?t=${now}`, { cf: { cacheTtl: 0 } });
  if (!res.ok) return { error: `data.json ${res.status}` };
  const d = await res.json();
  const today = new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
  const live = (d.posts || []).filter(p => p.key && !p.closed && (!p.date || p.date >= today));
  const seen = new Set((await env.SUBS.get('seen', 'json')) || []);
  const first = seen.size === 0;
  const fresh = first ? [] : live.filter(p => !seen.has(p.key) && now - Date.parse(p.posted) < 6 * 3600e3);
  await env.SUBS.put('seen', JSON.stringify(live.map(p => p.key).slice(0, 2000)));
  if (!fresh.length) return { fresh: 0, first };
  const v = await vapid(env);
  let sent = 0, removed = 0;
  for (const s of await listSubs(env)) {
    if (!fresh.some(p => matches(s.filters, p))) continue;
    const st = await push(v, s.sub).catch(() => 0);
    if (st === 404 || st === 410) { await env.SUBS.delete(s.id); removed++; }
    else if (st >= 200 && st < 300) sent++;
  }
  return { fresh: fresh.length, sent, removed };
}

async function dispatchScrape(env) {
  if (!env.GH_TOKEN) return 'no token';
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.GH_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'bdrguest-worker', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main' }),
  });
  return r.status;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
    try {
      if (url.pathname === '/vapid' && req.method === 'GET') return json(req, { key: (await vapid(env)).pub });
      if (url.pathname === '/subscribe' && req.method === 'POST') {
        const body = await req.json();
        const sub = body.subscription;
        if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || JSON.stringify(body).length > 4000) return json(req, { error: 'bad request' }, 400);
        const id = 'sub:' + await sha(sub.endpoint);
        await env.SUBS.put(id, JSON.stringify({ sub: { endpoint: sub.endpoint }, filters: cleanFilters(body.filters), at: Date.now() }));
        return json(req, { ok: true });
      }
      if (url.pathname === '/unsubscribe' && req.method === 'POST') {
        const { endpoint } = await req.json();
        if (endpoint) await env.SUBS.delete('sub:' + await sha(endpoint));
        return json(req, { ok: true });
      }
      if (url.pathname === '/health') return json(req, { ok: true });
      return json(req, { error: 'not found' }, 404);
    } catch (e) { return json(req, { error: 'server error' }, 500); }
  },
  async scheduled(event, env, ctx) {
    const now = event.scheduledTime || Date.now();
    const min = new Date(now).getUTCMinutes();
    ctx.waitUntil((async () => {
      const r = await checkAndPush(env, now);
      console.log('push', JSON.stringify(r));
      if (min % 30 < 10) console.log('dispatch', await dispatchScrape(env));
    })());
  },
};
