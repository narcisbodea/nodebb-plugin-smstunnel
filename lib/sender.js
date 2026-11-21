'use strict';

// What goes out, to whom and how often.
//
// NodeBB's action hooks fire in the process that handled the request, and a forum can run several of them, so nothing
// here relies on being the only one: each person gets a post once through an atomic claim, each alert round has one
// owner, and every request carries an Idempotency-Key that stays the same for the same event and person.
// Nothing is ever retried. A refusal or an unclear result is final, and shows on the settings page.

const crypto = require('crypto');

const core = require('./core');
const settings = require('./settings');
const limits = require('./limits');
const members = require('./members');
const staff = require('./staff');
const api = require('./api');
const erase = require('./erase');
const { safeName, siteLabel } = require('./words');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const MAX_MENTIONS = 3; // most people one post can text by naming them
const AUTHOR_HOUR = 10; // most member texts one author's posts can cause in an hour
const GRACE = 15 * 1000; // a post removed or moved right after it was written doesn't text anyone
const COOLDOWN = 10 * 60 * 1000; // at most one alert of a type in this time; what happens in between is counted
const SWEEP = 30 * 1000;
const CLAIM_TTL = 3 * DAY;

const { ALERTS } = erase;
const TYPES = ['flagged', 'queued'];

const isTrue = value => value === true || value === 1 || value === '1' || value === 'true';

function localUid(value) {
	const text = String(value === undefined || value === null ? '' : value);
	if (!/^[1-9][0-9]{0,14}$/.test(text)) {
		return 0;
	}
	return parseInt(text, 10);
}

function eventKey(prefix, parts) {
	const digest = crypto.createHmac('sha256', String(core.nconf.get('secret')))
		.update([core.nconf.get('url'), ...parts].join('|'))
		.digest('hex')
		.slice(0, 40);
	return `nodebb-${prefix}-${digest}`;
}

// Only a reply, or a mention of this one person. A group mention has the same type, so it's told apart by its id and
// its wording, and anything unexpected counts as no.
function classify(notification) {
	if (!notification || !localUid(notification.pid)) {
		return null;
	}
	if (notification.type === 'new-reply') {
		return 'reply';
	}
	if (notification.type === 'mention' &&
		String(notification.nid).endsWith(':user') &&
		String(notification.bodyShort).startsWith('[[notifications:user-mentioned-you-in')) {
		return 'mention';
	}
	return null;
}

function memberText(kind, site, name, link) {
	const who = name || 'A member';
	const what = kind === 'reply' ? 'replied to your post.' : 'mentioned you.';
	return `${site}: ${who} ${what} ${link} Turn these texts off in your forum settings.`;
}

function alertText(type, count, site, base) {
	if (type === 'flagged') {
		return `${site}: ${count} post${count === 1 ? ' was' : 's were'} flagged. Review: ${base}/flags`;
	}
	return `${site}: ${count} post${count === 1 ? ' is' : 's are'} waiting for approval. Review: ${base}/post-queue`;
}

// Whether this member may read this post right now. Anything that can't be established counts as no.
async function canRead(pid, uid) {
	try {
		const { privileges, posts, topics, categories } = core;
		const allowed = await privileges.posts.filter('topics:read', [pid], uid);
		if (!Array.isArray(allowed) || !allowed.map(String).includes(String(pid))) {
			return false;
		}

		// Administrators pass the check above for removed posts too. A text about one is never right.
		const post = await posts.getPostFields(pid, ['tid', 'deleted']);
		if (!post || !localUid(post.tid) || isTrue(post.deleted)) {
			return false;
		}
		const topic = await topics.getTopicFields(post.tid, ['cid', 'deleted', 'scheduled']);
		if (!topic || !localUid(topic.cid) || isTrue(topic.deleted) || isTrue(topic.scheduled)) {
			return false;
		}
		const disabled = await categories.getCategoryField(topic.cid, 'disabled');
		return !isTrue(disabled);
	} catch (err) {
		return false;
	}
}

async function isBanned(uid) {
	try {
		const [banned] = await core.user.bans.isBanned([uid]);
		return banned !== false;
	} catch (err) {
		return true;
	}
}

// Whoever this post answers: the author of the post it replies to, or else of the topic. Never the topic's followers.
async function repliedTo(post) {
	const { posts, topics } = core;
	const toPid = localUid(post.toPid);
	const uid = toPid ? await posts.getPostField(toPid, 'uid') : await topics.getTopicField(post.tid, 'uid');
	return localUid(uid);
}

async function deliver(job) {
	const values = await settings.get();
	if (!settings.membersOn(values)) {
		return;
	}

	const phone = await members.phoneOf(job.uid);
	if (!phone || await isBanned(job.uid)) {
		return;
	}

	// Asked again now: the post may have been moved, removed or its category closed since this was queued.
	if (!await canRead(job.pid, job.uid)) {
		return;
	}

	const apiKey = await settings.getApiKey();
	if (!apiKey) {
		return;
	}

	const slots = await limits.takeAll([
		[`member:hour:${job.uid}`, values.memberHour, HOUR],
		[`member:day:${job.uid}`, values.memberDay, DAY],
		[`member:topic:${job.uid}:${job.tid}`, 1, HOUR],
		[`author:hour:${job.author}`, AUTHOR_HOUR, HOUR],
		['forum:day', values.forumDay, DAY],
	]);
	if (!slots) {
		return;
	}

	const base = core.nconf.get('url');
	const site = siteLabel(settings.siteTitle(), base);
	const name = safeName(await core.user.getUserField(job.author, 'username'));
	const text = memberText(job.kind, site, name, `${base}/post/${job.pid}`);

	// The last check before the text leaves. An erase since it was queued cancels it, even if the member has already
	// added a number again.
	if (!await erase.valid(job.ticket)) {
		await limits.releaseSlots(slots);
		return;
	}

	const result = await api.sendText(apiKey, phone, text, eventKey('m', [job.pid, job.uid, phone]));
	await settings.noteResult(result);
}

async function onNotification(data) {
	const values = await settings.get();
	if (!settings.membersOn(values) || !data) {
		return;
	}

	const kind = classify(data.notification);
	if (!kind) {
		return;
	}

	const pid = localUid(data.notification.pid);
	const post = await core.posts.getPostFields(pid, ['uid', 'tid', 'toPid']);
	const author = post ? localUid(post.uid) : 0;
	// Only a signed-in member of this forum can cause a text: not a guest, and not a remote account.
	if (!author || !localUid(post.tid)) {
		return;
	}

	const told = [...new Set([...(data.uidsNotified || data.uids || []), ...(data.uidsEmailed || [])].map(localUid))]
		.filter(uid => uid && uid !== author);

	let targets;
	if (kind === 'reply') {
		const answered = await repliedTo(post);
		targets = answered && answered !== author && told.includes(answered) ? [answered] : [];
	} else {
		// Cut before anyone is looked up: a post can't reach everyone by naming them.
		targets = told.slice(0, MAX_MENTIONS);
	}

	const ticket = await erase.ticket();
	if (ticket === null) {
		return;
	}

	const claims = `smstunnel:claim:${pid}`;
	for (const uid of targets) {
		/* eslint-disable no-await-in-loop */
		if (!await members.wantsTexts(uid) || !await canRead(pid, uid)) {
			continue;
		}
		if (!await limits.claimOnce(claims, `u${uid}`, CLAIM_TTL)) {
			continue;
		}
		if (kind === 'mention') {
			// Counted over the life of the post, so editing it can't reach three more people each time.
			const named = await core.db.incrObjectField(claims, 'mentions');
			if (parseInt(named, 10) > MAX_MENTIONS) {
				continue;
			}
		}
		/* eslint-enable no-await-in-loop */

		const job = { kind, uid, pid, tid: localUid(post.tid), author, ticket };
		setTimeout(() => {
			deliver(job).catch(err => core.logProblem('member text', err));
		}, GRACE).unref();
	}
}

async function flush(type) {
	const values = await settings.get();
	if (!settings.alertOn(values, type)) {
		return;
	}

	const { db } = core;
	const countField = `count:${type}`;
	const lastField = `last:${type}`;
	// Read through an increment of zero: unlike a plain read it can't come from this process's cache.
	const waiting = parseInt(await db.incrObjectFieldBy(ALERTS, countField, 0), 10) || 0;
	const last = parseInt(await db.incrObjectFieldBy(ALERTS, lastField, 0), 10) || 0;

	if (waiting < 1 || Date.now() - last < COOLDOWN) {
		return;
	}

	const ticket = await erase.ticket();
	if (ticket === null) {
		return;
	}

	// One owner for this round, in whichever process gets here first.
	if (!await limits.claimOnce(`smstunnel:alerts:round:${type}:${last}`, 'n', COOLDOWN * 2)) {
		return;
	}

	const at = Date.now();
	await db.setObjectField(ALERTS, lastField, at);
	const count = parseInt(await db.incrObjectFieldBy(ALERTS, countField, 0), 10) || 0;
	if (count < 1) {
		return;
	}
	await db.incrObjectFieldBy(ALERTS, countField, -count);

	const phones = await staff.confirmedNumbers();
	if (!phones.length) {
		return;
	}
	const apiKey = await settings.getApiKey();
	if (!apiKey) {
		return;
	}

	const base = core.nconf.get('url');
	const text = alertText(type, count, siteLabel(settings.siteTitle(), base), base);
	for (const phone of phones) {
		// eslint-disable-next-line no-await-in-loop
		if (!await erase.valid(ticket)) {
			return;
		}
		// eslint-disable-next-line no-await-in-loop
		const result = await api.sendText(apiKey, phone, text, eventKey('a', [type, at, phone]));
		// eslint-disable-next-line no-await-in-loop
		await settings.noteResult(result);
	}
}

async function onStaffEvent(type) {
	const values = await settings.get();
	if (!settings.alertOn(values, type) || !(await staff.confirmedNumbers()).length) {
		return;
	}
	await core.db.incrObjectField(ALERTS, `count:${type}`);
	await flush(type);
}

let sweeper = null;

function start() {
	if (sweeper) {
		return;
	}
	sweeper = setInterval(() => {
		TYPES.forEach((type) => {
			flush(type).catch(err => core.logProblem('staff alert', err));
		});
	}, SWEEP);
	sweeper.unref();
}

module.exports = {
	MAX_MENTIONS, GRACE, COOLDOWN, classify, memberText, alertText, canRead, onNotification, onStaffEvent, flush, start,
};
