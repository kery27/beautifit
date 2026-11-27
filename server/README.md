# 헤어 미러 AI 변신 서버

앱의 **변신** 버튼이 진짜 AI로 합성하려면 이 서버가 필요해요.
서버가 Gemini API 키를 숨겨서 들고 있고, 기기마다 토큰 10개를 직접 세요.
10개를 다 쓴 기기의 요청은 서버가 거절해요.

## 올리는 순서 (Cloudflare Workers, 무료 플랜으로 시작 가능)

1. Google AI Studio에서 Gemini API 키를 발급받아요.
2. 이 `server` 폴더에서 아래 명령을 실행해요.
   ```bash
   npx wrangler login
   npx wrangler kv namespace create TOKENS      # 나온 id를 wrangler.toml 에 붙여넣기
   npx wrangler secret put GEMINI_API_KEY       # 1번에서 받은 키 입력
   npx wrangler secret put ADMIN_KEY            # (선택) 테스트용 초기화 암호
   ```
3. `wrangler.toml` 의 `ALLOW_ORIGIN` 을 앱을 올린 주소로 바꿔요 (예: `https://아이디.github.io`).
4. `npx wrangler deploy` 를 실행하면 `https://hair-mirror-ai.<계정>.workers.dev` 같은 주소가 나와요.
5. 앱의 `index.html` 에서 `const AI_URL='';` 을 찾아 그 주소를 넣고 GitHub Pages에 다시 올려요.
   ```js
   const AI_URL='https://hair-mirror-ai.<계정>.workers.dev';
   ```

이제 변신을 누르면 화면 한 장이 이 서버를 거쳐 Gemini로 가고, AI가 다시 그린 사진이 돌아와요.
`AI_URL` 이 비어 있으면 앱은 **체험 모드**(기기 안에서 간단 보정)로 동작해요.

## 동작 규칙

| 상황 | 결과 |
|---|---|
| 변신 시도 | 토큰 1개를 먼저 차감하고 AI를 호출해요 |
| AI 오류, 결과 이미지 없음 | 차감한 토큰을 돌려줘요 (`refunded: true`) |
| 이미 10개를 다 씀 | `402 no_tokens` 로 거절해요. 앱은 변신 버튼을 멈춰요 |

- 테스트용 초기화: `curl -X POST "https://…workers.dev/reset?device=기기ID" -H "x-admin-key: 암호"`
  - 기기 ID는 앱을 연 브라우저의 localStorage `hm_device` 값이에요.

## 꼭 알아둘 것

- **비용:** 변신 1번마다 Gemini 이미지 생성 요금이 나가요. Google Cloud에서 예산 알림을 걸어두세요.
- **토큰 기준이 기기라는 점:** 지금 토큰은 기기(브라우저) 단위로 세요. 브라우저 데이터를 지우면 새 기기로 보여서 토큰 10개가 다시 생겨요. 실제 서비스에서는 로그인(예: 카카오 로그인)을 붙여서 사람 단위로 세야 해요.
- **사진 전송:** 변신을 누르면 그 화면 한 장이 Google 서버로 전송돼요. 앱에도 이 안내가 나와요. 손님 사진을 다룬다면 개인정보 처리 안내를 꼭 갖추세요.
