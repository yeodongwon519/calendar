// ===== 달력 위젯 (Scriptable) =====
// 아이폰 홈화면 위젯. 오늘(+다음 날) 일정을 보여준다. 읽기 전용.
// 입력·수정은 달력 웹앱(홈화면 앱)에서.
//
// ▼▼ 아래 값을 본인 것으로 바꾸세요 (웹앱 로그인과 동일하게) ▼▼
const API_URL  = "https://calendar-widget-api.xxx.workers.dev"; // Worker 주소
const USERNAME = "여기에_아이디";                                // 웹앱에서 가입한 아이디
const PASSWORD = "여기에_비밀번호";                              // 그 비밀번호
const APP_URL  = "https://yeodongwon519.github.io/calendar/";    // 탭하면 열릴 웹앱
// ▲▲ 여기까지 ▲▲

// 색상 (앱 다크 테마)
const C = {
  bg:    new Color("#16181d"),
  bg2:   new Color("#0e0f12"),
  text:  new Color("#e9eaed"),
  muted: new Color("#7d818b"),
  done:  new Color("#555962"),
  accent:new Color("#f0653f"),
};

function keyOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchData() {
  const req = new Request(API_URL);
  // UTF-8 Basic 인증 (한글 아이디/비번도 OK). Data.fromString 은 UTF-8 인코딩.
  const basic = Data.fromString(USERNAME + ":" + PASSWORD).toBase64String();
  req.headers = { Authorization: "Basic " + basic };
  req.timeoutInterval = 10;
  return await req.loadJSON(); // { store, updatedAt }
}

function tasksFor(store, date) {
  return (store && store[keyOf(date)]) || [];
}

async function build() {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 15, 14, 15);
  w.url = APP_URL;

  let store = {};
  try {
    const data = await fetchData();
    store = (data && data.store) || {};
  } catch (e) {
    const t = w.addText("연결 실패");
    t.textColor = C.accent; t.font = Font.boldSystemFont(14);
    const e2 = w.addText("주소/아이디/비번 확인");
    e2.textColor = C.muted; e2.font = Font.systemFont(10);
    return w;
  }

  const today = new Date();
  const list = tasksFor(store, today);
  const doneN = list.filter((x) => x.done).length;

  // 헤더: 6월 9일 (화)
  const WD = ["일","월","화","수","목","금","토"];
  const header = w.addStack();
  const h1 = header.addText(`${today.getMonth() + 1}월 ${today.getDate()}일`);
  h1.textColor = C.text; h1.font = Font.boldSystemFont(15);
  header.addSpacer(6);
  const h2 = header.addText(`${WD[today.getDay()]}`);
  h2.textColor = C.muted; h2.font = Font.systemFont(13);
  header.addSpacer();
  if (list.length) {
    const cnt = header.addText(`${doneN}/${list.length}`);
    cnt.textColor = C.muted; cnt.font = Font.systemFont(12);
  }

  w.addSpacer(8);

  if (!list.length) {
    const empty = w.addText("오늘 일정 없음");
    empty.textColor = C.muted; empty.font = Font.systemFont(13);
  } else {
    const fam = config.widgetFamily || "medium";
    const max = fam === "small" ? 4 : fam === "large" ? 12 : 6;
    list.slice(0, max).forEach((item) => {
      const row = w.addStack();
      row.centerAlignContent();
      const dot = row.addText(item.done ? "✓ " : "• ");
      dot.textColor = item.done ? C.done : C.accent;
      dot.font = Font.boldSystemFont(13);
      const tx = row.addText(item.text);
      tx.textColor = item.done ? C.done : C.text;
      tx.font = Font.systemFont(13);
      tx.lineLimit = 1;
      w.addSpacer(4);
    });
    if (list.length > max) {
      const more = w.addText(`+${list.length - max} 더`);
      more.textColor = C.muted; more.font = Font.systemFont(11);
    }
  }

  w.addSpacer();
  const foot = w.addText("달력");
  foot.textColor = C.muted; foot.font = Font.systemFont(9);
  return w;
}

const widget = await build();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
