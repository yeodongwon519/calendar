// ===== 달력 위젯 코어 (Scriptable) =====
// 부트스트랩이 정의한 전역 사용: API_URL, USERNAME, PASSWORD, APP_URL
// 이번 달 전체 일정을 날짜순으로 보여준다. (위젯 크기에 맞게 잘림)
(async function () {
  var C = {
    bg: new Color("#16181d"), text: new Color("#e9eaed"),
    muted: new Color("#7d818b"), done: new Color("#555962"), accent: new Color("#f0653f")
  };
  function pad(n) { return String(n).padStart(2, "0"); }
  async function fetchData() {
    var req = new Request(API_URL);
    var basic = Data.fromString(USERNAME + ":" + PASSWORD).toBase64String();
    req.headers = { Authorization: "Basic " + basic };
    req.timeoutInterval = 10;
    return await req.loadJSON();
  }

  var w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(13, 15, 13, 14);
  w.url = APP_URL;

  var store = {};
  try {
    var data = await fetchData();
    if (data && data.store) store = data.store;
  } catch (e) {
    var t = w.addText("연결 실패");
    t.textColor = C.accent; t.font = Font.boldSystemFont(14);
    var e2 = w.addText("아이디/비번 확인");
    e2.textColor = C.muted; e2.font = Font.systemFont(10);
    Script.setWidget(w); Script.complete(); return;
  }

  var today = new Date();
  var Y = today.getFullYear();
  var M = today.getMonth() + 1;
  var prefix = Y + "-" + pad(M) + "-";       // 이번 달 키 접두사
  var todayKey = prefix + pad(today.getDate());

  // 이번 달 일정을 날짜순으로 펼치기
  var items = [];
  Object.keys(store).filter(function (k) { return k.indexOf(prefix) === 0; })
    .sort()
    .forEach(function (k) {
      var day = parseInt(k.slice(8), 10);
      (store[k] || []).forEach(function (it) {
        items.push({ day: day, key: k, text: it.text, done: it.done });
      });
    });
  var totalN = items.length;
  var doneN = items.filter(function (x) { return x.done; }).length;

  // 헤더: "6월"  +  완료/전체
  var header = w.addStack(); header.centerAlignContent();
  var h1 = header.addText(M + "월");
  h1.textColor = C.text; h1.font = Font.boldSystemFont(15);
  header.addSpacer();
  if (totalN) {
    var c = header.addText(doneN + "/" + totalN);
    c.textColor = C.muted; c.font = Font.systemFont(12);
  }
  w.addSpacer(7);

  if (!totalN) {
    var em = w.addText("이번 달 일정 없음");
    em.textColor = C.muted; em.font = Font.systemFont(13);
  } else {
    var fam = config.widgetFamily || "medium";
    var max = fam === "small" ? 4 : (fam === "large" ? 15 : 7);
    items.slice(0, max).forEach(function (it) {
      var isToday = (it.key === todayKey);
      var row = w.addStack(); row.centerAlignContent();
      // 날짜 (오늘은 강조)
      var dnum = row.addText(it.day + "일");
      dnum.textColor = isToday ? C.accent : C.muted;
      dnum.font = isToday ? Font.boldSystemFont(12) : Font.systemFont(12);
      dnum.lineLimit = 1;
      row.addSpacer(7);
      // 할일
      var tx = row.addText((it.done ? "✓ " : "") + it.text);
      tx.textColor = it.done ? C.done : C.text;
      tx.font = Font.systemFont(13);
      tx.lineLimit = 1;
      w.addSpacer(4);
    });
    if (totalN > max) {
      var mo = w.addText("+" + (totalN - max) + " 더");
      mo.textColor = C.muted; mo.font = Font.systemFont(11);
    }
  }

  w.addSpacer();
  var f = w.addText("달력");
  f.textColor = C.muted; f.font = Font.systemFont(9);

  if (config.runsInWidget) { Script.setWidget(w); }
  else { await w.presentMedium(); }
  Script.complete();
})();
