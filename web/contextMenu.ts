const CLASS_CONTEXT_MENU_ACTIVE = 'contextMenuActive';

interface ContextMenuAction {
	readonly title: string;
	readonly visible: boolean;
	readonly onClick: () => void;
	readonly checked?: boolean; // Required in checked context menus
}

type ContextMenuActions = ContextMenuAction[][];

class ContextMenu {
	private elem: HTMLElement | null = null;
	private source: HTMLElement | null = null;

	constructor() {
		const listener = () => this.close();
		document.addEventListener('click', listener);
		document.addEventListener('contextmenu', listener);
	}

	public show(event: MouseEvent, actions: ContextMenuActions, checked: boolean, sourceElem: HTMLElement | null) {
		let viewElem = document.getElementById('view'), html = '', handlers: (() => void)[] = [], handlerId = 0;
		if (viewElem === null) return;
		this.close();

		for (let i = 0; i < actions.length; i++) {
			let groupHtml = '';
			for (let j = 0; j < actions[i].length; j++) {
				if (actions[i][j].visible) {
					groupHtml += '<li class="contextMenuItem" data-index="' + handlerId++ + '">' + (checked ? '<span class="contextMenuItemCheck">' + (actions[i][j].checked ? SVG_ICONS.check : '') + '</span>' : '') + actions[i][j].title + '</li>';
					handlers.push(actions[i][j].onClick);
				}
			}

			if (groupHtml !== '') {
				if (html !== '') html += '<li class="contextMenuDivider"></li>';
				html += groupHtml;
			}
		}

		if (handlers.length === 0) return; // No context menu actions are visible

		let menu = document.createElement('ul');
		menu.className = 'contextMenu' + (checked ? ' checked' : '');
		menu.style.opacity = '0';
		menu.innerHTML = html;
		viewElem.appendChild(menu);
		let bounds = menu.getBoundingClientRect();
		let relativeX = event.pageX + bounds.width < viewElem.clientWidth
			? -2 // context menu fits to the right
			: event.pageX - bounds.width > 0
				? 2 - bounds.width // context menu fits to the left
				: -2 - (bounds.width - (viewElem.clientWidth - event.pageX)); // Overlap the context menu horizontally with the cursor
		let relativeY = event.pageY + bounds.height < viewElem.clientHeight
			? -2 // context menu fits below
			: event.pageY - bounds.height > 0
				? 2 - bounds.height // context menu fits above
				: -2 - (bounds.height - (viewElem.clientHeight - event.pageY)); // Overlap the context menu vertically with the cursor
		menu.style.left = (viewElem.scrollLeft + Math.max(event.pageX + relativeX, 2)) + 'px';
		menu.style.top = (viewElem.scrollTop + Math.max(event.pageY + relativeY, 2)) + 'px';
		menu.style.opacity = '1';

		addListenerToClass('contextMenuItem', 'click', (e) => {
			e.stopPropagation();
			this.close();
			handlers[parseInt((<HTMLElement>(<Element>e.target).closest('.contextMenuItem')!).dataset.index!)]();
		});

		if (sourceElem !== null) sourceElem.classList.add(CLASS_CONTEXT_MENU_ACTIVE);

		this.elem = menu;
		this.source = sourceElem;
	}

	public close() {
		if (this.elem !== null) {
			this.elem.remove();
			this.elem = null;
		}
		if (this.source !== null) {
			this.source.classList.remove(CLASS_CONTEXT_MENU_ACTIVE);
			this.source = null;
		}
	}

	public isOpen() {
		return this.elem !== null;
	}
}
