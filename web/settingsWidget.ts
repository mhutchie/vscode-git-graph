interface SettingsWidgetState {
	visible: boolean;
	repo: string | null;
	settings: GG.GitRepoSettings | null;
}

class SettingsWidget {
	private view: GitGraphView;
	private visible: boolean = false;
	private loading: boolean = false;
	private repo: string | null = null;
	private settings: GG.GitRepoSettings | null = null;

	private widgetElem: HTMLElement;
	private contentsElem: HTMLElement;
	private loadingElem: HTMLElement;

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

	public show(repo: string, transition: boolean) {
		if (this.visible) return;
		this.visible = true;
		this.loading = true;
		this.repo = repo;
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
	public restoreState(state: SettingsWidgetState) {
		if (!state.visible || state.repo === null) return;
		this.settings = state.settings;
		this.show(state.repo, false);
	}

	public isVisible() {
		return this.visible;
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
			showErrorDialog(errorTitle, error, 'Retry', () => this.requestSettings(), null);
		}
	}

	private render() {
		if (this.settings !== null) {
			let html = '<h3>Remote Configuration</h3><table><tr><th>Name</th><th>Remote URL</th><th>Type</th><th>Action</th></tr>', pushUrlPlaceholder = 'Leave blank to use the Fetch URL';
			if (this.settings.remotes.length > 0) {
				this.settings.remotes.forEach((remote, i) => {
					html += '<tr class="lineAbove"><td rowspan="2">' + escapeHtml(remote.name) + '</td><td class="remoteUrl">' + escapeHtml(remote.url || 'Not Set') + '</td><td>Fetch</td><td rowspan="2"><div class="editRemote" data-index="' + i + '" title="Edit Remote">' + SVG_ICONS.pencil + '</div> <div class="deleteRemote" data-index="' + i + '" title="Delete Remote">' + SVG_ICONS.close + '</div></td></tr><tr><td class="remoteUrl">' + escapeHtml(remote.pushUrl || remote.url || 'Not Set') + '</td><td>Push</td></tr>';
				});
			} else {
				html += '<tr class="lineAbove"><td colspan="4">There are no remotes configured for this repository.</td></tr>';
			}
			html += '<tr class="lineAbove"><td colspan="4"><div id="settingsAddRemote">' + SVG_ICONS.close + 'Add Remote</div></td></tr></table>';
			this.contentsElem.innerHTML = html;

			document.getElementById('settingsAddRemote')!.addEventListener('click', () => {
				showFormDialog('Add a new remote to this repository:', [
					{ type: 'text', name: 'Name: ', default: '', placeholder: null },
					{ type: 'text', name: 'Fetch URL: ', default: '', placeholder: null },
					{ type: 'text', name: 'Push URL: ', default: '', placeholder: pushUrlPlaceholder },
					{ type: 'checkbox', name: 'Fetch Immediately: ', value: true }
				], 'Add Remote', values => {
					runAction({ command: 'addRemote', name: values[0], repo: this.repo!, url: values[1], pushUrl: values[2] !== '' ? values[2] : null, fetch: values[3] === 'checked' }, 'Adding Remote');
				}, null);
			});
			addListenerToClass('editRemote', 'click', (e) => {
				let remote = this.settings!.remotes[parseInt((<HTMLElement>(<Element>e.target).closest('.editRemote')!).dataset.index!)];
				showFormDialog('Edit the remote <b><i>' + escapeHtml(remote.name) + '</i></b>:', [
					{ type: 'text', name: 'Name: ', default: remote.name, placeholder: null },
					{ type: 'text', name: 'Fetch URL: ', default: remote.url !== null ? remote.url : '', placeholder: null },
					{ type: 'text', name: 'Push URL: ', default: remote.pushUrl !== null ? remote.pushUrl : '', placeholder: pushUrlPlaceholder }
				], 'Save Changes', values => {
					runAction({ command: 'editRemote', repo: this.repo!, nameOld: remote.name, nameNew: values[0], urlOld: remote.url, urlNew: values[1] !== '' ? values[1] : null, pushUrlOld: remote.pushUrl, pushUrlNew: values[2] !== '' ? values[2] : null }, 'Saving Changes to Remote');
				}, null);
			});
			addListenerToClass('deleteRemote', 'click', (e) => {
				let remote = this.settings!.remotes[parseInt((<HTMLElement>(<Element>e.target).closest('.deleteRemote')!).dataset.index!)];
				showConfirmationDialog('Are you sure you want to delete the remote <b><i>' + escapeHtml(remote.name) + '</i></b>?', () => {
					runAction({ command: 'deleteRemote', repo: this.repo!, name: remote.name }, 'Deleting Remote');
				}, null);
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
}