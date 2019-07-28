/* Git Interfaces / Types */

export interface GitBranchData {
	branches: string[];
	head: string | null;
	error: GitCommandError;
}

export interface GitCommitData {
	commits: GitCommitNode[];
	head: string | null;
	remotes: string[];
	moreCommitsAvailable: boolean;
	error: GitCommandError;
}

export interface GitCommitComparisonData {
	repoRoot: string;
	fileChanges: GitFileChange[];
	error: GitCommandError;
}

export interface GitTagDetailsData {
	tagHash: string;
	name: string;
	email: string;
	date: number;
	message: string;
	error: GitCommandError;
}

export interface GitRepoSettingsData {
	settings: GitRepoSettings | null;
	error: GitCommandError;
}

export interface GitRepoSettings {
	remotes: GitRepoSettingsRemote[];
}

export interface GitRepoSettingsRemote {
	name: string;
	url: string | null;
	pushUrl: string | null;
}

export interface GitCommitNode {
	hash: string;
	parentHashes: string[];
	author: string;
	email: string;
	date: number;
	message: string;
	heads: string[];
	tags: GitCommitTag[];
	remotes: GitCommitRemote[];
}

export interface GitCommitTag {
	name: string;
	annotated: boolean;
}

export interface GitCommitRemote {
	name: string;
	remote: string | null; // null => remote not found, otherwise => remote name
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
	repoRoot: string;
	fileChanges: GitFileChange[];
	error: GitCommandError;
}

export interface GitRef {
	hash: string;
	name: string;
}

export interface GitTagRef {
	hash: string;
	name: string;
	annotated: boolean;
}

export interface GitRefData {
	head: string | null;
	heads: GitRef[];
	tags: GitTagRef[];
	remotes: GitRef[];
}

export type GitRepoSet = { [repo: string]: GitRepoState };
export interface GitRepoState {
	columnWidths: ColumnWidth[] | null;
	showRemoteBranches: boolean;
}
export type ColumnWidth = number;

export interface GitUnsavedChanges {
	branch: string;
	changes: number;
}

export interface GitGraphViewState {
	autoCenterCommitDetailsView: boolean;
	combineLocalAndRemoteBranchLabels: boolean;
	commitDetailsViewLocation: CommitDetailsViewLocation;
	customBranchGlobPatterns: CustomBranchGlobPattern[];
	customEmojiShortcodeMappings: CustomEmojiShortcodeMapping[];
	dateFormat: DateFormat;
	defaultColumnVisibility: DefaultColumnVisibility;
	dialogDefaults: DialogDefaults;
	fetchAvatars: boolean;
	graphColours: string[];
	graphStyle: GraphStyle;
	initialLoadCommits: number;
	lastActiveRepo: string | null;
	loadMoreCommits: number;
	loadRepo: string | null;
	muteMergeCommits: boolean;
	refLabelAlignment: RefLabelAlignment;
	repos: GitRepoSet;
	showCurrentBranchByDefault: boolean;
}

export interface GitFileChange {
	oldFilePath: string;
	newFilePath: string;
	type: GitFileChangeType;
	additions: number | null;
	deletions: number | null;
}

export interface Avatar {
	image: string;
	timestamp: number;
	identicon: boolean;
}
export type AvatarCache = { [email: string]: Avatar };


/* Extension Settings Types */

export type CommitDetailsViewLocation = 'Inline' | 'Docked to Bottom';
export type CommitOrdering = 'date' | 'author-date' | 'topo';
export type DateFormat = 'Date & Time' | 'Date Only' | 'Relative';
export type DateType = 'Author Date' | 'Commit Date';
export type GraphStyle = 'rounded' | 'angular';
export type RefLabelAlignment = 'Normal' | 'Branches (on the left) & Tags (on the right)' | 'Branches (aligned to the graph) & Tags (on the right)';
export type TabIconColourTheme = 'colour' | 'grey';
export type GitCommandError = string | null; // null => no error, otherwise => error message
export type GitResetMode = 'soft' | 'mixed' | 'hard';
export type GitFileChangeType = 'A' | 'M' | 'D' | 'R' | 'U';
export type DiffSide = 'old' | 'new';
export type RebaseOnType = 'Branch' | 'Commit';

export interface CustomBranchGlobPattern {
	name: string;
	glob: string;
}
export interface CustomEmojiShortcodeMapping {
	shortcode: string;
	emoji: string;
}
export interface DefaultColumnVisibility {
	date: boolean;
	author: boolean;
	commit: boolean;
}
export interface DialogDefaults {
	addTag: {
		type: 'annotated' | 'lightweight'
	};
	createBranch: {
		checkout: boolean
	};
	rebase: {
		ignoreDate: boolean,
		interactive: boolean
	};
}


/* Request / Response Messages */

export interface RequestAddRemote {
	command: 'addRemote';
	repo: string;
	name: string;
	url: string;
	pushUrl: string | null;
	fetch: boolean;
}
export interface ResponseAddRemote {
	command: 'addRemote';
	error: GitCommandError;
}

export interface RequestAddTag {
	command: 'addTag';
	repo: string;
	commitHash: string;
	tagName: string;
	lightweight: boolean;
	message: string;
}
export interface ResponseAddTag {
	command: 'addTag';
	error: GitCommandError;
}

export interface RequestCheckoutBranch {
	command: 'checkoutBranch';
	repo: string;
	branchName: string;
	remoteBranch: string | null;
}
export interface ResponseCheckoutBranch {
	command: 'checkoutBranch';
	error: GitCommandError;
}

export interface RequestCheckoutCommit {
	command: 'checkoutCommit';
	repo: string;
	commitHash: string;
}
export interface ResponseCheckoutCommit {
	command: 'checkoutCommit';
	error: GitCommandError;
}

export interface RequestCherrypickCommit {
	command: 'cherrypickCommit';
	repo: string;
	commitHash: string;
	parentIndex: number;
}
export interface ResponseCherrypickCommit {
	command: 'cherrypickCommit';
	error: GitCommandError;
}

export interface RequestCleanUntrackedFiles {
	command: 'cleanUntrackedFiles';
	repo: string;
	directories: boolean;
}
export interface ResponseCleanUntrackedFiles {
	command: 'cleanUntrackedFiles';
	error: GitCommandError;
}

export interface RequestCommitDetails {
	command: 'commitDetails';
	repo: string;
	commitHash: string;
	refresh: boolean;
}
export interface ResponseCommitDetails {
	command: 'commitDetails';
	commitDetails: GitCommitDetails;
	refresh: boolean;
}

export interface RequestCompareCommits {
	command: 'compareCommits';
	repo: string;
	commitHash: string;
	compareWithHash: string;
	fromHash: string;
	toHash: string;
	refresh: boolean;
}
export interface ResponseCompareCommits {
	command: 'compareCommits';
	commitHash: string;
	compareWithHash: string;
	repoRoot: string;
	fileChanges: GitFileChange[];
	refresh: boolean;
	error: GitCommandError;
}

export interface RequestCopyFilePath {
	command: 'copyFilePath';
	repoRoot: string;
	filePath: string;
}
export interface ResponseCopyFilePath {
	command: 'copyFilePath';
	success: boolean;
}

export interface RequestCopyToClipboard {
	command: 'copyToClipboard';
	type: string;
	data: string;
}
export interface ResponseCopyToClipboard {
	command: 'copyToClipboard';
	type: string;
	success: boolean;
}

export interface RequestCreateBranch {
	command: 'createBranch';
	repo: string;
	commitHash: string;
	branchName: string;
	checkout: boolean;
}
export interface ResponseCreateBranch {
	command: 'createBranch';
	error: GitCommandError;
}

export interface RequestDeleteBranch {
	command: 'deleteBranch';
	repo: string;
	branchName: string;
	forceDelete: boolean;
}
export interface ResponseDeleteBranch {
	command: 'deleteBranch';
	error: GitCommandError;
}

export interface RequestDeleteRemote {
	command: 'deleteRemote';
	repo: string;
	name: string;
}
export interface ResponseDeleteRemote {
	command: 'deleteRemote';
	error: GitCommandError;
}

export interface RequestDeleteRemoteBranch {
	command: 'deleteRemoteBranch';
	repo: string;
	branchName: string;
	remote: string;
}
export interface ResponseDeleteRemoteBranch {
	command: 'deleteRemoteBranch';
	error: GitCommandError;
}

export interface RequestDeleteTag {
	command: 'deleteTag';
	repo: string;
	tagName: string;
	deleteOnRemote: string | null; // null => don't delete on remote, otherwise => remote to delete on
}
export interface ResponseDeleteTag {
	command: 'deleteTag';
	error: GitCommandError;
}

export interface RequestEditRemote {
	command: 'editRemote';
	repo: string;
	nameOld: string;
	nameNew: string;
	urlOld: string | null;
	urlNew: string | null;
	pushUrlOld: string | null;
	pushUrlNew: string | null;
}
export interface ResponseEditRemote {
	command: 'editRemote';
	error: GitCommandError;
}

export interface RequestFetch {
	command: 'fetch';
	repo: string;
}
export interface ResponseFetch {
	command: 'fetch';
	error: GitCommandError;
}

export interface RequestFetchAvatar {
	command: 'fetchAvatar';
	repo: string;
	remote: string | null;
	email: string;
	commits: string[];
}
export interface ResponseFetchAvatar {
	command: 'fetchAvatar';
	email: string;
	image: string;
}

export interface RequestGetSettings {
	command: 'getSettings';
	repo: string;
}
export interface ResponseGetSettings {
	command: 'getSettings';
	settings: GitRepoSettings | null;
	error: GitCommandError;
}

export interface RequestLoadBranches {
	command: 'loadBranches';
	repo: string;
	showRemoteBranches: boolean;
	hard: boolean;
}
export interface ResponseLoadBranches {
	command: 'loadBranches';
	branches: string[];
	head: string | null;
	hard: boolean;
	isRepo: boolean;
	error: GitCommandError;
}

export interface RequestLoadCommits {
	command: 'loadCommits';
	repo: string;
	branches: string[] | null; // null => Show All
	maxCommits: number;
	showRemoteBranches: boolean;
	hard: boolean;
}
export interface ResponseLoadCommits {
	command: 'loadCommits';
	commits: GitCommitNode[];
	head: string | null;
	remotes: string[];
	moreCommitsAvailable: boolean;
	hard: boolean;
	error: GitCommandError;
}

export interface RequestLoadRepos {
	command: 'loadRepos';
	check: boolean;
}
export interface ResponseLoadRepos {
	command: 'loadRepos';
	repos: GitRepoSet;
	lastActiveRepo: string | null;
	loadRepo: string | null;
}

export interface RequestMergeBranch {
	command: 'mergeBranch';
	repo: string;
	branchName: string;
	createNewCommit: boolean;
	squash: boolean;
}
export interface ResponseMergeBranch {
	command: 'mergeBranch';
	error: GitCommandError;
}

export interface RequestMergeCommit {
	command: 'mergeCommit';
	repo: string;
	commitHash: string;
	createNewCommit: boolean;
	squash: boolean;
}
export interface ResponseMergeCommit {
	command: 'mergeCommit';
	error: GitCommandError;
}

export interface RequestOpenFile {
	command: 'openFile';
	repoRoot: string;
	filePath: string;
}
export interface ResponseOpenFile {
	command: 'openFile';
	error: GitCommandError;
}

export interface RequestPullBranch {
	command: 'pullBranch';
	repo: string;
	branchName: string;
	remote: string;
	createNewCommit: boolean;
	squash: boolean;
}
export interface ResponsePullBranch {
	command: 'pullBranch';
	error: GitCommandError;
}

export interface RequestPushBranch {
	command: 'pushBranch';
	repo: string;
	branchName: string;
	remote: string;
	setUpstream: boolean;
}
export interface ResponsePushBranch {
	command: 'pushBranch';
	error: GitCommandError;
}

export interface RequestPushTag {
	command: 'pushTag';
	repo: string;
	tagName: string;
	remote: string;
}
export interface ResponsePushTag {
	command: 'pushTag';
	error: GitCommandError;
}

export interface RequestRebaseOn {
	command: 'rebaseOn';
	repo: string;
	type: RebaseOnType;
	base: string;
	ignoreDate: boolean;
	interactive: boolean;
}
export interface ResponseRebaseOn {
	command: 'rebaseOn';
	type: RebaseOnType;
	interactive: boolean;
	error: GitCommandError;
}

export interface ResponseRefresh {
	command: 'refresh';
}

export interface RequestRenameBranch {
	command: 'renameBranch';
	repo: string;
	oldName: string;
	newName: string;
}
export interface ResponseRenameBranch {
	command: 'renameBranch';
	error: GitCommandError;
}

export interface RequestRescanForRepos {
	command: 'rescanForRepos';
}

export interface RequestResetToCommit {
	command: 'resetToCommit';
	repo: string;
	commitHash: string;
	resetMode: GitResetMode;
}
export interface ResponseResetToCommit {
	command: 'resetToCommit';
	error: GitCommandError;
}

export interface RequestRevertCommit {
	command: 'revertCommit';
	repo: string;
	commitHash: string;
	parentIndex: number;
}
export interface ResponseRevertCommit {
	command: 'revertCommit';
	error: GitCommandError;
}

export interface RequestSaveRepoState {
	command: 'saveRepoState';
	repo: string;
	state: GitRepoState;
}

export interface RequestTagDetails {
	command: 'tagDetails';
	repo: string;
	tagName: string;
	commitHash: string;
}
export interface ResponseTagDetails {
	command: 'tagDetails';
	tagName: string;
	tagHash: string;
	commitHash: string;
	name: string;
	email: string;
	date: number;
	message: string;
	error: GitCommandError;
}

export interface RequestViewDiff {
	command: 'viewDiff';
	repo: string;
	repoRoot: string;
	fromHash: string;
	toHash: string;
	oldFilePath: string;
	newFilePath: string;
	type: GitFileChangeType;
}
export interface ResponseViewDiff {
	command: 'viewDiff';
	success: boolean;
}

export interface RequestViewScm {
	command: 'viewScm';
}
export interface ResponseViewScm {
	command: 'viewScm';
	success: boolean;
}

export type RequestMessage =
	RequestAddRemote
	| RequestAddTag
	| RequestCheckoutBranch
	| RequestCheckoutCommit
	| RequestCherrypickCommit
	| RequestCleanUntrackedFiles
	| RequestCommitDetails
	| RequestCompareCommits
	| RequestCopyFilePath
	| RequestCopyToClipboard
	| RequestCreateBranch
	| RequestDeleteBranch
	| RequestDeleteRemote
	| RequestDeleteRemoteBranch
	| RequestDeleteTag
	| RequestEditRemote
	| RequestFetch
	| RequestFetchAvatar
	| RequestGetSettings
	| RequestLoadBranches
	| RequestLoadCommits
	| RequestLoadRepos
	| RequestMergeBranch
	| RequestMergeCommit
	| RequestOpenFile
	| RequestPullBranch
	| RequestPushBranch
	| RequestPushTag
	| RequestRebaseOn
	| RequestRenameBranch
	| RequestRescanForRepos
	| RequestResetToCommit
	| RequestRevertCommit
	| RequestSaveRepoState
	| RequestTagDetails
	| RequestViewDiff
	| RequestViewScm;

export type ResponseMessage =
	ResponseAddRemote
	| ResponseAddTag
	| ResponseCheckoutBranch
	| ResponseCheckoutCommit
	| ResponseCherrypickCommit
	| ResponseCleanUntrackedFiles
	| ResponseCompareCommits
	| ResponseCommitDetails
	| ResponseCopyFilePath
	| ResponseCopyToClipboard
	| ResponseCreateBranch
	| ResponseDeleteBranch
	| ResponseDeleteRemote
	| ResponseDeleteRemoteBranch
	| ResponseDeleteTag
	| ResponseEditRemote
	| ResponseFetch
	| ResponseFetchAvatar
	| ResponseGetSettings
	| ResponseLoadBranches
	| ResponseLoadCommits
	| ResponseLoadRepos
	| ResponseMergeBranch
	| ResponseMergeCommit
	| ResponseOpenFile
	| ResponsePullBranch
	| ResponsePushBranch
	| ResponsePushTag
	| ResponseRebaseOn
	| ResponseRefresh
	| ResponseRenameBranch
	| ResponseResetToCommit
	| ResponseRevertCommit
	| ResponseTagDetails
	| ResponseViewDiff
	| ResponseViewScm;
