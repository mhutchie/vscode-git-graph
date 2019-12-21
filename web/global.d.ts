import * as GG from "../out/types"; // Import types from back-end (requires `npm run compile-src`)

declare global {

	/* Visual Studio Code API Types */

	function acquireVsCodeApi(): {
		getState(): WebViewState | null,
		postMessage(message: GG.RequestMessage): void,
		setState(state: WebViewState): void
	};


	/* State Types */

	type Config = GG.GitGraphViewConfig;

	var globalState: GG.GitGraphViewGlobalState;
	var initialState: GG.GitGraphViewInitialState;

	type AvatarImageCollection = { [email: string]: string };

	interface ExpandedCommit {
		id: number;
		hash: string;
		srcElem: HTMLElement | null;
		commitDetails: GG.GitCommitDetails | null;
		fileChanges: ReadonlyArray<GG.GitFileChange> | null;
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
		readonly currentRepo: string;
		readonly currentRepoLoading: boolean;
		readonly gitRepos: GG.GitRepoSet;
		readonly gitBranches: string[];
		readonly gitBranchHead: string | null;
		readonly gitRemotes: string[];
		readonly commits: GG.GitCommit[];
		readonly commitHead: string | null;
		readonly avatars: AvatarImageCollection;
		readonly currentBranches: string[] | null;
		readonly moreCommitsAvailable: boolean;
		readonly maxCommits: number;
		readonly expandedCommit: ExpandedCommit | null;
		readonly scrollTop: number;
		readonly findWidget: FindWidgetState;
		readonly settingsWidget: SettingsWidgetState;
	}


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

	type FileTreeLeaf = FileTreeFile | FileTreeRepo;
	type FileTreeNode = FileTreeFolder | FileTreeLeaf;
	type FileTreeFolderContents = { [name: string]: FileTreeNode };

}

export as namespace GG;
export = GG;
