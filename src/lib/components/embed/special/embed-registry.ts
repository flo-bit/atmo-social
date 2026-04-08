/**
 * Registry of third-party atproto apps that support embedding.
 *
 * Each entry defines:
 * - match: which external links should use the embed
 * - embedUrl: transforms the original URL into the embed URL
 * - allowedCollections: which AT Protocol collections the embed can create/delete records in
 * - dimensions: fixed aspect ratio to prevent layout shift
 */

export interface EmbedAppConfig {
	/** Domain identifier for postMessage origin validation */
	domain: string;
	/** Match function: returns true if this external link should be embedded */
	match: (href: string) => boolean;
	/** Transform the original URL into the embed URL */
	embedUrl: (href: string) => string;
	/** Collections the embed is allowed to create/delete records in */
	allowedCollections: string[];
	/** Aspect ratio for the embed to prevent layout shift */
	aspectRatio: { width: number; height: number };
	/** If true, show a click-to-load overlay before loading the iframe */
	requireClick?: boolean;
	/** Label for the click-to-load overlay */
	label?: string;
}

export const embedApps: EmbedAppConfig[] = [
	{
		domain: 'atmo.rsvp',
		match: (href) => /^https?:\/\/(www\.)?atmo\.rsvp\/p\/[^/]+\/e\/[^/]+\/?$/.test(href),
		embedUrl: (href) => {
			const url = new URL(href);
			// /p/actor/e/rkey -> /embed/p/actor/e/rkey
			url.pathname = '/embed' + url.pathname.replace(/\/$/, '');
			url.search = '';
			return url.toString();
		},
		allowedCollections: [
			'community.lexicon.calendar.rsvp'
		],
		aspectRatio: { width: 2, height: 1 }
	},
	{
		domain: 'stream.place',
		match: (href) => /^https?:\/\/(www\.)?stream\.place\/[^/]+\/?$/.test(href),
		embedUrl: (href) => {
			const url = new URL(href);
			const actor = url.pathname.replace(/^\//, '').replace(/\/$/, '');
			url.pathname = `/embed/${actor}`;
			url.search = '';
			return url.toString();
		},
		allowedCollections: [],
		aspectRatio: { width: 16, height: 9 },
		requireClick: true,
		label: 'Load stream'
	}
];

/**
 * Find an embed app config for a given URL.
 */
export function findEmbedApp(href: string): EmbedAppConfig | undefined {
	return embedApps.find((app) => app.match(href));
}
