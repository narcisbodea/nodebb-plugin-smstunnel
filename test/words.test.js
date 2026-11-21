'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { safeName, safeWords, siteLabel } = require('../lib/words');
const numbers = require('../lib/numbers');
const api = require('../lib/api');

test('keeps ordinary names in any alphabet', () => {
	for (const [input, expected] of [
		['Ana', 'Ana'],
		['Maria Popescu', 'Maria Popescu'],
		['Șerban Ionuț', 'Șerban Ionuț'],
		['Иван', 'Иван'],
		['محمد', 'محمد'],
		['李小龙', '李小龙'],
		['O\'Neil', 'O\'Neil'],
		['Jean-Luc', 'Jean-Luc'],
	]) {
		assert.strictEqual(safeName(input), expected);
	}
});

test('nothing that can be followed survives', () => {
	const hostile = [
		'http://evil.example',
		'https://evil.example/login',
		'evil.com',
		'www.evil.com',
		'EVIL.COM',
		'evil . com',
		'evil dot com',
		'evil [.] com',
		'evil(dot)com',
		'evil。com',
		'evil．com',
		'evil․com',
		'e\u200Bvil.com',
		'evil\u202E.com',
		'ｅｖｉｌ．ｃｏｍ',
		'evil&#46;com',
		'evil&#x2E;com',
		'evil&period;com',
		'evil&amp;#46;com',
		'me@evil.com',
		'tel:+40712345678',
		'sms:+40712345678',
		'//evil.example',
		'evil⁄⁄example',
		'bit.ly/abc',
		'<a href="http://evil.example">x</a>',
		'evil. com',
	];
	for (const input of hostile) {
		const out = safeName(input);
		assert.doesNotMatch(out, /[0-9.:/@]|http|www|\bcom\b/iu, `${JSON.stringify(input)} became ${JSON.stringify(out)}`);
	}
});

test('digits, invisible characters and emoji are removed', () => {
	assert.strictEqual(safeName('Ana 0712345678'), 'Ana');
	assert.strictEqual(safeName('A\u200Bn\u200Da'), 'Ana');
	assert.strictEqual(safeName('Ana\u202E'), 'Ana');
	assert.strictEqual(safeName('Ana 🎉'), 'Ana');
	assert.strictEqual(safeName('١٢٣٤٥٦'), '');
	assert.strictEqual(safeName('12345'), '');
	assert.strictEqual(safeName('\u200B\u200C'), '');
});

test('one line, and cut to length', () => {
	assert.strictEqual(safeName('Ana\r\nMaria'), 'Ana Maria');
	assert.ok(Array.from(safeName('a'.repeat(200))).length <= 24);
	assert.ok(Array.from(safeWords('ș'.repeat(200), 10)).length <= 10);
	assert.strictEqual(safeName(null), '');
	assert.strictEqual(safeName(undefined), '');
	assert.strictEqual(safeName({}), '');
});

test('the forum name stays short and on one line', () => {
	assert.strictEqual(siteLabel('My\nForum', 'https://f.example'), 'My Forum');
	assert.strictEqual(siteLabel('', 'https://f.example/x'), 'f.example');
	assert.ok(siteLabel('x'.repeat(100), 'https://f.example').length <= 40);
});

test('only one international number is accepted', () => {
	for (const good of ['+40712345678', '+1 415 555 0123', '+49 (151) 234-5678', '+1234567']) {
		assert.ok(numbers.readNumber(good), good);
	}
	for (const bad of [
		'', ' ', '0712345678', '40712345678', '0040712345678', '+0712345678', '+', '+123456', '+1234567890123456',
		'+40712345678,+40712345679', '+40712345678;+40712345679', '+4071234567a', 'tel:+40712345678', null, undefined,
		40712345678, ['+40712345678'], {}, `+407${'1'.repeat(40)}`,
	]) {
		assert.strictEqual(numbers.readNumber(bad), '', String(bad));
		assert.strictEqual(numbers.isNumber(bad), false, String(bad));
	}
});

test('a bad number never reaches the network', async () => {
	const original = global.fetch;
	let calls = 0;
	global.fetch = async () => {
		calls += 1;
		return new Response('{}');
	};
	try {
		for (const bad of ['+0712345678', '0712345678', '+40712345678,+40712345679', '']) {
			const result = await api.sendText('key', bad, 'text', 'id');
			assert.deepStrictEqual(result, { ok: false, reason: 'invalid-number' });
		}
		assert.strictEqual(calls, 0);
	} finally {
		global.fetch = original;
	}
});

test('one request per text, and the key, number and words stay out of the result', async () => {
	const original = global.fetch;
	const answers = [
		[429, { code: 'KEY_DAILY_CAP_REACHED', message: 'cap' }, 'key-daily-cap'],
		[429, { message: 'too many' }, 'limit'],
		[401, {}, 'bad-key'],
		[403, {}, 'not-allowed'],
		[409, { code: 'IDEMPOTENCY_KEY_IN_PROGRESS' }, 'in-progress'],
		[400, { message: 'bad +40712345678' }, 'refused'],
		[500, {}, 'unclear'],
		[503, {}, 'unclear'],
	];
	try {
		for (const [status, body, reason] of answers) {
			let calls = 0;
			global.fetch = async () => {
				calls += 1;
				return new Response(JSON.stringify(body), { status });
			};
			const result = await api.sendText('secret-key', '+40712345678', 'words', 'event-1');
			assert.strictEqual(calls, 1);
			assert.strictEqual(result.reason, reason);
			assert.strictEqual(result.ok, false);
			assert.doesNotMatch(JSON.stringify(result), /secret-key|40712345678|words/);
		}

		let calls = 0;
		global.fetch = async () => {
			calls += 1;
			throw new Error('socket hang up');
		};
		const lost = await api.sendText('secret-key', '+40712345678', 'words', 'event-1');
		assert.deepStrictEqual(lost, { ok: false, reason: 'unclear' });
		assert.strictEqual(calls, 1);
	} finally {
		global.fetch = original;
	}
});

test('the request goes to the fixed host with the event key and refuses redirects', async () => {
	const original = global.fetch;
	let seen;
	global.fetch = async (url, options) => {
		seen = { url, options };
		return new Response(JSON.stringify({ success: true, messageId: 'x' }), { status: 200 });
	};
	try {
		const result = await api.sendText('secret-key', '+40712345678', 'words', 'event-1');
		assert.strictEqual(result.ok, true);
		assert.strictEqual(seen.url, 'https://smstunnel.io/api/v1/sms/send');
		assert.strictEqual(seen.options.headers['Idempotency-Key'], 'event-1');
		assert.strictEqual(seen.options.headers['X-API-Key'], 'secret-key');
		assert.strictEqual(seen.options.redirect, 'error');
		assert.deepStrictEqual(JSON.parse(seen.options.body), { to: '+40712345678', message: 'words' });
	} finally {
		global.fetch = original;
	}
});
