// ===== 로그인 + 클라우드 동기화 (Cloudflare Worker) =====
// 아이디/비밀번호로 로그인하면 일정이 클라우드에 동기화되고, 아이폰 위젯이 읽어간다.
// 서버 주소·자격증명은 코드가 아니라 이 기기 localStorage 에만 저장된다.
//   - 회원가입: 새 계정 칸 생성 + 지금 기기의 로컬 일정을 올림
//   - 로그인  : 그 계정의 클라우드 일정을 내려받아 교체
//   - 로그인 상태로 재방문: 최신(타임스탬프)이 이기는 양방향 동기화

(function () {
  const URL_KEY = "calendar.sync.url";
  const USER_KEY = "calendar.sync.user";
  const PASS_KEY = "calendar.sync.pass";
  const LAST_KEY = "calendar.sync.lastPush";

  const cfg = () => ({
    url: (localStorage.getItem(URL_KEY) || "").trim().replace(/\/+$/, ""),
    user: (localStorage.getItem(USER_KEY) || "").trim(),
    pass: localStorage.getItem(PASS_KEY) || "",
  });
  const isOn = () => { const c = cfg(); return !!(c.url && c.user && c.pass); };

  // UTF-8 base64 (한글 아이디/비번 지원) — Worker 의 디코딩과 짝을 맞춤
  function b64utf8(s) {
    return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  }
  function authHeader() {
    const c = cfg();
    return "Basic " + b64utf8(c.user + ":" + c.pass);
  }

  // ---- 네트워크 ----
  async function apiGet() {
    const c = cfg();
    const res = await fetch(c.url, { headers: { Authorization: authHeader() } });
    if (res.status === 404) { const e = new Error("계정 없음"); e.code = 404; throw e; }
    if (!res.ok) throw new Error("GET " + res.status);
    return res.json(); // { store, updatedAt }
  }
  async function apiPost() {
    const c = cfg();
    const payload = JSON.stringify({
      store: window.CalendarApp.getStore(),
      updatedAt: window.CalendarApp.getUpdatedAt(),
    });
    const res = await fetch(c.url, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: payload,
    });
    if (!res.ok) throw new Error("POST " + res.status);
    localStorage.setItem(LAST_KEY, String(Date.now()));
  }
  async function apiRegister() {
    const c = cfg();
    const res = await fetch(c.url + "/register", {
      method: "POST",
      headers: { Authorization: authHeader() },
    });
    if (res.status === 409) { const e = new Error("이미 있는 아이디"); e.code = 409; throw e; }
    if (!res.ok) throw new Error("register " + res.status);
    return res.json();
  }

  // ---- 저장 시 자동 push (디바운스) ----
  let t = null;
  window.CalendarSync = {
    onSave() {
      if (!isOn()) return;
      clearTimeout(t);
      t = setTimeout(() => apiPost().then(() => setStatus("동기화됨 · " + new Date().toLocaleTimeString()))
        .catch((e) => setStatus("동기화 실패: " + e.message)), 1200);
    },
  };

  // ---- 재방문(같은 계정): 최신이 이기는 양방향 ----
  async function reconcile() {
    if (!isOn()) return;
    try {
      const remote = await apiGet();
      const localUpdated = window.CalendarApp.getUpdatedAt();
      const remoteUpdated = (remote && remote.updatedAt) || 0;
      if (remoteUpdated > localUpdated) {
        window.CalendarApp.replaceStore(remote.store || {}, remoteUpdated);
      } else if (localUpdated > remoteUpdated) {
        await apiPost();
      }
    } catch (e) {
      if (e.code === 404) markLoggedOut(); // 비번 변경/계정 삭제 등
    }
  }

  function persistCreds(url, user, pass) {
    localStorage.setItem(URL_KEY, url.trim().replace(/\/+$/, ""));
    localStorage.setItem(USER_KEY, user.trim());
    localStorage.setItem(PASS_KEY, pass);
  }
  function markLoggedOut() {
    localStorage.removeItem(PASS_KEY); // 비번만 지움(아이디·주소는 편의상 유지)
    refreshBtn();
  }
  function refreshBtn() {
    const btn = document.getElementById("syncBtn");
    if (btn) btn.classList.toggle("on", isOn());
  }

  // ===== 로그인 모달 =====
  let statusEl = null;
  function setStatus(msg, ok) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = ok ? "var(--accent)" : "";
  }

  function openModal() {
    document.querySelector(".sync-overlay")?.remove();
    const c = cfg();

    const overlay = document.createElement("div");
    overlay.className = "sync-overlay";
    const box = document.createElement("div");
    box.className = "sync-modal";
    box.innerHTML = `
      <div class="sync-title">${isOn() ? "동기화" : "로그인"}</div>
      <label class="sync-label">서버 주소 (한 번만 입력)
        <input class="sync-input" id="syncUrl" placeholder="https://calendar-widget-api.xxx.workers.dev" />
      </label>
      <label class="sync-label">아이디
        <input class="sync-input" id="syncUser" autocapitalize="off" autocomplete="username" />
      </label>
      <label class="sync-label">비밀번호
        <input class="sync-input" id="syncPass" type="password" autocomplete="current-password" />
      </label>
      <div class="sync-row">
        <button class="sync-btn-test" id="syncRegister">회원가입</button>
        <button class="sync-btn-save" id="syncLogin">로그인</button>
      </div>
      <div class="sync-status" id="syncStatus"></div>
      <button class="sync-logout" id="syncLogout" style="${isOn() ? "" : "display:none"}">로그아웃</button>
      <div class="sync-hint">자격증명은 이 기기에만 저장됩니다. 위젯에도 같은 아이디·비밀번호를 넣으세요. 비밀번호 분실 시 복구할 수 없습니다.</div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const urlIn = box.querySelector("#syncUrl");
    const userIn = box.querySelector("#syncUser");
    const passIn = box.querySelector("#syncPass");
    statusEl = box.querySelector("#syncStatus");
    urlIn.value = c.url; userIn.value = c.user; passIn.value = c.pass;
    if (isOn()) {
      const last = Number(localStorage.getItem(LAST_KEY)) || 0;
      setStatus("✓ 로그인됨: " + c.user + (last ? " · " + new Date(last).toLocaleString() : ""), true);
    }

    function valid() {
      if (!urlIn.value.trim()) { setStatus("서버 주소를 입력하세요"); return false; }
      if (!userIn.value.trim()) { setStatus("아이디를 입력하세요"); return false; }
      if (!passIn.value) { setStatus("비밀번호를 입력하세요"); return false; }
      return true;
    }

    box.querySelector("#syncRegister").onclick = async () => {
      if (!valid()) return;
      persistCreds(urlIn.value, userIn.value, passIn.value);
      setStatus("계정 만드는 중…");
      try {
        await apiRegister();
        await apiPost(); // 지금 기기의 일정을 새 계정으로 올림
        refreshBtn();
        setStatus("✓ 가입 완료 · 이 기기 일정을 올렸어요", true);
        box.querySelector("#syncLogout").style.display = "";
      } catch (e) {
        if (e.code === 409) setStatus("이미 있는 아이디예요. 로그인하세요.");
        else setStatus("가입 실패: " + e.message);
      }
    };

    box.querySelector("#syncLogin").onclick = async () => {
      if (!valid()) return;
      persistCreds(urlIn.value, userIn.value, passIn.value);
      setStatus("로그인 중…");
      try {
        const remote = await apiGet(); // 404면 catch
        window.CalendarApp.replaceStore(remote.store || {}, remote.updatedAt || Date.now());
        localStorage.setItem(LAST_KEY, String(Date.now()));
        refreshBtn();
        setStatus("✓ 로그인됨 · 일정 불러옴", true);
        box.querySelector("#syncLogout").style.display = "";
      } catch (e) {
        if (e.code === 404) setStatus("아이디 또는 비밀번호가 틀렸어요 (없는 계정이면 회원가입)");
        else setStatus("로그인 실패: " + e.message);
      }
    };

    box.querySelector("#syncLogout").onclick = () => {
      markLoggedOut();
      passIn.value = "";
      setStatus("로그아웃됨 (로컬 일정은 이 기기에 남아있어요)");
      box.querySelector("#syncLogout").style.display = "none";
      box.querySelector(".sync-title").textContent = "로그인";
    };

    function close() { overlay.remove(); statusEl = null; }
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function onEsc(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", onEsc); }
    });
  }

  // 버튼 연결 + 최초 동기화
  window.addEventListener("load", () => {
    const btn = document.getElementById("syncBtn");
    if (btn) btn.addEventListener("click", openModal);
    refreshBtn();
    reconcile();
  });
})();
