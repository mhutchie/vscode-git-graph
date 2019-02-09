/* Git Data Interfaces */

export interface GitCommitNode {
	hash: string;
	parents: number[];
	author: string;
	email: string;
	date: number;
	message: string;
	refs: GitRef[];
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

export interface RequestLoadCommitsMessage {
	command: 'loadCommits';
	data: {
		branch: string,
		maxCommits: number,
		showRemoteBranches: boolean
	};
}

export interface ResponseLoadBranchesMessage {
	command: 'loadBranches';
	data: string[];
}

export interface ResponseLoadCommitsMessage {
	command: 'loadCommits';
	data: {
		commits: GitCommitNode[],
		moreCommitsAvailable: boolean
	};
}


/* Types */

export type RequestMessage = RequestLoadBranchesMessage | RequestLoadCommitsMessage;
export type ResponseMessage = ResponseLoadBranchesMessage | ResponseLoadCommitsMessage;
export type DateFormat = 'Date & Time' | 'Date Only' | 'Relative';
export type GraphStyle = 'rounded' | 'angular';
