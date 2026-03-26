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
	import { getCachedProfile, cacheProfile, cachePosts, prefetchThread } from '$lib/cache.svelte';
	import { getAuthorFeed, likePost, unlikePost } from '$lib/atproto/server/feed.remote';
	import { wireEmbedClicks } from '$lib/components/embed';
	import { Client, simpleFetchHandler } from '@atcute/client';

	let isOwnProfile = $derived(user.did && profile?.did === user.did);

	let loading = $state(true);
	let error = $state<string | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let profile = $state<any>(null);

	// Posts state
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let posts = $state<any[]>([]);
	let postsCursor = $state<string | null>(null);
	let postsLoading = $state(true);
	let loadingMore = $state(false);

	// Like state
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

	async function loadProfile(actor: string) {
		loading = true;
		error = null;
		profile = null;
		posts = [];
		postsCursor = null;
		postsLoading = true;
		likeState = {};
		likeCountDelta = {};

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
			posts = JSON.parse(JSON.stringify(result.posts));
			cachePosts(posts);
			for (const fp of posts) {
				if (fp.post) prefetchThread(fp.post.uri);
			}
			postsCursor = result.cursor;
		} catch (e) {
			console.error('Failed to load author feed:', e);
		} finally {
			postsLoading = false;
		}
	}

	$effect(() => {
		const actor = page.params.actor;
		if (actor) untrack(() => loadProfile(actor));
	});

	async function loadMore() {
		if (loadingMore || !postsCursor) return;
		loadingMore = true;
		try {
			const result = await getAuthorFeed({
				actor: page.params.actor,
				cursor: postsCursor
			});
			const newPosts = JSON.parse(JSON.stringify(result.posts));
			cachePosts(newPosts);
			for (const fp of newPosts) {
				if (fp.post) prefetchThread(fp.post.uri);
			}
			posts = [...posts, ...newPosts];
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
			/>
			{#if isOwnProfile}
				<div class="px-4 py-4">
					<Button variant="ghost" onclick={logout} class="gap-2">
						<LogOut size={16} />
						Log out
					</Button>
				</div>
			{/if}

			<!-- Author posts -->
			{#if postsLoading}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="text-base-400 animate-spin" size={24} />
				</div>
			{:else if posts.length > 0}
				<div>
					{#each posts as feedPost, i (feedPost.post?.uri ? `${feedPost.post.uri}-${i}` : i)}
						{#if feedPost.post}
							{@const { postData, embeds } = blueskyPostToPostData(feedPost.post, 'https://bsky.app', feedPost.reason)}
							{@const postHref = (() => {
								const rkey = feedPost.post.uri.split('/').pop();
								return `/p/${feedPost.post.author.handle}/post/${rkey}`;
							})()}
							<div
								class="-mx-2 px-6 pt-3 pb-2 sm:px-2 rounded-xl hover:bg-base-100/50 dark:hover:bg-base-800/30 transition-colors"
							>
								<Post
									compact={true}
									data={postData}
									embeds={wireEmbedClicks(embeds, (handle, rkey) => goto(`/p/${handle}/post/${rkey}`), (handle) => goto(`/p/${handle}`))}
									href={postHref}
									onclickhandle={(handle) => goto(`/p/${handle}`)}
									handleHref={(handle) => `/p/${handle}`}
									actions={user.did
										? {
												reply: { count: postData.replyCount },
												repost: { count: postData.repostCount },
												like: {
													count: getLikeCount(feedPost.post.uri, postData.likeCount ?? 0),
													active: isLiked(feedPost.post.uri, feedPost.post.viewer?.like),
													onclick: () => handleLike(feedPost.post.uri, feedPost.post.cid, feedPost.post.viewer?.like)
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

				{#if !postsCursor && posts.length > 0}
					<p class="text-base-400 py-6 text-center text-sm">You've reached the end</p>
				{/if}
			{:else}
				<p class="text-base-400 py-8 text-center text-sm">No posts yet</p>
			{/if}

			<div class="pb-[max(0.75rem,env(safe-area-inset-bottom))]"></div>
		{/if}
	</div>
</div>
