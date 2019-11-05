import * as vscode from 'vscode';
import {
	CommitDetailsViewLocation,
	CommitOrdering,
	ContextMenuActionsVisibility,
	CustomBranchGlobPattern,
	CustomEmojiShortcodeMapping,
	DateFormat,
	DateFormatType,
	DateType,
	DefaultColumnVisibility,
	DialogDefaults,
	FileViewType,
	GraphStyle,
	RefLabelAlignment,
	TabIconColourTheme
} from './types';


class Config {
	private readonly config: vscode.WorkspaceConfiguration;

	constructor() {
		this.config = vscode.workspace.getConfiguration('git-graph');
	}

	public autoCenterCommitDetailsView() {
		return !!this.config.get('autoCenterCommitDetailsView', true);
	}

	public combineLocalAndRemoteBranchLabels() {
		return !!this.config.get('combineLocalAndRemoteBranchLabels', true);
	}

	public commitDetailsViewLocation() {
		return this.config.get<string>('commitDetailsViewLocation', 'Inline') === 'Docked to Bottom'
			? CommitDetailsViewLocation.DockedToBottom
			: CommitDetailsViewLocation.Inline;
	}

	public commitOrdering() {
		const ordering = this.config.get<string>('commitOrdering', 'date');
		return ordering === 'author-date'
			? CommitOrdering.AuthorDate
			: ordering === 'topo'
				? CommitOrdering.Topological
				: CommitOrdering.Date;
	}

	public contextMenuActionsVisibility(): ContextMenuActionsVisibility {
		let userConfig = this.config.get('contextMenuActionsVisibility', {});
		let config = {
			branch: { checkout: true, rename: true, delete: true, merge: true, rebase: true, push: true, copyName: true },
			commit: { addTag: true, createBranch: true, checkout: true, cherrypick: true, revert: true, drop: true, merge: true, rebase: true, reset: true, copyHash: true },
			remoteBranch: { checkout: true, delete: true, fetch: true, pull: true, copyName: true },
			stash: { apply: true, createBranch: true, pop: true, drop: true, copyName: true, copyHash: true },
			tag: { viewDetails: true, delete: true, push: true, copyName: true },
			uncommittedChanges: { stash: true, reset: true, clean: true, openSourceControlView: true }
		};
		mergeConfigObjects(config, userConfig);
		return config;
	}

	public customBranchGlobPatterns(): CustomBranchGlobPattern[] {
		let inPatterns = this.config.get('customBranchGlobPatterns', <any[]>[]);
		let outPatterns: CustomBranchGlobPattern[] = [];
		for (let i = 0; i < inPatterns.length; i++) {
			if (typeof inPatterns[i].name === 'string' && typeof inPatterns[i].glob === 'string') {
				outPatterns.push({ name: inPatterns[i].name, glob: '--glob=' + inPatterns[i].glob });
			}
		}
		return outPatterns;
	}

	public customEmojiShortcodeMappings(): CustomEmojiShortcodeMapping[] {
		let inMappings = this.config.get('customEmojiShortcodeMappings', <any[]>[]);
		let outMappings: CustomEmojiShortcodeMapping[] = [];
		for (let i = 0; i < inMappings.length; i++) {
			if (typeof inMappings[i].shortcode === 'string' && typeof inMappings[i].emoji === 'string') {
				outMappings.push({ shortcode: inMappings[i].shortcode, emoji: inMappings[i].emoji });
			}
		}
		return outMappings;
	}

	public dateFormat(): DateFormat {
		let configValue = this.config.get<string>('dateFormat', 'Date & Time'), type = DateFormatType.DateAndTime, iso = false;
		if (configValue === 'Relative') {
			type = DateFormatType.Relative;
		} else {
			if (configValue.endsWith('Date Only')) type = DateFormatType.DateOnly;
			if (configValue.startsWith('ISO')) iso = true;
		}
		return { type: type, iso: iso };
	}

	public dateType() {
		return this.config.get<string>('dateType', 'Author Date') === 'Commit Date'
			? DateType.Commit
			: DateType.Author;
	}

	public defaultColumnVisibility(): DefaultColumnVisibility {
		let obj: any = this.config.get('defaultColumnVisibility', {});
		if (typeof obj === 'object' && obj !== null && typeof obj['Date'] === 'boolean' && typeof obj['Author'] === 'boolean' && typeof obj['Commit'] === 'boolean') {
			return { author: obj['Author'], commit: obj['Commit'], date: obj['Date'] };
		} else {
			return { author: true, commit: true, date: true };
		}
	}

	public defaultFileViewType(): FileViewType {
		return this.config.get<string>('defaultFileViewType', 'File Tree') === 'File List'
			? FileViewType.List
			: FileViewType.Tree;
	}

	public dialogDefaults(): DialogDefaults {
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
			createBranch: {
				checkout: !!this.config.get('dialog.createBranch.checkOut', false)
			},
			merge: {
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
				mode: resetCommitMode === 'Soft' ? 'soft' : (resetCommitMode === 'Hard' ? 'hard' : 'mixed')
			},
			resetUncommitted: {
				mode: resetUncommittedMode === 'Hard' ? 'hard' : 'mixed'
			},
			stashUncommittedChanges: {
				includeUntracked: !!this.config.get('dialog.stashUncommittedChanges.includeUntracked', true)
			}
		};
	}

	public fetchAndPrune() {
		return !!this.config.get('fetchAndPrune', false);
	}

	public fetchAvatars() {
		return !!this.config.get('fetchAvatars', false);
	}

	public fileEncoding(): string {
		return this.config.get('fileEncoding', 'utf8');
	}

	public graphColours() {
		return this.config.get('graphColours', ['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000'])
			.filter((v) => v.match(/^\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgb[a]?\s*\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\))\s*$/) !== null);
	}

	public graphStyle() {
		return this.config.get<string>('graphStyle', 'rounded') === 'angular'
			? GraphStyle.Angular
			: GraphStyle.Rounded;
	}

	public initialLoadCommits() {
		return this.config.get('initialLoadCommits', 300);
	}

	public integratedTerminalShell() {
		return this.config.get('integratedTerminalShell', '');
	}

	public loadMoreCommits() {
		return this.config.get('loadMoreCommits', 75);
	}

	public maxDepthOfRepoSearch() {
		return this.config.get('maxDepthOfRepoSearch', 0);
	}

	public muteMergeCommits() {
		return !!this.config.get('muteMergeCommits', true);
	}

	public openDiffTabLocation() {
		return this.config.get('openDiffTabLocation', 'Active') === 'Active' ? vscode.ViewColumn.Active : vscode.ViewColumn.Beside;
	}

	public openToTheRepoOfTheActiveTextEditorDocument() {
		return this.config.get('openToTheRepoOfTheActiveTextEditorDocument', false);
	}

	public refLabelAlignment() {
		let configValue = this.config.get<string>('referenceLabelAlignment', 'Normal');
		return configValue === 'Branches (on the left) & Tags (on the right)'
			? RefLabelAlignment.BranchesOnLeftAndTagsOnRight
			: configValue === 'Branches (aligned to the graph) & Tags (on the right)'
				? RefLabelAlignment.BranchesAlignedToGraphAndTagsOnRight
				: RefLabelAlignment.Normal;
	}

	public retainContextWhenHidden() {
		return !!this.config.get('retainContextWhenHidden', true);
	}

	public showCommitsOnlyReferencedByTags() {
		return !!this.config.get('showCommitsOnlyReferencedByTags', true);
	}

	public showCurrentBranchByDefault() {
		return !!this.config.get('showCurrentBranchByDefault', false);
	}

	public showStatusBarItem() {
		return !!this.config.get('showStatusBarItem', true);
	}

	public showUncommittedChanges() {
		return !!this.config.get('showUncommittedChanges', true);
	}

	public tabIconColourTheme() {
		return this.config.get<string>('tabIconColourTheme', 'colour') === 'grey'
			? TabIconColourTheme.Grey
			: TabIconColourTheme.Colour;
	}

	public useMailmap() {
		return !!this.config.get('useMailmap', false);
	}

	public gitPath(): string | null {
		return vscode.workspace.getConfiguration('git').get('path', null);
	}
}

export function getConfig() {
	return new Config();
}

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
