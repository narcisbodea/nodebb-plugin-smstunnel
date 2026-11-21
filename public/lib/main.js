'use strict';

/* globals $, app, ajaxify, require */

// The panel on a member's own settings page. It holds no named field, so the page's own Save button ignores it.
(function () {
	const route = '/plugins/smstunnel/me';

	function show(root, state) {
		const panel = root.find('.smstunnel-member');
		const saved = state.state === 'on' || state.state === 'off';

		panel.attr('data-state', state.state);
		panel.find('[data-step="number"]').toggleClass('d-none', saved);
		panel.find('[data-step="code"]').toggleClass('d-none', saved || !state.waiting);
		panel.find('[data-step="saved"]').toggleClass('d-none', !saved);
		panel.find('[data-field="number"]').text(state.number || '');
		panel.find('[data-field="on"], [data-action="off"]').toggleClass('d-none', state.state !== 'on');
		panel.find('[data-field="off"], [data-action="on"]').toggleClass('d-none', state.state !== 'off');
	}

	function bind(root, api, alerts, bootbox) {
		function run(request, successKey) {
			request.then((state) => {
				show(root, state);
				if (successKey) {
					alerts.success(`[[smstunnel:member.${successKey}]]`);
				}
			}).catch(alerts.error);
		}

		root.on('keydown', 'input', (ev) => {
			if (ev.key === 'Enter') {
				ev.preventDefault();
			}
		});

		root.on('click', '[data-action]', function () {
			const action = this.getAttribute('data-action');

			if (action === 'send') {
				run(api.post(`${route}/code`, { phone: root.find('#smstunnel-phone').val() }), 'code-sent');
			} else if (action === 'confirm') {
				run(api.post(`${route}/confirm`, { code: root.find('#smstunnel-code').val() }), 'confirmed');
			} else if (action === 'on' || action === 'off') {
				run(api.put(`${route}/state`, { state: action }), action === 'on' ? 'now-on' : 'now-off');
			} else if (action === 'remove') {
				bootbox.confirm('[[smstunnel:member.remove-confirm]]', (yes) => {
					if (yes) {
						run(api.del(route, {}), 'removed');
					}
				});
			}
		});
	}

	function mount(api, alerts, bootbox) {
		const root = $('#smstunnel-member-panel');
		if (!root.length || root.attr('data-ready')) {
			return;
		}
		root.attr('data-ready', '1');

		// Only ever on your own page. The server doesn't add the panel to anyone else's either.
		if (!ajaxify.data.isSelf) {
			root.remove();
			return;
		}

		api.get(route, {}).then(state => app.parseAndTranslate('partials/smstunnel/member-panel', state).then((html) => {
			root.empty().append(html);
			bind(root, api, alerts, bootbox);
			show(root, state);
		})).catch(alerts.error);
	}

	require(['hooks', 'api', 'alerts', 'bootbox'], (hooks, api, alerts, bootbox) => {
		hooks.on('action:ajaxify.end', () => mount(api, alerts, bootbox));
		mount(api, alerts, bootbox);
	});
}());
