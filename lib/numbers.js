'use strict';

const crypto = require('crypto');

const E164 = /^\+[1-9][0-9]{6,14}$/;

const CODE_TTL = 10 * 60 * 1000;
const CODE_TRIES = 5;
const RESEND_AFTER = 60 * 1000;

function isNumber(value) {
	return typeof value === 'string' && E164.test(value);
}

// One number as typed. Spaces, dashes, dots and brackets are forgiven; a list or a number without + is not.
function readNumber(raw) {
	if (typeof raw !== 'string' || raw.length > 32) {
		return '';
	}
	const number = raw.trim().replace(/[\s().-]/g, '');
	return isNumber(number) ? number : '';
}

function mask(number) {
	const text = String(number || '');
	if (text.length < 7) {
		return '****';
	}
	return `${text.slice(0, 4)}${'*'.repeat(text.length - 6)}${text.slice(-2)}`;
}

function newCode() {
	return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(secret, owner, number, code) {
	return crypto.createHmac('sha256', String(secret)).update(`${owner}|${number}|${code}`).digest('hex');
}

function sameHash(a, b) {
	const left = Buffer.from(String(a));
	const right = Buffer.from(String(b));
	return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function readCode(raw) {
	const code = String(raw === undefined || raw === null ? '' : raw).replace(/\D+/g, '');
	return code.length === 6 ? code : '';
}

module.exports = {
	CODE_TTL, CODE_TRIES, RESEND_AFTER, isNumber, readNumber, mask, newCode, hashCode, sameHash, readCode,
};
