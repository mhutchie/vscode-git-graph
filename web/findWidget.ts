const CLASS_FIND_TRANSITION = 'transition';
const CLASS_FIND_CURRENT_COMMIT = 'findCurrentCommit';
const CLASS_FIND_MATCH = 'findMatch';

interface FindWidgetState {
	text: string;
	caseSensitive: boolean;
	currentHash: string | null;
	visible: boolean;
}

class FindWidget {
	private view: GitGraphView;
	private commits: GG.GitCommitNode[] = [];
	private text: string = '';
	private caseSensitive: boolean = false;
	private matches: { hash: string, elem: HTMLElement }[] = [];
	private position: number = -1;
	private visible: boolean = false;

	private widgetElem: HTMLElement;
	private inputElem: HTMLInputElement;
	private caseElem: HTMLElement;
	private positionElem: HTMLElement;
	private prevElem: HTMLElement;
	private nextElem: HTMLElement;

	constructor(view: GitGraphView) {
		this.view = view;
		this.widgetElem = document.createElement('div');
		this.widgetElem.className = 'findWidget';
		this.widgetElem.innerHTML = '<input id="findInput" type="text" placeholder="Find" disabled/><span id="findCase" title="Match Case">Aa</span><span id="findPosition"></span><span id="findPrev"></span><span id="findNext"></span><span id="findClose"></span>';
		document.body.appendChild(this.widgetElem);

		this.inputElem = <HTMLInputElement>document.getElementById('findInput')!;
		let keyupTimeout: NodeJS.Timer | null = null;
		this.inputElem.addEventListener('keyup', (e) => {
			if (e.key === 'Enter' && this.text !== '') {
				this.next();
			} else {
				if (keyupTimeout !== null) clearTimeout(keyupTimeout);
				keyupTimeout = setTimeout(() => {
					keyupTimeout = null;
					if (this.text !== this.inputElem.value) {
						this.text = this.inputElem.value;
						this.clearMatches();
						this.findMatches(null, true);
					}
				}, 200);
			}
		});

		this.caseElem = document.getElementById('findCase')!;
		this.caseElem.addEventListener('click', () => {
			this.caseSensitive = !this.caseSensitive;
			alterClass(this.caseElem, CLASS_ACTIVE, this.caseSensitive);
			this.clearMatches();
			this.findMatches(this.getCurrentHash(), true);
		});

		this.positionElem = document.getElementById('findPosition')!;

		this.prevElem = document.getElementById('findPrev')!;
		this.prevElem.classList.add(CLASS_DISABLED);
		this.prevElem.innerHTML = svgIcons.arrowLeft;
		this.prevElem.addEventListener('click', () => this.prev());

		this.nextElem = document.getElementById('findNext')!;
		this.nextElem.classList.add(CLASS_DISABLED);
		this.nextElem.innerHTML = svgIcons.arrowRight;
		this.nextElem.addEventListener('click', () => this.next());

		const findClose = document.getElementById('findClose')!;
		findClose.innerHTML = svgIcons.close;
		findClose.addEventListener('click', () => this.close());
	}

	public show(transition: boolean) {
		if (!this.visible) {
			this.visible = true;
			this.inputElem.value = this.text;
			this.inputElem.disabled = false;
			this.updatePosition(-1, false);
			alterClass(this.widgetElem, CLASS_FIND_TRANSITION, transition);
			this.widgetElem.classList.add(CLASS_ACTIVE);
		}
		this.inputElem.focus();
	}

	public close() {
		if (!this.visible) return;
		this.visible = false;
		this.widgetElem.classList.add(CLASS_FIND_TRANSITION);
		this.widgetElem.classList.remove(CLASS_ACTIVE);
		this.clearMatches();
		this.text = '';
		this.matches = [];
		this.position = -1;
		this.inputElem.value = this.text;
		this.inputElem.disabled = true;
		this.view.saveState();
	}

	public update(commits: GG.GitCommitNode[]) {
		this.commits = commits;
		if (this.visible) this.findMatches(this.getCurrentHash(), false);
	}

	public setColour(colour: string) {
		document.body.style.setProperty('--git-graph-findMatch', colour);
		document.body.style.setProperty('--git-graph-findMatchCommit', modifyColourOpacity(colour, 0.5));
	}

	/* State */
	public getState(): FindWidgetState {
		return {
			text: this.text,
			caseSensitive: this.caseSensitive,
			currentHash: this.getCurrentHash(),
			visible: this.visible
		};
	}
	public getCurrentHash() {
		return this.position > -1 ? this.matches[this.position].hash : null;
	}
	public restoreState(state: FindWidgetState) {
		if (!state.visible) return;
		this.text = state.text;
		this.caseSensitive = state.caseSensitive;
		alterClass(this.caseElem, CLASS_ACTIVE, this.caseSensitive);
		this.show(false);
		if (this.text !== '') this.findMatches(state.currentHash, false);
	}
	public isVisible() {
		return this.visible;
	}

	private findMatches(goToCommitHash: string | null, scrollToCommit: boolean) {
		this.matches = [];
		this.position = -1;

		if (this.text !== '') {
			let colVisibility = this.view.getColumnVisibility();
			let commits = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName('commit'), j = 0, commit, findText = this.convertCase(this.text), textLen = this.text.length;

			// Search the commit data itself to detect commits that match, so that dom tree traversal is performed on matching commit rows (for performance)
			for (let i = 0; i < this.commits.length; i++) {
				commit = this.commits[i];
				let branchLabels = getBranchLabels(commit.heads, commit.remotes), hash = this.convertCase(commit.hash);
				if (commit.hash !== UNCOMMITTED && ((colVisibility.author && this.convertCase(commit.author).includes(findText))
					|| (colVisibility.commit && (hash.startsWith(findText) || abbrevCommit(hash).includes(findText)))
					|| this.convertCase(commit.message).includes(findText)
					|| branchLabels.heads.some(head => this.convertCase(head.name).includes(findText) || head.remotes.some(remote => this.convertCase(remote).includes(findText)))
					|| branchLabels.remotes.some(remote => this.convertCase(remote.name).includes(findText))
					|| commit.tags.some(tag => this.convertCase(tag).includes(findText))
					|| (colVisibility.date && (this.convertCase(getCommitDate(commit.date).value).includes(findText))))) {

					while (j < commits.length && commits[j].dataset.hash! !== commit.hash) j++;
					if (j === commits.length) continue;

					this.matches.push({ hash: commit.hash, elem: commits[j] });

					// Highlight matches
					let textElems = getChildNodesWithTextContent(commits[j]), textElem;
					for (let k = 0; k < textElems.length; k++) {
						textElem = textElems[k];
						let pos = 0, rawText = textElem.textContent!;
						let text = this.convertCase(rawText);
						let next = text.indexOf(findText, pos);
						while (next > -1) {
							if (pos !== next) textElem.parentNode!.insertBefore(document.createTextNode(rawText.substring(pos, next)), textElem);
							pos = next + textLen;
							textElem.parentNode!.insertBefore(createFindMatchElem(rawText.substring(next, pos)), textElem);
							next = text.indexOf(findText, pos);
						}
						if (pos > 0) {
							if (pos !== rawText.length) {
								textElem.textContent = rawText.substring(pos, rawText.length);
							} else {
								textElem.parentNode!.removeChild(textElem);
							}
						}
					}
					if (colVisibility.commit && hash.startsWith(findText) && !abbrevCommit(hash).includes(findText) && textElems.length > 0) {
						// The commit matches on more than the abbreviated commit, so the commit should be highlighted
						let commitNode = textElems[textElems.length - 1]; // Commit is always the last column if it is visible
						commitNode.parentNode!.replaceChild(createFindMatchElem(commitNode.textContent!), commitNode);
					}
				}
			}
		}

		if (this.matches.length > 0) {
			this.prevElem.classList.remove(CLASS_DISABLED);
			this.nextElem.classList.remove(CLASS_DISABLED);
		} else {
			this.prevElem.classList.add(CLASS_DISABLED);
			this.nextElem.classList.add(CLASS_DISABLED);
		}

		let newPos = -1;
		if (this.matches.length > 0) {
			newPos = 0;
			if (goToCommitHash !== null) {
				let pos = this.matches.findIndex(match => match.hash === goToCommitHash);
				if (pos > -1) newPos = pos;
			}
		}
		this.updatePosition(newPos, scrollToCommit);
	}

	private clearMatches() {
		for (let i = 0; i < this.matches.length; i++) {
			if (i === this.position) this.matches[i].elem.classList.remove(CLASS_FIND_CURRENT_COMMIT);
			let matchElems = getChildrenWithClassName(this.matches[i].elem, CLASS_FIND_MATCH), matchElem;
			for (let j = 0; j < matchElems.length; j++) {
				matchElem = matchElems[j];
				let text = matchElem.childNodes[0].textContent!;

				// Combine current text with the text from previous sibling text nodes
				let node = matchElem.previousSibling, elem = matchElem.previousElementSibling;
				while (node !== null && node !== elem && node.textContent !== null) {
					text = node.textContent + text;
					matchElem.parentNode!.removeChild(node);
					node = matchElem.previousSibling;
					elem = matchElem.previousElementSibling;
				}

				// Combine current text with the text from next sibling text nodes
				node = matchElem.nextSibling;
				elem = matchElem.nextElementSibling;
				while (node !== null && node !== elem && node.textContent !== null) {
					text = text + node.textContent;
					matchElem.parentNode!.removeChild(node);
					node = matchElem.nextSibling;
					elem = matchElem.nextElementSibling;
				}

				matchElem.parentNode!.replaceChild(document.createTextNode(text), matchElem);
			}
		}
	}

	private updatePosition(position: number, scrollToCommit: boolean) {
		if (this.position > -1) this.matches[this.position].elem.classList.remove(CLASS_FIND_CURRENT_COMMIT);
		this.position = position;
		if (this.position > -1) {
			this.matches[this.position].elem.classList.add(CLASS_FIND_CURRENT_COMMIT);
			if (scrollToCommit) this.view.scrollToCommit(this.matches[position].hash, false);
		}
		this.positionElem.innerHTML = this.matches.length > 0 ? (this.position + 1) + ' of ' + this.matches.length : 'No Results';
		this.view.saveState();
	}

	private prev() {
		this.updatePosition(this.position > 0 ? this.position - 1 : this.matches.length - 1, true);
	}

	private next() {
		this.updatePosition(this.position < this.matches.length - 1 ? this.position + 1 : 0, true);
	}

	private convertCase(text: string) {
		return this.caseSensitive ? text : text.toLowerCase();
	}
}

function createFindMatchElem(text: string) {
	let span = document.createElement('span');
	span.className = CLASS_FIND_MATCH;
	span.innerHTML = text;
	return span;
}