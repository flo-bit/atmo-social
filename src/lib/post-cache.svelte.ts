import { Client, simpleFetchHandler } from '@atcute/client';
import type { ResourceUri } from '@atcute/lexicons';

// Client-side cache for post views keyed by post URI
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, any>();

// Cache for thread data (post + replies) keyed by post URI
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const threadCache = new Map<string, any>();

const publicClient = new Client({
	handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' })
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cachePost(post: any) {
	if (post?.uri) {
		cache.set(post.uri, post);
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCachedPost(uri: string): any | undefined {
	return cache.get(uri);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCachedThread(uri: string): any | undefined {
	return threadCache.get(uri);
}

export function prefetchThread(uri: string) {
	if (threadCache.has(uri)) return;
	// Fire and forget
	publicClient
		.get('app.bsky.feed.getPostThread', {
			params: { uri: uri as ResourceUri, depth: 10, parentHeight: 0 }
		})
		.then((res) => {
			if (res.ok && res.data.thread.$type === 'app.bsky.feed.defs#threadViewPost') {
				threadCache.set(uri, res.data.thread);
			}
		})
		.catch(() => {});
}
