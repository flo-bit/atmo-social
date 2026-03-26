<script lang="ts">
	import { SelectTheme } from '@foxui/colors';
	import { ThemeToggle } from '@foxui/core';
	import { Settings } from '@lucide/svelte';
</script>

<div class="flex h-dvh flex-col">
	<div class="mx-auto w-full max-w-lg">
		<div class="flex items-center gap-2 px-4 pt-4 pb-3">
			<Settings class="text-base-400" size={20} />
			<h1 class="text-base-900 dark:text-base-100 text-lg font-semibold">Settings</h1>
		</div>

		<div class="px-4 py-4">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-base-900 dark:text-base-100 text-sm font-semibold">Dark Mode</h2>
				<ThemeToggle />
			</div>
			<h2 class="text-base-900 dark:text-base-100 mb-4 text-sm font-semibold">Colors</h2>
			<SelectTheme
				defaultAccentColor="fuchsia"
				defaultBaseColor="mauve"
			/>
		</div>
	</div>
</div>
