class GitGraphView {
	private gitRepos: GG.GitRepoSet;
	private gitBranches: ReadonlyArray<string> = [];
	private gitBranchHead: string | null = null;
	private gitRemotes: ReadonlyArray<string> = [];
	private gitStashes: ReadonlyArray<GG.GitStash> = [];
	private commits: GG.GitCommit[] = [];
	private commitHead: string | null = null;
	private commitLookup: { [hash: string]: number } = {};
	private onlyFollowFirstParent: boolean = false;
	private avatars: AvatarImageCollection = {};
	private currentBranches: string[] | null = null;

	private currentRepo!: string;
	private currentRepoLoading: boolean = true;
	private currentRepoRefreshState: {
		inProgress: boolean;
		hard: boolean;
		loadRepoInfoRefreshId: number;
		loadCommitsRefreshId: number;
		repoInfoChanges: boolean;
		requestingRepoInfo: boolean;
	};
	private loadViewTo: GG.LoadGitGraphViewTo = null;

	private readonly graph: Graph;
	private readonly config: Config;

	private moreCommitsAvailable: boolean = false;
	private expandedCommit: ExpandedCommit | null = null;
	private maxCommits: number;
	private scrollTop = 0;
	private renderedGitBranchHead: string | null = null;

	private lastScrollToStash: {
		time: number,
		hash: string | null
	} = { time: 0, hash: null };

	private readonly findWidget: FindWidget;
	private readonly settingsWidget: SettingsWidget;
	private readonly repoDropdown: Dropdown;
	private readonly branchDropdown: Dropdown;

	private readonly viewElem: HTMLElement;
	private readonly controlsElem: HTMLElement;
	private readonly tableElem: HTMLElement;
	private readonly footerElem: HTMLElement;
	private readonly showRemoteBranchesElem: HTMLInputElement;
	private readonly refreshBtnElem: HTMLElement;
	private readonly scrollShadowElem: HTMLElement;

	constructor(viewElem: HTMLElement, prevState: WebViewState | null) {
		this.gitRepos = initialState.repos;
		this.config = initialState.config;
		this.maxCommits = this.config.initialLoadCommits;
		this.graph = new Graph('commitGraph', viewElem, this.config);
		this.viewElem = viewElem;
		this.currentRepoRefreshState = {
			inProgress: false,
			hard: true,
			loadRepoInfoRefreshId: initialState.loadRepoInfoRefreshId,
			loadCommitsRefreshId: initialState.loadCommitsRefreshId,
			repoInfoChanges: false,
			requestingRepoInfo: false
		};

		this.controlsElem = document.getElementById('controls')!;
		this.tableElem = document.getElementById('commitTable')!;
		this.footerElem = document.getElementById('footer')!;
		this.scrollShadowElem = <HTMLInputElement>document.getElementById('scrollShadow')!;

		this.repoDropdown = new Dropdown('repoDropdown', true, false, 'Repos', (values) => {
			this.loadRepo(values[0]);
		});

		this.branchDropdown = new Dropdown('branchDropdown', false, true, 'Branches', (values) => {
			this.currentBranches = values;
			this.maxCommits = this.config.initialLoadCommits;
			this.saveState();
			this.clearCommits();
			this.requestLoadRepoInfoAndCommits(true, true);
		});

		this.showRemoteBranchesElem = <HTMLInputElement>document.getElementById('showRemoteBranchesCheckbox')!;
		this.showRemoteBranchesElem.addEventListener('change', () => {
			this.gitRepos[this.currentRepo].showRemoteBranches = this.showRemoteBranchesElem.checked;
			this.saveRepoState();
			this.refresh(true);
		});

		this.refreshBtnElem = document.getElementById('refreshBtn')!;
		this.refreshBtnElem.addEventListener('click', () => {
			if (!this.refreshBtnElem.classList.contains(CLASS_REFRESHING)) {
				this.refresh(true);
			}
		});
		this.renderRefreshButton();

		this.findWidget = new FindWidget(this);
		this.settingsWidget = new SettingsWidget(this);

		alterClass(document.body, CLASS_BRANCH_LABELS_ALIGNED_TO_GRAPH, this.config.branchLabelsAlignedToGraph);
		alterClass(document.body, CLASS_TAG_LABELS_RIGHT_ALIGNED, this.config.tagLabelsOnRight);

		this.observeWindowSizeChanges();
		this.observeWebviewStyleChanges();
		this.observeViewScroll();
		this.observeKeyboardEvents();
		this.observeInternalUrls();
		this.observeTableEvents();

		if (prevState && !prevState.currentRepoLoading && typeof this.gitRepos[prevState.currentRepo] !== 'undefined') {
			this.currentRepo = prevState.currentRepo;
			this.currentBranches = prevState.currentBranches;
			this.maxCommits = prevState.maxCommits;
			this.expandedCommit = prevState.expandedCommit;
			this.avatars = prevState.avatars;
			this.loadRepoInfo(prevState.gitBranches, prevState.gitBranchHead, prevState.gitRemotes, prevState.gitStashes, true);
			this.loadCommits(prevState.commits, prevState.commitHead, prevState.moreCommitsAvailable, prevState.onlyFollowFirstParent);
			this.findWidget.restoreState(prevState.findWidget);
			if (this.currentRepo === prevState.settingsWidget.repo) {
				const currentRepoState = this.gitRepos[this.currentRepo];
				this.settingsWidget.restoreState(prevState.settingsWidget, currentRepoState.hideRemotes, currentRepoState.issueLinkingConfig, currentRepoState.pullRequestConfig, currentRepoState.showTags, currentRepoState.includeCommitsMentionedByReflogs, currentRepoState.onlyFollowFirstParent);
			}
			this.showRemoteBranchesElem.checked = this.gitRepos[prevState.currentRepo].showRemoteBranches;
		}

		let loadViewTo = initialState.loadViewTo;
		if (loadViewTo === null && prevState && prevState.currentRepoLoading && typeof prevState.currentRepo !== 'undefined') {
			loadViewTo = { repo: prevState.currentRepo, commitDetails: null };
		}

		if (!this.loadRepos(this.gitRepos, initialState.lastActiveRepo, loadViewTo)) {
			if (prevState) {
				this.scrollTop = prevState.scrollTop;
				this.viewElem.scroll(0, this.scrollTop);
			}
			this.requestLoadRepoInfoAndCommits(false, false);
		}

		const fetchBtn = document.getElementById('fetchBtn')!, findBtn = document.getElementById('findBtn')!, settingsBtn = document.getElementById('settingsBtn')!;
		fetchBtn.title = 'Fetch' + (this.config.fetchAndPrune ? ' & Prune' : '') + ' from Remote(s)';
		fetchBtn.innerHTML = SVG_ICONS.download;
		fetchBtn.addEventListener('click', () => {
			runAction({ command: 'fetch', repo: this.currentRepo, name: null, prune: this.config.fetchAndPrune }, 'Fetching from Remote(s)');
		});
		findBtn.innerHTML = SVG_ICONS.search;
		findBtn.addEventListener('click', () => this.findWidget.show(true));
		settingsBtn.innerHTML = SVG_ICONS.gear;
		settingsBtn.addEventListener('click', () => {
			const currentRepoState = this.gitRepos[this.currentRepo];
			this.settingsWidget.show(this.currentRepo, currentRepoState.hideRemotes, currentRepoState.issueLinkingConfig, currentRepoState.pullRequestConfig, currentRepoState.showTags, currentRepoState.includeCommitsMentionedByReflogs, currentRepoState.onlyFollowFirstParent, true);
		});
	}


	/* Loading Data */

	public loadRepos(repos: GG.GitRepoSet, lastActiveRepo: string | null, loadViewTo: GG.LoadGitGraphViewTo) {
		this.gitRepos = repos;
		this.saveState();

		let repoPaths: ReadonlyArray<string> = Object.keys(repos), newRepo: string;
		if (loadViewTo !== null && this.currentRepo !== loadViewTo.repo && typeof repos[loadViewTo.repo] !== 'undefined') {
			newRepo = loadViewTo.repo;
		} else if (typeof repos[this.currentRepo] === 'undefined') {
			newRepo = lastActiveRepo !== null && typeof repos[lastActiveRepo] !== 'undefined' ? lastActiveRepo : repoPaths[0];
		} else {
			newRepo = this.currentRepo;
		}

		alterClass(this.controlsElem, 'singleRepo', repoPaths.length === 1);
		this.repoDropdown.setOptions(getRepoDropdownOptions(repoPaths), [newRepo]);

		if (loadViewTo !== null) {
			if (loadViewTo.repo === newRepo) {
				this.loadViewTo = loadViewTo;
			} else {
				this.loadViewTo = null;
				showErrorMessage('Unable to load the Git Graph View for the repository "' + loadViewTo.repo + '". It is not currently included in Git Graph.');
			}
		} else {
			this.loadViewTo = null;
		}

		if (this.currentRepo !== newRepo) {
			this.loadRepo(newRepo);
			return true;
		} else {
			this.finaliseLoadViewTo();
			return false;
		}
	}

	private loadRepo(repo: string) {
		this.currentRepo = repo;
		this.currentRepoLoading = true;
		this.showRemoteBranchesElem.checked = this.gitRepos[this.currentRepo].showRemoteBranches;
		this.maxCommits = this.config.initialLoadCommits;
		this.gitRemotes = [];
		this.gitStashes = [];
		this.renderFetchButton();
		this.closeCommitDetails(false);
		this.settingsWidget.close();
		this.currentBranches = null;
		this.saveState();
		this.refresh(true);
	}

	private loadRepoInfo(branchOptions: ReadonlyArray<string>, branchHead: string | null, remotes: ReadonlyArray<string>, stashes: ReadonlyArray<GG.GitStash>, isRepo: boolean) {
		// Changes to this.gitStashes are reflected as changes to the commits when loadCommits is run
		this.gitStashes = stashes;

		if (!isRepo || (!this.currentRepoRefreshState.hard && arraysStrictlyEqual(this.gitBranches, branchOptions) && this.gitBranchHead === branchHead && arraysStrictlyEqual(this.gitRemotes, remotes))) {
			this.saveState();
			this.finaliseLoadRepoInfo(false, isRepo);
			return;
		}

		// Changes to these properties must be indicated as a repository info change
		this.gitBranches = branchOptions;
		this.gitBranchHead = branchHead;
		this.gitRemotes = remotes;

		// Update the state of the fetch button
		this.renderFetchButton();

		// Configure current branches

		if (this.currentBranches !== null && !(this.currentBranches.length === 1 && this.currentBranches[0] === SHOW_ALL_BRANCHES)) {
			let i = 0, globPatterns = this.config.customBranchGlobPatterns.map((pattern) => pattern.glob);
			while (i < this.currentBranches.length) {
				if (!branchOptions.includes(this.currentBranches[i]) && !globPatterns.includes(this.currentBranches[i])) {
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

		// Set up branch dropdown options
		let options: DropdownOption[] = [{ name: 'Show All', value: SHOW_ALL_BRANCHES }];
		for (let i = 0; i < this.config.customBranchGlobPatterns.length; i++) {
			options.push({ name: 'Glob: ' + this.config.customBranchGlobPatterns[i].name, value: this.config.customBranchGlobPatterns[i].glob });
		}
		for (let i = 0; i < this.gitBranches.length; i++) {
			options.push({ name: this.gitBranches[i].indexOf('remotes/') === 0 ? this.gitBranches[i].substring(8) : this.gitBranches[i], value: this.gitBranches[i] });
		}
		this.branchDropdown.setOptions(options, this.currentBranches);

		// Remove hidden remotes that no longer exist
		let hiddenRemotes = this.gitRepos[this.currentRepo].hideRemotes;
		let hideRemotes = hiddenRemotes.filter((hiddenRemote) => remotes.includes(hiddenRemote));
		if (hiddenRemotes.length !== hideRemotes.length) {
			this.saveHiddenRemotes(this.currentRepo, hideRemotes);
		}

		this.finaliseLoadRepoInfo(true, isRepo);
	}
	private finaliseLoadRepoInfo(repoInfoChanges: boolean, isRepo: boolean) {
		const refreshState = this.currentRepoRefreshState;
		if (refreshState.inProgress) {
			if (isRepo) {
				refreshState.repoInfoChanges = refreshState.repoInfoChanges || repoInfoChanges;
				refreshState.requestingRepoInfo = false;
				this.requestLoadCommits();
			} else {
				dialog.closeActionRunning();
				refreshState.inProgress = false;
				this.loadViewTo = null;
				this.renderRefreshButton();
				sendMessage({ command: 'loadRepos', check: true });
			}
		}
	}

	private loadCommits(commits: GG.GitCommit[], commitHead: string | null, moreAvailable: boolean, onlyFollowFirstParent: boolean) {
		if (!this.currentRepoLoading && !this.currentRepoRefreshState.hard && this.moreCommitsAvailable === moreAvailable && this.onlyFollowFirstParent === onlyFollowFirstParent && this.commitHead === commitHead && commits.length > 0 && arraysEqual(this.commits, commits, (a, b) =>
			a.hash === b.hash &&
			arraysStrictlyEqual(a.heads, b.heads) &&
			arraysEqual(a.tags, b.tags, (a, b) => a.name === b.name && a.annotated === b.annotated) &&
			arraysEqual(a.remotes, b.remotes, (a, b) => a.name === b.name && a.remote === b.remote) &&
			arraysStrictlyEqual(a.parents, b.parents) &&
			((a.stash === null && b.stash === null) || (a.stash !== null && b.stash !== null && a.stash.selector === b.stash.selector))
		) && this.renderedGitBranchHead === this.gitBranchHead) {

			if (this.commits[0].hash === UNCOMMITTED) {
				this.commits[0] = commits[0];
				this.saveState();
				this.renderUncommittedChanges();
				if (this.expandedCommit !== null && this.expandedCommit.commitElem !== null) {
					if (this.expandedCommit.compareWithHash === null) {
						// Commit Details View is open
						if (this.expandedCommit.commitHash === UNCOMMITTED) {
							this.requestCommitDetails(this.expandedCommit.commitHash, true);
						}
					} else {
						// Commit Comparison is open
						if (this.expandedCommit.compareWithElem !== null && (this.expandedCommit.commitHash === UNCOMMITTED || this.expandedCommit.compareWithHash === UNCOMMITTED)) {
							this.requestCommitComparison(this.expandedCommit.commitHash, this.expandedCommit.compareWithHash, true);
						}
					}
				}
			}
			this.finaliseLoadCommits();
			return;
		}

		const currentRepoLoading = this.currentRepoLoading;
		this.currentRepoLoading = false;
		this.moreCommitsAvailable = moreAvailable;
		this.onlyFollowFirstParent = onlyFollowFirstParent;
		this.commits = commits;
		this.commitHead = commitHead;
		this.commitLookup = {};

		let i: number, expandedCommitVisible = false, expandedCompareWithCommitVisible = false, avatarsNeeded: { [email: string]: string[] } = {}, commit;
		for (i = 0; i < this.commits.length; i++) {
			commit = this.commits[i];
			this.commitLookup[commit.hash] = i;
			if (this.expandedCommit !== null) {
				if (this.expandedCommit.commitHash === commit.hash) {
					expandedCommitVisible = true;
				} else if (this.expandedCommit.compareWithHash === commit.hash) {
					expandedCompareWithCommitVisible = true;
				}
			}
			if (this.config.fetchAvatars && typeof this.avatars[commit.email] !== 'string' && commit.email !== '') {
				if (typeof avatarsNeeded[commit.email] === 'undefined') {
					avatarsNeeded[commit.email] = [commit.hash];
				} else {
					avatarsNeeded[commit.email].push(commit.hash);
				}
			}
		}

		if (this.expandedCommit !== null && (!expandedCommitVisible || (this.expandedCommit.compareWithHash !== null && !expandedCompareWithCommitVisible))) {
			this.closeCommitDetails(false);
		}

		this.saveState();

		this.graph.loadCommits(this.commits, this.commitHead, this.commitLookup, this.onlyFollowFirstParent);
		this.render();

		if (currentRepoLoading && this.config.openRepoToHead && this.commitHead !== null) {
			this.scrollToCommit(this.commitHead, true);
		}

		this.finaliseLoadCommits();
		this.requestAvatars(avatarsNeeded);
	}
	private finaliseLoadCommits() {
		const refreshState = this.currentRepoRefreshState;
		if (refreshState.inProgress) {
			dialog.closeActionRunning();

			if (dialog.isTargetDynamicSource()) {
				if (refreshState.repoInfoChanges) {
					dialog.close();
				} else {
					dialog.refresh(this.getCommits());
				}
			}

			if (contextMenu.isTargetDynamicSource()) {
				if (refreshState.repoInfoChanges) {
					contextMenu.close();
				} else {
					contextMenu.refresh(this.getCommits());
				}
			}

			refreshState.inProgress = false;
			this.renderRefreshButton();
		}

		if (this.loadViewTo !== null) {
			this.finaliseLoadViewTo();
		}
	}

	private finaliseLoadViewTo() {
		if (this.loadViewTo !== null && this.currentRepo === this.loadViewTo.repo && this.loadViewTo.commitDetails !== null && (this.expandedCommit === null || this.expandedCommit.commitHash !== this.loadViewTo.commitDetails.commitHash || this.expandedCommit.compareWithHash !== this.loadViewTo.commitDetails.compareWithHash)) {
			const commitIndex = this.getCommitId(this.loadViewTo.commitDetails.commitHash);
			const compareWithIndex = this.loadViewTo.commitDetails.compareWithHash !== null ? this.getCommitId(this.loadViewTo.commitDetails.compareWithHash) : null;
			const commitElems = getCommitElems();
			const commitElem = findCommitElemWithId(commitElems, commitIndex);
			const compareWithElem = findCommitElemWithId(commitElems, compareWithIndex);

			if (commitElem !== null && (this.loadViewTo.commitDetails.compareWithHash === null || compareWithElem !== null)) {
				if (compareWithElem !== null) {
					this.loadCommitComparison(commitElem, compareWithElem);
				} else {
					this.loadCommitDetails(commitElem);
				}
			} else {
				showErrorMessage('Unable to resume Code Review, it could not be found in the latest ' + this.maxCommits + ' commits that were loaded in this repository.');
			}
		}
		this.loadViewTo = null;
	}

	private clearCommits() {
		closeDialogAndContextMenu();
		this.moreCommitsAvailable = false;
		this.commits = [];
		this.commitHead = null;
		this.commitLookup = {};
		this.renderedGitBranchHead = null;
		this.closeCommitDetails(false);
		this.saveState();
		this.graph.loadCommits(this.commits, this.commitHead, this.commitLookup, this.onlyFollowFirstParent);
		this.tableElem.innerHTML = '';
		this.footerElem.innerHTML = '';
		this.renderGraph();
		this.findWidget.refresh();
	}

	public processLoadRepoInfoResponse(msg: GG.ResponseLoadRepoInfo) {
		if (msg.error === null) {
			const refreshState = this.currentRepoRefreshState;
			if (refreshState.inProgress && refreshState.loadRepoInfoRefreshId === msg.refreshId) {
				this.loadRepoInfo(msg.branches, msg.head, msg.remotes, msg.stashes, msg.isRepo);
			}
		} else {
			this.displayLoadDataError('Unable to load Repository Info', msg.error);
		}
	}
	public processLoadCommitsResponse(msg: GG.ResponseLoadCommits) {
		if (msg.error === null) {
			const refreshState = this.currentRepoRefreshState;
			if (refreshState.inProgress && refreshState.loadCommitsRefreshId === msg.refreshId) {
				this.loadCommits(msg.commits, msg.head, msg.moreCommitsAvailable, msg.onlyFollowFirstParent);
			}
		} else {
			const error = this.gitBranches.length === 0 && msg.error.indexOf('bad revision \'HEAD\'') > -1
				? 'There are no commits in this repository.'
				: msg.error;
			this.displayLoadDataError('Unable to load Commits', error);
		}
	}
	private displayLoadDataError(message: string, reason: string) {
		this.clearCommits();
		this.currentRepoRefreshState.inProgress = false;
		this.loadViewTo = null;
		this.renderRefreshButton();
		dialog.showError(message, reason, 'Retry', () => {
			this.refresh(true);
		});
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


	/* Public Get Methods checking the GitGraphView state */

	public getBranches(): ReadonlyArray<string> {
		return this.gitBranches;
	}

	public getCommits(): ReadonlyArray<GG.GitCommit> {
		return this.commits;
	}

	public getSettingsWidget() {
		return this.settingsWidget;
	}


	/* Refresh */

	public refresh(hard: boolean) {
		if (hard) {
			this.clearCommits();
		}
		this.requestLoadRepoInfoAndCommits(hard, false);
	}


	/* Requests */

	private requestLoadRepoInfo() {
		const repoState = this.gitRepos[this.currentRepo];
		sendMessage({
			command: 'loadRepoInfo',
			repo: this.currentRepo,
			refreshId: ++this.currentRepoRefreshState.loadRepoInfoRefreshId,
			showRemoteBranches: repoState.showRemoteBranches,
			hideRemotes: repoState.hideRemotes
		});
	}

	private requestLoadCommits() {
		const repoState = this.gitRepos[this.currentRepo];
		sendMessage({
			command: 'loadCommits',
			repo: this.currentRepo,
			refreshId: ++this.currentRepoRefreshState.loadCommitsRefreshId,
			branches: this.currentBranches === null || (this.currentBranches.length === 1 && this.currentBranches[0] === SHOW_ALL_BRANCHES) ? null : this.currentBranches,
			maxCommits: this.maxCommits,
			showTags: getShowTags(repoState.showTags),
			showRemoteBranches: repoState.showRemoteBranches,
			includeCommitsMentionedByReflogs: getIncludeCommitsMentionedByReflogs(repoState.includeCommitsMentionedByReflogs),
			onlyFollowFirstParent: getOnlyFollowFirstParent(repoState.onlyFollowFirstParent),
			commitOrdering: getCommitOrdering(repoState.commitOrdering),
			remotes: this.gitRemotes,
			hideRemotes: repoState.hideRemotes,
			stashes: this.gitStashes
		});
	}

	private requestLoadRepoInfoAndCommits(hard: boolean, skipRepoInfo: boolean) {
		const refreshState = this.currentRepoRefreshState;
		if (refreshState.inProgress) {
			refreshState.hard = refreshState.hard || hard;
			if (!skipRepoInfo) {
				// This request will trigger a loadCommit request after the loadRepoInfo request has completed. 
				// Invalidate any previous commit requests in progress.
				refreshState.loadCommitsRefreshId++;
			}
		} else {
			refreshState.hard = hard;
			refreshState.inProgress = true;
			refreshState.repoInfoChanges = false;
			refreshState.requestingRepoInfo = false;
		}

		this.renderRefreshButton();
		if (this.commits.length === 0) {
			this.tableElem.innerHTML = '<h2 id="loadingHeader">' + SVG_ICONS.loading + 'Loading ...</h2>';
		}

		if (skipRepoInfo) {
			if (!refreshState.requestingRepoInfo) {
				this.requestLoadCommits();
			}
		} else {
			refreshState.requestingRepoInfo = true;
			this.requestLoadRepoInfo();
		}
	}

	public requestCommitDetails(hash: string, refresh: boolean) {
		let commit = this.commits[this.commitLookup[hash]];
		sendMessage({
			command: 'commitDetails',
			repo: this.currentRepo,
			commitHash: hash,
			hasParents: commit.parents.length > 0,
			stash: commit.stash,
			avatarEmail: this.config.fetchAvatars && hash !== UNCOMMITTED ? commit.email : null,
			refresh: refresh
		});
	}

	public requestCommitComparison(hash: string, compareWithHash: string, refresh: boolean) {
		let commitOrder = this.getCommitOrder(hash, compareWithHash);
		sendMessage({
			command: 'compareCommits',
			repo: this.currentRepo,
			commitHash: hash, compareWithHash: compareWithHash,
			fromHash: commitOrder.from, toHash: commitOrder.to,
			refresh: refresh
		});
	}

	private requestAvatars(avatars: { [email: string]: string[] }) {
		let emails = Object.keys(avatars), remote = this.gitRemotes.length > 0 ? this.gitRemotes.includes('origin') ? 'origin' : this.gitRemotes[0] : null;
		for (let i = 0; i < emails.length; i++) {
			sendMessage({ command: 'fetchAvatar', repo: this.currentRepo, remote: remote, email: emails[i], commits: avatars[emails[i]] });
		}
	}


	/* State */

	public saveState() {
		let expandedCommit;
		if (this.expandedCommit !== null) {
			expandedCommit = Object.assign({}, this.expandedCommit);
			expandedCommit.commitElem = null;
			expandedCommit.compareWithElem = null;
		} else {
			expandedCommit = null;
		}

		VSCODE_API.setState({
			currentRepo: this.currentRepo,
			currentRepoLoading: this.currentRepoLoading,
			gitRepos: this.gitRepos,
			gitBranches: this.gitBranches,
			gitBranchHead: this.gitBranchHead,
			gitRemotes: this.gitRemotes,
			gitStashes: this.gitStashes,
			commits: this.commits,
			commitHead: this.commitHead,
			avatars: this.avatars,
			currentBranches: this.currentBranches,
			moreCommitsAvailable: this.moreCommitsAvailable,
			maxCommits: this.maxCommits,
			onlyFollowFirstParent: this.onlyFollowFirstParent,
			expandedCommit: expandedCommit,
			scrollTop: this.scrollTop,
			findWidget: this.findWidget.getState(),
			settingsWidget: this.settingsWidget.getState()
		});
	}

	public saveRepoState() {
		sendMessage({ command: 'setRepoState', repo: this.currentRepo, state: this.gitRepos[this.currentRepo] });
	}

	private saveColumnWidths(columnWidths: GG.ColumnWidth[]) {
		this.gitRepos[this.currentRepo].columnWidths = [columnWidths[0], columnWidths[2], columnWidths[3], columnWidths[4]];
		this.saveRepoState();
	}

	private saveExpandedCommitLoading(index: number, commitHash: string, commitElem: HTMLElement, compareWithHash: string | null, compareWithElem: HTMLElement | null) {
		this.expandedCommit = {
			index: index,
			commitHash: commitHash,
			commitElem: commitElem,
			compareWithHash: compareWithHash,
			compareWithElem: compareWithElem,
			commitDetails: null,
			fileChanges: null,
			fileTree: null,
			avatar: null,
			codeReview: null,
			lastViewedFile: null,
			loading: true,
			fileChangesScrollTop: 0
		};
		this.saveState();
	}

	public saveCommitOrdering(repo: string, commitOrdering: GG.RepoCommitOrdering) {
		if (repo === this.currentRepo) {
			this.gitRepos[this.currentRepo].commitOrdering = commitOrdering;
			this.saveRepoState();
		}
	}

	public saveHiddenRemotes(repo: string, hideRemotes: string[]) {
		if (repo === this.currentRepo) {
			this.gitRepos[this.currentRepo].hideRemotes = hideRemotes;
			this.saveRepoState();
		}
	}

	public saveIssueLinkingConfig(repo: string, config: GG.IssueLinkingConfig | null) {
		if (repo === this.currentRepo) {
			this.gitRepos[this.currentRepo].issueLinkingConfig = config;
			this.saveRepoState();
		}
	}

	public savePullRequestConfig(repo: string, config: GG.PullRequestConfig | null) {
		if (repo === this.currentRepo) {
			this.gitRepos[this.currentRepo].pullRequestConfig = config;
			this.saveRepoState();
		}
	}

	public saveIncludeCommitsMentionedByReflogsConfig(repo: string, includeCommitsMentionedByReflogs: GG.IncludeCommitsMentionedByReflogs) {
		if (repo === this.currentRepo) {
			this.gitRepos[this.currentRepo].includeCommitsMentionedByReflogs = includeCommitsMentionedByReflogs;
			this.saveRepoState();
		}
	}

	public saveOnlyFollowFirstParentConfig(repo: string, onlyFollowFirstParent: GG.OnlyFollowFirstParent) {
		if (repo === this.currentRepo) {
			this.gitRepos[this.currentRepo].onlyFollowFirstParent = onlyFollowFirstParent;
			this.saveRepoState();
		}
	}

	public saveShowTagsConfig(repo: string, showTags: GG.ShowTags) {
		if (repo === this.currentRepo) {
			this.gitRepos[this.currentRepo].showTags = showTags;
			this.saveRepoState();
		}
	}

	public updateGlobalViewState<K extends keyof GG.GitGraphViewGlobalState>(key: K, value: GG.GitGraphViewGlobalState[K]) {
		globalState[key] = value;
		sendMessage({ command: 'setGlobalViewState', state: globalState });
	}


	/* Renderers */

	private render() {
		this.renderTable();
		this.renderGraph();
	}

	private renderGraph() {
		if (typeof this.currentRepo === 'undefined') {
			// Only render the graph if a repo is loaded (or a repo is currently being loaded)
			return;
		}

		const colHeadersElem = document.getElementById('tableColHeaders');
		const cdvHeight = this.gitRepos[this.currentRepo].cdvHeight;
		const headerHeight = colHeadersElem !== null ? colHeadersElem.clientHeight + 1 : 0;
		const expandedCommit = this.isCdvDocked() ? null : this.expandedCommit;
		const expandedCommitElem = expandedCommit !== null ? document.getElementById('cdv') : null;

		// Update the graphs grid dimensions
		this.config.grid.expandY = expandedCommitElem !== null
			? expandedCommitElem.getBoundingClientRect().height
			: cdvHeight;
		this.config.grid.y = this.commits.length > 0 && this.tableElem.children.length > 0
			? (this.tableElem.children[0].clientHeight - headerHeight - (expandedCommit !== null ? cdvHeight : 0)) / this.commits.length
			: this.config.grid.y;
		this.config.grid.offsetY = headerHeight + this.config.grid.y / 2;

		this.graph.render(expandedCommit);
	}

	private renderTable() {
		const colVisibility = this.getColumnVisibility();
		const currentHash = this.commits.length > 0 && this.commits[0].hash === UNCOMMITTED ? UNCOMMITTED : this.commitHead;
		const vertexColours = this.graph.getVertexColours();
		const widthsAtVertices = this.config.branchLabelsAlignedToGraph ? this.graph.getWidthsAtVertices() : [];
		const mutedCommits = this.graph.getMutedCommits(currentHash);
		const textFormatter = new TextFormatter(this.gitRepos[this.currentRepo].issueLinkingConfig, false, false);

		let html = '<tr id="tableColHeaders"><th id="tableHeaderGraphCol" class="tableColHeader" data-col="0">Graph</th><th class="tableColHeader" data-col="1">Description</th>' +
			(colVisibility.date ? '<th class="tableColHeader dateCol" data-col="2">Date</th>' : '') +
			(colVisibility.author ? '<th class="tableColHeader authorCol" data-col="3">Author</th>' : '') +
			(colVisibility.commit ? '<th class="tableColHeader" data-col="4">Commit</th>' : '') +
			'</tr>';

		for (let i = 0; i < this.commits.length; i++) {
			let commit = this.commits[i];
			let message = '<span class="text">' + textFormatter.format(commit.message) + '</span>';
			let date = formatShortDate(commit.date);
			let branchLabels = getBranchLabels(commit.heads, commit.remotes);
			let refBranches = '', refTags = '', j, k, refName, remoteName, refActive, refHtml, branchCheckedOutAtCommit: string | null = null;

			for (j = 0; j < branchLabels.heads.length; j++) {
				refName = escapeHtml(branchLabels.heads[j].name);
				refActive = branchLabels.heads[j].name === this.gitBranchHead;
				refHtml = '<span class="gitRef head' + (refActive ? ' active' : '') + '" data-name="' + refName + '">' + SVG_ICONS.branch + '<span class="gitRefName" data-fullref="' + refName + '">' + refName + '</span>';
				for (k = 0; k < branchLabels.heads[j].remotes.length; k++) {
					remoteName = escapeHtml(branchLabels.heads[j].remotes[k]);
					refHtml += '<span class="gitRefHeadRemote" data-remote="' + remoteName + '" data-fullref="' + escapeHtml(branchLabels.heads[j].remotes[k] + '/' + branchLabels.heads[j].name) + '">' + remoteName + '</span>';
				}
				refHtml += '</span>';
				refBranches = refActive ? refHtml + refBranches : refBranches + refHtml;
				if (refActive) branchCheckedOutAtCommit = this.gitBranchHead;
			}
			for (j = 0; j < branchLabels.remotes.length; j++) {
				refName = escapeHtml(branchLabels.remotes[j].name);
				refBranches += '<span class="gitRef remote" data-name="' + refName + '" data-remote="' + (branchLabels.remotes[j].remote !== null ? escapeHtml(branchLabels.remotes[j].remote!) : '') + '">' + SVG_ICONS.branch + '<span class="gitRefName" data-fullref="' + refName + '">' + refName + '</span></span>';
			}

			for (j = 0; j < commit.tags.length; j++) {
				refName = escapeHtml(commit.tags[j].name);
				refTags += '<span class="gitRef tag" data-name="' + refName + '" data-tagtype="' + (commit.tags[j].annotated ? 'annotated' : 'lightweight') + '">' + SVG_ICONS.tag + '<span class="gitRefName" data-fullref="' + refName + '">' + refName + '</span></span>';
			}

			if (commit.stash !== null) {
				refName = escapeHtml(commit.stash.selector);
				refBranches = '<span class="gitRef stash" data-name="' + refName + '">' + SVG_ICONS.stash + '<span class="gitRefName" data-fullref="' + refName + '">' + escapeHtml(commit.stash.selector.substring(5)) + '</span></span>' + refBranches;
			}

			const commitDot = commit.hash === this.commitHead
				? '<span class="commitHeadDot" title="' + (branchCheckedOutAtCommit !== null
					? 'The branch ' + escapeHtml('"' + branchCheckedOutAtCommit + '"') + ' is currently checked out at this commit'
					: 'This commit is currently checked out'
				) + '."></span>'
				: '';

			html += '<tr class="commit' + (commit.hash === currentHash ? ' current' : '') + (mutedCommits[i] ? ' mute' : '') + '"' + (commit.hash !== UNCOMMITTED ? '' : ' id="uncommittedChanges"') + ' data-id="' + i + '" data-color="' + vertexColours[i] + '">' +
				(this.config.branchLabelsAlignedToGraph ? '<td>' + (refBranches !== '' ? '<span style="margin-left:' + (widthsAtVertices[i] - 4) + 'px"' + refBranches.substring(5) : '') + '</td><td><span class="description">' + commitDot : '<td></td><td><span class="description">' + commitDot + refBranches) + (this.config.tagLabelsOnRight ? message + refTags : refTags + message) + '</span></td>' +
				(colVisibility.date ? '<td class="dateCol text" title="' + date.title + '">' + date.formatted + '</td>' : '') +
				(colVisibility.author ? '<td class="authorCol text" title="' + escapeHtml(commit.author + ' <' + commit.email + '>') + '">' + (this.config.fetchAvatars ? '<span class="avatar" data-email="' + escapeHtml(commit.email) + '">' + (typeof this.avatars[commit.email] === 'string' ? '<img class="avatarImg" src="' + this.avatars[commit.email] + '">' : '') + '</span>' : '') + escapeHtml(commit.author) + '</td>' : '') +
				(colVisibility.commit ? '<td class="text" title="' + escapeHtml(commit.hash) + '">' + abbrevCommit(commit.hash) + '</td>' : '') +
				'</tr>';
		}
		this.tableElem.innerHTML = '<table>' + html + '</table>';
		this.footerElem.innerHTML = this.moreCommitsAvailable ? '<div id="loadMoreCommitsBtn" class="roundedBtn">Load More Commits</div>' : '';
		this.makeTableResizable();
		this.findWidget.refresh();
		this.renderedGitBranchHead = this.gitBranchHead;

		if (this.moreCommitsAvailable) {
			document.getElementById('loadMoreCommitsBtn')!.addEventListener('click', () => {
				this.loadMoreCommits();
			});
		}

		if (this.expandedCommit !== null) {
			const expandedCommit = this.expandedCommit, elems = getCommitElems();
			const commitElem = findCommitElemWithId(elems, this.getCommitId(expandedCommit.commitHash));
			const compareWithElem = expandedCommit.compareWithHash !== null ? findCommitElemWithId(elems, this.getCommitId(expandedCommit.compareWithHash)) : null;

			if (commitElem === null || (expandedCommit.compareWithHash !== null && compareWithElem === null)) {
				this.closeCommitDetails(false);
				this.saveState();
			} else {
				expandedCommit.index = parseInt(commitElem.dataset.id!);
				expandedCommit.commitElem = commitElem;
				expandedCommit.compareWithElem = compareWithElem;
				this.saveState();
				if (expandedCommit.compareWithHash === null) {
					// Commit Details View is open
					if (!expandedCommit.loading && expandedCommit.commitDetails !== null && expandedCommit.fileTree !== null) {
						this.showCommitDetails(expandedCommit.commitDetails, expandedCommit.fileTree, expandedCommit.avatar, expandedCommit.codeReview, expandedCommit.lastViewedFile, true);
						if (expandedCommit.commitHash === UNCOMMITTED) {
							this.requestCommitDetails(expandedCommit.commitHash, true);
						}
					} else {
						this.loadCommitDetails(commitElem);
					}
				} else {
					// Commit Comparison is open
					if (!expandedCommit.loading && expandedCommit.fileChanges !== null && expandedCommit.fileTree !== null) {
						this.showCommitComparison(expandedCommit.commitHash, expandedCommit.compareWithHash, expandedCommit.fileChanges, expandedCommit.fileTree, expandedCommit.codeReview, expandedCommit.lastViewedFile, true);
						if (expandedCommit.commitHash === UNCOMMITTED || expandedCommit.compareWithHash === UNCOMMITTED) {
							this.requestCommitComparison(expandedCommit.commitHash, expandedCommit.compareWithHash, true);
						}
					} else {
						this.loadCommitComparison(commitElem, compareWithElem!);
					}
				}
			}
		}
	}

	private renderUncommittedChanges() {
		const colVisibility = this.getColumnVisibility(), date = formatShortDate(this.commits[0].date);
		document.getElementById('uncommittedChanges')!.innerHTML = '<td></td><td><b>' + escapeHtml(this.commits[0].message) + '</b></td>' +
			(colVisibility.date ? '<td class="dateCol text" title="' + date.title + '">' + date.formatted + '</td>' : '') +
			(colVisibility.author ? '<td class="authorCol text" title="* <>">*</td>' : '') +
			(colVisibility.commit ? '<td class="text" title="*">*</td>' : '');
	}

	private renderFetchButton() {
		alterClass(this.controlsElem, CLASS_FETCH_SUPPORTED, this.gitRemotes.length > 0);
	}

	public renderRefreshButton() {
		const enabled = !this.currentRepoRefreshState.inProgress;
		this.refreshBtnElem.title = enabled ? 'Refresh' : 'Refreshing';
		this.refreshBtnElem.innerHTML = enabled ? SVG_ICONS.refresh : SVG_ICONS.loading;
		alterClass(this.refreshBtnElem, CLASS_REFRESHING, !enabled);
	}

	public renderTagDetails(tagName: string, tagHash: string, commitHash: string, name: string, email: string, date: number, message: string) {
		const textFormatter = new TextFormatter(this.gitRepos[this.currentRepo].issueLinkingConfig, true, true);
		let html = 'Tag <b><i>' + escapeHtml(tagName) + '</i></b><br><span class="messageContent">';
		html += '<b>Object: </b>' + escapeHtml(tagHash) + '<br>';
		html += '<b>Commit: </b>' + escapeHtml(commitHash) + '<br>';
		html += '<b>Tagger: </b>' + escapeHtml(name) + ' &lt;<a href="mailto:' + escapeHtml(email) + '" tabindex="-1">' + escapeHtml(email) + '</a>&gt;<br>';
		html += '<b>Date: </b>' + formatLongDate(date) + '<br><br>';
		html += textFormatter.format(message) + '</span>';
		dialog.showMessage(html);
	}


	/* Context Menu Generation */

	private getBranchContextMenuActions(target: DialogTarget & RefTarget): ContextMenuActions {
		const refName = target.ref, visibility = this.config.contextMenuActionsVisibility.branch;
		return [[
			{
				title: 'Checkout Branch',
				visible: visibility.checkout && this.gitBranchHead !== refName,
				onClick: () => this.checkoutBranchAction(refName, null, null, target)
			}, {
				title: 'Rename Branch' + ELLIPSIS,
				visible: visibility.rename,
				onClick: () => {
					dialog.showRefInput('Enter the new name for branch <b><i>' + escapeHtml(refName) + '</i></b>:', refName, 'Rename Branch', (newName) => {
						runAction({ command: 'renameBranch', repo: this.currentRepo, oldName: refName, newName: newName }, 'Renaming Branch');
					}, target);
				}
			}, {
				title: 'Delete Branch' + ELLIPSIS,
				visible: visibility.delete && this.gitBranchHead !== refName,
				onClick: () => {
					let remotesWithBranch = this.gitRemotes.filter(remote => this.gitBranches.includes('remotes/' + remote + '/' + refName));
					let inputs: DialogInput[] = [{ type: DialogInputType.Checkbox, name: 'Force Delete', value: this.config.dialogDefaults.deleteBranch.forceDelete }];
					if (remotesWithBranch.length > 0) {
						inputs.push({
							type: DialogInputType.Checkbox,
							name: 'Delete this branch on the remote' + (this.gitRemotes.length > 1 ? 's' : '') + '<span class="dialogInfo" title="This branch is on the remote' + (remotesWithBranch.length > 1 ? 's: ' : ' ') + formatCommaSeparatedList(remotesWithBranch.map(remote => escapeHtml('"' + remote + '"'))) + '">' + SVG_ICONS.info + '</span>',
							value: false
						});
					}
					dialog.showForm('Are you sure you want to delete the branch <b><i>' + escapeHtml(refName) + '</i></b>?', inputs, 'Delete Branch', (values) => {
						runAction({ command: 'deleteBranch', repo: this.currentRepo, branchName: refName, forceDelete: <boolean>values[0], deleteOnRemotes: remotesWithBranch.length > 0 && <boolean>values[1] ? remotesWithBranch : [] }, 'Deleting Branch');
					}, target);
				}
			}, {
				title: 'Merge into current branch' + ELLIPSIS,
				visible: visibility.merge && this.gitBranchHead !== refName,
				onClick: () => this.mergeAction(refName, refName, GG.MergeActionOn.Branch, target)
			}, {
				title: 'Rebase current branch on Branch' + ELLIPSIS,
				visible: visibility.rebase && this.gitBranchHead !== refName,
				onClick: () => this.rebaseAction(refName, refName, GG.RebaseActionOn.Branch, target)
			}, {
				title: 'Push Branch' + ELLIPSIS,
				visible: visibility.push && this.gitRemotes.length > 0,
				onClick: () => {
					let multipleRemotes = this.gitRemotes.length > 1, inputs: DialogInput[] = [
						{ type: DialogInputType.Checkbox, name: 'Set Upstream', value: true },
						{
							type: DialogInputType.Radio,
							name: 'Push Mode',
							options: [
								{ name: 'Normal', value: GG.GitPushBranchMode.Normal },
								{ name: 'Force With Lease', value: GG.GitPushBranchMode.ForceWithLease },
								{ name: 'Force', value: GG.GitPushBranchMode.Force }
							],
							default: GG.GitPushBranchMode.Normal
						}
					];

					if (multipleRemotes) {
						inputs.unshift({
							type: DialogInputType.Select, name: 'Push to Remote',
							default: (this.gitRemotes.includes('origin') ? this.gitRemotes.indexOf('origin') : 0).toString(),
							options: this.gitRemotes.map((remote, index) => ({ name: remote, value: index.toString() }))
						});
					}

					dialog.showForm('Are you sure you want to push the branch <b><i>' + escapeHtml(refName) + '</i></b>' + (multipleRemotes ? '' : ' to the remote <b><i>' + escapeHtml(this.gitRemotes[0]) + '</i></b>') + '?', inputs, 'Yes, push', (values) => {
						let remote = this.gitRemotes[multipleRemotes ? parseInt(<string>values.shift()) : 0];
						runAction({ command: 'pushBranch', repo: this.currentRepo, branchName: refName, remote: remote, setUpstream: <boolean>values[0], mode: <GG.GitPushBranchMode>values[1] }, 'Pushing Branch');
					}, target);
				}
			}
		], [
			{
				title: 'Create Pull Request' + ELLIPSIS,
				visible: visibility.createPullRequest && this.gitRepos[this.currentRepo].pullRequestConfig !== null,
				onClick: () => {
					const config = this.gitRepos[this.currentRepo].pullRequestConfig;
					if (config === null) return;
					dialog.showCheckbox('Are you sure you want to create a Pull Request for branch <b><i>' + escapeHtml(refName) + '</i></b>?', 'Push branch before creating the Pull Request', true, 'Yes, create Pull Request', (push) => {
						runAction({ command: 'createPullRequest', repo: this.currentRepo, config: config, sourceRemote: config.sourceRemote, sourceOwner: config.sourceOwner, sourceRepo: config.sourceRepo, sourceBranch: refName, push: push }, 'Creating Pull Request');
					}, target);
				}
			}
		], [
			{
				title: 'Create Archive',
				visible: visibility.createArchive,
				onClick: () => {
					runAction({ command: 'createArchive', repo: this.currentRepo, ref: refName }, 'Creating Archive');
				}
			},
			{
				title: 'Copy Branch Name to Clipboard',
				visible: visibility.copyName,
				onClick: () => {
					sendMessage({ command: 'copyToClipboard', type: 'Branch Name', data: refName });
				}
			}
		]];
	}

	private getCommitContextMenuActions(target: DialogTarget & CommitTarget): ContextMenuActions {
		const hash = target.hash, visibility = this.config.contextMenuActionsVisibility.commit;
		const commit = this.commits[this.commitLookup[hash]];
		return [[
			{
				title: 'Add Tag' + ELLIPSIS,
				visible: visibility.addTag,
				onClick: () => {
					const dialogConfig = this.config.dialogDefaults.addTag;

					let mostRecentTagsIndex = -1;
					for (let i = 0; i < this.commits.length; i++) {
						if (this.commits[i].tags.length > 0 && (mostRecentTagsIndex === -1 || this.commits[i].date > this.commits[mostRecentTagsIndex].date)) {
							mostRecentTagsIndex = i;
						}
					}
					let mostRecentTags = mostRecentTagsIndex > -1 ? this.commits[mostRecentTagsIndex].tags.map((tag) => '"' + tag.name + '"') : [];

					let inputs: DialogInput[] = [
						{ type: DialogInputType.TextRef, name: 'Name', default: '', info: mostRecentTags.length > 0 ? 'The most recent tag' + (mostRecentTags.length > 1 ? 's' : '') + ' in the loaded commits ' + (mostRecentTags.length > 1 ? 'are' : 'is') + ' ' + formatCommaSeparatedList(mostRecentTags) + '.' : undefined },
						{ type: DialogInputType.Select, name: 'Type', default: dialogConfig.type, options: [{ name: 'Annotated', value: 'annotated' }, { name: 'Lightweight', value: 'lightweight' }] },
						{ type: DialogInputType.Text, name: 'Message', default: '', placeholder: 'Optional', info: 'A message can only be added to an annotated tag.' }
					];
					if (this.gitRemotes.length > 1) {
						let options = [{ name: 'Don\'t push', value: '-1' }];
						this.gitRemotes.forEach((remote, i) => options.push({ name: remote, value: i.toString() }));
						let defaultOption = dialogConfig.pushToRemote
							? this.gitRemotes.includes('origin')
								? this.gitRemotes.indexOf('origin')
								: 0
							: -1;
						inputs.push({ type: DialogInputType.Select, name: 'Push to remote', options: options, default: defaultOption.toString(), info: 'Once this tag has been added, push it to this remote.' });
					} else if (this.gitRemotes.length === 1) {
						inputs.push({ type: DialogInputType.Checkbox, name: 'Push to remote', value: dialogConfig.pushToRemote, info: 'Once this tag has been added, push it to the repositories remote.' });
					}
					dialog.showForm('Add tag to commit <b><i>' + abbrevCommit(hash) + '</i></b>:', inputs, 'Add Tag', (values) => {
						let pushToRemote = this.gitRemotes.length > 1 && <string>values[3] !== '-1'
							? this.gitRemotes[parseInt(<string>values[3])]
							: this.gitRemotes.length === 1 && <boolean>values[3]
								? this.gitRemotes[0]
								: null;
						runAction({
							command: 'addTag',
							repo: this.currentRepo,
							tagName: <string>values[0],
							commitHash: hash,
							lightweight: <string>values[1] === 'lightweight',
							message: <string>values[2],
							pushToRemote: pushToRemote
						}, 'Adding Tag');
					}, target);
				}
			}, {
				title: 'Create Branch' + ELLIPSIS,
				visible: visibility.createBranch,
				onClick: () => {
					dialog.showForm('Create branch at commit <b><i>' + abbrevCommit(hash) + '</i></b>:', [
						{ type: DialogInputType.TextRef, name: 'Name', default: '' },
						{ type: DialogInputType.Checkbox, name: 'Check out', value: this.config.dialogDefaults.createBranch.checkout }
					], 'Create Branch', (values) => {
						runAction({ command: 'createBranch', repo: this.currentRepo, branchName: <string>values[0], commitHash: hash, checkout: <boolean>values[1] }, 'Creating Branch');
					}, target);
				}
			}
		], [
			{
				title: 'Checkout' + (globalState.alwaysAcceptCheckoutCommit ? '' : ELLIPSIS),
				visible: visibility.checkout,
				onClick: () => {
					const checkoutCommit = () => runAction({ command: 'checkoutCommit', repo: this.currentRepo, commitHash: hash }, 'Checking out Commit');
					if (globalState.alwaysAcceptCheckoutCommit) {
						checkoutCommit();
					} else {
						dialog.showCheckbox('Are you sure you want to checkout commit <b><i>' + abbrevCommit(hash) + '</i></b>? This will result in a \'detached HEAD\' state.', 'Always Accept', false, 'Yes, checkout', (alwaysAccept) => {
							if (alwaysAccept) {
								this.updateGlobalViewState('alwaysAcceptCheckoutCommit', true);
							}
							checkoutCommit();
						}, target);
					}
				}
			}, {
				title: 'Cherry Pick' + ELLIPSIS,
				visible: visibility.cherrypick,
				onClick: () => {
					const isMerge = commit.parents.length > 1;
					let inputs: DialogInput[] = [];
					if (isMerge) {
						let options = commit.parents.map((hash, index) => ({
							name: abbrevCommit(hash) + (typeof this.commitLookup[hash] === 'number' ? ': ' + this.commits[this.commitLookup[hash]].message : ''),
							value: (index + 1).toString()
						}));
						inputs.push({
							type: DialogInputType.Select,
							name: 'Parent Hash',
							options: options,
							default: '1',
							info: 'Choose the parent hash on the main branch, to cherry pick the commit relative to.'
						});
					}
					inputs.push({
						type: DialogInputType.Checkbox,
						name: 'Record Origin',
						value: this.config.dialogDefaults.cherryPick.recordOrigin,
						info: 'Record that this commit was the origin of the cherry pick by appending a line to the original commit message that states "(cherry picked from commit ...​)".'
					}, {
						type: DialogInputType.Checkbox,
						name: 'No Commit',
						value: this.config.dialogDefaults.cherryPick.noCommit,
						info: 'Cherry picked changes will be staged but not committed, so that you can select and commit specific parts of this commit.'
					});

					dialog.showForm('Are you sure you want to cherry pick commit <b><i>' + abbrevCommit(hash) + '</i></b>?', inputs, 'Yes, cherry pick', (values) => {
						let parentIndex = isMerge ? parseInt(<string>values.shift()) : 0;
						runAction({
							command: 'cherrypickCommit',
							repo: this.currentRepo,
							commitHash: hash,
							parentIndex: parentIndex,
							recordOrigin: <boolean>values[0],
							noCommit: <boolean>values[1]
						}, 'Cherry picking Commit');
					}, target);
				}
			}, {
				title: 'Revert' + ELLIPSIS,
				visible: visibility.revert,
				onClick: () => {
					if (commit.parents.length > 1) {
						let options = commit.parents.map((hash, index) => ({
							name: abbrevCommit(hash) + (typeof this.commitLookup[hash] === 'number' ? ': ' + this.commits[this.commitLookup[hash]].message : ''),
							value: (index + 1).toString()
						}));
						dialog.showSelect('Are you sure you want to revert merge commit <b><i>' + abbrevCommit(hash) + '</i></b>? Choose the parent hash on the main branch, to revert the commit relative to:', '1', options, 'Yes, revert', (parentIndex) => {
							runAction({ command: 'revertCommit', repo: this.currentRepo, commitHash: hash, parentIndex: parseInt(parentIndex) }, 'Reverting Commit');
						}, target);
					} else {
						dialog.showConfirmation('Are you sure you want to revert commit <b><i>' + abbrevCommit(hash) + '</i></b>?', () => {
							runAction({ command: 'revertCommit', repo: this.currentRepo, commitHash: hash, parentIndex: 0 }, 'Reverting Commit');
						}, target);
					}
				}
			}, {
				title: 'Drop' + ELLIPSIS,
				visible: visibility.drop && this.graph.dropCommitPossible(this.commitLookup[hash]),
				onClick: () => {
					dialog.showConfirmation('Are you sure you want to permanently drop commit <b><i>' + abbrevCommit(hash) + '</i></b>?' + (this.onlyFollowFirstParent ? '<br/><i>Note: By enabling "Only follow the first parent of commits", some commits may have been hidden from the Git Graph View that could affect the outcome of performing this action.</i>' : ''), () => {
						runAction({ command: 'dropCommit', repo: this.currentRepo, commitHash: hash }, 'Dropping Commit');
					}, target);
				}
			}
		], [
			{
				title: 'Merge into current branch' + ELLIPSIS,
				visible: visibility.merge,
				onClick: () => this.mergeAction(hash, abbrevCommit(hash), GG.MergeActionOn.Commit, target)
			}, {
				title: 'Rebase current branch on this Commit' + ELLIPSIS,
				visible: visibility.rebase,
				onClick: () => this.rebaseAction(hash, abbrevCommit(hash), GG.RebaseActionOn.Commit, target)
			}, {
				title: 'Reset current branch to this Commit' + ELLIPSIS,
				visible: visibility.reset,
				onClick: () => {
					dialog.showSelect('Are you sure you want to reset the <b>current branch</b> to commit <b><i>' + abbrevCommit(hash) + '</i></b>?', this.config.dialogDefaults.resetCommit.mode, [
						{ name: 'Soft - Keep all changes, but reset head', value: GG.GitResetMode.Soft },
						{ name: 'Mixed - Keep working tree, but reset index', value: GG.GitResetMode.Mixed },
						{ name: 'Hard - Discard all changes', value: GG.GitResetMode.Hard }
					], 'Yes, reset', (mode) => {
						runAction({ command: 'resetToCommit', repo: this.currentRepo, commit: hash, resetMode: <GG.GitResetMode>mode }, 'Resetting to Commit');
					}, target);
				}
			}
		], [
			{
				title: 'Copy Commit Hash to Clipboard',
				visible: visibility.copyHash,
				onClick: () => {
					sendMessage({ command: 'copyToClipboard', type: 'Commit Hash', data: hash });
				}
			},
			{
				title: 'Copy Commit Subject to Clipboard',
				visible: visibility.copySubject,
				onClick: () => {
					sendMessage({ command: 'copyToClipboard', type: 'Commit Subject', data: commit.message });
				}
			}
		]];
	}

	private getRemoteBranchContextMenuActions(remote: string, target: DialogTarget & RefTarget): ContextMenuActions {
		const refName = target.ref, visibility = this.config.contextMenuActionsVisibility.remoteBranch;
		const branchName = remote !== '' ? refName.substring(remote.length + 1) : '';
		return [[
			{
				title: 'Checkout Branch' + ELLIPSIS,
				visible: visibility.checkout,
				onClick: () => this.checkoutBranchAction(refName, remote, null, target)
			}, {
				title: 'Delete Remote Branch' + ELLIPSIS,
				visible: visibility.delete && remote !== '',
				onClick: () => {
					dialog.showConfirmation('Are you sure you want to delete the remote branch <b><i>' + escapeHtml(refName) + '</i></b>?', () => {
						runAction({ command: 'deleteRemoteBranch', repo: this.currentRepo, branchName: branchName, remote: remote }, 'Deleting Remote Branch');
					}, target);
				}
			}, {
				title: 'Fetch into local branch' + ELLIPSIS,
				visible: visibility.fetch && remote !== '' && this.gitBranches.includes(branchName) && this.gitBranchHead !== branchName,
				onClick: () => {
					dialog.showConfirmation('Are you sure you want to fetch the remote branch <b><i>' + escapeHtml(refName) + '</i></b> into the local branch <b><i>' + escapeHtml(branchName) + '</i></b>?', () => {
						runAction({ command: 'fetchIntoLocalBranch', repo: this.currentRepo, remote: remote, remoteBranch: branchName, localBranch: branchName }, 'Fetching Branch');
					}, target);
				}
			}, {
				title: 'Merge into current branch' + ELLIPSIS,
				visible: visibility.merge,
				onClick: () => this.mergeAction(refName, refName, GG.MergeActionOn.RemoteTrackingBranch, target)
			}, {
				title: 'Pull into current branch' + ELLIPSIS,
				visible: visibility.pull && remote !== '',
				onClick: () => {
					dialog.showForm('Are you sure you want to pull the remote branch <b><i>' + escapeHtml(refName) + '</i></b> into the current branch? If a merge is required:', [
						{ type: DialogInputType.Checkbox, name: 'Create a new commit even if fast-forward is possible', value: false },
						{ type: DialogInputType.Checkbox, name: 'Squash commits', value: false }
					], 'Yes, pull', (values) => {
						runAction({ command: 'pullBranch', repo: this.currentRepo, branchName: branchName, remote: remote, createNewCommit: <boolean>values[0], squash: <boolean>values[1] }, 'Pulling Branch');
					}, target);
				}
			}
		], [
			{
				title: 'Create Pull Request',
				visible: visibility.createPullRequest && this.gitRepos[this.currentRepo].pullRequestConfig !== null && branchName !== 'HEAD' &&
					(this.gitRepos[this.currentRepo].pullRequestConfig!.sourceRemote === remote || this.gitRepos[this.currentRepo].pullRequestConfig!.destRemote === remote),
				onClick: () => {
					const config = this.gitRepos[this.currentRepo].pullRequestConfig;
					if (config === null) return;
					const isDestRemote = config.destRemote === remote;
					runAction({
						command: 'createPullRequest',
						repo: this.currentRepo,
						config: config,
						sourceRemote: isDestRemote ? config.destRemote! : config.sourceRemote,
						sourceOwner: isDestRemote ? config.destOwner : config.sourceOwner,
						sourceRepo: isDestRemote ? config.destRepo : config.sourceRepo,
						sourceBranch: branchName,
						push: false
					}, 'Creating Pull Request');
				}
			}
		], [
			{
				title: 'Create Archive',
				visible: visibility.createArchive,
				onClick: () => {
					runAction({ command: 'createArchive', repo: this.currentRepo, ref: refName }, 'Creating Archive');
				}
			},
			{
				title: 'Copy Branch Name to Clipboard',
				visible: visibility.copyName,
				onClick: () => {
					sendMessage({ command: 'copyToClipboard', type: 'Branch Name', data: refName });
				}
			}
		]];
	}

	private getStashContextMenuActions(target: DialogTarget & RefTarget): ContextMenuActions {
		const hash = target.hash, selector = target.ref, visibility = this.config.contextMenuActionsVisibility.stash;
		return [[
			{
				title: 'Apply Stash' + ELLIPSIS,
				visible: visibility.apply,
				onClick: () => {
					dialog.showForm('Are you sure you want to apply the stash <b><i>' + escapeHtml(selector.substring(5)) + '</i></b>?', [{
						type: DialogInputType.Checkbox,
						name: 'Reinstate Index',
						value: this.config.dialogDefaults.applyStash.reinstateIndex,
						info: 'Attempt to reinstate the indexed changes, in addition to the working tree\'s changes.'
					}], 'Yes, apply stash', (values) => {
						runAction({ command: 'applyStash', repo: this.currentRepo, selector: selector, reinstateIndex: <boolean>values[0] }, 'Applying Stash');
					}, target);
				}
			}, {
				title: 'Create Branch from Stash' + ELLIPSIS,
				visible: visibility.createBranch,
				onClick: () => {
					dialog.showRefInput('Create a branch from stash <b><i>' + escapeHtml(selector.substring(5)) + '</i></b> with the name:', '', 'Create Branch', (branchName) => {
						runAction({ command: 'branchFromStash', repo: this.currentRepo, selector: selector, branchName: branchName }, 'Creating Branch');
					}, target);
				}
			}, {
				title: 'Pop Stash' + ELLIPSIS,
				visible: visibility.pop,
				onClick: () => {
					dialog.showForm('Are you sure you want to pop the stash <b><i>' + escapeHtml(selector.substring(5)) + '</i></b>?', [{
						type: DialogInputType.Checkbox,
						name: 'Reinstate Index',
						value: this.config.dialogDefaults.popStash.reinstateIndex,
						info: 'Attempt to reinstate the indexed changes, in addition to the working tree\'s changes.'
					}], 'Yes, pop stash', (values) => {
						runAction({ command: 'popStash', repo: this.currentRepo, selector: selector, reinstateIndex: <boolean>values[0] }, 'Popping Stash');
					}, target);
				}
			}, {
				title: 'Drop Stash' + ELLIPSIS,
				visible: visibility.drop,
				onClick: () => {
					dialog.showConfirmation('Are you sure you want to drop the stash <b><i>' + escapeHtml(selector.substring(5)) + '</i></b>?', () => {
						runAction({ command: 'dropStash', repo: this.currentRepo, selector: selector }, 'Dropping Stash');
					}, target);
				}
			}
		], [
			{
				title: 'Copy Stash Name to Clipboard',
				visible: visibility.copyName,
				onClick: () => {
					sendMessage({ command: 'copyToClipboard', type: 'Stash Name', data: selector });
				}
			}, {
				title: 'Copy Stash Hash to Clipboard',
				visible: visibility.copyHash,
				onClick: () => {
					sendMessage({ command: 'copyToClipboard', type: 'Stash Hash', data: hash });
				}
			}
		]];
	}

	private getTagContextMenuActions(isAnnotated: boolean, target: DialogTarget & RefTarget): ContextMenuActions {
		const hash = target.hash, tagName = target.ref, visibility = this.config.contextMenuActionsVisibility.tag;
		return [[
			{
				title: 'View Details',
				visible: visibility.viewDetails && isAnnotated,
				onClick: () => {
					runAction({ command: 'tagDetails', repo: this.currentRepo, tagName: tagName, commitHash: hash }, 'Retrieving Tag Details');
				}
			}, {
				title: 'Delete Tag' + ELLIPSIS,
				visible: visibility.delete,
				onClick: () => {
					let message = 'Are you sure you want to delete the tag <b><i>' + escapeHtml(tagName) + '</i></b>?';
					if (this.gitRemotes.length > 1) {
						let options = [{ name: 'Don\'t delete on any remote', value: '-1' }];
						this.gitRemotes.forEach((remote, i) => options.push({ name: remote, value: i.toString() }));
						dialog.showSelect(message + '<br>Do you also want to delete the tag on a remote:', '-1', options, 'Yes, delete', remoteIndex => {
							this.deleteTagAction(tagName, remoteIndex !== '-1' ? this.gitRemotes[parseInt(remoteIndex)] : null);
						}, target);
					} else if (this.gitRemotes.length === 1) {
						dialog.showCheckbox(message, 'Also delete on remote', false, 'Yes, delete', deleteOnRemote => {
							this.deleteTagAction(tagName, deleteOnRemote ? this.gitRemotes[0] : null);
						}, target);
					} else {
						dialog.showConfirmation(message, () => {
							this.deleteTagAction(tagName, null);
						}, target);
					}
				}
			}, {
				title: 'Push Tag' + ELLIPSIS,
				visible: visibility.push && this.gitRemotes.length > 0,
				onClick: () => {
					if (this.gitRemotes.length === 1) {
						dialog.showConfirmation('Are you sure you want to push the tag <b><i>' + escapeHtml(tagName) + '</i></b> to the remote <b><i>' + escapeHtml(this.gitRemotes[0]) + '</i></b>?', () => {
							runAction({ command: 'pushTag', repo: this.currentRepo, tagName: tagName, remote: this.gitRemotes[0] }, 'Pushing Tag');
						}, target);
					} else if (this.gitRemotes.length > 1) {
						let defaultRemote = (this.gitRemotes.includes('origin') ? this.gitRemotes.indexOf('origin') : 0).toString();
						let remoteOptions = this.gitRemotes.map((remote, index) => ({ name: remote, value: index.toString() }));
						dialog.showSelect('Are you sure you want to push the tag <b><i>' + escapeHtml(tagName) + '</i></b>? Select the remote to push the tag to:', defaultRemote, remoteOptions, 'Yes, push', (remoteIndex) => {
							runAction({ command: 'pushTag', repo: this.currentRepo, tagName: tagName, remote: this.gitRemotes[parseInt(remoteIndex)] }, 'Pushing Tag');
						}, target);
					}
				}
			}
		], [
			{
				title: 'Create Archive',
				visible: visibility.createArchive,
				onClick: () => {
					runAction({ command: 'createArchive', repo: this.currentRepo, ref: tagName }, 'Creating Archive');
				}
			},
			{
				title: 'Copy Tag Name to Clipboard',
				visible: visibility.copyName,
				onClick: () => {
					sendMessage({ command: 'copyToClipboard', type: 'Tag Name', data: tagName });
				}
			}
		]];
	}

	private getUncommittedChangesContextMenuActions(target: DialogTarget & CommitTarget): ContextMenuActions {
		let visibility = this.config.contextMenuActionsVisibility.uncommittedChanges;
		return [[
			{
				title: 'Stash uncommitted changes' + ELLIPSIS,
				visible: visibility.stash,
				onClick: () => {
					dialog.showForm('Are you sure you want to stash the <b>uncommitted changes</b>?', [
						{ type: DialogInputType.Text, name: 'Message', default: '', placeholder: 'Optional' },
						{ type: DialogInputType.Checkbox, name: 'Include Untracked', value: this.config.dialogDefaults.stashUncommittedChanges.includeUntracked, info: 'Include all untracked files in the stash, and then clean them from the working directory.' }
					], 'Yes, stash', (values) => {
						runAction({ command: 'pushStash', repo: this.currentRepo, message: <string>values[0], includeUntracked: <boolean>values[1] }, 'Stashing uncommitted changes');
					}, target);
				}
			}
		], [
			{
				title: 'Reset uncommitted changes' + ELLIPSIS,
				visible: visibility.reset,
				onClick: () => {
					dialog.showSelect('Are you sure you want to reset the <b>uncommitted changes</b> to <b>HEAD</b>?', this.config.dialogDefaults.resetUncommitted.mode, [
						{ name: 'Mixed - Keep working tree, but reset index', value: GG.GitResetMode.Mixed },
						{ name: 'Hard - Discard all changes', value: GG.GitResetMode.Hard }
					], 'Yes, reset', (mode) => {
						runAction({ command: 'resetToCommit', repo: this.currentRepo, commit: 'HEAD', resetMode: <GG.GitResetMode>mode }, 'Resetting uncommitted changes');
					}, target);
				}
			}, {
				title: 'Clean untracked files' + ELLIPSIS,
				visible: visibility.clean,
				onClick: () => {
					dialog.showCheckbox('Are you sure you want to clean all untracked files?', 'Clean untracked directories', true, 'Yes, clean', directories => {
						runAction({ command: 'cleanUntrackedFiles', repo: this.currentRepo, directories: directories }, 'Cleaning untracked files');
					}, target);
				}
			}
		], [
			{
				title: 'Open Source Control View',
				visible: visibility.openSourceControlView,
				onClick: () => {
					sendMessage({ command: 'viewScm' });
				}
			}
		]];
	}

	private getCommitOfElem(elem: HTMLElement) {
		let id = parseInt(elem.dataset.id!);
		return id < this.commits.length ? this.commits[id] : null;
	}

	private getCommitId(hash: string) {
		return typeof this.commitLookup[hash] === 'number' ? this.commitLookup[hash] : null;
	}


	/* Actions */

	private checkoutBranchAction(refName: string, remote: string | null, prefillName: string | null, target: DialogTarget & (CommitTarget | RefTarget)) {
		if (remote !== null) {
			dialog.showRefInput('Enter the name of the new branch you would like to create when checking out <b><i>' + escapeHtml(refName) + '</i></b>:', (prefillName !== null ? prefillName : (remote !== '' ? refName.substring(remote.length + 1) : refName)), 'Checkout Branch', newBranch => {
				if (this.gitBranches.includes(newBranch)) {
					const canPullFromRemote = remote !== '';
					dialog.showTwoButtons('The name <b><i>' + escapeHtml(newBranch) + '</i></b> is already used by another branch:', 'Choose another branch name', () => {
						this.checkoutBranchAction(refName, remote, newBranch, target);
					}, 'Checkout the existing branch' + (canPullFromRemote ? ' & pull changes' : ''), () => {
						runAction({ command: 'checkoutBranch', repo: this.currentRepo, branchName: newBranch, remoteBranch: null, pullAfterwards: canPullFromRemote ? { branchName: refName.substring(remote.length + 1), remote: remote } : null }, 'Checking out Branch' + (canPullFromRemote ? ' & Pulling Changes' : ''));
					}, target);
				} else {
					runAction({ command: 'checkoutBranch', repo: this.currentRepo, branchName: newBranch, remoteBranch: refName, pullAfterwards: null }, 'Checking out Branch');
				}
			}, target);
		} else {
			runAction({ command: 'checkoutBranch', repo: this.currentRepo, branchName: refName, remoteBranch: null, pullAfterwards: null }, 'Checking out Branch');
		}
	}

	private deleteTagAction(refName: string, deleteOnRemote: string | null) {
		runAction({ command: 'deleteTag', repo: this.currentRepo, tagName: refName, deleteOnRemote: deleteOnRemote }, 'Deleting Tag');
	}

	private mergeAction(obj: string, name: string, actionOn: GG.MergeActionOn, target: DialogTarget & (CommitTarget | RefTarget)) {
		dialog.showForm('Are you sure you want to merge ' + actionOn.toLowerCase() + ' <b><i>' + escapeHtml(name) + '</i></b> into the current branch?', [
			{ type: DialogInputType.Checkbox, name: 'Create a new commit even if fast-forward is possible', value: this.config.dialogDefaults.merge.noFastForward },
			{ type: DialogInputType.Checkbox, name: 'Squash Commits', value: this.config.dialogDefaults.merge.squash, info: 'Create a single commit on the current branch whose effect is the same as merging this ' + actionOn.toLowerCase() + '.' },
			{ type: DialogInputType.Checkbox, name: 'No Commit', value: this.config.dialogDefaults.merge.noCommit, info: 'The changes of the merge will be staged but not committed, so that you can review and/or modify the merge result before committing.' }
		], 'Yes, merge', (values) => {
			runAction({ command: 'merge', repo: this.currentRepo, obj: obj, actionOn: actionOn, createNewCommit: <boolean>values[0], squash: <boolean>values[1], noCommit: <boolean>values[2] }, 'Merging ' + actionOn);
		}, target);
	}

	private rebaseAction(obj: string, name: string, actionOn: GG.RebaseActionOn, target: DialogTarget & (CommitTarget | RefTarget)) {
		dialog.showForm('Are you sure you want to rebase the current branch on ' + actionOn.toLowerCase() + ' <b><i>' + escapeHtml(name) + '</i></b>?', [
			{ type: DialogInputType.Checkbox, name: 'Launch Interactive Rebase in new Terminal', value: this.config.dialogDefaults.rebase.interactive },
			{ type: DialogInputType.Checkbox, name: 'Ignore Date', value: this.config.dialogDefaults.rebase.ignoreDate, info: 'Only applicable to a non-interactive rebase.' }
		], 'Yes, rebase', (values) => {
			let interactive = <boolean>values[0];
			runAction({ command: 'rebase', repo: this.currentRepo, obj: obj, actionOn: actionOn, ignoreDate: <boolean>values[1], interactive: interactive }, interactive ? 'Launching Interactive Rebase' : 'Rebasing on ' + actionOn);
		}, target);
	}


	/* Table Utils */

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
			this.tableElem.style.removeProperty(CSS_PROP_LIMIT_GRAPH_WIDTH);
			this.graph.limitMaxWidth(columnWidths[0] + COLUMN_LEFT_RIGHT_PADDING);
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

			let colWidth = cols[0].offsetWidth, graphWidth = this.graph.getContentWidth();
			let maxWidth = Math.round(this.viewElem.clientWidth * 0.333);
			if (Math.max(graphWidth, colWidth) > maxWidth) {
				this.graph.limitMaxWidth(maxWidth);
				graphWidth = maxWidth;
				this.tableElem.className += ' limitGraphWidth';
				this.tableElem.style.setProperty(CSS_PROP_LIMIT_GRAPH_WIDTH, maxWidth + 'px');
			} else {
				this.graph.limitMaxWidth(-1);
				this.tableElem.style.removeProperty(CSS_PROP_LIMIT_GRAPH_WIDTH);
			}

			if (colWidth < Math.max(graphWidth, 64)) {
				cols[0].style.padding = '6px ' + Math.floor((Math.max(graphWidth, 64) - (colWidth - COLUMN_LEFT_RIGHT_PADDING)) / 2) + 'px';
			}
		}

		const processResizingColumn: EventListener = (e) => {
			if (col > -1) {
				let mouseEvent = <MouseEvent>e;
				let mouseDeltaX = mouseEvent.clientX - mouseX;

				if (col === 0) {
					if (columnWidths[0] + mouseDeltaX < COLUMN_MIN_WIDTH) mouseDeltaX = -columnWidths[0] + COLUMN_MIN_WIDTH;
					if (cols[1].clientWidth - COLUMN_LEFT_RIGHT_PADDING - mouseDeltaX < COLUMN_MIN_WIDTH) mouseDeltaX = cols[1].clientWidth - COLUMN_LEFT_RIGHT_PADDING - COLUMN_MIN_WIDTH;
					columnWidths[0] += mouseDeltaX;
					cols[0].style.width = columnWidths[0] + 'px';
					this.graph.limitMaxWidth(columnWidths[0] + COLUMN_LEFT_RIGHT_PADDING);
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
		};
		const stopResizingColumn: EventListener = () => {
			if (col > -1) {
				col = -1;
				colIndex = -1;
				mouseX = -1;
				eventOverlay.remove();
				this.saveColumnWidths(columnWidths);
			}
		};

		addListenerToClass('resizeCol', 'mousedown', (e) => {
			if (e.target === null) return;
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
			eventOverlay.create('colResize', processResizingColumn, stopResizingColumn);
		});

		colHeadersElem.addEventListener('contextmenu', (e: MouseEvent) => {
			handledEvent(e);

			const toggleColumnState = (col: number, defaultWidth: number) => {
				columnWidths[col] = columnWidths[col] !== COLUMN_HIDDEN ? COLUMN_HIDDEN : columnWidths[0] === COLUMN_AUTO ? COLUMN_AUTO : defaultWidth - COLUMN_LEFT_RIGHT_PADDING;
				this.saveColumnWidths(columnWidths);
				this.render();
			};

			const commitOrdering = getCommitOrdering(this.gitRepos[this.currentRepo].commitOrdering);
			const changeCommitOrdering = (repoCommitOrdering: GG.RepoCommitOrdering) => {
				this.saveCommitOrdering(this.currentRepo, repoCommitOrdering);
				this.refresh(true);
			};

			contextMenu.show([
				[
					{
						title: 'Date',
						visible: true,
						checked: columnWidths[2] !== COLUMN_HIDDEN,
						onClick: () => toggleColumnState(2, 128)
					},
					{
						title: 'Author',
						visible: true,
						checked: columnWidths[3] !== COLUMN_HIDDEN,
						onClick: () => toggleColumnState(3, 128)
					},
					{
						title: 'Commit',
						visible: true,
						checked: columnWidths[4] !== COLUMN_HIDDEN,
						onClick: () => toggleColumnState(4, 80)
					}
				],
				[
					{
						title: 'Commit Timestamp Order',
						visible: true,
						checked: commitOrdering === GG.CommitOrdering.Date,
						onClick: () => changeCommitOrdering(GG.RepoCommitOrdering.Date)
					},
					{
						title: 'Author Timestamp Order',
						visible: true,
						checked: commitOrdering === GG.CommitOrdering.AuthorDate,
						onClick: () => changeCommitOrdering(GG.RepoCommitOrdering.AuthorDate)
					},
					{
						title: 'Topological Order',
						visible: true,
						checked: commitOrdering === GG.CommitOrdering.Topological,
						onClick: () => changeCommitOrdering(GG.RepoCommitOrdering.Topological)
					}
				]
			], true, null, e);
		});
	}

	public getColumnVisibility() {
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

	/**
	 * Scroll the view to the previous or next stash.
	 * @param next TRUE => Jump to the next stash, FALSE => Jump to the previous stash.
	 */
	private scrollToStash(next: boolean) {
		const stashCommits = this.commits.filter((commit) => commit.stash !== null);
		if (stashCommits.length > 0) {
			const curTime = (new Date()).getTime();
			if (this.lastScrollToStash.time < curTime - 5000) {
				// Reset the lastScrollToStash hash if it was more than 5 seconds ago
				this.lastScrollToStash.hash = null;
			}

			const lastScrollToStashCommitIndex = this.lastScrollToStash.hash !== null
				? stashCommits.findIndex((commit) => commit.hash === this.lastScrollToStash.hash)
				: -1;
			let scrollToStashCommitIndex = lastScrollToStashCommitIndex + (next ? 1 : -1);
			if (scrollToStashCommitIndex >= stashCommits.length) {
				scrollToStashCommitIndex = 0;
			} else if (scrollToStashCommitIndex < 0) {
				scrollToStashCommitIndex = stashCommits.length - 1;
			}
			this.scrollToCommit(stashCommits[scrollToStashCommitIndex].hash, true, true);
			this.lastScrollToStash.time = curTime;
			this.lastScrollToStash.hash = stashCommits[scrollToStashCommitIndex].hash;
		}
	}

	/**
	 * Scroll the view to a commit (if it exists).
	 * @param hash The hash of the commit to scroll to.
	 * @param alwaysCenterCommit TRUE => Always scroll the view to be centered on the commit. FALSE => Don't scroll the view if the commit is already within the visible portion of commits.
	 * @param flash Should the commit flash after it has been scrolled to.
	 */
	public scrollToCommit(hash: string, alwaysCenterCommit: boolean, flash: boolean = false) {
		const elem = findCommitElemWithId(getCommitElems(), this.getCommitId(hash));
		if (elem === null) return;

		let elemTop = this.controlsElem.clientHeight + elem.offsetTop;
		if (alwaysCenterCommit || elemTop - 8 < this.viewElem.scrollTop || elemTop + 32 - this.viewElem.clientHeight > this.viewElem.scrollTop) {
			this.viewElem.scroll(0, this.controlsElem.clientHeight + elem.offsetTop + 12 - this.viewElem.clientHeight / 2);
		}

		if (flash && !elem.classList.contains('flash')) {
			elem.classList.add('flash');
			setTimeout(() => {
				elem.classList.remove('flash');
			}, 850);
		}
	}

	private loadMoreCommits() {
		this.footerElem.innerHTML = '<h2 id="loadingHeader">' + SVG_ICONS.loading + 'Loading ...</h2>';
		this.maxCommits += this.config.loadMoreCommits;
		this.saveState();
		this.requestLoadRepoInfoAndCommits(false, true);
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
		let fontFamily = getVSCodeStyle(CSS_PROP_FONT_FAMILY), editorFontFamily = getVSCodeStyle(CSS_PROP_EDITOR_FONT_FAMILY), findMatchColour = getVSCodeStyle(CSS_PROP_FIND_MATCH_HIGHLIGHT_BACKGROUND);

		const setFlashColour = (colour: string) => {
			document.body.style.setProperty('--git-graph-flashPrimary', modifyColourOpacity(colour, 0.7));
			document.body.style.setProperty('--git-graph-flashSecondary', modifyColourOpacity(colour, 0.5));
		};

		this.findWidget.setColour(findMatchColour);
		setFlashColour(findMatchColour);
		(new MutationObserver(() => {
			let ff = getVSCodeStyle(CSS_PROP_FONT_FAMILY), eff = getVSCodeStyle(CSS_PROP_EDITOR_FONT_FAMILY), fmc = getVSCodeStyle(CSS_PROP_FIND_MATCH_HIGHLIGHT_BACKGROUND);
			if (ff !== fontFamily || eff !== editorFontFamily) {
				fontFamily = ff;
				editorFontFamily = eff;
				this.repoDropdown.refresh();
				this.branchDropdown.refresh();
			}
			if (fmc !== findMatchColour) {
				findMatchColour = fmc;
				this.findWidget.setColour(findMatchColour);
				setFlashColour(findMatchColour);
			}
		})).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
	}

	private observeViewScroll() {
		let active = this.viewElem.scrollTop > 0, timeout: NodeJS.Timer | null = null;
		this.scrollShadowElem.className = active ? CLASS_ACTIVE : '';
		this.viewElem.addEventListener('scroll', () => {
			const scrollTop = this.viewElem.scrollTop;
			if (active !== scrollTop > 0) {
				active = scrollTop > 0;
				this.scrollShadowElem.className = active ? CLASS_ACTIVE : '';
			}

			if (this.config.loadMoreCommitsAutomatically && this.moreCommitsAvailable && !this.currentRepoRefreshState.inProgress) {
				const viewHeight = this.viewElem.clientHeight, contentHeight = this.viewElem.scrollHeight;
				if (scrollTop > 0 && viewHeight > 0 && contentHeight > 0 && (scrollTop + viewHeight) >= contentHeight - 25) {
					// If the user has scrolled such that the bottom of the visible view is within 25px of the end of the content, load more commits.
					this.loadMoreCommits();
				}
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
		document.addEventListener('keydown', (e) => {
			if (dialog.isOpen()) {
				if (e.key === 'Escape') {
					dialog.close();
					handledEvent(e);
				} else if (e.keyCode ? e.keyCode === 13 : e.key === 'Enter') {
					// Use keyCode === 13 to detect 'Enter' events if available (for compatibility with IME Keyboards used by Chinese / Japanese / Korean users)
					dialog.submit();
					handledEvent(e);
				}
			} else if (contextMenu.isOpen()) {
				if (e.key === 'Escape') {
					contextMenu.close();
					handledEvent(e);
				}
			} else if (this.expandedCommit !== null && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
				let curHashIndex = this.commitLookup[this.expandedCommit.commitHash], newHashIndex = -1;

				if (e.ctrlKey || e.metaKey) {
					// Up / Down navigates according to the order of commits on the branch
					if (e.key === 'ArrowUp') {
						newHashIndex = this.graph.getFirstChildIndex(curHashIndex);
					} else if (e.key === 'ArrowDown') {
						newHashIndex = this.graph.getFirstParentIndex(curHashIndex);
					}
				} else {
					// Up / Down navigates according to the order of commits in the table
					if (e.key === 'ArrowUp' && curHashIndex > 0) {
						newHashIndex = curHashIndex - 1;
					} else if (e.key === 'ArrowDown' && curHashIndex < this.commits.length - 1) {
						newHashIndex = curHashIndex + 1;
					}
				}

				if (newHashIndex > -1) {
					handledEvent(e);
					const elem = findCommitElemWithId(getCommitElems(), newHashIndex);
					if (elem !== null) this.loadCommitDetails(elem);
				}
			} else if (e.ctrlKey || e.metaKey) {
				if (e.key === 'r') {
					this.refresh(true);
					handledEvent(e);
				} else if (e.key === 'f') {
					this.findWidget.show(true);
					handledEvent(e);
				} else if (e.key === 'h' && this.commitHead !== null) {
					this.scrollToCommit(this.commitHead, true, true);
					handledEvent(e);
				} else if (e.key.toLowerCase() === 's') {
					this.scrollToStash(!e.shiftKey);
					handledEvent(e);
				}
			} else if (e.key === 'Escape') {
				if (this.settingsWidget.isVisible()) {
					this.settingsWidget.close();
					handledEvent(e);
				} else if (this.findWidget.isVisible()) {
					this.findWidget.close();
					handledEvent(e);
				} else if (this.expandedCommit !== null) {
					this.closeCommitDetails(true);
					handledEvent(e);
				}
			}
		});
	}

	private observeInternalUrls() {
		document.body.addEventListener('click', (e: MouseEvent) => {
			if (e.target !== null && (<Element>e.target).className === 'internalUrl') {
				const value = unescapeHtml((<HTMLElement>e.target).dataset.value!);
				switch ((<HTMLElement>e.target).dataset.type!) {
					case 'commit':
						if (typeof this.commitLookup[value] === 'number' && (this.expandedCommit === null || this.expandedCommit.commitHash !== value || this.expandedCommit.compareWithHash !== null)) {
							const elem = findCommitElemWithId(getCommitElems(), this.commitLookup[value]);
							if (elem !== null) this.loadCommitDetails(elem);
						}
						break;
				}
			}
		});
	}

	private observeTableEvents() {

		// Register Click Event Handler
		this.tableElem.addEventListener('click', (e: MouseEvent) => {
			if (e.target === null) return;
			const eventTarget = <Element>e.target;
			let eventElem;

			if (eventTarget.className === 'externalUrl') {
				// An external URL was clicked, skip processing this event
				return;
			}

			if ((eventElem = <HTMLElement>eventTarget.closest('.gitRef')) !== null) {
				// .gitRef was clicked
				e.stopPropagation();
				if (contextMenu.isOpen()) {
					contextMenu.close();
				}

			} else if ((eventElem = <HTMLElement>eventTarget.closest('.commit')) !== null) {
				// .commit was clicked
				if (this.expandedCommit !== null) {
					const commit = this.getCommitOfElem(eventElem);
					if (commit === null) return;

					if (this.expandedCommit.commitHash === commit.hash) {
						this.closeCommitDetails(true);
					} else if ((<MouseEvent>e).ctrlKey || (<MouseEvent>e).metaKey) {
						if (this.expandedCommit.compareWithHash === commit.hash) {
							this.closeCommitComparison(true);
						} else if (this.expandedCommit.commitElem !== null) {
							this.loadCommitComparison(this.expandedCommit.commitElem, eventElem);
						}
					} else {
						this.loadCommitDetails(eventElem);
					}
				} else {
					this.loadCommitDetails(eventElem);
				}
			}
		});

		// Register Double Click Event Handler
		this.tableElem.addEventListener('dblclick', (e: MouseEvent) => {
			if (e.target === null) return;
			const eventTarget = <Element>e.target;
			let eventElem;

			if ((eventElem = <HTMLElement>eventTarget.closest('.gitRef')) !== null) {
				// .gitRef was double clicked
				e.stopPropagation();
				closeDialogAndContextMenu();
				const commitElem = <HTMLElement>eventElem.closest('.commit')!;
				const commit = this.getCommitOfElem(commitElem);
				if (commit === null) return;

				if (eventElem.classList.contains(CLASS_REF_HEAD) || eventElem.classList.contains(CLASS_REF_REMOTE)) {
					let sourceElem = <HTMLElement>eventElem.children[1];
					let refName = unescapeHtml(eventElem.dataset.name!), isHead = eventElem.classList.contains(CLASS_REF_HEAD), isRemoteCombinedWithHead = eventTarget.classList.contains('gitRefHeadRemote');
					if (isHead && isRemoteCombinedWithHead) {
						refName = unescapeHtml((<HTMLElement>eventTarget).dataset.fullref!);
						sourceElem = <HTMLElement>eventTarget;
						isHead = false;
					}

					const target: ContextMenuTarget & DialogTarget & RefTarget = {
						type: TargetType.Ref,
						hash: commit.hash,
						index: parseInt(commitElem.dataset.id!),
						ref: refName,
						elem: sourceElem
					};

					this.checkoutBranchAction(refName, isHead ? null : unescapeHtml((isRemoteCombinedWithHead ? <HTMLElement>eventTarget : eventElem).dataset.remote!), null, target);
				}
			}
		});

		// Register ContextMenu Event Handler
		this.tableElem.addEventListener('contextmenu', (e: Event) => {
			if (e.target === null) return;
			const eventTarget = <Element>e.target;
			let eventElem;

			if ((eventElem = <HTMLElement>eventTarget.closest('.gitRef')) !== null) {
				// .gitRef was right clicked
				handledEvent(e);
				const commitElem = <HTMLElement>eventElem.closest('.commit')!;
				const commit = this.getCommitOfElem(commitElem);
				if (commit === null) return;

				const target: ContextMenuTarget & DialogTarget & RefTarget = {
					type: TargetType.Ref,
					hash: commit.hash,
					index: parseInt(commitElem.dataset.id!),
					ref: unescapeHtml(eventElem.dataset.name!),
					elem: <HTMLElement>eventElem.children[1]
				};

				let actions: ContextMenuActions;
				if (eventElem.classList.contains(CLASS_REF_STASH)) {
					actions = this.getStashContextMenuActions(target);
				} else if (eventElem.classList.contains(CLASS_REF_TAG)) {
					actions = this.getTagContextMenuActions(eventElem.dataset.tagtype === 'annotated', target);
				} else {
					let isHead = eventElem.classList.contains(CLASS_REF_HEAD), isRemoteCombinedWithHead = eventTarget.classList.contains('gitRefHeadRemote');
					if (isHead && isRemoteCombinedWithHead) {
						target.ref = unescapeHtml((<HTMLElement>eventTarget).dataset.fullref!);
						target.elem = <HTMLElement>eventTarget;
						isHead = false;
					}
					if (isHead) {
						actions = this.getBranchContextMenuActions(target);
					} else {
						const remote = unescapeHtml((isRemoteCombinedWithHead ? <HTMLElement>eventTarget : eventElem).dataset.remote!);
						actions = this.getRemoteBranchContextMenuActions(remote, target);
					}
				}

				contextMenu.show(actions, false, target, <MouseEvent>e);

			} else if ((eventElem = <HTMLElement>eventTarget.closest('.commit')) !== null) {
				// .commit was right clicked
				handledEvent(e);
				const commit = this.getCommitOfElem(eventElem);
				if (commit === null) return;

				const target: ContextMenuTarget & DialogTarget & CommitTarget = {
					type: TargetType.Commit,
					hash: commit.hash,
					index: parseInt(eventElem.dataset.id!),
					elem: eventElem
				};

				let actions: ContextMenuActions;
				if (commit.hash === UNCOMMITTED) {
					actions = this.getUncommittedChangesContextMenuActions(target);
				} else if (commit.stash !== null) {
					target.ref = commit.stash.selector;
					actions = this.getStashContextMenuActions(<RefTarget>target);
				} else {
					actions = this.getCommitContextMenuActions(target);
				}

				contextMenu.show(actions, false, target, <MouseEvent>e);
			}
		});
	}


	/* Commit Details View */

	private loadCommitDetails(commitElem: HTMLElement) {
		const commit = this.getCommitOfElem(commitElem);
		if (commit === null) return;

		this.closeCommitDetails(false);
		this.saveExpandedCommitLoading(parseInt(commitElem.dataset.id!), commit.hash, commitElem, null, null);
		commitElem.classList.add(CLASS_COMMIT_DETAILS_OPEN);
		this.renderCommitDetailsView(false);
		this.requestCommitDetails(commit.hash, false);
	}

	public closeCommitDetails(saveAndRender: boolean) {
		if (this.expandedCommit !== null) {
			let elem = document.getElementById('cdv'), isDocked = this.isCdvDocked();
			if (elem !== null) elem.remove();
			if (isDocked) this.viewElem.style.bottom = '0px';
			if (this.expandedCommit.commitElem !== null) {
				this.expandedCommit.commitElem.classList.remove(CLASS_COMMIT_DETAILS_OPEN);
			}
			if (this.expandedCommit.compareWithElem !== null) {
				this.expandedCommit.compareWithElem.classList.remove(CLASS_COMMIT_DETAILS_OPEN);
			}
			this.expandedCommit = null;
			if (saveAndRender) {
				this.saveState();
				if (!isDocked) this.renderGraph();
			}
		}
	}

	public showCommitDetails(commitDetails: GG.GitCommitDetails, fileTree: FileTreeFolder, avatar: string | null, codeReview: GG.CodeReview | null, lastViewedFile: string | null, refresh: boolean) {
		if (this.expandedCommit === null || this.expandedCommit.commitElem === null || this.expandedCommit.commitHash !== commitDetails.hash || this.expandedCommit.compareWithHash !== null) return;
		if (!this.isCdvDocked()) {
			let elem = document.getElementById('cdv');
			if (elem !== null) elem.remove();
		}

		this.expandedCommit.commitDetails = commitDetails;
		if (haveFilesChanged(this.expandedCommit.fileChanges, commitDetails.fileChanges)) {
			this.expandedCommit.fileChanges = commitDetails.fileChanges;
			this.expandedCommit.fileTree = fileTree;
		}
		this.expandedCommit.avatar = avatar;
		this.expandedCommit.codeReview = codeReview;
		if (!refresh) this.expandedCommit.lastViewedFile = lastViewedFile;
		this.expandedCommit.commitElem.classList.add(CLASS_COMMIT_DETAILS_OPEN);
		this.expandedCommit.loading = false;
		this.saveState();

		this.renderCommitDetailsView(refresh);
	}

	public createFileTree(gitFiles: ReadonlyArray<GG.GitFileChange>, codeReview: GG.CodeReview | null) {
		let contents: FileTreeFolderContents = {}, i, j, path, absPath, cur: FileTreeFolder;
		let files: FileTreeFolder = { type: 'folder', name: '', folderPath: '', contents: contents, open: true, reviewed: true };

		for (i = 0; i < gitFiles.length; i++) {
			cur = files;
			path = gitFiles[i].newFilePath.split('/');
			absPath = this.currentRepo;
			for (j = 0; j < path.length; j++) {
				absPath += '/' + path[j];
				if (typeof this.gitRepos[absPath] !== 'undefined') {
					if (typeof cur.contents[path[j]] === 'undefined') {
						cur.contents[path[j]] = { type: 'repo', name: path[j], path: absPath };
					}
					break;
				} else if (j < path.length - 1) {
					if (typeof cur.contents[path[j]] === 'undefined') {
						contents = {};
						cur.contents[path[j]] = { type: 'folder', name: path[j], folderPath: absPath.substring(this.currentRepo.length + 1), contents: contents, open: true, reviewed: true };
					}
					cur = <FileTreeFolder>cur.contents[path[j]];
				} else if (path[j] !== '') {
					cur.contents[path[j]] = { type: 'file', name: path[j], index: i, reviewed: codeReview === null || !codeReview.remainingFiles.includes(gitFiles[i].newFilePath) };
				}
			}
		}
		if (codeReview !== null) calcFileTreeFoldersReviewed(files);
		return files;
	}


	/* Commit Comparison View */

	private loadCommitComparison(commitElem: HTMLElement, compareWithElem: HTMLElement) {
		const commit = this.getCommitOfElem(commitElem);
		const compareWithCommit = this.getCommitOfElem(compareWithElem);

		if (commit !== null && compareWithCommit !== null) {
			if (this.expandedCommit !== null) {
				if (this.expandedCommit.commitHash !== commit.hash) {
					this.closeCommitDetails(false);
				} else if (this.expandedCommit.compareWithHash !== compareWithCommit.hash) {
					this.closeCommitComparison(false);
				}
			}

			this.saveExpandedCommitLoading(parseInt(commitElem.dataset.id!), commit.hash, commitElem, compareWithCommit.hash, compareWithElem);
			commitElem.classList.add(CLASS_COMMIT_DETAILS_OPEN);
			compareWithElem.classList.add(CLASS_COMMIT_DETAILS_OPEN);
			this.renderCommitDetailsView(false);
			this.requestCommitComparison(commit.hash, compareWithCommit.hash, false);
		}
	}

	public closeCommitComparison(saveAndRequestCommitDetails: boolean) {
		const expandedCommit = this.expandedCommit;

		if (expandedCommit !== null && expandedCommit.compareWithHash !== null) {
			if (expandedCommit.compareWithElem !== null) {
				expandedCommit.compareWithElem.classList.remove(CLASS_COMMIT_DETAILS_OPEN);
			}
			if (saveAndRequestCommitDetails) {
				if (expandedCommit.commitElem !== null) {
					this.saveExpandedCommitLoading(expandedCommit.index, expandedCommit.commitHash, expandedCommit.commitElem, null, null);
					this.renderCommitDetailsView(false);
					this.requestCommitDetails(expandedCommit.commitHash, false);
				} else {
					this.closeCommitDetails(true);
				}
			}
		}
	}

	public showCommitComparison(commitHash: string, compareWithHash: string, fileChanges: ReadonlyArray<GG.GitFileChange>, fileTree: FileTreeFolder, codeReview: GG.CodeReview | null, lastViewedFile: string | null, refresh: boolean) {
		let expandedCommit = this.expandedCommit;
		if (expandedCommit === null || expandedCommit.commitElem === null || expandedCommit.compareWithElem === null || expandedCommit.commitHash !== commitHash || expandedCommit.compareWithHash !== compareWithHash) return;
		if (haveFilesChanged(expandedCommit.fileChanges, fileChanges)) {
			expandedCommit.fileChanges = fileChanges;
			expandedCommit.fileTree = fileTree;
		}
		expandedCommit.codeReview = codeReview;
		if (!refresh) expandedCommit.lastViewedFile = lastViewedFile;
		expandedCommit.commitElem.classList.add(CLASS_COMMIT_DETAILS_OPEN);
		expandedCommit.compareWithElem.classList.add(CLASS_COMMIT_DETAILS_OPEN);
		expandedCommit.loading = false;
		this.saveState();

		this.renderCommitDetailsView(refresh);
	}


	/* Render Commit Details / Comparison View */

	private renderCommitDetailsView(refresh: boolean) {
		const expandedCommit = this.expandedCommit;
		if (expandedCommit === null || expandedCommit.commitElem === null) return;

		let elem = document.getElementById('cdv'), html = '<div id="cdvContent">', isDocked = this.isCdvDocked();
		let commitOrder = this.getCommitOrder(expandedCommit.commitHash, expandedCommit.compareWithHash === null ? expandedCommit.commitHash : expandedCommit.compareWithHash);
		let codeReviewPossible = !expandedCommit.loading && commitOrder.to !== UNCOMMITTED;

		if (elem === null) {
			elem = document.createElement(isDocked ? 'div' : 'tr');
			elem.id = 'cdv';
			elem.className = isDocked ? 'docked' : 'inline';
			this.setCdvHeight(elem, isDocked);
			if (isDocked) {
				document.body.appendChild(elem);
			} else {
				insertAfter(elem, expandedCommit.commitElem);
			}
		}

		if (expandedCommit.loading) {
			html += '<div id="cdvLoading">' + SVG_ICONS.loading + ' Loading ' + (expandedCommit.compareWithHash === null ? expandedCommit.commitHash !== UNCOMMITTED ? 'Commit Details' : 'Uncommitted Changes' : 'Commit Comparison') + ' ...</div>';
		} else {
			html += '<div id="cdvSummary">';
			if (expandedCommit.compareWithHash === null) {
				// Commit details should be shown
				if (expandedCommit.commitHash !== UNCOMMITTED) {
					const textFormatter = new TextFormatter(this.gitRepos[this.currentRepo].issueLinkingConfig, true, true);
					const commitDetails = expandedCommit.commitDetails!;
					const parents = commitDetails.parents.length > 0
						? commitDetails.parents.map((parent) => {
							const escapedParent = escapeHtml(parent);
							return typeof this.commitLookup[parent] === 'number'
								? '<span class="internalUrl" data-type="commit" data-value="' + escapedParent + '" tabindex="-1">' + escapedParent + '</span>'
								: escapedParent;
						}).join(', ')
						: 'None';
					html += '<span class="cdvSummaryTop' + (expandedCommit.avatar !== null ? ' withAvatar' : '') + '"><span class="cdvSummaryTopRow"><span class="cdvSummaryKeyValues">'
						+ '<b>Commit: </b>' + escapeHtml(commitDetails.hash) + '<br>'
						+ '<b>Parents: </b>' + parents + '<br>'
						+ '<b>Author: </b>' + escapeHtml(commitDetails.author) + (commitDetails.authorEmail !== '' ? ' &lt;<a href="mailto:' + escapeHtml(commitDetails.authorEmail) + '" tabindex="-1">' + escapeHtml(commitDetails.authorEmail) + '</a>&gt;' : '') + '<br>'
						+ (commitDetails.authorDate !== commitDetails.committerDate ? '<b>Author Date: </b>' + formatLongDate(commitDetails.authorDate) + '<br>' : '')
						+ '<b>Committer: </b>' + escapeHtml(commitDetails.committer) + (commitDetails.committerEmail !== '' ? ' &lt;<a href="mailto:' + escapeHtml(commitDetails.committerEmail) + '" tabindex="-1">' + escapeHtml(commitDetails.committerEmail) + '</a>&gt;' : '') + (commitDetails.signature !== null ? generateSignatureHtml(commitDetails.signature) : '') + '<br>'
						+ '<b>' + (commitDetails.authorDate !== commitDetails.committerDate ? 'Committer ' : '') + 'Date: </b>' + formatLongDate(commitDetails.committerDate)
						+ '</span>'
						+ (expandedCommit.avatar !== null ? '<span class="cdvSummaryAvatar"><img src="' + expandedCommit.avatar + '"></span>' : '')
						+ '</span></span><br><br>' + textFormatter.format(commitDetails.body);
				} else {
					html += 'Displaying all uncommitted changes.';
				}
			} else {
				// Commit comparison should be shown
				html += 'Displaying all changes from <b>' + commitOrder.from + '</b> to <b>' + (commitOrder.to !== UNCOMMITTED ? commitOrder.to : 'Uncommitted Changes') + '</b>.';
			}
			html += '</div><div id="cdvFiles">' + generateFileViewHtml(expandedCommit.fileTree!, expandedCommit.fileChanges!, expandedCommit.lastViewedFile, this.getFileViewType(), commitOrder.to === UNCOMMITTED) + '</div><div id="cdvDivider"></div>';
		}
		html += '</div><div id="cdvControls"><div id="cdvClose" class="cdvControlBtn" title="Close">' + SVG_ICONS.close + '</div>' +
			(codeReviewPossible ? '<div id="cdvCodeReview" class="cdvControlBtn">' + SVG_ICONS.review + '</div>' : '') +
			(!expandedCommit.loading ? '<div id="cdvFileViewTypeTree" class="cdvControlBtn cdvFileViewTypeBtn" title="File Tree View">' + SVG_ICONS.fileTree + '</div><div id="cdvFileViewTypeList" class="cdvControlBtn cdvFileViewTypeBtn" title="File List View">' + SVG_ICONS.fileList + '</div>' : '') +
			'</div><div class="cdvHeightResize"></div>';

		elem.innerHTML = isDocked ? html : '<td><div class="cdvHeightResize"></div></td><td colspan="' + (this.getNumColumns() - 1) + '">' + html + '</td>';
		if (!expandedCommit.loading) this.setCdvDivider();
		if (!isDocked) this.renderGraph();

		if (!refresh) {
			if (isDocked) {
				let elemTop = this.controlsElem.clientHeight + expandedCommit.commitElem.offsetTop;
				if (elemTop - 8 < this.viewElem.scrollTop) {
					// Commit is above what is visible on screen
					this.viewElem.scroll(0, elemTop - 8);
				} else if (elemTop - this.viewElem.clientHeight + 32 > this.viewElem.scrollTop) {
					// Commit is below what is visible on screen
					this.viewElem.scroll(0, elemTop - this.viewElem.clientHeight + 32);
				}
			} else {
				let elemTop = this.controlsElem.clientHeight + elem.offsetTop, cdvHeight = this.gitRepos[this.currentRepo].cdvHeight;
				if (this.config.autoCenterCommitDetailsView) {
					// Center Commit Detail View setting is enabled
					// elemTop - commit height [24px] + (commit details view height + commit height [24px]) / 2 - (view height) / 2
					this.viewElem.scroll(0, elemTop - 12 + (cdvHeight - this.viewElem.clientHeight) / 2);
				} else if (elemTop - 32 < this.viewElem.scrollTop) {
					// Commit Detail View is opening above what is visible on screen
					// elemTop - commit height [24px] - desired gap from top [8px] < view scroll offset
					this.viewElem.scroll(0, elemTop - 32);
				} else if (elemTop + cdvHeight - this.viewElem.clientHeight + 8 > this.viewElem.scrollTop) {
					// Commit Detail View is opening below what is visible on screen
					// elemTop + commit details view height + desired gap from bottom [8px] - view height > view scroll offset
					this.viewElem.scroll(0, elemTop + cdvHeight - this.viewElem.clientHeight + 8);
				}
			}
		}

		this.makeCdvResizable();
		document.getElementById('cdvClose')!.addEventListener('click', () => {
			this.closeCommitDetails(true);
		});

		if (!expandedCommit.loading) {
			this.makeCdvFileViewInteractive();
			this.renderCdvFileViewTypeBtns();
			this.makeCdvDividerDraggable();

			let filesElem = document.getElementById('cdvFiles')!, timeout: NodeJS.Timer | null = null;
			filesElem.scroll(0, expandedCommit.fileChangesScrollTop);
			filesElem.addEventListener('scroll', () => {
				let filesElem = document.getElementById('cdvFiles')!;
				if (filesElem === null) return;
				expandedCommit.fileChangesScrollTop = filesElem.scrollTop;
				if (timeout !== null) clearTimeout(timeout);
				timeout = setTimeout(() => {
					this.saveState();
					timeout = null;
				}, 250);
			});

			document.getElementById('cdvFileViewTypeTree')!.addEventListener('click', () => {
				this.changeFileViewType(GG.FileViewType.Tree);
			});

			document.getElementById('cdvFileViewTypeList')!.addEventListener('click', () => {
				this.changeFileViewType(GG.FileViewType.List);
			});

			if (codeReviewPossible) {
				this.renderCodeReviewBtn();
				document.getElementById('cdvCodeReview')!.addEventListener('click', (e) => {
					let expandedCommit = this.expandedCommit;
					if (expandedCommit === null || e.target === null) return;
					let sourceElem = <HTMLElement>(<Element>e.target).closest('#cdvCodeReview')!;
					if (sourceElem.classList.contains(CLASS_ACTIVE)) {
						sendMessage({ command: 'endCodeReview', repo: this.currentRepo, id: expandedCommit.codeReview!.id });
						this.endCodeReview();
					} else {
						let commitOrder = this.getCommitOrder(expandedCommit.commitHash, expandedCommit.compareWithHash === null ? expandedCommit.commitHash : expandedCommit.compareWithHash);
						let id = expandedCommit.compareWithHash !== null ? commitOrder.from + '-' + commitOrder.to : expandedCommit.commitHash;
						sendMessage({
							command: 'startCodeReview',
							repo: this.currentRepo,
							id: id,
							commitHash: expandedCommit.commitHash,
							compareWithHash: expandedCommit.compareWithHash,
							files: getFilesInTree(expandedCommit.fileTree!, expandedCommit.fileChanges!),
							lastViewedFile: expandedCommit.lastViewedFile
						});
					}
				});
			}
		}
	}

	private setCdvHeight(elem: HTMLElement, isDocked: boolean) {
		let height = this.gitRepos[this.currentRepo].cdvHeight, windowHeight = window.innerHeight;
		if (height > windowHeight - 40) {
			height = Math.max(windowHeight - 40, 100);
			if (height !== this.gitRepos[this.currentRepo].cdvHeight) {
				this.gitRepos[this.currentRepo].cdvHeight = height;
				this.saveRepoState();
			}
		}

		let heightPx = height + 'px';
		elem.style.height = heightPx;
		if (isDocked) this.viewElem.style.bottom = heightPx;
	}

	private setCdvDivider() {
		let percent = (this.gitRepos[this.currentRepo].cdvDivider * 100).toFixed(2) + '%';
		let summaryElem = document.getElementById('cdvSummary'), dividerElem = document.getElementById('cdvDivider'), filesElem = document.getElementById('cdvFiles');
		if (summaryElem !== null) summaryElem.style.width = percent;
		if (dividerElem !== null) dividerElem.style.left = percent;
		if (filesElem !== null) filesElem.style.left = percent;
	}

	private makeCdvResizable() {
		let prevY = -1;

		const processResizingCdvHeight: EventListener = (e) => {
			if (prevY < 0) return;
			let delta = (<MouseEvent>e).pageY - prevY, isDocked = this.isCdvDocked(), windowHeight = window.innerHeight;
			prevY = (<MouseEvent>e).pageY;
			let height = this.gitRepos[this.currentRepo].cdvHeight + (isDocked ? -delta : delta);
			if (height < 100) height = 100;
			else if (height > 600) height = 600;
			if (height > windowHeight - 40) height = Math.max(windowHeight - 40, 100);

			if (this.gitRepos[this.currentRepo].cdvHeight !== height) {
				this.gitRepos[this.currentRepo].cdvHeight = height;
				let elem = document.getElementById('cdv');
				if (elem !== null) this.setCdvHeight(elem, isDocked);
				if (!isDocked) this.renderGraph();
			}
		};
		const stopResizingCdvHeight: EventListener = (e) => {
			if (prevY < 0) return;
			processResizingCdvHeight(e);
			this.saveRepoState();
			prevY = -1;
			eventOverlay.remove();
		};

		addListenerToClass('cdvHeightResize', 'mousedown', (e) => {
			prevY = (<MouseEvent>e).pageY;
			eventOverlay.create('rowResize', processResizingCdvHeight, stopResizingCdvHeight);
		});
	}

	private makeCdvDividerDraggable() {
		let minX = -1, width = -1;

		const processDraggingCdvDivider: EventListener = (e) => {
			if (minX < 0) return;
			let percent = ((<MouseEvent>e).clientX - minX) / width;
			if (percent < 0.2) percent = 0.2;
			else if (percent > 0.8) percent = 0.8;

			if (this.gitRepos[this.currentRepo].cdvDivider !== percent) {
				this.gitRepos[this.currentRepo].cdvDivider = percent;
				this.setCdvDivider();
			}
		};
		const stopDraggingCdvDivider: EventListener = (e) => {
			if (minX < 0) return;
			processDraggingCdvDivider(e);
			this.saveRepoState();
			minX = -1;
			eventOverlay.remove();
		};

		document.getElementById('cdvDivider')!.addEventListener('mousedown', () => {
			let contentElem = document.getElementById('cdvContent')!;
			if (contentElem === null) return;

			let bounds = contentElem.getBoundingClientRect();
			minX = bounds.left;
			width = bounds.width;
			eventOverlay.create('colResize', processDraggingCdvDivider, stopDraggingCdvDivider);
		});
	}

	private cdvFileViewed(filePath: string, sourceElem: HTMLElement) {
		let expandedCommit = this.expandedCommit, filesElem = document.getElementById('cdvFiles'), fileElem = <HTMLElement>sourceElem.closest('.fileTreeFileRecord')!;
		if (expandedCommit === null || expandedCommit.fileTree === null || filesElem === null) return;

		expandedCommit.lastViewedFile = filePath;
		let lastViewedElem = document.getElementById('cdvLastFileViewed');
		if (lastViewedElem !== null) lastViewedElem.remove();
		lastViewedElem = document.createElement('span');
		lastViewedElem.id = 'cdvLastFileViewed';
		lastViewedElem.title = 'Last File Viewed';
		lastViewedElem.innerHTML = SVG_ICONS.eyeOpen;
		insertBeforeFirstChildWithClass(lastViewedElem, fileElem, 'fileTreeFileAction');

		if (expandedCommit.codeReview !== null) {
			let i = expandedCommit.codeReview.remainingFiles.indexOf(filePath);
			if (i > -1) {
				sendMessage({ command: 'codeReviewFileReviewed', repo: this.currentRepo, id: expandedCommit.codeReview.id, filePath: filePath });
				alterFileTreeFileReviewed(expandedCommit.fileTree, filePath);
				updateFileTreeHtmlFileReviewed(filesElem, expandedCommit.fileTree, filePath);
				expandedCommit.codeReview.remainingFiles.splice(i, 1);
				if (expandedCommit.codeReview.remainingFiles.length === 0) {
					expandedCommit.codeReview = null;
					this.renderCodeReviewBtn();
				}
			}
		}
		this.saveState();
	}

	private isCdvDocked() {
		return this.config.commitDetailsViewLocation === GG.CommitDetailsViewLocation.DockedToBottom;
	}

	private getCommitOrder(hash1: string, hash2: string) {
		if (this.commitLookup[hash1] > this.commitLookup[hash2]) {
			return { from: hash1, to: hash2 };
		} else {
			return { from: hash2, to: hash1 };
		}
	}

	private getFileViewType() {
		return this.gitRepos[this.currentRepo].fileViewType === GG.FileViewType.Default
			? this.config.defaultFileViewType
			: this.gitRepos[this.currentRepo].fileViewType;
	}

	private setFileViewType(type: GG.FileViewType) {
		this.gitRepos[this.currentRepo].fileViewType = type;
		this.saveRepoState();
	}

	private changeFileViewType(type: GG.FileViewType) {
		let expandedCommit = this.expandedCommit;
		if (expandedCommit === null || expandedCommit.fileTree === null || expandedCommit.fileChanges === null) return;
		this.setFileViewType(type);
		let commitOrder = this.getCommitOrder(expandedCommit.commitHash, expandedCommit.compareWithHash === null ? expandedCommit.commitHash : expandedCommit.compareWithHash);
		document.getElementById('cdvFiles')!.innerHTML = generateFileViewHtml(expandedCommit.fileTree, expandedCommit.fileChanges, expandedCommit.lastViewedFile, type, commitOrder.to === UNCOMMITTED);
		this.makeCdvFileViewInteractive();
		this.renderCdvFileViewTypeBtns();
	}

	private makeCdvFileViewInteractive() {
		addListenerToClass('fileTreeFolder', 'click', (e) => {
			let expandedCommit = this.expandedCommit;
			if (expandedCommit === null || expandedCommit.fileTree === null || e.target === null) return;

			let sourceElem = <HTMLElement>(<Element>e.target).closest('.fileTreeFolder');
			let parent = sourceElem.parentElement!;
			parent.classList.toggle('closed');
			let isOpen = !parent.classList.contains('closed');
			parent.children[0].children[0].innerHTML = isOpen ? SVG_ICONS.openFolder : SVG_ICONS.closedFolder;
			parent.children[1].classList.toggle('hidden');
			alterFileTreeFolderOpen(expandedCommit.fileTree, decodeURIComponent(sourceElem.dataset.folderpath!), isOpen);
			this.saveState();
		});

		addListenerToClass('fileTreeFile', 'click', (e) => {
			let expandedCommit = this.expandedCommit;
			if (expandedCommit === null || e.target === null) return;

			let sourceElem = <HTMLElement>(<Element>e.target).closest('.fileTreeFile')!;
			if (!sourceElem.classList.contains('gitDiffPossible')) return;
			let commit = this.commits[this.commitLookup[expandedCommit.commitHash]], fromHash: string, toHash: string;
			let fileStatus = <GG.GitFileStatus>sourceElem.dataset.type;
			if (expandedCommit.compareWithHash !== null) {
				// Commit Comparison
				let commitOrder = this.getCommitOrder(expandedCommit.commitHash, expandedCommit.compareWithHash);
				fromHash = commitOrder.from;
				toHash = commitOrder.to;
			} else if (commit.stash !== null) {
				// Stash Commit
				if (fileStatus === GG.GitFileStatus.Untracked) {
					fromHash = commit.stash.untrackedFilesHash!;
					toHash = commit.stash.untrackedFilesHash!;
					fileStatus = GG.GitFileStatus.Added;
				} else {
					fromHash = commit.stash.baseHash;
					toHash = expandedCommit.commitHash;
				}
			} else {
				// Single Commit
				fromHash = expandedCommit.commitHash;
				toHash = expandedCommit.commitHash;
			}

			let newFilePath = decodeURIComponent(sourceElem.dataset.newfilepath!);

			this.cdvFileViewed(newFilePath, sourceElem);
			sendMessage({
				command: 'viewDiff',
				repo: this.currentRepo,
				fromHash: fromHash,
				toHash: toHash,
				oldFilePath: decodeURIComponent(sourceElem.dataset.oldfilepath!),
				newFilePath: newFilePath,
				type: fileStatus
			});
		});

		addListenerToClass('fileTreeRepo', 'click', (e) => {
			if (e.target === null) return;
			this.loadRepos(this.gitRepos, null, {
				repo: decodeURIComponent((<HTMLElement>(<Element>e.target).closest('.fileTreeRepo')).dataset.path!),
				commitDetails: null
			});
		});

		addListenerToClass('copyGitFile', 'click', (e) => {
			if (e.target === null) return;
			let sourceElem = <HTMLElement>(<Element>e.target).closest('.copyGitFile')!;
			sendMessage({ command: 'copyFilePath', repo: this.currentRepo, filePath: decodeURIComponent(sourceElem.dataset.filepath!) });
		});

		addListenerToClass('viewGitFileAtRevision', 'click', (e) => {
			let expandedCommit = this.expandedCommit;
			if (expandedCommit === null || e.target === null) return;

			let sourceElem = <HTMLElement>(<Element>e.target).closest('.viewGitFileAtRevision')!;
			let filePath = decodeURIComponent(sourceElem.dataset.filepath!);
			let commit = this.commits[this.commitLookup[expandedCommit.commitHash]], hash: string;
			let fileStatus = <GG.GitFileStatus>sourceElem.dataset.type;
			if (expandedCommit.compareWithHash !== null) {
				hash = this.getCommitOrder(expandedCommit.commitHash, expandedCommit.compareWithHash).to;
			} else if (commit.stash !== null && fileStatus === GG.GitFileStatus.Untracked) {
				hash = commit.stash.untrackedFilesHash!;
			} else {
				hash = expandedCommit.commitHash;
			}

			this.cdvFileViewed(filePath, sourceElem);
			sendMessage({ command: 'viewFileAtRevision', repo: this.currentRepo, hash: hash, filePath: filePath });
		});

		addListenerToClass('openGitFile', 'click', (e) => {
			let expandedCommit = this.expandedCommit;
			if (expandedCommit === null || e.target === null) return;

			let sourceElem = <HTMLElement>(<Element>e.target).closest('.openGitFile')!;
			let filePath = decodeURIComponent(sourceElem.dataset.filepath!);

			this.cdvFileViewed(filePath, sourceElem);
			sendMessage({ command: 'openFile', repo: this.currentRepo, filePath: filePath });
		});
	}

	private renderCdvFileViewTypeBtns() {
		if (this.expandedCommit === null) return;
		let treeBtnElem = document.getElementById('cdvFileViewTypeTree'), listBtnElem = document.getElementById('cdvFileViewTypeList');
		if (treeBtnElem === null || listBtnElem === null) return;

		let listView = this.getFileViewType() === GG.FileViewType.List;
		alterClass(treeBtnElem, CLASS_ACTIVE, !listView);
		alterClass(listBtnElem, CLASS_ACTIVE, listView);
	}


	/* Code Review */

	public startCodeReview(commitHash: string, compareWithHash: string | null, codeReview: GG.CodeReview) {
		if (this.expandedCommit === null || this.expandedCommit.commitHash !== commitHash || this.expandedCommit.compareWithHash !== compareWithHash) return;
		this.saveAndRenderCodeReview(codeReview);
	}

	public endCodeReview() {
		if (this.expandedCommit === null || this.expandedCommit.codeReview === null) return;
		this.saveAndRenderCodeReview(null);
	}

	private saveAndRenderCodeReview(codeReview: GG.CodeReview | null) {
		let filesElem = document.getElementById('cdvFiles');
		if (this.expandedCommit === null || this.expandedCommit.fileTree === null || filesElem === null) return;

		this.expandedCommit.codeReview = codeReview;
		setFileTreeReviewed(this.expandedCommit.fileTree, codeReview === null);
		this.saveState();
		this.renderCodeReviewBtn();
		updateFileTreeHtml(filesElem, this.expandedCommit.fileTree);
	}

	private renderCodeReviewBtn() {
		if (this.expandedCommit === null) return;
		let btnElem = document.getElementById('cdvCodeReview');
		if (btnElem === null) return;

		let active = this.expandedCommit.codeReview !== null;
		alterClass(btnElem, CLASS_ACTIVE, active);
		btnElem.title = (active ? 'End' : 'Start') + ' Code Review';
	}
}


/* Main */

const contextMenu = new ContextMenu(), dialog = new Dialog(), eventOverlay = new EventOverlay();
let loaded = false;

window.addEventListener('load', () => {
	if (loaded) return;
	loaded = true;

	registerCustomEmojiMappings(initialState.config.customEmojiShortcodeMappings);

	let viewElem = document.getElementById('view');
	if (viewElem === null) return;

	const gitGraph = new GitGraphView(viewElem, VSCODE_API.getState());
	const settingsWidget = gitGraph.getSettingsWidget();
	const imageResizer = new ImageResizer();

	/* Command Processing */
	window.addEventListener('message', event => {
		const msg: GG.ResponseMessage = event.data;
		switch (msg.command) {
			case 'addRemote':
				refreshOrDisplayError(msg.error, 'Unable to Add Remote');
				if (settingsWidget.isVisible()) settingsWidget.refresh();
				break;
			case 'addTag':
				refreshAndDisplayErrors(msg.errors, 'Unable to Add Tag');
				break;
			case 'applyStash':
				refreshOrDisplayError(msg.error, 'Unable to Apply Stash');
				break;
			case 'branchFromStash':
				refreshOrDisplayError(msg.error, 'Unable to Create Branch from Stash');
				break;
			case 'checkoutBranch':
				refreshAndDisplayErrors(msg.errors, 'Unable to Checkout Branch' + (msg.pullAfterwards !== null ? ' & Pull Changes' : ''));
				break;
			case 'checkoutCommit':
				refreshOrDisplayError(msg.error, 'Unable to Checkout Commit');
				break;
			case 'cherrypickCommit':
				refreshAndDisplayErrors(msg.errors, 'Unable to Cherry Pick Commit');
				break;
			case 'cleanUntrackedFiles':
				refreshOrDisplayError(msg.error, 'Unable to Clean Untracked Files');
				break;
			case 'commitDetails':
				if (msg.commitDetails !== null) {
					gitGraph.showCommitDetails(msg.commitDetails, gitGraph.createFileTree(msg.commitDetails.fileChanges, msg.codeReview), msg.avatar, msg.codeReview, msg.codeReview !== null ? msg.codeReview.lastViewedFile : null, msg.refresh);
				} else {
					gitGraph.closeCommitDetails(true);
					dialog.showError('Unable to load Commit Details', msg.error, null, null);
				}
				break;
			case 'compareCommits':
				if (msg.error === null) {
					gitGraph.showCommitComparison(msg.commitHash, msg.compareWithHash, msg.fileChanges, gitGraph.createFileTree(msg.fileChanges, msg.codeReview), msg.codeReview, msg.codeReview !== null ? msg.codeReview.lastViewedFile : null, msg.refresh);
				} else {
					gitGraph.closeCommitComparison(true);
					dialog.showError('Unable to load Commit Comparison', msg.error, null, null);
				}
				break;
			case 'copyFilePath':
				finishOrDisplayError(msg.error, 'Unable to Copy File Path to the Clipboard');
				break;
			case 'copyToClipboard':
				finishOrDisplayError(msg.error, 'Unable to Copy ' + msg.type + ' to Clipboard');
				break;
			case 'createArchive':
				finishOrDisplayError(msg.error, 'Unable to Create Archive', true);
				break;
			case 'createBranch':
				refreshOrDisplayError(msg.error, 'Unable to Create Branch');
				break;
			case 'createPullRequest':
				finishOrDisplayErrors(msg.errors, 'Unable to Create Pull Request', () => {
					if (msg.push) {
						gitGraph.refresh(false);
					}
				}, true);
				break;
			case 'deleteBranch':
				refreshAndDisplayErrors(msg.errors, 'Unable to Delete Branch');
				break;
			case 'deleteRemote':
				refreshOrDisplayError(msg.error, 'Unable to Delete Remote');
				if (settingsWidget.isVisible()) settingsWidget.refresh();
				break;
			case 'deleteRemoteBranch':
				refreshOrDisplayError(msg.error, 'Unable to Delete Remote Branch');
				break;
			case 'deleteTag':
				refreshOrDisplayError(msg.error, 'Unable to Delete Tag');
				break;
			case 'deleteUserDetails':
				finishOrDisplayErrors(msg.errors, 'Unable to Remove Git User Details', () => {
					if (settingsWidget.isVisible()) {
						settingsWidget.refresh();
					}
				}, true);
				break;
			case 'dropCommit':
				refreshOrDisplayError(msg.error, 'Unable to Drop Commit');
				break;
			case 'dropStash':
				refreshOrDisplayError(msg.error, 'Unable to Drop Stash');
				break;
			case 'editRemote':
				refreshOrDisplayError(msg.error, 'Unable to Save Changes to Remote');
				if (settingsWidget.isVisible()) settingsWidget.refresh();
				break;
			case 'editUserDetails':
				finishOrDisplayErrors(msg.errors, 'Unable to Save Git User Details', () => {
					if (settingsWidget.isVisible()) {
						settingsWidget.refresh();
					}
				}, true);
				break;
			case 'fetch':
				refreshOrDisplayError(msg.error, 'Unable to Fetch from Remote(s)');
				break;
			case 'fetchAvatar':
				imageResizer.resize(msg.image, (resizedImage) => {
					gitGraph.loadAvatar(msg.email, resizedImage);
				});
				break;
			case 'fetchIntoLocalBranch':
				refreshOrDisplayError(msg.error, 'Unable to Fetch into Local Branch');
				break;
			case 'getSettings':
				settingsWidget.loadSettings(msg.settings, msg.error);
				break;
			case 'loadCommits':
				gitGraph.processLoadCommitsResponse(msg);
				break;
			case 'loadRepoInfo':
				gitGraph.processLoadRepoInfoResponse(msg);
				break;
			case 'loadRepos':
				gitGraph.loadRepos(msg.repos, msg.lastActiveRepo, msg.loadViewTo);
				break;
			case 'merge':
				refreshOrDisplayError(msg.error, 'Unable to Merge ' + msg.actionOn);
				break;
			case 'openExtensionSettings':
				finishOrDisplayError(msg.error, 'Unable to Open Extension Settings');
				break;
			case 'openFile':
				finishOrDisplayError(msg.error, 'Unable to Open File');
				break;
			case 'popStash':
				refreshOrDisplayError(msg.error, 'Unable to Pop Stash');
				break;
			case 'pruneRemote':
				refreshOrDisplayError(msg.error, 'Unable to Prune Remote');
				break;
			case 'pullBranch':
				refreshOrDisplayError(msg.error, 'Unable to Pull Branch');
				break;
			case 'pushBranch':
				refreshOrDisplayError(msg.error, 'Unable to Push Branch');
				break;
			case 'pushStash':
				refreshOrDisplayError(msg.error, 'Unable to Stash Uncommitted Changes');
				break;
			case 'pushTag':
				refreshOrDisplayError(msg.error, 'Unable to Push Tag');
				break;
			case 'rebase':
				if (msg.error === null) {
					if (msg.interactive) {
						dialog.closeActionRunning();
					} else {
						gitGraph.refresh(false);
					}
				} else {
					dialog.showError('Unable to Rebase current branch on ' + msg.actionOn, msg.error, null, null);
				}
				break;
			case 'refresh':
				gitGraph.refresh(false);
				break;
			case 'renameBranch':
				refreshOrDisplayError(msg.error, 'Unable to Rename Branch');
				break;
			case 'resetToCommit':
				refreshOrDisplayError(msg.error, 'Unable to Reset to Commit');
				break;
			case 'revertCommit':
				refreshOrDisplayError(msg.error, 'Unable to Revert Commit');
				break;
			case 'setGlobalViewState':
				finishOrDisplayError(msg.error, 'Unable to save the Global View State');
				break;
			case 'startCodeReview':
				if (msg.error === null) {
					gitGraph.startCodeReview(msg.commitHash, msg.compareWithHash, msg.codeReview);
				} else {
					dialog.showError('Unable to Start Code Review', msg.error, null, null);
				}
				break;
			case 'tagDetails':
				if (msg.error === null) {
					gitGraph.renderTagDetails(msg.tagName, msg.tagHash, msg.commitHash, msg.name, msg.email, msg.date, msg.message);
				} else {
					dialog.showError('Unable to retrieve Tag Details', msg.error, null, null);
				}
				break;
			case 'viewDiff':
				finishOrDisplayError(msg.error, 'Unable to View Diff of File');
				break;
			case 'viewFileAtRevision':
				finishOrDisplayError(msg.error, 'Unable to View File at Revision');
				break;
			case 'viewScm':
				finishOrDisplayError(msg.error, 'Unable to open the Source Control View');
				break;
		}
	});

	function refreshOrDisplayError(error: GG.ErrorInfo, errorMessage: string) {
		if (error === null) {
			gitGraph.refresh(false);
		} else {
			dialog.showError(errorMessage, error, null, null);
		}
	}

	function refreshAndDisplayErrors(errors: GG.ErrorInfo[], errorMessage: string) {
		const reducedErrors = reduceErrorInfos(errors);
		if (reducedErrors.error !== null) {
			dialog.showError(errorMessage, reducedErrors.error, null, null);
		}
		if (reducedErrors.partialOrCompleteSuccess) {
			gitGraph.refresh(false);
		}
	}

	function finishOrDisplayError(error: GG.ErrorInfo, errorMessage: string, dismissActionRunning: boolean = false) {
		if (error !== null) {
			dialog.showError(errorMessage, error, null, null);
		} else if (dismissActionRunning) {
			dialog.closeActionRunning();
		}
	}

	function finishOrDisplayErrors(errors: GG.ErrorInfo[], errorMessage: string, partialOrCompleteSuccessCallback: () => void, dismissActionRunning: boolean = false) {
		const reducedErrors = reduceErrorInfos(errors);
		finishOrDisplayError(reducedErrors.error, errorMessage, dismissActionRunning);
		if (reducedErrors.partialOrCompleteSuccess) {
			partialOrCompleteSuccessCallback();
		}
	}

	function reduceErrorInfos(errors: GG.ErrorInfo[]) {
		let error: GG.ErrorInfo = null, partialOrCompleteSuccess = false;
		for (let i = 0; i < errors.length; i++) {
			if (errors[i] !== null) {
				error = error !== null ? error + '\n\n' + errors[i] : errors[i];
			} else {
				partialOrCompleteSuccess = true;
			}
		}

		return {
			error: error,
			partialOrCompleteSuccess: partialOrCompleteSuccess
		};
	}
});


/* File Tree Methods (for the Commit Details & Comparison Views) */

function generateFileViewHtml(folder: FileTreeFolder, gitFiles: ReadonlyArray<GG.GitFileChange>, lastViewedFile: string | null, type: GG.FileViewType, isUncommitted: boolean) {
	return type === GG.FileViewType.List
		? generateFileListHtml(folder, gitFiles, lastViewedFile, isUncommitted)
		: generateFileTreeHtml(folder, gitFiles, lastViewedFile, isUncommitted);
}

function generateFileTreeHtml(folder: FileTreeFolder, gitFiles: ReadonlyArray<GG.GitFileChange>, lastViewedFile: string | null, isUncommitted: boolean) {
	let html = (folder.name !== '' ? '<span class="fileTreeFolder' + (folder.reviewed ? '' : ' pendingReview') + '" data-folderpath="' + encodeURIComponent(folder.folderPath) + '"><span class="fileTreeFolderIcon">' + (folder.open ? SVG_ICONS.openFolder : SVG_ICONS.closedFolder) + '</span><span class="gitFolderName">' + escapeHtml(folder.name) + '</span></span>' : '') + '<ul class="fileTreeFolderContents' + (!folder.open ? ' hidden' : '') + '">';
	let keys = sortFolderKeys(folder);
	for (let i = 0; i < keys.length; i++) {
		let cur = folder.contents[keys[i]];
		if (cur.type === 'folder') {
			html += '<li' + (cur.open ? '' : ' class="closed"') + ' data-pathseg="' + encodeURIComponent(cur.name) + '">' + generateFileTreeHtml(cur, gitFiles, lastViewedFile, isUncommitted) + '</li>';
		} else {
			html += generateFileTreeLeafHtml(cur.name, cur, gitFiles, lastViewedFile, isUncommitted);
		}
	}
	return html + '</ul>';
}

function generateFileListHtml(folder: FileTreeFolder, gitFiles: ReadonlyArray<GG.GitFileChange>, lastViewedFile: string | null, isUncommitted: boolean) {
	const sortLeaves = (folder: FileTreeFolder, folderPath: string) => {
		let keys = sortFolderKeys(folder);
		let items: { relPath: string, leaf: FileTreeLeaf }[] = [];
		for (let i = 0; i < keys.length; i++) {
			let cur = folder.contents[keys[i]];
			let relPath = (folderPath !== '' ? folderPath + '/' : '') + cur.name;
			if (cur.type === 'folder') {
				items = items.concat(sortLeaves(cur, relPath));
			} else {
				items.push({ relPath: relPath, leaf: cur });
			}
		}
		return items;
	};
	let sortedLeaves = sortLeaves(folder, '');
	let html = '';
	for (let i = 0; i < sortedLeaves.length; i++) {
		html += generateFileTreeLeafHtml(sortedLeaves[i].relPath, sortedLeaves[i].leaf, gitFiles, lastViewedFile, isUncommitted);
	}
	return '<ul class="fileTreeFolderContents">' + html + '</ul>';
}

function generateFileTreeLeafHtml(name: string, leaf: FileTreeLeaf, gitFiles: ReadonlyArray<GG.GitFileChange>, lastViewedFile: string | null, isUncommitted: boolean) {
	let encodedName = encodeURIComponent(name), escapedName = escapeHtml(name);
	if (leaf.type === 'file') {
		const fileTreeFile = gitFiles[leaf.index];
		const textFile = fileTreeFile.additions !== null && fileTreeFile.deletions !== null;
		const diffPossible = fileTreeFile.type === GG.GitFileStatus.Untracked || textFile;
		const encodedOldFilePath = encodeURIComponent(fileTreeFile.oldFilePath), encodedNewFilePath = encodeURIComponent(fileTreeFile.newFilePath);
		const changeTypeMessage = GIT_FILE_CHANGE_TYPES[fileTreeFile.type] + (fileTreeFile.type === GG.GitFileStatus.Renamed ? ' (' + escapeHtml(fileTreeFile.oldFilePath) + ' → ' + escapeHtml(fileTreeFile.newFilePath) + ')' : '');
		return '<li data-pathseg="' + encodedName + '"><span class="fileTreeFileRecord"><span class="fileTreeFile' + (diffPossible ? ' gitDiffPossible' : '') + (leaf.reviewed ? '' : ' pendingReview') + '" data-oldfilepath="' + encodedOldFilePath + '" data-newfilepath="' + encodedNewFilePath + '" data-type="' + fileTreeFile.type + '" title="' + (diffPossible ? 'Click to View Diff' : 'Unable to View Diff' + (fileTreeFile.type !== GG.GitFileStatus.Deleted ? ' (this is a binary file)' : '')) + ' • ' + changeTypeMessage + '"><span class="fileTreeFileIcon">' + SVG_ICONS.file + '</span><span class="gitFileName ' + fileTreeFile.type + '">' + escapedName + '</span></span>' +
			(initialState.config.enhancedAccessibility ? '<span class="fileTreeFileType" title="' + changeTypeMessage + '">' + fileTreeFile.type + '</span>' : '') +
			(fileTreeFile.type !== GG.GitFileStatus.Added && fileTreeFile.type !== GG.GitFileStatus.Untracked && fileTreeFile.type !== GG.GitFileStatus.Deleted && textFile ? '<span class="fileTreeFileAddDel">(<span class="fileTreeFileAdd" title="' + fileTreeFile.additions + ' addition' + (fileTreeFile.additions !== 1 ? 's' : '') + '">+' + fileTreeFile.additions + '</span>|<span class="fileTreeFileDel" title="' + fileTreeFile.deletions + ' deletion' + (fileTreeFile.deletions !== 1 ? 's' : '') + '">-' + fileTreeFile.deletions + '</span>)</span>' : '') +
			(fileTreeFile.newFilePath === lastViewedFile ? '<span id="cdvLastFileViewed" title="Last File Viewed">' + SVG_ICONS.eyeOpen + '</span>' : '') +
			'<span class="copyGitFile fileTreeFileAction" title="Copy File Path to the Clipboard" data-filepath="' + encodedNewFilePath + '">' + SVG_ICONS.copy + '</span>' +
			(fileTreeFile.type !== GG.GitFileStatus.Deleted
				? (diffPossible && !isUncommitted ? '<span class="viewGitFileAtRevision fileTreeFileAction" title="View File at this Revision" data-filepath="' + encodedNewFilePath + '" data-type="' + fileTreeFile.type + '">' + SVG_ICONS.commit + '</span>' : '') +
				'<span class="openGitFile fileTreeFileAction" title="Open File" data-filepath="' + encodedNewFilePath + '">' + SVG_ICONS.openFile + '</span>'
				: ''
			) + '</span></li>';
	} else {
		return '<li data-pathseg="' + encodedName + '"><span class="fileTreeRepo" data-path="' + encodeURIComponent(leaf.path) + '" title="Click to View Repository"><span class="fileTreeRepoIcon">' + SVG_ICONS.closedFolder + '</span>' + escapedName + '</span></li>';
	}
}

function alterFileTreeFolderOpen(folder: FileTreeFolder, folderPath: string, open: boolean) {
	let path = folderPath.split('/'), i, cur = folder;
	for (i = 0; i < path.length; i++) {
		if (typeof cur.contents[path[i]] !== 'undefined') {
			cur = <FileTreeFolder>cur.contents[path[i]];
			if (i === path.length - 1) cur.open = open;
		} else {
			return;
		}
	}
}

function alterFileTreeFileReviewed(folder: FileTreeFolder, filePath: string) {
	let path = filePath.split('/'), i, cur = folder, folders = [folder];
	for (i = 0; i < path.length; i++) {
		if (typeof cur.contents[path[i]] !== 'undefined') {
			if (i < path.length - 1) {
				cur = <FileTreeFolder>cur.contents[path[i]];
				folders.push(cur);
			} else {
				(<FileTreeFile>cur.contents[path[i]]).reviewed = true;
			}
		} else {
			break;
		}
	}
	for (i = folders.length - 1; i >= 0; i--) {
		let keys = Object.keys(folders[i].contents), reviewed = true;
		for (let j = 0; j < keys.length; j++) {
			let cur = folders[i].contents[keys[j]];
			if ((cur.type === 'folder' || cur.type === 'file') && !cur.reviewed) {
				reviewed = false;
				break;
			}
		}
		folders[i].reviewed = reviewed;
	}
}

function setFileTreeReviewed(folder: FileTreeFolder, reviewed: boolean) {
	folder.reviewed = reviewed;
	let keys = Object.keys(folder.contents);
	for (let i = 0; i < keys.length; i++) {
		let cur = folder.contents[keys[i]];
		if (cur.type === 'folder') {
			setFileTreeReviewed(cur, reviewed);
		} else if (cur.type === 'file') {
			cur.reviewed = reviewed;
		}
	}
}

function calcFileTreeFoldersReviewed(folder: FileTreeFolder) {
	const calc = (folder: FileTreeFolder) => {
		let reviewed = true;
		let keys = Object.keys(folder.contents);
		for (let i = 0; i < keys.length; i++) {
			let cur = folder.contents[keys[i]];
			if ((cur.type === 'folder' && !calc(cur)) || (cur.type === 'file' && !cur.reviewed)) reviewed = false;
		}
		folder.reviewed = reviewed;
		return reviewed;
	};
	calc(folder);
}

function updateFileTreeHtml(elem: HTMLElement, folder: FileTreeFolder) {
	let ul = getChildUl(elem);
	if (ul === null) return;

	for (let i = 0; i < ul.children.length; i++) {
		let li = <HTMLLIElement>ul.children[i];
		let pathSeg = decodeURIComponent(li.dataset.pathseg!);
		let child = getChildByPathSegment(folder, pathSeg);
		if (child.type === 'folder') {
			alterClass(<HTMLSpanElement>li.children[0], CLASS_PENDING_REVIEW, !child.reviewed);
			updateFileTreeHtml(li, child);
		} else if (child.type === 'file') {
			alterClass(<HTMLSpanElement>li.children[0].children[0], CLASS_PENDING_REVIEW, !child.reviewed);
		}
	}
}

function updateFileTreeHtmlFileReviewed(elem: HTMLElement, folder: FileTreeFolder, filePath: string) {
	let path = filePath;
	const update = (elem: HTMLElement, folder: FileTreeFolder) => {
		let ul = getChildUl(elem);
		if (ul === null) return;

		for (let i = 0; i < ul.children.length; i++) {
			let li = <HTMLLIElement>ul.children[i];
			let pathSeg = decodeURIComponent(li.dataset.pathseg!);
			if (path === pathSeg || path.startsWith(pathSeg + '/')) {
				let child = getChildByPathSegment(folder, pathSeg);
				if (child.type === 'folder') {
					alterClass(<HTMLSpanElement>li.children[0], CLASS_PENDING_REVIEW, !child.reviewed);
					path = path.substring(pathSeg.length + 1);
					update(li, child);
				} else if (child.type === 'file') {
					alterClass(<HTMLSpanElement>li.children[0].children[0], CLASS_PENDING_REVIEW, !child.reviewed);
				}
				break;
			}
		}
	};
	update(elem, folder);
}

function getFilesInTree(folder: FileTreeFolder, gitFiles: ReadonlyArray<GG.GitFileChange>) {
	let files: string[] = [];
	const scanFolder = (folder: FileTreeFolder) => {
		let keys = Object.keys(folder.contents);
		for (let i = 0; i < keys.length; i++) {
			let cur = folder.contents[keys[i]];
			if (cur.type === 'folder') {
				scanFolder(cur);
			} else if (cur.type === 'file') {
				files.push(gitFiles[cur.index].newFilePath);
			}
		}
	};
	scanFolder(folder);
	return files;
}

function sortFolderKeys(folder: FileTreeFolder) {
	let keys = Object.keys(folder.contents);
	keys.sort((a, b) => folder.contents[a].type !== 'file' && folder.contents[b].type === 'file' ? -1 : folder.contents[a].type === 'file' && folder.contents[b].type !== 'file' ? 1 : folder.contents[a].name < folder.contents[b].name ? -1 : folder.contents[a].name > folder.contents[b].name ? 1 : 0);
	return keys;
}

function getChildByPathSegment(folder: FileTreeFolder, pathSeg: string) {
	let cur: FileTreeNode = folder, comps = pathSeg.split('/');
	for (let i = 0; i < comps.length; i++) {
		cur = (<FileTreeFolder>cur).contents[comps[i]];
	}
	return cur;
}


/* Repository State Helpers */

function getCommitOrdering(repoValue: GG.RepoCommitOrdering): GG.CommitOrdering {
	switch (repoValue) {
		case GG.RepoCommitOrdering.Default:
			return initialState.config.commitOrdering;
		case GG.RepoCommitOrdering.Date:
			return GG.CommitOrdering.Date;
		case GG.RepoCommitOrdering.AuthorDate:
			return GG.CommitOrdering.AuthorDate;
		case GG.RepoCommitOrdering.Topological:
			return GG.CommitOrdering.Topological;
	}
}

function getShowTags(repoValue: GG.ShowTags) {
	return repoValue === GG.ShowTags.Default
		? initialState.config.showTags
		: repoValue === GG.ShowTags.Show;
}

function getIncludeCommitsMentionedByReflogs(repoValue: GG.IncludeCommitsMentionedByReflogs) {
	return repoValue === GG.IncludeCommitsMentionedByReflogs.Default
		? initialState.config.includeCommitsMentionedByReflogs
		: repoValue === GG.IncludeCommitsMentionedByReflogs.Enabled;
}

function getOnlyFollowFirstParent(repoValue: GG.OnlyFollowFirstParent) {
	return repoValue === GG.OnlyFollowFirstParent.Default
		? initialState.config.onlyFollowFirstParent
		: repoValue === GG.OnlyFollowFirstParent.Enabled;
}


/* Miscellaneous Helper Methods */

function haveFilesChanged(oldFiles: ReadonlyArray<GG.GitFileChange> | null, newFiles: ReadonlyArray<GG.GitFileChange> | null) {
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

function getRepoDropdownOptions(repos: ReadonlyArray<string>) {
	let paths: string[] = [], names: string[] = [], distinctNames: string[] = [], firstSep: number[] = [];
	const resolveAmbiguous = (indexes: number[]) => {
		// Find ambiguous names within indexes
		let firstOccurrence: { [name: string]: number } = {}, ambiguous: { [name: string]: number[] } = {};
		for (let i = 0; i < indexes.length; i++) {
			let name = distinctNames[indexes[i]];
			if (typeof firstOccurrence[name] === 'number') {
				// name is ambiguous
				if (typeof ambiguous[name] === 'undefined') {
					// initialise ambiguous array with the first occurrence
					ambiguous[name] = [firstOccurrence[name]];
				}
				ambiguous[name].push(indexes[i]); // append current ambiguous index
			} else {
				firstOccurrence[name] = indexes[i]; // set the first occurrence of the name
			}
		}

		let ambiguousNames = Object.keys(ambiguous);
		for (let i = 0; i < ambiguousNames.length; i++) {
			// For each ambiguous name, resolve the ambiguous indexes
			let ambiguousIndexes = ambiguous[ambiguousNames[i]], retestIndexes = [];
			for (let j = 0; j < ambiguousIndexes.length; j++) {
				let ambiguousIndex = ambiguousIndexes[j];
				let nextSep = paths[ambiguousIndex].lastIndexOf('/', paths[ambiguousIndex].length - distinctNames[ambiguousIndex].length - 2);
				if (firstSep[ambiguousIndex] < nextSep) {
					// prepend the addition path and retest
					distinctNames[ambiguousIndex] = paths[ambiguousIndex].substring(nextSep + 1);
					retestIndexes.push(ambiguousIndex);
				} else {
					distinctNames[ambiguousIndex] = paths[ambiguousIndex];
				}
			}
			if (retestIndexes.length > 1) {
				// If there are 2 or more indexes that may be ambiguous
				resolveAmbiguous(retestIndexes);
			}
		}
	};

	// Initialise recursion
	let indexes = [];
	for (let i = 0; i < repos.length; i++) {
		firstSep.push(repos[i].indexOf('/'));
		if (firstSep[i] === repos[i].length - 1 || firstSep[i] === -1) {
			// Path has no slashes, or a single trailing slash ==> use the path as the name
			paths.push(repos[i]);
			names.push(repos[i]);
			distinctNames.push(repos[i]);
		} else {
			paths.push(repos[i].endsWith('/') ? repos[i].substring(0, repos[i].length - 1) : repos[i]); // Remove trailing slash if it exists
			let name = paths[i].substring(paths[i].lastIndexOf('/') + 1);
			names.push(name);
			distinctNames.push(name);
			indexes.push(i);
		}
	}
	resolveAmbiguous(indexes);

	let options: DropdownOption[] = [];
	for (let i = 0; i < repos.length; i++) {
		let hint;
		if (names[i] === distinctNames[i]) {
			// Name is distinct, no hint needed
			hint = '';
		} else {
			// Hint path is the prefix of the distinctName before the common suffix with name
			let hintPath = distinctNames[i].substring(0, distinctNames[i].length - names[i].length - 1);

			// Keep two informative directories
			let hintComps = hintPath.split('/');
			let keepDirs = hintComps[0] !== '' ? 2 : 3;
			if (hintComps.length > keepDirs) hintComps.splice(keepDirs, hintComps.length - keepDirs, '...');

			// Construct the hint
			hint = (distinctNames[i] !== paths[i] ? '.../' : '') + hintComps.join('/');
		}
		options.push({ name: names[i], value: repos[i], hint: hint });
	}

	return options;
}

function runAction(msg: GG.RequestMessage, action: string) {
	dialog.showActionRunning(action);
	sendMessage(msg);
}

function getBranchLabels(heads: ReadonlyArray<string>, remotes: ReadonlyArray<GG.GitCommitRemote>) {
	let headLabels: { name: string; remotes: string[] }[] = [], headLookup: { [name: string]: number } = {}, remoteLabels: ReadonlyArray<GG.GitCommitRemote>;
	for (let i = 0; i < heads.length; i++) {
		headLabels.push({ name: heads[i], remotes: [] });
		headLookup[heads[i]] = i;
	}
	if (initialState.config.combineLocalAndRemoteBranchLabels) {
		let remainingRemoteLabels = [];
		for (let i = 0; i < remotes.length; i++) {
			if (remotes[i].remote !== null) { // If the remote of the remote branch ref is known
				let branchName = remotes[i].name.substring(remotes[i].remote!.length + 1);
				if (typeof headLookup[branchName] === 'number') {
					headLabels[headLookup[branchName]].remotes.push(remotes[i].remote!);
					continue;
				}
			}
			remainingRemoteLabels.push(remotes[i]);
		}
		remoteLabels = remainingRemoteLabels;
	} else {
		remoteLabels = remotes;
	}
	return { heads: headLabels, remotes: remoteLabels };
}

function findCommitElemWithId(elems: HTMLCollectionOf<HTMLElement>, id: number | null) {
	if (id === null) return null;
	let findIdStr = id.toString();
	for (let i = 0; i < elems.length; i++) {
		if (findIdStr === elems[i].dataset.id) return elems[i];
	}
	return null;
}

function generateSignatureHtml(signature: GG.GitCommitSignature) {
	return '<span class="signatureInfo ' + signature.status + '" title="' + GIT_SIGNATURE_STATUS_DESCRIPTIONS[signature.status] + ':'
		+ ' Signed by ' + escapeHtml(signature.signer !== '' ? signature.signer : '<Unknown>')
		+ ' (GPG Key Id: ' + escapeHtml(signature.key !== '' ? signature.key : '<Unknown>') + ')">'
		+ (signature.status === GG.GitSignatureStatus.GoodAndValid
			? SVG_ICONS.passed
			: signature.status === GG.GitSignatureStatus.Bad
				? SVG_ICONS.failed
				: SVG_ICONS.inconclusive)
		+ '</span>';
}

function closeDialogAndContextMenu() {
	if (dialog.isOpen()) dialog.close();
	if (contextMenu.isOpen()) contextMenu.close();
}
