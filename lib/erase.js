'use strict';

// "Erase all numbers": removes every phone number the plugin stores, and every record keyed by one. The API key, the
// settings and the limits that aren't about a number stay.
//
// Other processes keep working while this runs, so the order matters. A lock says an erase is running and the
// generation goes up, and only then is anything deleted. Whatever works with a number holds a ticket, the generation
// it started under: a text goes out only while its ticket is good, and a write that raced an erase takes itself back.
// Every step is a delete, so running this twice does no harm.

const core = require('./core');
const limits = require('./limits');
const settings = require('./settings');

const STATE = 'smstunnel:erase';
const LOCK = 'smstunnel:erase:running';
const LEASE = 10 * 60 * 1000; // a process that dies half way can't hold everything up for longer than this
const BATCH = 500;

const PHONES = 'smstunnel:phones';
const ALERTS = 'smstunnel:alerts';
const NUMBER_KEYS = [
	'smstunnel:user:*',
	'smstunnel:staff:*',
	'smstunnel:rl:code:number:*',
	'smstunnel:rl:test:number:*',
];

// An increment of zero is the database's own answer: a plain read could come from this process's cache.
async function generation() {
	return parseInt(await core.db.incrObjectFieldBy(STATE, 'generation', 0), 10) || 0;
}

// The generation to hold while working with a number, or null while an erase is running. It's read before the lock is
// checked: an erase that starts right after that check still changes it, so the ticket goes bad.
async function ticket() {
	const current = await generation();
	return (await core.db.exists(LOCK)) ? null : current;
}

async function valid(held) {
	if (held === null || held === undefined) {
		return false;
	}
	const current = await generation();
	return current === held && !(await core.db.exists(LOCK));
}

async function clearStaff() {
	const { db } = core;
	await db.incrObjectFieldBy(settings.PRIVATE, 'reads', 0);
	const raw = await db.getObjectField(settings.PRIVATE, 'staff');
	await db.deleteObjectField(settings.PRIVATE, 'staff');
	try {
		const rows = JSON.parse(raw || '[]');
		return Array.isArray(rows) ? rows.length : 0;
	} catch (err) {
		return 0;
	}
}

async function all() {
	const { db } = core;
	if (!await limits.claimOnce(LOCK, 'n', LEASE)) {
		throw new Error('[[smstunnel:error.erase-running]]');
	}

	const counts = { members: 0, staff: 0, pending: 0 };
	try {
		await db.incrObjectField(STATE, 'generation');
		counts.staff = await clearStaff();

		/* eslint-disable no-await-in-loop */
		for (const match of NUMBER_KEYS) {
			const keys = await db.scan({ match });
			if (match === 'smstunnel:user:*') {
				const waiting = keys.filter(key => key.endsWith(':pending')).length;
				counts.pending += waiting;
				counts.members += keys.length - waiting;
			} else if (match === 'smstunnel:staff:*') {
				counts.pending += keys.length;
			}
			for (let i = 0; i < keys.length; i += BATCH) {
				await db.deleteAll(keys.slice(i, i + BATCH));
				await db.pexpire(LOCK, LEASE);
			}
		}
		/* eslint-enable no-await-in-loop */

		await db.delete(PHONES);
		// Alerts still waiting for their turn were meant for the numbers that just went.
		await db.deleteObjectFields(ALERTS, ['count:flagged', 'count:queued']);
	} finally {
		await db.delete(LOCK);
	}

	core.winston.info(`[plugin/smstunnel] stored numbers erased: ${counts.members} members, ${counts.staff} staff, ${counts.pending} waiting for a code`);
	return counts;
}

module.exports = { PHONES, ALERTS, ticket, valid, all };
