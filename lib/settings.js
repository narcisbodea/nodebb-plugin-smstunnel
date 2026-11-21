'use strict';

const core = require('./core');

// The key and the staff numbers are NOT here: anything under settings:* can be read by the ACP from the browser.
const HASH = 'smstunnel';
const PRIVATE = 'smstunnel:private';
const STATUS = 'smstunnel:status';

const DEFAULTS = {
	enabled: 'off',
	alerts: 'off',
	alertFlags: 'on',
	alertQueue: 'on',
	memberTexts: 'off',
	memberHour: 3,
	memberDay: 5,
	forumDay: 100,
};

const BOUNDS = {
	memberHour: [1, 10],
	memberDay: [1, 20],
	forumDay: [1, 500],
};

const SWITCHES = ['enabled', 'alerts', 'alertFlags', 'alertQueue', 'memberTexts'];

function bounded(value, field) {
	const [min, max] = BOUNDS[field];
	const number = parseInt(value, 10);
	if (!Number.isInteger(number) || number < 1) {
		return DEFAULTS[field];
	}
	return Math.min(max, Math.max(min, number));
}

function clean(saved) {
	const values = { ...DEFAULTS };
	SWITCHES.forEach((field) => {
		if (saved && (saved[field] === 'on' || saved[field] === 'off')) {
			values[field] = saved[field];
		}
	});
	Object.keys(BOUNDS).forEach((field) => {
		values[field] = bounded(saved ? saved[field] : undefined, field);
	});
	return values;
}

async function get() {
	return clean(await core.meta.settings.get(HASH));
}

async function save(input) {
	// What the request left out keeps its saved value.
	const values = clean({ ...(await get()), ...input });
	await core.meta.settings.set(HASH, values);
	return values;
}

const isOn = values => values.enabled === 'on';
const membersOn = values => isOn(values) && values.memberTexts === 'on';
const alertOn = (values, type) => isOn(values) && values.alerts === 'on' &&
	values[type === 'flagged' ? 'alertFlags' : 'alertQueue'] === 'on';

// config.json ("smstunnel": { "apiKey": "..." }) or the environment (smstunnel__apiKey) win over the ACP field.
function keyFromConfig() {
	const value = core.nconf.get('smstunnel:apiKey');
	return typeof value === 'string' ? value.trim() : '';
}

async function getApiKey() {
	const fromConfig = keyFromConfig();
	if (fromConfig) {
		return fromConfig;
	}
	const saved = await core.db.getObjectField(PRIVATE, 'apiKey');
	return typeof saved === 'string' ? saved : '';
}

async function hasApiKey() {
	return !!(await getApiKey());
}

async function setApiKey(key) {
	await core.db.setObjectField(PRIVATE, 'apiKey', key);
}

async function clearApiKey() {
	await core.db.deleteObjectField(PRIVATE, 'apiKey');
}

function siteTitle() {
	return core.meta.config.title || core.meta.config['title:short'] || '';
}

// What the ACP shows about the last send: a reason and a time, nothing about the text or who it was for.
async function noteResult(result) {
	if (result.ok) {
		await core.db.delete(STATUS);
		return;
	}
	await core.db.setObject(STATUS, { reason: String(result.reason || 'unclear'), at: Date.now() });
	core.winston.warn(`[plugin/smstunnel] a text was not sent: ${result.reason || 'unclear'}`);
}

async function lastProblem() {
	const data = await core.db.getObject(STATUS);
	return data && data.reason ? { reason: String(data.reason), at: parseInt(data.at, 10) || 0 } : null;
}

module.exports = {
	PRIVATE, DEFAULTS, clean, get, save, isOn, membersOn, alertOn, keyFromConfig, getApiKey, hasApiKey, setApiKey,
	clearApiKey, siteTitle, noteResult, lastProblem,
};
