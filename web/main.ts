class GitGraphView {
	private gitRepos: GG.GitRepoSet;
	private gitBranches: string[] = [];
	private gitBranchHead: string | null = null;
	private gitRemotes: string[] = [];
	private commits: GG.GitCommitNode[] = [];
	private commitHead: string | null = null;
	private commitLookup: { [hash: string]: number } = {};
	private avatars: AvatarImageCollection = {};
	private currentBranches: string[] | null = null;
	private currentRepo!: string;

	private graph: Graph;
	private config: Config;
	private moreCommitsAvailable: boolean = false;
	private showRemoteBranches: boolean = true;
	private expandedCommit: ExpandedCommit | null = null;
	private maxCommits: number;
	private scrollTop = 0;
	private renderedGitBranchHead: string | null = null;

	private viewElem: HTMLElement;
	private controlsElem: HTMLElement;
	private tableElem: HTMLElement;
	private footerElem: HTMLElement;
	private repoDropdown: Dropdown;
	private branchDropdown: Dropdown;
	private showRemoteBranchesElem: HTMLInputElement;
	private refreshBtnElem: HTMLElement;
	private dockedCommitDetailsView: HTMLElement;
	private scrollShadowElem: HTMLElement;

	private loadBranchesCallback: ((changes: boolean, isRepo: boolean) => void) | null = null;
	private loadCommitsCallback: ((changes: boolean) => void) | null = null;

	constructor(viewElem: HTMLElement, repos: GG.GitRepoSet, lastActiveRepo: string | null, loadRepo: string | null, config: Config, prevState: WebViewState | null) {
		this.gitRepos = repos;
		this.config = config;
		this.maxCommits = config.initialLoadCommits;
		this.graph = new Graph('commitGraph', this.config);
		this.viewElem = viewElem;

		this.controlsElem = document.getElementById('controls')!;
		this.tableElem = document.getElementById('commitTable')!;
		this.footerElem = document.getElementById('footer')!;
		this.dockedCommitDetailsView = document.getElementById('dockedCommitDetailsView')!;
		this.scrollShadowElem = <HTMLInputElement>document.getElementById('scrollShadow')!;

		this.repoDropdown = new Dropdown('repoSelect', true, false, 'Repos', values => {
			this.currentRepo = values[0];
			this.maxCommits = this.config.initialLoadCommits;
			this.gitRemotes = [];
			alterClass(this.controlsElem, 'fetchSupported', false);
			this.closeCommitDetails(false);
			this.currentBranches = null;
			this.saveState();
			this.refresh(true);
		});

		this.branchDropdown = new Dropdown('branchSelect', false, true, 'Branches', values => {
			this.currentBranches = values;
			this.maxCommits = this.config.initialLoadCommits;
			this.closeCommitDetails(false);
			this.saveState();
			this.renderShowLoading();
			this.requestLoadCommits(true, () => { });
		});

		this.showRemoteBranchesElem = <HTMLInputElement>document.getElementById('showRemoteBranchesCheckbox')!;
		this.showRemoteBranchesElem.addEventListener('change', () => {
			this.showRemoteBranches = this.showRemoteBranchesElem.checked;
			this.saveState();
			this.refresh(true);
		});

		this.refreshBtnElem = document.getElementById('refreshBtn')!;
		this.refreshBtnElem.addEventListener('click', () => {
			if (!this.refreshBtnElem.classList.contains(CLASS_REFRESHING)) {
				this.refresh(true);
			}
		});
		this.renderRefreshButton(true);

		alterClass(document.body, CLASS_BRANCH_LABELS_ALIGNED_TO_GRAPH, config.branchLabelsAlignedToGraph);
		alterClass(document.body, CLASS_TAG_LABELS_RIGHT_ALIGNED, config.tagLabelsOnRight);

		this.observeWindowSizeChanges();
		this.observeWebviewStyleChanges();
		this.observeWebviewScroll();
		this.observeKeyboardEvents();

		this.renderShowLoading();
		if (prevState) {
			this.showRemoteBranches = prevState.showRemoteBranches;
			this.showRemoteBranchesElem.checked = this.showRemoteBranches;
			if (typeof this.gitRepos[prevState.currentRepo] !== 'undefined') {
				this.currentRepo = prevState.currentRepo;
				this.currentBranches = prevState.currentBranches;
				this.maxCommits = prevState.maxCommits;
				this.expandedCommit = prevState.expandedCommit;
				this.avatars = prevState.avatars;
				this.loadBranches(prevState.gitBranches, prevState.gitBranchHead, true, true);
				this.loadCommits(prevState.commits, prevState.commitHead, prevState.gitRemotes, prevState.moreCommitsAvailable, true);
				this.scrollTop = prevState.scrollTop;
				this.viewElem.scroll(0, this.scrollTop);
			}
		}
		this.loadRepos(this.gitRepos, lastActiveRepo, loadRepo);
		this.requestLoadBranchesAndCommits(false);

		const fetchBtn = document.getElementById('fetchBtn')!;
		fetchBtn.innerHTML = svgIcons.download;
		fetchBtn.addEventListener('click', () => {
			runAction({ command: 'fetch', repo: this.currentRepo }, 'Fetching from Remote(s)');
		});
	}

	/* Loading Data */
	public loadRepos(repos: GG.GitRepoSet, lastActiveRepo: string | null, loadRepo: string | null) {
		this.gitRepos = repos;
		this.saveState();

		let repoPaths = Object.keys(repos), changedRepo = false;
		if (loadRepo !== null && this.currentRepo !== loadRepo && typeof repos[loadRepo] !== 'undefined') {
			this.currentRepo = loadRepo;
			this.saveState();
			changedRepo = true;
		} else if (typeof repos[this.currentRepo] === 'undefined') {
			this.currentRepo = lastActiveRepo !== null && typeof repos[lastActiveRepo] !== 'undefined' ? lastActiveRepo : repoPaths[0];
			this.saveState();
			changedRepo = true;
		}

		let options = [], repoComps, i;
		for (i = 0; i < repoPaths.length; i++) {
			repoComps = repoPaths[i].split('/');
			options.push({ name: repoComps[repoComps.length - 1], value: repoPaths[i] });
		}
		document.getElementById('repoControl')!.style.display = repoPaths.length > 1 ? 'inline' : 'none';
		this.repoDropdown.setOptions(options, [this.currentRepo]);

		if (changedRepo) {
			this.refresh(true);
		}
	}

	public loadBranches(branchOptions: string[], branchHead: string | null, hard: boolean, isRepo: boolean) {
		if (!isRepo || (!hard && arraysStrictlyEqual(this.gitBranches, branchOptions) && this.gitBranchHead === branchHead)) {
			this.triggerLoadBranchesCallback(false, isRepo);
			return;
		}

		this.gitBranches = branchOptions;
		this.gitBranchHead = branchHead;

		let globPatterns = [];
		for (let i = 0; i < this.config.customBranchGlobPatterns.length; i++) {
			globPatterns.push(this.config.customBranchGlobPatterns[i].glob);
		}

		if (this.currentBranches !== null && !(this.currentBranches.length === 1 && this.currentBranches[0] === SHOW_ALL_BRANCHES)) {
			let i = 0;
			while (i < this.currentBranches.length) {
				if (branchOptions.indexOf(this.currentBranches[i]) === -1 && globPatterns.indexOf(this.currentBranches[i]) === -1) {
					this.currentBranches.splice(i, 1);
				} else {
					i++;
				}
			}
			if (this.currentBranches.length === 0) this.currentBranches = null;
		}

		if (this.currentBranches === null) {
			this.currentBranches = [this.config.showCurrentBranchByDefault && this.gitBranchHead !== null ? this.gitBranchHead : SHOW_ALL_BRANCHES];
		}

		this.saveState();

		let options: DropdownOption[] = [{ name: 'Show All', value: SHOW_ALL_BRANCHES }];
		for (let i = 0; i < this.config.customBranchGlobPatterns.length; i++) {
			options.push({ name: 'Glob: ' + escapeHtml(this.config.customBranchGlobPatterns[i].name), value: this.config.customBranchGlobPatterns[i].glob });
		}
		for (let i = 0; i < this.gitBranches.length; i++) {
			options.push({ name: this.gitBranches[i].indexOf('remotes/') === 0 ? this.gitBranches[i].substring(8) : this.gitBranches[i], value: this.gitBranches[i] });
		}
		this.branchDropdown.setOptions(options, this.currentBranches);

		this.triggerLoadBranchesCallback(true, isRepo);
	}
	private triggerLoadBranchesCallback(changes: boolean, isRepo: boolean) {
		if (this.loadBranchesCallback !== null) {
			this.loadBranchesCallback(changes, isRepo);
			this.loadBranchesCallback = null;
		}
	}

	public loadCommits(commits: GG.GitCommitNode[], commitHead: string | null, remotes: string[], moreAvailable: boolean, hard: boolean) {
		if (!hard && this.moreCommitsAvailable === moreAvailable && this.commitHead === commitHead && arraysEqual(this.commits, commits, (a, b) => a.hash === b.hash && arraysStrictlyEqual(a.heads, b.heads) && arraysStrictlyEqual(a.tags, b.tags) && arraysEqual(a.remotes, b.remotes, (a, b) => a.name === b.name && a.remote === b.remote) && arraysStrictlyEqual(a.parentHashes, b.parentHashes)) && arraysStrictlyEqual(this.gitRemotes, remotes) && this.renderedGitBranchHead === this.gitBranchHead) {
			if (this.commits.length > 0 && this.commits[0].hash === UNCOMMITTED) {
				this.commits[0] = commits[0];
				this.saveState();
				this.renderUncommittedChanges();
				if (this.expandedCommit !== null && this.expandedCommit.srcElem !== null) {
					if (this.expandedCommit.compareWithHash === null) {
						// Commit Details View is open
						if (this.expandedCommit.hash === UNCOMMITTED) {
							this.requestCommitDetails(this.expandedCommit.hash);
						}
					} else {
						// Commit Comparison is open
						if (this.expandedCommit.compareWithSrcElem !== null && (this.expandedCommit.hash === UNCOMMITTED || this.expandedCommit.compareWithHash === UNCOMMITTED)) {
							this.requestCommitComparison(this.expandedCommit.hash, this.expandedCommit.compareWithHash);
						}
					}
				}
			}
			this.triggerLoadCommitsCallback(false);
			return;
		}

		this.moreCommitsAvailable = moreAvailable;
		this.commits = commits;
		this.commitHead = commitHead;
		this.gitRemotes = remotes;
		this.commitLookup = {};
		this.saveState();

		let i: number, expandedCommitVisible = false, expandedCompareWithCommitVisible = false, avatarsNeeded: { [email: string]: string[] } = {};
		for (i = 0; i < this.commits.length; i++) {
			this.commitLookup[this.commits[i].hash] = i;
			if (this.expandedCommit !== null) {
				if (this.expandedCommit.hash === this.commits[i].hash) {
					expandedCommitVisible = true;
				} else if (this.expandedCommit.compareWithHash === this.commits[i].hash) {
					expandedCompareWithCommitVisible = true;
				}
			}
			if (this.config.fetchAvatars && typeof this.avatars[this.commits[i].email] !== 'string' && this.commits[i].email !== '') {
				if (typeof avatarsNeeded[this.commits[i].email] === 'undefined') {
					avatarsNeeded[this.commits[i].email] = [this.commits[i].hash];
				} else {
					avatarsNeeded[this.commits[i].email].push(this.commits[i].hash);
				}
			}
		}

		this.graph.loadCommits(this.commits, this.commitHead, this.commitLookup);

		if (this.expandedCommit !== null && (!expandedCommitVisible || (this.expandedCommit.compareWithHash !== null && !expandedCompareWithCommitVisible))) {
			this.closeCommitDetails(false);
			this.saveState();
		}
		this.render();

		this.triggerLoadCommitsCallback(true);
		this.requestAvatars(avatarsNeeded);
	}
	private triggerLoadCommitsCallback(changes: boolean) {
		if (this.loadCommitsCallback !== null) {
			this.loadCommitsCallback(changes);
			this.loadCommitsCallback = null;
		}
	}

	public loadDataError(message: string, reason: string) {
		this.graph.clear();
		this.tableElem.innerHTML = '';
		this.footerElem.innerHTML = '';
		this.loadBranchesCallback = null;
		this.loadCommitsCallback = null;
		this.renderRefreshButton(true);
		showErrorDialog(message, reason, 'Retry', () => {
			this.refresh(true);
		}, null);
	}

	public loadAvatar(email: string, image: string) {
		this.avatars[email] = image;
		this.saveState();
		let avatarsElems = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName('avatar'), escapedEmail = escapeHtml(email);
		for (let i = 0; i < avatarsElems.length; i++) {
			if (avatarsElems[i].dataset.email === escapedEmail) {
				avatarsElems[i].innerHTML = '<img class="avatarImg" src="' + image + '">';
			}
		}
	}

	/* Refresh */
	public refresh(hard: boolean) {
		if (hard) {
			if (this.expandedCommit !== null) {
				this.closeCommitDetails(false);
				this.saveState();
			}
			this.renderShowLoading();
		}
		this.requestLoadBranchesAndCommits(hard);
	}

	/* Requests */
	private requestLoadBranches(hard: boolean, loadedCallback: (changes: boolean, isRepo: boolean) => void) {
		if (this.loadBranchesCallback !== null) return;
		this.loadBranchesCallback = loadedCallback;
		sendMessage({ command: 'loadBranches', repo: this.currentRepo, showRemoteBranches: this.showRemoteBranches, hard: hard });
	}
	private requestLoadCommits(hard: boolean, loadedCallback: (changes: boolean) => void) {
		if (this.loadCommitsCallback !== null) return;
		this.loadCommitsCallback = loadedCallback;
		sendMessage({
			command: 'loadCommits',
			repo: this.currentRepo,
			branches: this.currentBranches === null || (this.currentBranches.length === 1 && this.currentBranches[0] === SHOW_ALL_BRANCHES) ? null : this.currentBranches,
			maxCommits: this.maxCommits,
			showRemoteBranches: this.showRemoteBranches,
			hard: hard
		});
	}
	private requestLoadBranchesAndCommits(hard: boolean) {
		this.renderRefreshButton(false);
		this.requestLoadBranches(hard, (branchChanges: boolean, isRepo: boolean) => {
			if (isRepo) {
				this.requestLoadCommits(hard, (commitChanges: boolean) => {
					if ((!hard && (branchChanges || commitChanges)) || dialogActionRunning) {
						hideDialogAndContextMenu();
					}
					this.renderRefreshButton(true);
				});
			} else {
				if (dialogActionRunning) hideDialog();
				this.renderRefreshButton(true);
				sendMessage({ command: 'loadRepos', check: true });
			}
		});
	}
	public requestCommitDetails(hash: string) {
		sendMessage({ command: 'commitDetails', repo: this.currentRepo, commitHash: hash });
	}
	public requestCommitComparison(hash: string, compareWithHash: string) {
		let commitOrder = this.getCommitOrder(hash, compareWithHash);
		sendMessage({
			command: 'compareCommits',
			repo: this.currentRepo,
			commitHash: hash, compareWithHash: compareWithHash,
			fromHash: commitOrder.from, toHash: commitOrder.to
		});
	}
	private requestAvatars(avatars: { [email: string]: string[] }) {
		let emails = Object.keys(avatars);
		for (let i = 0; i < emails.length; i++) {
			sendMessage({ command: 'fetchAvatar', repo: this.currentRepo, email: emails[i], commits: avatars[emails[i]] });
		}
	}

	/* State */
	private saveState() {
		vscode.setState({
			gitRepos: this.gitRepos,
			gitBranches: this.gitBranches,
			gitBranchHead: this.gitBranchHead,
			gitRemotes: this.gitRemotes,
			commits: this.commits,
			commitHead: this.commitHead,
			avatars: this.avatars,
			currentBranches: this.currentBranches,
			currentRepo: this.currentRepo,
			moreCommitsAvailable: this.moreCommitsAvailable,
			maxCommits: this.maxCommits,
			showRemoteBranches: this.showRemoteBranches,
			expandedCommit: this.expandedCommit,
			scrollTop: this.scrollTop
		});
	}

	/* Renderers */
	private render() {
		alterClass(this.controlsElem, 'fetchSupported', this.gitRemotes.length > 0);
		this.renderTable();
		this.renderGraph();
	}
	private renderGraph() {
		let colHeadersElem = document.getElementById('tableColHeaders');
		if (colHeadersElem === null) return;
		let expandedCommit = this.config.commitDetailsViewLocation === 'Inline' ? this.expandedCommit : null;
		let headerHeight = colHeadersElem.clientHeight + 1, expandedCommitElem = expandedCommit !== null ? document.getElementById('commitDetails') : null;
		this.config.grid.expandY = expandedCommitElem !== null ? expandedCommitElem.getBoundingClientRect().height : this.config.grid.expandY;
		this.config.grid.y = this.commits.length > 0 ? (this.tableElem.children[0].clientHeight - headerHeight - (expandedCommit !== null ? this.config.grid.expandY : 0)) / this.commits.length : this.config.grid.y;
		this.config.grid.offsetY = headerHeight + this.config.grid.y / 2;
		this.graph.render(expandedCommit);
	}
	private renderTable() {
		let colVisibility = this.getColumnVisibility(), currentHash = this.commits.length > 0 && this.commits[0].hash === UNCOMMITTED ? UNCOMMITTED : this.commitHead, vertexColours = this.graph.getVertexColours(), widthsAtVertices = this.config.branchLabelsAlignedToGraph ? this.graph.getWidthsAtVertices() : [];
		let html = '<tr id="tableColHeaders"><th id="tableHeaderGraphCol" class="tableColHeader" data-col="0">Graph</th><th class="tableColHeader" data-col="1">Description</th>' +
			(colVisibility.date ? '<th class="tableColHeader" data-col="2">Date</th>' : '') +
			(colVisibility.author ? '<th class="tableColHeader authorCol" data-col="3">Author</th>' : '') +
			(colVisibility.commit ? '<th class="tableColHeader" data-col="4">Commit</th>' : '') +
			'</tr>';

		for (let i = 0; i < this.commits.length; i++) {
			let refBranches = '', refTags = '', message = escapeHtml(this.commits[i].message), date = getCommitDate(this.commits[i].date), j, refName, refActive, refHtml, heads: { [name: string]: string[] } = {}, remotes: GG.GitRemoteRef[];
			if (this.config.combineLocalAndRemoteBranchLabels) {
				remotes = [];
				for (j = 0; j < this.commits[i].heads.length; j++) {
					heads[this.commits[i].heads[j]] = [];
				}
				for (j = 0; j < this.commits[i].remotes.length; j++) {
					let branchName = this.commits[i].remotes[j].name.substr(this.commits[i].remotes[j].remote.length + 1);
					if (typeof heads[branchName] !== 'undefined') {
						heads[branchName].push(this.commits[i].remotes[j].remote);
					} else {
						remotes.push(this.commits[i].remotes[j]);
					}
				}
			} else {
				remotes = this.commits[i].remotes;
			}

			for (j = 0; j < this.commits[i].heads.length; j++) {
				refName = escapeHtml(this.commits[i].heads[j]);
				refActive = this.commits[i].heads[j] === this.gitBranchHead;
				refHtml = '<span class="gitRef head' + (refActive ? ' active' : '') + '" data-name="' + refName + '">' + svgIcons.branch + '<span class="gitRefName">' + refName + '</span>';
				if (this.config.combineLocalAndRemoteBranchLabels) {
					let k, remoteName;
					for (k = 0; k < heads[this.commits[i].heads[j]].length; k++) {
						remoteName = escapeHtml(heads[this.commits[i].heads[j]][k]);
						refHtml += '<span class="gitRefHeadRemote" data-remote="' + remoteName + '">' + remoteName + '</span>';
					}
				}
				refHtml += '</span>';
				refBranches = refActive ? refHtml + refBranches : refBranches + refHtml;
			}
			for (j = 0; j < remotes.length; j++) {
				refName = escapeHtml(remotes[j].name);
				refBranches += '<span class="gitRef remote" data-name="' + refName + '" data-remote="' + escapeHtml(remotes[j].remote) + '">' + svgIcons.branch + '<span class="gitRefName">' + refName + '</span></span>';
			}
			for (j = 0; j < this.commits[i].tags.length; j++) {
				refName = escapeHtml(this.commits[i].tags[j]);
				refTags += '<span class="gitRef tag" data-name="' + refName + '">' + svgIcons.tag + '<span class="gitRefName">' + refName + '</span></span>';
			}

			let commitDot = this.commits[i].hash === this.commitHead ? '<span class="commitHeadDot"></span>' : '';
			html += '<tr class="commit"' + (this.commits[i].hash !== UNCOMMITTED ? '' : ' id="uncommittedChanges"') + ' data-hash="' + this.commits[i].hash + '" data-id="' + i + '" data-color="' + vertexColours[i] + '">' + (this.config.branchLabelsAlignedToGraph ? '<td style="padding-left:' + widthsAtVertices[i] + 'px">' + refBranches + '</td><td>' + commitDot : '<td></td><td>' + commitDot + refBranches) + '<span class="gitRefTags">' + refTags + '</span>' + (this.commits[i].hash === currentHash ? '<b>' + message + '</b>' : message) + '</td>' +
				(colVisibility.date ? '<td title="' + date.title + '">' + date.value + '</td>' : '') +
				(colVisibility.author ? '<td class="authorCol" title="' + escapeHtml(this.commits[i].author + ' <' + this.commits[i].email + '>') + '">' + (this.config.fetchAvatars ? '<span class="avatar" data-email="' + escapeHtml(this.commits[i].email) + '">' + (typeof this.avatars[this.commits[i].email] === 'string' ? '<img class="avatarImg" src="' + this.avatars[this.commits[i].email] + '">' : '') + '</span>' : '') + escapeHtml(this.commits[i].author) + '</td>' : '') +
				(colVisibility.commit ? '<td title="' + escapeHtml(this.commits[i].hash) + '">' + abbrevCommit(this.commits[i].hash) + '</td>' : '') +
				'</tr>';
		}
		this.tableElem.innerHTML = '<table>' + html + '</table>';
		this.footerElem.innerHTML = this.moreCommitsAvailable ? '<div id="loadMoreCommitsBtn" class="roundedBtn">Load More Commits</div>' : '';
		this.makeTableResizable();
		this.renderedGitBranchHead = this.gitBranchHead;

		if (this.moreCommitsAvailable) {
			document.getElementById('loadMoreCommitsBtn')!.addEventListener('click', () => {
				this.footerElem.innerHTML = '<h2 id="loadingHeader">' + svgIcons.loading + 'Loading ...</h2>';
				this.maxCommits += this.config.loadMoreCommits;
				this.closeCommitDetails(true);
				this.saveState();
				this.requestLoadCommits(true, () => { });
			});
		}

		if (this.expandedCommit !== null) {
			let elem = null, compareWithElem = null, elems = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName('commit');
			for (let i = 0; i < elems.length; i++) {
				if (this.expandedCommit.hash === elems[i].dataset.hash || this.expandedCommit.compareWithHash === elems[i].dataset.hash) {
					if (this.expandedCommit.hash === elems[i].dataset.hash) {
						elem = elems[i];
					} else {
						compareWithElem = elems[i];
					}
					if (elem !== null && (this.expandedCommit.compareWithHash === null || compareWithElem !== null)) break;
				}
			}
			if (elem === null || (this.expandedCommit.compareWithHash !== null && compareWithElem === null)) {
				this.closeCommitDetails(false);
				this.saveState();
			} else {
				this.expandedCommit.id = parseInt(elem.dataset.id!);
				this.expandedCommit.srcElem = elem;
				this.expandedCommit.compareWithSrcElem = compareWithElem;
				this.saveState();
				if (this.expandedCommit.compareWithHash === null) {
					// Commit Details View is open
					if (this.expandedCommit.commitDetails !== null && this.expandedCommit.fileTree !== null) {
						this.showCommitDetails(this.expandedCommit.commitDetails, this.expandedCommit.fileTree);
						if (this.expandedCommit.hash === UNCOMMITTED) this.requestCommitDetails(this.expandedCommit.hash);
					} else {
						this.loadCommitDetails(elem);
					}
				} else {
					// Commit Comparison is open
					if (this.expandedCommit.fileChanges !== null && this.expandedCommit.fileTree !== null) {
						this.showCommitComparison(this.expandedCommit.hash, this.expandedCommit.compareWithHash, this.expandedCommit.fileChanges, this.expandedCommit.fileTree);
						if (this.expandedCommit.hash === UNCOMMITTED || this.expandedCommit.compareWithHash === UNCOMMITTED) this.requestCommitComparison(this.expandedCommit.hash, this.expandedCommit.compareWithHash);
					} else {
						this.loadCommitComparison(compareWithElem!);
					}
				}

			}
		}

		addListenerToClass('commit', 'contextmenu', (e: Event) => {
			e.stopPropagation();
			let sourceElem = <HTMLElement>(<Element>e.target).closest('.commit')!;
			let hash = sourceElem.dataset.hash!, menu: ContextMenuElement[];
			if (sourceElem.id === 'uncommittedChanges') {
				menu = [
					{
						title: 'Reset uncommitted changes' + ELLIPSIS,
						onClick: () => {
							showSelectDialog('Are you sure you want to reset the <b>uncommitted changes</b> to <b>HEAD</b>?', 'mixed', [
								{ name: 'Mixed - Keep working tree, but reset index', value: 'mixed' },
								{ name: 'Hard - Discard all changes', value: 'hard' }
							], 'Yes, reset', (mode) => {
								runAction({ command: 'resetToCommit', repo: this.currentRepo, commitHash: 'HEAD', resetMode: <GG.GitResetMode>mode }, 'Resetting uncommitted changes');
							}, sourceElem);
						}
					},
					{
						title: 'Clean untracked files' + ELLIPSIS,
						onClick: () => {
							showCheckboxDialog('Are you sure you want to clean all untracked files?', 'Clean untracked directories', true, 'Yes, clean', directories => {
								runAction({ command: 'cleanUntrackedFiles', repo: this.currentRepo, directories: directories }, 'Cleaning untracked files');
							}, sourceElem);
						}
					},
					null,
					{
						title: 'Open Source Control View',
						onClick: () => {
							sendMessage({ command: 'viewScm' });
						}
					}
				];
			} else {
				menu = [
					{
						title: 'Add Tag' + ELLIPSIS,
						onClick: () => {
							showFormDialog('Add tag to commit <b><i>' + abbrevCommit(hash) + '</i></b>:', [
								{ type: 'text-ref' as 'text-ref', name: 'Name: ', default: '' },
								{ type: 'select' as 'select', name: 'Type: ', default: 'annotated', options: [{ name: 'Annotated', value: 'annotated' }, { name: 'Lightweight', value: 'lightweight' }] },
								{ type: 'text' as 'text', name: 'Message: ', default: '', placeholder: 'Optional' }
							], 'Add Tag', values => {
								runAction({ command: 'addTag', repo: this.currentRepo, tagName: values[0], commitHash: hash, lightweight: values[1] === 'lightweight', message: values[2] }, 'Adding Tag');
							}, sourceElem);
						}
					},
					{
						title: 'Create Branch' + ELLIPSIS,
						onClick: () => {
							showRefInputDialog('Enter the name of the branch you would like to create from commit <b><i>' + abbrevCommit(hash) + '</i></b>:', '', 'Create Branch', (name) => {
								runAction({ command: 'createBranch', repo: this.currentRepo, branchName: name, commitHash: hash }, 'Creating Branch');
							}, sourceElem);
						}
					},
					null,
					{
						title: 'Checkout' + ELLIPSIS,
						onClick: () => {
							showConfirmationDialog('Are you sure you want to checkout commit <b><i>' + abbrevCommit(hash) + '</i></b>? This will result in a \'detached HEAD\' state.', () => {
								runAction({ command: 'checkoutCommit', repo: this.currentRepo, commitHash: hash }, 'Checking out Commit');
							}, sourceElem);
						}
					},
					{
						title: 'Cherry Pick' + ELLIPSIS,
						onClick: () => {
							if (this.commits[this.commitLookup[hash]].parentHashes.length === 1) {
								showConfirmationDialog('Are you sure you want to cherry pick commit <b><i>' + abbrevCommit(hash) + '</i></b>?', () => {
									runAction({ command: 'cherrypickCommit', repo: this.currentRepo, commitHash: hash, parentIndex: 0 }, 'Cherry picking Commit');
								}, sourceElem);
							} else {
								let options = this.commits[this.commitLookup[hash]].parentHashes.map((hash, index) => ({
									name: abbrevCommit(hash) + (typeof this.commitLookup[hash] === 'number' ? ': ' + escapeHtml(this.commits[this.commitLookup[hash]].message) : ''),
									value: (index + 1).toString()
								}));
								showSelectDialog('Are you sure you want to cherry pick merge commit <b><i>' + abbrevCommit(hash) + '</i></b>? Choose the parent hash on the main branch, to cherry pick the commit relative to:', '1', options, 'Yes, cherry pick', (parentIndex) => {
									runAction({ command: 'cherrypickCommit', repo: this.currentRepo, commitHash: hash, parentIndex: parseInt(parentIndex) }, 'Cherry picking Commit');
								}, sourceElem);
							}
						}
					},
					{
						title: 'Revert' + ELLIPSIS,
						onClick: () => {
							if (this.commits[this.commitLookup[hash]].parentHashes.length === 1) {
								showConfirmationDialog('Are you sure you want to revert commit <b><i>' + abbrevCommit(hash) + '</i></b>?', () => {
									runAction({ command: 'revertCommit', repo: this.currentRepo, commitHash: hash, parentIndex: 0 }, 'Reverting Commit');
								}, sourceElem);
							} else {
								let options = this.commits[this.commitLookup[hash]].parentHashes.map((hash, index) => ({
									name: abbrevCommit(hash) + (typeof this.commitLookup[hash] === 'number' ? ': ' + escapeHtml(this.commits[this.commitLookup[hash]].message) : ''),
									value: (index + 1).toString()
								}));
								showSelectDialog('Are you sure you want to revert merge commit <b><i>' + abbrevCommit(hash) + '</i></b>? Choose the parent hash on the main branch, to revert the commit relative to:', '1', options, 'Yes, revert', (parentIndex) => {
									runAction({ command: 'revertCommit', repo: this.currentRepo, commitHash: hash, parentIndex: parseInt(parentIndex) }, 'Reverting Commit');
								}, sourceElem);
							}
						}
					},
					null,
					{
						title: 'Merge into current branch' + ELLIPSIS,
						onClick: () => {
							showFormDialog('Are you sure you want to merge commit <b><i>' + abbrevCommit(hash) + '</i></b> into the current branch?', [
								{ type: 'checkbox', name: 'Create a new commit even if fast-forward is possible', value: true },
								{ type: 'checkbox', name: 'Squash commits', value: false }
							], 'Yes, merge', values => {
								runAction({ command: 'mergeCommit', repo: this.currentRepo, commitHash: hash, createNewCommit: values[0] === 'checked', squash: values[1] === 'checked' }, 'Merging Commit');
							}, sourceElem);
						}
					},
					{
						title: 'Rebase current branch on this Commit' + ELLIPSIS,
						onClick: () => {
							showFormDialog('Are you sure you want to rebase the current branch on commit <b><i>' + abbrevCommit(hash) + '</i></b>?', [
								{ type: 'checkbox', name: 'Launch Interactive Rebase in new Terminal', value: false },
								{ type: 'checkbox', name: 'Ignore Date (non-interactive rebase only)', value: true }
							], 'Yes, rebase', values => {
								let interactive = values[0] === 'checked';
								runAction({ command: 'rebaseOn', repo: this.currentRepo, base: hash, type: 'Commit', ignoreDate: values[1] === 'checked', interactive: interactive }, interactive ? 'Launching Interactive Rebase' : 'Rebasing on Commit');
							}, sourceElem);
						}
					},
					{
						title: 'Reset current branch to this Commit' + ELLIPSIS,
						onClick: () => {
							showSelectDialog('Are you sure you want to reset the <b>current branch</b> to commit <b><i>' + abbrevCommit(hash) + '</i></b>?', 'mixed', [
								{ name: 'Soft - Keep all changes, but reset head', value: 'soft' },
								{ name: 'Mixed - Keep working tree, but reset index', value: 'mixed' },
								{ name: 'Hard - Discard all changes', value: 'hard' }
							], 'Yes, reset', (mode) => {
								runAction({ command: 'resetToCommit', repo: this.currentRepo, commitHash: hash, resetMode: <GG.GitResetMode>mode }, 'Resetting to Commit');
							}, sourceElem);
						}
					},
					null,
					{
						title: 'Copy Commit Hash to Clipboard',
						onClick: () => {
							sendMessage({ command: 'copyToClipboard', type: 'Commit Hash', data: hash });
						}
					}
				];
			}
			showContextMenu(<MouseEvent>e, menu, sourceElem);
		});
		addListenerToClass('commit', 'click', (e: Event) => {
			let sourceElem = <HTMLElement>(<Element>e.target).closest('.commit')!;
			if (this.expandedCommit !== null) {
				if (this.expandedCommit.hash === sourceElem.dataset.hash!) {
					this.closeCommitDetails(true);
				} else if ((<MouseEvent>e).ctrlKey || (<MouseEvent>e).metaKey) {
					if (this.expandedCommit.compareWithHash === sourceElem.dataset.hash!) {
						this.closeCommitComparison(true);
					} else {
						this.loadCommitComparison(sourceElem);
					}
				} else {
					this.loadCommitDetails(sourceElem);
				}
			} else {
				this.loadCommitDetails(sourceElem);
			}
		});
		addListenerToClass('gitRef', 'contextmenu', (e: Event) => {
			e.stopPropagation();
			let sourceElem = <HTMLElement>(<Element>e.target).closest('.gitRef')!;
			let refName = unescapeHtml(sourceElem.dataset.name!), menu: ContextMenuElement[], copyType: string;
			if (sourceElem.classList.contains('tag')) {
				menu = [{
					title: 'Delete Tag' + ELLIPSIS,
					onClick: () => {
						showConfirmationDialog('Are you sure you want to delete the tag <b><i>' + escapeHtml(refName) + '</i></b>?', () => {
							runAction({ command: 'deleteTag', repo: this.currentRepo, tagName: refName }, 'Deleting Tag');
						}, null);
					}
				}];
				if (this.gitRemotes.length > 0) {
					menu.push({
						title: 'Push Tag' + ELLIPSIS,
						onClick: () => {
							if (this.gitRemotes.length === 1) {
								showConfirmationDialog('Are you sure you want to push the tag <b><i>' + escapeHtml(refName) + '</i></b> to the remote <b><i>' + escapeHtml(this.gitRemotes[0]) + '</i></b>?', () => {
									runAction({ command: 'pushTag', repo: this.currentRepo, tagName: refName, remote: this.gitRemotes[0] }, 'Pushing Tag');
								}, null);
							} else if (this.gitRemotes.length > 1) {
								let options = this.gitRemotes.map((remote, index) => ({ name: escapeHtml(remote), value: index.toString() }));
								showSelectDialog('Are you sure you want to push the tag <b><i>' + escapeHtml(refName) + '</i></b>? Select the remote to push the tag to:', '0', options, 'Yes, push', (remoteIndex) => {
									runAction({ command: 'pushTag', repo: this.currentRepo, tagName: refName, remote: this.gitRemotes[parseInt(remoteIndex)] }, 'Pushing Tag');
								}, null);
							}
						}
					});
				}
				copyType = 'Tag Name';
			} else {
				let isHead = sourceElem.classList.contains('head'), isRemoteCombinedWithHead = (<HTMLElement>e.target).className === 'gitRefHeadRemote';
				if (isHead && isRemoteCombinedWithHead) {
					refName = unescapeHtml((<HTMLElement>e.target).dataset.remote!) + '/' + refName;
					isHead = false;
				}
				if (isHead) {
					menu = [];
					if (this.gitBranchHead !== refName) {
						menu.push({
							title: 'Checkout Branch',
							onClick: () => this.checkoutBranchAction(refName, null)
						});
					}
					menu.push({
						title: 'Rename Branch' + ELLIPSIS,
						onClick: () => {
							showRefInputDialog('Enter the new name for branch <b><i>' + escapeHtml(refName) + '</i></b>:', refName, 'Rename Branch', (newName) => {
								runAction({ command: 'renameBranch', repo: this.currentRepo, oldName: refName, newName: newName }, 'Renaming Branch');
							}, null);
						}
					});
					if (this.gitBranchHead !== refName) {
						menu.push(
							{
								title: 'Delete Branch' + ELLIPSIS,
								onClick: () => {
									showCheckboxDialog('Are you sure you want to delete the branch <b><i>' + escapeHtml(refName) + '</i></b>?', 'Force Delete', false, 'Delete Branch', (forceDelete) => {
										runAction({ command: 'deleteBranch', repo: this.currentRepo, branchName: refName, forceDelete: forceDelete }, 'Deleting Branch');
									}, null);
								}
							}, {
								title: 'Merge into current branch' + ELLIPSIS,
								onClick: () => {
									showFormDialog('Are you sure you want to merge branch <b><i>' + escapeHtml(refName) + '</i></b> into the current branch?', [
										{ type: 'checkbox', name: 'Create a new commit even if fast-forward is possible', value: true },
										{ type: 'checkbox', name: 'Squash commits', value: false }
									], 'Yes, merge', values => {
										runAction({ command: 'mergeBranch', repo: this.currentRepo, branchName: refName, createNewCommit: values[0] === 'checked', squash: values[1] === 'checked' }, 'Merging Branch');
									}, null);
								}
							}, {
								title: 'Rebase current branch on Branch' + ELLIPSIS,
								onClick: () => {
									showFormDialog('Are you sure you want to rebase the current branch on branch <b><i>' + escapeHtml(refName) + '</i></b>?', [
										{ type: 'checkbox', name: 'Launch Interactive Rebase in new Terminal', value: false },
										{ type: 'checkbox', name: 'Ignore Date (non-interactive rebase only)', value: true }
									], 'Yes, rebase', values => {
										let interactive = values[0] === 'checked';
										runAction({ command: 'rebaseOn', repo: this.currentRepo, base: refName, type: 'Branch', ignoreDate: values[1] === 'checked', interactive: interactive }, interactive ? 'Launching Interactive Rebase' : 'Rebasing on Branch');
									}, null);
								}
							}
						);
					}
				} else {
					let remote = unescapeHtml((isRemoteCombinedWithHead ? <HTMLElement>e.target : sourceElem).dataset.remote!);
					menu = [{
						title: 'Delete Remote Branch' + ELLIPSIS,
						onClick: () => {
							showConfirmationDialog('Are you sure you want to delete the remote branch <b><i>' + escapeHtml(refName) + '</i></b>?', () => {
								runAction({ command: 'deleteRemoteBranch', repo: this.currentRepo, branchName: refName.substr(remote.length + 1), remote: remote }, 'Deleting Remote Branch');
							}, null);
						}
					}, {
						title: 'Checkout Branch' + ELLIPSIS,
						onClick: () => this.checkoutBranchAction(refName, remote)
					}];
				}
				copyType = 'Branch Name';
			}
			menu.push(null, {
				title: 'Copy ' + copyType + ' to Clipboard',
				onClick: () => {
					sendMessage({ command: 'copyToClipboard', type: copyType, data: refName });
				}
			});
			showContextMenu(<MouseEvent>e, menu, sourceElem);
		});
		addListenerToClass('gitRef', 'click', (e: Event) => e.stopPropagation());
		addListenerToClass('gitRef', 'dblclick', (e: Event) => {
			e.stopPropagation();
			hideDialogAndContextMenu();
			let sourceElem = <HTMLElement>(<Element>e.target).closest('.gitRef')!;
			if (!sourceElem.classList.contains('tag')) {
				let refName = unescapeHtml(sourceElem.dataset.name!), isHead = sourceElem.classList.contains('head'), isRemoteCombinedWithHead = (<HTMLElement>e.target).className === 'gitRefHeadRemote';
				if (isHead && isRemoteCombinedWithHead) {
					refName = unescapeHtml((<HTMLElement>e.target).dataset.remote!) + '/' + refName;
					isHead = false;
				}
				this.checkoutBranchAction(refName, isHead ? null : unescapeHtml((isRemoteCombinedWithHead ? <HTMLElement>e.target : sourceElem).dataset.remote!));
			}
		});
	}
	private renderUncommittedChanges() {
		let colVisibility = this.getColumnVisibility(), date = getCommitDate(this.commits[0].date);
		document.getElementById('uncommittedChanges')!.innerHTML = '<td></td><td><b>' + escapeHtml(this.commits[0].message) + '</b></td>' +
			(colVisibility.date ? '<td title="' + date.title + '">' + date.value + '</td>' : '') +
			(colVisibility.author ? '<td title="* <>">*</td>' : '') +
			(colVisibility.commit ? '<td title="*">*</td>' : '');
	}
	private renderShowLoading() {
		hideDialogAndContextMenu();
		this.graph.clear();
		this.tableElem.innerHTML = '<h2 id="loadingHeader">' + svgIcons.loading + 'Loading ...</h2>';
		this.footerElem.innerHTML = '';
	}
	public renderRefreshButton(enabled: boolean) {
		this.refreshBtnElem.title = enabled ? 'Refresh' : 'Refreshing';
		this.refreshBtnElem.innerHTML = enabled ? svgIcons.refresh : svgIcons.loading;
		alterClass(this.refreshBtnElem, CLASS_REFRESHING, !enabled);
	}
	private checkoutBranchAction(refName: string, remote: string | null) {
		if (remote !== null) {
			showRefInputDialog('Enter the name of the new branch you would like to create when checking out <b><i>' + escapeHtml(refName) + '</i></b>:', refName.substr(remote.length + 1), 'Checkout Branch', newBranch => {
				runAction({ command: 'checkoutBranch', repo: this.currentRepo, branchName: newBranch, remoteBranch: refName }, 'Checking out Branch');
			}, null);
		} else {
			runAction({ command: 'checkoutBranch', repo: this.currentRepo, branchName: refName, remoteBranch: null }, 'Checking out Branch');
		}
	}
	private makeTableResizable() {
		let colHeadersElem = document.getElementById('tableColHeaders')!, cols = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName('tableColHeader');
		let columnWidths: GG.ColumnWidth[], mouseX = -1, col = -1, colIndex = -1;

		const makeTableFixedLayout = () => {
			cols[0].style.width = columnWidths[0] + 'px';
			cols[0].style.padding = '';
			for (let i = 2; i < cols.length; i++) {
				cols[i].style.width = columnWidths[parseInt(cols[i].dataset.col!)] + 'px';
			}
			this.tableElem.className = 'fixedLayout';
			this.graph.limitMaxWidth(columnWidths[0] + 16);
		};

		for (let i = 0; i < cols.length; i++) {
			let col = parseInt(cols[i].dataset.col!);
			cols[i].innerHTML += (i > 0 ? '<span class="resizeCol left" data-col="' + (col - 1) + '"></span>' : '') + (i < cols.length - 1 ? '<span class="resizeCol right" data-col="' + col + '"></span>' : '');
		}

		let cWidths = this.gitRepos[this.currentRepo].columnWidths;
		if (cWidths === null) { // Initialise auto column layout if it is the first time viewing the repo.
			let defaults = this.config.defaultColumnVisibility;
			columnWidths = [COLUMN_AUTO, COLUMN_AUTO, defaults.date ? COLUMN_AUTO : COLUMN_HIDDEN, defaults.author ? COLUMN_AUTO : COLUMN_HIDDEN, defaults.commit ? COLUMN_AUTO : COLUMN_HIDDEN];
			this.saveColumnWidths(columnWidths);
		} else {
			columnWidths = [cWidths[0], COLUMN_AUTO, cWidths[1], cWidths[2], cWidths[3]];
		}

		if (columnWidths[0] !== COLUMN_AUTO) {
			// Table should have fixed layout 
			makeTableFixedLayout();
		} else {
			// Table should have automatic layout
			this.tableElem.className = 'autoLayout';
			this.graph.limitMaxWidth(-1);
			cols[0].style.padding = '0 ' + Math.round((Math.max(this.graph.getWidth() + 16, 64) - (cols[0].offsetWidth - COLUMN_LEFT_RIGHT_PADDING)) / 2) + 'px';
		}

		addListenerToClass('resizeCol', 'mousedown', (e) => {
			col = parseInt((<HTMLElement>e.target).dataset.col!);
			while (columnWidths[col] === COLUMN_HIDDEN) col--;
			mouseX = (<MouseEvent>e).clientX;

			let isAuto = columnWidths[0] === COLUMN_AUTO;
			for (let i = 0; i < cols.length; i++) {
				let curCol = parseInt(cols[i].dataset.col!);
				if (isAuto && curCol !== 1) columnWidths[curCol] = cols[i].clientWidth - COLUMN_LEFT_RIGHT_PADDING;
				if (curCol === col) colIndex = i;
			}
			if (isAuto) makeTableFixedLayout();
			colHeadersElem.classList.add('resizing');
		});
		colHeadersElem.addEventListener('mousemove', (e) => {
			if (col > -1) {
				let mouseEvent = <MouseEvent>e;
				let mouseDeltaX = mouseEvent.clientX - mouseX;

				if (col === 0) {
					if (columnWidths[0] + mouseDeltaX < COLUMN_MIN_WIDTH) mouseDeltaX = -columnWidths[0] + COLUMN_MIN_WIDTH;
					if (cols[1].clientWidth - COLUMN_LEFT_RIGHT_PADDING - mouseDeltaX < COLUMN_MIN_WIDTH) mouseDeltaX = cols[1].clientWidth - COLUMN_LEFT_RIGHT_PADDING - COLUMN_MIN_WIDTH;
					columnWidths[0] += mouseDeltaX;
					cols[0].style.width = columnWidths[0] + 'px';
					this.graph.limitMaxWidth(columnWidths[0] + 16);
				} else {
					let colWidth = col !== 1 ? columnWidths[col] : cols[1].clientWidth - COLUMN_LEFT_RIGHT_PADDING;
					let nextCol = col + 1;
					while (columnWidths[nextCol] === COLUMN_HIDDEN) nextCol++;

					if (colWidth + mouseDeltaX < COLUMN_MIN_WIDTH) mouseDeltaX = -colWidth + COLUMN_MIN_WIDTH;
					if (columnWidths[nextCol] - mouseDeltaX < COLUMN_MIN_WIDTH) mouseDeltaX = columnWidths[nextCol] - COLUMN_MIN_WIDTH;
					if (col !== 1) {
						columnWidths[col] += mouseDeltaX;
						cols[colIndex].style.width = columnWidths[col] + 'px';
					}
					columnWidths[nextCol] -= mouseDeltaX;
					cols[colIndex + 1].style.width = columnWidths[nextCol] + 'px';
				}
				mouseX = mouseEvent.clientX;
			}
		});
		const stopResizing = () => {
			if (col > -1) {
				col = -1;
				colIndex = -1;
				mouseX = -1;
				colHeadersElem.classList.remove('resizing');
				this.saveColumnWidths(columnWidths);
			}
		};
		colHeadersElem.addEventListener('mouseup', stopResizing);
		colHeadersElem.addEventListener('mouseleave', stopResizing);
		colHeadersElem.addEventListener('contextmenu', (e: MouseEvent) => {
			e.stopPropagation();
			const toggleColumnState = (col: number, defaultWidth: number) => {
				columnWidths[col] = columnWidths[col] !== COLUMN_HIDDEN ? COLUMN_HIDDEN : columnWidths[0] === COLUMN_AUTO ? COLUMN_AUTO : defaultWidth - COLUMN_LEFT_RIGHT_PADDING;
				this.saveColumnWidths(columnWidths);
				hideContextMenu();
				this.render();
			};
			showCheckedContextMenu(e, [
				{
					title: 'Date',
					checked: columnWidths[2] !== COLUMN_HIDDEN,
					onClick: () => toggleColumnState(2, 128)
				},
				{
					title: 'Author',
					checked: columnWidths[3] !== COLUMN_HIDDEN,
					onClick: () => toggleColumnState(3, 128)
				},
				{
					title: 'Commit',
					checked: columnWidths[4] !== COLUMN_HIDDEN,
					onClick: () => toggleColumnState(4, 80)
				}
			], null);
		});
	}
	private saveColumnWidths(columnWidths: GG.ColumnWidth[]) {
		this.gitRepos[this.currentRepo].columnWidths = [columnWidths[0], columnWidths[2], columnWidths[3], columnWidths[4]];
		sendMessage({ command: 'saveRepoState', repo: this.currentRepo, state: this.gitRepos[this.currentRepo] });
	}
	private getColumnVisibility() {
		let colWidths = this.gitRepos[this.currentRepo].columnWidths;
		if (colWidths !== null) {
			return { date: colWidths[1] !== COLUMN_HIDDEN, author: colWidths[2] !== COLUMN_HIDDEN, commit: colWidths[3] !== COLUMN_HIDDEN };
		} else {
			let defaults = this.config.defaultColumnVisibility;
			return { date: defaults.date, author: defaults.author, commit: defaults.commit };
		}
	}
	private getNumColumns() {
		let colVisibility = this.getColumnVisibility();
		return 2 + (colVisibility.date ? 1 : 0) + (colVisibility.author ? 1 : 0) + (colVisibility.commit ? 1 : 0);
	}

	/* Observers */
	private observeWindowSizeChanges() {
		let windowWidth = window.outerWidth, windowHeight = window.outerHeight;
		window.addEventListener('resize', () => {
			if (windowWidth === window.outerWidth && windowHeight === window.outerHeight) {
				this.renderGraph();
			} else {
				windowWidth = window.outerWidth;
				windowHeight = window.outerHeight;
			}
		});
	}
	private observeWebviewStyleChanges() {
		let fontFamily = getVSCodeStyle('--vscode-font-family'), editorFontFamily = getVSCodeStyle('--vscode-editor-font-family');
		(new MutationObserver(() => {
			let ff = getVSCodeStyle('--vscode-font-family'), eff = getVSCodeStyle('--vscode-editor-font-family');
			if (ff !== fontFamily || eff !== editorFontFamily) {
				fontFamily = ff;
				editorFontFamily = eff;
				this.repoDropdown.refresh();
				this.branchDropdown.refresh();
			}
		})).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
	}
	private observeWebviewScroll() {
		let active = this.viewElem.scrollTop > 0, timeout: NodeJS.Timer | null = null;
		this.scrollShadowElem.className = active ? CLASS_ACTIVE : '';
		this.viewElem.addEventListener('scroll', () => {
			let scrollTop = this.viewElem.scrollTop;
			if (active !== scrollTop > 0) {
				active = scrollTop > 0;
				this.scrollShadowElem.className = active ? CLASS_ACTIVE : '';
			}
			if (timeout !== null) clearTimeout(timeout);
			timeout = setTimeout(() => {
				this.scrollTop = scrollTop;
				this.saveState();
				timeout = null;
			}, 250);
		});
	}
	private observeKeyboardEvents() {
		document.addEventListener('keydown', e => {
			if (graphFocus) {
				if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
					this.refresh(true);
				} else if (this.expandedCommit !== null) { // Commit Details View is open
					if (e.key === 'Escape') {
						this.closeCommitDetails(true);
					} else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
						let hashIndex = -1;
						if (e.key === 'ArrowUp' && this.commitLookup[this.expandedCommit.hash] > 0) {
							hashIndex = this.commitLookup[this.expandedCommit.hash] - 1;
						} else if (e.key === 'ArrowDown' && this.commitLookup[this.expandedCommit.hash] < this.commits.length - 1) {
							hashIndex = this.commitLookup[this.expandedCommit.hash] + 1;
						}
						if (hashIndex > -1) {
							e.preventDefault();
							let hash = this.commits[hashIndex].hash, elems = <HTMLCollectionOf<HTMLElement>>document.getElementsByClassName('commit');
							for (let i = 0; i < elems.length; i++) {
								if (hash === elems[i].dataset.hash) {
									this.loadCommitDetails(elems[i]);
									break;
								}
							}
						}
					}
				}
			} else {
				if (e.key === 'Escape') {
					hideDialogAndContextMenu();
				} else if (e.key === 'Enter' && dialogAction !== null) {
					dialogAction();
				}
			}
		});
	}

	/* Commit Details */
	private loadCommitDetails(sourceElem: HTMLElement) {
		this.closeCommitDetails(true);
		this.expandedCommit = { id: parseInt(sourceElem.dataset.id!), hash: sourceElem.dataset.hash!, srcElem: sourceElem, commitDetails: null, fileChanges: null, fileTree: null, compareWithHash: null, compareWithSrcElem: null };
		this.saveState();
		this.requestCommitDetails(this.expandedCommit.hash);
	}
	public closeCommitDetails(saveAndRender: boolean) {
		if (this.expandedCommit !== null) {
			if (this.config.commitDetailsViewLocation === 'Inline') {
				let elem = document.getElementById('commitDetails');
				if (typeof elem === 'object' && elem !== null) elem.remove();
			} else {
				document.body.classList.remove(CLASS_DOCKED_COMMIT_DETAILS_VIEW_OPEN);
				this.dockedCommitDetailsView.innerHTML = '';
			}
			if (typeof this.expandedCommit.srcElem === 'object' && this.expandedCommit.srcElem !== null) this.expandedCommit.srcElem.classList.remove(CLASS_COMMIT_DETAILS_OPEN);
			if (typeof this.expandedCommit.compareWithSrcElem === 'object' && this.expandedCommit.compareWithSrcElem !== null) this.expandedCommit.compareWithSrcElem.classList.remove(CLASS_COMPARE_COMMIT_OPEN);
			this.expandedCommit = null;
			if (saveAndRender) {
				this.saveState();
				if (this.config.commitDetailsViewLocation === 'Inline') this.renderGraph();
			}
		}
	}
	public showCommitDetails(commitDetails: GG.GitCommitDetails, fileTree: GitFolder) {
		if (this.expandedCommit === null || this.expandedCommit.srcElem === null || this.expandedCommit.hash !== commitDetails.hash) return;
		let elem = document.getElementById('commitDetails');
		if (typeof elem === 'object' && elem !== null) elem.remove();

		this.expandedCommit.commitDetails = commitDetails;
		if (haveFilesChanged(this.expandedCommit.fileChanges, commitDetails.fileChanges)) {
			this.expandedCommit.fileChanges = commitDetails.fileChanges;
			this.expandedCommit.fileTree = fileTree;
		}
		this.expandedCommit.srcElem.classList.add(CLASS_COMMIT_DETAILS_OPEN);
		this.saveState();

		this.renderCommitDetailsView();
	}

	private loadCommitComparison(compareWithSrcElem: HTMLElement) {
		if (this.expandedCommit !== null) {
			this.closeCommitComparison(false);
			this.expandedCommit.compareWithHash = compareWithSrcElem.dataset.hash!;
			this.expandedCommit.compareWithSrcElem = compareWithSrcElem;
			this.saveState();
			this.requestCommitComparison(this.expandedCommit.hash, this.expandedCommit.compareWithHash);
		}
	}
	public closeCommitComparison(fallbackToDetails: boolean) {
		if (this.expandedCommit !== null && this.expandedCommit.compareWithHash) {
			if (typeof this.expandedCommit.compareWithSrcElem === 'object' && this.expandedCommit.compareWithSrcElem !== null) this.expandedCommit.compareWithSrcElem.classList.remove(CLASS_COMPARE_COMMIT_OPEN);
			this.expandedCommit.compareWithHash = null;
			this.expandedCommit.compareWithSrcElem = null;
			this.expandedCommit.fileChanges = null;
			this.expandedCommit.fileTree = null;
			this.saveState();
			if (fallbackToDetails) sendMessage({ command: 'commitDetails', repo: this.currentRepo, commitHash: this.expandedCommit.hash });
		}
	}
	public showCommitComparison(commitHash: string, compareWithHash: string, fileChanges: GG.GitFileChange[], fileTree: GitFolder) {
		if (this.expandedCommit === null || this.expandedCommit.srcElem === null || this.expandedCommit.compareWithSrcElem === null || this.expandedCommit.hash !== commitHash || this.expandedCommit.compareWithHash !== compareWithHash) return;
		this.expandedCommit.commitDetails = null;
		if (haveFilesChanged(this.expandedCommit.fileChanges, fileChanges)) {
			this.expandedCommit.fileChanges = fileChanges;
			this.expandedCommit.fileTree = fileTree;
		}
		this.expandedCommit.srcElem.classList.add(CLASS_COMMIT_DETAILS_OPEN);
		this.expandedCommit.compareWithSrcElem.classList.add(CLASS_COMPARE_COMMIT_OPEN);
		this.saveState();

		this.renderCommitDetailsView();
	}

	private renderCommitDetailsView() {
		if (this.expandedCommit === null || this.expandedCommit.srcElem === null) return;
		let isDocked = this.config.commitDetailsViewLocation !== 'Inline';
		let elem = isDocked ? this.dockedCommitDetailsView : document.getElementById('commitDetails'), html = '';
		if (elem === null) {
			elem = document.createElement('tr');
			elem.id = 'commitDetails';
			insertAfter(elem, this.expandedCommit.srcElem);
		}
		if (this.expandedCommit.compareWithHash === null) {
			// Commit details should be shown
			if (this.expandedCommit.hash !== UNCOMMITTED) {
				let commitDetails = this.expandedCommit.commitDetails!;
				html += '<span class="commitDetailsSummaryTop' + (typeof this.avatars[commitDetails.email] === 'string' ? ' withAvatar' : '') + '"><span class="commitDetailsSummaryTopRow"><span class="commitDetailsSummaryKeyValues">';
				html += '<b>Commit: </b>' + escapeHtml(commitDetails.hash) + '<br>';
				html += '<b>Parents: </b>' + commitDetails.parents.join(', ') + '<br>';
				html += '<b>Author: </b>' + escapeHtml(commitDetails.author) + ' &lt;<a href="mailto:' + encodeURIComponent(commitDetails.email) + '">' + escapeHtml(commitDetails.email) + '</a>&gt;<br>';
				html += '<b>Date: </b>' + (new Date(commitDetails.date * 1000)).toString() + '<br>';
				html += '<b>Committer: </b>' + escapeHtml(commitDetails.committer) + '</span>';
				if (typeof this.avatars[commitDetails.email] === 'string') html += '<span class="commitDetailsSummaryAvatar"><img src="' + this.avatars[commitDetails.email] + '"></span>';
				html += '</span></span><br><br>';
				html += escapeHtml(commitDetails.body).replace(/\n/g, '<br>');
			} else {
				html += 'Displaying all uncommitted changes.';
			}
			html += '</div><div id="commitDetailsFiles">' + generateGitFileTreeHtml(this.expandedCommit.fileTree!, this.expandedCommit.fileChanges!) + '</table>';
			this.renderGraph();
		} else {
			// Commit comparision should be shown
			let commitOrder = this.getCommitOrder(this.expandedCommit.hash, this.expandedCommit.compareWithHash);
			html += 'Displaying all changes from <b>' + commitOrder.from + '</b> to <b>' + (commitOrder.to !== UNCOMMITTED ? commitOrder.to : 'Uncommitted Changes') + '</b>.</div>';
			html += '<div id="commitDetailsFiles">' + generateGitFileTreeHtml(this.expandedCommit.fileTree!, this.expandedCommit.fileChanges!) + '</table>';
		}
		html = '<div id="commitDetailsSummary">' + html + '</div><div id="commitDetailsClose" title="Close">' + svgIcons.close + '</div>';

		elem.innerHTML = isDocked ? html : '<td></td><td colspan="' + (this.getNumColumns() - 1) + '">' + html + '</td>';

		if (isDocked) {
			document.body.classList.add(CLASS_DOCKED_COMMIT_DETAILS_VIEW_OPEN);
			let elemTop = this.controlsElem.clientHeight + this.expandedCommit.srcElem.offsetTop;
			if (elemTop - 8 < this.viewElem.scrollTop) {
				// Commit is above what is visible on screen
				this.viewElem.scroll(0, elemTop - 8);
			} else if (elemTop - this.viewElem.clientHeight + 32 > this.viewElem.scrollTop) {
				// Commit is below what is visible on screen
				this.viewElem.scroll(0, elemTop - this.viewElem.clientHeight + 32);
			}
		} else {
			let elemTop = this.controlsElem.clientHeight + elem.offsetTop;
			if (this.config.autoCenterCommitDetailsView) {
				// Center Commit Detail View setting is enabled
				// elemTop - commit height [24px] + (commit details view height + commit height [24px]) / 2 - (view height) / 2
				this.viewElem.scroll(0, elemTop - 12 + (this.config.grid.expandY - this.viewElem.clientHeight) / 2);
			} else if (elemTop - 32 < this.viewElem.scrollTop) {
				// Commit Detail View is opening above what is visible on screen
				// elemTop - commit height [24px] - desired gap from top [8px] < view scroll offset
				this.viewElem.scroll(0, elemTop - 32);
			} else if (elemTop + this.config.grid.expandY - this.viewElem.clientHeight + 8 > this.viewElem.scrollTop) {
				// Commit Detail View is opening below what is visible on screen
				// elemTop + commit details view height + desired gap from bottom [8px] - view height > view scroll offset
				this.viewElem.scroll(0, elemTop + this.config.grid.expandY - this.viewElem.clientHeight + 8);
			}
		}

		document.getElementById('commitDetailsClose')!.addEventListener('click', () => {
			this.closeCommitDetails(true);
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
			let commitOrder = this.getCommitOrder(this.expandedCommit.hash, this.expandedCommit.compareWithHash === null ? this.expandedCommit.hash : this.expandedCommit.compareWithHash);
			sendMessage({ command: 'viewDiff', repo: this.currentRepo, fromHash: commitOrder.from, toHash: commitOrder.to, oldFilePath: decodeURIComponent(sourceElem.dataset.oldfilepath!), newFilePath: decodeURIComponent(sourceElem.dataset.newfilepath!), type: <GG.GitFileChangeType>sourceElem.dataset.type });
		});
	}

	private getCommitOrder(hash1: string, hash2: string) {
		if (this.commitLookup[hash1] > this.commitLookup[hash2]) {
			return { from: hash1, to: hash2 };
		} else {
			return { from: hash2, to: hash1 };
		}
	}
}

let viewElem = document.getElementById('view')!, graphFocus = true, loaded = false;
let contextMenu = document.getElementById('contextMenu')!, contextMenuSource: HTMLElement | null = null;
let dialog = document.getElementById('dialog')!, dialogBacking = document.getElementById('dialogBacking')!, dialogMenuSource: HTMLElement | null = null, dialogAction: (() => void) | null = null, dialogActionRunning = false;

window.addEventListener('load', () => {
	if (loaded) return;
	loaded = true;

	let gitGraph = new GitGraphView(viewElem, viewState.repos, viewState.lastActiveRepo, viewState.loadRepo, {
		autoCenterCommitDetailsView: viewState.autoCenterCommitDetailsView,
		branchLabelsAlignedToGraph: viewState.refLabelAlignment === 'Branches (aligned to the graph) & Tags (on the right)',
		combineLocalAndRemoteBranchLabels: viewState.combineLocalAndRemoteBranchLabels,
		commitDetailsViewLocation: viewState.commitDetailsViewLocation,
		customBranchGlobPatterns: viewState.customBranchGlobPatterns,
		defaultColumnVisibility: viewState.defaultColumnVisibility,
		fetchAvatars: viewState.fetchAvatars,
		graphColours: viewState.graphColours,
		graphStyle: viewState.graphStyle,
		grid: { x: 16, y: 24, offsetX: 8, offsetY: 12, expandY: 250 },
		initialLoadCommits: viewState.initialLoadCommits,
		loadMoreCommits: viewState.loadMoreCommits,
		showCurrentBranchByDefault: viewState.showCurrentBranchByDefault,
		tagLabelsOnRight: viewState.refLabelAlignment !== 'Normal'
	}, vscode.getState());

	/* Command Processing */
	window.addEventListener('message', event => {
		const msg: GG.ResponseMessage = event.data;
		switch (msg.command) {
			case 'addTag':
				refreshOrDisplayError(msg.status, 'Unable to Add Tag');
				break;
			case 'checkoutBranch':
				refreshOrDisplayError(msg.status, 'Unable to Checkout Branch');
				break;
			case 'checkoutCommit':
				refreshOrDisplayError(msg.status, 'Unable to Checkout Commit');
				break;
			case 'cherrypickCommit':
				refreshOrDisplayError(msg.status, 'Unable to Cherry Pick Commit');
				break;
			case 'cleanUntrackedFiles':
				refreshOrDisplayError(msg.status, 'Unable to Clean Untracked Files');
				break;
			case 'commitDetails':
				if (msg.commitDetails === null) {
					gitGraph.closeCommitDetails(true);
					showErrorDialog('Unable to load commit details', null, null, null, null);
				} else {
					gitGraph.showCommitDetails(msg.commitDetails, generateGitFileTree(msg.commitDetails.fileChanges));
				}
				break;
			case 'compareCommits':
				if (msg.fileChanges === null) {
					gitGraph.closeCommitComparison(true);
					showErrorDialog('Unable to compare commits', null, null, null, null);
				} else {
					gitGraph.showCommitComparison(msg.commitHash, msg.compareWithHash, msg.fileChanges, generateGitFileTree(msg.fileChanges));
				}
				break;
			case 'copyToClipboard':
				showErrorIfNotSuccess(msg.success, 'Unable to Copy ' + msg.type + ' to Clipboard');
				break;
			case 'createBranch':
				refreshOrDisplayError(msg.status, 'Unable to Create Branch');
				break;
			case 'deleteBranch':
				refreshOrDisplayError(msg.status, 'Unable to Delete Branch');
				break;
			case 'deleteRemoteBranch':
				refreshOrDisplayError(msg.status, 'Unable to Delete Remote Branch');
				break;
			case 'deleteTag':
				refreshOrDisplayError(msg.status, 'Unable to Delete Tag');
				break;
			case 'fetch':
				refreshOrDisplayError(msg.status, 'Unable to Fetch from Remote(s)');
				break;
			case 'fetchAvatar':
				gitGraph.loadAvatar(msg.email, msg.image);
				break;
			case 'loadBranches':
				if (msg.error === null) {
					gitGraph.loadBranches(msg.branches, msg.head, msg.hard, msg.isRepo);
				} else {
					gitGraph.loadDataError('Unable to load branches', msg.error);
				}
				break;
			case 'loadCommits':
				if (msg.error === null) {
					gitGraph.loadCommits(msg.commits, msg.head, msg.remotes, msg.moreCommitsAvailable, msg.hard);
				} else {
					gitGraph.loadDataError('Unable to load commits', msg.error);
				}
				break;
			case 'loadRepos':
				gitGraph.loadRepos(msg.repos, msg.lastActiveRepo, msg.loadRepo);
				break;
			case 'mergeBranch':
				refreshOrDisplayError(msg.status, 'Unable to Merge Branch');
				break;
			case 'mergeCommit':
				refreshOrDisplayError(msg.status, 'Unable to Merge Commit');
				break;
			case 'pushTag':
				refreshOrDisplayError(msg.status, 'Unable to Push Tag');
				break;
			case 'renameBranch':
				refreshOrDisplayError(msg.status, 'Unable to Rename Branch');
				break;
			case 'rebaseOn':
				if (msg.status === null) {
					if (msg.interactive) {
						if (dialogActionRunning) hideDialog();
					} else {
						gitGraph.refresh(false);
					}
				} else {
					showErrorDialog('Unable to Rebase current branch on ' + msg.type, msg.status, null, null, null);
				}
				break;
			case 'refresh':
				gitGraph.refresh(false);
				break;
			case 'resetToCommit':
				refreshOrDisplayError(msg.status, 'Unable to Reset to Commit');
				break;
			case 'revertCommit':
				refreshOrDisplayError(msg.status, 'Unable to Revert Commit');
				break;
			case 'viewDiff':
				showErrorIfNotSuccess(msg.success, 'Unable to view Diff of File');
				break;
			case 'viewScm':
				showErrorIfNotSuccess(msg.success, 'Unable to open the Source Control View');
				break;
		}
	});
	function refreshOrDisplayError(status: GG.GitCommandStatus, errorMessage: string) {
		if (status === null) {
			gitGraph.refresh(false);
		} else {
			showErrorDialog(errorMessage, status, null, null, null);
		}
	}
	function showErrorIfNotSuccess(success: boolean, errorMessage: string) {
		if (success) {
			if (dialogActionRunning) hideDialog();
		} else {
			showErrorDialog(errorMessage, null, null, null, null);
		}
	}
});


/* Dates */
function getCommitDate(dateVal: number) {
	let date = new Date(dateVal * 1000), value;
	let dateStr = date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
	let timeStr = pad2(date.getHours()) + ':' + pad2(date.getMinutes());

	switch (viewState.dateFormat) {
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
	let html = (folder.name !== '' ? '<span class="gitFolder" data-folderpath="' + encodeURIComponent(folder.folderPath) + '"><span class="gitFolderIcon">' + (folder.open ? svgIcons.openFolder : svgIcons.closedFolder) + '</span><span class="gitFolderName">' + folder.name + '</span></span>' : '') + '<ul class="gitFolderContents' + (!folder.open ? ' hidden' : '') + '">', keys = Object.keys(folder.contents), i, gitFile, gitFolder, diffPossible;
	keys.sort((a, b) => folder.contents[a].type === 'folder' && folder.contents[b].type === 'file' ? -1 : folder.contents[a].type === 'file' && folder.contents[b].type === 'folder' ? 1 : folder.contents[a].name < folder.contents[b].name ? -1 : folder.contents[a].name > folder.contents[b].name ? 1 : 0);
	for (i = 0; i < keys.length; i++) {
		if (folder.contents[keys[i]].type === 'folder') {
			gitFolder = <GitFolder>folder.contents[keys[i]];
			html += '<li' + (!gitFolder.open ? ' class="closed"' : '') + '>' + generateGitFileTreeHtml(gitFolder, gitFiles) + '</li>';
		} else {
			gitFile = gitFiles[(<GitFile>(folder.contents[keys[i]])).index];
			diffPossible = gitFile.type === 'U' || (gitFile.additions !== null && gitFile.deletions !== null);
			html += '<li class="gitFile ' + gitFile.type + (diffPossible ? ' gitDiffPossible' : '') + '" data-oldfilepath="' + encodeURIComponent(gitFile.oldFilePath) + '" data-newfilepath="' + encodeURIComponent(gitFile.newFilePath) + '" data-type="' + gitFile.type + '" title="' + (diffPossible ? 'Click to view diff' : 'This is a binary file, unable to view diff.') + '"><span class="gitFileIcon">' + svgIcons.file + '</span>' + folder.contents[keys[i]].name + (gitFile.type === 'R' ? ' <span class="gitFileRename" title="' + escapeHtml(gitFile.oldFilePath + ' was renamed to ' + gitFile.newFilePath) + '">R</span>' : '') + (gitFile.type !== 'A' && gitFile.type !== 'U' && gitFile.type !== 'D' && gitFile.additions !== null && gitFile.deletions !== null ? '<span class="gitFileAddDel">(<span class="gitFileAdditions" title="' + gitFile.additions + ' addition' + (gitFile.additions !== 1 ? 's' : '') + '">+' + gitFile.additions + '</span>|<span class="gitFileDeletions" title="' + gitFile.deletions + ' deletion' + (gitFile.deletions !== 1 ? 's' : '') + '">-' + gitFile.deletions + '</span>)</span>' : '') + '</li>';
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

function haveFilesChanged(oldFiles: GG.GitFileChange[] | null, newFiles: GG.GitFileChange[] | null) {
	if ((oldFiles === null) !== (newFiles === null)) {
		return true;
	} else if (oldFiles === null && newFiles === null) {
		return false;
	} else {
		return !arraysEqual(oldFiles!, newFiles!, (a, b) => a.additions === b.additions && a.deletions === b.deletions && a.newFilePath === b.newFilePath && a.oldFilePath === b.oldFilePath && a.type === b.type);
	}
}

function abbrevCommit(commitHash: string) {
	return commitHash.substring(0, 8);
}

function runAction(msg: GG.RequestMessage, action: string) {
	showDialog('<span id="actionRunning">' + svgIcons.loading + action + ' ...</span>', null, 'Dismiss', null, null);
	dialogActionRunning = true;
	sendMessage(msg);
}


/* Context Menu */
function showContextMenu(e: MouseEvent, items: ContextMenuElement[], sourceElem: HTMLElement | null) {
	let html = '', i: number, event = <MouseEvent>e;
	for (i = 0; i < items.length; i++) {
		html += items[i] !== null ? '<li class="contextMenuItem" data-index="' + i + '">' + items[i]!.title + '</li>' : '<li class="contextMenuDivider"></li>';
	}

	hideContextMenuListener();
	contextMenu.style.opacity = '0';
	contextMenu.className = CLASS_ACTIVE;
	contextMenu.innerHTML = html;
	let bounds = contextMenu.getBoundingClientRect();
	contextMenu.style.left = (viewElem.scrollLeft + event.pageX + (event.pageX + bounds.width < viewElem.clientWidth ? -2 : 2 - bounds.width)) + 'px';
	contextMenu.style.top = (viewElem.scrollTop + event.pageY + (event.pageY + bounds.height < viewElem.clientHeight ? -2 : 2 - bounds.height)) + 'px';
	contextMenu.style.opacity = '1';

	addListenerToClass('contextMenuItem', 'click', (e) => {
		e.stopPropagation();
		hideContextMenu();
		items[parseInt((<HTMLElement>(<Element>e.target).closest('.contextMenuItem')!).dataset.index!)]!.onClick();
	});

	contextMenuSource = sourceElem;
	if (contextMenuSource !== null) contextMenuSource.classList.add(CLASS_CONTEXT_MENU_ACTIVE);
	graphFocus = false;
}
function showCheckedContextMenu(e: MouseEvent, items: ContextMenuItem[], sourceElem: HTMLElement | null) {
	for (let i = 0; i < items.length; i++) {
		items[i].title = '<span class="contextMenuItemCheck">' + (items[i].checked ? svgIcons.check : '') + '</span>' + items[i].title;
	}
	showContextMenu(e, items, sourceElem);
	contextMenu.classList.add('checked');
}
function hideContextMenu() {
	contextMenu.className = '';
	contextMenu.innerHTML = '';
	contextMenu.style.left = '0px';
	contextMenu.style.top = '0px';
	if (contextMenuSource !== null) {
		contextMenuSource.classList.remove(CLASS_CONTEXT_MENU_ACTIVE);
		contextMenuSource = null;
	}
	graphFocus = true;
}


/* Dialogs */
function showConfirmationDialog(message: string, confirmed: () => void, sourceElem: HTMLElement | null) {
	showDialog(message, 'Yes', 'No', () => {
		hideDialog();
		confirmed();
	}, sourceElem);
}
function showRefInputDialog(message: string, defaultValue: string, actionName: string, actioned: (value: string) => void, sourceElem: HTMLElement | null) {
	showFormDialog(message, [{ type: 'text-ref', name: '', default: defaultValue }], actionName, values => actioned(values[0]), sourceElem);
}
function showCheckboxDialog(message: string, checkboxLabel: string, checkboxValue: boolean, actionName: string, actioned: (value: boolean) => void, sourceElem: HTMLElement | null) {
	showFormDialog(message, [{ type: 'checkbox', name: checkboxLabel, value: checkboxValue }], actionName, values => actioned(values[0] === 'checked'), sourceElem);
}
function showSelectDialog(message: string, defaultValue: string, options: { name: string, value: string }[], actionName: string, actioned: (value: string) => void, sourceElem: HTMLElement | null) {
	showFormDialog(message, [{ type: 'select', name: '', options: options, default: defaultValue }], actionName, values => actioned(values[0]), sourceElem);
}
function showFormDialog(message: string, inputs: DialogInput[], actionName: string, actioned: (values: string[]) => void, sourceElem: HTMLElement | null) {
	let textRefInput = -1, multiElement = inputs.length > 1;
	let multiCheckbox = multiElement;

	if (multiElement) { // If has multiple elements, then check if they are all checkboxes. If so, then the form is a checkbox multi
		for (let i = 0; i < inputs.length; i++) {
			if (inputs[i].type !== 'checkbox') {
				multiCheckbox = false;
				break;
			}
		}
	}

	let html = message + '<br><table class="dialogForm ' + (multiElement ? multiCheckbox ? 'multiCheckbox' : 'multi' : 'single') + '">';
	for (let i = 0; i < inputs.length; i++) {
		let input = inputs[i];
		html += '<tr>' + (multiElement && !multiCheckbox ? '<td>' + input.name + '</td>' : '') + '<td>';
		if (input.type === 'select') {
			html += '<select id="dialogInput' + i + '">';
			for (let j = 0; j < input.options.length; j++) {
				html += '<option value="' + input.options[j].value + '"' + (input.options[j].value === input.default ? ' selected' : '') + '>' + input.options[j].name + '</option>';
			}
			html += '</select>';
		} else if (input.type === 'checkbox') {
			html += '<span class="dialogFormCheckbox"><label><input id="dialogInput' + i + '" type="checkbox"' + (input.value ? ' checked' : '') + '/>' + (multiElement && !multiCheckbox ? '' : input.name) + '</label></span>';
		} else {
			html += '<input id="dialogInput' + i + '" type="text" value="' + input.default + '"' + (input.type === 'text' && input.placeholder !== null ? ' placeholder="' + input.placeholder + '"' : '') + '/>';
			if (input.type === 'text-ref') textRefInput = i;
		}
		html += '</td></tr>';
	}
	html += '</table>';

	showDialog(html, actionName, 'Cancel', () => {
		if (dialog.className === CLASS_ACTIVE + ' noInput' || dialog.className === CLASS_ACTIVE + ' inputInvalid') return;
		let values = [];
		for (let i = 0; i < inputs.length; i++) {
			let input = inputs[i], elem = document.getElementById('dialogInput' + i);
			if (input.type === 'select') {
				values.push((<HTMLSelectElement>elem).value);
			} else if (input.type === 'checkbox') {
				values.push((<HTMLInputElement>elem).checked ? 'checked' : 'unchecked');
			} else {
				values.push((<HTMLInputElement>elem).value);
			}
		}
		hideDialog();
		actioned(values);
	}, sourceElem);

	if (textRefInput > -1) {
		let dialogInput = <HTMLInputElement>document.getElementById('dialogInput' + textRefInput), dialogAction = document.getElementById('dialogAction')!;
		if (dialogInput.value === '') dialog.className = CLASS_ACTIVE + ' noInput';
		dialogInput.focus();
		dialogInput.addEventListener('keyup', () => {
			let noInput = dialogInput.value === '', invalidInput = dialogInput.value.match(refInvalid) !== null;
			let newClassName = CLASS_ACTIVE + (noInput ? ' noInput' : invalidInput ? ' inputInvalid' : '');
			if (dialog.className !== newClassName) {
				dialog.className = newClassName;
				dialogAction.title = invalidInput ? 'Unable to ' + actionName + ', one or more invalid characters entered.' : '';
			}
		});
	}
}
function showErrorDialog(message: string, reason: string | null, actionName: string | null, actioned: (() => void) | null, sourceElem: HTMLElement | null) {
	showDialog(svgIcons.alert + 'Error: ' + message + (reason !== null ? '<br><span class="errorReason">' + escapeHtml(reason).split('\n').join('<br>') + '</span>' : ''), actionName, 'Dismiss', actioned, sourceElem);
}
function showDialog(html: string, actionName: string | null, dismissName: string, actioned: (() => void) | null, sourceElem: HTMLElement | null) {
	hideDialogAndContextMenu();

	dialogBacking.className = CLASS_ACTIVE;
	dialog.className = CLASS_ACTIVE;
	dialog.innerHTML = html + '<br>' + (actionName !== null ? '<div id="dialogAction" class="roundedBtn">' + actionName + '</div>' : '') + '<div id="dialogDismiss" class="roundedBtn">' + dismissName + '</div>';
	if (actionName !== null && actioned !== null) {
		document.getElementById('dialogAction')!.addEventListener('click', actioned);
		dialogAction = actioned;
	}
	document.getElementById('dialogDismiss')!.addEventListener('click', hideDialog);

	dialogMenuSource = sourceElem;
	if (dialogMenuSource !== null) dialogMenuSource.classList.add(CLASS_DIALOG_ACTIVE);
	graphFocus = false;
}
function hideDialog() {
	dialogBacking.className = '';
	dialog.className = '';
	dialog.innerHTML = '';
	if (dialogMenuSource !== null) {
		dialogMenuSource.classList.remove(CLASS_DIALOG_ACTIVE);
		dialogMenuSource = null;
	}
	dialogAction = null;
	dialogActionRunning = false;
	graphFocus = true;
}

function hideDialogAndContextMenu() {
	if (dialog.classList.contains(CLASS_ACTIVE)) hideDialog();
	if (contextMenu.classList.contains(CLASS_ACTIVE)) hideContextMenu();
}

/* Global Listeners */
document.addEventListener('click', hideContextMenuListener);
document.addEventListener('contextmenu', hideContextMenuListener);
document.addEventListener('mouseleave', hideContextMenuListener);
function hideContextMenuListener() {
	if (contextMenu.classList.contains(CLASS_ACTIVE)) hideContextMenu();
}