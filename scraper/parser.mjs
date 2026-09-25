// 게스트 구인 글 제목 → 지역/날짜/시간 구조화
// 브라우저·Node 공용 (의존성 없음)

export const REGION1 = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

// 세부지역 사전: [표시명, 광역, 매칭 키워드...]
const DISTRICTS = [
  // 서울
  ['강남', '서울', '강남', '압구정', '청담', '수서', '삼성동', '대치', '역삼', '개포', '일원'],
  ['강동', '서울', '강동', '천호', '길동', '암사', '고덕', '둔촌'],
  ['강북', '서울', '강북', '수유', '미아'],
  ['강서', '서울', '강서', '마곡', '화곡', '발산', '등촌'],
  ['관악', '서울', '관악', '신림', '봉천', '서울대'],
  ['광진', '서울', '광진', '건대', '자양', '구의'],
  ['구로', '서울', '구로', '개봉', '오류', '고척', '신도림'],
  ['금천', '서울', '금천', '독산', '가산', '시흥동'],
  ['노원', '서울', '노원', '중계', '상계', '하계', '월계', '공릉'],
  ['도봉', '서울', '도봉', '창동', '방학', '쌍문'],
  ['동대문', '서울', '동대문', '토모짐', '장안', '청량리', '회기', '답십리', '용두'],
  ['동작', '서울', '동작', '상도', '노량진', '사당', '흑석', '대방', '신대방'],
  ['마포', '서울', '마포', '상암', '합정', '망원', '홍대', '공덕', '성산'],
  ['서대문', '서울', '서대문', '신촌', '연희', '홍제', '북가좌', '남가좌'],
  ['서초', '서울', '서초', '방배', '반포', '양재', '잠원', '내곡'],
  ['성동', '서울', '성동', '왕십리', '성수', '행당', '금호', '옥수'],
  ['성북', '서울', '성북', '석계', '길음', '정릉', '돈암', '종암', '장위', '월곡', '안암'],
  ['송파', '서울', '송파', '잠실', '문정', '가락', '방이', '오금', '거여', '마천', '위례'],
  ['양천', '서울', '양천', '목동', '신정', '신월'],
  ['영등포', '서울', '영등포', '여의도', '당산', '문래', '대림', '신길'],
  ['용산', '서울', '용산', '이촌', '이태원', '한남', '효창', '보성여고'],
  ['은평', '서울', '은평', '불광', '연신내', '응암', '녹번', '진관'],
  ['종로', '서울', '종로', '혜화', '평창동'],
  ['중구', '서울', '중구', '신당', '을지로', '충무로'],
  ['중랑', '서울', '중랑', '면목', '상봉', '망우', '묵동', '신내'],
  // 인천
  ['부평', '인천', '부평', '십정', '삼산', '갈산', '산곡'],
  ['남동', '인천', '남동', '구월', '논현', '간석', '만수', '소래'],
  ['연수', '인천', '연수', '송도'],
  ['계양', '인천', '계양', '작전', '계산'],
  ['서구(인천)', '인천', '청라', '검단', '가정동', '석남', '인천서구', '인천 서구'],
  ['미추홀', '인천', '미추홀', '주안', '학익', '용현', '도화'],
  ['인천중구', '인천', '영종', '운서', '인천중구'],
  ['동구(인천)', '인천', '인천동구', '송림'],
  // 경기
  ['수원', '경기', '수원', '영통', '광교', '권선', '장안구', '팔달', '매탄'],
  ['성남', '경기', '성남', '분당', '판교', '정자', '서현', '야탑', '모란', '수정구', '중원구'],
  ['용인', '경기', '용인', '기흥', '수지', '죽전', '동백', '처인', '보정', '구성'],
  ['고양', '경기', '고양', '일산', '화정', '행신', '덕양', '삼송', '원흥', '킨텍스', '우장'],
  ['부천', '경기', '부천', '심원중', '중동', '상동', '송내', '역곡', '소사'],
  ['안양', '경기', '안양', '평촌', '범계', '인덕원', '정관장'],
  ['안산', '경기', '안산', '고잔', '초지', '상록', '단원'],
  ['화성', '경기', '화성', '동탄', '봉담', '병점', '향남'],
  ['평택', '경기', '평택', '고덕국제', '송탄'],
  ['의정부', '경기', '의정부', '민락'],
  ['남양주', '경기', '남양주', '별내', '다산', '호평', '평내', '진접', '오남'],
  ['시흥', '경기', '시흥', '배곧', '정왕', '은계', '신천역', '목감'],
  ['파주', '경기', '파주', '운정', '금촌', '교하'],
  ['김포', '경기', '김포', '장기', '구래', '풍무', '운양', '걸포'],
  ['광명', '경기', '광명', '하안', '철산', '소하', '일직'],
  ['군포', '경기', '군포', '산본', '금정'],
  ['하남', '경기', '하남', '미사', '감일'],
  ['오산', '경기', '오산', '세교'],
  ['이천', '경기', '이천'],
  ['안성', '경기', '안성'],
  ['구리', '경기', '구리', '갈매', '인창'],
  ['의왕', '경기', '의왕', '포일', '내손'],
  ['양주', '경기', '양주', '옥정', '덕정'],
  ['포천', '경기', '포천'],
  ['동두천', '경기', '동두천'],
  ['과천', '경기', '과천'],
  ['여주', '경기', '여주'],
  ['양평', '경기', '양평'],
  ['가평', '경기', '가평'],
  ['경기광주', '경기', '경기광주', '경기 광주', '광주시', '오포', '태전', '경안'],
];

// 긴 키워드 우선 매칭 (예: '동대문'이 '대문'보다, '서대문'이 먼저)
const KEYWORDS = DISTRICTS.flatMap(([name, r1, ...kws]) => kws.map(k => ({ k, name, r1 })))
  .sort((a, b) => b.k.length - a.k.length);

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
// 날짜는 모두 "KST 자정 기준 UTC Date"로 다룸 (UTC 필드 = KST 날짜)
const mk = (y, m, d) => new Date(Date.UTC(y, m - 1, d));

export function normalize(title) {
  return title
    .replace(/[ㅡ－]/g, '-')
    .replace(/(?<!\d)([01]\d|2[0-4])([0-5]\d)\s*([~\-])\s*([01]\d|2[0-4])([0-5]\d)(?!\d)/g, '$1:$2$3$4:$5')
    .replace(/(\d{1,2})\s*시\s*(\d{2})(?=\s*(?:~|-|부터))/g, '$1:$2')
    .replace(/(\d{1,2})\s*시\s*(\d{1,2})\s*분\s+(\d{1,2})\s*시/g, '$1시$2분~$3시')
    .replace(/(\d{1,2})\s*시\s*(\d{1,2})\s*시/g, '$1시~$2시')
    .replace(/[＜〈<]/g, '<').replace(/[＞〉>]/g, '>')
    .replace(/[～〜]/g, '~').replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ').trim();
}

export function parseRegion(title, headCont) {
  const t = title.replace(/\s+/g, '');
  let r1 = headCont && REGION1.includes(headCont) ? headCont : null;
  // 제목 앞부분(12자 이내)에 광역명이 명시돼 있으면 말머리보다 우선 (예: 말머리 경기 + '[인천서구]')
  const lead = t.slice(0, 12).match(new RegExp(`(${REGION1.filter(r => r !== '광주').join('|')})`));
  if (lead) r1 = lead[1];
  let hit = null;
  for (const kw of KEYWORDS) {
    const k = kw.k.replace(/\s+/g, '');
    if (k.length < 2) continue;
    const i = t.indexOf(k);
    if (i < 0) continue;
    // '서울' 같은 광역명과 겹치는 오탐 방지: '중구'는 앞이 광역 없이 단독일 때만
    if (!hit || i < hit.i) hit = { ...kw, i };
  }
  if (!r1) {
    // 제목 앞쪽의 광역명 (광주는 세부지역 사전에서 경기광주 매칭 여부로 판단)
    const m = t.match(new RegExp(`(${REGION1.join('|')})`));
    if (m) r1 = m[1];
  }
  if (!r1 && hit) r1 = hit.r1;
  // 광역이 명시됐는데 세부지역 광역이 다르면 세부지역 버림 (예: 광주광역시 vs 경기광주)
  let r2 = hit && (!r1 || hit.r1 === r1) ? hit.name : null;
  if (r1 === '광주' && headCont === '경기') { r1 = '경기'; r2 = '경기광주'; }
  return { region1: r1, region2: r2 };
}

// 날짜: posted(KST 날짜 Date) 기준으로 가장 그럴듯한 날짜
export function parseDate(title, posted) {
  const t = title;
  const py = posted.getUTCFullYear(), pm = posted.getUTCMonth() + 1, pd = posted.getUTCDate();
  const fix = (m, d) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    let dt = mk(py, m, d);
    // 게시일보다 60일 넘게 과거면 내년
    if ((posted - dt) / 864e5 > 60) dt = mk(py + 1, m, d);
    return dt;
  };
  let m, span = null, dt = null;
  if ((m = t.match(/(?:20\d{2}\s*[년.\-/]\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일?/))) { dt = fix(+m[1], +m[2]); span = m[0]; }
  else if ((m = t.match(/(?<![\d:])(\d{1,2})\s*[/.]\s*(\d{1,2})(?![\d:])\s*\.?\s*일?/))) { dt = fix(+m[1], +m[2]); span = m[0]; }
  else if ((m = t.match(/(?<![\d:])(\d{1,2})\s*-\s*(\d{1,2})\s*일/))) { dt = fix(+m[1], +m[2]); span = m[0]; }
  else if ((m = t.match(/(?<![\d:~\-])(\d{1,2})\s*일(?!\s*[~\-])/))) {
    const d = +m[1];
    let mm = pm;
    if (d < pd - 3) mm = pm + 1;
    dt = mm > 12 ? mk(py + 1, 1, d) : mk(py, mm, d);
    span = m[0];
  } else if ((m = t.match(/(오늘|금일)/))) { dt = posted; span = m[0]; }
  else if ((m = t.match(/(내일|명일)/))) { dt = new Date(+posted + 864e5); span = m[0]; }
  else if ((m = t.match(/([월화수목금토일])요일/))) {
    const wd = WEEK.indexOf(m[1]);
    const diff = (wd - posted.getUTCDay() + 7) % 7;
    dt = new Date(+posted + diff * 864e5); span = m[0];
  }
  return { date: dt ? ymd(dt) : null, span };
}

const PM = /(오후|저녁|밤|pm|PM)/;
const AM = /(오전|아침|새벽|am|AM)/;

function toMin(pref, h, mm) {
  h = +h; mm = +(mm || 0);
  if (h > 24 || mm > 59) return null;
  if (pref && PM.test(pref) && h < 12) h += 12;
  else if (pref && /새벽/.test(pref) && h === 12) h = 0; // '오전 12시'는 정오로 봄
  return h * 60 + mm;
}

const PREF = '(오전|오후|저녁|아침|새벽|밤|낮|am|pm|AM|PM)?\\s*';
const HM = '(\\d{1,2})\\s*(?::\\s*(\\d{2})|시\\s*(?:(\\d{1,2})\\s*분|(반))?)?';

export function parseTime(title, dateSpan) {
  let t = title;
  if (dateSpan) t = t.replace(dateSpan, ' ');
  t = t.replace(/\d+\s*(명|층|부\)|호선|대\s*(이상|이하|환영|~)|번|km)/g, ' ')
    .replace(/(?<![\d시:])\d{1,2}\s*분\s*(모집|구|초청)/g, ' '); // '2분 모집'(인원)만 제거, '11시50분 초청'은 유지
  const re = new RegExp(`${PREF}${HM}\\s*(?:~|-|부터|에서)\\s*${PREF}${HM}\\s*(시|까지)?`);
  const one = new RegExp(`${PREF}(\\d{1,2})\\s*(?::\\s*(\\d{2})|시\\s*(?:(\\d{1,2})\\s*분|(반))?)`);
  let m = t.match(re);
  let s = null, e = null, explicit = false;
  if (m) {
    const [, p1, h1, c1, n1, b1, p2, h2, c2, n2, b2, tail] = m;
    const marked = p1 || p2 || c1 || c2 || n1 || n2 || /시/.test(m[0]) || tail;
    const bare = !marked;
    if (bare && !(+h1 >= 5 && +h1 <= 23 && +h2 >= 1 && +h2 <= 24)) m = null;
    else {
      explicit = !!(p1 || p2);
      s = toMin(p1, h1, c1 || n1 || (b1 ? 30 : 0));
      e = toMin(p2 || (p1 && PM.test(p1) ? p1 : null), h2, c2 || n2 || (b2 ? 30 : 0));
      if (s != null && !p1 && +h1 >= 1 && +h1 <= 6) s += 720; // 1~6시 단독 → 오후
      if (s != null && e != null && e <= s) {
        if (+h2 > 0 && +h2 < 12 && e + 720 > s) e += 720; // 12시간제 끝시각
        else e = (e % 720) + 1440; // 자정 넘김
      }
    }
  }
  if (!m && (m = t.match(one))) {
    const [, p1, h1, c1, n1, b1] = m;
    s = toMin(p1, h1, c1 || n1 || (b1 ? 30 : 0));
    if (s != null && !p1 && +h1 >= 1 && +h1 <= 6) s += 720;
  }
  if (s == null) return { start: null, end: null };
  const f = x => x == null ? null : `${pad(Math.floor(x / 60) % 24)}:${pad(x % 60)}`;
  return { start: f(s), end: f(e), startMin: s };
}

export function slotOf(startMin) {
  if (startMin == null) return null;
  const h = Math.floor(startMin / 60) % 24;
  if (h < 12) return '오전';
  if (h < 18) return '오후';
  return '저녁';
}

export function parsePost(title, headCont, postedYmd) {
  const n = normalize(title);
  const [y, m, d] = postedYmd.split('-').map(Number);
  const posted = mk(y, m, d);
  const { region1, region2 } = parseRegion(n, headCont);
  const { date, span } = parseDate(n, posted);
  const { start, end, startMin } = parseTime(n, span);
  const wd = date ? WEEK[mk(...date.split('-').map(Number)).getUTCDay()] : null;
  return {
    region1, region2, date, weekday: wd, start, end, slot: slotOf(startMin),
    closed: /마감|모집\s*완료|\[완료|종료/.test(n),
    free: /무료/.test(n),
  };
}

// "12분 전" / "1시간 3분 전" / "20:26" / "26.09.24" → KST 기준 ISO 시각
export function postedAt(elapsed, nowMs = Date.now()) {
  const KST = 9 * 3600e3;
  const nowK = new Date(nowMs + KST);
  let m;
  if ((m = elapsed.match(/^(?:(\d+)\s*시간)?\s*(?:(\d+)\s*분)?\s*전$/)) && (m[1] || m[2])) {
    return new Date(nowMs - ((+m[1] || 0) * 60 + (+m[2] || 0)) * 60e3).toISOString();
  }
  if (/방금/.test(elapsed)) return new Date(nowMs).toISOString();
  if ((m = elapsed.match(/^(\d{1,2}):(\d{2})$/))) {
    const k = Date.UTC(nowK.getUTCFullYear(), nowK.getUTCMonth(), nowK.getUTCDate(), +m[1], +m[2]);
    return new Date(k - KST).toISOString();
  }
  if ((m = elapsed.match(/^(\d{2})\.(\d{2})\.(\d{2})$/))) {
    return new Date(Date.UTC(2000 + +m[1], +m[2] - 1, +m[3]) - KST).toISOString();
  }
  return new Date(nowMs).toISOString();
}

export const kstYmd = iso => ymd(new Date(Date.parse(iso) + 9 * 3600e3));
