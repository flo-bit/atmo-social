# atmo.social Embed SDK

Build interactive embeds for your atproto app that render natively inside atmo.social.

## How it works

When a user posts a link to your app on Bluesky (e.g. `https://yourapp.com/p/actor/item/abc`), atmo.social renders it as an iframe embed instead of a generic link card. Your embed page receives the host app's theme and the logged-in user's DID, and can create/delete AT Protocol records on their behalf.

## Setup

### 1. Register your app

Your app needs to be added to the embed registry in atmo.social. Contact us or submit a PR adding your app to `src/lib/components/embed/special/embed-registry.ts`:

```ts
{
  domain: 'yourapp.com',
  match: (href) => /^https?:\/\/(www\.)?yourapp\.com\/p\//.test(href),
  embedUrl: (href) => {
    const url = new URL(href);
    url.pathname = url.pathname.replace(/\/$/, '') + '/embed';
    url.search = '';
    return url.toString();
  },
  allowedCollections: ['your.lexicon.collection'],
  aspectRatio: { width: 2, height: 1 }
}
```

- **`domain`**: Your domain, used to validate `postMessage` origins
- **`match`**: Function that returns `true` for URLs that should be embedded
- **`embedUrl`**: Transforms the original URL into your embed endpoint URL
- **`allowedCollections`**: AT Protocol collections your embed can write to (scoped permissions)
- **`aspectRatio`**: Aspect ratio (`width`/`height`) — embed fills full width and maintains this ratio

### 2. Create your embed page

For a URL like `https://yourapp.com/p/actor/item/abc`, serve an embed page at `https://yourapp.com/p/actor/item/abc/embed`.

Include the SDK:

```html
<script src="https://atmo.social/embed-sdk.js"></script>
```

### 3. Read parameters

The host app passes theme and auth info as URL search params:

```js
const { base, accent, dark, did } = AtmoEmbed.getParams();
```

| Param | Type | Description |
|-------|------|-------------|
| `base` | `string` | Base color name (e.g. `mauve`, `slate`, `zinc`) |
| `accent` | `string` | Accent color name (e.g. `fuchsia`, `blue`, `rose`) |
| `dark` | `boolean` | Whether dark mode is active |
| `did` | `string \| null` | The logged-in user's DID, or `null` if not logged in |

Use these to match your embed's theme to the host app. If you use [@foxui/core](https://flo-bit.dev/ui-kit) or Tailwind with the same color system, just add the `base`, `accent`, and optionally `dark` classes to your `<html>` element.

### 4. Create records

Create an AT Protocol record on behalf of the logged-in user:

```js
const result = await AtmoEmbed.createRecord({
  collection: 'your.lexicon.collection',
  rkey: 'optional-record-key', // omitted = auto-generated
  record: {
    $type: 'your.lexicon.collection',
    // ... your record fields
    createdAt: new Date().toISOString()
  }
});

console.log(result.uri); // at://did:plc:.../your.lexicon.collection/...
```

### 5. Delete records

```js
await AtmoEmbed.deleteRecord({
  collection: 'your.lexicon.collection',
  rkey: 'record-key-to-delete'
});
```

## Security

- Your embed runs in a sandboxed iframe (`allow-scripts allow-same-origin`)
- `postMessage` origins are validated against your registered domain
- Record operations are scoped to your `allowedCollections` — attempts to write to other collections are rejected
- The user's auth session is never exposed to the iframe — all writes go through the host app's server

## Example

Here's a minimal embed page for an RSVP button:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://atmo.social/embed-sdk.js"></script>
  <style>
    body { margin: 0; font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; }
    button { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; }
  </style>
</head>
<body>
  <button id="rsvp">RSVP Going</button>
  <script>
    const { base, accent, dark, did } = AtmoEmbed.getParams();

    // Apply theme
    if (dark) document.documentElement.classList.add('dark');

    document.getElementById('rsvp').onclick = async () => {
      if (!did) return alert('Please log in to RSVP');

      try {
        const result = await AtmoEmbed.createRecord({
          collection: 'community.lexicon.calendar.rsvp',
          record: {
            $type: 'community.lexicon.calendar.rsvp',
            status: 'community.lexicon.calendar.rsvp#going',
            subject: {
              uri: 'at://did:plc:.../community.lexicon.calendar.event/...',
              cid: '...'
            },
            createdAt: new Date().toISOString()
          }
        });
        document.getElementById('rsvp').textContent = 'RSVPd!';
      } catch (e) {
        console.error('RSVP failed:', e);
      }
    };
  </script>
</body>
</html>
```

## Full URL example

Original link posted on Bluesky:
```
https://atmo.rsvp/p/did:plc:lysqukqdu6hsrhet5v2brjgo/e/3mhqxpdvmw25h
```

Embed URL loaded in iframe:
```
https://atmo.rsvp/embed/p/did:plc:lysqukqdu6hsrhet5v2brjgo/e/3mhqxpdvmw25h?base=mauve&accent=fuchsia&dark=1&did=did:plc:abc123
```
