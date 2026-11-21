'use strict';

const crypto = require('crypto');
const core = require('./core');

const PARTS = 12;

function digest(value) {
	return crypto.createHmac('sha256', String(core.nconf.get('secret'))).update(String(value)).digest('hex').slice(0, 32);
}

/**
 * Count one use in a rolling window, across every process of the forum.
 *
 * One hash per limit, so its expiry works the same on MongoDB, Redis and PostgreSQL (a sorted set on MongoDB is many
 * documents and only one of them would expire). The window is split into small parts and the count covers all of the
 * last window plus at most one part, so it can refuse slightly early and can never allow more than the limit. Each
 * caller reads its own atomic increment, so two requests racing for the last slot can't both get it.
 *
 * @returns {Promise<{key: string, field: string}|null>} the slot, or null when the limit is reached
 */
async function takeSlot(name, max, windowMs) {
	const { db } = core;
	const size = Math.ceil(windowMs / PARTS);
	const key = `smstunnel:rl:${name}`;
	const part = Math.floor(Date.now() / size);
	const field = `b${part}`;

	const current = parseInt(await db.incrObjectField(key, field), 10) || 0;
	await db.pexpire(key, windowMs + (2 * size));

	const data = (await db.getObject(key)) || {};
	const old = [];
	let used = current;
	Object.keys(data).forEach((entry) => {
		const match = /^b([0-9]+)$/.exec(entry);
		if (!match || entry === field) {
			return;
		}
		if (parseInt(match[1], 10) >= part - PARTS) {
			used += parseInt(data[entry], 10) || 0;
		} else {
			old.push(entry);
		}
	});
	if (old.length) {
		await db.deleteObjectFields(key, old);
	}

	if (used > max) {
		await db.incrObjectFieldBy(key, field, -1);
		return null;
	}
	return { key, field };
}

async function releaseSlots(slots) {
	await Promise.all(slots.filter(Boolean).map(slot => core.db.incrObjectFieldBy(slot.key, slot.field, -1)));
}

// Every limit, or none: a refused attempt doesn't use up what the others allow.
async function takeAll(rules) {
	const taken = [];
	for (const [name, max, windowMs] of rules) {
		// eslint-disable-next-line no-await-in-loop
		const slot = await takeSlot(name, max, windowMs);
		if (!slot) {
			// eslint-disable-next-line no-await-in-loop
			await releaseSlots(taken);
			return null;
		}
		taken.push(slot);
	}
	return taken;
}

/**
 * True for exactly one caller, in whichever process it runs. An atomic counter is the one primitive that behaves
 * the same on MongoDB, Redis and PostgreSQL.
 */
async function claimOnce(key, field, ttlMs) {
	const { db } = core;
	const count = await db.incrObjectField(key, field);
	if (parseInt(count, 10) === 1) {
		await db.pexpire(key, ttlMs);
		return true;
	}
	// A process that died between the two calls would leave this key for ever.
	const left = await db.pttl(key);
	if (!(left > 0)) {
		await db.pexpire(key, ttlMs);
	}
	return false;
}

module.exports = { digest, takeSlot, takeAll, releaseSlots, claimOnce };
