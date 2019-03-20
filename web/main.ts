(function () {
	/* Constants */
	const vscode = acquireVsCodeApi();
	const svgIcons = {
		alert: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8.893 1.5c-.183-.31-.52-.5-.887-.5s-.703.19-.886.5L.138 13.499a.98.98 0 0 0 0 1.001c.193.31.53.501.886.501h13.964c.367 0 .704-.19.877-.5a1.03 1.03 0 0 0 .01-1.002L8.893 1.5zm.133 11.497H6.987v-2.003h2.039v2.003zm0-3.004H6.987V5.987h2.039v4.006z"/></svg>',
		branch: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="16" viewBox="0 0 10 16"><path fill-rule="evenodd" d="M10 5c0-1.11-.89-2-2-2a1.993 1.993 0 0 0-1 3.72v.3c-.02.52-.23.98-.63 1.38-.4.4-.86.61-1.38.63-.83.02-1.48.16-2 .45V4.72a1.993 1.993 0 0 0-1-3.72C.88 1 0 1.89 0 3a2 2 0 0 0 1 1.72v6.56c-.59.35-1 .99-1 1.72 0 1.11.89 2 2 2 1.11 0 2-.89 2-2 0-.53-.2-1-.53-1.36.09-.06.48-.41.59-.47.25-.11.56-.17.94-.17 1.05-.05 1.95-.45 2.75-1.25S8.95 7.77 9 6.73h-.02C9.59 6.37 10 5.73 10 5zM2 1.8c.66 0 1.2.55 1.2 1.2 0 .65-.55 1.2-1.2 1.2C1.35 4.2.8 3.65.8 3c0-.65.55-1.2 1.2-1.2zm0 12.41c-.66 0-1.2-.55-1.2-1.2 0-.65.55-1.2 1.2-1.2.65 0 1.2.55 1.2 1.2 0 .65-.55 1.2-1.2 1.2zm6-8c-.66 0-1.2-.55-1.2-1.2 0-.65.55-1.2 1.2-1.2.65 0 1.2.55 1.2 1.2 0 .65-.55 1.2-1.2 1.2z"/></svg>',
		close: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="16" viewBox="0 0 12 16"><path fill-rule="evenodd" d="M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z"/></svg>',
		tag: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="16" viewBox="0 0 15 16"><path fill-rule="evenodd" d="M7.73 1.73C7.26 1.26 6.62 1 5.96 1H3.5C2.13 1 1 2.13 1 3.5v2.47c0 .66.27 1.3.73 1.77l6.06 6.06c.39.39 1.02.39 1.41 0l4.59-4.59a.996.996 0 0 0 0-1.41L7.73 1.73zM2.38 7.09c-.31-.3-.47-.7-.47-1.13V3.5c0-.88.72-1.59 1.59-1.59h2.47c.42 0 .83.16 1.13.47l6.14 6.13-4.73 4.73-6.13-6.15zM3.01 3h2v2H3V3h.01z"/></svg>',
		loading: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 12 16"><path fill-rule="evenodd" d="M10.24 7.4a4.15 4.15 0 0 1-1.2 3.6 4.346 4.346 0 0 1-5.41.54L4.8 10.4.5 9.8l.6 4.2 1.31-1.26c2.36 1.74 5.7 1.57 7.84-.54a5.876 5.876 0 0 0 1.74-4.46l-1.75-.34zM2.96 5a4.346 4.346 0 0 1 5.41-.54L7.2 5.6l4.3.6-.6-4.2-1.31 1.26c-2.36-1.74-5.7-1.57-7.85.54C.5 5.03-.06 6.65.01 8.26l1.75.35A4.17 4.17 0 0 1 2.96 5z"/></svg>',
		openFolder: '<svg xmlns="http://www.w3.org/2000/svg" class="openFolderIcon" viewBox="0 0 30 30"><path d="M 5 4 C 3.895 4 3 4.895 3 6 L 3 9 L 3 11 L 22 11 L 27 11 L 27 8 C 27 6.895 26.105 6 25 6 L 12.199219 6 L 11.582031 4.9707031 C 11.221031 4.3687031 10.570187 4 9.8671875 4 L 5 4 z M 2.5019531 13 C 1.4929531 13 0.77040625 13.977406 1.0664062 14.941406 L 4.0351562 24.587891 C 4.2941563 25.426891 5.0692656 26 5.9472656 26 L 15 26 L 24.052734 26 C 24.930734 26 25.705844 25.426891 25.964844 24.587891 L 28.933594 14.941406 C 29.229594 13.977406 28.507047 13 27.498047 13 L 15 13 L 2.5019531 13 z"/></svg>',
		closedFolder: '<svg xmlns="http://www.w3.org/2000/svg" class="closedFolderIcon" viewBox="0 0 30 30"><path d="M 4 3 C 2.895 3 2 3.895 2 5 L 2 8 L 13 8 L 28 8 L 28 7 C 28 5.895 27.105 5 26 5 L 11.199219 5 L 10.582031 3.9707031 C 10.221031 3.3687031 9.5701875 3 8.8671875 3 L 4 3 z M 3 10 C 2.448 10 2 10.448 2 11 L 2 23 C 2 24.105 2.895 25 4 25 L 26 25 C 27.105 25 28 24.105 28 23 L 28 11 C 28 10.448 27.552 10 27 10 L 3 10 z"/></svg>',
		file: '<svg xmlns="http://www.w3.org/2000/svg" class="fileIcon" viewBox="0 0 30 30"><path d="M24.707,8.793l-6.5-6.5C18.019,2.105,17.765,2,17.5,2H7C5.895,2,5,2.895,5,4v22c0,1.105,0.895,2,2,2h16c1.105,0,2-0.895,2-2 V9.5C25,9.235,24.895,8.981,24.707,8.793z M18,10c-0.552,0-1-0.448-1-1V3.904L23.096,10H18z"/></svg>'
	};
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const htmlEscapes: { [key: string]: string } = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#x27;', '/': '&#x2F;' };
	const htmlUnescapes: { [key: string]: string } = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': '\'', '&#x2F;': '/' };
	const htmlEscaper = /[&<>"'\/]/g;
	const htmlUnescaper = /&lt;|&gt;|&amp;|&quot;|&#x27;|&#x2F;/g;
	const refInvalid = /^[-\/].*|[\\" ><~^:?*[]|\.\.|\/\/|\/\.|@{|[.\/]$|\.lock$|^@$/g;


	/* Classes */

	class GitGraphView {
		private gitRepos: string[];
		private gitBranches: string[] = [];
		private gitHead: string | null = null;
		private commits: GG.GitCommitNode[] = [];
		private commitLookup: { [hash: string]: number } = {};
		private currentBranch: string | null = null;
		private currentRepo: string;

		private graph: Graph;
		private config: Config;
		private moreCommitsAvailable: boolean = false;
		private showRemoteBranches: boolean = true;
		private expandedCommit: ExpandedCommit | null = null;
		private maxCommits: number;

		private tableElem: HTMLElement;
		private repoDropdown: Dropdown;
		private branchDropdown: Dropdown;
		private showRemoteBranchesElem: HTMLInputElement;

		private loadBranchesCallback: ((changes: boolean) => void) | null = null;
		private loadCommitsCallback: ((changes: boolean) => void) | null = null;

		constructor(repos: string[], config: Config, prevState: WebViewState | null) {
			this.gitRepos = repos;
			this.currentRepo = repos[0];
			this.config = config;
			this.maxCommits = config.initialLoadCommits;
			this.graph = new Graph('commitGraph', this.config);
			this.tableElem = document.getElementById('commitTable')!;
			this.repoDropdown = new Dropdown('repoSelect', (value) => {
				this.currentRepo = this.gitRepos[parseInt(value)];
				this.maxCommits = this.config.initialLoadCommits;
				this.expandedCommit = null;
				this.currentBranch = null;
				this.saveState();
				this.refresh(true);
			});
			this.branchDropdown = new Dropdown('branchSelect', (value => {
				this.currentBranch = value;
				this.maxCommits = this.config.initialLoadCommits;
				this.expandedCommit = null;
				this.saveState();
				this.renderShowLoading();
				this.requestLoadCommits(true, () => { });
			}))!;
			this.showRemoteBranchesElem = <HTMLInputElement>document.getElementById('showRemoteBranchesCheckbox')!;
			this.showRemoteBranchesElem.addEventListener('change', () => {
				this.showRemoteBranches = this.showRemoteBranchesElem.checked;
				this.saveState();
				this.refresh(true);
			});
			document.getElementById('refreshBtn')!.addEventListener('click', () => {
				this.refresh(true);
			});

			this.renderShowLoading();
			if (prevState) {
				this.currentBranch = prevState.currentBranch;
				this.showRemoteBranches = prevState.showRemoteBranches;
				this.showRemoteBranchesElem.checked = this.showRemoteBranches;
				if (this.gitRepos.indexOf(prevState.currentRepo) > -1) {
					this.currentRepo = prevState.currentRepo;
					this.maxCommits = prevState.maxCommits;
					this.expandedCommit = prevState.expandedCommit;
					if (prevState.commits.length > 0) this.loadCommits(prevState.commits, prevState.moreCommitsAvailable, true);
					if (prevState.gitBranches.length > 0 || prevState.gitHead !== null) this.loadBranches(prevState.gitBranches, prevState.gitHead, true);
				}
			}
			this.loadRepoOptions(this.gitRepos);
			this.requestLoadBranchesAndCommits(false);
		}

		/* Loading Data */
		public loadRepoOptions(repos: string[]) {
			this.gitRepos = repos;
			this.saveState();

			let curRepoIndex = this.gitRepos.indexOf(this.currentRepo), changedRepo = false;
			if (curRepoIndex === -1) {
				this.currentRepo = this.gitRepos[0];
				this.saveState();
				changedRepo = true;
			}

			let options = [], repoComps, i;
			for (i = 0; i < this.gitRepos.length; i++) {
				repoComps = this.gitRepos[i].split('/');
				options.push({ name: repoComps[repoComps.length - 1], value: i.toString() });
			}
			document.getElementById('repoControl')!.style.display = this.gitRepos.length > 1 ? 'inline' : 'none';
			this.repoDropdown.setOptions(options, curRepoIndex.toString());

			if (changedRepo) {
				this.refresh(true);
			}
		}

		public loadBranches(branchOptions: string[], branchHead: string | null, hard: boolean) {
			if (!hard && arraysEqual(this.gitBranches, branchOptions, (a, b) => a === b) && this.gitHead === branchHead) {
				this.triggerLoadBranchesCallback(false);
				return;
			}

			this.gitBranches = branchOptions;
			this.gitHead = branchHead;
			if (this.currentBranch === null || (this.currentBranch !== '' && this.gitBranches.indexOf(this.currentBranch) === -1)) {
				this.currentBranch = this.config.showCurrentBranchByDefault && this.gitHead !== null ? this.gitHead : '';
			}
			this.saveState();

			let options = [{ name: 'Show All', value: '' }];
			for (let i = 0; i < this.gitBranches.length; i++) {
				options.push({ name: this.gitBranches[i].indexOf('remotes/') === 0 ? this.gitBranches[i].substring(8) : this.gitBranches[i], value: this.gitBranches[i] });
			}
			this.branchDropdown.setOptions(options, this.currentBranch);

			this.triggerLoadBranchesCallback(true);
		}
		private triggerLoadBranchesCallback(changes: boolean) {
			if (this.loadBranchesCallback !== null) {
				this.loadBranchesCallback(changes);
				this.loadBranchesCallback = null;
			}
		}

		public loadCommits(commits: GG.GitCommitNode[], moreAvailable: boolean, hard: boolean) {
			if (!hard && this.moreCommitsAvailable === moreAvailable && arraysEqual(this.commits, commits, (a, b) => a.hash === b.hash && a.current === b.current && arraysEqual(a.refs, b.refs, (a, b) => a.name === b.name && a.type === b.type) && arraysEqual(a.parentHashes, b.parentHashes, (a, b) => a === b))) {
				if (this.commits.length > 0 && this.commits[0].hash === '*') {
					this.commits[0] = commits[0];
					this.saveState();
					this.renderUncommitedChanges();
				}
				this.triggerLoadCommitsCallback(false);
				return;
			}

			this.moreCommitsAvailable = moreAvailable;
			this.commits = commits;
			this.commitLookup = {};
			this.saveState();

			let i: number, expandedCommitVisible = false;
			for (i = 0; i < this.commits.length; i++) {
				this.commitLookup[this.commits[i].hash] = i;
				if (this.expandedCommit !== null && this.expandedCommit.hash === this.commits[i].hash) expandedCommitVisible = true;
			}

			this.graph.loadCommits(this.commits, this.commitLookup);

			if (this.expandedCommit !== null && !expandedCommitVisible) {
				this.expandedCommit = null;
				this.saveState();
			}
			this.render();

			this.triggerLoadCommitsCallback(true);
		}
		private triggerLoadCommitsCallback(changes: boolean) {
			if (this.loadCommitsCallback !== null) {
				this.loadCommitsCallback(changes);
				this.loadCommitsCallback = null;
			}
		}

		/* Refresh */
		public refresh(hard: boolean) {
			if (hard) {
				if (this.expandedCommit !== null) {
					this.expandedCommit = null;
					this.saveState();
				}
				this.renderShowLoading();
			}
			this.requestLoadBranchesAndCommits(hard);
		}

		/* Requests */
		private requestLoadBranches(hard: boolean, loadedCallback: (changes: boolean) => void) {
			if (this.loadBranchesCallback !== null) return;
			this.loadBranchesCallback = loadedCallback;
			sendMessage({ command: 'loadBranches', repo: this.currentRepo!, showRemoteBranches: this.showRemoteBranches, hard: hard });
		}
		private requestLoadCommits(hard: boolean, loadedCallback: (changes: boolean) => void) {
			if (this.loadCommitsCallback !== null) return;
			this.loadCommitsCallback = loadedCallback;
			sendMessage({
				command: 'loadCommits',
				repo: this.currentRepo!,
				branchName: (this.currentBranch !== null ? this.currentBranch : ''),
				maxCommits: this.maxCommits,
				showRemoteBranches: this.showRemoteBranches,
				hard: hard
			});
		}
		private requestLoadBranchesAndCommits(hard: boolean) {
			this.requestLoadBranches(hard, (branchChanges: boolean) => {
				this.requestLoadCommits(hard, (commitChanges: boolean) => {
					if (!hard && (branchChanges || commitChanges)) {
						hideDialogAndContextMenu();
					}
				});
			});
		}

		/* State */
		private saveState() {
			vscode.setState({
				gitRepos: this.gitRepos,
				gitBranches: this.gitBranches,
				gitHead: this.gitHead,
				commits: this.commits,
				currentBranch: this.currentBranch,
				currentRepo: this.currentRepo,
				moreCommitsAvailable: this.moreCommitsAvailable,
				maxCommits: this.maxCommits,
				showRemoteBranches: this.showRemoteBranches,
				expandedCommit: this.expandedCommit
			});
		}

		/* Renderers */
		private render() {
			this.renderGraph();
			this.renderTable();
		}
		private renderGraph() {
			this.graph.render(this.expandedCommit);
		}
		private renderTable() {
			let html = '<tr><th id="tableHeaderGraphCol">Graph</th><th>Description</th><th>Date</th><th>Author</th><th>Commit</th></tr>', i;
			for (i = 0; i < this.commits.length; i++) {
				let refs = '', message = escapeHtml(this.commits[i].message), date = getCommitDate(this.commits[i].date), j, refName;
				for (j = 0; j < this.commits[i].refs.length; j++) {
					refName = escapeHtml(this.commits[i].refs[j].name);
					refs += '<span class="gitRef ' + this.commits[i].refs[j].type + '" data-name="' + refName + '">' + (this.commits[i].refs[j].type === 'tag' ? svgIcons.tag : svgIcons.branch).replace('viewBox', 'class="colour' + this.graph.getVertexColour(i) + '" viewBox') + refName + '</span>';
				}

				html += '<tr ' + (this.commits[i].hash !== '*' ? 'class="commit" data-hash="' + this.commits[i].hash + '"' : 'class="unsavedChanges"') + ' data-id="' + i + '"><td></td><td>' + refs + (this.commits[i].hash !== '*' ? message : '<b>' + message + '</b>') + '</td><td title="' + date.title + '">' + date.value + '</td><td title="' + escapeHtml(this.commits[i].author + ' <' + this.commits[i].email + '>') + '">' + escapeHtml(this.commits[i].author) + '</td><td title="' + escapeHtml(this.commits[i].hash) + '">' + abbrevCommit(this.commits[i].hash) + '</td></tr>';
			}
			if (this.moreCommitsAvailable) {
				html += '<tr><td colspan="5"><div id="loadMoreCommitsBtn" class="roundedBtn">Load More Commits</div></td></tr>';
			}
			this.tableElem.innerHTML = '<table>' + html + '</table>';

			document.getElementById('tableHeaderGraphCol')!.style.padding = '0 ' + Math.round((Math.max(this.graph.getWidth() + 16, 64) - (document.getElementById('tableHeaderGraphCol')!.offsetWidth - 24)) / 2) + 'px';

			if (this.moreCommitsAvailable) {
				document.getElementById('loadMoreCommitsBtn')!.addEventListener('click', () => {
					(<HTMLElement>document.getElementById('loadMoreCommitsBtn')!.parentNode!).innerHTML = '<h2 id="loadingHeader">' + svgIcons.loading + 'Loading ...</h2>';
					this.maxCommits += this.config.loadMoreCommits;
					this.hideCommitDetails();
					this.saveState();
					this.requestLoadCommits(true, () => { });
				});
			}

			if (this.expandedCommit !== null) {
				let elem = null, elems = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName('commit');
				for (i = 0; i < elems.length; i++) {
					if (this.expandedCommit.hash === elems[i].dataset.hash) {
						elem = elems[i];
						break;
					}
				}
				if (elem === null) {
					this.expandedCommit = null;
					this.saveState();
				} else {
					this.expandedCommit.id = parseInt(elem.dataset.id!);
					this.expandedCommit.srcElem = elem;
					this.saveState();
					if (this.expandedCommit.commitDetails !== null && this.expandedCommit.fileTree !== null) {
						this.showCommitDetails(this.expandedCommit.commitDetails, this.expandedCommit.fileTree);
					} else {
						this.loadCommitDetails(elem);
					}
				}
			}

			addListenerToClass('commit', 'contextmenu', (e: Event) => {
				e.stopPropagation();
				let sourceElem = <HTMLElement>(<Element>e.target).closest('.commit')!;
				let hash = sourceElem.dataset.hash!;
				showContextMenu(<MouseEvent>e, [
					{
						title: 'Add Tag',
						onClick: () => {
							showInputDialog('Enter the name of the tag you would like to add to commit <b><i>' + abbrevCommit(hash) + '</i></b>:', '', 'Add Tag', (name) => {
								sendMessage({ command: 'addTag', repo: this.currentRepo!, tagName: name, commitHash: hash });
							}, sourceElem);
						}
					},
					{
						title: 'Create Branch from this Commit',
						onClick: () => {
							showInputDialog('Enter the name of the branch you would like to create from commit <b><i>' + abbrevCommit(hash) + '</i></b>:', '', 'Create Branch', (name) => {
								sendMessage({ command: 'createBranch', repo: this.currentRepo!, branchName: name, commitHash: hash });
							}, sourceElem);
						}
					},
					null,
					{
						title: 'Checkout this Commit',
						onClick: () => {
							showConfirmationDialog('Are you sure you want to checkout commit <b><i>' + abbrevCommit(hash) + '</i></b>? This will result in a \'detached HEAD\' state.', () => {
								sendMessage({ command: 'checkoutCommit', repo: this.currentRepo!, commitHash: hash });
							}, sourceElem);
						}
					},
					{
						title: 'Cherry Pick this Commit',
						onClick: () => {
							if (this.commits[this.commitLookup[hash]].parentHashes.length === 1) {
								showConfirmationDialog('Are you sure you want to cherry pick commit <b><i>' + abbrevCommit(hash) + '</i></b>?', () => {
									sendMessage({ command: 'cherrypickCommit', repo: this.currentRepo!, commitHash: hash, parentIndex: 0 });
								}, sourceElem);
							} else {
								let options = this.commits[this.commitLookup[hash]].parentHashes.map((hash, index) => ({
									name: abbrevCommit(hash) + (typeof this.commitLookup[hash] === 'number' ? ': ' + this.commits[this.commitLookup[hash]].message : ''),
									value: (index + 1).toString()
								}));
								showSelectDialog('Are you sure you want to cherry pick merge commit <b><i>' + abbrevCommit(hash) + '</i></b>? Choose the parent hash on the main branch, to cherry pick the commit relative to:', '1', options, 'Yes, cherry pick commit', (parentIndex) => {
									sendMessage({ command: 'cherrypickCommit', repo: this.currentRepo!, commitHash: hash, parentIndex: parseInt(parentIndex) });
								}, sourceElem);
							}
						}
					},
					{
						title: 'Revert this Commit',
						onClick: () => {
							if (this.commits[this.commitLookup[hash]].parentHashes.length === 1) {
								showConfirmationDialog('Are you sure you want to revert commit <b><i>' + abbrevCommit(hash) + '</i></b>?', () => {
									sendMessage({ command: 'revertCommit', repo: this.currentRepo!, commitHash: hash, parentIndex: 0 });
								}, sourceElem);
							} else {
								let options = this.commits[this.commitLookup[hash]].parentHashes.map((hash, index) => ({
									name: abbrevCommit(hash) + (typeof this.commitLookup[hash] === 'number' ? ': ' + this.commits[this.commitLookup[hash]].message : ''),
									value: (index + 1).toString()
								}));
								showSelectDialog('Are you sure you want to revert merge commit <b><i>' + abbrevCommit(hash) + '</i></b>? Choose the parent hash on the main branch, to revert the commit relative to:', '1', options, 'Yes, revert commit', (parentIndex) => {
									sendMessage({ command: 'revertCommit', repo: this.currentRepo!, commitHash: hash, parentIndex: parseInt(parentIndex) });
								}, sourceElem);
							}
						}
					},
					null,
					{
						title: 'Merge into current branch',
						onClick: () => {
							showCheckboxDialog('Are you sure you want to merge commit <b><i>' + abbrevCommit(hash) + '</i></b> into the current branch?', 'Create a new commit even if fast-forward is possible', true, 'Yes, merge', (createNewCommit) => {
								sendMessage({ command: 'mergeCommit', repo: this.currentRepo!, commitHash: hash, createNewCommit: createNewCommit });
							}, null);
						}
					},
					{
						title: 'Reset current branch to this Commit',
						onClick: () => {
							showSelectDialog('Are you sure you want to reset the <b>current branch</b> to commit <b><i>' + abbrevCommit(hash) + '</i></b>?', 'mixed', [
								{ name: 'Soft - Keep all changes, but reset head', value: 'soft' },
								{ name: 'Mixed - Keep working tree, but reset index', value: 'mixed' },
								{ name: 'Hard - Discard all changes', value: 'hard' }
							], 'Yes, reset', (mode) => {
								sendMessage({ command: 'resetToCommit', repo: this.currentRepo!, commitHash: hash, resetMode: <GG.GitResetMode>mode });
							}, sourceElem);
						}
					},
					null,
					{
						title: 'Copy Commit Hash to Clipboard',
						onClick: () => {
							sendMessage({ command: 'copyCommitHashToClipboard', repo: this.currentRepo!, commitHash: hash });
						}
					}
				], sourceElem);
			});
			addListenerToClass('commit', 'click', (e: Event) => {
				let sourceElem = <HTMLElement>(<Element>e.target).closest('.commit')!;
				if (this.expandedCommit !== null && this.expandedCommit.hash === sourceElem.dataset.hash!) {
					this.hideCommitDetails();
				} else {
					this.loadCommitDetails(sourceElem);
				}
			});
			addListenerToClass('gitRef', 'contextmenu', (e: Event) => {
				e.stopPropagation();
				let sourceElem = <HTMLElement>(<Element>e.target).closest('.gitRef')!;
				let refName = unescapeHtml(sourceElem.dataset.name!), menu;
				if (sourceElem.classList.contains('tag')) {
					menu = [{
						title: 'Delete Tag',
						onClick: () => {
							showConfirmationDialog('Are you sure you want to delete the tag <b><i>' + escapeHtml(refName) + '</i></b>?', () => {
								sendMessage({ command: 'deleteTag', repo: this.currentRepo!, tagName: refName });
							}, null);
						}
					}, {
						title: 'Push Tag',
						onClick: () => {
							showConfirmationDialog('Are you sure you want to push the tag <b><i>' + escapeHtml(refName) + '</i></b>?', () => {
								sendMessage({ command: 'pushTag', repo: this.currentRepo!, tagName: refName });
								showActionRunningDialog('Pushing Tag');
							}, null);
						}
					}];
				} else {
					menu = [{
						title: 'Checkout Branch',
						onClick: () => this.checkoutBranchAction(sourceElem, refName)
					}];
					if (sourceElem.classList.contains('head')) {
						menu.push(
							{
								title: 'Rename Branch',
								onClick: () => {
									showInputDialog('Enter the new name for branch <b><i>' + escapeHtml(refName) + '</i></b>:', refName, 'Rename Branch', (newName) => {
										sendMessage({ command: 'renameBranch', repo: this.currentRepo!, oldName: refName, newName: newName });
									}, null);
								}
							}, {
								title: 'Delete Branch',
								onClick: () => {
									showCheckboxDialog('Are you sure you want to delete the branch <b><i>' + escapeHtml(refName) + '</i></b>?', 'Force Delete', false, 'Delete Branch', (forceDelete) => {
										sendMessage({ command: 'deleteBranch', repo: this.currentRepo!, branchName: refName, forceDelete: forceDelete });
									}, null);
								}
							}
						);
						if (this.gitHead !== refName) {
							menu.push({
								title: 'Merge into current branch',
								onClick: () => {
									showCheckboxDialog('Are you sure you want to merge branch <b><i>' + escapeHtml(refName) + '</i></b> into the current branch?', 'Create a new commit even if fast-forward is possible', true, 'Yes, merge', (createNewCommit) => {
										sendMessage({ command: 'mergeBranch', repo: this.currentRepo!, branchName: refName, createNewCommit: createNewCommit });
									}, null);
								}
							});
						}
					}
				}
				showContextMenu(<MouseEvent>e, menu, sourceElem);
			});
			addListenerToClass('gitRef', 'click', (e: Event) => e.stopPropagation());
			addListenerToClass('gitRef', 'dblclick', (e: Event) => {
				e.stopPropagation();
				let sourceElem = <HTMLElement>(<Element>e.target).closest('.gitRef')!;
				this.checkoutBranchAction(sourceElem, unescapeHtml(sourceElem.dataset.name!));
			});
		}
		private renderUncommitedChanges() {
			let date = getCommitDate(this.commits[0].date);
			document.getElementsByClassName('unsavedChanges')[0].innerHTML = '<td></td><td><b>' + escapeHtml(this.commits[0].message) + '</b></td><td title="' + date.title + '">' + date.value + '</td><td title="* <>">*</td><td title="*">*</td>';
		}
		private renderShowLoading() {
			hideDialogAndContextMenu();
			this.graph.clear();
			this.tableElem.innerHTML = '<table><tr><th id="tableHeaderGraphCol">Graph</th><th>Description</th><th>Date</th><th>Author</th><th>Commit</th></tr></table><h2 id="loadingHeader">' + svgIcons.loading + 'Loading ...</h2>';
		}
		private checkoutBranchAction(sourceElem: HTMLElement, refName: string) {
			if (sourceElem.classList.contains('head')) {
				sendMessage({ command: 'checkoutBranch', repo: this.currentRepo!, branchName: refName, remoteBranch: null });
			} else if (sourceElem.classList.contains('remote')) {
				let refNameComps = refName.split('/');
				showInputDialog('Enter the name of the new branch you would like to create when checking out <b><i>' + escapeHtml(sourceElem.dataset.name!) + '</i></b>:', refNameComps[refNameComps.length - 1], 'Checkout Branch', (newBranch) => {
					sendMessage({ command: 'checkoutBranch', repo: this.currentRepo!, branchName: newBranch, remoteBranch: refName });
				}, null);
			}
		}

		/* Commit Details */
		private loadCommitDetails(sourceElem: HTMLElement) {
			this.hideCommitDetails();
			this.expandedCommit = { id: parseInt(sourceElem.dataset.id!), hash: sourceElem.dataset.hash!, srcElem: sourceElem, commitDetails: null, fileTree: null };
			this.saveState();
			sendMessage({ command: 'commitDetails', repo: this.currentRepo!, commitHash: sourceElem.dataset.hash! });
		}
		public hideCommitDetails() {
			if (this.expandedCommit !== null) {
				let elem = document.getElementById('commitDetails');
				if (typeof elem === 'object' && elem !== null) elem.remove();
				if (typeof this.expandedCommit.srcElem === 'object' && this.expandedCommit.srcElem !== null) this.expandedCommit.srcElem.classList.remove('commitDetailsOpen');
				this.expandedCommit = null;
				this.saveState();
				this.renderGraph();
			}
		}
		public showCommitDetails(commitDetails: GG.GitCommitDetails, fileTree: GitFolder) {
			if (this.expandedCommit === null || this.expandedCommit.srcElem === null || this.expandedCommit.hash !== commitDetails.hash) return;
			let elem = document.getElementById('commitDetails');
			if (typeof elem === 'object' && elem !== null) elem.remove();

			this.expandedCommit.commitDetails = commitDetails;
			this.expandedCommit.fileTree = fileTree;
			this.expandedCommit.srcElem.classList.add('commitDetailsOpen');
			this.saveState();

			let newElem = document.createElement('tr'), html = '<td></td><td colspan="4"><div id="commitDetailsSummary">';
			html += '<b>Commit: </b>' + escapeHtml(commitDetails.hash) + '<br>';
			html += '<b>Parents: </b>' + commitDetails.parents.join(', ') + '<br>';
			html += '<b>Author: </b>' + escapeHtml(commitDetails.author) + ' &lt;<a href="mailto:' + encodeURIComponent(commitDetails.email) + '">' + escapeHtml(commitDetails.email) + '</a>&gt;<br>';
			html += '<b>Date: </b>' + (new Date(commitDetails.date * 1000)).toString() + '<br>';
			html += '<b>Committer: </b>' + escapeHtml(commitDetails.committer) + '<br><br>';
			html += escapeHtml(commitDetails.body).replace(/\n/g, '<br>') + '</div>';
			html += '<div id="commitDetailsFiles">' + generateGitFileTreeHtml(fileTree, commitDetails.fileChanges) + '</table></div>';
			html += '<div id="commitDetailsClose">' + svgIcons.close + '</div>';
			html += '</td>';

			newElem.id = 'commitDetails';
			newElem.innerHTML = html;

			this.renderGraph();
			insertAfter(newElem, this.expandedCommit.srcElem);

			if (this.config.autoCenterCommitDetailsView) {
				// Center Commit Detail View setting is enabled
				// control menu height [40px] + newElem.y + (commit details view height [250px] + commit height [24px]) / 2 - (window height) / 2
				window.scrollTo(0, newElem.offsetTop + 177 - window.innerHeight / 2);
			} else if (newElem.offsetTop + 8 < window.pageYOffset) {
				// Commit Detail View is opening above what is visible on screen
				// control menu height [40px] + newElem y - commit height [24px] - desired gap from top [8px] < pageYOffset
				window.scrollTo(0, newElem.offsetTop + 8);
			} else if (newElem.offsetTop + expandedCommitHeight - window.innerHeight + 48 > window.pageYOffset) {
				// Commit Detail View is opening below what is visible on screen
				// control menu height [40px] + newElem y + commit details view height [250px] + desired gap from bottom [8px] - window height > pageYOffset
				window.scrollTo(0, newElem.offsetTop + expandedCommitHeight - window.innerHeight + 48);
			}

			document.getElementById('commitDetailsClose')!.addEventListener('click', () => {
				this.hideCommitDetails();
			});
			addListenerToClass('gitFolder', 'click', (e) => {
				let sourceElem = <HTMLElement>(<Element>e.target!).closest('.gitFolder');
				let parent = sourceElem.parentElement!;
				parent.classList.toggle('closed');
				let isOpen = !parent.classList.contains('closed');
				parent.children[0].children[0].innerHTML = isOpen ? svgIcons.openFolder : svgIcons.closedFolder;
				parent.children[1].classList.toggle('hidden');
				alterGitFileTree(this.expandedCommit!.fileTree!, decodeURIComponent(sourceElem.dataset.folderpath!), isOpen);
				this.saveState();
			});
			addListenerToClass('gitFile', 'click', (e) => {
				let sourceElem = <HTMLElement>(<Element>e.target).closest('.gitFile')!;
				if (this.expandedCommit === null || !sourceElem.classList.contains('gitDiffPossible')) return;
				sendMessage({ command: 'viewDiff', repo: this.currentRepo!, commitHash: this.expandedCommit.hash, oldFilePath: decodeURIComponent(sourceElem.dataset.oldfilepath!), newFilePath: decodeURIComponent(sourceElem.dataset.newfilepath!), type: <GG.GitFileChangeType>sourceElem.dataset.type });
			});
		}
	}

	let contextMenu = document.getElementById('contextMenu')!, contextMenuSource: HTMLElement | null = null;
	let dialog = document.getElementById('dialog')!, dialogBacking = document.getElementById('dialogBacking')!, dialogMenuSource: HTMLElement | null = null;
	let gitGraph = new GitGraphView(settings.repos, {
		autoCenterCommitDetailsView: settings.autoCenterCommitDetailsView,
		graphColours: settings.graphColours,
		graphStyle: settings.graphStyle,
		grid: { x: 16, y: 24, offsetX: 8, offsetY: 12 },
		initialLoadCommits: settings.initialLoadCommits,
		loadMoreCommits: settings.loadMoreCommits,
		showCurrentBranchByDefault: settings.showCurrentBranchByDefault
	}, vscode.getState());


	/* Command Processing */
	window.addEventListener('message', event => {
		const msg: GG.ResponseMessage = event.data;
		switch (msg.command) {
			case 'addTag':
				refreshGraphOrDisplayError(msg.status, 'Unable to Add Tag');
				break;
			case 'checkoutBranch':
				refreshGraphOrDisplayError(msg.status, 'Unable to Checkout Branch');
				break;
			case 'checkoutCommit':
				refreshGraphOrDisplayError(msg.status, 'Unable to Checkout Commit');
				break;
			case 'cherrypickCommit':
				refreshGraphOrDisplayError(msg.status, 'Unable to Cherry Pick Commit');
				break;
			case 'commitDetails':
				if (msg.commitDetails === null) {
					gitGraph.hideCommitDetails();
					showErrorDialog('Unable to load commit details', null, null);
				} else {
					gitGraph.showCommitDetails(msg.commitDetails, generateGitFileTree(msg.commitDetails.fileChanges));
				}
				break;
			case 'copyCommitHashToClipboard':
				if (msg.success === false) showErrorDialog('Unable to Copy Commit Hash to Clipboard', null, null);
				break;
			case 'createBranch':
				refreshGraphOrDisplayError(msg.status, 'Unable to Create Branch');
				break;
			case 'deleteBranch':
				refreshGraphOrDisplayError(msg.status, 'Unable to Delete Branch');
				break;
			case 'deleteTag':
				refreshGraphOrDisplayError(msg.status, 'Unable to Delete Tag');
				break;
			case 'loadBranches':
				gitGraph.loadBranches(msg.branches, msg.head, msg.hard);
				break;
			case 'loadCommits':
				gitGraph.loadCommits(msg.commits, msg.moreCommitsAvailable, msg.hard);
				break;
			case 'loadRepos':
				gitGraph.loadRepoOptions(msg.repos);
				break;
			case 'mergeBranch':
				refreshGraphOrDisplayError(msg.status, 'Unable to Merge Branch');
				break;
			case 'mergeCommit':
				refreshGraphOrDisplayError(msg.status, 'Unable to Merge Commit');
				break;
			case 'pushTag':
				refreshGraphOrDisplayError(msg.status, 'Unable to Push Tag');
				break;
			case 'renameBranch':
				refreshGraphOrDisplayError(msg.status, 'Unable to Rename Branch');
				break;
			case 'refresh':
				gitGraph.refresh(false);
				break;
			case 'resetToCommit':
				refreshGraphOrDisplayError(msg.status, 'Unable to Reset to Commit');
				break;
			case 'revertCommit':
				refreshGraphOrDisplayError(msg.status, 'Unable to Revert Commit');
				break;
			case 'viewDiff':
				if (msg.success === false) showErrorDialog('Unable to view diff of file', null, null);
				break;
		}
	});
	function refreshGraphOrDisplayError(status: GG.GitCommandStatus, errorMessage: string) {
		if (status === null) {
			gitGraph.refresh(true);
		} else {
			showErrorDialog(errorMessage, status, null);
		}
	}
	function sendMessage(msg: GG.RequestMessage) {
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
				let diff = Math.round((new Date()).getTime() / 1000) - dateVal, unit;
				if (diff < 60) {
					unit = 'second';
				} else if (diff < 3600) {
					unit = 'minute';
					diff /= 60;
				} else if (diff < 86400) {
					unit = 'hour';
					diff /= 3600;
				} else if (diff < 604800) {
					unit = 'day';
					diff /= 86400;
				} else if (diff < 2629800) {
					unit = 'week';
					diff /= 604800;
				} else if (diff < 31557600) {
					unit = 'month';
					diff /= 2629800;
				} else {
					unit = 'year';
					diff /= 31557600;
				}
				diff = Math.round(diff);
				value = diff + ' ' + unit + (diff !== 1 ? 's' : '') + ' ago';
				break;
			default:
				value = dateStr + ' ' + timeStr;
		}
		return { title: dateStr + ' ' + timeStr, value: value };
	}
	function pad2(i: number) {
		return i > 9 ? i : '0' + i;
	}

	/* Utils */
	function generateGitFileTree(gitFiles: GG.GitFileChange[]) {
		let contents: GitFolderContents = {}, i, j, path, cur: GitFolder;
		let files: GitFolder = { type: 'folder', name: '', folderPath: '', contents: contents, open: true };
		for (i = 0; i < gitFiles.length; i++) {
			cur = files;
			path = gitFiles[i].newFilePath.split('/');
			for (j = 0; j < path.length; j++) {
				if (j < path.length - 1) {
					if (typeof cur.contents[path[j]] === 'undefined') {
						contents = {};
						cur.contents[path[j]] = { type: 'folder', name: path[j], folderPath: path.slice(0, j + 1).join('/'), contents: contents, open: true };
					}
					cur = <GitFolder>cur.contents[path[j]];
				} else {
					cur.contents[path[j]] = { type: 'file', name: path[j], index: i };
				}
			}
		}
		return files;
	}
	function generateGitFileTreeHtml(folder: GitFolder, gitFiles: GG.GitFileChange[]) {
		let html = (folder.name !== '' ? '<span class="gitFolder" data-folderpath="' + encodeURIComponent(folder.folderPath) + '"><span class="gitFolderIcon">' + (folder.open ? svgIcons.openFolder : svgIcons.closedFolder) + '</span><span class="gitFolderName">' + folder.name + '</span></span>' : '') + '<ul class="gitFolderContents' + (!folder.open ? ' hidden' : '') + '">', keys = Object.keys(folder.contents), i, gitFile, gitFolder;
		keys.sort((a, b) => folder.contents[a].type === 'folder' && folder.contents[b].type === 'file' ? -1 : folder.contents[a].type === 'file' && folder.contents[b].type === 'folder' ? 1 : folder.contents[a].name < folder.contents[b].name ? -1 : folder.contents[a].name > folder.contents[b].name ? 1 : 0);
		for (i = 0; i < keys.length; i++) {
			if (folder.contents[keys[i]].type === 'folder') {
				gitFolder = <GitFolder>folder.contents[keys[i]];
				html += '<li' + (!gitFolder.open ? ' class="closed"' : '') + '>' + generateGitFileTreeHtml(gitFolder, gitFiles) + '</li>';
			} else {
				gitFile = gitFiles[(<GitFile>(folder.contents[keys[i]])).index];
				html += '<li class="gitFile ' + gitFile.type + (gitFile.additions !== null && gitFile.deletions !== null ? ' gitDiffPossible' : '') + '" data-oldfilepath="' + encodeURIComponent(gitFile.oldFilePath) + '" data-newfilepath="' + encodeURIComponent(gitFile.newFilePath) + '" data-type="' + gitFile.type + '"' + (gitFile.additions === null || gitFile.deletions === null ? ' title="This is a binary file, unable to view diff."' : '') + '><span class="gitFileIcon">' + svgIcons.file + '</span>' + folder.contents[keys[i]].name + (gitFile.type === 'R' ? ' <span class="gitFileRename" title="' + escapeHtml(gitFile.oldFilePath + ' was renamed to ' + gitFile.newFilePath) + '">R</span>' : '') + (gitFile.type !== 'A' && gitFile.type !== 'D' && gitFile.additions !== null && gitFile.deletions !== null ? '<span class="gitFileAddDel">(<span class="gitFileAdditions" title="' + gitFile.additions + ' addition' + (gitFile.additions !== 1 ? 's' : '') + '">+' + gitFile.additions + '</span>|<span class="gitFileDeletions" title="' + gitFile.deletions + ' deletion' + (gitFile.deletions !== 1 ? 's' : '') + '">-' + gitFile.deletions + '</span>)</span>' : '') + '</li>';
			}
		}
		return html + '</ul>';
	}
	function alterGitFileTree(folder: GitFolder, folderPath: string, open: boolean) {
		let path = folderPath.split('/'), i, cur = folder;
		for (i = 0; i < path.length; i++) {
			if (typeof cur.contents[path[i]] !== 'undefined') {
				cur = <GitFolder>cur.contents[path[i]];
				if (i === path.length - 1) {
					cur.open = open;
					return;
				}
			} else {
				return;
			}
		}
	}
	function abbrevCommit(commitHash: string) {
		return commitHash.substring(0, 8);
	}
	function arraysEqual<T>(a: T[], b: T[], equalElements: (a: T, b: T) => boolean) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!equalElements(a[i], b[i])) return false;
		}
		return true;
	}


	/* HTML Escape / Unescape */
	function escapeHtml(str: string) {
		return str.replace(htmlEscaper, (match) => htmlEscapes[match]);
	}
	function unescapeHtml(str: string) {
		return str.replace(htmlUnescaper, (match) => htmlUnescapes[match]);
	}


	/* DOM Helpers */
	function addListenerToClass(className: string, event: string, eventListener: EventListener) {
		let elems = document.getElementsByClassName(className), i;
		for (i = 0; i < elems.length; i++) {
			elems[i].addEventListener(event, eventListener);
		}
	}
	function insertAfter(newNode: HTMLElement, referenceNode: HTMLElement) {
		referenceNode.parentNode!.insertBefore(newNode, referenceNode.nextSibling);
	}


	/* Context Menu */
	function showContextMenu(e: MouseEvent, items: ContextMenuElement[], sourceElem: HTMLElement) {
		let html = '', i: number, event = <MouseEvent>e;
		for (i = 0; i < items.length; i++) {
			html += items[i] !== null ? '<li class="contextMenuItem" data-index="' + i + '">' + items[i]!.title + '</li>' : '<li class="contextMenuDivider"></li>';
		}

		hideContextMenuListener();
		contextMenu.style.opacity = '0';
		contextMenu.className = 'active';
		contextMenu.innerHTML = html;
		let bounds = contextMenu.getBoundingClientRect();
		contextMenu.style.left = ((event.pageX - window.pageXOffset) + bounds.width < window.innerWidth ? event.pageX - 2 : event.pageX - bounds.width + 2) + 'px';
		contextMenu.style.top = ((event.pageY - window.pageYOffset) + bounds.height < window.innerHeight ? event.pageY - 2 : event.pageY - bounds.height + 2) + 'px';
		contextMenu.style.opacity = '1';

		addListenerToClass('contextMenuItem', 'click', (e) => {
			e.stopPropagation();
			hideContextMenu();
			items[parseInt((<HTMLElement>(e.target)).dataset.index!)]!.onClick();
		});

		contextMenuSource = sourceElem;
		contextMenuSource.classList.add('contextMenuActive');
	}
	function hideContextMenu() {
		contextMenu.className = '';
		contextMenu.innerHTML = '';
		contextMenu.style.left = '0px';
		contextMenu.style.top = '0px';
		if (contextMenuSource !== null) {
			contextMenuSource.classList.remove('contextMenuActive');
			contextMenuSource = null;
		}
	}


	/* Dialogs */
	function showConfirmationDialog(message: string, confirmed: () => void, sourceElem: HTMLElement | null) {
		showDialog(message, 'Yes', 'No', () => {
			hideDialog();
			confirmed();
		}, sourceElem);
	}
	function showInputDialog(message: string, defaultValue: string, actionName: string, actioned: (value: string) => void, sourceElem: HTMLElement | null) {
		showDialog(message + '<br><input id="dialogInput" type="text"/>', actionName, 'Cancel', () => {
			if (dialog.className === 'active noInput' || dialog.className === 'active inputInvalid') return;
			let value = dialogInput.value;
			hideDialog();
			actioned(value);
		}, sourceElem);

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
				dialogAction.title = invalidInput ? 'Unable to ' + actionName + ', one or more invalid characters entered.' : '';
			}
		});
	}
	function showCheckboxDialog(message: string, checkboxLabel: string, checkboxValue: boolean, actionName: string, actioned: (value: boolean) => void, sourceElem: HTMLElement | null) {
		showDialog(message + '<br><label><input id="dialogInput" type="checkbox"' + (checkboxValue ? ' checked' : '') + '/>' + checkboxLabel + '</label>', actionName, 'Cancel', () => {
			let value = (<HTMLInputElement>document.getElementById('dialogInput')).checked;
			hideDialog();
			actioned(value);
		}, sourceElem);
	}
	function showSelectDialog(message: string, defaultValue: string, options: { name: string, value: string }[], actionName: string, actioned: (value: string) => void, sourceElem: HTMLElement | null) {
		let selectOptions = '', i;
		for (i = 0; i < options.length; i++) {
			selectOptions += '<option value="' + options[i].value + '"' + (options[i].value === defaultValue ? ' selected' : '') + '>' + options[i].name + '</option>';
		}
		showDialog(message + '<br><select id="dialogInput">' + selectOptions + '</select>', actionName, 'Cancel', () => {
			let value = (<HTMLSelectElement>document.getElementById('dialogInput')).value;
			hideDialog();
			actioned(value);
		}, sourceElem);
	}
	function showErrorDialog(message: string, reason: string | null, sourceElem: HTMLElement | null) {
		showDialog(svgIcons.alert + 'Error: ' + message + (reason !== null ? '<br><span class="errorReason">' + escapeHtml(reason).split('\n').join('<br>') + '</span>' : ''), null, 'Dismiss', null, sourceElem);
	}
	function showActionRunningDialog(command: string) {
		showDialog('<span id="actionRunning">' + svgIcons.loading + command + ' ...</span>', null, 'Dismiss', null, null);
	}
	function showDialog(html: string, actionName: string | null, dismissName: string, actioned: (() => void) | null, sourceElem: HTMLElement | null) {
		dialogBacking.className = 'active';
		dialog.className = 'active';
		dialog.innerHTML = html + '<br>' + (actionName !== null ? '<div id="dialogAction" class="roundedBtn">' + actionName + '</div>' : '') + '<div id="dialogDismiss" class="roundedBtn">' + dismissName + '</div>';
		if (actionName !== null && actioned !== null) document.getElementById('dialogAction')!.addEventListener('click', actioned);
		document.getElementById('dialogDismiss')!.addEventListener('click', hideDialog);

		dialogMenuSource = sourceElem;
		if (dialogMenuSource !== null) dialogMenuSource.classList.add('dialogActive');
	}
	function hideDialog() {
		dialogBacking.className = '';
		dialog.className = '';
		dialog.innerHTML = '';
		if (dialogMenuSource !== null) {
			dialogMenuSource.classList.remove('dialogActive');
			dialogMenuSource = null;
		}
	}

	function hideDialogAndContextMenu() {
		if (dialog.classList.contains('active')) hideDialog();
		if (contextMenu.classList.contains('active')) hideContextMenu();
	}

	/* Global Listeners */
	document.addEventListener('keyup', (e) => {
		if (e.key === 'Escape') {
			hideDialogAndContextMenu();
		}
	});
	document.addEventListener('click', hideContextMenuListener);
	document.addEventListener('contextmenu', hideContextMenuListener);
	document.addEventListener('mouseleave', hideContextMenuListener);
	function hideContextMenuListener() {
		if (contextMenu.classList.contains('active')) hideContextMenu();
	}
}());