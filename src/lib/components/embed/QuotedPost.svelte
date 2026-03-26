<script lang="ts">
	import type { EmbedRecordData } from './types';
	import type { PostData } from '../post';
	import Post from '../post/Post.svelte';

	const {
		record,
		showEmbed = true
	}: {
		record: EmbedRecordData;
		showEmbed?: boolean;
	} = $props();

	const postData: PostData = $derived({
		author: record.author,
		href: record.href,
		htmlContent: record.htmlContent,
		createdAt: record.createdAt ?? ''
	});

	const embeds = $derived(
		showEmbed && record.embed ? [record.embed] : []
	);
</script>

<div
	class="border-base-300 dark:border-base-600/30 accent:border-accent-300/20 accent:bg-accent-100/10 bg-base-500/10 dark:bg-black/30 hover:bg-base-500/15 dark:hover:bg-black/40 relative w-full overflow-hidden rounded-2xl border p-3 text-left text-sm transition-colors"
>
	{#if record.onclick}
		<button
			class="absolute inset-0 z-0 cursor-pointer"
			onclick={() => record.onclick!(record, record.href)}
		></button>
	{/if}
	<div class="relative z-[1]">
		<Post
			data={postData}
			compact
			showAvatar={false}
			{embeds}
			onclickhandle={record.onclickhandle}
			handleHref={record.handleHref}
		/>
	</div>
</div>
