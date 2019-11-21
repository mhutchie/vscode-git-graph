const CLASS_DIALOG_ACTIVE = 'dialogActive';
const CLASS_DIALOG_INPUT_INVALID = 'inputInvalid';
const CLASS_DIALOG_NO_INPUT = 'noInput';

const enum DialogType {
	Form,
	ActionRunning,
	Message
}

interface DialogTextInput {
	readonly type: 'text';
	readonly name: string;
	readonly default: string;
	readonly placeholder: string | null;
	readonly info?: string;
}

interface DialogTextRefInput {
	readonly type: 'text-ref';
	readonly name: string;
	readonly default: string;
	readonly info?: string;
}

interface DialogSelectInput {
	readonly type: 'select';
	readonly name: string;
	readonly options: DialogSelectInputOption[];
	readonly default: string;
	readonly info?: string;
}

interface DialogCheckboxInput {
	readonly type: 'checkbox';
	readonly name: string;
	readonly value: boolean;
	readonly info?: string;
}

interface DialogSelectInputOption {
	readonly name: string;
	readonly value: string;
}

type DialogInput = DialogTextInput | DialogTextRefInput | DialogSelectInput | DialogCheckboxInput;
type DialogInputValue = string | boolean;

class Dialog {
	private elem: HTMLElement | null = null;
	private source: HTMLElement | null = null;
	private actioned: (() => void) | null = null;
	private type: DialogType | null = null;
	private customSelects: CustomSelect[] = [];

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
		this.showForm(message, [
			{ type: 'text-ref', name: '', default: defaultValue }
		], actionName, (values) => actioned(<string>values[0]), sourceElem);
	}

	public showCheckbox(message: string, checkboxLabel: string, checkboxValue: boolean, actionName: string, actioned: (value: boolean) => void, sourceElem: HTMLElement | null) {
		this.showForm(message, [
			{ type: 'checkbox', name: checkboxLabel, value: checkboxValue }
		], actionName, (values) => actioned(<boolean>values[0]), sourceElem);
	}

	public showSelect(message: string, defaultValue: string, options: DialogSelectInputOption[], actionName: string, actioned: (value: string) => void, sourceElem: HTMLElement | null) {
		this.showForm(message, [
			{ type: 'select', name: '', options: options, default: defaultValue }
		], actionName, (values) => actioned(<string>values[0]), sourceElem);
	}

	public showForm(message: string, inputs: DialogInput[], actionName: string, actioned: (values: DialogInputValue[]) => void, sourceElem: HTMLElement | null) {
		const multiElement = inputs.length > 1;
		const multiCheckbox = multiElement && inputs.every((input) => input.type === 'checkbox');
		const infoColumn = inputs.some((input) => input.info && input.type !== 'checkbox');
		let textRefInput = -1;

		let html = message + '<br><table class="dialogForm ' + (multiElement ? multiCheckbox ? 'multiCheckbox' : 'multi' : 'single') + '">', selectIds: number[] = [];
		for (let i = 0; i < inputs.length; i++) {
			const input = inputs[i], infoHtml = input.info ? '<span class="dialogInfo" title="' + escapeHtml(input.info) + '">' + SVG_ICONS.info + '</span>' : '';
			html += '<tr' + (input.type !== 'checkbox' ? ' class="largeField"' : '') + '>' + (multiElement && !multiCheckbox ? '<td>' + input.name + ': </td>' : '');
			if (input.type === 'select') {
				html += '<td class="inputCol"><div id="dialogFormSelect' + i + '"></div></td>' + (infoColumn ? '<td>' + infoHtml + '</td>' : '');
				selectIds.push(i);
			} else if (input.type === 'checkbox') {
				html += '<td class="inputCol"' + (infoColumn ? ' colspan="2"' : '') + '><span class="dialogFormCheckbox"><label><input id="dialogInput' + i + '" type="checkbox"' + (input.value ? ' checked' : '') + ' tabindex="' + (i + 1) + '"/><span class="customCheckbox"></span>' + (multiElement && !multiCheckbox ? '' : input.name) + infoHtml + '</label></span></td>';
			} else {
				html += '<td class="inputCol"><input id="dialogInput' + i + '" type="text" value="' + escapeHtml(input.default) + '"' + (input.type === 'text' && input.placeholder !== null ? ' placeholder="' + escapeHtml(input.placeholder) + '"' : '') + ' tabindex="' + (i + 1) + '"/></td>' + (infoColumn ? '<td>' + infoHtml + '</td>' : '');
				if (input.type === 'text-ref') textRefInput = i;
			}
			html += '</tr>';
		}
		html += '</table>';

		this.show(DialogType.Form, html, actionName, 'Cancel', () => {
			if (this.elem === null || this.elem.classList.contains(CLASS_DIALOG_NO_INPUT) || this.elem.classList.contains(CLASS_DIALOG_INPUT_INVALID)) return;
			let values = inputs.map((input, index) => {
				const elem = <HTMLInputElement>document.getElementById('dialogInput' + index);
				return input.type === 'checkbox' ? elem.checked : elem.value;
			});
			this.close();
			actioned(values);
		}, null, sourceElem);

		this.customSelects = selectIds.map(id => new CustomSelect(<DialogSelectInput>inputs[id], 'dialogFormSelect' + id, 'dialogInput' + id, id + 1, this.elem!));

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

	public showError(message: string, reason: GG.ErrorInfo, actionName: string | null, actioned: (() => void) | null, sourceElem: HTMLElement | null) {
		this.show(DialogType.Message, '<span class="dialogAlert">' + SVG_ICONS.alert + 'Error: ' + message + '</span>' + (reason !== null ? '<br><span class="messageContent errorContent">' + escapeHtml(reason).split('\n').join('<br>') + '</span>' : ''), actionName, 'Dismiss', () => {
			this.close();
			if (actioned !== null) actioned();
		}, null, sourceElem);
	}

	public showActionRunning(action: string) {
		this.show(DialogType.ActionRunning, '<span class="actionRunning">' + SVG_ICONS.loading + action + ' ...</span>', null, 'Dismiss', null, null, null);
	}

	private show(type: DialogType, html: string, actionName: string | null, dismissName: string, actioned: (() => void) | null, dismissed: (() => void) | null, sourceElem: HTMLElement | null) {
		closeDialogAndContextMenu();

		this.type = type;
		eventOverlay.create('dialogBacking', null, null);
		let dialog = document.createElement('div'), dialogContent = document.createElement('div');
		dialog.className = 'dialog';
		dialogContent.className = 'dialogContent';
		dialogContent.innerHTML = html + '<br>' + (actionName !== null ? '<div id="dialogAction" class="roundedBtn">' + actionName + '</div>' : '') + '<div id="dialogDismiss" class="roundedBtn">' + dismissName + '</div>';
		dialog.appendChild(dialogContent);
		document.body.appendChild(dialog);

		let docHeight = document.body.clientHeight, dialogHeight = dialog.clientHeight + 2;
		if (type !== DialogType.Form && dialogHeight > 0.8 * docHeight) {
			dialogContent.style.height = Math.round(0.8 * docHeight - 22) + 'px';
			dialogHeight = Math.round(0.8 * docHeight);
		}
		dialog.style.top = Math.max(Math.round((docHeight - dialogHeight) / 2), 10) + 'px';
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
		this.customSelects.forEach(select => select.remove());
		this.customSelects = [];
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

class CustomSelect {
	private data: DialogSelectInput;
	private open: boolean;
	private selectedItem!: number;

	private dialogElem: HTMLElement | null;
	private elem: HTMLElement | null;
	private currentElem: HTMLElement | null;
	private valueElem: HTMLInputElement | null;
	private optionsElem: HTMLElement | null = null;
	private clickHandler: ((e: MouseEvent) => void) | null;

	constructor(data: DialogSelectInput, containerId: string, inputId: string, tabIndex: number, dialogElem: HTMLElement) {
		this.data = data;
		this.open = false;
		this.dialogElem = dialogElem;

		let container = document.getElementById(containerId)!;
		container.className = 'customSelectContainer';
		this.elem = container;

		let currentElem = document.createElement('div');
		currentElem.className = 'customSelectCurrent';
		currentElem.tabIndex = tabIndex;
		this.currentElem = currentElem;
		container.appendChild(currentElem);

		let valueElem = document.createElement('input');
		valueElem.className = 'customSelectValue';
		valueElem.id = inputId;
		valueElem.type = 'hidden';
		this.valueElem = valueElem;
		container.appendChild(valueElem);

		this.clickHandler = (e: MouseEvent) => {
			if (!e.target) return;
			let targetElem = <HTMLElement>e.target;
			if (targetElem.closest('.customSelectContainer') !== this.elem && (this.optionsElem === null || targetElem.closest('.customSelectOptions') !== this.optionsElem)) {
				this.render(false);
				return;
			}

			if (targetElem.className === 'customSelectCurrent') {
				this.render(!this.open);
			} else if (this.open && targetElem.classList.contains('customSelectOption')) {
				this.setSelectedItem(parseInt(targetElem.dataset.index!));
				this.render(false);
			}
		};
		document.addEventListener('click', this.clickHandler, true);

		currentElem.addEventListener('keydown', e => {
			if (this.open && e.key === 'Tab') {
				this.render(false);
			} else if (this.open && (e.key === 'Enter' || e.key === 'Escape')) {
				this.render(false);
				e.stopPropagation();
			} else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
				this.setSelectedItem(this.selectedItem > 0 ? this.selectedItem - 1 : this.data.options.length - 1);
			} else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
				this.setSelectedItem(this.selectedItem < this.data.options.length - 1 ? this.selectedItem + 1 : 0);
			}
		});

		let defaultIndex = data.options.findIndex(option => option.value === data.default);
		this.setSelectedItem(defaultIndex > -1 ? defaultIndex : 0);
	}

	public remove() {
		this.dialogElem = null;
		if (this.elem !== null) {
			this.elem.remove();
			this.elem = null;
		}
		if (this.currentElem !== null) {
			this.currentElem.remove();
			this.currentElem = null;
		}
		if (this.valueElem !== null) {
			this.valueElem.remove();
			this.valueElem = null;
		}
		if (this.optionsElem !== null) {
			this.optionsElem.remove();
			this.optionsElem = null;
		}
		if (this.clickHandler !== null) {
			document.removeEventListener('click', this.clickHandler, true);
			this.clickHandler = null;
		}
	}

	private setSelectedItem(index: number) {
		if (this.currentElem === null || this.valueElem === null) return;

		this.selectedItem = index;
		this.currentElem.innerHTML = escapeHtml(this.data.options[index].name);
		this.valueElem.value = this.data.options[index].value;
		if (this.optionsElem !== null) {
			let optionElems = this.optionsElem.children;
			for (let i = 0; i < optionElems.length; i++) {
				alterClass(<HTMLElement>optionElems[i], 'selected', parseInt((<HTMLElement>optionElems[i]).dataset.index!) === index);
			}
		}
	}

	private render(open: boolean) {
		if (this.elem === null || this.currentElem === null || this.dialogElem === null) return;

		if (this.open !== open) {
			this.open = open;
			if (open) {
				let optionsElem = this.optionsElem === null ? document.createElement('div') : this.optionsElem;
				let currentElemRect = this.currentElem.getBoundingClientRect(), dialogElemRect = this.dialogElem.getBoundingClientRect();
				optionsElem.style.top = (currentElemRect.top - dialogElemRect.top + currentElemRect.height - 2) + 'px';
				optionsElem.style.left = (currentElemRect.left - dialogElemRect.left - 1) + 'px';
				optionsElem.style.width = currentElemRect.width + 'px';
				if (this.optionsElem === null) {
					optionsElem.className = 'customSelectOptions';
					this.optionsElem = optionsElem;
					this.dialogElem.appendChild(optionsElem);
				}
			} else if (this.optionsElem !== null) {
				this.optionsElem.remove();
				this.optionsElem = null;
			}
			alterClass(this.elem, 'open', open);
		}

		if (this.optionsElem !== null) {
			let html = '';
			for (let i = 0; i < this.data.options.length; i++) {
				html += '<div class="customSelectOption' + (this.selectedItem === i ? ' selected' : '') + '" data-index="' + i + '">' + escapeHtml(this.data.options[i].name) + '</div>';
			}
			this.optionsElem.innerHTML = html;
		}
	}
}
