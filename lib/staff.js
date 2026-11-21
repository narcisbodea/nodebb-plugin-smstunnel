'use strict';

// The few numbers that get staff alerts. They belong to no forum account, so a number only starts getting alerts after
// whoever holds it passes back a code sent to it. They live outside settings:*, and the ACP only ever sees them masked.

const crypto = require('crypto');

const core = require('./core');
const settings = require('./settings');
const limits = require('./limits');
const numbers = require('./numbers');
const members = require('./members');
const api = require('./api');
const { siteLabel } = require('./words');

const MAX_STAFF = 5;
const HOUR = 60 * 60 * 1000;
const FIELD = 'staff';

const pendingKey = id => `smstunnel:staff:${id}:pending`;
const fail = key => new Error(`[[smstunnel:error.${key}]]`);
const secret = () => core.nconf.get('secret');
const site = () => siteLabel(settings.siteTitle(), core.nconf.get('url'));

async function list() {
	const raw = await core.db.getObjectField(settings.PRIVATE, FIELD);
	if (!raw) {
		return [];
	}
	try {
		const rows = JSON.parse(raw);
		return Array.isArray(rows) ? rows.filter(row => row && numbers.isNumber(row.phone)) : [];
	} catch (err) {
		return [];
	}
}

async function write(rows) {
	await core.db.setObjectField(settings.PRIVATE, FIELD, JSON.stringify(rows));
}

async function find(id) {
	const rows = await list();
	const row = rows.find(item => item.id === String(id));
	if (!row) {
		throw fail('no-staff');
	}
	return { rows, row };
}

async function view() {
	const rows = await list();
	return rows.map(row => ({
		id: row.id,
		number: numbers.mask(row.phone),
		label: row.label || '',
		confirmed: !!row.confirmed,
	}));
}

async function confirmedNumbers() {
	const rows = await list();
	return [...new Set(rows.filter(row => row.confirmed).map(row => row.phone))].slice(0, MAX_STAFF);
}

async function sendCode(row, ip) {
	const key = pendingKey(row.id);
	const lastSent = parseInt(await core.db.getObjectField(key, 'sent'), 10) || 0;
	if (Date.now() - lastSent < numbers.RESEND_AFTER) {
		throw fail('wait');
	}
	if (!await limits.takeAll(members.codeRules(row.phone, ip))) {
		throw fail('too-many');
	}

	const code = numbers.newCode();
	const now = Date.now();
	await core.db.delete(key);
	await core.db.setObject(key, {
		hash: numbers.hashCode(secret(), 'staff', row.phone, code),
		expires: now + numbers.CODE_TTL,
		sent: now,
		tries: 0,
	});
	await core.db.pexpire(key, HOUR);

	const text = `${site()}: your code to get forum alerts is ${code}. It works for 10 minutes. If you did not ask for it, ignore this text.`;
	const result = await api.sendCode(await settings.getApiKey(), row.phone, text, `nodebb-code-${crypto.randomUUID()}`);
	await settings.noteResult(result);
	if (!result.ok) {
		throw fail('code-not-sent');
	}
}

async function add(rawNumber, rawLabel, ip) {
	const phone = numbers.readNumber(rawNumber);
	if (!phone) {
		throw fail('bad-number');
	}
	const rows = await list();
	if (rows.length >= MAX_STAFF) {
		throw fail('staff-full');
	}
	if (rows.some(row => row.phone === phone)) {
		throw fail('staff-duplicate');
	}
	if (!await settings.hasApiKey()) {
		throw fail('no-key');
	}

	const label = String(rawLabel === undefined || rawLabel === null ? '' : rawLabel)
		.replace(/[<>\p{C}]/gu, '').trim().slice(0, 40);
	const row = { id: crypto.randomBytes(6).toString('hex'), phone, label, confirmed: false };
	rows.push(row);
	await write(rows);
	await sendCode(row, ip);
	return row.id;
}

async function resend(id, ip) {
	const { row } = await find(id);
	if (row.confirmed) {
		return;
	}
	await sendCode(row, ip);
}

async function confirm(id, rawCode) {
	const { rows, row } = await find(id);
	const key = pendingKey(row.id);
	const pending = await core.db.getObject(key);
	const code = numbers.readCode(rawCode);

	if (!pending || !pending.hash || !code) {
		throw fail('bad-code');
	}
	if (parseInt(pending.expires, 10) <= Date.now()) {
		await core.db.delete(key);
		throw fail('bad-code');
	}

	const tries = parseInt(await core.db.incrObjectField(key, 'tries'), 10);
	if (tries > numbers.CODE_TRIES) {
		await core.db.delete(key);
		throw fail('bad-code');
	}
	if (!numbers.sameHash(pending.hash, numbers.hashCode(secret(), 'staff', row.phone, code))) {
		if (tries >= numbers.CODE_TRIES) {
			await core.db.delete(key);
		}
		throw fail('bad-code');
	}

	await core.db.delete(key);
	row.confirmed = true;
	await write(rows);
}

async function remove(id) {
	const { rows, row } = await find(id);
	await write(rows.filter(item => item.id !== row.id));
	await core.db.delete(pendingKey(row.id));
}

// Only to a number that already confirmed it wants forum texts, so this can't be used to text anyone else.
async function sendTest(id) {
	const { row } = await find(id);
	if (!row.confirmed) {
		throw fail('not-confirmed');
	}
	const slots = await limits.takeAll([
		['test:forum', 5, HOUR],
		[`test:number:${limits.digest(row.phone)}`, 3, HOUR],
	]);
	if (!slots) {
		throw fail('too-many');
	}
	const text = `${site()}: this is a test text from the SMSTunnel plugin. Staff alerts can reach this number.`;
	const result = await api.sendText(await settings.getApiKey(), row.phone, text, `nodebb-test-${crypto.randomUUID()}`);
	await settings.noteResult(result);
	if (!result.ok) {
		throw fail(`send-${result.reason}`);
	}
}

module.exports = { MAX_STAFF, view, confirmedNumbers, add, resend, confirm, remove, sendTest };
