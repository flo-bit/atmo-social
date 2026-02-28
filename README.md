# svelte atproto cloudflare workers oauth demo

A SvelteKit app that authenticates users via AT Protocol OAuth on Cloudflare Workers. Uses server-side OAuth with `@atcute/oauth-node-client`, Cloudflare KV for session/state storage, and SvelteKit remote functions for type-safe client-server communication.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`pnpm add -g wrangler`)
- A domain pointed at Cloudflare (for production)

## Local Development

### 1. Install dependencies

```sh
pnpm install
```

### 2. Run the dev server

```sh
pnpm dev
```

In dev mode, the app uses a **loopback OAuth client** (public, no keys needed) with in-memory stores. It binds to `127.0.0.1:5183` — this is required for AT Protocol loopback OAuth.

No Cloudflare setup is needed for local development.

## Production Deployment

### 1. Create KV namespaces

Create two KV namespaces for storing OAuth sessions and states:

```sh
npx wrangler kv namespace create OAUTH_SESSIONS
npx wrangler kv namespace create OAUTH_STATES
```

Each command outputs an ID. Update `wrangler.toml` with the actual IDs:

```toml
[[kv_namespaces]]
binding = "OAUTH_SESSIONS"
id = "<your-sessions-namespace-id>"

[[kv_namespaces]]
binding = "OAUTH_STATES"
id = "<your-states-namespace-id>"
```

### 2. Generate a client assertion key

AT Protocol OAuth requires a confidential client with a private key for production. Generate one:

```sh
pnpm generate-key
```

This outputs a JSON key. Add it as a Cloudflare Workers secret:

```sh
npx wrangler secret put CLIENT_ASSERTION_KEY
```

When prompted, paste the JSON key value.

### 3. Configure your domain

Edit `src/lib/atproto/settings.ts` and set `SITE` to your production domain:

```ts
export const SITE = dev ? 'http://localhost:5183' : 'https://your-domain.com';
```

### 4. Serve the OAuth client metadata

AT Protocol OAuth requires a client metadata JSON to be publicly accessible at `https://your-domain.com/oauth-client-metadata.json`. This is referenced as the `client_id`.

Create `static/oauth-client-metadata.json` with your domain info, or serve it via a route. The metadata is constructed in `src/lib/atproto/metadata.ts` — the required fields are:

```json
{
  "client_id": "https://your-domain.com/oauth-client-metadata.json",
  "redirect_uris": ["https://your-domain.com/oauth/callback"],
  "scope": "atproto repo:xyz.statusphere.status",
  "jwks_uri": "https://your-domain.com/oauth/jwks.json"
}
```

The scope is auto-generated from the `permissions` config in `src/lib/atproto/settings.ts`.

### 5. Configure permissions

Edit the `permissions` object in `src/lib/atproto/settings.ts` to control what your app can do:

```ts
export const permissions = {
  // collections your app can create/delete/update records in
  collections: ['xyz.statusphere.status'],

  // authenticated proxied RPC requests (e.g. to appview services)
  rpc: {},

  // blob types your app can upload
  blobs: []
} as const;
```

### 6. Deploy

```sh
pnpm build
npx wrangler deploy
```

Or deploy directly:

```sh
npx wrangler deploy
```

### 7. Set up a custom domain (recommended)

In the Cloudflare dashboard, go to your Worker > Settings > Domains & Routes and add your custom domain. This is needed so the OAuth client metadata URL matches your `client_id`.

## Project Structure

```
src/
├── lib/
│   ├── atproto/
│   │   ├── auth.svelte.ts      # Client-side auth state (derived from server data)
│   │   ├── metadata.ts         # OAuth client metadata construction
│   │   ├── methods.ts          # AT Protocol helper methods
│   │   ├── oauth.remote.ts     # Remote functions: login, logout
│   │   ├── repo.remote.ts      # Remote functions: putRecord, deleteRecord, uploadBlob
│   │   └── settings.ts         # Site URL, permissions, constants
│   └── server/
│       ├── oauth.ts            # OAuthClient factory (dev vs prod)
│       └── kv-store.ts         # Cloudflare KV-backed Store implementation
├── routes/
│   ├── oauth/
│   │   ├── callback/           # OAuth callback handler (GET redirect)
│   │   └── jwks.json/          # Public JWKS endpoint
│   ├── +layout.server.ts       # Loads user profile from session
│   ├── +layout.svelte
│   ├── +page.server.ts         # Loads page-specific data
│   └── +page.svelte
└── hooks.server.ts             # Session restoration from cookie
```

## How It Works

- **Authentication**: Server-side OAuth flow via `@atcute/oauth-node-client`. Sessions are stored in Cloudflare KV and identified by a `did` cookie.
- **Remote functions**: Write operations (putRecord, deleteRecord, uploadBlob) and auth actions (login, logout) use SvelteKit remote functions — type-safe server calls without manual API routes.
- **Dev mode**: Uses AT Protocol's loopback client (no keys, in-memory storage).
- **Prod mode**: Uses a confidential client with `private_key_jwt` assertion and KV-backed stores.

## License

MIT
