interface DropdownOption {
	readonly name: string;
	readonly value: string;
	readonly hint?: string;
}

class Dropdown {
	private options: DropdownOption[] = [];
	private optionsSelected: boolean[] = [];
	private lastSelected: number = 0;
	private numSelected: number = 0;
	private dropdownVisible: boolean = false;
	private showInfo: boolean;
	private multipleAllowed: boolean;
	private changeCallback: { (values: string[]): void };
	private lastClicked: number = 0;
	private doubleClickTimeout: NodeJS.Timer | null = null;

	private readonly elem: HTMLElement;
	private readonly currentValueElem: HTMLDivElement;
	private readonly menuElem: HTMLDivElement;
	private readonly optionsElem: HTMLDivElement;
	private readonly noResultsElem: HTMLDivElement;
	private readonly filterInput: HTMLInputElement;

	constructor(id: string, showInfo: boolean, multipleAllowed: boolean, dropdownType: string, changeCallback: { (values: string[]): void }) {
		this.showInfo = showInfo;
		this.multipleAllowed = multipleAllowed;
		this.changeCallback = changeCallback;
		this.elem = document.getElementById(id)!;

		this.menuElem = document.createElement('div');
		this.menuElem.className = 'dropdownMenu';

		let filter = this.menuElem.appendChild(document.createElement('div'));
		filter.className = 'dropdownFilter';

		this.filterInput = filter.appendChild(document.createElement('input'));
		this.filterInput.className = 'dropdownFilterInput';
		this.filterInput.placeholder = 'Filter ' + dropdownType + '...';

		this.optionsElem = this.menuElem.appendChild(document.createElement('div'));
		this.optionsElem.className = 'dropdownOptions';

		this.noResultsElem = this.menuElem.appendChild(document.createElement('div'));
		this.noResultsElem.className = 'dropdownNoResults';
		this.noResultsElem.innerHTML = 'No results found.';

		this.currentValueElem = this.elem.appendChild(document.createElement('div'));
		this.currentValueElem.className = 'dropdownCurrentValue';

		alterClass(this.elem, 'multi', multipleAllowed);
		this.elem.appendChild(this.menuElem);

		document.addEventListener('click', (e) => {
			if (!e.target) return;
			if (e.target === this.currentValueElem) {
				this.dropdownVisible = !this.dropdownVisible;
				if (this.dropdownVisible) {
					this.filterInput.value = '';
					this.filter();
				}
				this.elem.classList.toggle('dropdownOpen');
				if (this.dropdownVisible) this.filterInput.focus();
			} else if (this.dropdownVisible) {
				if ((<HTMLElement>e.target).closest('.dropdown') !== this.elem) {
					this.close();
				} else {
					let option = <HTMLElement | null>(<HTMLElement>e.target).closest('.dropdownOption');
					if (option !== null && option.parentNode === this.optionsElem && typeof option.dataset.id !== 'undefined') {
						this.selectOption(parseInt(option.dataset.id!));
					}
				}
			}
		}, true);
		document.addEventListener('contextmenu', () => this.close(), true);
		document.addEventListener('keyup', (e) => {
			if (e.key === 'Escape') this.close();
		}, true);
		this.filterInput.addEventListener('keyup', () => this.filter());
	}

	public setOptions(options: DropdownOption[], optionsSelected: string[]) {
		this.options = options;
		this.optionsSelected = [];
		this.numSelected = 0;
		let selectedOption = -1, isSelected;
		for (let i = 0; i < options.length; i++) {
			isSelected = optionsSelected.includes(options[i].value);
			this.optionsSelected[i] = isSelected;
			if (isSelected) {
				selectedOption = i;
				this.numSelected++;
			}
		}
		if (selectedOption === -1) {
			selectedOption = 0;
			this.optionsSelected[selectedOption] = true;
			this.numSelected++;
		}
		this.lastSelected = selectedOption;
		if (this.dropdownVisible && options.length <= 1) this.close();
		this.render();
		this.clearDoubleClickTimeout();
	}

	public refresh() {
		if (this.options.length > 0) this.render();
	}

	private render() {
		this.elem.classList.add('loaded');

		const curValueText = this.getCurrentValueText();
		this.currentValueElem.title = curValueText;
		this.currentValueElem.innerHTML = escapeHtml(curValueText);

		let html = '';
		for (let i = 0; i < this.options.length; i++) {
			html += '<div class="dropdownOption' + (this.optionsSelected[i] ? ' selected' : '') + '" data-id="' + i + '">' +
				(this.multipleAllowed && this.optionsSelected[i] ? '<div class="dropdownOptionMultiSelected">' + SVG_ICONS.check + '</div>' : '') +
				escapeHtml(this.options[i].name) +
				(typeof this.options[i].hint === 'string' && this.options[i].hint !== '' ? '<span class="dropdownOptionHint">' + escapeHtml(this.options[i].hint!) + '</span>' : '') +
				(this.showInfo ? '<div class="dropdownOptionInfo" title="' + escapeHtml(this.options[i].value) + '">' + SVG_ICONS.info + '</div>' : '') +
				'</div>';
		}
		this.optionsElem.className = 'dropdownOptions' + (this.showInfo ? ' showInfo' : '');
		this.optionsElem.innerHTML = html;
		this.filterInput.style.display = 'none';
		this.noResultsElem.style.display = 'none';
		this.menuElem.style.cssText = 'opacity:0; display:block;';
		// Width must be at least 138px for the filter element. Max height for the dropdown is [filter (31px) + 9.5 * dropdown item (28px) = 297px]
		// Don't need to add 12px if showing (info icons or multi checkboxes) and the scrollbar isn't needed. The scrollbar isn't needed if: menuElem height + filter input (25px) < 297px
		this.currentValueElem.style.width = Math.max(this.menuElem.offsetWidth + ((this.showInfo || this.multipleAllowed) && this.menuElem.offsetHeight < 272 ? 0 : 12), 138) + 'px';
		this.menuElem.style.cssText = 'right:0; overflow-y:auto; max-height:297px;';
		if (this.dropdownVisible) this.filter();
	}

	private filter() {
		let val = this.filterInput.value.toLowerCase(), match, matches = false;
		for (let i = 0; i < this.options.length; i++) {
			match = this.options[i].name.toLowerCase().indexOf(val) > -1;
			(<HTMLElement>this.optionsElem.children[i]).style.display = match ? 'block' : 'none';
			if (match) matches = true;
		}
		this.filterInput.style.display = 'block';
		this.noResultsElem.style.display = matches ? 'none' : 'block';
	}

	private close() {
		this.elem.classList.remove('dropdownOpen');
		this.dropdownVisible = false;
		this.clearDoubleClickTimeout();
	}

	private getSelectedOptions(names: boolean) {
		let selected = [];
		if (this.multipleAllowed && this.optionsSelected[0]) {
			// Note: Show All is always the first option (0 index) when multiple selected items are allowed
			return [names ? this.options[0].name : this.options[0].value];
		}
		for (let i = 0; i < this.options.length; i++) {
			if (this.optionsSelected[i]) selected.push(names ? this.options[i].name : this.options[i].value);
		}
		return selected;
	}

	private getCurrentValueText() {
		let str = '', selected = this.getSelectedOptions(true);
		for (let i = 0; i < selected.length; i++) {
			str += (i > 0 ? i < selected.length - 1 ? ', ' : ' & ' : '') + selected[i];
		}
		return str;
	}

	private selectOption(option: number) {
		// Note: Show All is always the first option (0 index) when multiple selected items are allowed
		let change = false;
		let doubleClick = this.doubleClickTimeout !== null && this.lastClicked === option;
		if (this.doubleClickTimeout !== null) this.clearDoubleClickTimeout();

		if (doubleClick) {
			// Double click
			if (this.multipleAllowed && option === 0) {
				this.numSelected = 1;
				for (let i = 1; i < this.optionsSelected.length; i++) {
					this.optionsSelected[i] = !this.optionsSelected[i];
					if (this.optionsSelected[i]) this.numSelected++;
				}
				change = true;
			}
		} else {
			// Single Click
			if (this.multipleAllowed) {
				// Multiple dropdown options can be selected
				if (option === 0) {
					// Show All was selected
					if (!this.optionsSelected[0]) {
						this.optionsSelected[0] = true;
						for (let i = 1; i < this.optionsSelected.length; i++) {
							this.optionsSelected[i] = false;
						}
						this.numSelected = 1;
						change = true;
					}
				} else {
					if (this.optionsSelected[0]) {
						this.optionsSelected[0] = false;
						this.numSelected--;
					}

					this.numSelected += this.optionsSelected[option] ? -1 : 1;
					this.optionsSelected[option] = !this.optionsSelected[option];

					if (this.numSelected === 0) {
						this.optionsSelected[0] = true;
						this.numSelected = 1;
					}
					change = true;
				}
				if (change && this.optionsSelected[option]) {
					this.lastSelected = option;
				}
			} else {
				// Only a single dropdown option can be selected
				this.close();
				if (this.lastSelected !== option) {
					this.optionsSelected[this.lastSelected] = false;
					this.optionsSelected[option] = true;
					this.lastSelected = option;
					change = true;
				}
			}

			if (change) {
				// If a change has occured, trigger the callback
				this.changeCallback(this.getSelectedOptions(false));
			}
		}

		if (change) {
			// If a change has occured, re-render the dropdown elements
			let menuScroll = this.menuElem.scrollTop;
			this.render();
			if (this.dropdownVisible) this.menuElem.scroll(0, menuScroll);
		}

		this.lastClicked = option;
		this.doubleClickTimeout = setTimeout(() => {
			this.clearDoubleClickTimeout();
		}, 500);
	}

	private clearDoubleClickTimeout() {
		if (this.doubleClickTimeout !== null) {
			clearTimeout(this.doubleClickTimeout);
			this.doubleClickTimeout = null;
		}
	}
}
