'use strict';

// A member's own number and switch. Every call works on the signed-in member only: there is no user id to pass from
// the browser, so nobody, an administrator included, can turn texts on for someone else or read their number.

const crypto = require('crypto');

const core = require('./core');
const settings = require('./settings');
const limits = require('./limits');
const numbers = require('./numbers');
const api = require('./api');
const erase = require('./erase');
const { siteLabel } = require('./words');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const CODES = { member: 3, number: 3, ipHour: 3, ipDay: 10, forum: 20 };

const { PHONES } = erase;
const recordKey = uid => `smstunnel:user:${uid}`;
const pendingKey = uid => `smstunnel:user:${uid}:pending`;
const phoneField = number => limits.digest(`phone|${number}`);
const numberRule = number => `code:number:${limits.digest(`number|${number}`)}`;
const numberLimitKey = number => `smstunnel:rl:${numberRule(number)}`;
const secret = () => core.nconf.get('secret');
const fail = key => new Error(`[[smstunnel:error.${key}]]`);

function codeRules(number, ip) {
	const ipKey = limits.digest(`ip|${ip}`);
	return [
		[numberRule(number), CODES.number, DAY],
		[`code:ip:h:${ipKey}`, CODES.ipHour, HOUR],
		[`code:ip:d:${ipKey}`, CODES.ipDay, DAY],
		['code:forum', CODES.forum, DAY],
	];
}

async function record(uid) {
	const data = await core.db.getObject(recordKey(uid));
	if (!data || !numbers.isNumber(data.phone)) {
		return null;
	}
	return { phone: data.phone, on: String(data.on) === '1' };
}

async function wantsTexts(uid) {
	const data = await record(uid);
	return !!(data && data.on);
}

async function phoneOf(uid) {
	const data = await record(uid);
	return data && data.on ? data.phone : '';
}

async function status(uid) {
	const [data, pending] = await Promise.all([
		record(uid),
		core.db.getObjectField(pendingKey(uid), 'expires'),
	]);
	return {
		state: data ? (data.on ? 'on' : 'off') : 'none',
		number: data ? numbers.mask(data.phone) : '',
		waiting: !data && parseInt(pending, 10) > Date.now(),
	};
}

async function takenByOther(number, uid) {
	const owner = await core.db.getObjectField(PHONES, phoneField(number));
	return !!owner && String(owner) !== String(uid);
}

async function requestCode(uid, rawNumber, ip) {
	const number = numbers.readNumber(rawNumber);
	if (!number) {
		throw fail('bad-number');
	}

	const ticket = await erase.ticket();
	if (ticket === null) {
		throw fail('erasing');
	}

	const key = pendingKey(uid);
	const lastSent = parseInt(await core.db.getObjectField(key, 'sent'), 10) || 0;
	if (Date.now() - lastSent < numbers.RESEND_AFTER) {
		throw fail('wait');
	}

	const slots = await limits.takeAll([[`code:member:${uid}`, CODES.member, DAY], ...codeRules(number, ip)]);
	if (!slots) {
		throw fail('too-many');
	}

	// A number held by another account gets the same answer and the same record, and no text:
	// this can't be used to find out who is on the forum.
	const taken = await takenByOther(number, uid);
	const code = numbers.newCode();
	const now = Date.now();

	await core.db.delete(key);
	await core.db.setObject(key, {
		phone: number,
		hash: numbers.hashCode(secret(), `user-${uid}`, number, code),
		expires: now + numbers.CODE_TTL,
		sent: now,
		tries: 0,
	});
	await core.db.pexpire(key, HOUR);

	const apiKey = await settings.getApiKey();
	if (!await erase.valid(ticket)) {
		await core.db.deleteAll([key, numberLimitKey(number)]);
		throw fail('erasing');
	}
	if (taken) {
		return;
	}

	const site = siteLabel(settings.siteTitle(), core.nconf.get('url'));
	const text = `${site}: your code to turn on forum texts is ${code}. It works for 10 minutes. If you did not ask for it, ignore this text.`;
	const result = await api.sendCode(apiKey, number, text, `nodebb-code-${crypto.randomUUID()}`);
	await settings.noteResult(result);

	if (!result.ok) {
		throw fail('code-not-sent');
	}
}

async function confirm(uid, rawCode) {
	const code = numbers.readCode(rawCode);
	const key = pendingKey(uid);

	const ticket = await erase.ticket();
	if (ticket === null) {
		throw fail('erasing');
	}

	const seen = await core.db.getObject(key);
	if (!seen || !seen.hash || !code) {
		throw fail('bad-code');
	}

	// Counted before the comparison, so requests made in parallel can't get extra guesses. The count also clears any
	// cached copy of the record, so what's read next is what the database holds now.
	const tries = parseInt(await core.db.incrObjectField(key, 'tries'), 10);
	const pending = await core.db.getObject(key);
	if (!pending || !pending.hash || !numbers.isNumber(pending.phone) ||
		tries > numbers.CODE_TRIES || parseInt(pending.expires, 10) <= Date.now()) {
		await core.db.delete(key);
		throw fail('bad-code');
	}

	const expected = numbers.hashCode(secret(), `user-${uid}`, pending.phone, code);
	if (!numbers.sameHash(pending.hash, expected)) {
		if (tries >= numbers.CODE_TRIES) {
			await core.db.delete(key);
		}
		throw fail('bad-code');
	}

	await core.db.delete(key);
	if (await takenByOther(pending.phone, uid)) {
		throw fail('bad-code');
	}

	const previous = await record(uid);
	if (previous && previous.phone !== pending.phone) {
		await core.db.deleteObjectField(PHONES, phoneField(previous.phone));
	}
	await core.db.setObject(recordKey(uid), { phone: pending.phone, on: 1 });
	await core.db.setObjectField(PHONES, phoneField(pending.phone), String(uid));

	// An erase that began while this ran may have missed the write above, so it's taken back here.
	if (!await erase.valid(ticket)) {
		await core.db.delete(recordKey(uid));
		await core.db.deleteObjectField(PHONES, phoneField(pending.phone));
		throw fail('erasing');
	}
}

async function setState(uid, wanted) {
	if (wanted !== 'on' && wanted !== 'off') {
		throw fail('bad-state');
	}

	const ticket = await erase.ticket();
	if (ticket === null) {
		// The number is going anyway, so "off" is already true.
		if (wanted === 'off') {
			return;
		}
		throw fail('erasing');
	}

	if (!await record(uid)) {
		if (wanted === 'on') {
			throw fail('no-number');
		}
		return;
	}

	await core.db.setObjectField(recordKey(uid), 'on', wanted === 'on' ? 1 : 0);
	if (!await erase.valid(ticket)) {
		await core.db.delete(recordKey(uid));
	}
}

async function forget(uid) {
	const data = await record(uid);
	if (data) {
		const field = phoneField(data.phone);
		const owner = await core.db.getObjectField(PHONES, field);
		if (String(owner) === String(uid)) {
			await core.db.deleteObjectField(PHONES, field);
		}
	}
	await core.db.deleteAll([recordKey(uid), pendingKey(uid)]);
}

module.exports = {
	CODES, codeRules, numberLimitKey, wantsTexts, phoneOf, status, requestCode, confirm, setState, forget,
};
