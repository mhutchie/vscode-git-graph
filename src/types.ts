/* Git Interfaces / Types */

export interface GitCommitNode {
	hash: string;
	parentHashes: string[];
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

export interface GitCommitDetails {
	hash: string;
	parents: string[];
	author: string;
	email: string;
	date: number;
	committer: string;
	body: string;
	fileChanges: GitFileChange[];
}

export interface GitRef {
	hash: string;
	name: string;
	type: 'head' | 'tag' | 'remote';
}

export interface GitRefData {
	head: string | null;
	refs: GitRef[];
}

export interface GitUnsavedChanges {
	branch: string;
	changes: number;
}

export interface GitGraphViewSettings {
	autoCenterCommitDetailsView: boolean;
	dateFormat: DateFormat;
	graphColours: string[];
	graphStyle: GraphStyle;
	initialLoadCommits: number;
	loadMoreCommits: number;
}

export interface GitFileChange {
	oldFilePath: string;
	newFilePath: string;
	type: GitFileChangeType;
	additions: number | null;
	deletions: number | null;
}

export type DateFormat = 'Date & Time' | 'Date Only' | 'Relative';
export type GraphStyle = 'rounded' | 'angular';
export type GitCommandStatus = string | null;
export type GitResetMode = 'soft' | 'mixed' | 'hard';
export type GitFileChangeType = 'A' | 'M' | 'D' | 'R';


/* Request / Response Messages */

export interface RequestAddTag {
	command: 'addTag';
	commitHash: string;
	tagName: string;
}
export interface ResponseAddTag {
	command: 'addTag';
	status: GitCommandStatus;
}

export interface RequestCheckoutBranch {
	command: 'checkoutBranch';
	branchName: string;
	remoteBranch: string | null;
}
export interface ResponseCheckoutBranch {
	command: 'checkoutBranch';
	status: GitCommandStatus;
}

export interface RequestCherrypickCommit {
	command: 'cherrypickCommit';
	commitHash: string;
	parentIndex: number;
}
export interface ResponseCherrypickCommit {
	command: 'cherrypickCommit';
	status: GitCommandStatus;
}

export interface RequestCommitDetails {
	command: 'commitDetails';
	commitHash: string;
}
export interface ResponseCommitDetails {
	command: 'commitDetails';
	commitDetails: GitCommitDetails | null;
}

export interface RequestCopyCommitHashToClipboard {
	command: 'copyCommitHashToClipboard';
	commitHash: string;
}
export interface ResponseCopyCommitHashToClipboard {
	command: 'copyCommitHashToClipboard';
	success: boolean;
}

export interface RequestCreateBranch {
	command: 'createBranch';
	commitHash: string;
	branchName: string;
}
export interface ResponseCreateBranch {
	command: 'createBranch';
	status: GitCommandStatus;
}

export interface RequestDeleteBranch {
	command: 'deleteBranch';
	branchName: string;
	forceDelete: boolean;
}
export interface ResponseDeleteBranch {
	command: 'deleteBranch';
	status: GitCommandStatus;
}

export interface RequestDeleteTag {
	command: 'deleteTag';
	tagName: string;
}
export interface ResponseDeleteTag {
	command: 'deleteTag';
	status: GitCommandStatus;
}

export interface RequestLoadBranches {
	command: 'loadBranches';
	showRemoteBranches: boolean;
}
export interface ResponseLoadBranches {
	command: 'loadBranches';
	branches: string[];
}

export interface RequestLoadCommits {
	command: 'loadCommits';
	branchName: string;
	maxCommits: number;
	showRemoteBranches: boolean;
}
export interface ResponseLoadCommits {
	command: 'loadCommits';
	commits: GitCommitNode[];
	moreCommitsAvailable: boolean;
}

export interface RequestMergeBranch {
	command: 'mergeBranch';
	branchName: string;
}
export interface ResponseMergeBranch {
	command: 'mergeBranch';
	status: GitCommandStatus;
}

export interface RequestRenameBranch {
	command: 'renameBranch';
	oldName: string;
	newName: string;
}
export interface ResponseRenameBranch {
	command: 'renameBranch';
	status: GitCommandStatus;
}

export interface RequestResetToCommit {
	command: 'resetToCommit';
	commitHash: string;
	resetMode: GitResetMode;
}
export interface ResponseResetToCommit {
	command: 'resetToCommit';
	status: GitCommandStatus;
}

export interface RequestRevertCommit {
	command: 'revertCommit';
	commitHash: string;
	parentIndex: number;
}
export interface ResponseRevertCommit {
	command: 'revertCommit';
	status: GitCommandStatus;
}

export interface RequestViewDiff {
	command: 'viewDiff';
	commitHash: string;
	oldFilePath: string;
	newFilePath: string;
	type: GitFileChangeType;
}
export interface ResponseViewDiff {
	command: 'viewDiff';
	success: boolean;
}

export type RequestMessage = 
	  RequestAddTag
	| RequestCheckoutBranch
	| RequestCherrypickCommit
	| RequestCommitDetails
	| RequestCopyCommitHashToClipboard
	| RequestCreateBranch
	| RequestDeleteBranch
	| RequestDeleteTag
	| RequestLoadBranches
	| RequestLoadCommits
	| RequestMergeBranch
	| RequestRenameBranch
	| RequestResetToCommit
	| RequestRevertCommit
	| RequestViewDiff;

export type ResponseMessage = 
	  ResponseAddTag
	| ResponseCheckoutBranch
	| ResponseCherrypickCommit
	| ResponseCommitDetails
	| ResponseCopyCommitHashToClipboard
	| ResponseCreateBranch
	| ResponseDeleteBranch
	| ResponseDeleteTag
	| ResponseLoadBranches
	| ResponseLoadCommits
	| ResponseMergeBranch
	| ResponseRenameBranch
	| ResponseResetToCommit
	| ResponseRevertCommit
	| ResponseViewDiff;
