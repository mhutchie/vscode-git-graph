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
	repos: string[];
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
	repo: string;
	commitHash: string;
	tagName: string;
}
export interface ResponseAddTag {
	command: 'addTag';
	status: GitCommandStatus;
}

export interface RequestCheckoutBranch {
	command: 'checkoutBranch';
	repo: string;
	branchName: string;
	remoteBranch: string | null;
}
export interface ResponseCheckoutBranch {
	command: 'checkoutBranch';
	status: GitCommandStatus;
}

export interface RequestCherrypickCommit {
	command: 'cherrypickCommit';
	repo: string;
	commitHash: string;
	parentIndex: number;
}
export interface ResponseCherrypickCommit {
	command: 'cherrypickCommit';
	status: GitCommandStatus;
}

export interface RequestCommitDetails {
	command: 'commitDetails';
	repo: string;
	commitHash: string;
}
export interface ResponseCommitDetails {
	command: 'commitDetails';
	commitDetails: GitCommitDetails | null;
}

export interface RequestCopyCommitHashToClipboard {
	command: 'copyCommitHashToClipboard';
	repo: string;
	commitHash: string;
}
export interface ResponseCopyCommitHashToClipboard {
	command: 'copyCommitHashToClipboard';
	success: boolean;
}

export interface RequestCreateBranch {
	command: 'createBranch';
	repo: string;
	commitHash: string;
	branchName: string;
}
export interface ResponseCreateBranch {
	command: 'createBranch';
	status: GitCommandStatus;
}

export interface RequestDeleteBranch {
	command: 'deleteBranch';
	repo: string;
	branchName: string;
	forceDelete: boolean;
}
export interface ResponseDeleteBranch {
	command: 'deleteBranch';
	status: GitCommandStatus;
}

export interface RequestDeleteTag {
	command: 'deleteTag';
	repo: string;
	tagName: string;
}
export interface ResponseDeleteTag {
	command: 'deleteTag';
	status: GitCommandStatus;
}

export interface RequestLoadBranches {
	command: 'loadBranches';
	repo: string;
	showRemoteBranches: boolean;
}
export interface ResponseLoadBranches {
	command: 'loadBranches';
	branches: string[];
	head: string | null;
}

export interface RequestLoadCommits {
	command: 'loadCommits';
	repo: string;
	branchName: string;
	maxCommits: number;
	showRemoteBranches: boolean;
}
export interface ResponseLoadCommits {
	command: 'loadCommits';
	commits: GitCommitNode[];
	moreCommitsAvailable: boolean;
}

export interface RequestLoadRepos {
	command: 'loadRepos';
}
export interface ResponseLoadRepos {
	command: 'loadRepos';
	repos: string[];
}

export interface RequestMergeBranch {
	command: 'mergeBranch';
	repo: string;
	branchName: string;
	createNewCommit: boolean;
}
export interface ResponseMergeBranch {
	command: 'mergeBranch';
	status: GitCommandStatus;
}

export interface RequestRenameBranch {
	command: 'renameBranch';
	repo: string;
	oldName: string;
	newName: string;
}
export interface ResponseRenameBranch {
	command: 'renameBranch';
	status: GitCommandStatus;
}

export interface RequestResetToCommit {
	command: 'resetToCommit';
	repo: string;
	commitHash: string;
	resetMode: GitResetMode;
}
export interface ResponseResetToCommit {
	command: 'resetToCommit';
	status: GitCommandStatus;
}

export interface RequestRevertCommit {
	command: 'revertCommit';
	repo: string;
	commitHash: string;
	parentIndex: number;
}
export interface ResponseRevertCommit {
	command: 'revertCommit';
	status: GitCommandStatus;
}

export interface RequestViewDiff {
	command: 'viewDiff';
	repo: string;
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
	| RequestLoadRepos
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
	| ResponseLoadRepos
	| ResponseMergeBranch
	| ResponseRenameBranch
	| ResponseResetToCommit
	| ResponseRevertCommit
	| ResponseViewDiff;
