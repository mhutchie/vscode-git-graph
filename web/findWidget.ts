const CLASS_FIND_TRANSITION = 'transition';
const CLASS_FIND_CURRENT_COMMIT = 'findCurrentCommit';
const CLASS_FIND_MATCH = 'findMatch';

interface FindWidgetState {
	text: string;
	isCaseSensitive: boolean;
	isRegex: boolean;
	currentHash: string | null;
	visible: boolean;
}

class FindWidget {
	private view: GitGraphView;
	private commits: GG.GitCommitNode[] = [];
	private text: string = '';
	private isCaseSensitive: boolean = false;
	private isRegex: boolean = false;
	private matches: { hash: string, elem: HTMLElement }[] = [];
	private position: number = -1;
	private visible: boolean = false;

	private widgetElem: HTMLElement;
	private inputElem: HTMLInputElement;
	private caseSensitiveElem: HTMLElement;
	private regexElem: HTMLElement;
	private positionElem: HTMLElement;
	private prevElem: HTMLElement;
	private nextElem: HTMLElement;

	constructor(view: GitGraphView) {
		this.view = view;
		this.widgetElem = document.createElement('div');
		this.widgetElem.className = 'findWidget';
		this.widgetElem.innerHTML = '<input id="findInput" type="text" placeholder="Find" disabled/><span id="findCaseSensitive" class="findModifer" title="Match Case">Aa</span><span id="findRegex" class="findModifer" title="Use Regular Expression">.*</span><span id="findPosition"></span><span id="findPrev"></span><span id="findNext"></span><span id="findClose"></span>';
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
						this.findMatches(this.getCurrentHash(), true);
					}
				}, 200);
			}
		});

		this.caseSensitiveElem = document.getElementById('findCaseSensitive')!;
		this.caseSensitiveElem.addEventListener('click', () => {
			this.isCaseSensitive = !this.isCaseSensitive;
			alterClass(this.caseSensitiveElem, CLASS_ACTIVE, this.isCaseSensitive);
			this.clearMatches();
			this.findMatches(this.getCurrentHash(), true);
		});

		this.regexElem = document.getElementById('findRegex')!;
		this.regexElem.addEventListener('click', () => {
			this.isRegex = !this.isRegex;
			alterClass(this.regexElem, CLASS_ACTIVE, this.isRegex);
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
		this.widgetElem.removeAttribute(ATTR_ERROR);
		this.prevElem.classList.add(CLASS_DISABLED);
		this.nextElem.classList.add(CLASS_DISABLED);
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
			isCaseSensitive: this.isCaseSensitive,
			isRegex: this.isRegex,
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
		this.isCaseSensitive = state.isCaseSensitive;
		this.isRegex = state.isRegex;
		alterClass(this.caseSensitiveElem, CLASS_ACTIVE, this.isCaseSensitive);
		alterClass(this.regexElem, CLASS_ACTIVE, this.isRegex);
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
			let colVisibility = this.view.getColumnVisibility(), findPattern: RegExp | null, findGlobalPattern: RegExp | null, regexText = this.isRegex ? this.text : this.text.replace(/[\\\[\](){}|.*+?^$]/g, '\\$&'), flags = 'u' + (this.isCaseSensitive ? '' : 'i');
			try {
				findPattern = new RegExp(regexText, flags);
				findGlobalPattern = new RegExp(regexText, 'g' + flags);
				this.widgetElem.removeAttribute(ATTR_ERROR);
			} catch (e) {
				findPattern = null;
				findGlobalPattern = null;
				this.widgetElem.setAttribute(ATTR_ERROR, e.message);
			}
			if (findPattern !== null && findGlobalPattern !== null) {
				let commits = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName('commit'), j = 0, commit, zeroLengthMatch = false;

				// Search the commit data itself to detect commits that match, so that dom tree traversal is performed on matching commit rows (for performance)
				for (let i = 0; i < this.commits.length; i++) {
					commit = this.commits[i];
					let branchLabels = getBranchLabels(commit.heads, commit.remotes);
					if (commit.hash !== UNCOMMITTED && ((colVisibility.author && findPattern.test(commit.author))
						|| (colVisibility.commit && (commit.hash.search(findPattern) === 0 || findPattern.test(abbrevCommit(commit.hash))))
						|| findPattern.test(commit.message)
						|| branchLabels.heads.some(head => findPattern!.test(head.name) || head.remotes.some(remote => findPattern!.test(remote)))
						|| branchLabels.remotes.some(remote => findPattern!.test(remote.name))
						|| commit.tags.some(tag => findPattern!.test(tag))
						|| (colVisibility.date && findPattern.test(getCommitDate(commit.date).value)))) {

						while (j < commits.length && commits[j].dataset.hash! !== commit.hash) j++;
						if (j === commits.length) continue;

						this.matches.push({ hash: commit.hash, elem: commits[j] });

						// Highlight matches
						let textElems = getChildNodesWithTextContent(commits[j]), textElem;
						for (let k = 0; k < textElems.length; k++) {
							textElem = textElems[k];
							let matchStart = 0, matchEnd = 0, text = textElem.textContent!, match: RegExpExecArray | null;
							findGlobalPattern.lastIndex = 0;
							while (match = findGlobalPattern.exec(text)) {
								if (match[0].length === 0) {
									zeroLengthMatch = true;
									break;
								}
								if (matchEnd !== match.index) {
									if (matchStart !== matchEnd) textElem.parentNode!.insertBefore(createFindMatchElem(text.substring(matchStart, matchEnd)), textElem);
									textElem.parentNode!.insertBefore(document.createTextNode(text.substring(matchEnd, match.index)), textElem);
									matchStart = match.index;
								}
								matchEnd = findGlobalPattern.lastIndex;
							}
							if (matchEnd > 0) {
								if (matchStart !== matchEnd) textElem.parentNode!.insertBefore(createFindMatchElem(text.substring(matchStart, matchEnd)), textElem);
								if (matchEnd !== text.length) {
									textElem.textContent = text.substring(matchEnd);
								} else {
									textElem.parentNode!.removeChild(textElem);
								}
							}
							if (zeroLengthMatch) break;
						}
						if (colVisibility.commit && commit.hash.search(findPattern) === 0 && !findPattern.test(abbrevCommit(commit.hash)) && textElems.length > 0) {
							// The commit matches on more than the abbreviated commit, so the commit should be highlighted
							let commitNode = textElems[textElems.length - 1]; // Commit is always the last column if it is visible
							commitNode.parentNode!.replaceChild(createFindMatchElem(commitNode.textContent!), commitNode);
						}
						if (zeroLengthMatch) break;
					}
				}
				if (zeroLengthMatch) {
					this.widgetElem.setAttribute(ATTR_ERROR, 'Cannot use a regular expression which has zero length matches');
					this.clearMatches();
					this.matches = [];
				}
			}
		} else {
			this.widgetElem.removeAttribute(ATTR_ERROR);
		}

		alterClass(this.prevElem, CLASS_DISABLED, this.matches.length === 0);
		alterClass(this.nextElem, CLASS_DISABLED, this.matches.length === 0);

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
				}

				// Combine current text with the text from next sibling text nodes
				node = matchElem.nextSibling;
				elem = matchElem.nextElementSibling;
				while (node !== null && node !== elem && node.textContent !== null) {
					text = text + node.textContent;
					matchElem.parentNode!.removeChild(node);
					node = matchElem.nextSibling;
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
		if (this.matches.length === 0) return;
		this.updatePosition(this.position > 0 ? this.position - 1 : this.matches.length - 1, true);
	}

	private next() {
		if (this.matches.length === 0) return;
		this.updatePosition(this.position < this.matches.length - 1 ? this.position + 1 : 0, true);
	}
}

function createFindMatchElem(text: string) {
	let span = document.createElement('span');
	span.className = CLASS_FIND_MATCH;
	span.innerHTML = text;
	return span;
}