import http from 'k6/http';
import { check, fail } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
	thresholds: {
		http_req_failed: ['rate<0.01'],
		http_req_duration: ['p(95)<500'],
	},
};

// ponytail: scrapes the `$ACTION_ID_*` hidden input from the rendered page
// instead of hardcoding an action id — Next.js rotates action ids on every
// rebuild (and at least every 14 days even without one), so a hardcoded id
// goes stale fast. If the fixture ever binds arguments to the action, the
// id moves to an encrypted `$ACTION_REF_*`/`$ACTION_KEY` closure and this
// selector needs updating (see docs/DESIGN.md).
export const setup = () => {
	const res = http.get(BASE_URL);
	const input = res.html().find('input[name^="$ACTION_ID_"]').first();
	const fieldName = input.attr('name');
	if (fieldName === undefined || fieldName === '') {
		fail(`could not find a $ACTION_ID_* hidden input on ${BASE_URL}`);
	}
	return { actionId: fieldName.replace('$ACTION_ID_', '') };
};

// Replays the same request the browser sends when JS invokes the action
// directly (button onClick / form action dispatch), not the no-JS
// multipart/form-data fallback.
export default (data) => {
	const res = http.post(BASE_URL, '[]', {
		headers: {
			'Content-Type': 'text/plain;charset=UTF-8',
			Accept: 'text/x-component',
			'Next-Action': data.actionId,
			Origin: BASE_URL,
		},
	});

	check(res, {
		'status is 200': (r) => r.status === 200,
		'response is a flight stream': (r) =>
			(r.headers['Content-Type'] || '').includes('text/x-component'),
	});
};
