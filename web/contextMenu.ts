const CLASS_CONTEXT_MENU_ACTIVE = 'contextMenuActive';

interface ContextMenuAction {
	readonly title: string;
	readonly visible: boolean;
	readonly onClick: () => void;
	readonly checked?: boolean; // Required in checked context menus
}

type ContextMenuActions = ContextMenuAction[][];

type ContextMenuTarget = {
	type: TargetType.Commit | TargetType.Ref;
	elem: HTMLElement;
	hash: string;
	index: number;
	ref?: string;
} | RepoTarget;

class ContextMenu {
	private elem: HTMLElement | null = null;
	private target: ContextMenuTarget | null = null;

	constructor() {
		const listener = () => this.close();
		document.addEventListener('click', listener);
		document.addEventListener('contextmenu', listener);
	}

	public show(actions: ContextMenuActions, checked: boolean, target: ContextMenuTarget | null, event: MouseEvent) {
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

		const menu = document.createElement('ul');
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
		this.elem = menu;

		addListenerToClass('contextMenuItem', 'click', (e) => {
			e.stopPropagation();
			this.close();
			handlers[parseInt((<HTMLElement>(<Element>e.target).closest('.contextMenuItem')!).dataset.index!)]();
		});

		this.target = target;
		if (this.target !== null && this.target.type !== TargetType.Repo) {
			alterClass(this.target.elem, CLASS_CONTEXT_MENU_ACTIVE, true);
		}
	}

	public close() {
		if (this.elem !== null) {
			this.elem.remove();
			this.elem = null;
		}
		if (this.target !== null && this.target.type !== TargetType.Repo) {
			alterClass(this.target.elem, CLASS_CONTEXT_MENU_ACTIVE, false);
		}
		this.target = null;
	}

	public refresh(commits: ReadonlyArray<GG.GitCommit>) {
		if (!this.isOpen() || this.target === null || this.target.type === TargetType.Repo) {
			// Don't need to refresh if no context menu is open, or it is not dynamic
			return;
		}

		if (this.target.index < commits.length && commits[this.target.index].hash === this.target.hash) {
			// The commit still exists at the same index

			const commitElem = findCommitElemWithId(getCommitElems(), this.target.index);
			if (commitElem !== null) {
				if (typeof this.target.ref === 'undefined') {
					// ContextMenu is only dependent on the commit itself
					this.target.elem = commitElem;
					alterClass(this.target.elem, CLASS_CONTEXT_MENU_ACTIVE, true);
					return;
				} else {
					// ContextMenu is dependent on the commit and ref 
					const elems = <NodeListOf<HTMLElement>>commitElem.querySelectorAll('[data-fullref]');
					for (let i = 0; i < elems.length; i++) {
						if (elems[i].dataset.fullref! === this.target.ref) {
							this.target.elem = this.target.type === TargetType.Ref ? elems[i] : commitElem;
							alterClass(this.target.elem, CLASS_CONTEXT_MENU_ACTIVE, true);
							return;
						}
					}
				}
			}
		}

		this.close();
	}

	public isOpen() {
		return this.elem !== null;
	}

	public isTargetDynamicSource() {
		return this.isOpen() && this.target !== null;
	}
}
