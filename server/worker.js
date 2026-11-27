// 헤어 미러 — AI 변신 서버 (Cloudflare Workers)
// 하는 일
//  1) 기기마다 변신 토큰을 센다 (KV). 한도(기본 10개)를 다 쓰면 합성을 거절한다.
//  2) 앱이 보낸 화면 한 장을 Gemini 이미지 모델에 보내 '가발을 실제로 쓴 사진'처럼 다시 합성한다.
//  3) AI 쪽 오류로 실패하면 방금 차감한 토큰을 돌려준다.
// 설정: wrangler.toml 의 [vars] / 비밀키는 `npx wrangler secret put GEMINI_API_KEY`

const PROMPT = `This image is a phone screenshot of a hair try-on preview: a wig photo has been digitally pasted onto a person's head.
Re-render it as one natural, photorealistic photograph of the same person actually wearing this exact hairstyle.
Keep identical: the face, identity, expression, skin tone, eyes, makeup, clothing, background, framing and camera angle,
and the hairstyle's shape, length, parting and color.
Fix only what makes it look pasted: blend the hairline and hair edges into the skin, add realistic shadows from the hair onto
the forehead, cheeks and neck, match the hair's lighting and color temperature to the photo, remove any original hair that
sticks out from under the wig, and clean up seams or blurry patches around the head.
Do not add text, logos, borders, watermarks or extra people. Output only the edited photo.`;

const RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'];

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Vary': 'Origin',
    };
    const json = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    const limit = Math.max(1, parseInt(env.TOKEN_LIMIT || '10', 10));
    const okDevice = (d) => typeof d === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(d);
    const usedOf = async (key) => parseInt((await env.TOKENS.get(key)) || '0', 10) || 0;

    // 남은 토큰 조회
    if (url.pathname === '/tokens' && req.method === 'GET') {
      const device = url.searchParams.get('device');
      if (!okDevice(device)) return json({ error: 'bad_device' }, 400);
      const used = await usedOf('u:' + device);
      return json({ used, limit, remaining: Math.max(0, limit - used) });
    }

    // 변신 (AI 합성)
    if (url.pathname === '/transform' && req.method === 'POST') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
      const { device, image, aspect } = body || {};
      if (!okDevice(device)) return json({ error: 'bad_device' }, 400);
      const m = typeof image === 'string' && image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return json({ error: 'bad_image' }, 400);
      if (m[2].length > 8_000_000) return json({ error: 'too_large' }, 413);

      const key = 'u:' + device;
      let used = await usedOf(key);
      if (used >= limit) return json({ error: 'no_tokens', used, limit, remaining: 0 }, 402);
      used += 1;                                   // 시도할 때마다 먼저 1개 차감
      await env.TOKENS.put(key, String(used));
      const fail = async (error, status = 502) => {  // AI 쪽 실패는 토큰 환불
        used = Math.max(0, used - 1);
        await env.TOKENS.put(key, String(used));
        return json({ error, refunded: true, used, limit, remaining: limit - used }, status);
      };

      const generationConfig = { responseModalities: ['IMAGE'] };
      if (RATIOS.includes(aspect)) generationConfig.imageConfig = { aspectRatio: aspect };
      const model = env.MODEL || 'gemini-3.1-flash-image';
      let r;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/${env.API_VERSION || 'v1beta'}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
            generationConfig,
          }),
        });
      } catch {
        return fail('ai_unreachable');
      }
      if (!r.ok) return fail('ai_failed');
      const data = await r.json().catch(() => null);
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const part = parts.find((p) => p.inlineData || p.inline_data);
      const out = part && (part.inlineData || part.inline_data);
      if (!out || !out.data) return fail('no_image');
      return json({
        image: `data:${out.mimeType || out.mime_type || 'image/png'};base64,${out.data}`,
        used, limit, remaining: limit - used,
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
