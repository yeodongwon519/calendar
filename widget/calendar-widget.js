// ===== 달력 위젯 부트스트랩 (Scriptable) =====
// 이 짧은 스크립트만 Scriptable 에 붙여넣고, 아래 아이디/비번만 바꾸면 된다.
// 실제 로직(widget-core.js)은 인터넷에서 불러오므로 붙여넣기로 깨지지 않는다.
const API_URL = "https://calendar-widget-api.ydw519.workers.dev";
const USERNAME = "여기에_아이디";
const PASSWORD = "여기에_비밀번호";
const APP_URL = "https://yeodongwon519.github.io/calendar/";
const CORE = "https://yeodongwon519.github.io/calendar/widget/widget-core.js";
const src = await new Request(CORE).loadString();
await eval(src);
