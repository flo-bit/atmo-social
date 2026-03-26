<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { user } from '$lib/atproto/auth.svelte';
	import { putRecord, deleteRecord } from '$lib/atproto/server/repo.remote';
	import type { EmbedAppConfig } from './embed-registry';

	const { config, url }: { config: EmbedAppConfig; url: string } = $props();

	let iframeEl: HTMLIFrameElement | undefined = $state(undefined);

	// Build embed URL with theme + auth params
	function buildEmbedUrl(): string {
		const embedUrl = new URL(config.embedUrl(url));

		// Theme: read current classes from <html>
		const html = document.documentElement;
		const classes = Array.from(html.classList);

		// Find base color (gray, stone, zinc, neutral, slate, olive, mauve, mist, taupe)
		const baseColors = ['gray', 'stone', 'zinc', 'neutral', 'slate', 'olive', 'mauve', 'mist', 'taupe'];
		const base = classes.find((c) => baseColors.includes(c)) ?? 'mauve';

		// Find accent color
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

	let embedSrc = $derived(buildEmbedUrl());

	// Handle postMessage from the iframe
	async function handleMessage(event: MessageEvent) {
		// Validate origin matches the registered domain
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
				// Validate collection is allowed
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
				return; // Unknown message type
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
	class="border-base-300 dark:border-base-600/30 w-full overflow-hidden rounded-2xl border"
	style="aspect-ratio: {config.aspectRatio.width} / {config.aspectRatio.height}"
>
	<iframe
		bind:this={iframeEl}
		src={embedSrc}
		title="Embedded content from {config.domain}"
		class="h-full w-full border-0"
		sandbox="allow-scripts allow-same-origin"
		loading="lazy"
	></iframe>
</div>
