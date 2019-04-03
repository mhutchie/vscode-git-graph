import * as GG from "../out/types";

declare global {
	function acquireVsCodeApi(): {
		getState(): WebViewState | null,
		postMessage(message: GG.RequestMessage): void,
		setState(state: WebViewState): void
	};

	var viewState: GG.GitGraphViewState;

	interface Config {
		autoCenterCommitDetailsView: boolean;
		graphColours: string[];
		graphStyle: 'rounded' | 'angular';
		grid: { x: number, y: number, offsetX: number, offsetY: number, expandY: number };
		initialLoadCommits: number;
		loadMoreCommits: number;
		showCurrentBranchByDefault: boolean;
	}

	interface ContextMenuItem {
		title: string;
		onClick: () => void;
	}

	type ContextMenuElement = ContextMenuItem | null;

	interface DialogTextInput {
		type: 'text';
		name: string;
		default: string;
		placeholder: string | null;
	}
	interface DialogTextRefInput {
		type: 'text-ref';
		name: string;
		default: string;
	}
	interface DialogSelectInput {
		type: 'select';
		name: string;
		options: { name: string, value: string }[];
		default: string;
	}
	interface DialogCheckboxInput {
		type: 'checkbox';
		name: string;
		value: boolean;
	}
	type DialogInput = DialogTextInput | DialogTextRefInput | DialogSelectInput | DialogCheckboxInput;
	type DialogInputValue = string | boolean;

	interface ExpandedCommit {
		id: number;
		hash: string;
		srcElem: HTMLElement | null;
		commitDetails: GG.GitCommitDetails | null;
		fileTree: GitFolder | null;
	}

	interface GitFile {
		type: 'file';
		name: string;
		index: number;
	}

	interface GitFolder {
		type: 'folder';
		name: string;
		folderPath: string;
		contents: GitFolderContents;
		open: boolean;
	}

	type GitFolderOrFile = GitFolder | GitFile;
	type GitFolderContents = { [name: string]: GitFolderOrFile };

	interface Line {
		p1: Point;
		p2: Point;
		isCommitted: boolean;
	}

	interface Point {
		x: number;
		y: number;
	}

	interface WebViewState {
		gitRepos: string[];
		gitBranches: string[];
		gitHead: string | null;
		commits: GG.GitCommitNode[];
		currentBranch: string | null;
		currentRepo: string;
		moreCommitsAvailable: boolean;
		maxCommits: number;
		showRemoteBranches: boolean;
		expandedCommit: ExpandedCommit | null;
	}
}

export as namespace GG;
export = GG;
