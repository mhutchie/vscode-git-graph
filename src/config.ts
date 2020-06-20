import * as vscode from 'vscode';
import {
	CommitDetailsViewLocation,
	CommitOrdering,
	ContextMenuActionsVisibility,
	CustomBranchGlobPattern,
	CustomEmojiShortcodeMapping,
	CustomPullRequestProvider,
	DateFormat,
	DateFormatType,
	DateType,
	DefaultColumnVisibility,
	DialogDefaults,
	FileViewType,
	GitResetMode,
	GraphStyle,
	RefLabelAlignment,
	TabIconColourTheme
} from './types';

const VIEW_COLUMN_MAPPING: { [column: string]: vscode.ViewColumn } = {
	'Active': vscode.ViewColumn.Active,
	'Beside': vscode.ViewColumn.Beside,
	'One': vscode.ViewColumn.One,
	'Two': vscode.ViewColumn.Two,
	'Three': vscode.ViewColumn.Three,
	'Four': vscode.ViewColumn.Four,
	'Five': vscode.ViewColumn.Five,
	'Six': vscode.ViewColumn.Six,
	'Seven': vscode.ViewColumn.Seven,
	'Eight': vscode.ViewColumn.Eight,
	'Nine': vscode.ViewColumn.Nine
};

/**
 * Represents the users configuration of Git Graph Extension Settings.
 */
class Config {
	private readonly config: vscode.WorkspaceConfiguration;

	/**
	 * Creates a Config instance.
	 */
	constructor() {
		this.config = vscode.workspace.getConfiguration('git-graph');
	}

	/**
	 * Get the value of the `git-graph.autoCenterCommitDetailsView` Extension Setting.
	 */
	get autoCenterCommitDetailsView() {
		return !!this.config.get('autoCenterCommitDetailsView', true);
	}

	/**
	 * Get the value of the `git-graph.combineLocalAndRemoteBranchLabels` Extension Setting.
	 */
	get combineLocalAndRemoteBranchLabels() {
		return !!this.config.get('combineLocalAndRemoteBranchLabels', true);
	}

	/**
	 * Get the value of the `git-graph.commitDetailsViewLocation` Extension Setting.
	 */
	get commitDetailsViewLocation() {
		return this.config.get<string>('commitDetailsViewLocation', 'Inline') === 'Docked to Bottom'
			? CommitDetailsViewLocation.DockedToBottom
			: CommitDetailsViewLocation.Inline;
	}

	/**
	 * Get the value of the `git-graph.commitOrdering` Extension Setting.
	 */
	get commitOrdering() {
		const ordering = this.config.get<string>('commitOrdering', 'date');
		return ordering === 'author-date'
			? CommitOrdering.AuthorDate
			: ordering === 'topo'
				? CommitOrdering.Topological
				: CommitOrdering.Date;
	}

	/**
	 * Get the value of the `git-graph.contextMenuActionsVisibility` Extension Setting.
	 */
	get contextMenuActionsVisibility(): ContextMenuActionsVisibility {
		let userConfig = this.config.get('contextMenuActionsVisibility', {});
		let config = {
			branch: { checkout: true, rename: true, delete: true, merge: true, rebase: true, push: true, createPullRequest: true, createArchive: true, copyName: true },
			commit: { addTag: true, createBranch: true, checkout: true, cherrypick: true, revert: true, drop: true, merge: true, rebase: true, reset: true, copyHash: true, copySubject: true },
			remoteBranch: { checkout: true, delete: true, fetch: true, merge: true, pull: true, createPullRequest: true, createArchive: true, copyName: true },
			stash: { apply: true, createBranch: true, pop: true, drop: true, copyName: true, copyHash: true },
			tag: { viewDetails: true, delete: true, push: true, createArchive: true, copyName: true },
			uncommittedChanges: { stash: true, reset: true, clean: true, openSourceControlView: true }
		};
		mergeConfigObjects(config, userConfig);
		return config;
	}

	/**
	 * Get the value of the `git-graph.customBranchGlobPatterns` Extension Setting.
	 */
	get customBranchGlobPatterns(): CustomBranchGlobPattern[] {
		let inPatterns = this.config.get('customBranchGlobPatterns', <any[]>[]);
		let outPatterns: CustomBranchGlobPattern[] = [];
		for (let i = 0; i < inPatterns.length; i++) {
			if (typeof inPatterns[i].name === 'string' && typeof inPatterns[i].glob === 'string') {
				outPatterns.push({ name: inPatterns[i].name, glob: '--glob=' + inPatterns[i].glob });
			}
		}
		return outPatterns;
	}

	/**
	 * Get the value of the `git-graph.customEmojiShortcodeMappings` Extension Setting.
	 */
	get customEmojiShortcodeMappings(): CustomEmojiShortcodeMapping[] {
		let inMappings = this.config.get('customEmojiShortcodeMappings', <any[]>[]);
		let outMappings: CustomEmojiShortcodeMapping[] = [];
		for (let i = 0; i < inMappings.length; i++) {
			if (typeof inMappings[i].shortcode === 'string' && typeof inMappings[i].emoji === 'string') {
				outMappings.push({ shortcode: inMappings[i].shortcode, emoji: inMappings[i].emoji });
			}
		}
		return outMappings;
	}

	/**
	 * Get the value of the `git-graph.customPullRequestProviders` Extension Setting.
	 */
	get customPullRequestProviders(): CustomPullRequestProvider[] {
		let providers = this.config.get('customPullRequestProviders', <any[]>[]);
		return Array.isArray(providers)
			? providers
				.filter((provider) => typeof provider.name === 'string' && typeof provider.templateUrl === 'string')
				.map((provider) => ({ name: provider.name, templateUrl: provider.templateUrl }))
			: [];
	}

	/**
	 * Get the value of the `git-graph.dateFormat` Extension Setting.
	 */
	get dateFormat(): DateFormat {
		let configValue = this.config.get<string>('dateFormat', 'Date & Time'), type = DateFormatType.DateAndTime, iso = false;
		if (configValue === 'Relative') {
			type = DateFormatType.Relative;
		} else {
			if (configValue.endsWith('Date Only')) type = DateFormatType.DateOnly;
			if (configValue.startsWith('ISO')) iso = true;
		}
		return { type: type, iso: iso };
	}

	/**
	 * Get the value of the `git-graph.dateType` Extension Setting.
	 */
	get dateType() {
		return this.config.get<string>('dateType', 'Author Date') === 'Commit Date'
			? DateType.Commit
			: DateType.Author;
	}

	/**
	 * Get the value of the `git-graph.defaultColumnVisibility` Extension Setting.
	 */
	get defaultColumnVisibility(): DefaultColumnVisibility {
		let obj: any = this.config.get('defaultColumnVisibility', {});
		if (typeof obj === 'object' && obj !== null && typeof obj['Date'] === 'boolean' && typeof obj['Author'] === 'boolean' && typeof obj['Commit'] === 'boolean') {
			return { author: obj['Author'], commit: obj['Commit'], date: obj['Date'] };
		} else {
			return { author: true, commit: true, date: true };
		}
	}

	/**
	 * Get the value of the `git-graph.defaultFileViewType` Extension Setting.
	 */
	get defaultFileViewType(): FileViewType {
		return this.config.get<string>('defaultFileViewType', 'File Tree') === 'File List'
			? FileViewType.List
			: FileViewType.Tree;
	}

	/**
	 * Get the value of the `git-graph.dialog.*` Extension Settings.
	 */
	get dialogDefaults(): DialogDefaults {
		let resetCommitMode = this.config.get<string>('dialog.resetCurrentBranchToCommit.mode', 'Mixed');
		let resetUncommittedMode = this.config.get<string>('dialog.resetUncommittedChanges.mode', 'Mixed');

		return {
			addTag: {
				pushToRemote: !!this.config.get('dialog.addTag.pushToRemote', false),
				type: this.config.get<string>('dialog.addTag.type', 'Annotated') === 'Lightweight' ? 'lightweight' : 'annotated'
			},
			applyStash: {
				reinstateIndex: !!this.config.get('dialog.applyStash.reinstateIndex', false)
			},
			cherryPick: {
				recordOrigin: !!this.config.get('dialog.cherryPick.recordOrigin', false)
			},
			createBranch: {
				checkout: !!this.config.get('dialog.createBranch.checkOut', false)
			},
			deleteBranch: {
				forceDelete: !!this.config.get('dialog.deleteBranch.forceDelete', false)
			},
			merge: {
				noCommit: !!this.config.get('dialog.merge.noCommit', false),
				noFastForward: !!this.config.get('dialog.merge.noFastForward', true),
				squash: !!this.config.get('dialog.merge.squashCommits', false)
			},
			popStash: {
				reinstateIndex: !!this.config.get('dialog.popStash.reinstateIndex', false)
			},
			rebase: {
				ignoreDate: !!this.config.get('dialog.rebase.ignoreDate', true),
				interactive: !!this.config.get('dialog.rebase.launchInteractiveRebase', false)
			},
			resetCommit: {
				mode: resetCommitMode === 'Soft' ? GitResetMode.Soft : (resetCommitMode === 'Hard' ? GitResetMode.Hard : GitResetMode.Mixed)
			},
			resetUncommitted: {
				mode: resetUncommittedMode === 'Hard' ? GitResetMode.Hard : GitResetMode.Mixed
			},
			stashUncommittedChanges: {
				includeUntracked: !!this.config.get('dialog.stashUncommittedChanges.includeUntracked', true)
			}
		};
	}

	/**
	 * Get the value of the `git-graph.enhancedAccessibility` Extension Setting.
	 */
	get enhancedAccessibility() {
		return !!this.config.get('enhancedAccessibility', false);
	}

	/**
	 * Get the value of the `git-graph.fetchAndPrune` Extension Setting.
	 */
	get fetchAndPrune() {
		return !!this.config.get('fetchAndPrune', false);
	}

	/**
	 * Get the value of the `git-graph.fetchAvatars` Extension Setting.
	 */
	get fetchAvatars() {
		return !!this.config.get('fetchAvatars', false);
	}

	/**
	 * Get the value of the `git-graph.fileEncoding` Extension Setting.
	 */
	get fileEncoding() {
		return this.config.get<string>('fileEncoding', 'utf8');
	}

	/**
	 * Get the value of the `git-graph.graphColours` Extension Setting.
	 */
	get graphColours() {
		const colours = this.config.get<string[]>('graphColours', []);
		return Array.isArray(colours) && colours.length > 0
			? colours.filter((v) => v.match(/^\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgb[a]?\s*\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\))\s*$/) !== null)
			: ['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00'];
	}

	/**
	 * Get the value of the `git-graph.graphStyle` Extension Setting.
	 */
	get graphStyle() {
		return this.config.get<string>('graphStyle', 'rounded') === 'angular'
			? GraphStyle.Angular
			: GraphStyle.Rounded;
	}

	/**
	 * Get the value of the `git-graph.includeCommitsMentionedByReflogs` Extension Setting.
	 */
	get includeCommitsMentionedByReflogs() {
		return !!this.config.get('includeCommitsMentionedByReflogs', false);
	}

	/**
	 * Get the value of the `git-graph.initialLoadCommits` Extension Setting.
	 */
	get initialLoadCommits() {
		return this.config.get('initialLoadCommits', 300);
	}

	/**
	 * Get the value of the `git-graph.integratedTerminalShell` Extension Setting.
	 */
	get integratedTerminalShell() {
		return this.config.get('integratedTerminalShell', '');
	}

	/**
	 * Get the value of the `git-graph.loadMoreCommits` Extension Setting.
	 */
	get loadMoreCommits() {
		return this.config.get('loadMoreCommits', 100);
	}

	/**
	 * Get the value of the `git-graph.loadMoreCommitsAutomatically` Extension Setting.
	 */
	get loadMoreCommitsAutomatically() {
		return !!this.config.get('loadMoreCommitsAutomatically', true);
	}

	/**
	 * Get the value of the `git-graph.maxDepthOfRepoSearch` Extension Setting.
	 */
	get maxDepthOfRepoSearch() {
		return this.config.get('maxDepthOfRepoSearch', 0);
	}

	/**
	 * Get the value of the `git-graph.muteCommitsThatAreNotAncestorsOfHead` Extension Setting.
	 */
	get muteCommitsThatAreNotAncestorsOfHead() {
		return !!this.config.get('muteCommitsThatAreNotAncestorsOfHead', false);
	}

	/**
	 * Get the value of the `git-graph.muteMergeCommits` Extension Setting.
	 */
	get muteMergeCommits() {
		return !!this.config.get('muteMergeCommits', true);
	}

	/**
	 * Get the value of the `git-graph.onlyFollowFirstParent` Extension Setting.
	 */
	get onlyFollowFirstParent() {
		return !!this.config.get('onlyFollowFirstParent', false);
	}

	/**
	 * Get the value of the `git-graph.openDiffTabLocation` Extension Setting.
	 */
	get openDiffTabLocation(): vscode.ViewColumn {
		const location = this.config.get<string>('openDiffTabLocation', 'Active');
		return typeof location === 'string' && typeof VIEW_COLUMN_MAPPING[location] !== 'undefined'
			? VIEW_COLUMN_MAPPING[location]
			: vscode.ViewColumn.Active;
	}

	/**
	 * Get the value of the `git-graph.openRepoToHead` Extension Setting.
	 */
	get openRepoToHead() {
		return !!this.config.get('openRepoToHead', false);
	}

	/**
	 * Get the value of the `git-graph.openToTheRepoOfTheActiveTextEditorDocument` Extension Setting.
	 */
	get openToTheRepoOfTheActiveTextEditorDocument() {
		return !!this.config.get('openToTheRepoOfTheActiveTextEditorDocument', false);
	}

	/**
	 * Get the value of the `git-graph.referenceLabelAlignment` Extension Setting.
	 */
	get refLabelAlignment() {
		let configValue = this.config.get<string>('referenceLabelAlignment', 'Normal');
		return configValue === 'Branches (on the left) & Tags (on the right)'
			? RefLabelAlignment.BranchesOnLeftAndTagsOnRight
			: configValue === 'Branches (aligned to the graph) & Tags (on the right)'
				? RefLabelAlignment.BranchesAlignedToGraphAndTagsOnRight
				: RefLabelAlignment.Normal;
	}

	/**
	 * Get the value of the `git-graph.retainContextWhenHidden` Extension Setting.
	 */
	get retainContextWhenHidden() {
		return !!this.config.get('retainContextWhenHidden', true);
	}

	/**
	 * Get the value of the `git-graph.showCommitsOnlyReferencedByTags` Extension Setting.
	 */
	get showCommitsOnlyReferencedByTags() {
		return !!this.config.get('showCommitsOnlyReferencedByTags', true);
	}

	/**
	 * Get the value of the `git-graph.showCurrentBranchByDefault` Extension Setting.
	 */
	get showCurrentBranchByDefault() {
		return !!this.config.get('showCurrentBranchByDefault', false);
	}

	/**
	 * Get the value of the `git-graph.showSignatureStatus` Extension Setting.
	 */
	get showSignatureStatus() {
		return !!this.config.get('showSignatureStatus', false);
	}

	/**
	 * Get the value of the `git-graph.showStatusBarItem` Extension Setting.
	 */
	get showStatusBarItem() {
		return !!this.config.get('showStatusBarItem', true);
	}

	/**
	 * Get the value of the `git-graph.showTags` Extension Setting.
	 */
	get showTags() {
		return !!this.config.get('showTags', true);
	}

	/**
	 * Get the value of the `git-graph.showUncommittedChanges` Extension Setting.
	 */
	get showUncommittedChanges() {
		return !!this.config.get('showUncommittedChanges', true);
	}

	/**
	 * Get the value of the `git-graph.showUntrackedFiles` Extension Setting.
	 */
	get showUntrackedFiles() {
		return !!this.config.get('showUntrackedFiles', true);
	}

	/**
	 * Get the value of the `git-graph.tabIconColourTheme` Extension Setting.
	 */
	get tabIconColourTheme() {
		return this.config.get<string>('tabIconColourTheme', 'colour') === 'grey'
			? TabIconColourTheme.Grey
			: TabIconColourTheme.Colour;
	}

	/**
	 * Get the value of the `git-graph.useMailmap` Extension Setting.
	 */
	get useMailmap() {
		return !!this.config.get('useMailmap', false);
	}

	/**
	 * Get the value of the `git.path` Visual Studio Code Setting.
	 */
	get gitPath() {
		return vscode.workspace.getConfiguration('git').get<string | null>('path', null);
	}
}

/**
 * Get a Config instance for retrieving the users configuration of Git Graph Extension Settings.
 */
export function getConfig() {
	return new Config();
}

/**
 * Recursively apply the values in a user specified object to an object containing default values.
 * @param base An object containing the default values.
 * @param user An object specified by the user.
 */
function mergeConfigObjects(base: { [key: string]: any }, user: { [key: string]: any }) {
	if (typeof base !== typeof user) return;

	let keys = Object.keys(base);
	for (let i = 0; i < keys.length; i++) {
		if (typeof base[keys[i]] === 'object') {
			if (typeof user[keys[i]] === 'object') {
				mergeConfigObjects(base[keys[i]], user[keys[i]]);
			}
		} else if (typeof user[keys[i]] === typeof base[keys[i]]) {
			base[keys[i]] = user[keys[i]];
		}
	}
}
