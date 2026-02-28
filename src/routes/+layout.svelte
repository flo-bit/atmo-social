<script lang="ts">
	import '../app.css';

	import LoginModal from '$lib/atproto/UI/LoginModal.svelte';

	let { children } = $props();
</script>

{@render children()}

<LoginModal />
