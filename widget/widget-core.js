// ===== 달력 위젯 코어 (Scriptable) =====
// 부트스트랩이 정의한 전역 사용: API_URL, USERNAME, PASSWORD, APP_URL
// 이번 주(일~토) 일정을 요일순으로 보여준다. 탭해도 아무 데도 안 열림(보기 전용).
(async function () {
  var C = {
    bg: new Color("#16181d"), text: new Color("#e9eaed"),
    muted: new Color("#7d818b"), done: new Color("#555962"),
    accent: new Color("#f0653f"), sun: new Color("#f08a7a"), sat: new Color("#7aa6f0")
  };
  function pad(n) { return String(n).padStart(2, "0"); }
  function keyOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
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
  // (탭해도 브라우저 안 열림 — w.url 설정 안 함)

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
  var todayKey = keyOf(today);
  var WD = ["일", "월", "화", "수", "목", "금", "토"];

  // 이번 주 일요일 ~ 토요일
  var start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  var endD = new Date(start); endD.setDate(start.getDate() + 6);

  // 이번 주 일정 펼치기 (요일순)
  var items = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(start); d.setDate(start.getDate() + i);
    var k = keyOf(d);
    var dow = d.getDay(), dayNum = d.getDate(), isT = (k === todayKey);
    var arr = store[k] || [];
    for (var j = 0; j < arr.length; j++) {
      items.push({ dow: dow, day: dayNum, isToday: isT, text: arr[j].text, done: arr[j].done });
    }
  }
  var totalN = items.length;
  var doneN = items.filter(function (x) { return x.done; }).length;

  // 헤더: "이번 주 6/8–6/14"  +  완료/전체
  var header = w.addStack(); header.centerAlignContent();
  var h1 = header.addText("이번 주");
  h1.textColor = C.text; h1.font = Font.boldSystemFont(15);
  header.addSpacer(6);
  var hr = header.addText((start.getMonth() + 1) + "/" + start.getDate() + "–" + (endD.getMonth() + 1) + "/" + endD.getDate());
  hr.textColor = C.muted; hr.font = Font.systemFont(11);
  header.addSpacer();
  if (totalN) {
    var cc = header.addText(doneN + "/" + totalN);
    cc.textColor = C.muted; cc.font = Font.systemFont(12);
  }
  w.addSpacer(7);

  if (!totalN) {
    var em = w.addText("이번 주 일정 없음");
    em.textColor = C.muted; em.font = Font.systemFont(13);
  } else {
    var fam = config.widgetFamily || "medium";
    var max = fam === "small" ? 4 : (fam === "large" ? 16 : 8);
    items.slice(0, max).forEach(function (it) {
      var row = w.addStack(); row.centerAlignContent();
      // 요일 (오늘=주황 강조, 일=빨강, 토=파랑)
      var dcol = it.isToday ? C.accent : (it.dow === 0 ? C.sun : (it.dow === 6 ? C.sat : C.muted));
      var dlab = row.addText(WD[it.dow] + " " + it.day);
      dlab.textColor = dcol;
      dlab.font = it.isToday ? Font.boldSystemFont(12) : Font.systemFont(12);
      dlab.lineLimit = 1;
      row.addSpacer(8);
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
