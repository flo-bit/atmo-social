<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/atproto/auth.svelte';
	import { blueskyPostToPostData } from '$lib/components';
	import { Post } from '$lib/components';
	import { ArrowLeft, Loader2 } from '@lucide/svelte';
	import { likePost, unlikePost, getBookmarks } from '$lib/atproto/server/feed.remote';
	import { cachePosts, prefetchThread } from '$lib/cache.svelte';
	import { wireEmbedClicks } from '$lib/components/embed';
	import { bookmarks } from '$lib/bookmarks.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let posts = $state<any[]>([]);
	let cursor = $state<string | null>(null);
	let loading = $state(true);
	let loadingMore = $state(false);

	let likeState = $state<Record<string, string | null>>({});
	let likeCountDelta = $state<Record<string, number>>({});

	function isLiked(postUri: string, viewerLike?: string): boolean {
		if (postUri in likeState) return likeState[postUri] !== null;
		return !!viewerLike;
	}

	function getLikeCount(postUri: string, originalCount: number): number {
		return originalCount + (likeCountDelta[postUri] ?? 0);
	}

	async function handleLike(postUri: string, postCid: string, viewerLike?: string) {
		const currentlyLiked = isLiked(postUri, viewerLike);
		if (currentlyLiked) {
			const likeUri = likeState[postUri] ?? viewerLike;
			if (!likeUri) return;
			likeState[postUri] = null;
			likeCountDelta[postUri] = (likeCountDelta[postUri] ?? 0) - 1;
			try {
				await unlikePost({ likeUri });
			} catch {
				likeState[postUri] = likeUri;
				likeCountDelta[postUri] = (likeCountDelta[postUri] ?? 0) + 1;
			}
		} else {
			likeState[postUri] = 'pending';
			likeCountDelta[postUri] = (likeCountDelta[postUri] ?? 0) + 1;
			try {
				const result = await likePost({ uri: postUri, cid: postCid });
				likeState[postUri] = result.uri;
			} catch {
				likeState[postUri] = null;
				likeCountDelta[postUri] = (likeCountDelta[postUri] ?? 0) - 1;
			}
		}
	}

	onMount(async () => {
		if (!user.did) {
			goto('/');
			return;
		}
		try {
			const result = await getBookmarks({});
			posts = JSON.parse(JSON.stringify(result.posts));
			cachePosts(posts);
			for (const p of posts) {
				const post = p.post ?? p;
				if (post?.uri) prefetchThread(post.uri);
			}
			cursor = result.cursor;
		} catch (e) {
			console.error('Failed to load bookmarks:', e);
		} finally {
			loading = false;
		}
	});

	async function loadMore() {
		if (loadingMore || !cursor) return;
		loadingMore = true;
		try {
			const result = await getBookmarks({ cursor });
			const newPosts = JSON.parse(JSON.stringify(result.posts));
			cachePosts(newPosts);
			for (const p of newPosts) {
				const post = p.post ?? p;
				if (post?.uri) prefetchThread(post.uri);
			}
			posts = [...posts, ...newPosts];
			cursor = result.cursor;
		} catch (e) {
			console.error('Failed to load more bookmarks:', e);
		} finally {
			loadingMore = false;
		}
	}

	function handleScroll() {
		if (loadingMore || !cursor) return;
		const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
		if (scrollHeight - scrollTop - clientHeight < 2000) {
			loadMore();
		}
	}

	onMount(() => window.addEventListener('scroll', handleScroll));
	onDestroy(() => {
		if (typeof window !== 'undefined') window.removeEventListener('scroll', handleScroll);
	});

	// Posts are already normalized to PostView by the server command
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function getPostView(item: any) {
		return item;
	}
</script>

<div class="flex h-dvh flex-col">
	<div class="mx-auto w-full max-w-lg py-4">
		<div class="mb-2 ml-4 flex items-center gap-2 sm:ml-0">
			<button
				onclick={() => history.back()}
				class="text-base-500 hover:text-base-700 dark:text-base-400 dark:hover:text-base-200 rounded-lg p-1.5 transition-colors"
			>
				<ArrowLeft size={20} />
			</button>
			<h1 class="text-base-900 dark:text-base-100 text-lg font-semibold">Bookmarks</h1>
		</div>

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="text-base-400 animate-spin" size={28} />
			</div>
		{:else if posts.length === 0}
			<div class="flex items-center justify-center py-12">
				<p class="text-base-400 text-sm">No bookmarks yet</p>
			</div>
		{:else}
			<div>
				{#each posts as item, i (getPostView(item)?.uri ? `${getPostView(item).uri}-${i}` : i)}
					{@const postView = getPostView(item)}
					{#if postView?.uri && postView?.author}
						{@const { postData, embeds } = blueskyPostToPostData(postView, 'https://bsky.app')}
						{@const postHref = `/profile/${postView.author.handle}/post/${postView.uri.split('/').pop()}`}
						<div class="-mx-2 px-6 pt-3 pb-2 sm:px-2 rounded-xl hover:bg-base-100/50 dark:hover:bg-base-800/30 transition-colors">
							<Post
								compact={true}
								data={postData}
								embeds={wireEmbedClicks(embeds, (handle, rkey) => goto(`/profile/${handle}/post/${rkey}`), (handle) => goto(`/profile/${handle}`))}
								href={postHref}
								onclickhandle={(handle) => goto(`/profile/${handle}`)}
								handleHref={(handle) => `/profile/${handle}`}
								actions={user.did
									? {
											reply: { count: postData.replyCount },
											repost: { count: postData.repostCount },
											like: {
												count: getLikeCount(postView.uri, postData.likeCount ?? 0),
												active: isLiked(postView.uri, postView.viewer?.like),
												onclick: () => handleLike(postView.uri, postView.cid, postView.viewer?.like)
											},
											bookmark: {
												active: bookmarks.isBookmarked(postView.uri, postView.viewer?.bookmarked),
												onclick: () => bookmarks.toggle(postView.uri, postView.cid, postView.viewer?.bookmarked)
											}
										}
									: {
											reply: { count: postData.replyCount },
											repost: { count: postData.repostCount },
											like: { count: postData.likeCount }
										}}
							/>
						</div>
						{#if i < posts.length - 1}
							<hr class="border-base-200 dark:border-base-800 mx-4 sm:mx-0" />
						{/if}
					{/if}
				{/each}
			</div>

			{#if loadingMore}
				<div class="flex justify-center py-6">
					<Loader2 class="text-base-400 animate-spin" size={24} />
				</div>
			{/if}

			{#if !cursor && posts.length > 0}
				<p class="text-base-400 py-6 text-center text-sm">You've reached the end</p>
			{/if}
		{/if}

		<div class="pb-[max(0.75rem,env(safe-area-inset-bottom))]"></div>
	</div>
</div>
