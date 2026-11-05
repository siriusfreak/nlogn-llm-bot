# nlogn-llm-bot

Telegram bot ([@nlogn_llm_bot](https://t.me/nlogn_llm_bot)) for NLogN contester users: it
takes a submission (statement, code, verdict, compiler/runtime errors), renders a prompt
template from the `templates` table and asks Claude to explain what is wrong.

## Configuration

Everything comes from environment variables; `config/config.yaml` (see
`config/config.yaml.example`) is optional and meant for local runs, the environment
overrides it.

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (workspace-scoped) |
| `CLAUDE_MODEL` | Model id, e.g. `claude-sonnet-5-5` |
| `CLAUDE_EFFORT` | `low` / `medium` / `high` / `xhigh` / `max`; unset = model default |
| `TELEGRAM_TOKEN` | Bot token |
| `CONTESTER_TOKEN` | Contester API token |
| `RATE_LIMIT` | Seconds between generations per user (default 30) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL |

On a safety-classifier refusal Opus and Sonnet are retried server-side on the model
Anthropic recommends for that category (`fallbacks: "default"`; Sonnet 5.5 retries only
`cyber` and `frontier_llm`). A refusal that stands marks the generation `FAILED`.

## Run and test

```bash
npm ci
npm test                                   # unit tests; API/contester tests run only with a key / config
ANTHROPIC_API_KEY=... npx jest claude      # one real Claude call
npm start
```

## Deploy (home k8s cluster)

The image carries no credentials. In the cluster they come from Secrets that the
1Password `op-tag-sync` controller creates from items in vault `homelab` tagged
`k8s/nlogn-llm-bot`:

- `nlogn-llm-bot-secrets` with fields `TELEGRAM_TOKEN`, `CONTESTER_TOKEN`
- `anthropic-api-key` (field `password`)
- `postgres-postgresql` (field `postgres-password`)

```bash
make push      # docker build linux/amd64 + push registry.i.siriusfrk.ru/nlogn-llm-bot:<commit sha>
make logs
```

The manifests are `k8s/nlogn-llm-bot` in home-infrastructure: set the image tag there, commit, then Sync in Argo CD.
