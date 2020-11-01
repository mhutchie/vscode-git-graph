const CLASS_CONTEXT_MENU_ACTIVE = 'contextMenuActive';

interface ContextMenuAction {
	readonly title: string;
	readonly visible: boolean;
	readonly onClick: () => void;
	readonly checked?: boolean; // Required in checked context menus
}

type ContextMenuActions = ReadonlyArray<ReadonlyArray<ContextMenuAction>>;

type ContextMenuTarget = {
	type: TargetType.Commit | TargetType.Ref | TargetType.CommitDetailsView;
	elem: HTMLElement;
	hash: string;
	index: number;
	ref?: string;
} | RepoTarget;

class ContextMenu {
	private elem: HTMLElement | null = null;
	private onClose: (() => void) | null = null;
	private target: ContextMenuTarget | null = null;

	constructor() {
		const listener = () => this.close();
		document.addEventListener('click', listener);
		document.addEventListener('contextmenu', listener);
	}

	public show(actions: ContextMenuActions, checked: boolean, target: ContextMenuTarget | null, event: MouseEvent, frameElem: HTMLElement, blockUserInteractionElem: HTMLElement | null = null, onClose: (() => void) | null = null) {
		let html = '', handlers: (() => void)[] = [], handlerId = 0;
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
		frameElem.appendChild(menu);
		const menuBounds = menu.getBoundingClientRect(), frameBounds = frameElem.getBoundingClientRect();
		const relativeX = event.pageX + menuBounds.width < frameBounds.right
			? -2 // context menu fits to the right
			: event.pageX - menuBounds.width > frameBounds.left
				? 2 - menuBounds.width // context menu fits to the left
				: -2 - (menuBounds.width - (frameBounds.width - (event.pageX - frameBounds.left))); // Overlap the context menu horizontally with the cursor
		const relativeY = event.pageY + menuBounds.height < frameBounds.bottom
			? -2 // context menu fits below
			: event.pageY - menuBounds.height > frameBounds.top
				? 2 - menuBounds.height // context menu fits above
				: -2 - (menuBounds.height - (frameBounds.height - (event.pageY - frameBounds.top))); // Overlap the context menu vertically with the cursor
		menu.style.left = (frameElem.scrollLeft + Math.max(event.pageX - frameBounds.left + relativeX, 2)) + 'px';
		menu.style.top = (frameElem.scrollTop + Math.max(event.pageY - frameBounds.top + relativeY, 2)) + 'px';
		menu.style.opacity = '1';
		this.elem = menu;
		this.onClose = onClose;

		addListenerToClass('contextMenuItem', 'click', (e) => {
			e.stopPropagation();
			this.close();
			handlers[parseInt((<HTMLElement>(<Element>e.target).closest('.contextMenuItem')!).dataset.index!)]();
		});

		this.target = target;
		if (this.target !== null && this.target.type !== TargetType.Repo) {
			alterClass(this.target.elem, CLASS_CONTEXT_MENU_ACTIVE, true);
		}

		if (blockUserInteractionElem !== null) {
			alterClass(blockUserInteractionElem, CLASS_BLOCK_USER_INTERACTION, true);
		}
	}

	public close() {
		if (this.elem !== null) {
			this.elem.remove();
			this.elem = null;
		}
		alterClassOfCollection(<HTMLCollectionOf<HTMLElement>>document.getElementsByClassName(CLASS_BLOCK_USER_INTERACTION), CLASS_BLOCK_USER_INTERACTION, false);
		alterClassOfCollection(<HTMLCollectionOf<HTMLElement>>document.getElementsByClassName(CLASS_CONTEXT_MENU_ACTIVE), CLASS_CONTEXT_MENU_ACTIVE, false);
		if (this.onClose !== null) {
			this.onClose();
			this.onClose = null;
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
					if (this.target.type !== TargetType.CommitDetailsView) {
						this.target.elem = commitElem;
						alterClass(this.target.elem, CLASS_CONTEXT_MENU_ACTIVE, true);
					}
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
