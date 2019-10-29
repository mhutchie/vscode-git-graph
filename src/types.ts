/* Git Interfaces / Types */

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
	parents: string[];
	author: string;
	email: string;
	date: number;
	message: string;
	heads: string[];
	tags: GitCommitTag[];
	remotes: GitCommitRemote[];
	stash: string | null; // null => not a stash, otherwise => stash selector
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
	parents: string[];
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
	error: ErrorInfo;
}

export interface GitRef {
	hash: string;
	name: string;
}

export interface GitStash {
	hash: string;
	base: string;
	selector: string;
	author: string;
	email: string;
	date: number;
	message: string;
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
	cdvDivider: number;
	cdvHeight: number;
	fileViewType: FileViewType;
	showRemoteBranches: boolean;
	hideRemotes: string[];
}
export type ColumnWidth = number;

export interface GitUnsavedChanges {
	branch: string;
	changes: number;
}

export interface GitFileChange {
	oldFilePath: string;
	newFilePath: string;
	type: GitFileChangeType;
	additions: number | null;
	deletions: number | null;
}

export interface CodeReview {
	id: string;
	lastActive: number;
	lastViewedFile: string | null;
	remainingFiles: string[];
}

export interface Avatar {
	image: string;
	timestamp: number;
	identicon: boolean;
}
export type AvatarCache = { [email: string]: Avatar };

export type BranchOrCommit = 'Branch' | 'Commit';
export type GitResetMode = 'soft' | 'mixed' | 'hard';
export type GitFileChangeType = 'A' | 'M' | 'D' | 'R' | 'U';


/* Git Graph View Interfaces */

export interface GitGraphViewInitialState {
	readonly config: GitGraphViewConfig;
	readonly lastActiveRepo: string | null;
	readonly loadRepo: string | null;
	readonly repos: GitRepoSet;
}

export interface GitGraphViewConfig {
	readonly autoCenterCommitDetailsView: boolean;
	readonly branchLabelsAlignedToGraph: boolean;
	readonly combineLocalAndRemoteBranchLabels: boolean;
	readonly commitDetailsViewLocation: CommitDetailsViewLocation;
	readonly contextMenuActionsVisibility: ContextMenuActionsVisibility;
	readonly customBranchGlobPatterns: CustomBranchGlobPattern[];
	readonly customEmojiShortcodeMappings: CustomEmojiShortcodeMapping[];
	readonly dateFormat: DateFormat;
	readonly defaultColumnVisibility: DefaultColumnVisibility;
	readonly defaultFileViewType: FileViewType;
	readonly dialogDefaults: DialogDefaults;
	readonly fetchAndPrune: boolean;
	readonly fetchAvatars: boolean;
	readonly graphColours: string[];
	readonly graphStyle: GraphStyle;
	readonly grid: { x: number, y: number, offsetX: number, offsetY: number, expandY: number };
	readonly initialLoadCommits: number;
	readonly loadMoreCommits: number;
	readonly muteMergeCommits: boolean;
	readonly showCurrentBranchByDefault: boolean;
	readonly tagLabelsOnRight: boolean;
}


/* Extension Settings Types */

export const enum CommitDetailsViewLocation {
	Inline,
	DockedToBottom
}

export const enum CommitOrdering {
	Date = 'date',
	AuthorDate = 'author-date',
	Topological = 'topo'
}

export interface ContextMenuActionsVisibility {
	readonly branch: {
		readonly checkout: boolean;
		readonly rename: boolean;
		readonly delete: boolean;
		readonly merge: boolean;
		readonly rebase: boolean;
		readonly push: boolean;
		readonly copyName: boolean;
	};
	readonly commit: {
		readonly addTag: boolean;
		readonly createBranch: boolean;
		readonly checkout: boolean;
		readonly cherrypick: boolean;
		readonly revert: boolean;
		readonly drop: boolean;
		readonly merge: boolean;
		readonly rebase: boolean;
		readonly reset: boolean;
		readonly copyHash: boolean;
	};
	readonly remoteBranch: {
		readonly checkout: boolean;
		readonly delete: boolean;
		readonly fetch: boolean;
		readonly pull: boolean;
		readonly copyName: boolean;
	};
	readonly stash: {
		readonly apply: boolean;
		readonly createBranch: boolean;
		readonly pop: boolean;
		readonly drop: boolean;
		readonly copyName: boolean;
		readonly copyHash: boolean;
	};
	readonly tag: {
		readonly viewDetails: boolean;
		readonly delete: boolean;
		readonly push: boolean;
		readonly copyName: boolean;
	};
	readonly uncommittedChanges: {
		readonly stash: boolean;
		readonly reset: boolean;
		readonly clean: boolean;
		readonly openSourceControlView: boolean;
	};
}

export interface CustomBranchGlobPattern {
	readonly name: string;
	readonly glob: string;
}

export interface CustomEmojiShortcodeMapping {
	readonly shortcode: string;
	readonly emoji: string;
}

export interface DateFormat {
	readonly type: DateFormatType;
	readonly iso: boolean;
}

export const enum DateFormatType {
	DateAndTime,
	DateOnly,
	Relative
}

export const enum DateType {
	Author,
	Commit
}

export interface DefaultColumnVisibility {
	readonly date: boolean;
	readonly author: boolean;
	readonly commit: boolean;
}

export interface DialogDefaults {
	readonly addTag: {
		readonly pushToRemote: boolean,
		readonly type: 'annotated' | 'lightweight'
	};
	readonly createBranch: {
		readonly checkout: boolean
	};
	readonly merge: {
		readonly noFastForward: boolean,
		readonly squash: boolean
	};
	readonly rebase: {
		readonly ignoreDate: boolean,
		readonly interactive: boolean
	};
	readonly resetCommit: {
		readonly mode: 'soft' | 'mixed' | 'hard'
	};
	readonly resetUncommitted: {
		readonly mode: 'mixed' | 'hard'
	};
	readonly stashUncommittedChanges: {
		readonly includeUntracked: boolean
	};
}

export const enum FileViewType {
	Default,
	Tree,
	List
}

export const enum GraphStyle {
	Rounded,
	Angular
}

export const enum RefLabelAlignment {
	Normal,
	BranchesOnLeftAndTagsOnRight,
	BranchesAlignedToGraphAndTagsOnRight
}

export const enum TabIconColourTheme {
	Colour,
	Grey
}


/* Base Interfaces for Request / Response Messages */

export interface BaseMessage {
	readonly command: string;
}

export interface RepoRequest extends BaseMessage {
	readonly repo: string;
}

export interface ResponseWithErrorInfo extends BaseMessage {
	readonly error: ErrorInfo;
}

export interface ResponseWithMultiErrorInfo extends BaseMessage {
	readonly errors: ErrorInfo[];
}

export type ErrorInfo = string | null; // null => no error, otherwise => error message


/* Request / Response Messages */

export interface RequestAddRemote extends RepoRequest {
	readonly command: 'addRemote';
	readonly name: string;
	readonly url: string;
	readonly pushUrl: string | null;
	readonly fetch: boolean;
}
export interface ResponseAddRemote extends ResponseWithErrorInfo {
	readonly command: 'addRemote';
}

export interface RequestAddTag extends RepoRequest {
	readonly command: 'addTag';
	readonly commitHash: string;
	readonly tagName: string;
	readonly lightweight: boolean;
	readonly message: string;
	readonly pushToRemote: string | null; // string => name of the remote to push the tag to, null => don't push to a remote
}
export interface ResponseAddTag extends ResponseWithMultiErrorInfo {
	readonly command: 'addTag';
}

export interface RequestApplyStash extends RepoRequest {
	readonly command: 'applyStash';
	readonly selector: string;
}
export interface ResponseApplyStash extends ResponseWithErrorInfo {
	readonly command: 'applyStash';
}

export interface RequestBranchFromStash extends RepoRequest {
	readonly command: 'branchFromStash';
	readonly selector: string;
	readonly branchName: string;
}
export interface ResponseBranchFromStash extends ResponseWithErrorInfo {
	readonly command: 'branchFromStash';
}

export interface RequestCheckoutBranch extends RepoRequest {
	readonly command: 'checkoutBranch';
	readonly branchName: string;
	readonly remoteBranch: string | null;
}
export interface ResponseCheckoutBranch extends ResponseWithErrorInfo {
	readonly command: 'checkoutBranch';
}

export interface RequestCheckoutCommit extends RepoRequest {
	readonly command: 'checkoutCommit';
	readonly commitHash: string;
}
export interface ResponseCheckoutCommit extends ResponseWithErrorInfo {
	readonly command: 'checkoutCommit';
}

export interface RequestCherrypickCommit extends RepoRequest {
	readonly command: 'cherrypickCommit';
	readonly commitHash: string;
	readonly parentIndex: number;
	readonly noCommit: boolean;
}
export interface ResponseCherrypickCommit extends ResponseWithMultiErrorInfo {
	readonly command: 'cherrypickCommit';
}

export interface RequestCleanUntrackedFiles extends RepoRequest {
	readonly command: 'cleanUntrackedFiles';
	readonly directories: boolean;
}
export interface ResponseCleanUntrackedFiles extends ResponseWithErrorInfo {
	readonly command: 'cleanUntrackedFiles';
}

export interface RequestCodeReviewFileReviewed extends RepoRequest {
	readonly command: 'codeReviewFileReviewed';
	readonly id: string;
	readonly filePath: string;
}

export interface RequestCommitDetails extends RepoRequest {
	readonly command: 'commitDetails';
	readonly commitHash: string;
	readonly baseHash: string | null; // string => diff between baseHash and commitHash (used by stashes), null => diff of commitHash
	readonly avatarEmail: string | null; // string => fetch avatar with the given email, null => don't fetch avatar
	readonly refresh: boolean;
}
export interface ResponseCommitDetails extends BaseMessage {
	readonly command: 'commitDetails';
	readonly commitDetails: GitCommitDetails;
	readonly avatar: string | null;
	readonly codeReview: CodeReview | null;
	readonly refresh: boolean;
}

export interface RequestCompareCommits extends RepoRequest {
	readonly command: 'compareCommits';
	readonly commitHash: string;
	readonly compareWithHash: string;
	readonly fromHash: string;
	readonly toHash: string;
	readonly refresh: boolean;
}
export interface ResponseCompareCommits extends ResponseWithErrorInfo {
	readonly command: 'compareCommits';
	readonly commitHash: string;
	readonly compareWithHash: string;
	readonly fileChanges: GitFileChange[];
	readonly codeReview: CodeReview | null;
	readonly refresh: boolean;
}

export interface RequestCopyFilePath extends RepoRequest {
	readonly command: 'copyFilePath';
	readonly filePath: string;
}
export interface ResponseCopyFilePath extends ResponseWithErrorInfo {
	readonly command: 'copyFilePath';
}

export interface RequestCopyToClipboard extends BaseMessage {
	readonly command: 'copyToClipboard';
	readonly type: string;
	readonly data: string;
}
export interface ResponseCopyToClipboard extends ResponseWithErrorInfo {
	readonly command: 'copyToClipboard';
	readonly type: string;
}

export interface RequestCreateBranch extends RepoRequest {
	readonly command: 'createBranch';
	readonly commitHash: string;
	readonly branchName: string;
	readonly checkout: boolean;
}
export interface ResponseCreateBranch extends ResponseWithErrorInfo {
	readonly command: 'createBranch';
}

export interface RequestDeleteBranch extends RepoRequest {
	readonly command: 'deleteBranch';
	readonly branchName: string;
	readonly forceDelete: boolean;
	readonly deleteOnRemotes: string[];
}
export interface ResponseDeleteBranch extends ResponseWithMultiErrorInfo {
	readonly command: 'deleteBranch';
}

export interface RequestDeleteRemote extends RepoRequest {
	readonly command: 'deleteRemote';
	readonly name: string;
}
export interface ResponseDeleteRemote extends ResponseWithErrorInfo {
	readonly command: 'deleteRemote';
}

export interface RequestDeleteRemoteBranch extends RepoRequest {
	readonly command: 'deleteRemoteBranch';
	readonly branchName: string;
	readonly remote: string;
}
export interface ResponseDeleteRemoteBranch extends ResponseWithErrorInfo {
	readonly command: 'deleteRemoteBranch';
}

export interface RequestDeleteTag extends RepoRequest {
	readonly command: 'deleteTag';
	readonly tagName: string;
	readonly deleteOnRemote: string | null; // null => don't delete on remote, otherwise => remote to delete on
}
export interface ResponseDeleteTag extends ResponseWithErrorInfo {
	readonly command: 'deleteTag';
}

export interface RequestDropCommit extends RepoRequest {
	readonly command: 'dropCommit';
	readonly commitHash: string;
}
export interface ResponseDropCommit extends ResponseWithErrorInfo {
	readonly command: 'dropCommit';
}

export interface RequestDropStash extends RepoRequest {
	readonly command: 'dropStash';
	readonly selector: string;
}
export interface ResponseDropStash extends ResponseWithErrorInfo {
	readonly command: 'dropStash';
}

export interface RequestEditRemote extends RepoRequest {
	readonly command: 'editRemote';
	readonly nameOld: string;
	readonly nameNew: string;
	readonly urlOld: string | null;
	readonly urlNew: string | null;
	readonly pushUrlOld: string | null;
	readonly pushUrlNew: string | null;
}
export interface ResponseEditRemote extends ResponseWithErrorInfo {
	readonly command: 'editRemote';
}

export interface RequestEndCodeReview extends RepoRequest {
	readonly command: 'endCodeReview';
	readonly id: string;
}

export interface RequestFetch extends RepoRequest {
	readonly command: 'fetch';
	readonly name: string | null; // null => Fetch all remotes
	readonly prune: boolean;
}
export interface ResponseFetch extends ResponseWithErrorInfo {
	readonly command: 'fetch';
}

export interface RequestFetchAvatar extends RepoRequest {
	readonly command: 'fetchAvatar';
	readonly remote: string | null;
	readonly email: string;
	readonly commits: string[];
}
export interface ResponseFetchAvatar extends BaseMessage {
	readonly command: 'fetchAvatar';
	readonly email: string;
	readonly image: string;
}

export interface RequestFetchIntoLocalBranch extends RepoRequest {
	readonly command: 'fetchIntoLocalBranch';
	readonly remote: string;
	readonly remoteBranch: string;
	readonly localBranch: string;
}
export interface ResponseFetchIntoLocalBranch extends ResponseWithErrorInfo {
	readonly command: 'fetchIntoLocalBranch';
}

export interface RequestGetSettings extends RepoRequest {
	readonly command: 'getSettings';
}
export interface ResponseGetSettings extends ResponseWithErrorInfo {
	readonly command: 'getSettings';
	readonly settings: GitRepoSettings | null;
}

export interface RequestLoadRepoInfo extends RepoRequest {
	readonly command: 'loadRepoInfo';
	readonly showRemoteBranches: boolean;
	readonly hideRemotes: string[];
	readonly hard: boolean;
}
export interface ResponseLoadRepoInfo extends ResponseWithErrorInfo {
	readonly command: 'loadRepoInfo';
	readonly branches: string[];
	readonly head: string | null;
	readonly remotes: string[];
	readonly hard: boolean;
	readonly isRepo: boolean;
}

export interface RequestLoadCommits extends RepoRequest {
	readonly command: 'loadCommits';
	readonly branches: string[] | null; // null => Show All
	readonly maxCommits: number;
	readonly showRemoteBranches: boolean;
	readonly remotes: string[];
	readonly hideRemotes: string[];
	readonly hard: boolean;
}
export interface ResponseLoadCommits extends ResponseWithErrorInfo {
	readonly command: 'loadCommits';
	readonly commits: GitCommitNode[];
	readonly head: string | null;
	readonly moreCommitsAvailable: boolean;
	readonly hard: boolean;
}

export interface RequestLoadRepos extends BaseMessage {
	readonly command: 'loadRepos';
	readonly check: boolean;
}
export interface ResponseLoadRepos extends BaseMessage {
	readonly command: 'loadRepos';
	readonly repos: GitRepoSet;
	readonly lastActiveRepo: string | null;
	readonly loadRepo: string | null;
}

export interface RequestMerge extends RepoRequest {
	readonly command: 'merge';
	readonly obj: string;
	readonly type: BranchOrCommit;
	readonly createNewCommit: boolean;
	readonly squash: boolean;
}
export interface ResponseMerge extends ResponseWithErrorInfo {
	readonly command: 'merge';
	readonly type: BranchOrCommit;
}

export interface RequestOpenFile extends RepoRequest {
	readonly command: 'openFile';
	readonly filePath: string;
}
export interface ResponseOpenFile extends ResponseWithErrorInfo {
	readonly command: 'openFile';
}

export interface RequestPopStash extends RepoRequest {
	readonly command: 'popStash';
	readonly selector: string;
}
export interface ResponsePopStash extends ResponseWithErrorInfo {
	readonly command: 'popStash';
}

export interface RequestPruneRemote extends RepoRequest {
	readonly command: 'pruneRemote';
	readonly name: string;
}
export interface ResponsePruneRemote extends ResponseWithErrorInfo {
	readonly command: 'pruneRemote';
}

export interface RequestPullBranch extends RepoRequest {
	readonly command: 'pullBranch';
	readonly branchName: string;
	readonly remote: string;
	readonly createNewCommit: boolean;
	readonly squash: boolean;
}
export interface ResponsePullBranch extends ResponseWithErrorInfo {
	readonly command: 'pullBranch';
}

export interface RequestPushBranch extends RepoRequest {
	readonly command: 'pushBranch';
	readonly branchName: string;
	readonly remote: string;
	readonly setUpstream: boolean;
	readonly force: boolean;
}
export interface ResponsePushBranch extends ResponseWithErrorInfo {
	readonly command: 'pushBranch';
}

export interface RequestPushTag extends RepoRequest {
	readonly command: 'pushTag';
	readonly tagName: string;
	readonly remote: string;
}
export interface ResponsePushTag extends ResponseWithErrorInfo {
	readonly command: 'pushTag';
}

export interface RequestRebase extends RepoRequest {
	readonly command: 'rebase';
	readonly obj: string;
	readonly type: BranchOrCommit;
	readonly ignoreDate: boolean;
	readonly interactive: boolean;
}
export interface ResponseRebase extends ResponseWithErrorInfo {
	readonly command: 'rebase';
	readonly type: BranchOrCommit;
	readonly interactive: boolean;
}

export interface ResponseRefresh extends BaseMessage {
	readonly command: 'refresh';
}

export interface RequestRenameBranch extends RepoRequest {
	readonly command: 'renameBranch';
	readonly oldName: string;
	readonly newName: string;
}
export interface ResponseRenameBranch extends ResponseWithErrorInfo {
	readonly command: 'renameBranch';
}

export interface RequestRescanForRepos extends BaseMessage {
	readonly command: 'rescanForRepos';
}

export interface RequestResetToCommit extends RepoRequest {
	readonly command: 'resetToCommit';
	readonly commitHash: string;
	readonly resetMode: GitResetMode;
}
export interface ResponseResetToCommit extends ResponseWithErrorInfo {
	readonly command: 'resetToCommit';
}

export interface RequestRevertCommit extends RepoRequest {
	readonly command: 'revertCommit';
	readonly commitHash: string;
	readonly parentIndex: number;
}
export interface ResponseRevertCommit extends ResponseWithErrorInfo {
	readonly command: 'revertCommit';
}

export interface RequestSaveRepoState extends RepoRequest {
	readonly command: 'saveRepoState';
	readonly state: GitRepoState;
}

export interface RequestSaveStash extends RepoRequest {
	readonly command: 'saveStash';
	readonly message: string;
	readonly includeUntracked: boolean;
}
export interface ResponseSaveStash extends ResponseWithErrorInfo {
	readonly command: 'saveStash';
}

export interface RequestStartCodeReview extends RepoRequest {
	readonly command: 'startCodeReview';
	readonly id: string;
	readonly files: string[];
	readonly lastViewedFile: string | null;
	readonly commitHash: string;
	readonly compareWithHash: string | null;
}
export interface ResponseStartCodeReview extends ResponseWithErrorInfo {
	readonly command: 'startCodeReview';
	readonly codeReview: CodeReview;
	readonly commitHash: string;
	readonly compareWithHash: string | null;
}

export interface RequestTagDetails extends RepoRequest {
	readonly command: 'tagDetails';
	readonly tagName: string;
	readonly commitHash: string;
}
export interface ResponseTagDetails extends ResponseWithErrorInfo {
	readonly command: 'tagDetails';
	readonly tagName: string;
	readonly tagHash: string;
	readonly commitHash: string;
	readonly name: string;
	readonly email: string;
	readonly date: number;
	readonly message: string;
}

export interface RequestViewDiff extends RepoRequest {
	readonly command: 'viewDiff';
	readonly fromHash: string;
	readonly toHash: string;
	readonly oldFilePath: string;
	readonly newFilePath: string;
	readonly type: GitFileChangeType;
}
export interface ResponseViewDiff extends ResponseWithErrorInfo {
	readonly command: 'viewDiff';
}

export interface RequestViewScm extends BaseMessage {
	readonly command: 'viewScm';
}
export interface ResponseViewScm extends ResponseWithErrorInfo {
	readonly command: 'viewScm';
}

export type RequestMessage =
	RequestAddRemote
	| RequestAddTag
	| RequestApplyStash
	| RequestBranchFromStash
	| RequestCheckoutBranch
	| RequestCheckoutCommit
	| RequestCherrypickCommit
	| RequestCleanUntrackedFiles
	| RequestCodeReviewFileReviewed
	| RequestCommitDetails
	| RequestCompareCommits
	| RequestCopyFilePath
	| RequestCopyToClipboard
	| RequestCreateBranch
	| RequestDeleteBranch
	| RequestDeleteRemote
	| RequestDeleteRemoteBranch
	| RequestDeleteTag
	| RequestDropCommit
	| RequestDropStash
	| RequestEditRemote
	| RequestEndCodeReview
	| RequestFetch
	| RequestFetchAvatar
	| RequestFetchIntoLocalBranch
	| RequestGetSettings
	| RequestLoadCommits
	| RequestLoadRepoInfo
	| RequestLoadRepos
	| RequestMerge
	| RequestOpenFile
	| RequestPopStash
	| RequestPruneRemote
	| RequestPullBranch
	| RequestPushBranch
	| RequestPushTag
	| RequestRebase
	| RequestRenameBranch
	| RequestRescanForRepos
	| RequestResetToCommit
	| RequestRevertCommit
	| RequestSaveRepoState
	| RequestSaveStash
	| RequestStartCodeReview
	| RequestTagDetails
	| RequestViewDiff
	| RequestViewScm;

export type ResponseMessage =
	ResponseAddRemote
	| ResponseAddTag
	| ResponseApplyStash
	| ResponseBranchFromStash
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
	| ResponseDropCommit
	| ResponseDropStash
	| ResponseEditRemote
	| ResponseFetch
	| ResponseFetchAvatar
	| ResponseFetchIntoLocalBranch
	| ResponseGetSettings
	| ResponseLoadCommits
	| ResponseLoadRepoInfo
	| ResponseLoadRepos
	| ResponseMerge
	| ResponseOpenFile
	| ResponsePopStash
	| ResponsePruneRemote
	| ResponsePullBranch
	| ResponsePushBranch
	| ResponsePushTag
	| ResponseRebase
	| ResponseRefresh
	| ResponseRenameBranch
	| ResponseResetToCommit
	| ResponseRevertCommit
	| ResponseStartCodeReview
	| ResponseSaveStash
	| ResponseTagDetails
	| ResponseViewDiff
	| ResponseViewScm;
