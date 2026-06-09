// ===== 달력 위젯 코어 (Scriptable) =====
// 전역: API_URL, USERNAME, PASSWORD, APP_URL
// 이번 주(일~토) 7칸 그리드. 각 칸에 그날 할일. (중간/큰 위젯용, 작은 위젯은 오늘 목록)
(async function () {
  var C = {
    bg: new Color("#16181d"), panel: new Color("#1d2026"), text: new Color("#e9eaed"),
    muted: new Color("#7d818b"), faint: new Color("#5a5e67"), done: new Color("#555962"),
    accent: new Color("#f0653f"), accentDim: new Color("#3a241c"),
    sun: new Color("#f08a7a"), sat: new Color("#7aa6f0")
  };
  function pad(n) { return String(n).padStart(2, "0"); }
  function keyOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  async function fetchData() {
    var req = new Request(API_URL);
    req.headers = { Authorization: "Basic " + Data.fromString(USERNAME + ":" + PASSWORD).toBase64String() };
    req.timeoutInterval = 10;
    return await req.loadJSON();
  }

  var w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(11, 11, 11, 11);

  var store = {};
  try {
    var data = await fetchData();
    if (data && data.store) store = data.store;
  } catch (e) {
    var t = w.addText("연결 실패"); t.textColor = C.accent; t.font = Font.boldSystemFont(14);
    var e2 = w.addText("아이디/비번 확인"); e2.textColor = C.muted; e2.font = Font.systemFont(10);
    Script.setWidget(w); Script.complete(); return;
  }

  var today = new Date();
  var todayKey = keyOf(today);
  var WD = ["일", "월", "화", "수", "목", "금", "토"];
  var fam = config.widgetFamily || "medium";

  // ----- 작은 위젯: 7칸 그리드는 너무 좁음 → 오늘 목록 -----
  if (fam === "small") {
    var list = store[todayKey] || [];
    var hh = w.addText(today.getDate() + "일 " + WD[today.getDay()]);
    hh.textColor = C.text; hh.font = Font.boldSystemFont(14);
    w.addSpacer(6);
    if (!list.length) {
      var em0 = w.addText("일정 없음"); em0.textColor = C.muted; em0.font = Font.systemFont(12);
    } else {
      list.slice(0, 5).forEach(function (it) {
        var tx = w.addText((it.done ? "✓ " : "• ") + it.text);
        tx.textColor = it.done ? C.done : C.text; tx.font = Font.systemFont(12); tx.lineLimit = 1;
        w.addSpacer(2);
      });
      if (list.length > 5) { var m0 = w.addText("+" + (list.length - 5)); m0.textColor = C.muted; m0.font = Font.systemFont(10); }
    }
    Script.setWidget(w); Script.complete(); return;
  }

  // ----- 중간/큰 위젯: 7칸 주간 그리드 -----
  var maxPerCol = fam === "large" ? 9 : 3;
  var colW = 44;

  var grid = w.addStack();
  grid.topAlignContent();

  var start = new Date(today);
  start.setDate(today.getDate() - today.getDay()); // 이번 주 일요일

  for (var i = 0; i < 7; i++) {
    if (i > 0) grid.addSpacer(2);
    var d = new Date(start); d.setDate(start.getDate() + i);
    var dow = d.getDay(), dayNum = d.getDate(), isToday = (keyOf(d) === todayKey);
    var list = store[keyOf(d)] || [];

    var col = grid.addStack();
    col.layoutVertically();
    col.size = new Size(colW, 0);
    col.setPadding(4, 3, 4, 3);
    col.cornerRadius = 7;
    col.backgroundColor = isToday ? C.accentDim : C.panel;

    // 요일 + 날짜
    var head = col.addStack(); head.addSpacer();
    var hcol = isToday ? C.accent : (dow === 0 ? C.sun : (dow === 6 ? C.sat : C.muted));
    var hd = head.addText(WD[dow] + " " + dayNum);
    hd.textColor = hcol; hd.font = isToday ? Font.boldSystemFont(11) : Font.systemFont(11);
    hd.lineLimit = 1; hd.minimumScaleFactor = 0.7;
    head.addSpacer();
    col.addSpacer(4);

    // 그날 할일
    if (!list.length) {
      var dot = col.addText("·"); dot.textColor = C.faint; dot.font = Font.systemFont(10);
    } else {
      list.slice(0, maxPerCol).forEach(function (it) {
        var tx = col.addText(it.text);
        tx.textColor = it.done ? C.done : C.text;
        tx.font = Font.systemFont(9.5); tx.lineLimit = 1; tx.minimumScaleFactor = 0.7;
        col.addSpacer(2);
      });
      if (list.length > maxPerCol) {
        var mo = col.addText("+" + (list.length - maxPerCol));
        mo.textColor = C.muted; mo.font = Font.systemFont(9);
      }
    }
    col.addSpacer(); // 칸 높이 채우기(위 정렬)
  }

  if (config.runsInWidget) { Script.setWidget(w); }
  else { await (fam === "large" ? w.presentLarge() : w.presentMedium()); }
  Script.complete();
})();
