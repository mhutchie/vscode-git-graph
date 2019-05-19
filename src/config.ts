import * as vscode from 'vscode';
import { CommitDetailsViewLocation, DateFormat, DateType, GraphStyle, TabIconColourTheme } from './types';

class Config {
	private workspaceConfiguration: vscode.WorkspaceConfiguration;

	constructor() {
		this.workspaceConfiguration = vscode.workspace.getConfiguration('git-graph');
	}

	public autoCenterCommitDetailsView() {
		return this.workspaceConfiguration.get('autoCenterCommitDetailsView', true);
	}

	public commitDetailsViewLocation(): CommitDetailsViewLocation {
		return this.workspaceConfiguration.get('commitDetailsViewLocation', 'Inline');
	}

	public dateFormat(): DateFormat {
		return this.workspaceConfiguration.get('dateFormat', 'Date & Time');
	}

	public dateType(): DateType {
		return this.workspaceConfiguration.get('dateType', 'Author Date');
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