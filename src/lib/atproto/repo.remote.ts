import { error } from '@sveltejs/kit';
import { command, getRequestEvent } from '$app/server';
import * as v from 'valibot';

const collectionSchema = v.pipe(
	v.string(),
	v.regex(/^[a-zA-Z][a-zA-Z0-9-]*\.[a-zA-Z][a-zA-Z0-9-]*\.[a-zA-Z][a-zA-Z0-9-]*$/)
);

export const putRecord = command(
	v.object({
		collection: collectionSchema,
		rkey: v.optional(v.string()),
		record: v.record(v.string(), v.unknown())
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.client || !locals.did) error(401, 'Not authenticated');

		const response = await locals.client.post('com.atproto.repo.putRecord', {
			input: {
				collection: input.collection as `${string}.${string}.${string}`,
				repo: locals.did,
				rkey: input.rkey || 'self',
				record: input.record
			}
		});

		return response.data;
	}
);

export const deleteRecord = command(
	v.object({
		collection: collectionSchema,
		rkey: v.optional(v.string())
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.client || !locals.did) error(401, 'Not authenticated');

		const response = await locals.client.post('com.atproto.repo.deleteRecord', {
			input: {
				collection: input.collection as `${string}.${string}.${string}`,
				repo: locals.did,
				rkey: input.rkey || 'self'
			}
		});

		return { ok: response.ok };
	}
);

export const uploadBlob = command(
	v.object({
		blob: v.instance(Blob)
	}),
	async (input) => {
		const { locals } = getRequestEvent();
		if (!locals.client || !locals.did) error(401, 'Not authenticated');

		const response = await locals.client.post('com.atproto.repo.uploadBlob', {
			params: { repo: locals.did },
			input: input.blob
		});

		if (!response?.ok) error(500, 'Upload failed');

		return response.data.blob as {
			$type: 'blob';
			ref: { $link: string };
			mimeType: string;
			size: number;
		};
	}
);
