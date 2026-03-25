<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { UserProfile } from '@foxui/social';
	import { Loader2 } from '@lucide/svelte';
	import { actorToDid, getDetailedProfile } from '$lib/atproto/methods';
	import { Client, simpleFetchHandler } from '@atcute/client';

	let loading = $state(true);
	let error = $state<string | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let profile = $state<any>(null);

	onMount(async () => {
		try {
			const actor = page.params.actor;
			const did = await actorToDid(actor);
			const client = new Client({
				handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' })
			});
			profile = await getDetailedProfile({ did, client });
			if (!profile) error = 'Profile not found';
		} catch (e) {
			console.error('Failed to load profile:', e);
			error = 'Failed to load profile';
		} finally {
			loading = false;
		}
	});
</script>

<div class="flex h-dvh flex-col">
	<div class="mx-auto w-full max-w-xl flex-1 overflow-y-auto">
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
		{/if}
	</div>
</div>
