# ACTIS Auth Worker

Cloudflare Worker for ACTIS Discord/Google OAuth and Firebase Custom Token issuance.

## Migration

- Source is tracked in GitHub under `workers/actis-auth`.
- Keep OAuth client secrets and Firebase private keys in Cloudflare Secrets; never commit them.
- Keep the existing `AUTH_KV` namespace and its data.
- Replace the placeholder KV namespace ID in `wrangler.toml` before CLI deployment.
- For Cloudflare Workers Builds, set the root directory to `workers/actis-auth`.
- Preserve the existing Worker service/name and routes so `actis-auth.goshi20080226.workers.dev` continues to work.

## Required environment variables/secrets

`FIREBASE_CLIENT_EMAIL`
`FIREBASE_PRIVATE_KEY`
`DISCORD_CLIENT_ID`
`DISCORD_CLIENT_SECRET`
`DISCORD_REDIRECT_URI`
`GOOGLE_CLIENT_ID`
`GOOGLE_CLIENT_SECRET`
`GOOGLE_REDIRECT_URI`
`ACTIS_ORIGIN`

## KV

Binding: `AUTH_KV`

Do not create a new KV namespace during migration unless the existing namespace is intentionally being replaced.
