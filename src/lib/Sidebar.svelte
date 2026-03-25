<script lang="ts">
	import type { WithElementRef } from 'bits-ui';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '@foxui/core';

	const {
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	class={cn(
		'border-base-400/40 dark:border-base-300/10 bg-base-200/70 dark:bg-base-950/70 inset-shadow-base-800/10 fixed top-2 bottom-2 left-2 z-50 hidden w-16 flex-col items-center gap-2 overflow-hidden rounded-full border p-2 pt-4 inset-shadow-sm backdrop-blur-lg lg:flex dark:inset-shadow-black/50',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
