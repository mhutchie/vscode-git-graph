/* Git Data Interfaces */

export interface GitCommitNode {
	hash: string;
	parents: number[];
	author: string;
	email: string;
	date: number;
	message: string;
	refs: GitRef[];
	current: boolean;
}

export interface GitCommit {
	hash: string;
	parentHashes: string[];
	author: string;
	email: string;
	date: number;
	message: string;
}

export interface GitRef {
	hash: string;
	name: string;
	type: 'head' | 'tag' | 'remote';
}

export interface GitUnsavedChanges {
	branch: string;
	changes: number;
}

export interface GitGraphViewSettings {
	graphColours: string[];
	graphStyle: GraphStyle;
	initialLoadCommits: number;
	loadMoreCommits: number;
	dateFormat: DateFormat;
}


/* Request / Response Message Interfaces */

export interface RequestLoadBranchesMessage {
	command: 'loadBranches';
	data: {
		showRemoteBranches: boolean
	};
}
export interface ResponseLoadBranchesMessage {
	command: 'loadBranches';
	data: string[];
}

export interface RequestLoadCommitsMessage {
	command: 'loadCommits';
	data: {
		branch: string,
		maxCommits: number,
		showRemoteBranches: boolean,
		currentBranch: string | null
	};
}
export interface ResponseLoadCommitsMessage {
	command: 'loadCommits';
	data: {
		commits: GitCommitNode[],
		moreCommitsAvailable: boolean
	};
}

export interface RequestAddTag {
	command: 'addTag';
	data: {
		commitHash: string,
		tagName: string
	};
}
export interface ResponseAddTag {
	command: 'addTag';
	data: GitCommandStatus;
}

export interface RequestDeleteTag {
	command: 'deleteTag';
	data: string;
}
export interface ResponseDeleteTag {
	command: 'deleteTag';
	data: GitCommandStatus;
}

export interface RequestCopyCommitHashToClipboard {
	command: 'copyCommitHashToClipboard';
	data: string;
}
export interface ResponseCopyCommitHashToClipboard {
	command: 'copyCommitHashToClipboard';
	data: boolean;
}

export interface RequestCreateBranch {
	command: 'createBranch';
	data: {
		commitHash: string,
		branchName: string
	};
}
export interface ResponseCreateBranch {
	command: 'createBranch';
	data: GitCommandStatus;
}

export interface RequestCheckoutBranch {
	command: 'checkoutBranch';
	data: {
		branchName: string,
		remoteBranch: string | null
	};
}
export interface ResponseCheckoutBranch {
	command: 'checkoutBranch';
	data: GitCommandStatus;
}

export interface RequestDeleteBranch {
	command: 'deleteBranch';
	data: {
		branchName: string,
		forceDelete: boolean
	};
}
export interface ResponseDeleteBranch {
	command: 'deleteBranch';
	data: GitCommandStatus;
}

export interface RequestRenameBranch {
	command: 'renameBranch';
	data: {
		oldName: string,
		newName: string
	};
}
export interface ResponseRenameBranch {
	command: 'renameBranch';
	data: GitCommandStatus;
}

export interface RequestResetToCommit {
	command: 'resetToCommit';
	data: {
		commitHash: string,
		resetMode: GitResetMode
	};
}
export interface ResponseResetToCommit {
	command: 'resetToCommit';
	data: GitCommandStatus;
}

/* Types */

export type RequestMessage = RequestLoadBranchesMessage
	| RequestLoadCommitsMessage
	| RequestAddTag
	| RequestDeleteTag
	| RequestCopyCommitHashToClipboard
	| RequestCreateBranch
	| RequestCheckoutBranch
	| RequestDeleteBranch
	| RequestRenameBranch
	| RequestResetToCommit;
export type ResponseMessage = ResponseLoadBranchesMessage
	| ResponseLoadCommitsMessage
	| ResponseAddTag
	| ResponseDeleteTag
	| ResponseCopyCommitHashToClipboard
	| ResponseCreateBranch
	| ResponseCheckoutBranch
	| ResponseDeleteBranch
	| ResponseRenameBranch
	| ResponseResetToCommit;
export type DateFormat = 'Date & Time' | 'Date Only' | 'Relative';
export type GraphStyle = 'rounded' | 'angular';
export type GitCommandStatus = string | null;
export type GitResetMode = 'soft' | 'mixed' | 'hard';
