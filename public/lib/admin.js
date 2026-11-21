'use strict';

/* globals $, define */

define('admin/plugins/smstunnel', ['api', 'alerts', 'translator', 'bootbox'], (api, alerts, translator, bootbox) => {
	const ACP = {};
	const route = '/plugins/smstunnel/admin';

	function renderProblem(problem) {
		const box = $('#smstunnel-problem');
		if (!problem) {
			box.addClass('d-none');
			return;
		}
		translator.translate(`[[smstunnel:acp.problem.${problem.reason}]]`, (text) => {
			const when = problem.at ? ` (${new Date(problem.at).toLocaleString()})` : '';
			box.find('[data-field="problem"]').text(`${text}${when}`);
			box.removeClass('d-none');
		});
	}

	function renderStaff(rows) {
		const list = $('#smstunnel-staff').empty();
		const template = document.getElementById('smstunnel-staff-row');
		$('#smstunnel-staff-none').toggleClass('d-none', rows.length > 0);

		rows.forEach((row) => {
			const item = $(template.content.cloneNode(true)).children('[data-row]');
			item.attr('data-id', row.id);
			// Set as text, never as HTML.
			item.find('[data-field="number"]').text(row.number);
			item.find('[data-field="label"]').text(row.label);
			item.find('[data-field="confirmed"], [data-do="test"]').toggleClass('d-none', !row.confirmed);
			item.find('[data-field="waiting"], [data-field="code"], [data-do="confirm"], [data-do="code"]')
				.toggleClass('d-none', row.confirmed);
			list.append(item);
		});
	}

	function render(view) {
		const { settings } = view;
		$('[data-switch]').each(function () {
			this.checked = settings[this.getAttribute('data-switch')] === 'on';
		});
		$('[data-number]').each(function () {
			this.value = settings[this.getAttribute('data-number')];
		});
		$('#smstunnel-key').val('');
		$('#smstunnel-clear-key').prop('checked', false);
		$('[data-field="key-saved"]').toggleClass('d-none', !view.hasKey || view.keyFromConfig);
		$('[data-field="key-config"]').toggleClass('d-none', !view.keyFromConfig);
		$('[data-field="key-clear"]').toggleClass('d-none', !view.hasKey || view.keyFromConfig);
		renderStaff(view.staff);
		renderProblem(view.problem);
	}

	function collect() {
		const body = {};
		$('[data-switch]').each(function () {
			body[this.getAttribute('data-switch')] = this.checked ? 'on' : 'off';
		});
		$('[data-number]').each(function () {
			body[this.getAttribute('data-number')] = this.value;
		});
		const key = $('#smstunnel-key').val();
		if (key) {
			body.apiKey = key;
		}
		if ($('#smstunnel-clear-key').prop('checked')) {
			body.clearKey = true;
		}
		return body;
	}

	function run(request, successKey) {
		return request.then((view) => {
			render(view);
			if (successKey) {
				alerts.success(`[[smstunnel:acp.${successKey}]]`);
			}
		}).catch(alerts.error);
	}

	ACP.init = () => {
		run(api.get(route, {}));

		$('#save').on('click', (ev) => {
			ev.preventDefault();
			run(api.put(route, collect()), 'saved');
		});

		$('#smstunnel-settings').on('submit', ev => ev.preventDefault());

		$('#smstunnel-staff-add').on('click', () => {
			run(api.post(`${route}/staff`, {
				phone: $('#smstunnel-staff-phone').val(),
				label: $('#smstunnel-staff-label').val(),
			}), 'code-sent').then(() => {
				$('#smstunnel-staff-phone, #smstunnel-staff-label').val('');
			});
		});

		$('#smstunnel-erase').on('click', () => {
			translator.translate('[[smstunnel:acp.erase-confirm]]', (question) => {
				translator.translate('[[smstunnel:acp.erase-button]]', (label) => {
					bootbox.confirm({
						message: question,
						buttons: { confirm: { label, className: 'btn-danger' } },
						callback: (yes) => {
							if (!yes) {
								return;
							}
							api.post(`${route}/erase-numbers`, { confirm: 'erase-all-numbers' }).then((view) => {
								render(view);
								const { members, staff, pending } = view.erased;
								alerts.success(`[[smstunnel:acp.erased, ${members}, ${staff}, ${pending}]]`);
							}).catch(alerts.error);
						},
					});
				});
			});
		});

		$('#smstunnel-staff').on('click', '[data-do]', function () {
			const item = $(this).closest('[data-row]');
			const id = encodeURIComponent(item.attr('data-id'));
			const action = this.getAttribute('data-do');

			if (action === 'confirm') {
				run(api.post(`${route}/staff/${id}/confirm`, { code: item.find('[data-field="code"]').val() }));
			} else if (action === 'code') {
				run(api.post(`${route}/staff/${id}/code`, {}), 'code-sent');
			} else if (action === 'test') {
				run(api.post(`${route}/staff/${id}/test`, {}), 'test-sent');
			} else if (action === 'remove') {
				run(api.del(`${route}/staff/${id}`, {}));
			}
		});
	};

	return ACP;
});
