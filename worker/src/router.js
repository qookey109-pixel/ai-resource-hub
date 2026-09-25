import recommender from './index.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

const RULES = [
  {
    domain: 'mcp',
    match: /(?:\bmcp\b|model\s+context\s+protocol|模型上下文協定)/i,
    qualifiers: /github|gitlab|\bgit\b|瀏覽器|browser|playwright|搜尋|search|research|研究|scrap|crawl|資料庫|database|postgres|sql|supabase|雲端|cloud|部署|deploy|render|cloudflare|記憶|memory|文件|docs?|context7|stripe|支付|finance|金融/i,
    question: '你想讓 MCP 連接哪一類能力？',
    choices: [
      { label: '程式碼／Repository', refinement: '我要找連接程式碼與 Repository 的 MCP，重點是 Git、GitHub、程式碼理解或開發工作流。' },
      { label: '瀏覽器／搜尋研究', refinement: '我要找瀏覽器、自動化、網頁抓取或搜尋研究用途的 MCP。' },
      { label: '資料庫／Backend', refinement: '我要找資料庫或 Backend MCP，需要操作 SQL、PostgreSQL、Supabase 或後端服務。' },
      { label: '雲端／部署服務', refinement: '我要找雲端與部署 MCP，需要操作 Cloudflare、Render 或其他基礎設施服務。' }
    ]
  },
  {
    domain: 'ai-coding',
    match: /(?:ai\s*[-/]?\s*coding|coding\s*agent|ai\s*(?:程式|編程|寫程式)|(?:程式|編程|寫程式).{0,3}ai)/i,
    qualifiers: /codex|claude|cursor|windsurf|cline|copilot|前端|frontend|\bui\b|後端|backend|測試|test|\bqa\b|資安|安全|security|審查|review|memory|記憶|context|\bmcp\b|agent\s*skills?|技能/i,
    question: '你想用 AI Coding 工具處理哪一類工作？',
    choices: [
      { label: 'Coding Agent／自動改碼', refinement: '我要找 AI Coding Agent，重點是讀程式碼、修改檔案、執行工具與完成開發任務。' },
      { label: 'Codebase Context／Memory', refinement: '我要改善 Coding Agent 對 codebase 的理解、記憶、索引與長期 context。' },
      { label: '前端／UI 品質', refinement: '我要找協助 AI Coding 做前端、UI、設計系統與互動品質的工具或 skills。' },
      { label: '測試／安全／Code Review', refinement: '我要找 AI Coding 的測試、程式碼審查、安全掃描或品質檢查工具。' }
    ]
  },
  {
    domain: 'agent-ecosystem',
    match: /(?:ai\s*agent|agent\s*(?:工具|框架|生態|skills?)|智能體|代理人)/i,
    qualifiers: /skill|技能|\bmcp\b|framework|框架|runtime|memory|記憶|context|telemetry|observability|監控|coding|程式|research|研究|automation|自動化|workflow|工作流/i,
    question: '你在找 Agent 生態的哪一層？',
    choices: [
      { label: 'Agent Skills', refinement: '我要找可直接加入 Agent 的 Skills、規則或專門能力。' },
      { label: 'Agent Framework／Runtime', refinement: '我要找建立或執行 AI Agent 的 framework、runtime 或 orchestration 工具。' },
      { label: 'Memory／Context', refinement: '我要找 Agent memory、context、codebase memory 或長期狀態管理工具。' },
      { label: '監控／自動化工作流', refinement: '我要找 Agent telemetry、observability、automation 或工作流整合工具。' }
    ]
  },
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

export function clarificationFor(query) {
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
          decision_mode: 'system1',
          decision_type: 'choice',
          clarifying_question: rule.question,
          choices: rule.choices
        }, 200, request, env);
      }
    }

    return recommender.fetch(request, env, ctx);
  }
};
