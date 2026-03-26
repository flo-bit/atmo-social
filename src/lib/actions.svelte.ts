import { postMap } from '$lib/postStore.svelte';
import { likePost, unlikePost, createBookmark, deleteBookmark } from '$lib/atproto/server/feed.remote';

export function isLiked(uri: string): boolean {
	return !!postMap.get(uri)?.viewer?.like;
}

export function isBookmarked(uri: string): boolean {
	return !!postMap.get(uri)?.viewer?.bookmarked;
}

export function getLikeCount(uri: string): number {
	return postMap.get(uri)?.likeCount ?? 0;
}

export async function toggleLike(uri: string, cid: string) {
	const post = postMap.get(uri);
	if (!post) return;

	const currentlyLiked = !!post.viewer?.like;
	const currentLikeUri = post.viewer?.like;
	const currentCount = post.likeCount ?? 0;

	if (currentlyLiked) {
		// Optimistic unlike
		postMap.updateViewer(uri, { like: undefined });
		postMap.updateCounts(uri, { likeCount: currentCount - 1 });
		try {
			await unlikePost({ likeUri: currentLikeUri });
		} catch {
			// Revert
			postMap.updateViewer(uri, { like: currentLikeUri });
			postMap.updateCounts(uri, { likeCount: currentCount });
		}
	} else {
		// Optimistic like
		postMap.updateViewer(uri, { like: 'pending' });
		postMap.updateCounts(uri, { likeCount: currentCount + 1 });
		try {
			const result = await likePost({ uri, cid });
			postMap.updateViewer(uri, { like: result.uri });
		} catch {
			// Revert
			postMap.updateViewer(uri, { like: undefined });
			postMap.updateCounts(uri, { likeCount: currentCount });
		}
	}
}

export async function toggleBookmark(uri: string, cid: string) {
	const post = postMap.get(uri);
	if (!post) return;

	const currentlyBookmarked = !!post.viewer?.bookmarked;

	// Optimistic update
	postMap.updateViewer(uri, { bookmarked: !currentlyBookmarked });
	try {
		if (currentlyBookmarked) {
			await deleteBookmark({ uri });
		} else {
			await createBookmark({ uri, cid });
		}
	} catch {
		// Revert
		postMap.updateViewer(uri, { bookmarked: currentlyBookmarked });
	}
}
