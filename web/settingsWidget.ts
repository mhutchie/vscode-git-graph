interface SettingsWidgetState {
	readonly visible: boolean;
	readonly repo: string | null;
	readonly settings: GG.GitRepoSettings | null;
}

class SettingsWidget {
	private readonly view: GitGraphView;
	private visible: boolean = false;
	private loading: boolean = false;
	private repo: string | null = null;

	private hideRemotes: string[] | null = null;
	private issueLinkingConfig: GG.IssueLinkingConfig | null = null;
	private showTags: GG.ShowTags | null = null;

	private settings: GG.GitRepoSettings | null = null;

	private readonly widgetElem: HTMLElement;
	private readonly contentsElem: HTMLElement;
	private readonly loadingElem: HTMLElement;

	constructor(view: GitGraphView) {
		this.view = view;

		this.widgetElem = document.createElement('div');
		this.widgetElem.className = 'settingsWidget';
		this.widgetElem.innerHTML = '<h2>Repository Settings</h2><div id="settingsContent"></div><div id="settingsLoading"></div><div id="settingsClose"></div>';
		document.body.appendChild(this.widgetElem);

		this.contentsElem = document.getElementById('settingsContent')!;
		this.loadingElem = document.getElementById('settingsLoading')!;

		const settingsClose = document.getElementById('settingsClose')!;
		settingsClose.innerHTML = SVG_ICONS.close;
		settingsClose.addEventListener('click', () => this.close());
	}

	public show(repo: string, hideRemotes: string[], issueLinkingConfig: GG.IssueLinkingConfig | null, showTags: GG.ShowTags, transition: boolean) {
		if (this.visible) return;
		this.visible = true;
		this.loading = true;
		this.repo = repo;
		this.hideRemotes = hideRemotes;
		this.issueLinkingConfig = issueLinkingConfig;
		this.showTags = showTags;
		alterClass(this.widgetElem, CLASS_TRANSITION, transition);
		this.widgetElem.classList.add(CLASS_ACTIVE);
		this.requestSettings();
		this.view.saveState();
	}

	public refresh() {
		if (!this.visible) return;
		this.loading = true;
		this.requestSettings();
	}

	public close() {
		if (!this.visible) return;
		this.visible = false;
		this.loading = false;
		this.repo = null;
		this.hideRemotes = null;
		this.issueLinkingConfig = null;
		this.showTags = null;
		this.settings = null;
		this.widgetElem.classList.add(CLASS_TRANSITION);
		this.widgetElem.classList.remove(CLASS_ACTIVE);
		this.widgetElem.classList.remove(CLASS_LOADING);
		this.contentsElem.innerHTML = '';
		this.loadingElem.innerHTML = '';
		this.view.saveState();
	}


	/* State */

	public getState(): SettingsWidgetState {
		return {
			visible: this.visible,
			repo: this.repo,
			settings: this.settings
		};
	}

	public restoreState(state: SettingsWidgetState, hideRemotes: string[], issueLinkingConfig: GG.IssueLinkingConfig | null, showTags: GG.ShowTags) {
		if (!state.visible || state.repo === null) return;
		this.settings = state.settings;
		this.show(state.repo, hideRemotes, issueLinkingConfig, showTags, false);
	}

	public isVisible() {
		return this.visible;
	}

	public loadSettings(settings: GG.GitRepoSettings | null, error: string | null) {
		if (!this.visible) return;
		this.settings = settings;

		if (this.settings !== null && this.hideRemotes !== null) {
			// Remove hidden remotes that no longer exist
			let remotes = this.settings.remotes.map((remote) => remote.name);
			this.hideRemotes = this.hideRemotes.filter((hiddenRemote) => remotes.includes(hiddenRemote));
		}

		if (error === null) {
			this.loading = false;
			this.render();
			this.view.saveState();
		} else {
			const errorTitle = 'Unable To Load Repository Settings';
			this.contentsElem.innerHTML = '';
			this.loadingElem.innerHTML = '<span>' + errorTitle + '</span>';
			alterClass(this.widgetElem, CLASS_LOADING, true);
			dialog.showError(errorTitle, error, 'Retry', () => this.requestSettings(), null);
		}
	}


	/* Render Methods */

	private render() {
		if (this.settings !== null) {
			let html = '<div class="settingsSection centered"><h3>General</h3>';
			html += '<label id="settingsShowTags"><input type="checkbox" id="settingsShowTagsCheckbox" tabindex="-1"><span class="customCheckbox"></span>Show Tags</label></div>';

			html += '<div class="settingsSection centered"><h3>User Details</h3>';
			const userName = this.settings.user.name, userEmail = this.settings.user.email;
			const userNameSet = userName.local !== null || userName.global !== null;
			const userEmailSet = userEmail.local !== null || userEmail.global !== null;
			if (userNameSet || userEmailSet) {
				const escapedUserName = escapeHtml(userName.local ?? userName.global ?? 'Not Set');
				const escapedUserEmail = escapeHtml(userEmail.local ?? userEmail.global ?? 'Not Set');
				html += '<table>';
				html += '<tr><td class="left">User Name:</td><td class="leftWithEllipsis" title="' + escapedUserName + (userNameSet ? ' (' + (userName.local !== null ? 'Local' : 'Global') + ')' : '') + '">' + escapedUserName + '</td></tr>';
				html += '<tr><td class="left">User Email:</td><td class="leftWithEllipsis" title="' + escapedUserEmail + (userEmailSet ? ' (' + (userEmail.local !== null ? 'Local' : 'Global') + ')' : '') + '">' + escapedUserEmail + '</td></tr>';
				html += '</table>';
				html += '<div class="settingsSectionButtons"><div id="editUserDetails" class="editBtn">' + SVG_ICONS.pencil + 'Edit</div><div id="removeUserDetails" class="removeBtn">' + SVG_ICONS.close + 'Remove</div></div>';
			} else {
				html += '<span>User Details (such as name and email) are used by Git to record the Author and Committer of commit objects.</span>';
				html += '<div class="settingsSectionButtons"><div id="editUserDetails" class="addBtn">' + SVG_ICONS.close + 'Add User Details</div></div>';
			}
			html += '</div>';

			html += '<div class="settingsSection"><h3>Remote Configuration</h3><table><tr><th>Remote</th><th>URL</th><th>Type</th><th>Action</th></tr>';
			if (this.settings.remotes.length > 0) {
				this.settings.remotes.forEach((remote, i) => {
					let hidden = this.hideRemotes !== null && this.hideRemotes.includes(remote.name);
					let fetchUrl = escapeHtml(remote.url || 'Not Set'), pushUrl = escapeHtml(remote.pushUrl || remote.url || 'Not Set');
					html += '<tr class="lineAbove">' +
						'<td class="left" rowspan="2"><span class="hideRemoteBtn" data-index="' + i + '" title="Click to ' + (hidden ? 'show' : 'hide') + ' branches of this remote.">' + (hidden ? SVG_ICONS.eyeClosed : SVG_ICONS.eyeOpen) + '</span>' + escapeHtml(remote.name) + '</td>' +
						'<td class="leftWithEllipsis" title="Fetch URL: ' + fetchUrl + '">' + fetchUrl + '</td><td>Fetch</td>' +
						'<td class="remoteBtns" rowspan="2" data-index="' + i + '"><div class="fetchRemote" title="Fetch from Remote">' + SVG_ICONS.download + '</div> <div class="pruneRemote" title="Prune Remote' + ELLIPSIS + '">' + SVG_ICONS.branch + '</div><br><div class="editRemote" title="Edit Remote' + ELLIPSIS + '">' + SVG_ICONS.pencil + '</div> <div class="deleteRemote" title="Delete Remote' + ELLIPSIS + '">' + SVG_ICONS.close + '</div></td>' +
						'</tr><tr><td class="leftWithEllipsis" title="Push URL: ' + pushUrl + '">' + pushUrl + '</td><td>Push</td></tr>';
				});
			} else {
				html += '<tr class="lineAbove"><td colspan="4">There are no remotes configured for this repository.</td></tr>';
			}
			html += '</table><div class="settingsSectionButtons lineAbove"><div id="settingsAddRemote" class="addBtn">' + SVG_ICONS.close + 'Add Remote</div></div></div>';

			html += '<div class="settingsSection centered"><h3>Issue Linking</h3>';
			const issueLinkingConfig = this.issueLinkingConfig !== null
				? this.issueLinkingConfig
				: globalState.issueLinkingConfig;
			if (issueLinkingConfig !== null) {
				const escapedIssue = escapeHtml(issueLinkingConfig.issue), escapedUrl = escapeHtml(issueLinkingConfig.url);
				html += '<table><tr><td class="left">Issue Regex:</td><td class="leftWithEllipsis" title="' + escapedIssue + '">' + escapedIssue + '</td></tr><tr><td class="left">Issue URL:</td><td class="leftWithEllipsis" title="' + escapedUrl + '">' + escapedUrl + '</td></tr></table>';
				html += '<div class="settingsSectionButtons"><div id="editIssueLinking" class="editBtn">' + SVG_ICONS.pencil + 'Edit</div><div id="removeIssueLinking" class="removeBtn">' + SVG_ICONS.close + 'Remove</div></div>';
			} else {
				html += '<span>Issue Linking converts issue numbers in commit messages into hyperlinks, that open the issue in your issue tracking system.</span>';
				html += '<div class="settingsSectionButtons"><div id="editIssueLinking" class="addBtn">' + SVG_ICONS.close + 'Add Issue Linking</div></div>';
			}
			html += '</div>';

			html += '<div class="settingsSection"><h3>Extension Settings</h3>';
			html += '<div class="settingsSectionButtons"><div id="openExtensionSettings">' + SVG_ICONS.gear + 'Open Git Graph Extension Settings</div></div></div>';

			this.contentsElem.innerHTML = html;

			const showTagsElem = <HTMLInputElement>document.getElementById('settingsShowTagsCheckbox');
			showTagsElem.checked = this.showTags === GG.ShowTags.Default
				? initialState.config.showTags
				: this.showTags === GG.ShowTags.Show;
			showTagsElem.addEventListener('change', () => {
				if (this.repo === null) return;
				const value = (<HTMLInputElement>document.getElementById('settingsShowTagsCheckbox')).checked;
				this.showTags = value ? GG.ShowTags.Show : GG.ShowTags.Hide;
				this.view.saveShowTagsConfig(this.repo, this.showTags);
				this.view.refresh(true);
			});

			document.getElementById('editUserDetails')!.addEventListener('click', () => {
				if (this.settings === null) return;
				const userName = this.settings.user.name, userEmail = this.settings.user.email;
				dialog.showForm('Set the user name and email used by Git to record the Author and Committer of commit objects:', [
					{ type: DialogInputType.Text, name: 'User Name', default: userName.local ?? userName.global ?? '', placeholder: null },
					{ type: DialogInputType.Text, name: 'User Email', default: userEmail.local ?? userEmail.global ?? '', placeholder: null },
					{ type: DialogInputType.Checkbox, name: 'Use Globally', value: userName.local === null && userEmail.local === null, info: 'Use the "User Name" and "User Email" globally for all Git repositories (it can be overridden per repository).' }
				], 'Set User Details', (values) => {
					const useGlobally = <boolean>values[2];
					runAction({
						command: 'editUserDetails',
						repo: this.repo!,
						name: <string>values[0],
						email: <string>values[1],
						location: useGlobally ? GG.GitConfigLocation.Global : GG.GitConfigLocation.Local,
						deleteLocalName: useGlobally && userName.local !== null,
						deleteLocalEmail: useGlobally && userEmail.local !== null
					}, 'Setting User Details');
				}, null);
			});
			if (userNameSet || userEmailSet) {
				document.getElementById('removeUserDetails')!.addEventListener('click', () => {
					if (this.settings === null) return;
					const userName = this.settings.user.name, userEmail = this.settings.user.email;
					const isGlobal = userName.local === null && userEmail.local === null;
					dialog.showConfirmation('Are you sure you want to remove the <b>' + (isGlobal ? 'globally' : 'locally') + ' configured</b> user name and email, which are used by Git to record the Author and Committer of commit objects?', () => {
						runAction({
							command: 'deleteUserDetails',
							repo: this.repo!,
							name: (isGlobal ? userName.global : userName.local) !== null,
							email: (isGlobal ? userEmail.global : userEmail.local) !== null,
							location: isGlobal ? GG.GitConfigLocation.Global : GG.GitConfigLocation.Local
						}, 'Removing User Details');
					}, null);
				});
			}

			const pushUrlPlaceholder = 'Leave blank to use the Fetch URL';
			document.getElementById('settingsAddRemote')!.addEventListener('click', () => {
				dialog.showForm('Add a new remote to this repository:', [
					{ type: DialogInputType.Text, name: 'Name', default: '', placeholder: null },
					{ type: DialogInputType.Text, name: 'Fetch URL', default: '', placeholder: null },
					{ type: DialogInputType.Text, name: 'Push URL', default: '', placeholder: pushUrlPlaceholder },
					{ type: DialogInputType.Checkbox, name: 'Fetch Immediately', value: true }
				], 'Add Remote', (values) => {
					runAction({ command: 'addRemote', name: <string>values[0], repo: this.repo!, url: <string>values[1], pushUrl: <string>values[2] !== '' ? <string>values[2] : null, fetch: <boolean>values[3] }, 'Adding Remote');
				}, null);
			});
			addListenerToClass('editRemote', 'click', (e) => {
				let remote = this.getRemoteForBtnEvent(e);
				dialog.showForm('Edit the remote <b><i>' + escapeHtml(remote.name) + '</i></b>:', [
					{ type: DialogInputType.Text, name: 'Name', default: remote.name, placeholder: null },
					{ type: DialogInputType.Text, name: 'Fetch URL', default: remote.url !== null ? remote.url : '', placeholder: null },
					{ type: DialogInputType.Text, name: 'Push URL', default: remote.pushUrl !== null ? remote.pushUrl : '', placeholder: pushUrlPlaceholder }
				], 'Save Changes', (values) => {
					runAction({ command: 'editRemote', repo: this.repo!, nameOld: remote.name, nameNew: <string>values[0], urlOld: remote.url, urlNew: <string>values[1] !== '' ? <string>values[1] : null, pushUrlOld: remote.pushUrl, pushUrlNew: <string>values[2] !== '' ? <string>values[2] : null }, 'Saving Changes to Remote');
				}, null);
			});
			addListenerToClass('deleteRemote', 'click', (e) => {
				let remote = this.getRemoteForBtnEvent(e);
				dialog.showConfirmation('Are you sure you want to delete the remote <b><i>' + escapeHtml(remote.name) + '</i></b>?', () => {
					runAction({ command: 'deleteRemote', repo: this.repo!, name: remote.name }, 'Deleting Remote');
				}, null);
			});
			addListenerToClass('fetchRemote', 'click', (e) => {
				runAction({ command: 'fetch', repo: this.repo!, name: this.getRemoteForBtnEvent(e).name, prune: false }, 'Fetching from Remote');
			});
			addListenerToClass('pruneRemote', 'click', (e) => {
				let remote = this.getRemoteForBtnEvent(e);
				dialog.showConfirmation('Are you sure you want to prune remote-tracking references that no longer exist on the remote <b><i>' + escapeHtml(remote.name) + '</i></b>?', () => {
					runAction({ command: 'pruneRemote', repo: this.repo!, name: remote.name }, 'Pruning Remote');
				}, null);
			});
			addListenerToClass('hideRemoteBtn', 'click', (e) => {
				if (this.repo === null || this.hideRemotes === null) return;
				let source = <HTMLElement>(<Element>e.target).closest('.hideRemoteBtn')!;
				let remote = this.settings!.remotes[parseInt(source.dataset.index!)].name;
				let hideRemote = !this.hideRemotes.includes(remote);
				source.title = 'Click to ' + (hideRemote ? 'show' : 'hide') + ' branches of this remote.';
				source.innerHTML = hideRemote ? SVG_ICONS.eyeClosed : SVG_ICONS.eyeOpen;
				if (hideRemote) {
					this.hideRemotes.push(remote);
				} else {
					this.hideRemotes.splice(this.hideRemotes.indexOf(remote), 1);
				}
				this.view.saveHiddenRemotes(this.repo, this.hideRemotes);
				this.view.refresh(true);
			});

			document.getElementById('editIssueLinking')!.addEventListener('click', () => {
				const issueLinkingConfig = this.issueLinkingConfig !== null
					? this.issueLinkingConfig
					: globalState.issueLinkingConfig;
				if (issueLinkingConfig !== null) {
					this.showIssueLinkingDialog(issueLinkingConfig.issue, issueLinkingConfig.url, this.issueLinkingConfig === null && globalState.issueLinkingConfig !== null, true);
				} else {
					this.showIssueLinkingDialog(null, null, false, false);
				}
			});

			if (this.issueLinkingConfig !== null || globalState.issueLinkingConfig !== null) {
				document.getElementById('removeIssueLinking')!.addEventListener('click', () => {
					dialog.showConfirmation('Are you sure you want to remove ' + (this.issueLinkingConfig !== null ? (globalState.issueLinkingConfig !== null ? 'the <b>locally configured</b> ' : '') + 'Issue Linking from this repository' : 'the <b>globally configured</b> Issue Linking in Git Graph') + '?', () => {
						this.setIssueLinkingConfig(null, this.issueLinkingConfig === null);
					}, null);
				});
			}

			document.getElementById('openExtensionSettings')!.addEventListener('click', () => {
				sendMessage({ command: 'openExtensionSettings' });
			});
		}
		alterClass(this.widgetElem, CLASS_LOADING, this.loading);
		this.loadingElem.innerHTML = this.loading ? '<span>' + SVG_ICONS.loading + 'Loading ...</span>' : '';
	}


	/* Private Helper Methods */

	private requestSettings() {
		if (this.repo === null) return;
		sendMessage({ command: 'getSettings', repo: this.repo });
		this.render();
	}

	private setIssueLinkingConfig(config: GG.IssueLinkingConfig | null, global: boolean) {
		if (this.repo === null) return;

		if (global) {
			if (this.issueLinkingConfig !== null) {
				this.issueLinkingConfig = null;
				this.view.saveIssueLinkingConfig(this.repo, null);
			}
			this.view.updateGlobalViewState('issueLinkingConfig', config);
		} else {
			this.issueLinkingConfig = config;
			this.view.saveIssueLinkingConfig(this.repo, this.issueLinkingConfig);
		}

		this.view.refresh(true);
		this.render();
	}

	private showIssueLinkingDialog(defaultIssueRegex: string | null, defaultIssueUrl: string | null, defaultUseGlobally: boolean, isEdit: boolean) {
		let html = '<b>' + (isEdit ? 'Edit Issue Linking for' : 'Add Issue Linking to') + ' this Repository</b>';
		html += '<p style="font-size:12px; margin:6px 0;">The following example links <b>#123</b> in commit messages to <b>https://github.com/mhutchie/repo/issues/123</b>:</p>';
		html += '<table style="display:inline-table; width:360px; text-align:left; font-size:12px; margin-bottom:2px;"><tr><td>Issue Regex:</td><td>#(\\d+)</td></tr><tr><td>Issue URL:</td><td>https://github.com/mhutchie/repo/issues/$1</td></tr></tbody></table>';

		if (!isEdit && defaultIssueRegex === null && defaultIssueUrl === null) {
			defaultIssueRegex = autoDetectIssueRegex(this.view.getCommits());
			if (defaultIssueRegex !== null) {
				html += '<p style="font-size:12px"><i>The prefilled Issue Regex was detected in commit messages in this repository. Review and/or correct it if necessary.</i></p>';
			}
		}

		dialog.showForm(html, [
			{ type: DialogInputType.Text, name: 'Issue Regex', default: defaultIssueRegex !== null ? defaultIssueRegex : '', placeholder: null, info: 'A regular expression that matches your issue numbers, with a single capturing group ( ) that will be substituted into the "Issue URL".' },
			{ type: DialogInputType.Text, name: 'Issue URL', default: defaultIssueUrl !== null ? defaultIssueUrl : '', placeholder: null, info: 'The issue\'s URL in your project’s issue tracking system, with $1 as a placeholder for the group captured ( ) in the "Issue Regex".' },
			{ type: DialogInputType.Checkbox, name: 'Use Globally', value: defaultUseGlobally, info: 'Use the "Issue Regex" and "Issue URL" for all repositories by default (it can be overridden per repository). Note: "Use Globally" is only suitable if identical Issue Linking applies to the majority of your repositories (e.g. when using JIRA or Pivotal Tracker).' }
		], 'Save', (values) => {
			let issueRegex = (<string>values[0]).trim(), issueUrl = (<string>values[1]).trim(), useGlobally = <boolean>values[2];
			let regExpParseError = null;
			try {
				if (issueRegex.indexOf('(') === -1 || issueRegex.indexOf(')') === -1) {
					regExpParseError = 'The regular expression does not contain a capturing group ( ).';
				} else if (new RegExp(issueRegex, 'gu')) {
					regExpParseError = null;
				}
			} catch (e) {
				regExpParseError = e.message;
			}
			if (regExpParseError !== null) {
				dialog.showError('Invalid Issue Regex', regExpParseError, 'Go Back', () => {
					this.showIssueLinkingDialog(issueRegex, issueUrl, useGlobally, isEdit);
				}, null);
			} else if (issueUrl.indexOf('$1') === -1) {
				dialog.showError('Invalid Issue URL', 'The Issue URL does not contain the placeholder $1 for the issue number captured in the Issue Regex.', 'Go Back', () => {
					this.showIssueLinkingDialog(issueRegex, issueUrl, useGlobally, isEdit);
				}, null);
			} else {
				this.setIssueLinkingConfig({ issue: issueRegex, url: issueUrl }, useGlobally);
			}
		}, null, false);
	}

	private getRemoteForBtnEvent(e: Event) {
		return this.settings!.remotes[parseInt((<HTMLElement>(<Element>e.target).closest('.remoteBtns')!).dataset.index!)];
	}
}

function autoDetectIssueRegex(commits: ReadonlyArray<GG.GitCommit>) {
	const patterns = ['#(\\d+)', '^(\\d+)\\.(?=\\s|$)', '^(\\d+):(?=\\s|$)', '([A-Za-z]+-\\d+)'].map((pattern) => {
		const regexp = new RegExp(pattern);
		return {
			pattern: pattern,
			matches: commits.filter((commit) => regexp.test(commit.message)).length
		};
	}).sort((a, b) => b.matches - a.matches);

	if (patterns[0].matches > 0.1 * commits.length) {
		// If the most common pattern was matched in more than 10% of commits, return the pattern
		return patterns[0].pattern;
	}
	return null;
}
