<script module>
	export const loginModalState = $state({ open: false });
</script>

<script lang="ts">
	import { AtprotoLoginModal } from '@foxui/social';
	import { login, signup } from '$lib/atproto';
</script>

<AtprotoLoginModal
	bind:open={loginModalState.open}
	login={async (handle) => {
		await login(handle);
		return true;
	}}
	signup={async () => {
		signup();
		return true;
	}}
/>
