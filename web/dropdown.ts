class Dropdown {
	private options: DropdownOption[] = [];
	private selectedOption: number = 0;
	private dropdownVisible: boolean = false;
	private showInfo: boolean;
	private changeCallback: { (value: string): void };

	private elem: HTMLElement;
	private currentValueElem: HTMLDivElement;
	private menuElem: HTMLDivElement;
	private optionsElem: HTMLDivElement;
	private noResultsElem: HTMLDivElement;
	private filterInput: HTMLInputElement;

	constructor(id: string, showInfo: boolean, dropdownType: string, changeCallback: { (value: string): void }) {
		this.showInfo = showInfo;
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
						let selectedOption = parseInt(option.dataset.id!);
						this.close();
						if (this.selectedOption !== selectedOption) {
							this.selectedOption = selectedOption;
							this.render();
							this.changeCallback(this.options[this.selectedOption].value);
						}
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

	public setOptions(options: DropdownOption[], selected: string) {
		this.options = options;
		let selectedOption = 0;
		for (let i = 0; i < options.length; i++) {
			if (options[i].value === selected) {
				selectedOption = i;
				break;
			}
		}
		this.selectedOption = selectedOption;
		if (this.dropdownVisible && options.length <= 1) this.close();
		this.render();
	}

	public refresh() {
		if (this.options.length > 0) this.render();
	}

	private render() {
		this.elem.classList.add('loaded');
		this.currentValueElem.innerHTML = this.options[this.selectedOption].name;
		let html = '';
		for (let i = 0; i < this.options.length; i++) {
			html += '<div class="dropdownOption' + (this.selectedOption === i ? ' selected' : '') + '" data-id="' + i + '">' + escapeHtml(this.options[i].name) + (this.showInfo ? '<div class="dropdownOptionInfo" title="' + escapeHtml(this.options[i].value) + '">' + svgIcons.info + '</div>' : '') + '</div>';
		}
		this.optionsElem.className = 'dropdownOptions' + (this.showInfo ? ' showInfo' : '');
		this.optionsElem.innerHTML = html;
		this.filterInput.style.display = 'none';
		this.noResultsElem.style.display = 'none';
		this.menuElem.style.cssText = 'opacity:0; display:block;';
		// Width must be at least 130px for the filter elements. Max height for the dropdown is [filter (31px) + 9.5 * dropdown item (28px) = 297px]
		// Don't need to add 12px if showing info icons and scrollbar isn't needed. The scrollbar isn't needed if: menuElem height + filter input (25px) < 297px
		this.currentValueElem.style.width = Math.max(this.menuElem.offsetWidth + (this.showInfo && this.menuElem.offsetHeight < 272 ? 0 : 12), 130) + 'px';
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
	}
}

interface DropdownOption {
	name: string;
	value: string;
}