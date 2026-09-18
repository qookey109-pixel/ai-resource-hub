# Qookey AI Recommendation Backend

The AI recommender is a **separate Cloudflare Worker service**. It is deployed and monitored, but the current marketplace UI does not expose a standalone AI recommendation panel.

The public catalog remains fully usable without this Worker.

## Runtime

Location: `worker/`

- Runtime: Cloudflare Workers
- AI binding: `env.AI`
- Default model: `@cf/meta/llama-3.1-8b-instruct`
- Catalog source: public GitHub `main` `data/resources.json`
- Endpoint: `POST /api/recommend`
- Health: `GET /health`
- Input limit: 2–500 characters
- Output: catalog resource IDs only, validated server-side
- Fallback: deterministic keyword/content ranking

The model is not allowed to create resource IDs outside the catalog.

## Current frontend boundary

- Browsing, filtering and search are local/deterministic.
- No AI API key is present in browser JavaScript.
- The standalone AI recommendation panel is intentionally not part of the current UI.
- `data/ai-config.json` records the deployed recommendation endpoint for project operations and monitoring; it is not required by the current Pages UI.

## Request

```json
{
  "query": "我要做 LINE AI 客服"
}
```

## Response

```json
{
  "ok": true,
  "mode": "ai",
  "query": "我要做 LINE AI 客服",
  "intent_summary": "...",
  "recommendations": [
    {
      "id": "resource-id",
      "role": "核心工具",
      "reason": "...",
      "how_to_use": "..."
    }
  ],
  "stack_plan": ["..."],
  "caveats": ["..."]
}
```

## Deployment

Workflow:

`.github/workflows/deploy-ai-worker.yml`

Required repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The workflow:

1. validates deterministic fallback behavior;
2. verifies Cloudflare credentials;
3. deploys the Worker;
4. verifies `/health`;
5. runs semantic recommendation regressions;
6. records the deployed endpoint in `data/ai-config.json` when needed.

Local deployment:

```bash
cd worker
npm install
npx wrangler login
npm run deploy
```

## Security and governance

- Never put Cloudflare tokens or third-party model API keys in frontend code.
- The Worker only recommends IDs from the current catalog.
- Returned IDs are validated before response.
- Unknown / unavailable AI output falls back instead of inventing resources.
- `data/resources.json` remains the resource authority.
- The AI Worker never writes catalog metadata.
