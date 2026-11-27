// 헤어 미러 — AI 변신 서버 (Cloudflare Workers)
// 하는 일
//  1) 기기마다 변신 토큰을 센다 (KV). 한도(기본 10개)를 다 쓰면 합성을 거절한다.
//  2) 하루 전체 변신 횟수에도 상한(기본 100번)을 둔다. 주소가 공개돼 있어도 하루 요금이 그 이상 나가지 않게.
//  3) 앱이 보낸 화면 한 장을 Gemini 이미지 모델에 보내 '가발을 실제로 쓴 사진'처럼 다시 합성한다.
//  4) AI 쪽 오류로 실패하면 방금 차감한 토큰을 돌려준다.
// 설정: wrangler.toml 의 [vars] / 비밀키는 `npx wrangler secret put GEMINI_API_KEY`
// 무료 플랜(요청당 CPU 10ms)에서도 돌도록, 수 MB짜리 이미지 데이터를 JSON으로 풀었다 다시 묶지 않고 그대로 넘긴다.
//   앱 → 서버: 본문 = JPEG의 base64 문자열 그대로, 기기 ID는 주소 뒤 ?device=
//   서버 → 앱: Gemini 응답 JSON 그대로 (+ 헤더 x-tokens-used / x-tokens-limit)
// 문제가 생기면 `npx wrangler tail` 로 Gemini가 돌려준 오류를 실시간으로 볼 수 있다.

const PROMPT = `This image is a phone screenshot of a hair try-on preview: a wig photo has been digitally pasted onto a person's head.
Re-render it as one natural, photorealistic photograph of the same person actually wearing this exact hairstyle.
Keep identical: the face, identity, expression, skin tone, eyes, makeup, clothing, background, framing and camera angle,
and the hairstyle's shape, length, parting and color.
Fix only what makes it look pasted: blend the hairline and hair edges into the skin, add realistic shadows from the hair onto
the forehead, cheeks and neck, match the hair's lighting and color temperature to the photo, remove any original hair that
sticks out from under the wig, and clean up seams or blurry patches around the head.
Do not add text, logos, borders, watermarks or extra people. Output only the edited photo.`;

const RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'];
const SIZES = ['512', '1K', '2K', '4K'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Expose-Headers': 'x-tokens-used, x-tokens-limit',
      'Vary': 'Origin',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    const limit = Math.max(1, parseInt(env.TOKEN_LIMIT || '10', 10) || 10);
    const dl = parseInt(env.DAILY_LIMIT ?? '100', 10);
    const dailyMax = Number.isFinite(dl) && dl >= 0 ? dl : 100;   // 0 이면 하루 상한 없음
    const okDevice = (d) => typeof d === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(d);
    const usedOf = async (key) => parseInt((await env.TOKENS.get(key)) || '0', 10) || 0;
    // KV는 같은 키에 1초에 한 번만 쓸 수 있어서, 막히면 잠깐 기다렸다 다시 쓴다
    const put = async (key, value, opt) => {
      for (let i = 0; i < 3; i++) {
        try { await env.TOKENS.put(key, value, opt); return true; } catch { await wait(1100); }
      }
      return false;
    };

    // 남은 토큰 조회
    if (url.pathname === '/tokens' && req.method === 'GET') {
      const device = url.searchParams.get('device');
      if (!okDevice(device)) return json({ error: 'bad_device' }, 400);
      const used = await usedOf('u:' + device);
      return json({ used, limit, remaining: Math.max(0, limit - used) });
    }

    // 변신 (AI 합성)
    if (url.pathname === '/transform' && req.method === 'POST') {
      const device = url.searchParams.get('device');
      if (!okDevice(device)) return json({ error: 'bad_device' }, 400);
      const b64 = (await req.text()).trim();
      if (b64.length < 100 || b64.length > 8_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return json({ error: 'bad_image' }, 400);

      const key = 'u:' + device;
      let used = await usedOf(key);
      if (used >= limit) return json({ error: 'no_tokens', used, limit, remaining: 0 }, 402);
      const dayKey = 'd:' + new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);   // 한국 날짜 기준
      let dayUsed = dailyMax ? await usedOf(dayKey) : 0;
      if (dailyMax && dayUsed >= dailyMax) return json({ error: 'daily_limit', used, limit, remaining: limit - used }, 429);

      // 시도할 때마다 먼저 1개 차감
      if (!(await put(key, String(used + 1)))) return json({ error: 'busy', used, limit, remaining: limit - used }, 503);
      used += 1;
      if (dailyMax) { dayUsed += 1; await put(dayKey, String(dayUsed), { expirationTtl: 3 * 86400 }); }
      const fail = async (error, extra = {}) => {   // AI 쪽 실패는 토큰 환불
        used = Math.max(0, used - 1);
        await put(key, String(used));
        if (dailyMax) await put(dayKey, String(Math.max(0, dayUsed - 1)), { expirationTtl: 3 * 86400 });
        return json({ error, refunded: true, used, limit, remaining: limit - used, ...extra }, 502);
      };

      // 결과 크기를 따로 정했을 때만 imageConfig 를 보낸다 (안 보내면 1K, 비율은 보낸 사진을 따라감)
      const size = SIZES.includes(env.IMAGE_SIZE) ? env.IMAGE_SIZE : null;
      const aspect = url.searchParams.get('aspect');
      const bodyOf = (withSize) => {
        const generationConfig = { responseModalities: ['IMAGE'] };
        if (withSize) generationConfig.imageConfig = { imageSize: size, ...(RATIOS.includes(aspect) ? { aspectRatio: aspect } : {}) };
        // 이미지 문자열은 JSON.stringify 하지 않고 이어 붙인다 (base64라 따옴표·역슬래시가 없어서 안전)
        return '{"contents":[{"parts":[{"text":' + JSON.stringify(PROMPT) +
          '},{"inline_data":{"mime_type":"image/jpeg","data":"' + b64 + '"}}]}],"generationConfig":' + JSON.stringify(generationConfig) + '}';
      };
      const model = env.MODEL || 'gemini-3.1-flash-image';
      const call = (withSize) => fetch(`https://generativelanguage.googleapis.com/${env.API_VERSION || 'v1beta'}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
        body: bodyOf(withSize),
      });
      let r;
      try {
        r = await call(!!size);
        if (r.status === 400 && size) {   // 크기 설정을 모델이 안 받으면 기본값으로 한 번 더
          console.log('imageConfig 거절됨, 기본 크기로 다시 시도:', (await r.text()).slice(0, 300));
          r = await call(false);
        }
      } catch (e) {
        console.log('Gemini 연결 실패:', String(e));
        return fail('ai_unreachable');
      }
      if (!r.ok || !r.body) {
        console.log('Gemini 오류', r.status, r.body ? (await r.text()).slice(0, 800) : '');
        return fail('ai_failed', { ai_status: r.status });
      }
      // 응답 앞부분(최대 64KB)만 읽어 사진이 들어 있는지 확인하고, 나머지 수 MB는 풀지 않고 그대로 흘려보낸다
      const reader = r.body.getReader(), head = [], dec = new TextDecoder();
      let seen = "", got = 0, found = false;
      while (got < 65536) {
        const { value, done } = await reader.read();
        if (done) break;
        head.push(value); got += value.byteLength;
        seen += dec.decode(value, { stream: true });
        if (seen.includes('"inlineData"') || seen.includes('"inline_data"')) { found = true; break; }
      }
      if (!found) {
        console.log('결과에 사진이 없음:', seen.slice(0, 800));
        await reader.cancel();
        return fail('no_image');
      }
      const stream = new ReadableStream({
        start(c) { for (const chunk of head) c.enqueue(chunk); },
        async pull(c) { const { value, done } = await reader.read(); if (done) c.close(); else c.enqueue(value); },
        cancel(reason) { return reader.cancel(reason); },
      });
      return new Response(stream, {
        headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'x-tokens-used': String(used), 'x-tokens-limit': String(limit) },
      });
    }

    // 테스트용 토큰 초기화 (ADMIN_KEY 를 설정했을 때만)
    if (url.pathname === '/reset' && req.method === 'POST') {
      if (!env.ADMIN_KEY || req.headers.get('x-admin-key') !== env.ADMIN_KEY) return json({ error: 'forbidden' }, 403);
      const device = url.searchParams.get('device');
      if (!okDevice(device)) return json({ error: 'bad_device' }, 400);
      await env.TOKENS.delete('u:' + device);
      return json({ ok: true, used: 0, limit, remaining: limit });
    }

    return json({ error: 'not_found' }, 404);
  },
};
