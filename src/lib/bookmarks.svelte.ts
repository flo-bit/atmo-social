import { createBookmark, deleteBookmark } from '$lib/atproto/server/feed.remote';

// Track bookmark state: postUri -> bookmarked
let _bookmarkState = $state<Record<string, boolean>>({});

export const bookmarks = {
	isBookmarked(postUri: string, viewerBookmark?: boolean): boolean {
		if (postUri in _bookmarkState) return _bookmarkState[postUri];
		return !!viewerBookmark;
	},

	async toggle(postUri: string, postCid: string, viewerBookmark?: boolean) {
		const currentlyBookmarked = this.isBookmarked(postUri, viewerBookmark);
		// Optimistic update
		_bookmarkState[postUri] = !currentlyBookmarked;
		try {
			if (currentlyBookmarked) {
				await deleteBookmark({ uri: postUri });
			} else {
				await createBookmark({ uri: postUri, cid: postCid });
			}
		} catch {
			// Revert on failure
			_bookmarkState[postUri] = currentlyBookmarked;
		}
	}
};
