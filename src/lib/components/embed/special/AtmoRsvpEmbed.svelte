<script lang="ts">
	import type { EmbedExternalData } from '../types';
	import EventEmbed from '../EventEmbed.svelte';

	const { data }: { data: EmbedExternalData } = $props();

	// Normalize URL: strip trailing slash
	const url = data.external.href.replace(/\/$/, '');
</script>

<EventEmbed {url} />
