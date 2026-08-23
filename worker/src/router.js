import recommender from './index.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

const RULES = [
  {
    domain: 'game',
    match: /(?:做|開發|製作|想要|我要|我想)?.{0,4}(?:遊戲|game)/i,
    qualifiers: /手機|mobile|web|網頁|瀏覽器|browser|3d|2d|unity|unreal|godot|npc|ai|多人|單機|賽車|射擊|rpg|卡牌|益智|平台|模擬|vr|ar|steam|ios|android/i,
    question: '你想做哪一類遊戲？先選方向，我再幫你找最適合的資源。',
    choices: [
      { label: '手機小遊戲', refinement: '我要做手機小遊戲，優先簡單、容易快速做出原型。' },
      { label: 'Web／瀏覽器遊戲', refinement: '我要做 Web／瀏覽器遊戲，希望直接在瀏覽器執行。' },
      { label: '3D 遊戲', refinement: '我要做 3D 遊戲，需要 3D、動畫與遊戲開發相關資源。' },
      { label: 'NPC／Game AI', refinement: '我要做遊戲裡的 NPC／Game AI，需要 AI 行為與遊戲 AI 開發資源。' }
    ]
  },
  {
    domain: 'website',
    match: /(?:做|開發|製作|想要|我要|我想)?.{0,4}(?:網站|網頁|website|site)/i,
    qualifiers: /電商|商城|作品集|portfolio|官網|品牌|saas|後台|dashboard|ai|聊天|客服|landing|blog|部落格|會員|登入|支付|api/i,
    question: '你想做哪一種網站？用途不同，適合的工具會差很多。',
    choices: [
      { label: '品牌／作品網站', refinement: '我要做品牌或作品展示網站，重視 UI、互動與視覺品質。' },
      { label: 'SaaS／管理後台', refinement: '我要做 SaaS 或管理後台，需要前端、資料庫、登入與部署。' },
      { label: '電商／市場', refinement: '我要做電商或資源市場網站，需要商品／資源列表、搜尋與後端。' },
      { label: 'AI 功能網站', refinement: '我要做有 AI 功能的網站，需要 AI API、後端與前端整合。' }
    ]
  },
  {
    domain: 'app',
    match: /(?:做|開發|製作|想要|我要|我想)?.{0,4}(?:app|應用程式|應用|軟體)/i,
    qualifiers: /ios|iphone|ipad|android|手機|mac|windows|桌面|desktop|electron|tauri|react native|flutter|ai|聊天|客服/i,
    question: '你想做哪一種 App？先確認平台，我才能推薦對的開發資源。',
    choices: [
      { label: 'iOS／Android', refinement: '我要做 iOS／Android 手機 App，希望能快速做出可上架版本。' },
      { label: '桌面 App', refinement: '我要做桌面 App，主要在 macOS／Windows 執行。' },
      { label: '跨平台 App', refinement: '我要做跨平台 App，希望一套程式碼支援多平台。' },
      { label: 'AI App', refinement: '我要做 AI App，需要模型／API 與 App 前後端整合。' }
    ]
  },
  {
    domain: 'video',
    match: /(?:做|製作|產生|生成|想要|我要|我想)?.{0,4}(?:影片|視頻|video)/i,
    qualifiers: /shorts|tiktok|reels|短影片|剪輯|字幕|配音|tts|生成|text-to-video|自動|批次|youtube/i,
    question: '你想處理影片的哪一部分？',
    choices: [
      { label: 'AI 短影片整套完成', refinement: '我要自動產生 AI 短影片，希望從腳本、素材、配音、字幕到成片一套完成。' },
      { label: '剪輯／字幕', refinement: '我要做影片剪輯與字幕處理，不需要從零生成整支影片。' },
      { label: '配音／語音', refinement: '我要替影片做 AI 配音、語音複製或多語配音。' },
      { label: '生成式影片', refinement: '我要用文字或圖片生成影片內容。' }
    ]
  },
  {
    domain: '3d',
    match: /(?:做|製作|生成|想要|我要|我想)?.{0,4}(?:3d|三維|模型)/i,
    qualifiers: /遊戲|game|web|three|webgl|角色|character|rig|動畫|animation|文字|圖片|生成|print|列印/i,
    question: '你要用 3D 做什麼？',
    choices: [
      { label: '遊戲模型', refinement: '我要做遊戲用 3D 模型與資產。' },
      { label: 'Web 3D', refinement: '我要做網站上的 Three.js／WebGL 3D 互動。' },
      { label: '文字／圖片轉 3D', refinement: '我要從文字或圖片快速生成 3D 模型。' },
      { label: '角色動畫', refinement: '我要做 3D 角色 Rig 與動畫。' }
    ]
  }
];

function json(data, status = 200, request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGIN || 'https://qookey109-pixel.github.io');
  const headers = { ...JSON_HEADERS };
  if (!origin || origin === allowed || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    headers['access-control-allow-origin'] = origin || allowed;
    headers['access-control-allow-methods'] = 'POST, OPTIONS';
    headers['access-control-allow-headers'] = 'content-type';
    headers.vary = 'Origin';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function compact(value) {
  return String(value || '').replace(/[\s，。！？、,.!?]/g, '');
}

function clarificationFor(query) {
  const shortQuery = compact(query);
  if (shortQuery.length > 18) return null;

  for (const rule of RULES) {
    if (!rule.match.test(query)) continue;
    if (rule.qualifiers.test(query)) continue;
    return rule;
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return recommender.fetch(request, env, ctx);
    }

    if (request.method === 'POST' && url.pathname === '/api/recommend') {
      let body = null;
      try {
        body = await request.clone().json();
      } catch {
        return recommender.fetch(request, env, ctx);
      }

      const query = String(body?.query || '').trim();
      const rule = clarificationFor(query);
      if (rule) {
        return json({
          ok: true,
          mode: 'clarify',
          query,
          domain: rule.domain,
          clarifying_question: rule.question,
          choices: rule.choices
        }, 200, request, env);
      }
    }

    return recommender.fetch(request, env, ctx);
  }
};
