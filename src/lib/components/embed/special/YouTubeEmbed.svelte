<script lang="ts">
	import type { EmbedExternalData } from '../types';

	const { data }: { data: EmbedExternalData } = $props();

	const videoId = $derived.by(() => {
		const href = data.external.href;
		const url = new URL(href);
		if (url.hostname === 'youtu.be') {
			return url.pathname.slice(1);
		}
		if (url.pathname.startsWith('/shorts/')) {
			return url.pathname.split('/')[2];
		}
		return url.searchParams.get('v') ?? '';
	});
</script>

{#if videoId}
	<div class="w-full overflow-hidden rounded-2xl border border-base-300 dark:border-base-600/30">
		<iframe
			src="https://www.youtube-nocookie.com/embed/{videoId}"
			title={data.external.title}
			class="aspect-video w-full"
			frameborder="0"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen
		></iframe>
	</div>
{/if}
