<script lang="ts">
	import '../app.css';
	import { Head, ThemeToggle } from '@foxui/core';
	import { House } from '@lucide/svelte';
	import LoginModal from '$lib/LoginModal.svelte';
	import Sidebar from '$lib/Sidebar.svelte';
	let { children } = $props();
</script>

<Sidebar>
	<a href="/" class="text-base-600 hover:bg-base-100 dark:text-base-400 dark:hover:bg-base-800 rounded-lg p-2 transition-colors">
		<House size={20} />
	</a>
	<ThemeToggle class="mt-auto mb-2" />
</Sidebar>

<div class="lg:ml-20">
	{@render children()}
</div>

<LoginModal />

<Head
	title="statusphere"
	emojiFavicon="🥳"
	description="svelte + cloudflare workers statusphere"
	image="/og.png"
/>
