declare function acquireVsCodeApi(): any;

declare var settings: GitGraphViewSettings;

declare interface Point {
	x: number;
	y: number;
}

declare interface Line {
	p1: Point;
	p2: Point;
	isCommitted: boolean;
}

declare interface Config {
	grid: { x: number, y: number, offsetX: number, offsetY: number };
	colours: string[];
	graphStyle: 'rounded' | 'angular';
	initialLoadCommits: number;
	loadMoreCommits: number;
}

declare interface ContextMenuItem {
	title: string;
	onClick: () => void;
}

(function () {
	const vscode = acquireVsCodeApi();
	const svgIcons = {
		alert: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8.893 1.5c-.183-.31-.52-.5-.887-.5s-.703.19-.886.5L.138 13.499a.98.98 0 0 0 0 1.001c.193.31.53.501.886.501h13.964c.367 0 .704-.19.877-.5a1.03 1.03 0 0 0 .01-1.002L8.893 1.5zm.133 11.497H6.987v-2.003h2.039v2.003zm0-3.004H6.987V5.987h2.039v4.006z"/></svg>',
		branch: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="16" viewBox="0 0 10 16"><path fill-rule="evenodd" d="M10 5c0-1.11-.89-2-2-2a1.993 1.993 0 0 0-1 3.72v.3c-.02.52-.23.98-.63 1.38-.4.4-.86.61-1.38.63-.83.02-1.48.16-2 .45V4.72a1.993 1.993 0 0 0-1-3.72C.88 1 0 1.89 0 3a2 2 0 0 0 1 1.72v6.56c-.59.35-1 .99-1 1.72 0 1.11.89 2 2 2 1.11 0 2-.89 2-2 0-.53-.2-1-.53-1.36.09-.06.48-.41.59-.47.25-.11.56-.17.94-.17 1.05-.05 1.95-.45 2.75-1.25S8.95 7.77 9 6.73h-.02C9.59 6.37 10 5.73 10 5zM2 1.8c.66 0 1.2.55 1.2 1.2 0 .65-.55 1.2-1.2 1.2C1.35 4.2.8 3.65.8 3c0-.65.55-1.2 1.2-1.2zm0 12.41c-.66 0-1.2-.55-1.2-1.2 0-.65.55-1.2 1.2-1.2.65 0 1.2.55 1.2 1.2 0 .65-.55 1.2-1.2 1.2zm6-8c-.66 0-1.2-.55-1.2-1.2 0-.65.55-1.2 1.2-1.2.65 0 1.2.55 1.2 1.2 0 .65-.55 1.2-1.2 1.2z"/></svg>',
		tag: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="16" viewBox="0 0 15 16"><path fill-rule="evenodd" d="M7.73 1.73C7.26 1.26 6.62 1 5.96 1H3.5C2.13 1 1 2.13 1 3.5v2.47c0 .66.27 1.3.73 1.77l6.06 6.06c.39.39 1.02.39 1.41 0l4.59-4.59a.996.996 0 0 0 0-1.41L7.73 1.73zM2.38 7.09c-.31-.3-.47-.7-.47-1.13V3.5c0-.88.72-1.59 1.59-1.59h2.47c.42 0 .83.16 1.13.47l6.14 6.13-4.73 4.73-6.13-6.15zM3.01 3h2v2H3V3h.01z"/></svg>',
		loading: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 12 16"><path fill-rule="evenodd" d="M10.24 7.4a4.15 4.15 0 0 1-1.2 3.6 4.346 4.346 0 0 1-5.41.54L4.8 10.4.5 9.8l.6 4.2 1.31-1.26c2.36 1.74 5.7 1.57 7.84-.54a5.876 5.876 0 0 0 1.74-4.46l-1.75-.34zM2.96 5a4.346 4.346 0 0 1 5.41-.54L7.2 5.6l4.3.6-.6-4.2-1.31 1.26c-2.36-1.74-5.7-1.57-7.85.54C.5 5.03-.06 6.65.01 8.26l1.75.35A4.17 4.17 0 0 1 2.96 5z"/></svg>'
	};
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const htmlEscapes: { [key: string]: string } = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		'\'': '&#x27;',
		'/': '&#x2F;'
	};
	const htmlUnescapes: { [key: string]: string } = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#x27;': '\'',
		'&#x2F;': '/'
	};
	const htmlEscaper = /[&<>"'\/]/g;
	const htmlUnescaper = /&lt;|&gt;|&amp;|&quot;|&#x27;|&#x2F;/g;
	const refInvalid = /^[-\/].*|[\\" ><~^:?*[]|\.\.|\/\/|\/\.|@{|[.\/]$|\.lock$|^@$/g;

	class Branch {
		private nodes: Node[];
		private lines: Line[];
		private colour: number;
		private end: number;

		constructor(colour: number) {
			this.nodes = [];
			this.lines = [];
			this.colour = colour;
			this.end = 0;
		}

		public addNode(node: Node) {
			this.nodes.push(node);
		}
		public addLine(p1: Point, p2: Point, isCommitted: boolean) {
			this.lines.push({ p1: p1, p2: p2, isCommitted: isCommitted });
		}
		public addLines(lines: Line[]) {
			for (let i = 0; i < lines.length; i++) {
				this.lines.push(lines[i]);
			}
		}
		public isMergeOnly() {
			return this.nodes.length === 2 && this.nodes[0].isMerge() && !this.nodes[0].isOnThisBranch(this) && !this.nodes[1].isOnThisBranch(this);
		}
		public simplifyMergeOnly() {
			let lastParent = this.nodes[0].getLastParent();
			if (lastParent === null) return;

			let connectsToBranch = lastParent.getBranch();
			if (connectsToBranch !== null) {
				connectsToBranch.addLines(this.lines);
			}
		}
		public getColour() {
			return this.colour;
		}
		public getEnd() {
			return this.end;
		}
		public setEnd(end: number) {
			this.end = end;
		}
		public draw(svg: SVGElement, config: Config) {
			this.simplifyVerticalLines();
			let colour = config.colours[this.colour % config.colours.length], i;
			for (i = 0; i < this.lines.length; i++) {
				this.drawLine(svg, this.lines[i].p1.x * config.grid.x + config.grid.offsetX, this.lines[i].p1.y * config.grid.y + config.grid.offsetY, this.lines[i].p2.x * config.grid.x + config.grid.offsetX, this.lines[i].p2.y * config.grid.y + config.grid.offsetY, this.lines[i].isCommitted ? colour : '#808080', config);
			}
		}
		private drawLine(svg: SVGElement, x1: number, y1: number, x2: number, y2: number, colour: string, config: Config) {
			let line1 = document.createElementNS('http://www.w3.org/2000/svg', 'path'), line2 = document.createElementNS('http://www.w3.org/2000/svg', 'path'), path;
			if (x1 === x2) {
				path = 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2;
			} else {
				if (config.graphStyle === 'angular') {
					path = 'M ' + x1 + ' ' + y1 + ' L ' + (x1 < x2 ? (x2 + ' ' + (y2 - config.grid.y * 0.38)) : (x1 + ' ' + (y1 + config.grid.y * 0.38))) + ' L ' + x2 + ' ' + y2;
				} else {
					path = 'M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + (y1 + config.grid.y * 0.8) + ' ' + x2 + ' ' + (y2 - config.grid.y * 0.8) + ' ' + x2 + ' ' + y2;
				}
			}

			line1.setAttribute('class', 'shaddow');
			line1.setAttribute('d', path);
			svg.appendChild(line1);

			line2.setAttribute('class', 'line');
			line2.setAttribute('d', path);
			line2.setAttribute('stroke', colour);
			svg.appendChild(line2);
		}
		private simplifyVerticalLines() {
			let i = 0;
			while (i < this.lines.length - 1) {
				if (this.lines[i].p1.x === this.lines[i].p2.x && this.lines[i].p2.x === this.lines[i + 1].p1.x && this.lines[i + 1].p1.x === this.lines[i + 1].p2.x && this.lines[i].p2.y === this.lines[i + 1].p1.y && this.lines[i].isCommitted === this.lines[i + 1].isCommitted) {
					this.lines[i].p2.y = this.lines[i + 1].p2.y;
					this.lines.splice(i + 1, 1);
				} else {
					i++;
				}
			}
		}
	}

	class Node {
		private x: number;
		private y: number;
		private parents: Node[];
		private nextParent: number;
		private onBranch: Branch | null;
		private isCommitted: boolean;
		private isCurrent: boolean;
		private nextX: number;

		constructor(y: number, isCommitted: boolean, isCurrent: boolean) {
			this.x = 0;
			this.y = y;
			this.parents = [];
			this.nextParent = 0;
			this.onBranch = null;
			this.isCommitted = isCommitted;
			this.isCurrent = isCurrent;
			this.nextX = 0;
		}

		public addParent(node: Node) {
			this.parents.push(node);
		}
		public hasParents() {
			return this.parents.length > 0;
		}
		public getNextParent(): Node | null {
			if (this.nextParent < this.parents.length) return this.parents[this.nextParent];
			return null;
		}
		public getLastParent(): Node | null {
			if (this.nextParent < 1) return null;
			return this.parents[this.nextParent - 1];
		}
		public registerParentProcessed() {
			this.nextParent++;
		}
		public isMerge() {
			return this.parents.length > 1;
		}

		public addToBranch(branch: Branch, x: number) {
			branch.addNode(this);
			if (this.onBranch === null) {
				this.onBranch = branch;
				this.x = x;
			}
		}
		public isNotOnBranch() {
			return this.onBranch === null;
		}
		public isOnThisBranch(branch: Branch) {
			return this.onBranch === branch;
		}
		public getBranch() {
			return this.onBranch;
		}

		public getPoint(): Point {
			return { x: this.x, y: this.y };
		}
		public getNextPoint(): Point {
			return { x: this.nextX, y: this.y };
		}
		public getIsCommitted() {
			return this.isCommitted;
		}
		public setNextX(x: number) {
			if (x > this.nextX) this.nextX = x;
		}

		public draw(svg: SVGElement, config: Config) {
			if (this.onBranch === null) return;

			let circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			let colour = this.isCommitted ? config.colours[this.onBranch.getColour() % config.colours.length] : '#808080';
			circle.setAttribute('cx', (this.x * config.grid.x + config.grid.offsetX).toString());
			circle.setAttribute('cy', (this.y * config.grid.y + config.grid.offsetY).toString());
			circle.setAttribute('r', '4');
			if (this.isCurrent) {
				circle.setAttribute('class', 'current');
				circle.setAttribute('stroke', colour);
			} else {
				circle.setAttribute('fill', colour);
			}

			svg.appendChild(circle);
		}
	}

	class GitGraph {
		private branchOptions: string[];
		private commits: GitCommitNode[];
		private selectedBranch: string | null;
		private maxCommits: number;
		private moreCommitsAvailable: boolean;
		private showRemoteBranches: boolean;

		private config: Config;
		private nodes: Node[];
		private branches: Branch[];
		private availableColours: number[];
		private graphElem: HTMLElement;
		private tableElem: HTMLElement;
		private branchSelectElem: HTMLSelectElement;
		private showRemoteBranchesElem: HTMLInputElement;

		constructor(config: Config, previousState: any) {
			this.branchOptions = [];
			this.commits = [];
			this.selectedBranch = null;
			this.maxCommits = config.initialLoadCommits;
			this.moreCommitsAvailable = false;
			this.showRemoteBranches = true;

			this.config = config;
			this.nodes = [];
			this.branches = [];
			this.availableColours = [];
			this.graphElem = document.getElementById('commitGraph')!;
			this.tableElem = document.getElementById('commitTable')!;
			this.branchSelectElem = <HTMLSelectElement>document.getElementById('branchSelect')!;
			this.showRemoteBranchesElem = <HTMLInputElement>document.getElementById('showRemoteBranchesCheckbox')!;

			this.branchSelectElem.addEventListener('change', () => {
				this.selectedBranch = this.branchSelectElem.value;
				this.maxCommits = this.config.initialLoadCommits;
				this.saveState();
				this.showLoading();
				this.requestLoadCommits();
			});
			this.showRemoteBranchesElem.addEventListener('change', () => {
				this.showRemoteBranches = this.showRemoteBranchesElem.checked;
				this.saveState();
				this.refresh();
			});
			document.getElementById('refreshBtn')!.addEventListener('click', () => {
				this.refresh();
			});

			this.showLoading();
			if (previousState) {
				if (typeof previousState.selectedBranch !== 'undefined') {
					this.selectedBranch = previousState.selectedBranch;
				}
				if (typeof previousState.showRemoteBranches !== 'undefined') {
					this.showRemoteBranches = previousState.showRemoteBranches;
					this.showRemoteBranchesElem.checked = this.showRemoteBranches;
				}
				if (typeof previousState.maxCommits !== 'undefined') {
					this.maxCommits = previousState.maxCommits;
				}
				if (typeof previousState.commits !== 'undefined') {
					this.loadCommits(previousState.commits, previousState.moreCommitsAvailable);
				}
				if (typeof previousState.branchOptions !== 'undefined') {
					this.loadBranchOptions(previousState.branchOptions);
				}
			}
			this.requestLoadBranchOptions();
		}

		public loadBranchOptions(branchOptions: string[]) {
			this.branchOptions = branchOptions;
			if (this.selectedBranch !== null && this.branchOptions.indexOf(this.selectedBranch) === -1) this.selectedBranch = '';
			this.saveState();

			let html = '<option' + (this.selectedBranch === null || this.selectedBranch === '' ? ' selected' : '') + ' value="">Show All</option>';
			for (let i = 0; i < this.branchOptions.length; i++) {
				html += '<option value="' + this.branchOptions[i] + '"' + (this.selectedBranch === this.branchOptions[i] ? ' selected' : '') + '>' + (this.branchOptions[i].indexOf('remotes/') === 0 ? this.branchOptions[i].substring(8) : this.branchOptions[i]) + '</option>';
			}
			this.branchSelectElem.innerHTML = html;
			this.requestLoadCommits();
		}

		public loadCommits(commits: GitCommitNode[], moreAvailable: boolean) {
			this.moreCommitsAvailable = moreAvailable;
			this.commits = commits;
			this.saveState();

			this.nodes = [];
			this.branches = [];
			this.availableColours = [];

			let i: number, j: number;
			for (i = 0; i < this.commits.length; i++) {
				this.nodes.push(new Node(i, this.commits[i].hash !== '*', this.commits[i].current));
			}
			for (i = 0; i < this.commits.length; i++) {
				for (j = 0; j < this.commits[i].parents.length; j++) {
					this.nodes[i].addParent(this.nodes[this.commits[i].parents[j]]);
				}
			}

			while ((i = this.findStart()) !== -1) {
				this.determinePath(i);
			}

			this.render();
		}

		public refresh() {
			this.showLoading();
			this.requestLoadBranchOptions();
		}

		private requestLoadBranchOptions() {
			sendMessage({ command: 'loadBranches', data: { showRemoteBranches: this.showRemoteBranches } });
		}

		private requestLoadCommits() {
			sendMessage({
				command: 'loadCommits',
				data: {
					branch: (this.selectedBranch !== null ? this.selectedBranch : ''),
					maxCommits: this.maxCommits,
					showRemoteBranches: this.showRemoteBranches,
					currentBranch: this.branchOptions.length > 0 ? this.branchOptions[0] : null
				}
			});
		}

		private saveState() {
			vscode.setState({
				branchOptions: this.branchOptions,
				commits: this.commits,
				selectedBranch: this.selectedBranch,
				maxCommits: this.maxCommits,
				showRemoteBranches: this.showRemoteBranches
			});
		}

		private determinePath(startAt: number) {
			let i = startAt;
			let branch = new Branch(this.getAvailableColour(startAt));
			let node = this.nodes[i], parentNode = this.nodes[i].getNextParent();
			let lastPoint = node.isNotOnBranch() ? node.getNextPoint() : node.getPoint(), curPoint;

			node.addToBranch(branch, lastPoint.x);
			for (i = startAt + 1; i < this.nodes.length; i++) {
				curPoint = parentNode === this.nodes[i] && !parentNode.isNotOnBranch() ? this.nodes[i].getPoint() : this.nodes[i].getNextPoint();
				branch.addLine(lastPoint, curPoint, node.getIsCommitted());
				lastPoint = curPoint;
				this.nodes[i].setNextX(curPoint.x + 1);

				if (parentNode === this.nodes[i]) {
					node.registerParentProcessed();
					let parentNodeOnBranch = !parentNode.isNotOnBranch();
					parentNode.addToBranch(branch, curPoint.x);
					node = parentNode;
					parentNode = node.getNextParent();
					if (parentNodeOnBranch) break;
				}
			}
			branch.setEnd(i);

			if (branch.isMergeOnly()) {
				branch.simplifyMergeOnly();
			} else {
				this.branches.push(branch);
				this.availableColours[branch.getColour()] = branch.getEnd();
			}
		}
		private findStart() {
			for (let i = 0; i < this.nodes.length; i++) {
				if (this.nodes[i].getNextParent() !== null || this.nodes[i].isNotOnBranch()) return i;
			}
			return -1;
		}
		private getAvailableColour(startAt: number) {
			for (let i = 0; i < this.availableColours.length; i++) {
				if (startAt > this.availableColours[i]) {
					return i;
				}
			}
			this.availableColours.push(0);
			return this.availableColours.length - 1;
		}
		private getWidth() {
			let x = 0, i, p;
			for (i = 0; i < this.nodes.length; i++) {
				p = this.nodes[i].getPoint();
				if (p.x > x) x = p.x;
			}
			return (x + 1) * this.config.grid.x;
		}
		private getHeight() {
			return this.nodes.length * this.config.grid.y;
		}
		private render() {
			let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), graphWidth = this.getWidth(), i;
			svg.setAttribute('width', graphWidth.toString());
			svg.setAttribute('height', this.getHeight().toString());

			for (i = 0; i < this.branches.length; i++) {
				this.branches[i].draw(svg, this.config);
			}
			for (i = 0; i < this.nodes.length; i++) {
				this.nodes[i].draw(svg, this.config);
			}

			if (this.graphElem.firstChild) {
				this.graphElem.removeChild(this.graphElem.firstChild);
			}
			this.graphElem.appendChild(svg);

			let html = '<tr><th id="tableHeaderGraphCol">Graph</th><th>Description</th><th>Date</th><th>Author</th><th>Commit</th></tr>';
			for (i = 0; i < this.commits.length; i++) {
				let refs = '', message = escapeHtml(this.commits[i].message), date = getCommitDate(this.commits[i].date), j, refName;
				for (j = 0; j < this.commits[i].refs.length; j++) {
					refName = escapeHtml(this.commits[i].refs[j].name);
					refs += '<span class="gitRef ' + this.commits[i].refs[j].type + '" data-name="' + refName + '">' + (this.commits[i].refs[j].type === 'tag' ? svgIcons.tag : svgIcons.branch) + refName + '</span>';
				}

				html += '<tr ' + (this.commits[i].hash !== '*' ? 'class="commit" data-hash="' + this.commits[i].hash + '"' : '') + '><td></td><td>' + refs + (this.commits[i].hash !== '*' ? message : '<b>' + message + '</b>') + '</td><td title="' + date.title + '">' + date.value + '</td><td title="' + escapeHtml(this.commits[i].author + ' <' + this.commits[i].email + '>') + '">' + escapeHtml(this.commits[i].author) + '</td><td title="' + escapeHtml(this.commits[i].hash) + '">' + escapeHtml(this.commits[i].hash.substring(0, 8)) + '</td></tr>';
			}
			if (this.moreCommitsAvailable) {
				html += '<tr class="noHighlight"><td colspan="5"><div id="loadMoreCommitsBtn" class="roundedBtn">Load More Commits</div></td></tr>';
			}
			this.tableElem.innerHTML = '<table>' + html + '</table>';

			document.getElementById('tableHeaderGraphCol')!.style.padding = '0 ' + Math.round((Math.max(graphWidth + 16, 64) - (document.getElementById('tableHeaderGraphCol')!.offsetWidth - 24)) / 2) + 'px';

			if (this.moreCommitsAvailable) {
				document.getElementById('loadMoreCommitsBtn')!.addEventListener('click', () => {
					(<HTMLElement>document.getElementById('loadMoreCommitsBtn')!.parentNode!).innerHTML = '<h2 id="loadingHeader">' + svgIcons.loading + 'Loading ...</h2>';
					this.maxCommits += this.config.loadMoreCommits;
					this.saveState();
					this.requestLoadCommits();
				});
			}

			addListenerToClass('commit', 'contextmenu', (e: Event) => {
				e.stopPropagation();
				let sourceElement = <HTMLElement>(<Element>e.target).closest('.commit')!;
				let hash = sourceElement.dataset.hash!;
				showContextMenu(<MouseEvent>e, [
					{
						title: 'Add Tag',
						onClick: () => {
							showInputDialog('Enter the name of the tag you would like to add to commit <b><i>' + hash.substring(0, 8) + '</i></b>:', '', 'Add Tag', (name: string) => {
								sendMessage({ command: 'addTag', data: { tagName: name, commitHash: hash } });
							});
						}
					},
					{
						title: 'Create Branch from Commit',
						onClick: () => {
							showInputDialog('Enter the name of the branch you would like to create from commit <b><i>' + hash.substring(0, 8) + '</i></b>:', '', 'Create Branch', (name: string) => {
								sendMessage({ command: 'createBranch', data: { branchName: name, commitHash: hash } });
							});
						}
					},
					{
						title: 'Copy Commit Hash to Clipboard',
						onClick: () => {
							hideContextMenu();
							sendMessage({ command: 'copyCommitHashToClipboard', data: hash });
						}
					}
				], sourceElement);
			});
			addListenerToClass('gitRef', 'contextmenu', (e: Event) => {
				e.stopPropagation();
				let sourceElement = <HTMLElement>(<Element>e.target).closest('.gitRef')!;
				let refName = unescapeHtml(sourceElement.dataset.name!), menu;
				if (sourceElement.className === 'gitRef tag') {
					menu = [{
						title: 'Delete Tag',
						onClick: () => {
							showConfirmationDialog('Are you sure you want to delete the tag <b><i>' + escapeHtml(refName) + '</i></b>?', () => {
								sendMessage({ command: 'deleteTag', data: refName });
							});
						}
					}];
				} else {
					menu = [{
						title: 'Checkout Branch',
						onClick: () => {
							if (sourceElement.className === 'gitRef head') {
								sendMessage({ command: 'checkoutBranch', data: { branchName: refName, remoteBranch: null } });
							} else if (sourceElement.className === 'gitRef remote') {
								let refNameComps = refName.split('/');
								showInputDialog('Enter the name of the new branch you would like to create when checking out <b><i>' + escapeHtml(sourceElement.dataset.name!) + '</i></b>:', refNameComps[refNameComps.length - 1], 'Checkout Branch', (newBranch) => {
									sendMessage({ command: 'checkoutBranch', data: { branchName: newBranch, remoteBranch: refName } });
								});
							}
						}
					}];
					if (sourceElement.className === 'gitRef head') {
						menu.push({
							title: 'Rename Branch',
							onClick: () => {
								showInputDialog('Enter the new name for branch <b><i>' + escapeHtml(refName) + '</i></b>:', refName, 'Rename Branch', (newName) => {
									sendMessage({ command: 'renameBranch', data: { oldName: refName, newName: newName } });
								});
							}
						});
						menu.push({
							title: 'Delete Branch',
							onClick: () => {
								showCheckboxDialog('Are you sure you want to delete the branch <b><i>' + escapeHtml(refName) + '</i></b>?', 'Force Delete', 'Delete Branch', (forceDelete) => {
									sendMessage({ command: 'deleteBranch', data: { branchName: refName, forceDelete: forceDelete } });
								});
							}
						});
					}
				}
				showContextMenu(<MouseEvent>e, menu, sourceElement);
			});
		}
		private showLoading() {
			if (this.graphElem.firstChild) {
				this.graphElem.removeChild(this.graphElem.firstChild);
			}
			this.tableElem.innerHTML = '<table><tr><th id="tableHeaderGraphCol">Graph</th><th>Description</th><th>Date</th><th>Author</th><th>Commit</th></tr></table><h2 id="loadingHeader">' + svgIcons.loading + 'Loading ...</h2>';
		}
	}

	let gitGraph = new GitGraph({
		grid: { x: 16, y: 24, offsetX: 8, offsetY: 12 },
		colours: settings.graphColours,
		graphStyle: settings.graphStyle,
		initialLoadCommits: settings.initialLoadCommits,
		loadMoreCommits: settings.loadMoreCommits
	}, vscode.getState());

	window.addEventListener('message', event => {
		const msg: ResponseMessage = event.data;
		switch (msg.command) {
			case 'loadBranches':
				gitGraph.loadBranchOptions(msg.data);
				return;
			case 'loadCommits':
				gitGraph.loadCommits(msg.data.commits, msg.data.moreCommitsAvailable);
				break;
			case 'addTag':
				refreshGraphOrDisplayError(msg.data, 'Unable to Add Tag');
				break;
			case 'deleteTag':
				refreshGraphOrDisplayError(msg.data, 'Unable to Delete Tag');
				break;
			case 'copyCommitHashToClipboard':
				if (msg.data === false) showErrorDialog('Unable to Copy Commit Hash to Clipboard', null);
				break;
			case 'createBranch':
				refreshGraphOrDisplayError(msg.data, 'Unable to Create Branch');
				break;
			case 'checkoutBranch':
				refreshGraphOrDisplayError(msg.data, 'Unable to Checkout Branch');
				break;
			case 'deleteBranch':
				refreshGraphOrDisplayError(msg.data, 'Unable to Delete Branch');
				break;
			case 'renameBranch':
				refreshGraphOrDisplayError(msg.data, 'Unable to Rename Branch');
				break;
		}
	});
	function refreshGraphOrDisplayError(status: GitCommandStatus, errorMessage: string) {
		if (status === null) {
			gitGraph.refresh();
		} else {
			showErrorDialog(errorMessage, status);
		}
	}

	function sendMessage(msg: RequestMessage) {
		vscode.postMessage(msg);
	}

	/* Dates */
	function getCommitDate(dateVal: number) {
		let date = new Date(dateVal * 1000), value;
		let dateStr = date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
		let timeStr = pad2(date.getHours()) + ':' + pad2(date.getMinutes());

		switch (settings.dateFormat) {
			case 'Date Only':
				value = dateStr;
				break;
			case 'Relative':
				let diff = Math.round((new Date()).getTime() / 1000) - dateVal;
				if (diff < 60) {
					value = diff + ' second' + (diff !== 1 ? 's' : '') + ' ago';
				} else if (diff < 3600) {
					diff = Math.round(diff / 60);
					value = diff + ' minute' + (diff !== 1 ? 's' : '') + ' ago';
				} else if (diff < 86400) {
					diff = Math.round(diff / 3600);
					value = diff + ' hour' + (diff !== 1 ? 's' : '') + ' ago';
				} else if (diff < 604800) {
					diff = Math.round(diff / 86400);
					value = diff + ' day' + (diff !== 1 ? 's' : '') + ' ago';
				} else if (diff < 2629800) {
					diff = Math.round(diff / 604800);
					value = diff + ' week' + (diff !== 1 ? 's' : '') + ' ago';
				} else if (diff < 31557600) {
					diff = Math.round(diff / 2629800);
					value = diff + ' month' + (diff !== 1 ? 's' : '') + ' ago';
				} else {
					diff = Math.round(diff / 31557600);
					value = diff + ' year' + (diff !== 1 ? 's' : '') + ' ago';
				}
				break;
			default:
				value = dateStr + ' ' + timeStr;
		}
		return { title: dateStr + ' ' + timeStr, value: value };
	}
	function pad2(i: number) {
		return i > 9 ? i : '0' + i;
	}

	/* HTML Escape / Unescape */
	function escapeHtml(str: string) {
		return str.replace(htmlEscaper, function (match) {
			return htmlEscapes[match];
		});
	}
	function unescapeHtml(str: string) {
		return str.replace(htmlUnescaper, function (match) {
			return htmlUnescapes[match];
		});
	}

	/* DOM Helpers */
	function addListenerToClass(className: string, event: string, eventListener: EventListener) {
		let elems = document.getElementsByClassName(className), i;
		for (i = 0; i < elems.length; i++) {
			elems[i].addEventListener(event, eventListener);
		}
	}

	/* Context Menu */
	let contextMenu = document.getElementById('contextMenu')!, contextMenuSource: HTMLElement | null = null;
	function showContextMenu(e: MouseEvent, items: ContextMenuItem[], sourceElement: HTMLElement) {
		let html = '', i: number, event = <MouseEvent>e;
		for (i = 0; i < items.length; i++) {
			html += '<li class="contextMenuItem" data-index="' + i + '">' + items[i].title + '</li>';
		}

		contextMenu.style.opacity = '0';
		contextMenu.className = 'active';
		contextMenu.innerHTML = html;
		let bounds = contextMenu.getBoundingClientRect();
		contextMenu.style.left = ((event.pageX - window.pageXOffset) + bounds.width < window.innerWidth ? event.pageX - 2 : event.pageX - bounds.width + 2) + 'px';
		contextMenu.style.top = ((event.pageY - window.pageYOffset) + bounds.height < window.innerHeight ? event.pageY - 2 : event.pageY - bounds.height + 2) + 'px';
		contextMenu.style.opacity = '1';

		addListenerToClass('contextMenuItem', 'click', (e) => {
			hideContextMenu();
			items[parseInt((<HTMLElement>(e.target)).dataset.index!)].onClick();
		});
		contextMenu.addEventListener('mouseleave', hideContextMenu);

		contextMenuSource = sourceElement;
		contextMenuSource.className += ' contextMenuActive';
	}
	function hideContextMenu() {
		contextMenu.className = '';
		contextMenu.innerHTML = '';
		contextMenu.style.left = '0px';
		contextMenu.style.top = '0px';
		contextMenu.removeEventListener('mouseleave', hideContextMenu);
		if (contextMenuSource !== null) contextMenuSource.className = contextMenuSource.className.replace(' contextMenuActive', '');
	}

	/* Dialogs */
	let dialog = document.getElementById('dialog')!, dialogBacking = document.getElementById('dialogBacking')!;
	function showConfirmationDialog(message: string, confirmed: () => void) {
		dialogBacking.className = 'active';
		dialog.className = 'active';
		dialog.innerHTML = message + '<br><div id="dialogYes" class="roundedBtn">Yes</div><div id="dialogNo" class="roundedBtn">No</div>';
		document.getElementById('dialogYes')!.addEventListener('click', () => {
			hideDialog();
			confirmed();
		});
		document.getElementById('dialogNo')!.addEventListener('click', hideDialog);
	}
	function showInputDialog(message: string, defaultValue: string, action: string, actioned: (value: string) => void) {
		dialogBacking.className = 'active';
		dialog.className = 'active';
		dialog.innerHTML = message + '<br><input id="dialogInput" type="text"/><br><div id="dialogAction" class="roundedBtn">' + action + '</div><div id="dialogCancel" class="roundedBtn">Cancel</div>';
		let dialogInput = <HTMLInputElement>document.getElementById('dialogInput'), dialogAction = document.getElementById('dialogAction')!;
		if (defaultValue !== '') {
			dialogInput.value = defaultValue;
		} else {
			dialog.className = 'active noInput';
		}
		dialogInput.focus();

		dialogInput.addEventListener('keyup', () => {
			let noInput = dialogInput.value === '', invalidInput = dialogInput.value.match(refInvalid) !== null;
			let newClassName = 'active' + (noInput ? ' noInput' : invalidInput ? ' inputInvalid' : '');
			if (dialog.className !== newClassName) {
				dialog.className = newClassName;
				dialogAction.title = invalidInput ? 'Unable to ' + action + ', one or more invalid characters entered.' : '';
			}
		});
		dialogAction.addEventListener('click', () => {
			if (dialog.className === 'active noInput' || dialog.className === 'active inputInvalid') return;
			let value = dialogInput.value;
			hideDialog();
			actioned(value);
		});
		document.getElementById('dialogCancel')!.addEventListener('click', hideDialog);
	}
	function showCheckboxDialog(message: string, checkboxLabel: string, action: string, actioned: (value: boolean) => void) {
		dialogBacking.className = 'active';
		dialog.className = 'active';
		dialog.innerHTML = message + '<br><label><input id="dialogInput" type="checkbox"/>' + checkboxLabel + '</label><br><div id="dialogAction" class="roundedBtn">' + action + '</div><div id="dialogCancel" class="roundedBtn">Cancel</div>';
		document.getElementById('dialogAction')!.addEventListener('click', () => {
			let value = (<HTMLInputElement>document.getElementById('dialogInput')).checked;
			hideDialog();
			actioned(value);
		});
		document.getElementById('dialogCancel')!.addEventListener('click', hideDialog);
	}
	function showErrorDialog(message: string, reason: string | null) {
		dialogBacking.className = 'active';
		dialog.className = 'active';
		dialog.innerHTML = svgIcons.alert + 'Error: ' + message + (reason !== null ? '<br><span class="errorReason">' + escapeHtml(reason).split('\n').join('<br>') + '</span>' : '') + '<br><div id="dialogDismiss" class="roundedBtn">Dismiss</div>';
		document.getElementById('dialogDismiss')!.addEventListener('click', hideDialog);
	}
	function hideDialog() {
		dialogBacking.className = '';
		dialog.className = '';
		dialog.innerHTML = '';
	}
}());