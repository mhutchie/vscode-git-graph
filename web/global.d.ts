import {
	GitCommandStatus as GitCommandStatusX,
	GitCommitDetails as GitCommitDetailsX,
	GitCommitNode as GitCommitNodeX,
	GitFileChange as GitFileChangeX,
	GitFileChangeType as GitFileChangeTypeX,
	GitGraphViewSettings as GitGraphViewSettingsX,
	GitResetMode as GitResetModeX,
	RequestMessage as RequestMessageX,
	ResponseMessage as ResponseMessageX
} from "../out/types";

declare global {
	/* Types from Backend */
	type GitCommandStatus = GitCommandStatusX;
	type GitCommitDetails = GitCommitDetailsX;
	type GitCommitNode = GitCommitNodeX;
	type GitFileChange = GitFileChangeX;
	type GitFileChangeType = GitFileChangeTypeX;
	type GitGraphViewSettings = GitGraphViewSettingsX;
	type GitResetMode = GitResetModeX;
	type RequestMessage = RequestMessageX;
	type ResponseMessage = ResponseMessageX;

	/* Globals defined in Webview HTML content */
	function acquireVsCodeApi(): any;
	var settings: GitGraphViewSettings;

	/* Graph Interfaces */
	interface Point {
		x: number;
		y: number;
	}
	interface Line {
		p1: Point;
		p2: Point;
		isCommitted: boolean;
	}
	interface Config {
		autoCenterCommitDetailsView: boolean;
		colours: string[];
		graphStyle: 'rounded' | 'angular';
		grid: { x: number, y: number, offsetX: number, offsetY: number };
		initialLoadCommits: number;
		loadMoreCommits: number;
	}
	interface ContextMenuItem {
		title: string;
		onClick: () => void;
	}
	interface ExpandedCommit {
		id: number;
		hash: string;
		srcElem: HTMLElement | null;
		commitDetails: GitCommitDetails | null;
		fileTree: GitFolder | null;
	}

	/* Git Interfaces / Types */
	interface GitFolder {
		type: 'folder';
		name: string;
		folderPath: string;
		contents: GitFolderContents;
		open: boolean;
	}
	interface GitFile {
		type: 'file';
		name: string;
		index: number;
	}
	type GitFolderOrFile = GitFolder | GitFile;
	type GitFolderContents = { [name: string]: GitFolderOrFile };

}