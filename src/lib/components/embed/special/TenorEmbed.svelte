<script lang="ts">
	import type { EmbedExternalData } from '../types';

	const { data }: { data: EmbedExternalData } = $props();

	// The href IS the media.tenor.com GIF/video URL
	const src = $derived(data.external.href);
	const isVideo = $derived(/\.mp4(\?|$)/.test(src));
</script>

{#if src}
	<div class="max-w-full">
		{#if isVideo}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				{src}
				autoplay
				loop
				muted
				playsinline
				class="max-h-96 max-w-full rounded-2xl"
			></video>
		{:else}
			<img
				{src}
				alt={data.external.title}
				loading="lazy"
				class="max-h-96 max-w-full rounded-2xl"
			/>
		{/if}
	</div>
{/if}
