const CLASS_DIALOG_ACTIVE = 'dialogActive';
const CLASS_DIALOG_INPUT_INVALID = 'inputInvalid';
const CLASS_DIALOG_NO_INPUT = 'noInput';

const enum DialogType {
	Form,
	ActionRunning,
	Message
}

class Dialog {
	private elem: HTMLElement | null = null;
	private source: HTMLElement | null = null;
	private actioned: (() => void) | null = null;
	private type: DialogType | null = null;

	public showConfirmation(message: string, confirmed: () => void, sourceElem: HTMLElement | null) {
		this.show(DialogType.Form, message, 'Yes', 'No', () => {
			this.close();
			confirmed();
		}, null, sourceElem);
	}

	public showTwoButtons(message: string, buttonLabel1: string, buttonAction1: () => void, buttonLabel2: string, buttonAction2: () => void, sourceElem: HTMLElement | null) {
		this.show(DialogType.Form, message, buttonLabel1, buttonLabel2, () => {
			this.close();
			buttonAction1();
		}, () => {
			this.close();
			buttonAction2();
		}, sourceElem);
	}

	public showRefInput(message: string, defaultValue: string, actionName: string, actioned: (value: string) => void, sourceElem: HTMLElement | null) {
		this.showForm(message, [{ type: 'text-ref', name: '', default: defaultValue }], actionName, values => actioned(values[0]), sourceElem);
	}

	public showCheckbox(message: string, checkboxLabel: string, checkboxValue: boolean, actionName: string, actioned: (value: boolean) => void, sourceElem: HTMLElement | null) {
		this.showForm(message, [{ type: 'checkbox', name: checkboxLabel, value: checkboxValue }], actionName, values => actioned(values[0] === 'checked'), sourceElem);
	}

	public showSelect(message: string, defaultValue: string, options: DialogSelectInputOption[], actionName: string, actioned: (value: string) => void, sourceElem: HTMLElement | null) {
		this.showForm(message, [{ type: 'select', name: '', options: options, default: defaultValue }], actionName, values => actioned(values[0]), sourceElem);
	}

	public showForm(message: string, inputs: DialogInput[], actionName: string, actioned: (values: string[]) => void, sourceElem: HTMLElement | null) {
		let textRefInput = -1, multiElement = inputs.length > 1;
		let multiCheckbox = multiElement, infoColumn = false;

		if (multiElement) { // If has multiple elements, then check if they are all checkboxes. If so, then the form is a checkbox multi
			for (let i = 0; i < inputs.length; i++) {
				if (inputs[i].type !== 'checkbox') {
					multiCheckbox = false;
					break;
				}
			}
		}
		for (let i = 0; i < inputs.length; i++) {
			if (inputs[i].info && inputs[i].type !== 'checkbox') {
				infoColumn = true;
				break;
			}
		}

		let html = message + '<br><table class="dialogForm ' + (multiElement ? multiCheckbox ? 'multiCheckbox' : 'multi' : 'single') + '">';
		for (let i = 0; i < inputs.length; i++) {
			const input = inputs[i], infoHtml = input.info ? '<span class="dialogInfo" title="' + escapeHtml(input.info) + '">' + SVG_ICONS.info + '</span>' : '';
			html += '<tr>' + (multiElement && !multiCheckbox ? '<td>' + input.name + ': </td>' : '');
			if (input.type === 'select') {
				html += '<td class="inputCol"><select id="dialogInput' + i + '">';
				for (let j = 0; j < input.options.length; j++) {
					html += '<option value="' + escapeHtml(input.options[j].value) + '"' + (input.options[j].value === input.default ? ' selected' : '') + '>' + escapeHtml(input.options[j].name) + '</option>';
				}
				html += '</select></td>' + (infoColumn ? '<td>' + infoHtml + '</td>' : '');
			} else if (input.type === 'checkbox') {
				html += '<td class="inputCol"' + (infoColumn ? ' colspan="2"' : '') + '><span class="dialogFormCheckbox"><label><input id="dialogInput' + i + '" type="checkbox"' + (input.value ? ' checked' : '') + '/><span class="customCheckbox"></span>' + (multiElement && !multiCheckbox ? '' : input.name) + infoHtml + '</label></span></td>';
			} else {
				html += '<td class="inputCol"><input id="dialogInput' + i + '" type="text" value="' + escapeHtml(input.default) + '"' + (input.type === 'text' && input.placeholder !== null ? ' placeholder="' + escapeHtml(input.placeholder) + '"' : '') + '/></td>' + (infoColumn ? '<td>' + infoHtml + '</td>' : '');
				if (input.type === 'text-ref') textRefInput = i;
			}
			html += '</tr>';
		}
		html += '</table>';

		this.show(DialogType.Form, html, actionName, 'Cancel', () => {
			if (this.elem === null || this.elem.classList.contains(CLASS_DIALOG_NO_INPUT) || this.elem.classList.contains(CLASS_DIALOG_INPUT_INVALID)) return;
			let values = [];
			for (let i = 0; i < inputs.length; i++) {
				let input = inputs[i], elem = document.getElementById('dialogInput' + i);
				if (input.type === 'select') {
					values.push((<HTMLSelectElement>elem).value);
				} else if (input.type === 'checkbox') {
					values.push((<HTMLInputElement>elem).checked ? 'checked' : 'unchecked');
				} else {
					values.push((<HTMLInputElement>elem).value);
				}
			}
			this.close();
			actioned(values);
		}, null, sourceElem);

		if (textRefInput > -1) {
			let dialogInput = <HTMLInputElement>document.getElementById('dialogInput' + textRefInput), dialogAction = document.getElementById('dialogAction')!;
			if (dialogInput.value === '') this.elem!.classList.add(CLASS_DIALOG_NO_INPUT);
			dialogInput.addEventListener('keyup', () => {
				if (this.elem === null) return;
				let noInput = dialogInput.value === '', invalidInput = dialogInput.value.match(REF_INVALID_REGEX) !== null;
				alterClass(this.elem, CLASS_DIALOG_NO_INPUT, noInput);
				if (alterClass(this.elem, CLASS_DIALOG_INPUT_INVALID, !noInput && invalidInput)) {
					dialogAction.title = invalidInput ? 'Unable to ' + actionName + ', one or more invalid characters entered.' : '';
				}
			});
		}

		if (inputs.length > 0 && (inputs[0].type === 'text' || inputs[0].type === 'text-ref')) {
			// If the first input is a text field, set focus to it.
			(<HTMLInputElement>document.getElementById('dialogInput0')).focus();
		}
	}

	public showMessage(html: string) {
		this.show(DialogType.Message, html, null, 'Close', null, null, null);
	}

	public showError(message: string, reason: string | null, actionName: string | null, actioned: (() => void) | null, sourceElem: HTMLElement | null) {
		this.show(DialogType.Message, '<span class="dialogAlert">' + SVG_ICONS.alert + 'Error: ' + message + '</span>' + (reason !== null ? '<br><span class="messageContent errorContent">' + escapeHtml(reason).split('\n').join('<br>') + '</span>' : ''), actionName, 'Dismiss', actioned, null, sourceElem);
	}

	public showActionRunning(action: string) {
		this.show(DialogType.ActionRunning, '<span class="actionRunning">' + SVG_ICONS.loading + action + ' ...</span>', null, 'Dismiss', null, null, null);
	}

	private show(type: DialogType, html: string, actionName: string | null, dismissName: string, actioned: (() => void) | null, dismissed: (() => void) | null, sourceElem: HTMLElement | null) {
		closeDialogAndContextMenu();

		this.type = type;
		eventOverlay.create('dialogBacking', null, null);
		let dialog = document.createElement('div');
		dialog.className = 'dialog';
		dialog.innerHTML = html + '<br>' + (actionName !== null ? '<div id="dialogAction" class="roundedBtn">' + actionName + '</div>' : '') + '<div id="dialogDismiss" class="roundedBtn">' + dismissName + '</div>';
		document.body.appendChild(dialog);
		if (actionName !== null && actioned !== null) {
			document.getElementById('dialogAction')!.addEventListener('click', actioned);
			this.actioned = actioned;
		}
		document.getElementById('dialogDismiss')!.addEventListener('click', dismissed !== null ? dismissed : () => this.close());

		if (sourceElem !== null) sourceElem.classList.add(CLASS_DIALOG_ACTIVE);

		this.elem = dialog;
		this.source = sourceElem;
	}

	public close() {
		eventOverlay.remove();
		if (this.elem !== null) {
			this.elem.remove();
			this.elem = null;
		}
		if (this.source !== null) {
			this.source.classList.remove(CLASS_DIALOG_ACTIVE);
			this.source = null;
		}
		this.actioned = null;
		this.type = null;
	}

	public closeActionRunning() {
		if (this.type === DialogType.ActionRunning) this.close();
	}

	public submit() {
		if (this.actioned !== null) this.actioned();
	}

	public isOpen() {
		return this.elem !== null;
	}

	public getType() {
		return this.type;
	}
}
