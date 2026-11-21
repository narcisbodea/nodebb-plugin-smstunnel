'use strict';

const crypto = require('crypto');
const core = require('./core');

function digest(value) {
	return crypto.createHmac('sha256', String(core.nconf.get('secret'))).update(String(value)).digest('hex').slice(0, 32);
}

/**
 * Count one use in a rolling window, across every process of the forum. Two requests racing for the last slot can
 * both be refused, never both allowed.
 *
 * @returns {Promise<{key: string, token: string}|null>} the slot, or null when the limit is reached
 */
async function takeSlot(name, max, windowMs) {
	const { db } = core;
	const key = `smstunnel:rl:${name}`;
	const now = Date.now();
	const token = `${now}:${crypto.randomBytes(6).toString('hex')}`;

	await db.sortedSetsRemoveRangeByScore([key], '-inf', now - windowMs);
	await db.sortedSetAdd(key, now, token);
	await db.pexpire(key, windowMs * 2);

	const used = await db.sortedSetCount(key, now - windowMs + 1, '+inf');
	if (used > max) {
		await db.sortedSetRemove(key, token);
		return null;
	}
	return { key, token };
}

async function releaseSlots(slots) {
	await Promise.all(slots.filter(Boolean).map(slot => core.db.sortedSetRemove(slot.key, slot.token)));
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
