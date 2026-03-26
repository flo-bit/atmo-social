<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { user } from '$lib/atproto/auth.svelte';
	import { blueskyPostToPostData } from '$lib/components';
	import { Post } from '$lib/components';
	import { Search, Loader2 } from '@lucide/svelte';
	import { searchPosts } from '$lib/atproto/server/feed.remote';
	import { prefetchThread, ingestPosts, postMap } from '$lib/cache.svelte';
	import { wireEmbedClicks } from '$lib/components/embed';
	import { isLiked, isBookmarked, getLikeCount, toggleLike, toggleBookmark } from '$lib/actions.svelte';

	let query = $state(page.url.searchParams.get('q') ?? '');
	let inputValue = $state(query);
	let postUris = $state<string[]>([]);
	let cursor = $state<string | null>(null);
	let loading = $state(false);
	let loadingMore = $state(false);
	let searched = $state(false);

	async function doSearch(q: string) {
		if (!q.trim()) return;
		query = q.trim();
		loading = true;
		searched = true;
		postUris = [];
		cursor = null;

		const url = new URL(window.location.href);
		url.searchParams.set('q', query);
		history.replaceState({}, '', url);

		try {
			const result = await searchPosts({ q: query });
			postUris = ingestPosts(result.posts);
			for (const uri of postUris) prefetchThread(uri);
			cursor = result.cursor;
		} catch (e) {
			console.error('Search failed:', e);
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (loadingMore || !cursor || !query) return;
		loadingMore = true;
		try {
			const result = await searchPosts({ q: query, cursor });
			const newUris = ingestPosts(result.posts);
			for (const uri of newUris) prefetchThread(uri);
			postUris = [...postUris, ...newUris];
			cursor = result.cursor;
		} catch (e) {
			console.error('Failed to load more:', e);
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

	function handleSubmit(e: Event) {
		e.preventDefault();
		doSearch(inputValue);
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll);
		if (query) doSearch(query);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') window.removeEventListener('scroll', handleScroll);
	});
</script>

<div class="flex h-dvh flex-col">
	<div class="mx-auto w-full max-w-lg">
		<!-- Search bar -->
		<form onsubmit={handleSubmit} class="px-4 pt-4 pb-3">
			<div class="relative">
				<Search class="text-base-400 absolute top-1/2 left-3 -translate-y-1/2" size={16} />
				<input
					type="text"
					bind:value={inputValue}
					placeholder="Search posts..."
					class="border-base-200 bg-base-50 text-base-900 placeholder:text-base-400 focus:border-accent-400 focus:ring-accent-400 dark:border-base-700 dark:bg-base-900 dark:text-base-100 dark:placeholder:text-base-500 w-full rounded-full border py-2 pr-4 pl-9 text-sm focus:ring-1 focus:outline-none"
				/>
			</div>
		</form>

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="text-base-400 animate-spin" size={28} />
			</div>
		{:else if searched && postUris.length === 0}
			<div class="flex flex-col items-center justify-center py-20">
				<Search class="text-base-300 dark:text-base-600 mb-3" size={40} />
				<p class="text-base-400 text-sm">No results for "{query}"</p>
			</div>
		{:else if postUris.length > 0}
			<div>
				{#each postUris as uri, i (uri + '-' + i)}
					{@const post = postMap.get(uri)}
					{#if post}
						{@const { postData, embeds } = blueskyPostToPostData(post)}
						{@const rkey = post.uri.split('/').pop()}
						{@const postHref = `/profile/${post.author.handle}/post/${rkey}`}
						<div class="-mx-2 rounded-xl px-6 pt-3 pb-2 transition-colors hover:bg-base-100/50 sm:px-2 dark:hover:bg-base-800/30">
							<Post
								compact={true}
								data={postData}
								embeds={wireEmbedClicks(embeds, (handle, rk) => goto(`/profile/${handle}/post/${rk}`), (handle) => goto(`/profile/${handle}`))}
								href={postHref}
								onclickhandle={(handle) => goto(`/profile/${handle}`)}
								handleHref={(handle) => `/profile/${handle}`}
								actions={user.did
									? {
											reply: { count: postData.replyCount, href: postHref + '#replies' },
											repost: { count: postData.repostCount },
											like: {
												count: getLikeCount(post.uri),
												active: isLiked(post.uri),
												onclick: () => toggleLike(post.uri, post.cid)
											},
											bookmark: {
												active: isBookmarked(post.uri),
												onclick: () => toggleBookmark(post.uri, post.cid)
											}
										}
									: {
											reply: { count: postData.replyCount, href: postHref + '#replies' },
											repost: { count: postData.repostCount },
											like: { count: postData.likeCount }
										}}
							/>
						</div>
						{#if i < postUris.length - 1}
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

			{#if !cursor && postUris.length > 0}
				<p class="text-base-400 py-6 text-center text-sm">No more results</p>
			{/if}

			<div class="pb-[max(0.75rem,env(safe-area-inset-bottom))]"></div>
		{:else if !searched}
			<div class="flex flex-col items-center justify-center py-20">
				<Search class="text-base-300 dark:text-base-600 mb-3" size={40} />
				<p class="text-base-400 text-sm">Search for posts on Bluesky</p>
			</div>
		{/if}
	</div>
</div>
