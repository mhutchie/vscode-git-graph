const CLASS_FIND_TRANSITION = 'transition';
const CLASS_FIND_CURRENT_COMMIT = 'findCurrentCommit';
const CLASS_FIND_MATCH = 'findMatch';

interface FindWidgetState {
	text: string;
	currentHash: string | null;
	visible: boolean;
}

class FindWidget {
	private view: GitGraphView;
	private commits: GG.GitCommitNode[] = [];
	private text: string = '';
	private matches: { hash: string, elem: HTMLElement }[] = [];
	private position: number = -1;
	private visible: boolean = false;

	private widgetElem: HTMLElement;
	private inputElem: HTMLInputElement;
	private positionElem: HTMLElement;
	private prevElem: HTMLElement;
	private nextElem: HTMLElement;

	constructor(view: GitGraphView) {
		this.view = view;
		this.widgetElem = document.createElement('div');
		this.widgetElem.className = 'findWidget';
		this.widgetElem.innerHTML = '<input id="findInput" type="text" placeholder="Find" disabled/><span id="findPosition"></span><span id="findPrev"></span><span id="findNext"></span><span id="findClose"></span>';
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
			let commits = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName('commit'), j = 0, commit, findText = this.text.toLowerCase(), textLen = this.text.length;

			for (let i = 0; i < this.commits.length; i++) {
				commit = this.commits[i];
				let branchLabels = getBranchLabels(commit.heads, commit.remotes), hash = commit.hash.toLowerCase();
				if (commit.hash !== UNCOMMITTED && ((colVisibility.author && commit.author.toLowerCase().includes(findText))
					|| (colVisibility.commit && (hash.startsWith(findText) || abbrevCommit(hash).includes(findText)))
					|| commit.message.toLowerCase().includes(findText)
					|| branchLabels.heads.some(head => head.name.toLowerCase().includes(findText) || head.remotes.some(remote => remote.toLowerCase().includes(findText)))
					|| branchLabels.remotes.some(remote => remote.name.toLowerCase().includes(findText))
					|| commit.tags.some(tag => tag.toLowerCase().includes(findText)))) {

					while (j < commits.length && commits[j].dataset.hash! !== commit.hash) j++;
					if (j === commits.length) continue;

					this.matches.push({ hash: commit.hash, elem: commits[j] });

					// Highlight matches
					let textElems = getChildNodesWithTextContent(commits[j]);
					for (let k = 0; k < textElems.length; k++) {
						let pos = 0, text = textElems[k].textContent!;
						let lowerText = text.toLowerCase();
						let next = lowerText.indexOf(findText, pos);
						while (next > -1) {
							if (pos !== next) textElems[k].parentNode!.insertBefore(document.createTextNode(text.substring(pos, next)), textElems[k]);
							pos = next + textLen;
							textElems[k].parentNode!.insertBefore(createFindMatchElem(text.substring(next, pos)), textElems[k]);
							next = lowerText.indexOf(findText, pos);
						}
						if (pos > 0) {
							if (pos !== text.length) {
								textElems[k].textContent = text.substring(pos, text.length);
							} else {
								textElems[k].parentNode!.removeChild(textElems[k]);
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
			let matchElems = getChildrenWithClassName(this.matches[i].elem, CLASS_FIND_MATCH);
			for (let j = 0; j < matchElems.length; j++) {
				let text = matchElems[j].childNodes[0].textContent!;

				// Combine current text with the text from previous sibling text nodes
				let node = matchElems[j].previousSibling, elem = matchElems[j].previousElementSibling;
				while (node !== null && node !== elem && node.textContent !== null) {
					text = node.textContent + text;
					matchElems[j].parentNode!.removeChild(node);
					node = matchElems[j].previousSibling;
					elem = matchElems[j].previousElementSibling;
				}

				// Combine current text with the text from next sibling text nodes
				node = matchElems[j].nextSibling;
				elem = matchElems[j].nextElementSibling;
				while (node !== null && node !== elem && node.textContent !== null) {
					text = text + node.textContent;
					matchElems[j].parentNode!.removeChild(node);
					node = matchElems[j].nextSibling;
					elem = matchElems[j].nextElementSibling;
				}

				matchElems[j].parentNode!.replaceChild(document.createTextNode(text), matchElems[j]);
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
}

function createFindMatchElem(text: string) {
	let span = document.createElement('span');
	span.className = CLASS_FIND_MATCH;
	span.innerHTML = text;
	return span;
}