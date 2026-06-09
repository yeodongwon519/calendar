// ===== 달력 위젯 코어 (Scriptable) =====
// 부트스트랩(짧은 스크립트)이 정의한 전역을 사용한다:
//   API_URL, USERNAME, PASSWORD, APP_URL
// 부트스트랩이 이 파일을 loadString 으로 받아 eval 하므로, 붙여넣기로 깨지지 않는다.
(async function () {
  var C = {
    bg: new Color("#16181d"), text: new Color("#e9eaed"),
    muted: new Color("#7d818b"), done: new Color("#555962"), accent: new Color("#f0653f")
  };
  function keyOf(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  async function fetchData() {
    var req = new Request(API_URL);
    var basic = Data.fromString(USERNAME + ":" + PASSWORD).toBase64String();
    req.headers = { Authorization: "Basic " + basic };
    req.timeoutInterval = 10;
    return await req.loadJSON();
  }

  var w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 15, 14, 15);
  w.url = APP_URL;

  var store = {};
  try {
    var data = await fetchData();
    if (data && data.store) store = data.store;
  } catch (e) {
    var t = w.addText("연결 실패");
    t.textColor = C.accent; t.font = Font.boldSystemFont(14);
    var e2 = w.addText("주소/아이디/비번 확인");
    e2.textColor = C.muted; e2.font = Font.systemFont(10);
    Script.setWidget(w); Script.complete(); return;
  }

  var today = new Date();
  var list = store[keyOf(today)] || [];
  var doneN = list.filter(function (x) { return x.done; }).length;
  var WD = ["일", "월", "화", "수", "목", "금", "토"];

  var header = w.addStack();
  var h1 = header.addText((today.getMonth() + 1) + "월 " + today.getDate() + "일");
  h1.textColor = C.text; h1.font = Font.boldSystemFont(15);
  header.addSpacer(6);
  var h2 = header.addText(WD[today.getDay()]);
  h2.textColor = C.muted; h2.font = Font.systemFont(13);
  header.addSpacer();
  if (list.length) {
    var c = header.addText(doneN + "/" + list.length);
    c.textColor = C.muted; c.font = Font.systemFont(12);
  }

  w.addSpacer(8);

  if (!list.length) {
    var em = w.addText("오늘 일정 없음");
    em.textColor = C.muted; em.font = Font.systemFont(13);
  } else {
    var fam = config.widgetFamily || "medium";
    var max = fam === "small" ? 4 : (fam === "large" ? 12 : 6);
    list.slice(0, max).forEach(function (item) {
      var row = w.addStack(); row.centerAlignContent();
      var dot = row.addText(item.done ? "✓ " : "• ");
      dot.textColor = item.done ? C.done : C.accent; dot.font = Font.boldSystemFont(13);
      var tx = row.addText(item.text);
      tx.textColor = item.done ? C.done : C.text; tx.font = Font.systemFont(13); tx.lineLimit = 1;
      w.addSpacer(4);
    });
    if (list.length > max) {
      var mo = w.addText("+" + (list.length - max) + " 더");
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
