// ===== 달력 (PC) — 다크모드 / 일정·할일 / 사이드바 미니·연간 =====

const STORE_KEY = "calendar.tasks.v2";
const THEME_KEY = "calendar.theme";

// store: { "2026-06-09": [ {id, text, done} ] }
let store = load();
let view = new Date();            // 메인이 보고 있는 달
let yearView = view.getFullYear(); // 연간 블록이 보는 연도
let selectedKey = null;

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch { return {}; }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  localStorage.setItem(STORE_KEY + ".updatedAt", String(Date.now()));
  // 위젯 동기화(sync.js)가 켜져 있으면 클라우드로 push
  if (window.CalendarSync && window.CalendarSync.onSave) window.CalendarSync.onSave();
}

function keyOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isMobile = () => window.matchMedia("(max-width: 640px)").matches;
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// ===== 메인 그리드 =====
const grid = document.getElementById("grid");
const title = document.getElementById("title");

function renderMain() {
  const today = new Date();
  const year = view.getFullYear(), month = view.getMonth();
  title.textContent = `${year}년 ${month + 1}월`;

  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  grid.innerHTML = "";
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    grid.appendChild(buildCell(date, month, today));
  }
  requestAnimationFrame(clampAllCells);
}

// 칸 높이 고정: 넘치는 항목은 숨기고 "+N 더" 표시
function clampCell(cell) {
  const tasksEl = cell.querySelector(".tasks");
  if (!tasksEl) return;
  tasksEl.querySelector(".more")?.remove();
  const items = [...tasksEl.querySelectorAll(".task")];
  items.forEach(t => (t.style.display = ""));
  const max = tasksEl.clientHeight;
  if (max <= 0 || !items.length) return;

  const gap = 2, moreH = 18;
  let used = 0, shown = 0;
  for (let i = 0; i < items.length; i++) {
    const h = items[i].offsetHeight + (i ? gap : 0);
    if (used + h <= max) { used += h; shown++; } else break;
  }
  if (shown < items.length) {
    while (shown > 0 && used + moreH > max) {
      used -= items[shown - 1].offsetHeight + (shown > 1 ? gap : 0);
      shown--;
    }
    for (let i = shown; i < items.length; i++) items[i].style.display = "none";
    const more = document.createElement("div");
    more.className = "more";
    more.textContent = `+${items.length - shown} 더`;
    const key = cell.dataset.key;
    more.addEventListener("click", (e) => { e.stopPropagation(); openDayPopover(key); });
    tasksEl.appendChild(more);
  }
}
function clampAllCells() { grid.querySelectorAll(".cell").forEach(clampCell); }

function buildCell(date, viewMonth, today) {
  const key = keyOf(date);
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.dataset.key = key;

  const dow = date.getDay();
  if (dow === 0) cell.classList.add("sun");
  if (dow === 6) cell.classList.add("sat");
  if (date.getMonth() !== viewMonth) cell.classList.add("other");
  if (sameDay(date, today)) cell.classList.add("today");
  if (key === selectedKey) cell.classList.add("selected");

  const head = document.createElement("div");
  head.className = "cell-head";
  const num = document.createElement("span");
  num.className = "daynum";
  num.textContent = date.getDate();
  head.appendChild(num);

  const list = store[key] || [];
  if (list.length) {
    const cnt = document.createElement("span");
    cnt.className = "count";
    const doneN = list.filter(t => t.done).length;
    cnt.textContent = doneN ? `${doneN}/${list.length}` : list.length;
    head.appendChild(cnt);
  }
  cell.appendChild(head);

  const tasks = document.createElement("div");
  tasks.className = "tasks";
  list.forEach(t => tasks.appendChild(buildTask(key, t)));
  cell.appendChild(tasks);

  // 모바일: 칸(또는 그 안 항목) 어디를 탭해도 그 날 팝오버 → 추가·수정·완료를 크게
  // 캡처 단계에서 가로채 내부 항목의 작은 탭 핸들러보다 먼저 처리
  cell.addEventListener("click", (e) => {
    if (!isMobile()) return;
    if (e.target.closest(".input-row")) return;
    e.stopPropagation();
    openDayPopover(key);
  }, true);

  // 데스크탑: 빈 칸 탭 → 인라인 입력
  cell.addEventListener("click", (e) => {
    if (isMobile()) return;
    if (e.target.closest(".task") || e.target.closest(".input-row")) return;
    openInput(cell, key);
  });
  return cell;
}

function buildTask(key, t, after = renderAll) {
  const el = document.createElement("div");
  el.className = "task" + (t.done ? " done" : "");

  // 체크박스: 클릭 = 완료 토글
  const box = document.createElement("span");
  box.className = "box";
  box.addEventListener("click", (e) => {
    e.stopPropagation();
    t.done = !t.done;
    save(); after();
  });
  el.appendChild(box);

  // 글자: 클릭 = 인라인 수정
  const tt = document.createElement("span");
  tt.className = "tt";
  tt.textContent = t.text;
  tt.addEventListener("click", (e) => {
    e.stopPropagation();
    startInlineEdit(el, key, t, after);
  });
  el.appendChild(tt);
  el.title = t.text;

  // 삭제 버튼 (×)
  const del = document.createElement("button");
  del.className = "del";
  del.textContent = "×";
  del.title = "삭제";
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    store[key] = (store[key] || []).filter(x => x.id !== t.id);
    if (!store[key].length) delete store[key];
    save(); after();
  });
  el.appendChild(del);

  return el;
}

// 인라인 수정: 항목을 입력창으로 바꿔 그 자리에서 편집
function startInlineEdit(taskEl, key, t, after) {
  const input = document.createElement("input");
  input.className = "task-input";
  input.value = t.text;
  taskEl.replaceWith(input);
  input.focus(); input.select();

  let finished = false;
  function finish(saveIt) {
    if (finished) return;
    finished = true;
    if (saveIt) {
      const v = input.value.trim();
      if (v) t.text = v;
      else {
        store[key] = store[key].filter(x => x.id !== t.id);
        if (!store[key].length) delete store[key];
      }
      save();
    }
    after();
  }
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  input.addEventListener("blur", () => finish(true));
}

// ===== 인라인 입력 =====
function openInput(cell, key) {
  // 이미 이 셀에 입력창이 열려있으면 무시
  if (cell.querySelector(".input-row")) { cell.querySelector(".task-input").focus(); return; }
  // 다른 곳 입력창 정리(저장 포함)
  closeInput();
  selectedKey = key;
  cell.classList.add("selected");

  const tasksEl = cell.querySelector(".tasks");
  const row = document.createElement("div");
  row.className = "input-row";

  const input = document.createElement("input");
  input.className = "task-input";
  input.placeholder = "입력…";

  row.append(input);
  tasksEl.appendChild(row);
  requestAnimationFrame(() => { input.focus(); input.scrollIntoView({ block: "nearest" }); });

  function commit() {
    const raw = input.value.trim();
    if (!raw) return;
    if (!store[key]) store[key] = [];
    store[key].push({ id: uid(), text: raw, done: false });
    save();
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      input.value = "";
      refreshCellTasks(key, row);
    } else if (e.key === "Escape") {
      closeInput();
    }
  });
  input.addEventListener("blur", () => { commit(); closeInput(); });
}

// 입력창 닫기: 전체를 다시 그리지 않고 해당 셀만 정리 (다른 칸 클릭 깨짐 방지)
function closeInput() {
  const row = document.querySelector(".input-row");
  const key = selectedKey;
  if (row) row.remove();
  document.querySelectorAll(".cell.selected").forEach(c => c.classList.remove("selected"));
  selectedKey = null;
  if (key) renderCell(key);
  renderYear();
}

// 한 셀의 항목만 다시 그림 (입력창 없이)
function renderCell(key) {
  const cell = grid.querySelector(`.cell[data-key="${key}"]`);
  if (!cell) return;
  const tasksEl = cell.querySelector(".tasks");
  tasksEl.querySelectorAll(".task").forEach(t => t.remove());
  (store[key] || []).forEach(t => tasksEl.appendChild(buildTask(key, t)));

  const head = cell.querySelector(".cell-head");
  let cnt = head.querySelector(".count");
  const list = store[key] || [];
  if (list.length) {
    if (!cnt) { cnt = document.createElement("span"); cnt.className = "count"; head.appendChild(cnt); }
    const doneN = list.filter(t => t.done).length;
    cnt.textContent = doneN ? `${doneN}/${list.length}` : list.length;
  } else if (cnt) cnt.remove();
}

// 입력 유지하며 해당 셀 항목만 다시 그림
function refreshCellTasks(key, row) {
  const cell = grid.querySelector(`.cell[data-key="${key}"]`);
  if (!cell) return;
  const tasksEl = cell.querySelector(".tasks");
  tasksEl.querySelectorAll(".task").forEach(t => t.remove());
  (store[key] || []).forEach(t => tasksEl.insertBefore(buildTask(key, t), row));

  const head = cell.querySelector(".cell-head");
  let cnt = head.querySelector(".count");
  const list = store[key] || [];
  if (list.length) {
    if (!cnt) { cnt = document.createElement("span"); cnt.className = "count"; head.appendChild(cnt); }
    const doneN = list.filter(t => t.done).length;
    cnt.textContent = doneN ? `${doneN}/${list.length}` : list.length;
  } else if (cnt) cnt.remove();

  const input = row.querySelector(".task-input");
  input.focus();
  renderYear();
}

// ===== 날짜 팝오버 (그 날 전체 보기/관리) =====
const WD = ["일","월","화","수","목","금","토"];
function openDayPopover(key) {
  closeInput();
  document.querySelector(".pop-overlay")?.remove();

  const [y, m, d] = key.split("-").map(Number);
  const overlay = document.createElement("div");
  overlay.className = "pop-overlay";
  const pop = document.createElement("div");
  pop.className = "day-pop";

  const head = document.createElement("div");
  head.className = "pop-head";
  const wd = WD[new Date(y, m - 1, d).getDay()];
  head.innerHTML = `<span class="pop-date">${m}월 ${d}일</span><span class="pop-wd">${wd}요일</span>`;
  pop.appendChild(head);

  const listEl = document.createElement("div");
  listEl.className = "pop-list";
  pop.appendChild(listEl);

  const input = document.createElement("input");
  input.className = "pop-input";
  input.placeholder = "입력 후 Enter…";
  pop.appendChild(input);

  function renderList() {
    listEl.innerHTML = "";
    const list = store[key] || [];
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "pop-empty";
      empty.textContent = "아직 없음";
      listEl.appendChild(empty);
    } else {
      list.forEach(t => listEl.appendChild(buildTask(key, t, () => { renderList(); renderMain(); renderYear(); })));
    }
  }
  renderList();

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const v = input.value.trim();
      if (v) {
        if (!store[key]) store[key] = [];
        store[key].push({ id: uid(), text: v, done: false });
        save(); input.value = "";
        renderList(); renderMain(); renderYear();
      }
    } else if (e.key === "Escape") { close(); }
  });

  function close() { overlay.remove(); document.removeEventListener("keydown", onEsc); }
  function onEsc(e) { if (e.key === "Escape") close(); }
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });

  overlay.appendChild(pop);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => input.focus());
}

// ===== 사이드바: 연간 달력 =====
const yearGrid = document.getElementById("yearGrid");
const yearTitle = document.getElementById("yearTitle");
const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function renderYear() {
  const today = new Date();
  yearTitle.textContent = `${yearView}년`;
  yearGrid.innerHTML = "";

  for (let m = 0; m < 12; m++) {
    const box = document.createElement("div");
    box.className = "ym";
    if (yearView === view.getFullYear() && m === view.getMonth()) box.classList.add("current");

    const name = document.createElement("div");
    name.className = "ym-name";
    name.textContent = MONTH_NAMES[m];
    box.appendChild(name);

    const mini = document.createElement("div");
    mini.className = "ym-mini";
    const first = new Date(yearView, m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const d = document.createElement("div");
      d.className = "d";
      if (date.getMonth() !== m) { d.classList.add("empty"); d.textContent = "·"; }
      else {
        d.textContent = date.getDate();
        if (sameDay(date, today)) d.classList.add("today");
        if ((store[keyOf(date)] || []).length) d.classList.add("has");
      }
      mini.appendChild(d);
    }
    box.appendChild(mini);
    box.onclick = () => { view = new Date(yearView, m, 1); renderAll(); };
    yearGrid.appendChild(box);
  }
}

// ===== 네비게이션 =====
function shiftMonth(delta) {
  view = new Date(view.getFullYear(), view.getMonth() + delta, 1);
  yearView = view.getFullYear();
  selectedKey = null;
  renderAll();
}
document.getElementById("prevBtn").onclick = () => shiftMonth(-1);
document.getElementById("nextBtn").onclick = () => shiftMonth(1);
document.getElementById("todayBtn").onclick = () => { view = new Date(); yearView = view.getFullYear(); selectedKey = null; renderAll(); };
document.getElementById("yearPrev").onclick = () => { yearView--; renderYear(); };
document.getElementById("yearNext").onclick = () => { yearView++; renderYear(); };

document.addEventListener("keydown", (e) => {
  if (document.activeElement.tagName === "INPUT") return;
  if (e.key === "ArrowLeft") shiftMonth(-1);
  if (e.key === "ArrowRight") shiftMonth(1);
  if (e.key === "t" || e.key === "ㅅ") { view = new Date(); yearView = view.getFullYear(); renderAll(); }
});

let resizeT;
window.addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(clampAllCells, 100);
});

// ===== 테마 =====
const themeBtn = document.getElementById("themeBtn");
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  themeBtn.textContent = t === "dark" ? "🌙" : "☀️";
  localStorage.setItem(THEME_KEY, t);
}
themeBtn.onclick = () => {
  const cur = document.documentElement.getAttribute("data-theme");
  applyTheme(cur === "dark" ? "light" : "dark");
};
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

// ===== 최초 렌더 =====
function renderAll() { renderMain(); renderYear(); }
renderAll();

// ===== 위젯 동기화용 외부 인터페이스 (sync.js에서 사용) =====
window.CalendarApp = {
  getStore: () => store,
  getUpdatedAt: () => Number(localStorage.getItem(STORE_KEY + ".updatedAt")) || 0,
  // 원격에서 받은 데이터로 교체 (로컬에도 저장하고 다시 그림)
  replaceStore: (s, updatedAt) => {
    store = s || {};
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    if (updatedAt) localStorage.setItem(STORE_KEY + ".updatedAt", String(updatedAt));
    renderAll();
  },
};
