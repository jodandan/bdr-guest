// 새로 수집된 글을 텔레그램 지역 채널로 보냄. scrape.mjs 다음에 실행.
// 필요한 설정 (GitHub → Settings → Secrets and variables → Actions)
//   Secret   TELEGRAM_BOT_TOKEN             : BotFather에서 받은 봇 토큰
//   Variable TG_CHANNEL_SEOUL, TG_CHANNEL_GYEONGGI, TG_CHANNEL_INCHEON : 예) @bdrguest_seoul
//   Variable TG_CHANNEL_ETC (선택)          : 지역을 모르는 글/그 외 지역
import { readFile } from 'node:fs/promises';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CH = {
  서울: process.env.TG_CHANNEL_SEOUL,
  경기: process.env.TG_CHANNEL_GYEONGGI,
  인천: process.env.TG_CHANNEL_INCHEON,
  기타: process.env.TG_CHANNEL_ETC,
};
const MAX_PER_RUN = 60;        // 첫 실행 등 한꺼번에 몰리면 전송 생략 (도배 방지)
const MAX_AGE_H = 3;           // 게시 3시간 넘은 글은 알리지 않음
const BOARD_LABEL = { guest: '게스트', pickup: '픽업게임', match: '연습경기' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const tag = s => '#' + String(s).replace(/[^\p{L}\p{N}_]/gu, '');

function message(p) {
  let when = '날짜 미정';
  if (p.date) {
    const [y, m, d] = p.date.split('-').map(Number);
    const wd = WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    when = `${m}/${d}(${wd})` + (p.start ? ` ${p.start}${p.end ? '~' + p.end : ''}` : '');
  }
  const region = [p.region1, p.region2].filter(Boolean).join(' ') || '지역 미정';
  const tags = [p.region1, p.region2, p.slot, p.date && WEEK[new Date(p.date).getUTCDay()] + '요일', BOARD_LABEL[p.board]]
    .filter(Boolean).map(tag).join(' ');
  return `🏀 <b>[${BOARD_LABEL[p.board] || '게스트'}] ${esc(region)} · ${esc(when)}</b>\n${esc(p.title)}\n${tags}\n<a href="${p.url}">원문 보기</a> · <a href="https://bdrguest.kro.kr/">전체 목록</a>`;
}

async function send(chat, text) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (res.status === 429) { const j = await res.json(); await sleep(((j.parameters?.retry_after) || 5) * 1000); return send(chat, text); }
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

async function main() {
  if (!TOKEN) { console.log('TELEGRAM_BOT_TOKEN 없음 — 알림 생략'); return; }
  const d = JSON.parse(await readFile(new URL('../docs/data.json', import.meta.url), 'utf8'));
  const added = new Set(d.added || []);
  const now = Date.now();
  const targets = d.posts
    .filter(p => added.has(p.key) && !p.closed && (now - Date.parse(p.posted)) / 3600e3 <= MAX_AGE_H)
    .sort((a, b) => Date.parse(a.posted) - Date.parse(b.posted));
  if (targets.length > MAX_PER_RUN) { console.log(`새 글 ${targets.length}건 — 초기 수집으로 보고 전송 생략`); return; }
  let sent = 0;
  for (const p of targets) {
    const chat = CH[p.region1] || CH.기타;
    if (!chat) continue;
    try { await send(chat, message(p)); sent++; } catch (e) { console.error(e.message); }
    await sleep(1500); // 채널당 분당 20건 제한 여유
  }
  console.log(`알림 ${sent}/${targets.length}건 전송`);
}

main().catch(e => { console.error(e.message); process.exit(0); }); // 알림 실패가 수집 커밋을 막지 않도록
