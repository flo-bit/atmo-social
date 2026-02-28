import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.client || !locals.did) return { statuses: [] };

	try {
		const response = await locals.client.get('com.atproto.repo.listRecords', {
			params: {
				repo: locals.did,
				collection: 'xyz.statusphere.status',
				limit: 10
			}
		});

		if (!response.ok) return { statuses: [] };

		return {
			statuses: response.data.records.map((r) => ({
				rkey: r.uri.split('/').pop()!,
				status: (r.value as { status: string }).status,
				createdAt: (r.value as { createdAt: string }).createdAt
			}))
		};
	} catch {
		return { statuses: [] };
	}
};
