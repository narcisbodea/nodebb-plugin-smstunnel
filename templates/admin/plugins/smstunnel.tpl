<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div class="col-12 col-md-8 px-0 mb-4" id="spy-container" tabindex="0">
			<div id="smstunnel-problem" class="alert alert-warning d-none" role="status">
				<strong>[[smstunnel:acp.problem]]:</strong> <span data-field="problem"></span>
			</div>

			<form id="smstunnel-settings" role="form" autocomplete="off">
				<h5 class="fw-bold tracking-tight">[[smstunnel:acp.connection]]</h5>
				<div class="form-check form-switch mb-2">
					<input class="form-check-input" type="checkbox" id="smstunnel-enabled" data-switch="enabled">
					<label class="form-check-label" for="smstunnel-enabled">[[smstunnel:acp.enabled]]</label>
				</div>
				<p class="form-text">[[smstunnel:acp.enabled-help]]</p>
				<div class="mb-3">
					<label class="form-label" for="smstunnel-key">[[smstunnel:acp.key]]</label>
					<input class="form-control" type="password" id="smstunnel-key" autocomplete="new-password" spellcheck="false">
					<p class="form-text mb-1">[[smstunnel:acp.key-help]]</p>
					<p class="form-text mb-1 d-none" data-field="key-saved">[[smstunnel:acp.key-saved]]</p>
					<p class="form-text mb-1 d-none" data-field="key-config">[[smstunnel:acp.key-config]]</p>
					<div class="form-check d-none" data-field="key-clear">
						<input class="form-check-input" type="checkbox" id="smstunnel-clear-key">
						<label class="form-check-label" for="smstunnel-clear-key">[[smstunnel:acp.key-clear]]</label>
					</div>
				</div>

				<hr />
				<h5 class="fw-bold tracking-tight">[[smstunnel:acp.alerts]]</h5>
				<div class="form-check form-switch mb-2">
					<input class="form-check-input" type="checkbox" id="smstunnel-alerts" data-switch="alerts">
					<label class="form-check-label" for="smstunnel-alerts">[[smstunnel:acp.alerts-on]]</label>
				</div>
				<div class="form-check mb-1">
					<input class="form-check-input" type="checkbox" id="smstunnel-alert-flags" data-switch="alertFlags">
					<label class="form-check-label" for="smstunnel-alert-flags">[[smstunnel:acp.alert-flags]]</label>
				</div>
				<div class="form-check mb-2">
					<input class="form-check-input" type="checkbox" id="smstunnel-alert-queue" data-switch="alertQueue">
					<label class="form-check-label" for="smstunnel-alert-queue">[[smstunnel:acp.alert-queue]]</label>
				</div>
				<p class="form-text">[[smstunnel:acp.alerts-help]]</p>

				<hr />
				<h5 class="fw-bold tracking-tight">[[smstunnel:acp.members]]</h5>
				<div class="form-check form-switch mb-2">
					<input class="form-check-input" type="checkbox" id="smstunnel-members" data-switch="memberTexts">
					<label class="form-check-label" for="smstunnel-members">[[smstunnel:acp.members-on]]</label>
				</div>
				<p class="form-text">[[smstunnel:acp.members-help]]</p>
				<div class="row g-3 mb-3">
					<div class="col-sm-4">
						<label class="form-label" for="smstunnel-member-hour">[[smstunnel:acp.member-hour]]</label>
						<input class="form-control" type="number" min="1" max="10" id="smstunnel-member-hour" data-number="memberHour">
					</div>
					<div class="col-sm-4">
						<label class="form-label" for="smstunnel-member-day">[[smstunnel:acp.member-day]]</label>
						<input class="form-control" type="number" min="1" max="20" id="smstunnel-member-day" data-number="memberDay">
					</div>
					<div class="col-sm-4">
						<label class="form-label" for="smstunnel-forum-day">[[smstunnel:acp.forum-day]]</label>
						<input class="form-control" type="number" min="1" max="500" id="smstunnel-forum-day" data-number="forumDay">
					</div>
				</div>
			</form>

			<hr />
			<h5 class="fw-bold tracking-tight">[[smstunnel:acp.staff]]</h5>
			<p class="form-text">[[smstunnel:acp.staff-help]]</p>
			<div id="smstunnel-staff" class="d-flex flex-column gap-2 mb-3"></div>
			<p id="smstunnel-staff-none" class="text-secondary d-none">[[smstunnel:acp.staff-none]]</p>
			<div class="row g-2 align-items-end">
				<div class="col-sm-5">
					<label class="form-label" for="smstunnel-staff-phone">[[smstunnel:acp.staff-number]]</label>
					<input class="form-control" type="tel" id="smstunnel-staff-phone" maxlength="24" placeholder="+40712345678" autocomplete="off">
				</div>
				<div class="col-sm-4">
					<label class="form-label" for="smstunnel-staff-label">[[smstunnel:acp.staff-label]]</label>
					<input class="form-control" type="text" id="smstunnel-staff-label" maxlength="40" autocomplete="off">
				</div>
				<div class="col-sm-3">
					<button type="button" class="btn btn-primary w-100" id="smstunnel-staff-add">[[smstunnel:acp.staff-add]]</button>
				</div>
			</div>

			<template id="smstunnel-staff-row">
				<div class="border rounded p-2 d-flex flex-wrap align-items-center gap-2" data-row>
					<span class="fw-semibold" data-field="number"></span>
					<span class="text-secondary" data-field="label"></span>
					<span class="badge text-bg-success d-none" data-field="confirmed">[[smstunnel:acp.staff-confirmed]]</span>
					<span class="badge text-bg-secondary d-none" data-field="waiting">[[smstunnel:acp.staff-waiting]]</span>
					<span class="ms-auto d-flex flex-wrap align-items-center gap-2">
						<input class="form-control form-control-sm d-none" style="width: 7rem" type="text" inputmode="numeric" maxlength="6" placeholder="[[smstunnel:acp.staff-code]]" data-field="code">
						<button type="button" class="btn btn-sm btn-primary d-none" data-do="confirm">[[smstunnel:acp.staff-confirm]]</button>
						<button type="button" class="btn btn-sm btn-outline-secondary d-none" data-do="code">[[smstunnel:acp.staff-resend]]</button>
						<button type="button" class="btn btn-sm btn-outline-primary d-none" data-do="test">[[smstunnel:acp.staff-test]]</button>
						<button type="button" class="btn btn-sm btn-link text-danger" data-do="remove">[[smstunnel:acp.staff-remove]]</button>
					</span>
				</div>
			</template>
		</div>
	</div>
</div>
