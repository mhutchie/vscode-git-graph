import * as GG from "../out/types"; // Import types from back-end (requires `npm run compile-src`)

declare global {

	/* Visual Studio Code API Types */

	function acquireVsCodeApi(): {
		getState(): WebViewState | null,
		postMessage(message: GG.RequestMessage): void,
		setState(state: WebViewState): void
	};


	/* State Types */

	var viewState: GG.GitGraphViewState;

	type AvatarImageCollection = { [email: string]: string };

	interface Config {
		autoCenterCommitDetailsView: boolean;
		branchLabelsAlignedToGraph: boolean;
		combineLocalAndRemoteBranchLabels: boolean;
		commitDetailsViewLocation: GG.CommitDetailsViewLocation;
		customBranchGlobPatterns: GG.CustomBranchGlobPattern[];
		defaultColumnVisibility: GG.DefaultColumnVisibility;
		dialogDefaults: GG.DialogDefaults;
		fetchAndPrune: boolean;
		fetchAvatars: boolean;
		graphColours: string[];
		graphStyle: GG.GraphStyle;
		grid: { x: number, y: number, offsetX: number, offsetY: number, expandY: number };
		initialLoadCommits: number;
		loadMoreCommits: number;
		muteMergeCommits: boolean;
		showCurrentBranchByDefault: boolean;
		tagLabelsOnRight: boolean;
	}

	interface ExpandedCommit {
		id: number;
		hash: string;
		srcElem: HTMLElement | null;
		commitDetails: GG.GitCommitDetails | null;
		fileChanges: GG.GitFileChange[] | null;
		fileTree: FileTreeFolder | null;
		compareWithHash: string | null;
		compareWithSrcElem: HTMLElement | null;
		loading: boolean;
		fileChangesScrollTop: number;
	}

	interface WebViewState {
		gitRepos: GG.GitRepoSet;
		gitBranches: string[];
		gitBranchHead: string | null;
		gitRemotes: string[];
		commits: GG.GitCommitNode[];
		commitHead: string | null;
		avatars: AvatarImageCollection;
		currentBranches: string[] | null;
		currentRepo: string;
		moreCommitsAvailable: boolean;
		maxCommits: number;
		expandedCommit: ExpandedCommit | null;
		scrollTop: number;
		findWidget: FindWidgetState;
		settingsWidget: SettingsWidgetState;
	}


	/* Context Menu Types */

	interface ContextMenuItem {
		title: string;
		onClick: () => void;
		checked?: boolean; // Required in checked context menus
	}

	type ContextMenuElement = ContextMenuItem | null;


	/* Dialog Types */

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
	type DialogType = 'form' | 'action-running' | 'message' | null;


	/* Commit Details / Comparison View File Tree Types */

	interface FileTreeFile {
		type: 'file';
		name: string;
		index: number;
	}

	interface FileTreeRepo {
		type: 'repo';
		name: string;
		path: string;
	}

	interface FileTreeFolder {
		type: 'folder';
		name: string;
		folderPath: string;
		contents: FileTreeFolderContents;
		open: boolean;
	}

	type FileTreeNode = FileTreeFolder | FileTreeFile | FileTreeRepo;
	type FileTreeFolderContents = { [name: string]: FileTreeNode };

}

export as namespace GG;
export = GG;
