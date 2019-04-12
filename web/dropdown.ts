class Dropdown {
	private options: DropdownOption[] = [];
	private selectedOption: number = 0;
	private dropdownVisible: boolean = false;
	private changeCallback: { (value: string): void };

	private elem: HTMLElement;
	private currentValueElem: HTMLDivElement;
	private dropdownOptionsElem: HTMLDivElement;

	constructor(id: string, changeCallback: { (value: string): void }) {
		this.changeCallback = changeCallback;
		this.elem = document.getElementById(id)!;
		this.currentValueElem = document.createElement('div');
		this.currentValueElem.className = 'dropdownCurrentValue';
		this.dropdownOptionsElem = document.createElement('div');
		this.dropdownOptionsElem.className = 'dropdownOptions';
		this.elem.appendChild(this.currentValueElem);
		this.elem.appendChild(this.dropdownOptionsElem);

		document.addEventListener('click', (e) => {
			if (e.target === this.currentValueElem) {
				this.elem.classList.toggle('dropdownOpen');
				this.dropdownVisible = !this.dropdownVisible;
			} else if (e.target && (<HTMLElement>e.target).parentNode === this.dropdownOptionsElem) {
				if (typeof (<HTMLElement>e.target).dataset.id !== 'undefined') {
					let selectedOption = parseInt((<HTMLElement>e.target).dataset.id!);
					this.close();
					if (this.selectedOption !== selectedOption) {
						this.selectedOption = selectedOption;
						this.render();
						this.changeCallback(this.options[this.selectedOption].value);
					}
				}
			} else {
				this.close();
			}
		}, true);
		document.addEventListener('contextmenu', () => {
			this.close();
		}, true);
		document.addEventListener('keyup', (e) => {
			if (e.key === 'Escape') this.close();
		}, true);
	}

	public setOptions(options: DropdownOption[], selected: string) {
		this.options = options;
		var i = 0, selectedOption = 0;
		for (i = 0; i < options.length; i++) {
			if (options[i].value === selected) {
				selectedOption = i;
			}
		}
		this.selectedOption = selectedOption;
		this.render();
	}
	
	public refresh() {
		if (this.options.length > 0) this.render();
	}

	private render() {
		this.elem.classList.add('loaded');
		this.currentValueElem.innerHTML = this.options[this.selectedOption].name;
		var html = '', i;
		for (i = 0; i < this.options.length; i++) {
			html += '<div class="dropdownOption' + (this.selectedOption === i ? ' selected' : '') + '" data-id="' + i + '">' + this.options[i].name + '</div>';
		}
		html += '';
		this.dropdownOptionsElem.innerHTML = html;
		this.dropdownOptionsElem.style.cssText = 'opacity:0; display:block;';
		this.currentValueElem.style.width = (this.dropdownOptionsElem.offsetWidth + 12) + 'px';
		this.dropdownOptionsElem.style.cssText = 'right:0; overflow-y:auto; max-height:294px;';
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