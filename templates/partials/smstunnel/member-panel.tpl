<div class="smstunnel-member d-flex flex-column gap-2" data-state="{state}">
	<p class="form-text mb-1">[[smstunnel:member.intro]]</p>

	<div data-step="number" class="d-flex flex-column gap-2">
		<label class="form-label mb-0" for="smstunnel-phone">[[smstunnel:member.phone]]</label>
		<input id="smstunnel-phone" type="tel" class="form-control" autocomplete="tel" maxlength="24" placeholder="+40712345678" />
		<div><button type="button" class="btn btn-sm btn-primary" data-action="send">[[smstunnel:member.send]]</button></div>
	</div>

	<div data-step="code" class="d-flex flex-column gap-2">
		<label class="form-label mb-0" for="smstunnel-code">[[smstunnel:member.code]]</label>
		<input id="smstunnel-code" type="text" class="form-control" inputmode="numeric" autocomplete="one-time-code" maxlength="6" />
		<div><button type="button" class="btn btn-sm btn-primary" data-action="confirm">[[smstunnel:member.confirm]]</button></div>
	</div>

	<div data-step="saved" class="d-flex flex-column gap-2">
		<div><span data-field="number" class="fw-semibold"></span> <span data-field="on" class="badge text-bg-success">[[smstunnel:member.on]]</span><span data-field="off" class="badge text-bg-secondary">[[smstunnel:member.off]]</span></div>
		<div class="d-flex flex-wrap gap-2">
			<button type="button" class="btn btn-sm btn-outline-secondary" data-action="off">[[smstunnel:member.turn-off]]</button>
			<button type="button" class="btn btn-sm btn-primary" data-action="on">[[smstunnel:member.turn-on]]</button>
			<button type="button" class="btn btn-sm btn-link text-danger" data-action="remove">[[smstunnel:member.remove]]</button>
		</div>
	</div>
</div>
