import * as GG from "../out/types"; // Import types from back-end (requires `npm run compile-src`)

declare global {

	/* Visual Studio Code API Types */

	function acquireVsCodeApi(): {
		getState(): WebViewState | null,
		postMessage(message: GG.RequestMessage): void,
		setState(state: WebViewState): void
	};


	/* State Types */

	type InitialState = GG.GitGraphViewInitialState;
	type Config = GG.GitGraphViewConfig;

	var initialState: InitialState;

	type AvatarImageCollection = { [email: string]: string };

	interface ExpandedCommit {
		id: number;
		hash: string;
		srcElem: HTMLElement | null;
		commitDetails: GG.GitCommitDetails | null;
		fileChanges: GG.GitFileChange[] | null;
		fileTree: FileTreeFolder | null;
		compareWithHash: string | null;
		compareWithSrcElem: HTMLElement | null;
		avatar: string | null;
		codeReview: GG.CodeReview | null;
		lastViewedFile: string | null;
		loading: boolean;
		fileChangesScrollTop: number;
	}

	interface WebViewState {
		readonly gitRepos: GG.GitRepoSet;
		readonly gitBranches: string[];
		readonly gitBranchHead: string | null;
		readonly gitRemotes: string[];
		readonly commits: GG.GitCommitNode[];
		readonly commitHead: string | null;
		readonly avatars: AvatarImageCollection;
		readonly currentBranches: string[] | null;
		readonly currentRepo: string;
		readonly moreCommitsAvailable: boolean;
		readonly maxCommits: number;
		readonly expandedCommit: ExpandedCommit | null;
		readonly scrollTop: number;
		readonly findWidget: FindWidgetState;
		readonly settingsWidget: SettingsWidgetState;
	}


	/* Context Menu Types */

	interface ContextMenuItem {
		readonly title: string;
		readonly onClick: () => void;
		readonly checked?: boolean; // Required in checked context menus
	}

	type ContextMenuElement = ContextMenuItem | null;


	/* Dialog Types */

	interface DialogTextInput {
		readonly type: 'text';
		readonly name: string;
		readonly default: string;
		readonly placeholder: string | null;
	}

	interface DialogTextRefInput {
		readonly type: 'text-ref';
		readonly name: string;
		readonly default: string;
	}

	interface DialogSelectInput {
		readonly type: 'select';
		readonly name: string;
		readonly options: { name: string, value: string }[];
		readonly default: string;
	}

	interface DialogCheckboxInput {
		readonly type: 'checkbox';
		readonly name: string;
		readonly value: boolean;
	}

	type DialogInput = DialogTextInput | DialogTextRefInput | DialogSelectInput | DialogCheckboxInput;
	type DialogInputValue = string | boolean;
	type DialogType = 'form' | 'action-running' | 'message' | null;


	/* Commit Details / Comparison View File Tree Types */

	interface FileTreeFile {
		readonly type: 'file';
		readonly name: string;
		readonly index: number;
		reviewed: boolean;
	}

	interface FileTreeRepo {
		readonly type: 'repo';
		readonly name: string;
		readonly path: string;
	}

	interface FileTreeFolder {
		readonly type: 'folder';
		readonly name: string;
		readonly folderPath: string;
		readonly contents: FileTreeFolderContents;
		open: boolean;
		reviewed: boolean;
	}

	type FileTreeNode = FileTreeFolder | FileTreeFile | FileTreeRepo;
	type FileTreeFolderContents = { [name: string]: FileTreeNode };

}

export as namespace GG;
export = GG;
