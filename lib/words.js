'use strict';

// Words a member typed, made safe to appear in a text that comes from the forum owner's own number.
// What survives is letters, their marks, spaces, apostrophes and hyphens: no link, domain, address or digit can.

const TLDS = 'com|net|org|info|biz|io|co|me|app|dev|xyz|top|site|online|shop|store|club|link|click|live|icu|ru|cn|de|uk|fr|ro|it|es|nl|pl|br|in|us|eu|tk|ml|ga|cf|gq|ly|to|cc|tv|ws';

// \b only knows ASCII in JavaScript, so word edges are written out.
const START = '(?<![\\p{L}\\p{N}_])';
const END = '(?![\\p{L}\\p{N}_])';

const NAMED = {
	amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', period: '.', sol: '/', bsol: '\\', colon: ':',
	commat: '@', comma: ',', semi: ';', excl: '!', quest: '?', num: '#', percnt: '%', equals: '=', plus: '+',
	lowbar: '_', hyphen: '-', dash: '-', lpar: '(', rpar: ')', lsqb: '[', rsqb: ']', lbrack: '[', rbrack: ']',
	lcub: '{', rcub: '}', lbrace: '{', rbrace: '}', middot: '·', bull: '•',
};

const PATTERNS = {
	scheme: new RegExp(`${START}\\p{L}[\\p{L}\\p{N}+.\\-]*:\\S+`, 'gu'),
	spelledDot: new RegExp(`[\\p{L}\\p{N}\\-]+\\s+dot\\s+(?:${TLDS})${END}\\S*`, 'giu'),
	spacedTld: new RegExp(`[\\p{L}\\p{N}\\-]+\\.\\s+(?:com|net|org|info|biz|xyz|io|ru|cn)${END}\\S*`, 'giu'),
	bareTld: new RegExp(`[\\p{L}\\p{N}\\-]+\\s+(?:com|xyz)${END}\\S*`, 'giu'),
	linkWord: new RegExp(`${START}(?:https?|www|ftp)${END}`, 'giu'),
};

function decodeOnce(text) {
	return text.replace(/&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z]{2,10});?/g, (whole, body) => {
		if (body[0] !== '#') {
			return Object.prototype.hasOwnProperty.call(NAMED, body) ? NAMED[body] : whole;
		}
		const hex = body[1] === 'x' || body[1] === 'X';
		const point = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
		if (!Number.isInteger(point) || point < 1 || point > 0x10FFFF || (point >= 0xD800 && point <= 0xDFFF)) {
			return ' ';
		}
		return String.fromCodePoint(point);
	});
}

function decode(text) {
	let current = text;
	for (let i = 0; i < 3; i += 1) {
		const next = decodeOnce(current);
		if (next === current) {
			break;
		}
		current = next;
	}
	return current;
}

function cut(text, max) {
	return Array.from(text).slice(0, max).join('');
}

function trimEdges(text) {
	return text.replace(/^[ '-]+|[ '-]+$/gu, '');
}

function safeWords(input, max) {
	if (typeof input !== 'string' && typeof input !== 'number') {
		return '';
	}

	// A cap first: the patterns below should never see a very long string.
	let text = decode(String(input).slice(0, 400));

	text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, ' ').replace(/<[^>]*>/gu, ' ');
	text = text.normalize('NFKC');

	// Line breaks become spaces; control, zero-width, direction and blank-looking characters go.
	text = text.replace(/[\r\n\t\u0085\u2028\u2029]+/gu, ' ');
	text = text.replace(/[\p{C}͏ᅟᅠ឴឵᠋-᠏⠀ㅤ︀-️ﾠ\u{10000}-\u{10FFFF}]+/gu, '');

	// Look-alikes of the characters that make up a link.
	text = text.replace(/[··׃۔܁܂।॥።᙮᠃᠉•․‧∙⋅⸳・。ꓸ꘎꛳︒﹒｡･]/gu, '.');
	text = text.replace(/[⁄∕⧸]/gu, '/');
	text = text.replace(/[∶꞉﹕]/gu, ':');
	text = text.replace(/﹫/gu, '@');
	text = text.replace(/[[({<]\s*(?:\.|dot)\s*[\])}>]/giu, '.');

	// Schemes, addresses, and any word with a dot or a double slash inside it.
	text = text.replace(PATTERNS.scheme, ' ');
	text = text.replace(/\S*@\S*/gu, ' ');
	text = text.replace(/\S*\/\/\S*/gu, ' ');
	text = text.replace(/\S*[\p{L}\p{N}]\.[\p{L}\p{N}]\S*/gu, ' ');

	// Domains written with spaces or spelled out.
	text = text.replace(/[\p{L}\p{N}-]+\s+\.\s*[\p{L}\p{N}-]+\S*/gu, ' ');
	text = text.replace(PATTERNS.spelledDot, ' ');
	text = text.replace(PATTERNS.spacedTld, ' ');
	text = text.replace(PATTERNS.bareTld, ' ');
	text = text.replace(PATTERNS.linkWord, ' ');

	// What is left: letters, their marks, spaces, apostrophes and hyphens.
	text = text.replace(/[^\p{L}\p{M} '-]+/gu, ' ');
	text = trimEdges(text.replace(/\s+/gu, ' '));
	text = trimEdges(cut(text, max));

	return Array.from(text).length >= 2 ? text : '';
}

function safeName(name) {
	return safeWords(name, 24);
}

// The forum's name comes from its administrator. It is only kept short and on one line.
function siteLabel(title, url) {
	let name = typeof title === 'string' ? decode(title) : '';
	name = name.replace(/<[^>]*>/gu, ' ').replace(/\p{C}+/gu, ' ').replace(/\s+/gu, ' ').trim();
	if (!name) {
		try {
			name = new URL(url).hostname;
		} catch (err) {
			name = 'Forum';
		}
	}
	return cut(name, 40).trim();
}

module.exports = { safeWords, safeName, siteLabel };
