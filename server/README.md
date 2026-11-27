# 헤어 미러 AI 변신 서버

앱의 **변신** 버튼이 진짜 AI로 합성하려면 이 서버가 필요해요.
서버가 Gemini API 키를 숨겨서 들고 있고, 기기마다 토큰 10개를 직접 세요. 10개를 다 쓴 기기의 요청은 서버가 거절해요.

```
앱(GitHub Pages) ──화면 한 장──▶ 이 서버(Cloudflare Worker) ──▶ Gemini 이미지 모델
                 ◀──AI가 다시 그린 사진──            (키 보관 · 토큰 계산)
```

## 준비물

- **Gemini API 키 + 결제 등록**: [Google AI Studio](https://aistudio.google.com/)에서 키를 만들고 결제(Billing)를 연결해요. 이미지 모델은 무료 등급이 없어서, 결제를 안 걸면 `429 … limit: 0` 오류가 나요.
- **Cloudflare 계정** (무료)
- **Node.js** (`npx` 명령용)

## 올리는 순서

1. 이 `server` 폴더에서 로그인하고 저장소(KV)를 만들어요.
   ```bash
   npx wrangler login
   npx wrangler kv namespace create TOKENS
   ```
   출력에 나온 `id` 를 `wrangler.toml` 의 `id = "여기에_KV_네임스페이스_ID"` 자리에 붙여넣어요.
2. API 키를 비밀값으로 넣어요. 키는 코드나 앱에 절대 넣지 않아요.
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```
3. 배포해요.
   ```bash
   npx wrangler deploy
   ```
   `https://hair-mirror-ai.<계정>.workers.dev` 같은 주소가 나와요.
4. 저장소 맨 위의 `config.js` 에 그 주소를 넣고 커밋해요. 빌드는 다시 안 해도 돼요. GitHub 웹에서 연필 버튼으로 고쳐도 돼요.
   ```js
   window.HM_CONFIG = {
     aiUrl: 'https://hair-mirror-ai.<계정>.workers.dev'
   };
   ```
   GitHub Pages에 반영되는 데 1~2분, 캐시 때문에 길면 10분쯤 걸려요.

`aiUrl` 이 비어 있으면 앱은 **체험 모드**(기기 안에서 간단 보정)로 동작해요.

## 잘 붙었는지 확인

- 서버: `curl "https://hair-mirror-ai.<계정>.workers.dev/tokens?device=test-device-01"` → `{"used":0,"limit":10,"remaining":10}`
- 앱: 토큰 버튼을 눌렀을 때 "토큰은 AI 서버가 직접 세고…" 문구가 보이면 서버에 연결된 거예요.
- 변신이 실패하면 `npx wrangler tail` 을 켜 두고 다시 눌러 보세요. Gemini가 돌려준 오류가 그대로 보여요.

| tail 에 보이는 오류 | 원인 |
|---|---|
| `429` + `limit: 0` | 결제가 등록되지 않음 |
| `400` + `API key not valid` | 키가 틀림 → `secret put` 다시 |
| `404` + 모델 이름 | `MODEL` 이름 확인 |
| `결과에 사진이 없음` + `IMAGE_SAFETY` 등 | AI가 그 사진 편집을 거절함 (토큰은 돌려줌) |
| 브라우저 콘솔에 CORS 오류 | `ALLOW_ORIGIN` 이 앱 주소와 다름 |

## 동작 규칙

| 상황 | 결과 |
|---|---|
| 변신 시도 | 토큰 1개를 먼저 차감하고 AI를 호출해요 |
| AI 오류, 결과 사진 없음 | 차감한 토큰을 돌려줘요 (`refunded: true`) |
| 그 기기가 10개를 다 씀 | `402 no_tokens` 로 거절해요. 앱은 변신 버튼을 멈춰요 |
| 하루 전체 상한(`DAILY_LIMIT`)에 도달 | `429 daily_limit` 로 거절해요. 토큰은 줄지 않고, 한국 시간 자정에 풀려요 |

- 테스트용 초기화: `npx wrangler secret put ADMIN_KEY` 로 암호를 넣은 뒤
  `curl -X POST "https://…workers.dev/reset?device=기기ID" -H "x-admin-key: 암호"`
  - 기기 ID는 앱을 연 브라우저의 localStorage `hm_device` 값이에요.

## 설정값 (`wrangler.toml` 의 `[vars]`)

| 이름 | 기본 | 뜻 |
|---|---|---|
| `ALLOW_ORIGIN` | `https://kery27.github.io` | 이 서버를 부를 수 있는 웹페이지 주소 |
| `MODEL` | `gemini-3.1-flash-image` | 절반 값을 원하면 `gemini-3.1-flash-lite-image` |
| `TOKEN_LIMIT` | `10` | 기기 하나당 변신 토큰 |
| `DAILY_LIMIT` | `100` | 하루 전체 변신 상한 (`0` 이면 없음) |
| `IMAGE_SIZE` | (없음 = 1K) | `512` 로 싸고 작게, `2K` 로 크고 비싸게 |

바꾼 뒤에는 `npx wrangler deploy` 를 다시 해요.

## 비용

- **Gemini**: `gemini-3.1-flash-image` 1K 한 장에 약 $0.067 (512는 약 $0.045, 2K는 약 $0.101). Lite 모델은 1K 한 장에 약 $0.034.
  - 기기 하나가 토큰 10개를 다 쓰면 최대 약 $0.67, `DAILY_LIMIT` 100이면 하루 최대 약 $6.7.
- **Cloudflare 무료 플랜**: 하루 요청 10만 건, KV 쓰기 하루 1,000건(변신 1번에 2건 → 하루 약 500번까지).
  요청당 CPU 10ms 제한이 있는데, 이 서버는 사진 데이터를 풀지 않고 그대로 넘겨서 몇 ms만 써요.
  그래도 `Error 1102` 가 보이면 Workers Paid(월 $5)로 올리면 돼요.
- Google Cloud 결제에 **예산 알림**을 꼭 걸어두세요.

## 꼭 알아둘 것

- **서버 주소는 공개돼요.** `config.js` 에 들어가니 누구나 볼 수 있어요. 그래서 `DAILY_LIMIT` 로 하루 요금 상한을 둬요.
- **토큰 기준이 기기라는 점:** 토큰은 기기(브라우저) 단위로 세요. 브라우저 데이터를 지우면 새 기기로 보여서 토큰 10개가 다시 생겨요. 실제 서비스에서는 로그인(예: 카카오 로그인)을 붙여서 사람 단위로 세야 해요.
- **사진 전송:** 변신을 누르면 그 화면 한 장이 Google 서버로 전송돼요. 앱에도 이 안내가 나와요. 손님 사진을 다룬다면 개인정보 처리 안내를 꼭 갖추세요.
- AI가 만든 사진에는 Google의 보이지 않는 워터마크(SynthID)가 들어가요.
