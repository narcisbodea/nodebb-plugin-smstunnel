'use strict';

const { version } = require('../package.json');
const { isNumber } = require('./numbers');

// Fixed on purpose: there is no setting that could send the key or a number anywhere else.
const BASE_URL = 'https://smstunnel.io/api/v1';
const TIMEOUT = 15000;

function reasonFor(status, code) {
	if (status === 429 && code === 'KEY_DAILY_CAP_REACHED') {
		return 'key-daily-cap';
	}
	if (status === 429) {
		return 'limit';
	}
	if (status === 401) {
		return 'bad-key';
	}
	if (status === 403) {
		return 'not-allowed';
	}
	if (status === 409) {
		return 'in-progress';
	}
	if (status >= 500) {
		return 'unclear';
	}
	return 'refused';
}

/**
 * One request, once. Nothing here retries: after a refusal, a timeout or a lost answer the text may or may not
 * have gone out, and a second copy is worse than a missing one.
 *
 * @returns {Promise<{ok: boolean, reason?: string, status?: number}>} never the server's words, which may quote input
 */
async function send(path, apiKey, to, message, idempotencyKey) {
	if (!isNumber(to)) {
		return { ok: false, reason: 'invalid-number' };
	}
	if (!apiKey) {
		return { ok: false, reason: 'no-key' };
	}

	let response;
	try {
		response = await fetch(`${BASE_URL}${path}`, {
			method: 'POST',
			headers: {
				'X-API-Key': apiKey,
				'Content-Type': 'application/json',
				'Idempotency-Key': idempotencyKey,
				'User-Agent': `nodebb-plugin-smstunnel/${version}`,
			},
			body: JSON.stringify({ to, message }),
			// A redirect would carry the key to another address.
			redirect: 'error',
			signal: AbortSignal.timeout(TIMEOUT),
		});
	} catch (err) {
		return { ok: false, reason: 'unclear' };
	}

	let body = {};
	try {
		body = await response.json();
	} catch (err) {
		body = {};
	}

	if (response.ok && body && body.success !== false) {
		return { ok: true, status: response.status };
	}

	return { ok: false, status: response.status, reason: reasonFor(response.status, body && body.code) };
}

module.exports = {
	sendText: (apiKey, to, message, key) => send('/sms/send', apiKey, to, message, key),
	sendCode: (apiKey, to, message, key) => send('/sms/send-2fa', apiKey, to, message, key),
	reasonFor,
};
