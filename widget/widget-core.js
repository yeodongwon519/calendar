// ===== 달력 위젯 코어 (Scriptable) =====
// 전역: API_URL, USERNAME, PASSWORD, APP_URL
// 큰 위젯: 월 표시 + 2주치 7칸×2줄 그리드, 각 칸에 그날 할일(줄바꿈).
// 날짜 칸 탭 → 그 날짜로 앱 열림(추가/수정/체크). 중간: 이번 주 1줄. 작은: 오늘 목록.
(async function () {
  var C = {
    bg: new Color("#16181d"), panel: new Color("#1d2026"), text: new Color("#e9eaed"),
    muted: new Color("#7d818b"), faint: new Color("#5a5e67"), done: new Color("#555962"),
    accent: new Color("#f0653f"), accentDim: new Color("#3a241c"),
    sun: new Color("#f08a7a"), sat: new Color("#7aa6f0")
  };
  function pad(n) { return String(n).padStart(2, "0"); }
  function keyOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function dayUrl(d) { return APP_URL + "?day=" + keyOf(d); }
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

  // ----- 작은 위젯: 오늘 목록 -----
  if (fam === "small") {
    var tl = store[todayKey] || [];
    var hh = w.addText((today.getMonth() + 1) + "월 " + today.getDate() + "일 " + WD[today.getDay()]);
    hh.textColor = C.text; hh.font = Font.boldSystemFont(13);
    w.addSpacer(6);
    if (!tl.length) {
      var em0 = w.addText("일정 없음"); em0.textColor = C.muted; em0.font = Font.systemFont(12);
    } else {
      tl.slice(0, 5).forEach(function (it) {
        var tx = w.addText((it.done ? "✓ " : "• ") + it.text);
        tx.textColor = it.done ? C.done : C.text; tx.font = Font.systemFont(12); tx.lineLimit = 1;
        w.addSpacer(2);
      });
      if (tl.length > 5) { var m0 = w.addText("+" + (tl.length - 5)); m0.textColor = C.muted; m0.font = Font.systemFont(10); }
    }
    w.url = dayUrl(today);
    Script.setWidget(w); Script.complete(); return;
  }

  var weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // 이번 주 일요일
  var spanDays = (fam === "large") ? 13 : 6;
  var lastDay = new Date(weekStart); lastDay.setDate(weekStart.getDate() + spanDays);

  // ----- 월 헤더 -----
  var m1 = weekStart.getMonth() + 1, m2 = lastDay.getMonth() + 1;
  var monthLabel = (m1 === m2) ? (m1 + "월") : (m1 + "월 – " + m2 + "월");
  var hdr = w.addStack(); hdr.centerAlignContent();
  var ml = hdr.addText(monthLabel); ml.textColor = C.text; ml.font = Font.boldSystemFont(15);
  ml.url = dayUrl(today); // 헤더 탭 → 오늘로 앱 열림
  hdr.addSpacer();
  var yl = hdr.addText(String(weekStart.getFullYear())); yl.textColor = C.muted; yl.font = Font.systemFont(11);
  w.addSpacer(6);

  // ----- 한 주(7칸) 그리드 한 줄 -----
  function buildWeek(wkStart, maxPerCol, colW, rowH) {
    var grid = w.addStack();
    grid.topAlignContent();
    for (var i = 0; i < 7; i++) {
      if (i > 0) grid.addSpacer(2);
      var d = new Date(wkStart); d.setDate(wkStart.getDate() + i);
      var dow = d.getDay(), dayNum = d.getDate(), isToday = (keyOf(d) === todayKey);
      var list = store[keyOf(d)] || [];

      var col = grid.addStack();
      col.layoutVertically();
      col.size = new Size(colW, rowH);
      col.setPadding(4, 3, 4, 3);
      col.cornerRadius = 7;
      col.backgroundColor = isToday ? C.accentDim : C.panel;
      col.url = dayUrl(d); // 탭 → 그 날짜로 앱 열림

      var head = col.addStack(); head.addSpacer();
      var hcol = isToday ? C.accent : (dow === 0 ? C.sun : (dow === 6 ? C.sat : C.muted));
      var hd = head.addText(WD[dow] + " " + dayNum);
      hd.textColor = hcol; hd.font = isToday ? Font.boldSystemFont(11) : Font.systemFont(11);
      hd.lineLimit = 1; hd.minimumScaleFactor = 0.7;
      head.addSpacer();
      col.addSpacer(4);

      if (!list.length) {
        var dt = col.addText("·"); dt.textColor = C.faint; dt.font = Font.systemFont(10);
      } else {
        list.slice(0, maxPerCol).forEach(function (it) {
          var tx = col.addText(it.text);
          tx.textColor = it.done ? C.done : C.text;
          tx.font = Font.systemFont(9.5);   // 크기 유지 + 길면 줄바꿈(아래로)
          col.addSpacer(3);
        });
        if (list.length > maxPerCol) {
          var mo = col.addText("+" + (list.length - maxPerCol));
          mo.textColor = C.muted; mo.font = Font.systemFont(9);
        }
      }
      col.addSpacer();
    }
  }

  if (fam === "large") {
    buildWeek(weekStart, 6, 45, 140);
    w.addSpacer(6);
    var next = new Date(weekStart); next.setDate(weekStart.getDate() + 7);
    buildWeek(next, 6, 45, 140);
  } else {
    buildWeek(weekStart, 5, 45, 116);
  }

  if (config.runsInWidget) { Script.setWidget(w); }
  else { await (fam === "large" ? w.presentLarge() : w.presentMedium()); }
  Script.complete();
})();
