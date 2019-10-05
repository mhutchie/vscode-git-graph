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

	public show(repo: string, hideRemotes: string[], transition: boolean) {
		if (this.visible) return;
		this.visible = true;
		this.loading = true;
		this.repo = repo;
		this.hideRemotes = hideRemotes;
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
	public restoreState(state: SettingsWidgetState, hideRemotes: string[]) {
		if (!state.visible || state.repo === null) return;
		this.settings = state.settings;
		this.show(state.repo, hideRemotes, false);
	}

	public isVisible() {
		return this.visible;
	}

	public updateHiddenRemotes(repo: string, hideRemotes: string[]) {
		if (!this.visible || this.repo !== repo) return;
		this.hideRemotes = hideRemotes;
		this.render();
	}

	public loadSettings(settings: GG.GitRepoSettings | null, error: string | null) {
		if (!this.visible) return;
		this.settings = settings;
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

	private render() {
		if (this.settings !== null) {
			let html = '<h3>Remote Configuration</h3><table><tr><th>Remote</th><th>URL</th><th>Type</th><th>Action</th></tr>', pushUrlPlaceholder = 'Leave blank to use the Fetch URL';
			if (this.settings.remotes.length > 0) {
				this.settings.remotes.forEach((remote, i) => {
					let hidden = this.hideRemotes !== null && this.hideRemotes.includes(remote.name);
					html += '<tr class="lineAbove">' +
						'<td class="remoteName" rowspan="2"><span class="hideRemoteBtn" data-index="' + i + '" title="Click to ' + (hidden ? 'show' : 'hide') + ' branches of this remote.">' + (hidden ? SVG_ICONS.eyeClosed : SVG_ICONS.eyeOpen) + '</span>' + escapeHtml(remote.name) + '</td>' +
						'<td class="remoteUrl">' + escapeHtml(remote.url || 'Not Set') + '</td><td>Fetch</td>' +
						'<td class="remoteBtns" rowspan="2" data-index="' + i + '"><div class="fetchRemote" title="Fetch from Remote">' + SVG_ICONS.download + '</div> <div class="pruneRemote" title="Prune Remote' + ELLIPSIS + '">' + SVG_ICONS.branch + '</div><br><div class="editRemote" title="Edit Remote' + ELLIPSIS + '">' + SVG_ICONS.pencil + '</div> <div class="deleteRemote" title="Delete Remote' + ELLIPSIS + '">' + SVG_ICONS.close + '</div></td>' +
						'</tr><tr><td class="remoteUrl">' + escapeHtml(remote.pushUrl || remote.url || 'Not Set') + '</td><td>Push</td></tr>';
				});
			} else {
				html += '<tr class="lineAbove"><td colspan="4">There are no remotes configured for this repository.</td></tr>';
			}
			html += '<tr class="lineAbove"><td colspan="4"><div id="settingsAddRemote">' + SVG_ICONS.close + 'Add Remote</div></td></tr></table>';
			this.contentsElem.innerHTML = html;

			document.getElementById('settingsAddRemote')!.addEventListener('click', () => {
				dialog.showForm('Add a new remote to this repository:', [
					{ type: 'text', name: 'Name', default: '', placeholder: null },
					{ type: 'text', name: 'Fetch URL', default: '', placeholder: null },
					{ type: 'text', name: 'Push URL', default: '', placeholder: pushUrlPlaceholder },
					{ type: 'checkbox', name: 'Fetch Immediately', value: true }
				], 'Add Remote', values => {
					runAction({ command: 'addRemote', name: values[0], repo: this.repo!, url: values[1], pushUrl: values[2] !== '' ? values[2] : null, fetch: values[3] === 'checked' }, 'Adding Remote');
				}, null);
			});
			addListenerToClass('editRemote', 'click', (e) => {
				let remote = this.getRemoteForBtnEvent(e);
				dialog.showForm('Edit the remote <b><i>' + escapeHtml(remote.name) + '</i></b>:', [
					{ type: 'text', name: 'Name', default: remote.name, placeholder: null },
					{ type: 'text', name: 'Fetch URL', default: remote.url !== null ? remote.url : '', placeholder: null },
					{ type: 'text', name: 'Push URL', default: remote.pushUrl !== null ? remote.pushUrl : '', placeholder: pushUrlPlaceholder }
				], 'Save Changes', values => {
					runAction({ command: 'editRemote', repo: this.repo!, nameOld: remote.name, nameNew: values[0], urlOld: remote.url, urlNew: values[1] !== '' ? values[1] : null, pushUrlOld: remote.pushUrl, pushUrlNew: values[2] !== '' ? values[2] : null }, 'Saving Changes to Remote');
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
		}
		alterClass(this.widgetElem, CLASS_LOADING, this.loading);
		this.loadingElem.innerHTML = this.loading ? '<span>' + SVG_ICONS.loading + 'Loading ...</span>' : '';
	}

	private requestSettings() {
		if (this.repo === null) return;
		sendMessage({ command: 'getSettings', repo: this.repo });
		this.render();
	}

	private getRemoteForBtnEvent(e: Event) {
		return this.settings!.remotes[parseInt((<HTMLElement>(<Element>e.target).closest('.remoteBtns')!).dataset.index!)];
	}
}
