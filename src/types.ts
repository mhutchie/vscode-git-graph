/* Git Interfaces / Types */

export interface GitCommit {
	readonly hash: string;
	readonly parents: ReadonlyArray<string>;
	readonly author: string;
	readonly email: string;
	readonly date: number;
	readonly message: string;
	readonly heads: ReadonlyArray<string>;
	readonly tags: ReadonlyArray<GitCommitTag>;
	readonly remotes: ReadonlyArray<GitCommitRemote>;
	readonly stash: GitCommitStash | null; // null => not a stash, otherwise => stash info
}

export interface GitCommitTag {
	readonly name: string;
	readonly annotated: boolean;
}

export interface GitCommitRemote {
	readonly name: string;
	readonly remote: string | null; // null => remote not found, otherwise => remote name
}

export interface GitCommitStash {
	readonly selector: string;
	readonly baseHash: string;
	readonly untrackedFilesHash: string | null;
}

export interface GitCommitDetails {
	readonly hash: string;
	readonly parents: ReadonlyArray<string>;
	readonly author: string;
	readonly authorEmail: string;
	readonly authorDate: number;
	readonly committer: string;
	readonly committerEmail: string;
	readonly committerDate: number;
	readonly signature: GitSignature | null;
	readonly body: string;
	readonly fileChanges: ReadonlyArray<GitFileChange>;
}

export const enum GitSignatureStatus {
	GoodAndValid = 'G',
	GoodWithUnknownValidity = 'U',
	GoodButExpired = 'X',
	GoodButMadeByExpiredKey = 'Y',
	GoodButMadeByRevokedKey = 'R',
	CannotBeChecked = 'E',
	Bad = 'B'
}

export interface GitSignature {
	readonly key: string;
	readonly signer: string;
	readonly status: GitSignatureStatus;
}

export const enum GitConfigLocation {
	Local = 'local',
	Global = 'global',
	System = 'system'
}

export interface GitFileChange {
	readonly oldFilePath: string;
	readonly newFilePath: string;
	readonly type: GitFileStatus;
	readonly additions: number | null;
	readonly deletions: number | null;
}

export const enum GitFileStatus {
	Added = 'A',
	Modified = 'M',
	Deleted = 'D',
	Renamed = 'R',
	Untracked = 'U'
}

export const enum GitPushBranchMode {
	Normal = '',
	Force = 'force',
	ForceWithLease = 'force-with-lease'
}

export interface GitRepoConfig {
	readonly branches: GitRepoConfigBranches;
	readonly diffTool: string | null;
	readonly guiDiffTool: string | null;
	readonly pushDefault: string | null;
	readonly remotes: ReadonlyArray<GitRepoSettingsRemote>;
	readonly user: {
		readonly name: {
			readonly local: string | null,
			readonly global: string | null
		},
		readonly email: {
			readonly local: string | null,
			readonly global: string | null
		}
	};
}

export type GitRepoConfigBranches = { [branchName: string]: GitRepoConfigBranch };

export interface GitRepoConfigBranch {
	readonly pushRemote: string | null;
	readonly remote: string | null;
}

export interface GitRepoSettingsRemote {
	readonly name: string;
	readonly url: string | null;
	readonly pushUrl: string | null;
}

export const enum GitResetMode {
	Soft = 'soft',
	Mixed = 'mixed',
	Hard = 'hard'
}

export interface GitStash {
	readonly hash: string;
	readonly baseHash: string;
	readonly untrackedFilesHash: string | null;
	readonly selector: string;
	readonly author: string;
	readonly email: string;
	readonly date: number;
	readonly message: string;
}

export interface GitTagDetails {
	readonly hash: string;
	readonly taggerName: string;
	readonly taggerEmail: string;
	readonly taggerDate: number;
	readonly message: string;
	readonly signature: GitSignature | null;
}


/* Git Repo State */

export interface CodeReview {
	id: string;
	lastActive: number;
	lastViewedFile: string | null;
	remainingFiles: string[];
}

export type ColumnWidth = number;

export type GitRepoSet = { [repo: string]: GitRepoState };

export interface IssueLinkingConfig {
	readonly issue: string;
	readonly url: string;
}

export interface PullRequestConfigBase {
	readonly hostRootUrl: string;
	readonly sourceRemote: string;
	readonly sourceOwner: string;
	readonly sourceRepo: string;
	readonly destRemote: string | null;
	readonly destOwner: string;
	readonly destRepo: string;
	readonly destProjectId: string; // Only used by GitLab
	readonly destBranch: string;
}

export const enum PullRequestProvider {
	Bitbucket,
	Custom,
	GitHub,
	GitLab
}

interface PullRequestConfigBuiltIn extends PullRequestConfigBase {
	readonly provider: Exclude<PullRequestProvider, PullRequestProvider.Custom>;
	readonly custom: null;
}

interface PullRequestConfigCustom extends PullRequestConfigBase {
	readonly provider: PullRequestProvider.Custom;
	readonly custom: {
		readonly name: string,
		readonly templateUrl: string
	};
}

export type PullRequestConfig = PullRequestConfigBuiltIn | PullRequestConfigCustom;

export interface GitRepoState {
	cdvDivider: number;
	cdvHeight: number;
	columnWidths: ColumnWidth[] | null;
	commitOrdering: RepoCommitOrdering;
	fileViewType: FileViewType;
	hideRemotes: string[];
	includeCommitsMentionedByReflogs: BooleanOverride;
	issueLinkingConfig: IssueLinkingConfig | null;
	lastImportAt: number;
	name: string | null;
	onlyFollowFirstParent: BooleanOverride;
	onRepoLoadShowCheckedOutBranch: BooleanOverride;
	onRepoLoadShowSpecificBranches: string[] | null;
	pullRequestConfig: PullRequestConfig | null;
	showRemoteBranches: boolean;
	showRemoteBranchesV2: BooleanOverride;
	showStashes: BooleanOverride;
	showTags: BooleanOverride;
	workspaceFolderIndex: number | null;
}


/* Git Graph View Types */

export interface GitGraphViewInitialState {
	readonly config: GitGraphViewConfig;
	readonly lastActiveRepo: string | null;
	readonly loadViewTo: LoadGitGraphViewTo;
	readonly repos: GitRepoSet;
	readonly loadRepoInfoRefreshId: number;
	readonly loadCommitsRefreshId: number;
}

export interface GitGraphViewConfig {
	readonly commitDetailsView: CommitDetailsViewConfig;
	readonly commitOrdering: CommitOrdering;
	readonly contextMenuActionsVisibility: ContextMenuActionsVisibility;
	readonly customBranchGlobPatterns: ReadonlyArray<CustomBranchGlobPattern>;
	readonly customEmojiShortcodeMappings: ReadonlyArray<CustomEmojiShortcodeMapping>;
	readonly customPullRequestProviders: ReadonlyArray<CustomPullRequestProvider>;
	readonly dateFormat: DateFormat;
	readonly defaultColumnVisibility: DefaultColumnVisibility;
	readonly dialogDefaults: DialogDefaults;
	readonly enhancedAccessibility: boolean;
	readonly fetchAndPrune: boolean;
	readonly fetchAndPruneTags: boolean;
	readonly fetchAvatars: boolean;
	readonly graph: GraphConfig;
	readonly includeCommitsMentionedByReflogs: boolean;
	readonly initialLoadCommits: number;
	readonly keybindings: KeybindingConfig
	readonly loadMoreCommits: number;
	readonly loadMoreCommitsAutomatically: boolean;
	readonly markdown: boolean;
	readonly mute: MuteCommitsConfig;
	readonly onlyFollowFirstParent: boolean;
	readonly onRepoLoad: OnRepoLoadConfig;
	readonly referenceLabels: ReferenceLabelsConfig;
	readonly repoDropdownOrder: RepoDropdownOrder;
	readonly showRemoteBranches: boolean;
	readonly showStashes: boolean;
	readonly showTags: boolean;
	readonly stickyHeader: boolean;
}

export interface GitGraphViewGlobalState {
	alwaysAcceptCheckoutCommit: boolean;
	issueLinkingConfig: IssueLinkingConfig | null;
	pushTagSkipRemoteCheck: boolean;
}

export interface GitGraphViewWorkspaceState {
	findIsCaseSensitive: boolean;
	findIsRegex: boolean;
	findOpenCommitDetailsView: boolean;
}

export interface CommitDetailsViewConfig {
	readonly autoCenter: boolean;
	readonly fileTreeCompactFolders: boolean;
	readonly fileViewType: FileViewType;
	readonly location: CommitDetailsViewLocation;
}

export interface GraphConfig {
	readonly colours: ReadonlyArray<string>;
	readonly style: GraphStyle;
	readonly grid: { x: number, y: number, offsetX: number, offsetY: number, expandY: number };
	readonly uncommittedChanges: GraphUncommittedChangesStyle;
}

export interface KeybindingConfig {
	readonly find: string | null;
	readonly refresh: string | null;
	readonly scrollToHead: string | null;
	readonly scrollToStash: string | null;
}

export type LoadGitGraphViewTo = {
	readonly repo: string,
	readonly commitDetails?: {
		readonly commitHash: string,
		readonly compareWithHash: string | null
	},
	readonly runCommandOnLoad?: 'fetch'
} | null;

export interface MuteCommitsConfig {
	readonly commitsNotAncestorsOfHead: boolean;
	readonly mergeCommits: boolean;
}

export interface OnRepoLoadConfig {
	readonly scrollToHead: boolean;
	readonly showCheckedOutBranch: boolean;
	readonly showSpecificBranches: ReadonlyArray<string>;
}

export interface ReferenceLabelsConfig {
	readonly branchLabelsAlignedToGraph: boolean;
	readonly combineLocalAndRemoteBranchLabels: boolean;
	readonly tagLabelsOnRight: boolean;
}


/* Extension Settings Types */

export const enum BooleanOverride {
	Default,
	Enabled,
	Disabled
}

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
		readonly viewIssue: boolean;
		readonly createPullRequest: boolean;
		readonly createArchive: boolean;
		readonly selectInBranchesDropdown: boolean;
		readonly unselectInBranchesDropdown: boolean;
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
		readonly copySubject: boolean;
	};
	readonly commitDetailsViewFile: {
		readonly viewDiff: boolean;
		readonly viewFileAtThisRevision: boolean;
		readonly viewDiffWithWorkingFile: boolean;
		readonly openFile: boolean;
		readonly markAsReviewed: boolean;
		readonly markAsNotReviewed: boolean;
		readonly resetFileToThisRevision: boolean;
		readonly copyAbsoluteFilePath: boolean;
		readonly copyRelativeFilePath: boolean;
	};
	readonly remoteBranch: {
		readonly checkout: boolean;
		readonly delete: boolean;
		readonly fetch: boolean;
		readonly merge: boolean;
		readonly pull: boolean;
		readonly viewIssue: boolean;
		readonly createPullRequest: boolean;
		readonly createArchive: boolean;
		readonly selectInBranchesDropdown: boolean;
		readonly unselectInBranchesDropdown: boolean;
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
		readonly createArchive: boolean;
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

export interface CustomPullRequestProvider {
	readonly name: string;
	readonly templateUrl: string;
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
		readonly type: TagType
	};
	readonly applyStash: {
		readonly reinstateIndex: boolean
	};
	readonly cherryPick: {
		readonly noCommit: boolean,
		readonly recordOrigin: boolean
	};
	readonly createBranch: {
		readonly checkout: boolean
	};
	readonly deleteBranch: {
		readonly forceDelete: boolean
	};
	readonly fetchIntoLocalBranch: {
		readonly forceFetch: boolean
	};
	readonly fetchRemote: {
		readonly prune: boolean,
		readonly pruneTags: boolean
	};
	readonly general: {
		readonly referenceInputSpaceSubstitution: string | null
	};
	readonly merge: {
		readonly noCommit: boolean,
		readonly noFastForward: boolean,
		readonly squash: boolean
	};
	readonly popStash: {
		readonly reinstateIndex: boolean
	};
	readonly pullBranch: {
		readonly noFastForward: boolean,
		readonly squash: boolean
	};
	readonly rebase: {
		readonly ignoreDate: boolean,
		readonly interactive: boolean
	};
	readonly resetCommit: {
		readonly mode: GitResetMode
	};
	readonly resetUncommitted: {
		readonly mode: Exclude<GitResetMode, GitResetMode.Soft>
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

export const enum GraphUncommittedChangesStyle {
	OpenCircleAtTheUncommittedChanges,
	OpenCircleAtTheCheckedOutCommit
}

export const enum RefLabelAlignment {
	Normal,
	BranchesOnLeftAndTagsOnRight,
	BranchesAlignedToGraphAndTagsOnRight
}

export const enum RepoCommitOrdering {
	Default = 'default',
	Date = 'date',
	AuthorDate = 'author-date',
	Topological = 'topo'
}

export const enum RepoDropdownOrder {
	FullPath,
	Name,
	WorkspaceFullPath
}

export const enum SquashMessageFormat {
	Default,
	GitSquashMsg
}

export const enum TabIconColourTheme {
	Colour,
	Grey
}

export const enum TagType {
	Annotated,
	Lightweight
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

export const enum ErrorInfoExtensionPrefix {
	PushTagCommitNotOnRemote = 'VSCODE_GIT_GRAPH:PUSH_TAG:COMMIT_NOT_ON_REMOTE:'
}

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
	readonly type: TagType;
	readonly message: string;
	readonly pushToRemote: string | null; // string => name of the remote to push the tag to, null => don't push to a remote
	readonly pushSkipRemoteCheck: boolean;
	readonly force: boolean;
}
export interface ResponseAddTag extends ResponseWithMultiErrorInfo {
	readonly command: 'addTag';
	readonly repo: string;
	readonly tagName: string;
	readonly pushToRemote: string | null;
	readonly commitHash: string;
}

export interface RequestApplyStash extends RepoRequest {
	readonly command: 'applyStash';
	readonly selector: string;
	readonly reinstateIndex: boolean;
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
	readonly pullAfterwards: {
		readonly branchName: string;
		readonly remote: string;
		readonly createNewCommit: boolean;
		readonly squash: boolean;
	} | null; // NULL => Don't pull after checking out
}
export interface ResponseCheckoutBranch extends ResponseWithMultiErrorInfo {
	readonly command: 'checkoutBranch';
	readonly pullAfterwards: {
		readonly branchName: string;
		readonly remote: string;
	} | null; // NULL => Don't pull after checking out
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
	readonly recordOrigin: boolean;
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

export interface RequestCommitDetails extends RepoRequest {
	readonly command: 'commitDetails';
	readonly commitHash: string;
	readonly hasParents: boolean;
	readonly stash: GitCommitStash | null; // null => request is for a commit, otherwise => request is for a stash
	readonly avatarEmail: string | null; // string => fetch avatar with the given email, null => don't fetch avatar
	readonly refresh: boolean;
}
export interface ResponseCommitDetails extends ResponseWithErrorInfo {
	readonly command: 'commitDetails';
	readonly commitDetails: GitCommitDetails | null;
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
	readonly fileChanges: ReadonlyArray<GitFileChange>;
	readonly codeReview: CodeReview | null;
	readonly refresh: boolean;
}

export interface RequestCopyFilePath extends RepoRequest {
	readonly command: 'copyFilePath';
	readonly filePath: string;
	readonly absolute: boolean;
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

export interface RequestCreateArchive extends RepoRequest {
	readonly command: 'createArchive';
	readonly ref: string;
}
export interface ResponseCreateArchive extends ResponseWithErrorInfo {
	readonly command: 'createArchive';
}

export interface RequestCreateBranch extends RepoRequest {
	readonly command: 'createBranch';
	readonly commitHash: string;
	readonly branchName: string;
	readonly checkout: boolean;
	readonly force: boolean;
}
export interface ResponseCreateBranch extends ResponseWithMultiErrorInfo {
	readonly command: 'createBranch';
}

export interface RequestCreatePullRequest extends RepoRequest {
	readonly command: 'createPullRequest';
	readonly config: PullRequestConfig;
	readonly sourceRemote: string;
	readonly sourceOwner: string;
	readonly sourceRepo: string;
	readonly sourceBranch: string;
	readonly push: boolean;
}
export interface ResponseCreatePullRequest extends ResponseWithMultiErrorInfo {
	readonly command: 'createPullRequest';
	readonly push: boolean;
}

export interface RequestDeleteBranch extends RepoRequest {
	readonly command: 'deleteBranch';
	readonly branchName: string;
	readonly forceDelete: boolean;
	readonly deleteOnRemotes: ReadonlyArray<string>;
}
export interface ResponseDeleteBranch extends ResponseWithMultiErrorInfo {
	readonly command: 'deleteBranch';
	readonly repo: string;
	readonly branchName: string;
	readonly deleteOnRemotes: ReadonlyArray<string>;
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

export interface RequestDeleteUserDetails extends RepoRequest {
	readonly command: 'deleteUserDetails';
	readonly name: boolean; // TRUE => Delete Name, FALSE => Don't Delete Name
	readonly email: boolean; // TRUE => Delete Email, FALSE => Don't Delete Email
	readonly location: GitConfigLocation.Global | GitConfigLocation.Local;
}
export interface ResponseDeleteUserDetails extends ResponseWithMultiErrorInfo {
	readonly command: 'deleteUserDetails';
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

export interface RequestEditUserDetails extends RepoRequest {
	readonly command: 'editUserDetails';
	readonly name: string;
	readonly email: string;
	readonly location: GitConfigLocation.Global | GitConfigLocation.Local;
	readonly deleteLocalName: boolean; // TRUE => Delete Local Name, FALSE => Don't Delete Local Name
	readonly deleteLocalEmail: boolean; // TRUE => Delete Local Email, FALSE => Don't Delete Local Email
}
export interface ResponseEditUserDetails extends ResponseWithMultiErrorInfo {
	readonly command: 'editUserDetails';
}

export interface RequestEndCodeReview extends RepoRequest {
	readonly command: 'endCodeReview';
	readonly id: string;
}

export interface RequestExportRepoConfig extends RepoRequest {
	readonly command: 'exportRepoConfig';
}
export interface ResponseExportRepoConfig extends ResponseWithErrorInfo {
	readonly command: 'exportRepoConfig';
}

export interface RequestFetch extends RepoRequest {
	readonly command: 'fetch';
	readonly name: string | null; // null => Fetch all remotes
	readonly prune: boolean;
	readonly pruneTags: boolean;
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
	readonly force: boolean;
}
export interface ResponseFetchIntoLocalBranch extends ResponseWithErrorInfo {
	readonly command: 'fetchIntoLocalBranch';
}

export interface RequestLoadCommits extends RepoRequest {
	readonly command: 'loadCommits';
	readonly refreshId: number;
	readonly branches: ReadonlyArray<string> | null; // null => Show All
	readonly maxCommits: number;
	readonly showTags: boolean;
	readonly showRemoteBranches: boolean;
	readonly includeCommitsMentionedByReflogs: boolean;
	readonly onlyFollowFirstParent: boolean;
	readonly commitOrdering: CommitOrdering;
	readonly remotes: ReadonlyArray<string>;
	readonly hideRemotes: ReadonlyArray<string>;
	readonly stashes: ReadonlyArray<GitStash>;
}
export interface ResponseLoadCommits extends ResponseWithErrorInfo {
	readonly command: 'loadCommits';
	readonly refreshId: number;
	readonly commits: GitCommit[];
	readonly head: string | null;
	readonly tags: string[];
	readonly moreCommitsAvailable: boolean;
	readonly onlyFollowFirstParent: boolean;
}

export interface RequestLoadConfig extends RepoRequest {
	readonly command: 'loadConfig';
	readonly remotes: ReadonlyArray<string>;
}
export interface ResponseLoadConfig extends ResponseWithErrorInfo {
	readonly command: 'loadConfig';
	readonly repo: string;
	readonly config: GitRepoConfig | null;
}

export interface RequestLoadRepoInfo extends RepoRequest {
	readonly command: 'loadRepoInfo';
	readonly refreshId: number;
	readonly showRemoteBranches: boolean;
	readonly showStashes: boolean;
	readonly hideRemotes: ReadonlyArray<string>;
}
export interface ResponseLoadRepoInfo extends ResponseWithErrorInfo {
	readonly command: 'loadRepoInfo';
	readonly refreshId: number;
	readonly branches: ReadonlyArray<string>;
	readonly head: string | null;
	readonly remotes: ReadonlyArray<string>;
	readonly stashes: ReadonlyArray<GitStash>;
	readonly isRepo: boolean;
}

export interface RequestLoadRepos extends BaseMessage {
	readonly command: 'loadRepos';
	readonly check: boolean;
}
export interface ResponseLoadRepos extends BaseMessage {
	readonly command: 'loadRepos';
	readonly repos: GitRepoSet;
	readonly lastActiveRepo: string | null;
	readonly loadViewTo: LoadGitGraphViewTo;
}

export const enum MergeActionOn {
	Branch = 'Branch',
	RemoteTrackingBranch = 'Remote-tracking Branch',
	Commit = 'Commit'
}
export interface RequestMerge extends RepoRequest {
	readonly command: 'merge';
	readonly obj: string;
	readonly actionOn: MergeActionOn;
	readonly createNewCommit: boolean;
	readonly squash: boolean;
	readonly noCommit: boolean;
}
export interface ResponseMerge extends ResponseWithErrorInfo {
	readonly command: 'merge';
	readonly actionOn: MergeActionOn;
}

export interface RequestOpenExtensionSettings extends BaseMessage {
	readonly command: 'openExtensionSettings';
}
export interface ResponseOpenExtensionSettings extends ResponseWithErrorInfo {
	readonly command: 'openExtensionSettings';
}

export interface RequestOpenExternalDirDiff extends RepoRequest {
	readonly command: 'openExternalDirDiff';
	readonly fromHash: string;
	readonly toHash: string;
	readonly isGui: boolean;
}
export interface ResponseOpenExternalDirDiff extends ResponseWithErrorInfo {
	readonly command: 'openExternalDirDiff';
}

export interface RequestOpenExternalUrl extends BaseMessage {
	readonly command: 'openExternalUrl';
	readonly url: string;
}
export interface ResponseOpenExternalUrl extends ResponseWithErrorInfo {
	readonly command: 'openExternalUrl';
}

export interface RequestOpenFile extends RepoRequest {
	readonly command: 'openFile';
	readonly hash: string;
	readonly filePath: string;
}
export interface ResponseOpenFile extends ResponseWithErrorInfo {
	readonly command: 'openFile';
}

export interface RequestOpenTerminal extends RepoRequest {
	readonly command: 'openTerminal';
	readonly name: string;
}
export interface ResponseOpenTerminal extends ResponseWithErrorInfo {
	readonly command: 'openTerminal';
}

export interface RequestPopStash extends RepoRequest {
	readonly command: 'popStash';
	readonly selector: string;
	readonly reinstateIndex: boolean;
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
	readonly remotes: string[];
	readonly setUpstream: boolean;
	readonly mode: GitPushBranchMode;
	readonly willUpdateBranchConfig: boolean;
}
export interface ResponsePushBranch extends ResponseWithMultiErrorInfo {
	readonly command: 'pushBranch';
	readonly willUpdateBranchConfig: boolean;
}

export interface RequestPushStash extends RepoRequest {
	readonly command: 'pushStash';
	readonly message: string;
	readonly includeUntracked: boolean;
}
export interface ResponsePushStash extends ResponseWithErrorInfo {
	readonly command: 'pushStash';
}

export interface RequestPushTag extends RepoRequest {
	readonly command: 'pushTag';
	readonly tagName: string;
	readonly remotes: string[];
	readonly commitHash: string;
	readonly skipRemoteCheck: boolean;
}
export interface ResponsePushTag extends ResponseWithMultiErrorInfo {
	readonly command: 'pushTag';
	readonly repo: string;
	readonly tagName: string;
	readonly remotes: string[];
	readonly commitHash: string;
}

export const enum RebaseActionOn {
	Branch = 'Branch',
	Commit = 'Commit'
}
export interface RequestRebase extends RepoRequest {
	readonly command: 'rebase';
	readonly obj: string;
	readonly actionOn: RebaseActionOn;
	readonly ignoreDate: boolean;
	readonly interactive: boolean;
}
export interface ResponseRebase extends ResponseWithErrorInfo {
	readonly command: 'rebase';
	readonly actionOn: RebaseActionOn;
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

export interface RequestResetFileToRevision extends RepoRequest {
	readonly command: 'resetFileToRevision';
	readonly commitHash: string;
	readonly filePath: string;
}
export interface ResponseResetFileToRevision extends ResponseWithErrorInfo {
	readonly command: 'resetFileToRevision';
}

export interface RequestResetToCommit extends RepoRequest {
	readonly command: 'resetToCommit';
	readonly commit: string;
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

export interface RequestSetGlobalViewState extends BaseMessage {
	readonly command: 'setGlobalViewState';
	readonly state: GitGraphViewGlobalState;
}
export interface ResponseSetGlobalViewState extends ResponseWithErrorInfo {
	readonly command: 'setGlobalViewState';
}

export interface RequestSetRepoState extends RepoRequest {
	readonly command: 'setRepoState';
	readonly state: GitRepoState;
}

export interface RequestSetWorkspaceViewState extends BaseMessage {
	readonly command: 'setWorkspaceViewState';
	readonly state: GitGraphViewWorkspaceState;
}
export interface ResponseSetWorkspaceViewState extends ResponseWithErrorInfo {
	readonly command: 'setWorkspaceViewState';
}

export interface RequestShowErrorDialog extends BaseMessage {
	readonly command: 'showErrorMessage';
	readonly message: string;
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
	readonly commitHash: string;
	readonly details: GitTagDetails | null;
}

export interface RequestUpdateCodeReview extends RepoRequest {
	readonly command: 'updateCodeReview';
	readonly id: string;
	readonly remainingFiles: string[];
	readonly lastViewedFile: string | null;
}

export interface ResponseUpdateCodeReview extends ResponseWithErrorInfo {
	readonly command: 'updateCodeReview';
}

export interface RequestViewDiff extends RepoRequest {
	readonly command: 'viewDiff';
	readonly fromHash: string;
	readonly toHash: string;
	readonly oldFilePath: string;
	readonly newFilePath: string;
	readonly type: GitFileStatus;
}
export interface ResponseViewDiff extends ResponseWithErrorInfo {
	readonly command: 'viewDiff';
}

export interface RequestViewDiffWithWorkingFile extends RepoRequest {
	readonly command: 'viewDiffWithWorkingFile';
	readonly hash: string;
	readonly filePath: string;
}
export interface ResponseViewDiffWithWorkingFile extends ResponseWithErrorInfo {
	readonly command: 'viewDiffWithWorkingFile';
}

export interface RequestViewFileAtRevision extends RepoRequest {
	readonly command: 'viewFileAtRevision';
	readonly hash: string;
	readonly filePath: string;
}
export interface ResponseViewFileAtRevision extends ResponseWithErrorInfo {
	readonly command: 'viewFileAtRevision';
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
	| RequestCommitDetails
	| RequestCompareCommits
	| RequestCopyFilePath
	| RequestCopyToClipboard
	| RequestCreateArchive
	| RequestCreateBranch
	| RequestCreatePullRequest
	| RequestDeleteBranch
	| RequestDeleteRemote
	| RequestDeleteRemoteBranch
	| RequestDeleteTag
	| RequestDeleteUserDetails
	| RequestDropCommit
	| RequestDropStash
	| RequestEditRemote
	| RequestEditUserDetails
	| RequestEndCodeReview
	| RequestExportRepoConfig
	| RequestFetch
	| RequestFetchAvatar
	| RequestFetchIntoLocalBranch
	| RequestLoadCommits
	| RequestLoadConfig
	| RequestLoadRepoInfo
	| RequestLoadRepos
	| RequestMerge
	| RequestOpenExtensionSettings
	| RequestOpenExternalDirDiff
	| RequestOpenExternalUrl
	| RequestOpenFile
	| RequestOpenTerminal
	| RequestPopStash
	| RequestPruneRemote
	| RequestPullBranch
	| RequestPushBranch
	| RequestPushStash
	| RequestPushTag
	| RequestRebase
	| RequestRenameBranch
	| RequestRescanForRepos
	| RequestResetFileToRevision
	| RequestResetToCommit
	| RequestRevertCommit
	| RequestSetGlobalViewState
	| RequestSetRepoState
	| RequestSetWorkspaceViewState
	| RequestShowErrorDialog
	| RequestStartCodeReview
	| RequestTagDetails
	| RequestUpdateCodeReview
	| RequestViewDiff
	| RequestViewDiffWithWorkingFile
	| RequestViewFileAtRevision
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
	| ResponseCreateArchive
	| ResponseCreateBranch
	| ResponseCreatePullRequest
	| ResponseDeleteBranch
	| ResponseDeleteRemote
	| ResponseDeleteRemoteBranch
	| ResponseDeleteTag
	| ResponseDeleteUserDetails
	| ResponseDropCommit
	| ResponseDropStash
	| ResponseEditRemote
	| ResponseEditUserDetails
	| ResponseExportRepoConfig
	| ResponseFetch
	| ResponseFetchAvatar
	| ResponseFetchIntoLocalBranch
	| ResponseLoadCommits
	| ResponseLoadConfig
	| ResponseLoadRepoInfo
	| ResponseLoadRepos
	| ResponseMerge
	| ResponseOpenExtensionSettings
	| ResponseOpenExternalDirDiff
	| ResponseOpenExternalUrl
	| ResponseOpenFile
	| ResponseOpenTerminal
	| ResponsePopStash
	| ResponsePruneRemote
	| ResponsePullBranch
	| ResponsePushBranch
	| ResponsePushStash
	| ResponsePushTag
	| ResponseRebase
	| ResponseRefresh
	| ResponseRenameBranch
	| ResponseResetFileToRevision
	| ResponseResetToCommit
	| ResponseRevertCommit
	| ResponseSetGlobalViewState
	| ResponseSetWorkspaceViewState
	| ResponseStartCodeReview
	| ResponseTagDetails
	| ResponseUpdateCodeReview
	| ResponseViewDiff
	| ResponseViewDiffWithWorkingFile
	| ResponseViewFileAtRevision
	| ResponseViewScm;


/** Helper Types */

type PrimitiveTypes = string | number | boolean | symbol | bigint | undefined | null;

/**
 * Make all properties in T writeable
 */
export type Writeable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Make all properties in T recursively readonly
 */
export type DeepReadonly<T> = T extends PrimitiveTypes
	? T
	: T extends (Array<infer U> | ReadonlyArray<infer U>)
	? ReadonlyArray<DeepReadonly<U>>
	: { readonly [K in keyof T]: DeepReadonly<T[K]> };

/**
 * Make all properties in T recursively writeable
 */
export type DeepWriteable<T> = T extends PrimitiveTypes
	? T
	: T extends (Array<infer U> | ReadonlyArray<infer U>)
	? Array<DeepWriteable<U>>
	: { -readonly [K in keyof T]: DeepWriteable<T[K]> };
