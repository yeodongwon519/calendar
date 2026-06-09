# 로그인 + 아이폰 위젯 설치 가이드

달력에 **아이디/비밀번호 로그인**을 붙이고, 그 계정 일정을 **아이폰 홈화면 위젯**으로 띄운다.
구조: 웹앱 로그인 → 일정이 Cloudflare 클라우드에 동기화 → 위젯이 그 계정 데이터를 읽어 표시.
위젯은 **읽기 전용**, 입력·수정은 웹앱에서.

작동 원리(요약): 비밀번호는 **저장하지 않는다.** 서버 비밀값(PEPPER)을 섞어 만든 해시를
저장 키로 써서 계정별로 데이터를 분리한다(계정 DB 없음). 그래서 **비밀번호 분실 시 복구 불가**.

준비물: Cloudflare 계정(무료), 아이폰 **Scriptable** 앱(무료).

---

## 1부. Cloudflare Worker 만들기 (한 번만)

### 방법 A — 명령어(wrangler), PC에서 권장

```bash
npm install -g wrangler
wrangler login

cd 달력/widget

# 1) KV 네임스페이스 생성 → 출력된 id 복사
wrangler kv namespace create CAL_KV

# 2) wrangler.toml 의 id 자리에 붙여넣기
#    kv_namespaces = [ { binding = "CAL_KV", id = "여기" } ]

# 3) 서버 비밀값(PEPPER) 설정 — 아무 긴 랜덤 문자열. 한 번 정하면 바꾸지 말 것.
wrangler secret put PEPPER

# 4) 배포 → https://calendar-widget-api.<계정>.workers.dev 주소 확인
wrangler deploy
```

### 방법 B — 대시보드(웹)

1. Workers & Pages → Create → Worker → 이름 짓고 Deploy → Edit code 에 `worker.js` 붙여넣고 Deploy.
2. Storage & Databases → KV → Create namespace.
3. Worker → Settings → Bindings → KV namespace 추가: 변수명 `CAL_KV`, 위 네임스페이스 선택.
4. Worker → Settings → Variables and Secrets → **Secret** 추가: 이름 `PEPPER`, 값은 아무 긴 랜덤 문자열.
5. Worker 주소(`https://...workers.dev`) 확인.

---

## 2부. 웹앱에서 회원가입 / 로그인

1. 달력 사이트 → 상단 **👤 버튼** 탭.
2. **서버 주소** = 1부의 `https://...workers.dev` (한 번만 입력하면 기억됨)
3. **아이디 / 비밀번호** 입력.
4. 처음이면 **회원가입** → 지금 기기의 일정이 그 계정으로 올라감.
   이미 계정 있으면 **로그인** → 클라우드 일정을 내려받음.
5. 이후 일정 추가/수정은 자동으로 클라우드에 동기화. PC·아이폰 어디서 로그인해도 같은 일정.

> 아이디는 대소문자 구분 안 함, 비밀번호는 구분함. 한글도 가능.

---

## 3부. 아이폰 위젯 설치 (Scriptable)

1. 앱스토어에서 **Scriptable** 설치.
2. Scriptable → 우상단 **＋** → `calendar-widget.js` 내용 전체 붙여넣기.
3. 맨 위 값 수정 (웹앱 로그인과 **똑같이**):
   - `API_URL`  = Worker 주소
   - `USERNAME` = 가입한 아이디
   - `PASSWORD` = 그 비밀번호
   - `APP_URL`  = 달력 웹앱 주소 (기본값 그대로 OK)
4. 좌상단에서 이름 "달력"으로 저장.
5. 홈화면 빈 곳 길게 누름 → 좌상단 **＋** → **Scriptable** → 위젯 크기 선택(중간 추천) → 추가.
6. 추가된 위젯 길게 눌러 **위젯 편집** → **Script** = "달력", **When Interacting** = Run Script(또는 Open URL).

끝. 위젯에 오늘 일정이 뜨고, 탭하면 웹앱이 열린다.

---

## 메모 / 제약

- 위젯은 iOS가 정한 주기로 갱신(보통 수십 분). 즉시 보려면 앱을 한 번 열거나 위젯을 새로고침.
- 위젯은 읽기 전용 — 체크/입력은 웹앱에서.
- GET·POST 모두 로그인(Basic 인증) 필요 → 일정은 비공개.
- 비밀번호는 서버에 저장되지 않음. 분실 시 그 계정 데이터는 복구 불가(새로 가입).
- PEPPER 를 바꾸면 모든 기존 계정 키가 달라져 데이터를 못 찾게 됨 — 절대 변경 금지.
- 기기 localStorage 에 아이디·비번이 저장됨(자동 로그인용). 공용 기기에선 로그아웃 권장.
