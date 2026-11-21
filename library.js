'use strict';

const core = require('./lib/core');
const settings = require('./lib/settings');
const members = require('./lib/members');
const sender = require('./lib/sender');
const routes = require('./lib/routes');

const Plugin = module.exports;

// Hooks must never hold up or break what the forum is doing, so the work runs after the hook has returned.
function later(where, work) {
	setImmediate(() => {
		Promise.resolve().then(work).catch(err => core.logProblem(where, err));
	});
}

Plugin.init = async ({ router }) => {
	core.routeHelpers.setupAdminPageRoute(router, '/admin/plugins/smstunnel', (req, res) => {
		res.render('admin/plugins/smstunnel', { title: 'SMSTunnel' });
	});
	sender.start();
};

Plugin.addRoutes = async ({ router, middleware }) => {
	routes.add(router, middleware);
};

Plugin.addAdminNavigation = async (header) => {
	header.plugins.push({ route: '/plugins/smstunnel', icon: 'fa-commenting', name: 'SMSTunnel' });
	return header;
};

// The hook gets the viewer in `uid` and the page's owner in `settings.uid`: an administrator looking at someone
// else's settings doesn't get the panel.
Plugin.addMemberPanel = async (data) => {
	try {
		const values = await settings.get();
		const viewer = parseInt(data.uid, 10);
		if (settings.membersOn(values) && viewer > 0 && viewer === parseInt(data.settings && data.settings.uid, 10)) {
			data.customSettings.push({
				title: '[[smstunnel:member.title]]',
				content: '<div id="smstunnel-member-panel"></div>',
			});
		}
	} catch (err) {
		core.logProblem('member panel', err);
	}
	return data;
};

Plugin.onNotificationPushed = (data) => {
	later('notification', () => sender.onNotification(data));
};

Plugin.onFlagCreated = (data) => {
	if (data && data.flag && data.flag.type === 'post') {
		later('flag alert', () => sender.onStaffEvent('flagged'));
	}
};

Plugin.onPostQueued = () => {
	later('queue alert', () => sender.onStaffEvent('queued'));
};

Plugin.onUserDeleted = (data) => {
	const uid = parseInt(data && data.uid, 10);
	if (uid > 0) {
		later('account removal', () => members.forget(uid));
	}
};
