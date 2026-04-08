<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { Play } from '@lucide/svelte';
	import { user } from '$lib/atproto/auth.svelte';
	import { putRecord, deleteRecord } from '$lib/atproto/server/repo.remote';
	import type { EmbedAppConfig } from './embed-registry';

	const { config, url, thumbnail }: { config: EmbedAppConfig; url: string; thumbnail?: string } = $props();

	let iframeEl: HTMLIFrameElement | undefined = $state(undefined);
	let activated = $state(!config.requireClick);

	// Build embed URL with theme + auth params
	function buildEmbedUrl(): string {
		const embedUrl = new URL(config.embedUrl(url));

		const html = document.documentElement;
		const classes = Array.from(html.classList);

		const baseColors = ['gray', 'stone', 'zinc', 'neutral', 'slate', 'olive', 'mauve', 'mist', 'taupe'];
		const base = classes.find((c) => baseColors.includes(c)) ?? 'mauve';

		const accentColors = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
		const accent = classes.find((c) => accentColors.includes(c)) ?? 'fuchsia';

		const dark = html.classList.contains('dark');

		embedUrl.searchParams.set('base', base);
		embedUrl.searchParams.set('accent', accent);
		embedUrl.searchParams.set('dark', dark ? '1' : '0');

		if (user.did) {
			embedUrl.searchParams.set('did', user.did);
		}

		return embedUrl.toString();
	}

	let embedSrc = $derived.by(() => {
		if (!browser || !activated) return '';
		return buildEmbedUrl();
	});

	// Handle postMessage from the iframe
	async function handleMessage(event: MessageEvent) {
		try {
			const origin = new URL(event.origin);
			if (!origin.hostname.endsWith(config.domain) && origin.hostname !== config.domain) {
				return;
			}
		} catch {
			return;
		}

		const { type, id, ...payload } = event.data ?? {};
		if (!type || !id) return;

		try {
			let result: unknown;

			if (type === 'createRecord') {
				if (!config.allowedCollections.includes(payload.collection)) {
					sendResponse(id, null, `Collection '${payload.collection}' is not allowed for this embed`);
					return;
				}
				result = await putRecord({
					collection: payload.collection,
					rkey: payload.rkey,
					record: payload.record
				});
			} else if (type === 'deleteRecord') {
				if (!config.allowedCollections.includes(payload.collection)) {
					sendResponse(id, null, `Collection '${payload.collection}' is not allowed for this embed`);
					return;
				}
				result = await deleteRecord({
					collection: payload.collection,
					rkey: payload.rkey
				});
			} else {
				return;
			}

			sendResponse(id, result, null);
		} catch (e) {
			sendResponse(id, null, String(e));
		}
	}

	function sendResponse(id: string, result: unknown, error: string | null) {
		iframeEl?.contentWindow?.postMessage(
			{ type: 'response', id, result, error },
			new URL(config.embedUrl(url)).origin
		);
	}

	onMount(() => {
		window.addEventListener('message', handleMessage);
	});

	onDestroy(() => {
		window.removeEventListener('message', handleMessage);
	});
</script>

<div
	class="border-base-300 dark:border-base-600/30 relative w-full overflow-hidden rounded-2xl border"
	style="aspect-ratio: {config.aspectRatio.width} / {config.aspectRatio.height}"
>
	{#if activated}
		<iframe
			bind:this={iframeEl}
			src={embedSrc}
			title="Embedded content from {config.domain}"
			class="h-full w-full border-0"
			sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
			loading="lazy"
		></iframe>
	{:else}
		<button
			class="bg-base-200 dark:bg-base-800 relative flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden transition-colors hover:brightness-110"
			onclick={() => { activated = true; }}
		>
			{#if thumbnail}
				<img src={thumbnail} alt="" class="absolute inset-0 h-full w-full object-cover" />
				<div class="absolute inset-0 bg-black/40"></div>
			{/if}
			<div class="relative z-10 rounded-full bg-black/50 p-3 backdrop-blur-sm">
				<Play size={24} class="text-white" />
			</div>
			<span class="relative z-10 text-sm font-medium text-white drop-shadow">
				{config.label ?? `Load content from ${config.domain}`}
			</span>
		</button>
	{/if}
</div>
