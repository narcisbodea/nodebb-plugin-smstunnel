<div class="acp-page-container">
	<!-- IMPORT admin/partials/settings/header.tpl -->

	<div class="row m-0">
		<div class="col-12 col-md-8 px-0 mb-4" id="spy-container" tabindex="0">
			<div id="smstunnel-problem" class="alert alert-warning d-none" role="status">
				<strong>{{tx("smstunnel:acp.problem")}}:</strong> <span data-field="problem"></span>
			</div>

			<form id="smstunnel-settings" role="form" autocomplete="off">
				<h5 class="fw-bold tracking-tight">{{tx("smstunnel:acp.connection")}}</h5>
				<div class="form-check form-switch mb-2">
					<input class="form-check-input" type="checkbox" id="smstunnel-enabled" data-switch="enabled">
					<label class="form-check-label" for="smstunnel-enabled">{{tx("smstunnel:acp.enabled")}}</label>
				</div>
				<p class="form-text">{{tx("smstunnel:acp.enabled-help")}}</p>
				<div class="mb-3">
					<label class="form-label" for="smstunnel-key">{{tx("smstunnel:acp.key")}}</label>
					<input class="form-control" type="password" id="smstunnel-key" autocomplete="new-password" spellcheck="false">
					<p class="form-text mb-1">{{tx("smstunnel:acp.key-help")}}</p>
					<p class="form-text mb-1 d-none" data-field="key-saved">{{tx("smstunnel:acp.key-saved")}}</p>
					<p class="form-text mb-1 d-none" data-field="key-config">{{tx("smstunnel:acp.key-config")}}</p>
					<div class="form-check d-none" data-field="key-clear">
						<input class="form-check-input" type="checkbox" id="smstunnel-clear-key">
						<label class="form-check-label" for="smstunnel-clear-key">{{tx("smstunnel:acp.key-clear")}}</label>
					</div>
				</div>

				<hr />
				<h5 class="fw-bold tracking-tight">{{tx("smstunnel:acp.alerts")}}</h5>
				<div class="form-check form-switch mb-2">
					<input class="form-check-input" type="checkbox" id="smstunnel-alerts" data-switch="alerts">
					<label class="form-check-label" for="smstunnel-alerts">{{tx("smstunnel:acp.alerts-on")}}</label>
				</div>
				<div class="form-check mb-1">
					<input class="form-check-input" type="checkbox" id="smstunnel-alert-flags" data-switch="alertFlags">
					<label class="form-check-label" for="smstunnel-alert-flags">{{tx("smstunnel:acp.alert-flags")}}</label>
				</div>
				<div class="form-check mb-2">
					<input class="form-check-input" type="checkbox" id="smstunnel-alert-queue" data-switch="alertQueue">
					<label class="form-check-label" for="smstunnel-alert-queue">{{tx("smstunnel:acp.alert-queue")}}</label>
				</div>
				<p class="form-text">{{tx("smstunnel:acp.alerts-help")}}</p>

				<hr />
				<h5 class="fw-bold tracking-tight">{{tx("smstunnel:acp.members")}}</h5>
				<div class="form-check form-switch mb-2">
					<input class="form-check-input" type="checkbox" id="smstunnel-members" data-switch="memberTexts">
					<label class="form-check-label" for="smstunnel-members">{{tx("smstunnel:acp.members-on")}}</label>
				</div>
				<p class="form-text">{{tx("smstunnel:acp.members-help")}}</p>
				<div class="row g-3 mb-3">
					<div class="col-sm-4">
						<label class="form-label" for="smstunnel-member-hour">{{tx("smstunnel:acp.member-hour")}}</label>
						<input class="form-control" type="number" min="1" max="10" id="smstunnel-member-hour" data-number="memberHour">
					</div>
					<div class="col-sm-4">
						<label class="form-label" for="smstunnel-member-day">{{tx("smstunnel:acp.member-day")}}</label>
						<input class="form-control" type="number" min="1" max="20" id="smstunnel-member-day" data-number="memberDay">
					</div>
					<div class="col-sm-4">
						<label class="form-label" for="smstunnel-forum-day">{{tx("smstunnel:acp.forum-day")}}</label>
						<input class="form-control" type="number" min="1" max="500" id="smstunnel-forum-day" data-number="forumDay">
					</div>
				</div>
			</form>

			<hr />
			<h5 class="fw-bold tracking-tight">{{tx("smstunnel:acp.staff")}}</h5>
			<p class="form-text">{{tx("smstunnel:acp.staff-help")}}</p>
			<div id="smstunnel-staff" class="d-flex flex-column gap-2 mb-3"></div>
			<p id="smstunnel-staff-none" class="text-secondary d-none">{{tx("smstunnel:acp.staff-none")}}</p>
			<div class="row g-2 align-items-end">
				<div class="col-sm-5">
					<label class="form-label" for="smstunnel-staff-phone">{{tx("smstunnel:acp.staff-number")}}</label>
					<input class="form-control" type="tel" id="smstunnel-staff-phone" maxlength="24" placeholder="+40712345678" autocomplete="off">
				</div>
				<div class="col-sm-4">
					<label class="form-label" for="smstunnel-staff-label">{{tx("smstunnel:acp.staff-label")}}</label>
					<input class="form-control" type="text" id="smstunnel-staff-label" maxlength="40" autocomplete="off">
				</div>
				<div class="col-sm-3">
					<button type="button" class="btn btn-primary w-100" id="smstunnel-staff-add">{{tx("smstunnel:acp.staff-add")}}</button>
				</div>
			</div>

			<template id="smstunnel-staff-row">
				<div class="border rounded p-2 d-flex flex-wrap align-items-center gap-2" data-row>
					<span class="fw-semibold" data-field="number"></span>
					<span class="text-secondary" data-field="label"></span>
					<span class="badge text-bg-success d-none" data-field="confirmed">{{tx("smstunnel:acp.staff-confirmed")}}</span>
					<span class="badge text-bg-secondary d-none" data-field="waiting">{{tx("smstunnel:acp.staff-waiting")}}</span>
					<span class="ms-auto d-flex flex-wrap align-items-center gap-2">
						<input class="form-control form-control-sm d-none" style="width: 7rem" type="text" inputmode="numeric" maxlength="6" placeholder="{{tx("smstunnel:acp.staff-code")}}" data-field="code">
						<button type="button" class="btn btn-sm btn-primary d-none" data-do="confirm">{{tx("smstunnel:acp.staff-confirm")}}</button>
						<button type="button" class="btn btn-sm btn-outline-secondary d-none" data-do="code">{{tx("smstunnel:acp.staff-resend")}}</button>
						<button type="button" class="btn btn-sm btn-outline-primary d-none" data-do="test">{{tx("smstunnel:acp.staff-test")}}</button>
						<button type="button" class="btn btn-sm btn-link text-danger" data-do="remove">{{tx("smstunnel:acp.staff-remove")}}</button>
					</span>
				</div>
			</template>
		</div>
	</div>
</div>
