# Qookey AI Recommendation Backend V0.5

## Goal

Turn the large homepage task box into a real AI resource recommender while keeping the existing keyword search available.

User flow:

1. User describes a task in Traditional Chinese or another language.
2. Frontend sends the task to the Cloudflare Worker.
3. Worker loads the current `data/resources.json` catalog.
4. Workers AI selects 3–5 resources from that catalog only.
5. Worker validates returned resource IDs before responding.
6. Frontend shows reasons, suggested roles, a small stack plan and the matching resource cards.

The model is not allowed to invent resources outside the catalog.

## Backend

Location: `worker/`

- Runtime: Cloudflare Workers
- AI: Workers AI binding `env.AI`
- Default model: `@cf/meta/llama-3.1-8b-instruct`
- Catalog source: public GitHub `main` `data/resources.json`
- Endpoint: `POST /api/recommend`
- Health check: `GET /health`
- CORS: production GitHub Pages origin plus localhost for development
- Input limit: 2–500 characters
- AI output: strict catalog IDs, validated server-side
- Fallback: deterministic keyword/content ranking when model output fails

No AI API key is stored in frontend JavaScript or this repository.

## Deploy with GitHub Actions

A manual workflow exists at:

`.github/workflows/deploy-ai-worker.yml`

Repository secrets required:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The API token must have the Cloudflare permissions needed to deploy Workers for the target account.

Then run:

`GitHub → Actions → Deploy AI Worker → Run workflow`

The workflow is intentionally manual so missing Cloudflare secrets do not break normal Pages CI.

## Deploy locally with Wrangler

```bash
cd worker
npm install
npx wrangler login
npm run deploy
```

Copy the resulting `https://<worker>.<subdomain>.workers.dev/api/recommend` URL.

## Enable the frontend

Edit `data/ai-config.json`:

```json
{
  "schema_version": "0.1",
  "enabled": true,
  "endpoint": "https://<worker>.<subdomain>.workers.dev/api/recommend",
  "updated_at": "YYYY-MM-DD"
}
```

Until this is enabled, the site continues to behave as a normal keyword-search catalog and displays a clear backend-not-enabled message if the user explicitly requests AI recommendations.

## Request

```json
{
  "query": "我要做 LINE AI 客服"
}
```

## Response shape

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

## Security / governance

- Never put Cloudflare tokens or third-party model API keys in browser JavaScript.
- The backend only accepts the configured production origin plus localhost development origins.
- The model sees only public catalog metadata and the task query.
- Returned IDs are checked against the current resource catalog.
- Unknown or unavailable AI output falls back instead of inventing resources.
- `data/resources.json` remains the resource authority; the AI backend does not write catalog data.
