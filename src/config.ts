import * as vscode from 'vscode';
import { CommitDetailsViewLocation, CommitOrdering, CustomBranchGlobPattern, CustomEmojiShortcodeMapping, DateFormat, DateType, DefaultColumnVisibility, DialogDefaults, GraphStyle, RefLabelAlignment, TabIconColourTheme } from './types';

class Config {
	private config: vscode.WorkspaceConfiguration;

	constructor() {
		this.config = vscode.workspace.getConfiguration('git-graph');
	}

	public autoCenterCommitDetailsView() {
		return this.config.get('autoCenterCommitDetailsView', true);
	}

	public combineLocalAndRemoteBranchLabels() {
		return this.config.get('combineLocalAndRemoteBranchLabels', true);
	}

	public commitDetailsViewLocation(): CommitDetailsViewLocation {
		return this.config.get('commitDetailsViewLocation', 'Inline');
	}

	public commitOrdering(): CommitOrdering {
		const ordering = this.config.get('commitOrdering', 'date');
		return ordering === 'date' || ordering === 'author-date' || ordering === 'topo' ? ordering : 'date';
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
		return this.config.get('dateFormat', 'Date & Time');
	}

	public dateType(): DateType {
		return this.config.get('dateType', 'Author Date');
	}

	public defaultColumnVisibility(): DefaultColumnVisibility {
		let obj: any = this.config.get('defaultColumnVisibility', {});
		if (typeof obj === 'object' && obj !== null && typeof obj['Date'] === 'boolean' && typeof obj['Author'] === 'boolean' && typeof obj['Commit'] === 'boolean') {
			return { author: obj['Author'], commit: obj['Commit'], date: obj['Date'] };
		} else {
			return { author: true, commit: true, date: true };
		}
	}

	public dialogDefaults(): DialogDefaults {
		return {
			addTag: {
				type: this.config.get<string>('dialog.addTag.type', 'Annotated') === 'Lightweight' ? 'lightweight' : 'annotated'
			},
			createBranch: {
				checkout: !!this.config.get('dialog.createBranch.checkOut', false)
			},
			merge: {
				noFastForward: !!this.config.get('dialog.merge.noFastForward', true),
				squash: !!this.config.get('dialog.merge.squashCommits', false)
			},
			rebase: {
				ignoreDate: !!this.config.get('dialog.rebase.ignoreDate', true),
				interactive: !!this.config.get('dialog.rebase.launchInteractiveRebase', false)
			}
		};
	}

	public fetchAndPrune() {
		return !!this.config.get('fetchAndPrune', false);
	}

	public fetchAvatars() {
		return this.config.get('fetchAvatars', false);
	}

	public fileEncoding(): string {
		return this.config.get('fileEncoding', 'utf8');
	}

	public graphColours() {
		return this.config.get('graphColours', ['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000'])
			.filter((v) => v.match(/^\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgb[a]?\s*\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\))\s*$/) !== null);
	}

	public graphStyle(): GraphStyle {
		return this.config.get('graphStyle', 'rounded');
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
		return this.config.get('muteMergeCommits', true);
	}

	public openDiffTabLocation() {
		return this.config.get('openDiffTabLocation', 'Active') === 'Active' ? vscode.ViewColumn.Active : vscode.ViewColumn.Beside;
	}

	public openToTheRepoOfTheActiveTextEditorDocument() {
		return this.config.get('openToTheRepoOfTheActiveTextEditorDocument', false);
	}

	public refLabelAlignment(): RefLabelAlignment {
		return this.config.get('referenceLabelAlignment', 'Normal');
	}

	public retainContextWhenHidden(): boolean {
		return this.config.get('retainContextWhenHidden', false);
	}

	public showCurrentBranchByDefault() {
		return this.config.get('showCurrentBranchByDefault', false);
	}

	public showStatusBarItem() {
		return this.config.get('showStatusBarItem', true);
	}

	public showUncommittedChanges() {
		return this.config.get('showUncommittedChanges', true);
	}

	public tabIconColourTheme(): TabIconColourTheme {
		return this.config.get('tabIconColourTheme', 'colour');
	}

	public useMailmap() {
		return this.config.get('useMailmap', false);
	}

	public gitPath(): string | null {
		return vscode.workspace.getConfiguration('git').get('path', null);
	}
}

export function getConfig() {
	return new Config();
}