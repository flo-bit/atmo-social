import type { Component } from 'svelte';
import type { EmbedExternalData } from '../types';
import YouTubeEmbed from './YouTubeEmbed.svelte';
import TenorEmbed from './TenorEmbed.svelte';

export type SpecialEmbed = {
	match: (data: EmbedExternalData) => boolean;
	component: Component<{ data: EmbedExternalData }>;
};

export const specialEmbeds: SpecialEmbed[] = [
	{
		match: (data) => {
			const href = data.external.href;
			return /^https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(href);
		},
		component: YouTubeEmbed
	},
	{
		match: (data) => {
			return /^https?:\/\/(www\.|media\.)?tenor\.com\//.test(data.external.href);
		},
		component: TenorEmbed
	}
];

export function findSpecialEmbed(data: EmbedExternalData): SpecialEmbed | undefined {
	return specialEmbeds.find((e) => e.match(data));
}
