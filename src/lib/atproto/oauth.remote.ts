import * as v from 'valibot';
import { command, getRequestEvent } from '$app/server';
import { createOAuthClient } from '$lib/server/oauth';
import { scope } from '$lib/atproto/metadata';
import { signUpPDS } from '$lib/atproto/settings';
import type { ActorIdentifier, Did } from '@atcute/lexicons';

export const oauthLogin = command(
	v.object({
		handle: v.optional(v.pipe(v.string(), v.minLength(3))),
		signup: v.optional(v.boolean())
	}),
	async (input) => {
		const { platform } = getRequestEvent();
		const oauth = createOAuthClient(platform?.env);

		const target = input.signup
			? ({ type: 'pds', serviceUrl: signUpPDS } as const)
			: ({ type: 'account', identifier: input.handle as ActorIdentifier } as const);

		const { url } = await oauth.authorize({
			target,
			scope,
			prompt: input.signup ? 'create' : undefined
		});

		return { url: url.toString() };
	}
);

export const oauthLogout = command(async () => {
	const { cookies, platform } = getRequestEvent();
	const did = cookies.get('did') as Did | undefined;

	if (did) {
		try {
			const oauth = createOAuthClient(platform?.env);
			await oauth.revoke(did);
		} catch (e) {
			console.error('Error revoking session:', e);
		}
	}

	cookies.delete('did', { path: '/' });

	return { ok: true };
});
