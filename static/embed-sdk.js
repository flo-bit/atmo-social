/**
 * atmo.social Embed SDK
 *
 * Include this script in your embed page to communicate with the host app.
 *
 * Usage:
 *   <script src="https://atmo.social/embed-sdk.js"><\/script>
 *   <script>
 *     // Read params passed by the host
 *     const { base, accent, dark, did } = AtmoEmbed.getParams();
 *
 *     // Create a record on behalf of the logged-in user
 *     const result = await AtmoEmbed.createRecord({
 *       collection: 'community.lexicon.calendar.rsvp',
 *       record: { ... }
 *     });
 *
 *     // Delete a record
 *     await AtmoEmbed.deleteRecord({
 *       collection: 'community.lexicon.calendar.rsvp',
 *       rkey: 'abc123'
 *     });
 *   <\/script>
 */
(function () {
	'use strict';

	let _id = 0;
	const _pending = new Map();

	// Listen for responses from the host
	window.addEventListener('message', function (event) {
		const data = event.data;
		if (!data || data.type !== 'response' || !data.id) return;
		const pending = _pending.get(data.id);
		if (!pending) return;
		_pending.delete(data.id);
		if (data.error) {
			pending.reject(new Error(data.error));
		} else {
			pending.resolve(data.result);
		}
	});

	function sendMessage(type, payload) {
		return new Promise(function (resolve, reject) {
			var id = 'embed-' + (++_id);
			_pending.set(id, { resolve: resolve, reject: reject });
			window.parent.postMessage(
				Object.assign({ type: type, id: id }, payload),
				'*'
			);
			// Timeout after 30s
			setTimeout(function () {
				if (_pending.has(id)) {
					_pending.delete(id);
					reject(new Error('Request timed out'));
				}
			}, 30000);
		});
	}

	window.AtmoEmbed = {
		/**
		 * Get the parameters passed by the host app.
		 * @returns {{ base: string, accent: string, dark: boolean, did: string | null }}
		 */
		getParams: function () {
			var params = new URLSearchParams(window.location.search);
			return {
				base: params.get('base') || 'mauve',
				accent: params.get('accent') || 'fuchsia',
				dark: params.get('dark') === '1',
				did: params.get('did') || null
			};
		},

		/**
		 * Create a record on behalf of the logged-in user.
		 * @param {{ collection: string, rkey?: string, record: object }} opts
		 * @returns {Promise<{ uri: string, cid: string }>}
		 */
		createRecord: function (opts) {
			return sendMessage('createRecord', {
				collection: opts.collection,
				rkey: opts.rkey,
				record: opts.record
			});
		},

		/**
		 * Delete a record owned by the logged-in user.
		 * @param {{ collection: string, rkey: string }} opts
		 * @returns {Promise<void>}
		 */
		deleteRecord: function (opts) {
			return sendMessage('deleteRecord', {
				collection: opts.collection,
				rkey: opts.rkey
			});
		}
	};
})();
