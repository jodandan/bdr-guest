// 훕게스트 계정(카카오 로그인, 선택) — 저장한 글·설정·알림 조건을 기기끼리 동기화
// - GET  /auth/kakao?mode=login|withdraw&return=… : 카카오 로그인 화면으로 보냄
// - GET  /auth/kakao/callback                     : 로그인 완료 → 사이트로 돌아가며 #login=<토큰> 전달
//                                                   (탈퇴 모드면 카카오 연결 끊기 + 데이터 삭제 → #withdrawn=1)
// - GET  /me · PUT /me                             : 내 데이터 읽기·저장 (Authorization: Bearer <토큰>)
// - POST /logout                                   : 이 기기 로그인 토큰 삭제
// 저장소: D1 "DB" — users(uid, data, updated, created) · sessions(th, uid, created) · logins(state, ret, mode, created) · meta(k, v)
// 개인정보: 카카오에서 받는 건 회원번호뿐. 서버엔 '비밀 소금 + 회원번호'의 SHA-256 값(uid)만 저장하고,
//           회원번호 원문·이름·이메일·카카오 토큰은 저장하지 않는다. 로그인 토큰도 해시로만 보관.
// 시크릿: KAKAO_REST_KEY(로그인에 쓸 REST API 키) / 선택: KAKAO_CLIENT_SECRET(카카오 콘솔에서 켰을 때만)
const SITE = 'https://hoopguest.kro.kr';
const RETURN_OK = [SITE, 'https://bdrguest.kro.kr', 'https://jodandan.github.io'];
const SESSION_MS = 180 * 864e5, STATE_MS = 10 * 60e3, MAX_DATA = 32000;

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
const sha = async s => b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

let ready = null;
function init(env) {
  if (!ready) ready = env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL, created INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS sessions (th TEXT PRIMARY KEY, uid TEXT NOT NULL, created INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS logins (state TEXT PRIMARY KEY, ret TEXT NOT NULL, mode TEXT NOT NULL, created INTEGER NOT NULL)'),
  ]).catch(e => { ready = null; throw e; });
  return ready;
}
async function salt(env) {
  const row = await env.DB.prepare("SELECT v FROM meta WHERE k = 'salt'").first();
  if (row) return row.v;
  await env.DB.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('salt', ?)").bind(rand(32)).run();
  return (await env.DB.prepare("SELECT v FROM meta WHERE k = 'salt'").first()).v;
}
function safeReturn(r) {
  try { const u = new URL(r); if (RETURN_OK.includes(u.origin)) return u.origin + u.pathname + u.search; } catch {}
  return SITE + '/';
}
const back = (ret, frag) => new Response(null, { status: 302, headers: { Location: `${ret}#${frag}`, 'Cache-Control': 'no-store' } });

async function who(req, env) {
  const m = /^Bearer ([A-Za-z0-9_-]{20,})$/.exec(req.headers.get('Authorization') || '');
  if (!m) return null;
  const row = await env.DB.prepare('SELECT uid, created FROM sessions WHERE th = ?').bind(await sha(m[1])).first();
  if (!row || Date.now() - row.created > SESSION_MS) return null;
  return { uid: row.uid, th: await sha(m[1]) };
}

// 계정 경로가 아니면 null을 돌려준다 (worker.js의 나머지 경로로 넘어감)
export async function handleAccount(req, env, url, json) {
  const p = url.pathname;
  if (!['/auth/kakao', '/auth/kakao/callback', '/me', '/logout'].includes(p)) return null;
  if (!env.DB || !env.KAKAO_REST_KEY) return json(req, { error: 'login not configured' }, 503);
  await init(env);

  if (p === '/auth/kakao' && req.method === 'GET') {
    const mode = url.searchParams.get('mode') === 'withdraw' ? 'withdraw' : 'login';
    const state = rand(18), ret = safeReturn(url.searchParams.get('return') || '');
    await env.DB.prepare('INSERT INTO logins (state, ret, mode, created) VALUES (?, ?, ?, ?)').bind(state, ret, mode, Date.now()).run();
    const q = new URLSearchParams({ response_type: 'code', client_id: env.KAKAO_REST_KEY, redirect_uri: url.origin + '/auth/kakao/callback', state });
    return new Response(null, { status: 302, headers: { Location: 'https://kauth.kakao.com/oauth/authorize?' + q, 'Cache-Control': 'no-store' } });
  }

  if (p === '/auth/kakao/callback' && req.method === 'GET') {
    const state = url.searchParams.get('state') || '';
    const st = await env.DB.prepare('SELECT ret, mode, created FROM logins WHERE state = ?').bind(state).first();
    await env.DB.prepare('DELETE FROM logins WHERE state = ? OR created < ?').bind(state, Date.now() - STATE_MS).run();
    if (!st || Date.now() - st.created > STATE_MS) return back(SITE + '/', 'login_error=expired');
    const code = url.searchParams.get('code');
    if (!code) return back(st.ret, 'login_error=cancel');
    const form = new URLSearchParams({ grant_type: 'authorization_code', client_id: env.KAKAO_REST_KEY, redirect_uri: url.origin + '/auth/kakao/callback', code });
    if (env.KAKAO_CLIENT_SECRET) form.set('client_secret', env.KAKAO_CLIENT_SECRET);
    const tr = await fetch('https://kauth.kakao.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: form });
    const tok = await tr.json().catch(() => ({}));
    if (!tr.ok || !tok.access_token) { console.log('kakao token', tr.status, tok.error_code || tok.error || ''); return back(st.ret, 'login_error=token'); }
    const auth = { Authorization: `Bearer ${tok.access_token}` };
    const me = await fetch('https://kapi.kakao.com/v2/user/me', { headers: auth }).then(r => r.json()).catch(() => ({}));
    if (!me.id) return back(st.ret, 'login_error=user');
    const uid = await sha(`${await salt(env)}:${me.id}`);
    if (st.mode === 'withdraw') {
      await fetch('https://kapi.kakao.com/v1/user/unlink', { method: 'POST', headers: auth }).catch(() => {});
      await env.DB.batch([env.DB.prepare('DELETE FROM users WHERE uid = ?').bind(uid), env.DB.prepare('DELETE FROM sessions WHERE uid = ?').bind(uid)]);
      return back(st.ret, 'withdrawn=1');
    }
    const now = Date.now(), t = rand(32);
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO users (uid, data, updated, created) VALUES (?, '{}', 0, ?)").bind(uid, now),
      env.DB.prepare('INSERT INTO sessions (th, uid, created) VALUES (?, ?, ?)').bind(await sha(t), uid, now),
      env.DB.prepare('DELETE FROM sessions WHERE created < ?').bind(now - SESSION_MS),
    ]);
    return back(st.ret, 'login=' + t);
  }

  const u = await who(req, env);
  if (!u) return json(req, { error: 'login required' }, 401);
  if (p === '/me' && req.method === 'GET') {
    const row = await env.DB.prepare('SELECT data, updated FROM users WHERE uid = ?').bind(u.uid).first();
    if (!row) return json(req, { error: 'login required' }, 401);
    return json(req, { data: JSON.parse(row.data || '{}'), updated: row.updated });
  }
  if (p === '/me' && req.method === 'PUT') {
    const text = await req.text();
    if (text.length > MAX_DATA) return json(req, { error: 'too large' }, 413);
    let body; try { body = JSON.parse(text); } catch { return json(req, { error: 'bad request' }, 400); }
    if (!body || typeof body.data !== 'object' || Array.isArray(body.data)) return json(req, { error: 'bad request' }, 400);
    const now = Date.now();
    await env.DB.prepare('UPDATE users SET data = ?, updated = ? WHERE uid = ?').bind(JSON.stringify(body.data), now, u.uid).run();
    return json(req, { ok: true, updated: now });
  }
  if (p === '/logout' && req.method === 'POST') {
    await env.DB.prepare('DELETE FROM sessions WHERE th = ?').bind(u.th).run();
    return json(req, { ok: true });
  }
  return json(req, { error: 'not found' }, 404);
}
