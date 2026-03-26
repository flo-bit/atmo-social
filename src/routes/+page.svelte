<script lang="ts">
	import { tick, onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { user } from '$lib/atproto/auth.svelte';
	import { blueskyPostToPostData } from '$lib/components';
	import { Post } from '$lib/components';
	import { Loader2 } from '@lucide/svelte';
	import { loadFeed } from '$lib/atproto/server/feed.remote';
	import { prefetchThread, feedCache, prefetchNotifications, setFeedUri, ingestFeedPosts, postMap } from '$lib/cache.svelte';
	import { wireEmbedClicks } from '$lib/components/embed';
	import { isLiked, isBookmarked, getLikeCount, toggleLike, toggleBookmark } from '$lib/actions.svelte';

	const LOGGED_IN_FEED = 'at://did:plc:3guzzweuqraryl3rdkimjamk/app.bsky.feed.generator/for-you';
	const PUBLIC_FEED = 'at://did:plc:w4xbfzo7kqfes5zb7r6qv3rw/app.bsky.feed.generator/blacksky-trend';

	let feedUri = $derived(user.did ? LOGGED_IN_FEED : PUBLIC_FEED);

	$effect(() => { setFeedUri(feedUri); });

	let loading = $derived(!feedCache.loaded);
	let loadingMore = $state(false);

	async function loadInitial() {
		try {
			const result = await loadFeed({ feedUri });
			feedCache.posts = ingestFeedPosts(result.posts);
			for (const item of feedCache.posts) prefetchThread(item.uri);
			feedCache.cursor = result.cursor;
			feedCache.loaded = true;
		} catch (e) {
			console.error('Failed to load feed:', e);
			feedCache.loaded = true;
		}
	}

	onMount(async () => {
		if (feedCache.loaded && feedCache.posts.length > 0) {
			await tick();
			window.scrollTo(0, feedCache.scrollY);
		} else {
			loadInitial();
		}

		// Prefetch notifications after a short delay
		if (user.did) {
			setTimeout(() => prefetchNotifications(), 1000);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			feedCache.scrollY = window.scrollY;
		}
	});

	async function loadMore() {
		if (loadingMore || !feedCache.cursor) return;
		loadingMore = true;
		try {
			const result = await loadFeed({
				feedUri,
				cursor: feedCache.cursor
			});
			const newItems = ingestFeedPosts(result.posts);
			for (const item of newItems) prefetchThread(item.uri);
			feedCache.posts = [...feedCache.posts, ...newItems];
			feedCache.cursor = result.cursor;
		} catch (e) {
			console.error('Failed to load more:', e);
		} finally {
			loadingMore = false;
		}
	}

	function handleScroll() {
		if (loadingMore || !feedCache.cursor) return;
		const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
		if (scrollHeight - scrollTop - clientHeight < 2000) {
			loadMore();
		}
	}

	onMount(() => window.addEventListener('scroll', handleScroll));
	onDestroy(() => {
		if (typeof window !== 'undefined') window.removeEventListener('scroll', handleScroll);
	});
</script>

<div class="flex h-dvh flex-col">
	<div class="mx-auto w-full max-w-lg">
		<!-- Post list -->
		<div>
			{#if loading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="text-base-400 animate-spin" size={28} />
				</div>
			{:else if feedCache.posts.length === 0}
					<div class="flex h-full items-center justify-center">
						<p class="text-base-500 dark:text-base-400">No posts</p>
					</div>
				{:else}
					<div>
						{#each feedCache.posts as feedItem, i (feedItem.uri + '-' + i)}
							{@const post = postMap.get(feedItem.uri)}
							{#if post}
								{@const { postData, embeds } = blueskyPostToPostData(post, 'https://bsky.app', feedItem.reason, feedItem.reply)}
								{@const postHref = (() => {
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									const record = post.record as any;
									const isReply = !!record?.reply?.root;
									if (isReply) {
										const rootUri = record.reply.root.uri as string;
										const [, , rootDid, , rootRkey] = rootUri.split('/');
										const clickedRkey = post.uri.split('/').pop();
										return `/profile/${rootDid}/post/${rootRkey}?highlight=${post.author.handle}/${clickedRkey}`;
									} else {
										const rkey = post.uri.split('/').pop();
										return `/profile/${post.author.handle}/post/${rkey}`;
									}
								})()}
								<div
								class="-mx-2 px-6 pt-3 pb-2 sm:px-2 rounded-xl hover:bg-base-100/50 dark:hover:bg-base-800/30 transition-colors"
							>
									<Post
									compact={true}
										data={postData}
										embeds={wireEmbedClicks(embeds, (handle, rkey) => goto(`/profile/${handle}/post/${rkey}`), (handle) => goto(`/profile/${handle}`))}
										href={postHref}
										onclickhandle={(handle) => goto(`/profile/${handle}`)}
										handleHref={(handle) => `/profile/${handle}`}
										actions={user.did
											? {
													reply: {
														count: postData.replyCount,
														href: postHref + '#replies'
													},
													repost: {
														count: postData.repostCount
													},
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
													reply: {
														count: postData.replyCount,
														href: postHref + '#replies'
													},
													repost: {
														count: postData.repostCount
													},
													like: {
														count: postData.likeCount
													}
												}}
									/>
								</div>
								{#if i < feedCache.posts.length - 1}
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

					{#if !feedCache.cursor && feedCache.posts.length > 0}
						<p class="text-base-400 py-6 text-center text-sm">You've reached the end</p>
					{/if}

					<div class="pb-[max(0.75rem,env(safe-area-inset-bottom))]"></div>
				{/if}
		</div>
	</div>
</div>
