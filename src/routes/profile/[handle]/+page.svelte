<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { UserProfile, Post } from '$lib/components';
	import { blueskyPostToPostData } from '$lib/components';
	import { Button } from '@foxui/core';
	import { Loader2, LogOut } from '@lucide/svelte';
	import { user, logout } from '$lib/atproto/auth.svelte';
	import { actorToDid, getDetailedProfile } from '$lib/atproto/methods';
	import { getCachedProfile, cacheProfile, prefetchThread, ingestFeedPosts, postMap } from '$lib/cache.svelte';
	import { getAuthorFeed, followUser, unfollowUser } from '$lib/atproto/server/feed.remote';
	import { wireEmbedClicks } from '$lib/components/embed';
	import { isLiked, isBookmarked, getLikeCount, toggleLike, toggleBookmark } from '$lib/actions.svelte';
	import { Client, simpleFetchHandler } from '@atcute/client';
	import type { FeedItem } from '$lib/cache.svelte';

	import { UserPlus, UserCheck } from '@lucide/svelte';

	let isOwnProfile = $derived(user.did && profile?.did === user.did);
	let followUri = $state<string | null>(null);
	let isFollowing = $derived(followUri !== null);
	let followLoading = $state(false);

	let loading = $state(true);
	let error = $state<string | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let profile = $state<any>(null);

	// Posts state
	let feedItems = $state<FeedItem[]>([]);
	let postsCursor = $state<string | null>(null);
	let postsLoading = $state(true);
	let loadingMore = $state(false);

	async function toggleFollow() {
		if (!profile?.did || followLoading) return;
		followLoading = true;
		try {
			if (isFollowing) {
				await unfollowUser({ followUri: followUri! });
				followUri = null;
			} else {
				const result = await followUser({ did: profile.did });
				followUri = result.uri;
			}
		} catch (e) {
			console.error('Failed to toggle follow:', e);
		} finally {
			followLoading = false;
		}
	}

	function numberToHuman(n: number): string {
		if (n < 1000) return String(n);
		if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
		return `${(n / 1_000_000).toFixed(1)}m`;
	}

	async function loadProfile(actor: string) {
		loading = true;
		error = null;
		profile = null;
		feedItems = [];
		postsCursor = null;
		postsLoading = true;
		followUri = null;

		// Show cached profile instantly
		const cached = await getCachedProfile(actor);
		if (cached) {
			profile = cached;
			loading = false;
		}

		// Always fetch full profile
		try {
			const did = await actorToDid(actor);
			const client = new Client({
				handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' })
			});
			const fresh = await getDetailedProfile({ did, client });
			if (fresh) {
				profile = fresh;
				cacheProfile(fresh);
				followUri = fresh.viewer?.following ?? null;
			} else if (!cached) {
				error = 'Profile not found';
			}
		} catch (e) {
			console.error('Failed to load profile:', e);
			if (!cached) error = 'Failed to load profile';
		} finally {
			loading = false;
		}

		// Load author posts
		try {
			const result = await getAuthorFeed({ actor });
			feedItems = ingestFeedPosts(result.posts);
			for (const item of feedItems) prefetchThread(item.uri);
			postsCursor = result.cursor;
		} catch (e) {
			console.error('Failed to load author feed:', e);
		} finally {
			postsLoading = false;
		}
	}

	$effect(() => {
		const actor = page.params.handle;
		if (actor) untrack(() => loadProfile(actor));
	});

	async function loadMore() {
		if (loadingMore || !postsCursor) return;
		loadingMore = true;
		try {
			const result = await getAuthorFeed({
				actor: page.params.handle,
				cursor: postsCursor
			});
			const newItems = ingestFeedPosts(result.posts);
			for (const item of newItems) prefetchThread(item.uri);
			feedItems = [...feedItems, ...newItems];
			postsCursor = result.cursor;
		} catch (e) {
			console.error('Failed to load more:', e);
		} finally {
			loadingMore = false;
		}
	}

	function handleScroll() {
		if (loadingMore || !postsCursor) return;
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
	<div class="mx-auto w-full max-w-xl flex-1">
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="text-base-400 animate-spin" size={28} />
			</div>
		{:else if error}
			<div class="flex items-center justify-center px-4 py-12">
				<p class="text-sm text-red-500">{error}</p>
			</div>
		{:else if profile}
			<UserProfile
				profile={{
					banner: profile.banner,
					avatar: profile.avatar,
					displayName: profile.displayName,
					handle: profile.handle,
					description: profile.description
				}}
				class=""
			>
				<div class="flex items-center justify-between">
					<div class="flex gap-4 text-sm">
						<button onclick={() => {}} class="hover:underline">
							<span class="text-base-900 dark:text-base-100 font-semibold">{numberToHuman(profile.followsCount ?? 0)}</span>
							<span class="text-base-500 dark:text-base-400"> following</span>
						</button>
						<button onclick={() => {}} class="hover:underline">
							<span class="text-base-900 dark:text-base-100 font-semibold">{numberToHuman(profile.followersCount ?? 0)}</span>
							<span class="text-base-500 dark:text-base-400"> followers</span>
						</button>
					</div>
					{#if isOwnProfile}
						<Button variant="ghost" onclick={logout} class="gap-2" size="sm">
							<LogOut size={14} />
							Log out
						</Button>
					{:else if user.did}
						<Button
							variant={isFollowing ? 'outline' : 'default'}
							size="sm"
							onclick={toggleFollow}
							disabled={followLoading}
							class="gap-1.5"
						>
							{#if isFollowing}
								<UserCheck size={14} />
								Following
							{:else}
								<UserPlus size={14} />
								Follow
							{/if}
						</Button>
					{/if}
				</div>
			</UserProfile>

			<!-- Author posts -->
			{#if postsLoading}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="text-base-400 animate-spin" size={24} />
				</div>
			{:else if feedItems.length > 0}
				<div>
					{#each feedItems as feedItem, i (feedItem.uri + '-' + i)}
						{@const post = postMap.get(feedItem.uri)}
						{#if post}
							{@const { postData, embeds } = blueskyPostToPostData(post, 'https://bsky.app', feedItem.reason)}
							{@const postHref = `/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`}
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
												reply: { count: postData.replyCount },
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
												reply: { count: postData.replyCount },
												repost: { count: postData.repostCount },
												like: { count: postData.likeCount }
											}}
								/>
							</div>
							{#if i < feedItems.length - 1}
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

				{#if !postsCursor && feedItems.length > 0}
					<p class="text-base-400 py-6 text-center text-sm">You've reached the end</p>
				{/if}
			{:else}
				<p class="text-base-400 py-8 text-center text-sm">No posts yet</p>
			{/if}

			<div class="pb-[max(0.75rem,env(safe-area-inset-bottom))]"></div>
		{/if}
	</div>
</div>
