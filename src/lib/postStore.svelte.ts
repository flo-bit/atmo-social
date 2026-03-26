import { SvelteMap } from 'svelte/reactivity';
import { postStore as dexiePostStore } from '$lib/db.svelte';

// The single source of truth for all post data in memory
const _posts = new SvelteMap<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any

export const postMap = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	get(uri: string): any | undefined {
		return _posts.get(uri);
	},

	has(uri: string): boolean {
		return _posts.has(uri);
	},

	// Upsert a single post
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	upsert(uri: string, post: any) {
		_posts.set(uri, post);
		dexiePostStore.set(uri, post).catch(() => {});
	},

	// Bulk upsert from feed/search/bookmark API responses
	// Accepts FeedViewPost[] (with .post) or PostView[] (direct)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	upsertMany(items: any[]) {
		for (const item of items) {
			const post = item.post ?? item;
			if (post?.uri) {
				_posts.set(post.uri, post);
				dexiePostStore.set(post.uri, post).catch(() => {});
			}
		}
	},

	// Update viewer state (like, bookmark) on a post
	updateViewer(uri: string, patch: Record<string, unknown>) {
		const existing = _posts.get(uri);
		if (existing) {
			_posts.set(uri, { ...existing, viewer: { ...existing.viewer, ...patch } });
			dexiePostStore.set(uri, _posts.get(uri)).catch(() => {});
		}
	},

	// Update engagement counts
	updateCounts(uri: string, patch: Record<string, number>) {
		const existing = _posts.get(uri);
		if (existing) {
			_posts.set(uri, { ...existing, ...patch });
		}
	},

	// Hydrate from Dexie (don't overwrite already-loaded posts)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	hydrateMany(entries: [string, any][]) {
		for (const [uri, post] of entries) {
			if (!_posts.has(uri)) _posts.set(uri, post);
		}
	}
};
