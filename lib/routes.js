'use strict';

const core = require('./core');
const settings = require('./settings');
const members = require('./members');
const staff = require('./staff');

async function requireAdministrator(req, res, next) {
	let allowed = false;
	try {
		allowed = await core.user.isAdministrator(req.uid);
	} catch (err) {
		allowed = false;
	}
	if (allowed) {
		return next();
	}
	return core.apiHelpers.formatApiResponse(403, res);
}

async function requireMemberTexts(req, res, next) {
	let open = false;
	try {
		open = settings.membersOn(await settings.get());
	} catch (err) {
		return next(err);
	}
	if (open) {
		return next();
	}
	return core.apiHelpers.formatApiResponse(404, res);
}

// A member's number is set from their own signed-in browser. A token can act for any user (a master token takes a
// user id), and that would let someone other than the member turn texts on for them.
function sessionOnly(req, res, next) {
	if (req.headers.authorization) {
		return core.apiHelpers.formatApiResponse(403, res);
	}
	return next();
}

async function adminView() {
	const [values, hasKey, numbers, problem] = await Promise.all([
		settings.get(),
		settings.hasApiKey(),
		staff.view(),
		settings.lastProblem(),
	]);
	return {
		settings: values,
		hasKey,
		keyFromConfig: !!settings.keyFromConfig(),
		staff: numbers,
		maxStaff: staff.MAX_STAFF,
		problem,
	};
}

function add(router, middleware) {
	const { routeHelpers, apiHelpers } = core;
	const ok = (res, payload) => apiHelpers.formatApiResponse(200, res, payload);

	const member = [sessionOnly, middleware.ensureLoggedIn, requireMemberTexts];
	const admin = [middleware.ensureLoggedIn, middleware.admin.checkPrivileges, requireAdministrator];

	// The signed-in member, and only them. No route here takes a user id.
	routeHelpers.setupApiRoute(router, 'get', '/smstunnel/me', member, async (req, res) => {
		ok(res, await members.status(req.uid));
	});
	routeHelpers.setupApiRoute(router, 'post', '/smstunnel/me/code', member, async (req, res) => {
		if (!await settings.hasApiKey()) {
			throw new Error('[[smstunnel:error.code-not-sent]]');
		}
		await members.requestCode(req.uid, req.body && req.body.phone, req.ip);
		ok(res, await members.status(req.uid));
	});
	routeHelpers.setupApiRoute(router, 'post', '/smstunnel/me/confirm', member, async (req, res) => {
		await members.confirm(req.uid, req.body && req.body.code);
		ok(res, await members.status(req.uid));
	});
	routeHelpers.setupApiRoute(router, 'put', '/smstunnel/me/state', member, async (req, res) => {
		await members.setState(req.uid, req.body && req.body.state);
		ok(res, await members.status(req.uid));
	});
	// Stopping must keep working after the forum turns the feature off.
	routeHelpers.setupApiRoute(router, 'delete', '/smstunnel/me', [sessionOnly, middleware.ensureLoggedIn], async (req, res) => {
		await members.forget(req.uid);
		ok(res, { state: 'none', number: '', waiting: false });
	});

	routeHelpers.setupApiRoute(router, 'get', '/smstunnel/admin', admin, async (req, res) => {
		ok(res, await adminView());
	});
	routeHelpers.setupApiRoute(router, 'put', '/smstunnel/admin', admin, async (req, res) => {
		const body = req.body || {};
		await settings.save(body);
		if (body.clearKey === true || body.clearKey === 'true') {
			await settings.clearApiKey();
		} else if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
			const key = body.apiKey.trim();
			if (key.length > 200 || /[^\x21-\x7E]/.test(key)) {
				throw new Error('[[smstunnel:error.bad-key]]');
			}
			await settings.setApiKey(key);
		}
		ok(res, await adminView());
	});
	routeHelpers.setupApiRoute(router, 'post', '/smstunnel/admin/staff', admin, async (req, res) => {
		const body = req.body || {};
		await staff.add(body.phone, body.label, req.ip);
		ok(res, await adminView());
	});
	routeHelpers.setupApiRoute(router, 'post', '/smstunnel/admin/staff/:id/code', admin, async (req, res) => {
		await staff.resend(req.params.id, req.ip);
		ok(res, await adminView());
	});
	routeHelpers.setupApiRoute(router, 'post', '/smstunnel/admin/staff/:id/confirm', admin, async (req, res) => {
		await staff.confirm(req.params.id, req.body && req.body.code);
		ok(res, await adminView());
	});
	routeHelpers.setupApiRoute(router, 'post', '/smstunnel/admin/staff/:id/test', admin, async (req, res) => {
		await staff.sendTest(req.params.id);
		ok(res, await adminView());
	});
	routeHelpers.setupApiRoute(router, 'delete', '/smstunnel/admin/staff/:id', admin, async (req, res) => {
		await staff.remove(req.params.id);
		ok(res, await adminView());
	});
}

module.exports = { add };
