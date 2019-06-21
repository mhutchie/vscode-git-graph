import * as vscode from 'vscode';
import { CommitDetailsViewLocation, CustomBranchGlobPattern, CustomEmojiShortcodeMapping, DateFormat, DateType, DefaultColumnVisibility, GraphStyle, RefLabelAlignment, TabIconColourTheme } from './types';

class Config {
	private workspaceConfiguration: vscode.WorkspaceConfiguration;

	constructor() {
		this.workspaceConfiguration = vscode.workspace.getConfiguration('git-graph');
	}

	public autoCenterCommitDetailsView() {
		return this.workspaceConfiguration.get('autoCenterCommitDetailsView', true);
	}

	public combineLocalAndRemoteBranchLabels() {
		return this.workspaceConfiguration.get('combineLocalAndRemoteBranchLabels', true);
	}

	public commitDetailsViewLocation(): CommitDetailsViewLocation {
		return this.workspaceConfiguration.get('commitDetailsViewLocation', 'Inline');
	}

	public customBranchGlobPatterns(): CustomBranchGlobPattern[] {
		let inPatterns = this.workspaceConfiguration.get('customBranchGlobPatterns', <any[]>[]);
		let outPatterns: CustomBranchGlobPattern[] = [];
		for (let i = 0; i < inPatterns.length; i++) {
			if (typeof inPatterns[i].name === 'string' && typeof inPatterns[i].glob === 'string') {
				outPatterns.push({ name: inPatterns[i].name, glob: '--glob=' + inPatterns[i].glob });
			}
		}
		return outPatterns;
	}

	public customEmojiShortcodeMappings(): CustomEmojiShortcodeMapping[] {
		let inMappings = this.workspaceConfiguration.get('customEmojiShortcodeMappings', <any[]>[]);
		let outMappings: CustomEmojiShortcodeMapping[] = [];
		for (let i = 0; i < inMappings.length; i++) {
			if (typeof inMappings[i].shortcode === 'string' && typeof inMappings[i].emoji === 'string') {
				outMappings.push({ shortcode: inMappings[i].shortcode, emoji: inMappings[i].emoji });
			}
		}
		return outMappings;
	}

	public dateFormat(): DateFormat {
		return this.workspaceConfiguration.get('dateFormat', 'Date & Time');
	}

	public dateType(): DateType {
		return this.workspaceConfiguration.get('dateType', 'Author Date');
	}

	public defaultColumnVisibility(): DefaultColumnVisibility {
		let obj: any = this.workspaceConfiguration.get('defaultColumnVisibility', {});
		if (typeof obj === 'object' && obj !== null && typeof obj['Date'] === 'boolean' && typeof obj['Author'] === 'boolean' && typeof obj['Commit'] === 'boolean') {
			return { author: obj['Author'], commit: obj['Commit'], date: obj['Date'] };
		} else {
			return { author: true, commit: true, date: true };
		}
	}

	public fetchAvatars() {
		return this.workspaceConfiguration.get('fetchAvatars', false);
	}

	public graphColours() {
		return this.workspaceConfiguration.get('graphColours', ['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000'])
			.filter((v) => v.match(/^\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgb[a]?\s*\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\))\s*$/) !== null);
	}

	public graphStyle(): GraphStyle {
		return this.workspaceConfiguration.get('graphStyle', 'rounded');
	}

	public initialLoadCommits() {
		return this.workspaceConfiguration.get('initialLoadCommits', 300);
	}

	public loadMoreCommits() {
		return this.workspaceConfiguration.get('loadMoreCommits', 75);
	}

	public maxDepthOfRepoSearch() {
		return this.workspaceConfiguration.get('maxDepthOfRepoSearch', 0);
	}

	public muteMergeCommits() {
		return this.workspaceConfiguration.get('muteMergeCommits', true);
	}

	public openDiffTabLocation() {
		return this.workspaceConfiguration.get('openDiffTabLocation', 'Active') === 'Active' ? vscode.ViewColumn.Active : vscode.ViewColumn.Beside;
	}

	public openToTheRepoOfTheActiveTextEditorDocument() {
		return this.workspaceConfiguration.get('openToTheRepoOfTheActiveTextEditorDocument', false);
	}

	public refLabelAlignment(): RefLabelAlignment {
		return this.workspaceConfiguration.get('referenceLabelAlignment', 'Normal');
	}

	public retainContextWhenHidden(): boolean {
		return this.workspaceConfiguration.get('retainContextWhenHidden', false);
	}

	public showCurrentBranchByDefault() {
		return this.workspaceConfiguration.get('showCurrentBranchByDefault', false);
	}

	public showStatusBarItem() {
		return this.workspaceConfiguration.get('showStatusBarItem', true);
	}

	public showUncommittedChanges() {
		return this.workspaceConfiguration.get('showUncommittedChanges', true);
	}

	public tabIconColourTheme(): TabIconColourTheme {
		return this.workspaceConfiguration.get('tabIconColourTheme', 'colour');
	}

	public gitPath(): string {
		let path = vscode.workspace.getConfiguration('git').get('path', null);
		return path !== null ? path : 'git';
	}
}

export function getConfig() {
	return new Config();
}