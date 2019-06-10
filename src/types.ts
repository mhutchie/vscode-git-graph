/* Git Interfaces / Types */

export interface GitBranchData {
  branches: string[]
  head: string | null
  error: GitCommandError
}

export interface GitCommitData {
  commits: GitCommitNode[]
  head: string | null
  remotes: string[]
  moreCommitsAvailable: boolean
  error: GitCommandError
}

export interface GitCommitComparisonData {
  fileChanges: GitFileChange[]
  error: GitCommandError
}

export interface GitCommitNode {
  hash: string
  parentHashes: string[]
  author: string
  email: string
  date: number
  message: string
  heads: string[]
  tags: string[]
  remotes: GitRemoteRef[]
}

export interface GitCommit {
  hash: string
  parentHashes: string[]
  author: string
  email: string
  date: number
  message: string
}

export interface GitCommitDetails {
  hash: string
  parents: string[]
  author: string
  email: string
  date: number
  committer: string
  body: string
  fileChanges: GitFileChange[]
  error: GitCommandError
}

export interface GitRemoteObject {
  name: string
  value: string
}

export interface GitRef {
  hash: string
  name: string
}

export interface GitRemoteRef {
  name: string
  remote: string
}

export interface GitRefData {
  head: string | null
  heads: GitRef[]
  tags: GitRef[]
  remotes: GitRef[]
}

export type GitRepoSet = { [repo: string]: GitRepoState }
export interface GitRepoState {
  columnWidths: ColumnWidth[] | null
}
export type ColumnWidth = number

export interface GitUnsavedChanges {
  branch: string
  changes: number
}

export interface GitGraphViewState {
  autoCenterCommitDetailsView: boolean
  combineLocalAndRemoteBranchLabels: boolean
  commitDetailsViewLocation: CommitDetailsViewLocation
  customBranchGlobPatterns: CustomBranchGlobPattern[]
  dateFormat: DateFormat
  defaultColumnVisibility: DefaultColumnVisibility
  fetchAvatars: boolean
  graphColours: string[]
  graphStyle: GraphStyle
  initialLoadCommits: number
  lastActiveRepo: string | null
  loadMoreCommits: number
  loadRepo: string | null
  refLabelAlignment: RefLabelAlignment
  repos: GitRepoSet
  showCurrentBranchByDefault: boolean
}

export interface GitFileChange {
  oldFilePath: string
  newFilePath: string
  type: GitFileChangeType
  additions: number | null
  deletions: number | null
}

export interface Avatar {
  image: string
  timestamp: number
  identicon: boolean
}
export type AvatarCache = { [email: string]: Avatar }

export type CommitDetailsViewLocation = 'Inline' | 'Docked to Bottom'
export type DateFormat = 'Date & Time' | 'Date Only' | 'Relative'
export type DateType = 'Author Date' | 'Commit Date'
export type GraphStyle = 'rounded' | 'angular'
export type RefLabelAlignment =
  | 'Normal'
  | 'Branches (on the left) & Tags (on the right)'
  | 'Branches (aligned to the graph) & Tags (on the right)'
export type TabIconColourTheme = 'colour' | 'grey'
export type GitCommandError = string | null // null => no error, otherwise => error message
export type GitResetMode = 'soft' | 'mixed' | 'hard'
export type GitFileChangeType = 'A' | 'M' | 'D' | 'R' | 'U'
export type DiffSide = 'old' | 'new'
export type RebaseOnType = 'Branch' | 'Commit'

export interface CustomBranchGlobPattern {
  name: string
  glob: string
}
export interface DefaultColumnVisibility {
  date: boolean
  author: boolean
  commit: boolean
}

/* Request / Response Messages */

export interface RequestAddTag {
  command: 'addTag'
  repo: string
  commitHash: string
  tagName: string
  lightweight: boolean
  message: string
}
export interface ResponseAddTag {
  command: 'addTag'
  error: GitCommandError
}
export interface RequestRemoteUrl {
  command: 'changeRemoteUrl'
  repo: string
  remote: string
  remoteUrl: string
}
export interface ResponseRemoteUrl {
  command: 'changeRemoteUrl'
  error: GitCommandError
}

export interface RequestCheckoutBranch {
  command: 'checkoutBranch'
  repo: string
  branchName: string
  remoteBranch: string | null
}
export interface ResponseCheckoutBranch {
  command: 'checkoutBranch'
  error: GitCommandError
}

export interface RequestCheckoutCommit {
  command: 'checkoutCommit'
  repo: string
  commitHash: string
}
export interface ResponseCheckoutCommit {
  command: 'checkoutCommit'
  error: GitCommandError
}

export interface RequestCherrypickCommit {
  command: 'cherrypickCommit'
  repo: string
  commitHash: string
  parentIndex: number
}
export interface ResponseCherrypickCommit {
  command: 'cherrypickCommit'
  error: GitCommandError
}

export interface RequestCleanUntrackedFiles {
  command: 'cleanUntrackedFiles'
  repo: string
  directories: boolean
}
export interface ResponseCleanUntrackedFiles {
  command: 'cleanUntrackedFiles'
  error: GitCommandError
}

export interface RequestCommitDetails {
  command: 'commitDetails'
  repo: string
  commitHash: string
  refresh: boolean
}
export interface ResponseCommitDetails {
  command: 'commitDetails'
  commitDetails: GitCommitDetails
  refresh: boolean
}

export interface RequestCompareCommits {
  command: 'compareCommits'
  repo: string
  commitHash: string
  compareWithHash: string
  fromHash: string
  toHash: string
  refresh: boolean
}
export interface ResponseCompareCommits {
  command: 'compareCommits'
  commitHash: string
  compareWithHash: string
  fileChanges: GitFileChange[]
  refresh: boolean
  error: GitCommandError
}

export interface RequestCopyToClipboard {
  command: 'copyToClipboard'
  type: string
  data: string
}
export interface ResponseCopyToClipboard {
  command: 'copyToClipboard'
  type: string
  success: boolean
}

export interface RequestCreateBranch {
  command: 'createBranch'
  repo: string
  commitHash: string
  branchName: string
}
export interface ResponseCreateBranch {
  command: 'createBranch'
  error: GitCommandError
}

export interface RequestDeleteBranch {
  command: 'deleteBranch'
  repo: string
  branchName: string
  forceDelete: boolean
}
export interface ResponseDeleteBranch {
  command: 'deleteBranch'
  error: GitCommandError
}

export interface RequestDeleteRemoteBranch {
  command: 'deleteRemoteBranch'
  repo: string
  branchName: string
  remote: string
}
export interface ResponseDeleteRemoteBranch {
  command: 'deleteRemoteBranch'
  error: GitCommandError
}

export interface RequestDeleteTag {
  command: 'deleteTag'
  repo: string
  tagName: string
}
export interface ResponseDeleteTag {
  command: 'deleteTag'
  error: GitCommandError
}

export interface RequestFetch {
  command: 'fetch'
  repo: string
}
export interface ResponseFetch {
  command: 'fetch'
  error: GitCommandError
}

export interface RequestFetchAvatar {
  command: 'fetchAvatar'
  repo: string
  email: string
  commits: string[]
}
export interface ResponseFetchAvatar {
  command: 'fetchAvatar'
  email: string
  image: string
}

export interface RequestLoadBranches {
  command: 'loadBranches'
  repo: string
  showRemoteBranches: boolean
  hard: boolean
}
export interface ResponseLoadBranches {
  command: 'loadBranches'
  branches: string[]
  head: string | null
  hard: boolean
  isRepo: boolean
  error: GitCommandError
}

export interface RequestLoadCommits {
  command: 'loadCommits'
  repo: string
  branches: string[] | null // null => Show All
  maxCommits: number
  showRemoteBranches: boolean
  hard: boolean
}
export interface ResponseLoadCommits {
  command: 'loadCommits'
  commits: GitCommitNode[]
  head: string | null
  remotes: string[]
  moreCommitsAvailable: boolean
  hard: boolean
  error: GitCommandError
}

export interface RequestLoadRepos {
  command: 'loadRepos'
  check: boolean
}
export interface ResponseLoadRepos {
  command: 'loadRepos'
  repos: GitRepoSet
  lastActiveRepo: string | null
  loadRepo: string | null
}

export interface RequestMergeBranch {
  command: 'mergeBranch'
  repo: string
  branchName: string
  createNewCommit: boolean
  squash: boolean
}
export interface ResponseMergeBranch {
  command: 'mergeBranch'
  error: GitCommandError
}

export interface RequestMergeCommit {
  command: 'mergeCommit'
  repo: string
  commitHash: string
  createNewCommit: boolean
  squash: boolean
}
export interface ResponseMergeCommit {
  command: 'mergeCommit'
  error: GitCommandError
}

export interface RequestPushBranch {
  command: 'pushBranch'
  repo: string
  branchName: string
  remote: string
  setUpstream: boolean
}
export interface ResponsePushBranch {
  command: 'pushBranch'
  error: GitCommandError
}

export interface RequestPushTag {
  command: 'pushTag'
  repo: string
  tagName: string
  remote: string
}
export interface ResponsePushTag {
  command: 'pushTag'
  error: GitCommandError
}

export interface RequestRebaseOn {
  command: 'rebaseOn'
  repo: string
  type: RebaseOnType
  base: string
  ignoreDate: boolean
  interactive: boolean
}
export interface ResponseRebaseOn {
  command: 'rebaseOn'
  type: RebaseOnType
  interactive: boolean
  error: GitCommandError
}

export interface ResponseRefresh {
  command: 'refresh'
}

export interface RequestRenameBranch {
  command: 'renameBranch'
  repo: string
  oldName: string
  newName: string
}
export interface ResponseRenameBranch {
  command: 'renameBranch'
  error: GitCommandError
}

export interface RequestResetToCommit {
  command: 'resetToCommit'
  repo: string
  commitHash: string
  resetMode: GitResetMode
}
export interface ResponseResetToCommit {
  command: 'resetToCommit'
  error: GitCommandError
}

export interface RequestRevertCommit {
  command: 'revertCommit'
  repo: string
  commitHash: string
  parentIndex: number
}
export interface ResponseRevertCommit {
  command: 'revertCommit'
  error: GitCommandError
}

export interface RequestSaveRepoState {
  command: 'saveRepoState'
  repo: string
  state: GitRepoState
}

export interface RequestViewDiff {
  command: 'viewDiff'
  repo: string
  fromHash: string
  toHash: string
  oldFilePath: string
  newFilePath: string
  type: GitFileChangeType
}
export interface ResponseViewDiff {
  command: 'viewDiff'
  success: boolean
}

export interface RequestViewScm {
  command: 'viewScm'
}
export interface ResponseViewScm {
  command: 'viewScm'
  success: boolean
}

export type RequestMessage =
  | RequestAddTag
  | RequestRemoteUrl
  | RequestCheckoutBranch
  | RequestCheckoutCommit
  | RequestCherrypickCommit
  | RequestCleanUntrackedFiles
  | RequestCommitDetails
  | RequestCompareCommits
  | RequestCopyToClipboard
  | RequestCreateBranch
  | RequestDeleteBranch
  | RequestDeleteRemoteBranch
  | RequestDeleteTag
  | RequestFetch
  | RequestFetchAvatar
  | RequestLoadBranches
  | RequestLoadCommits
  | RequestLoadRepos
  | RequestMergeBranch
  | RequestMergeCommit
  | RequestPushBranch
  | RequestPushTag
  | RequestRebaseOn
  | RequestRenameBranch
  | RequestResetToCommit
  | RequestRevertCommit
  | RequestSaveRepoState
  | RequestViewDiff
  | RequestViewScm

export type ResponseMessage =
  | ResponseAddTag
  | ResponseRemoteUrl
  | ResponseCheckoutBranch
  | ResponseCheckoutCommit
  | ResponseCherrypickCommit
  | ResponseCleanUntrackedFiles
  | ResponseCompareCommits
  | ResponseCommitDetails
  | ResponseCopyToClipboard
  | ResponseCreateBranch
  | ResponseDeleteBranch
  | ResponseDeleteRemoteBranch
  | ResponseDeleteTag
  | ResponseFetch
  | ResponseFetchAvatar
  | ResponseLoadBranches
  | ResponseLoadCommits
  | ResponseLoadRepos
  | ResponseMergeBranch
  | ResponseMergeCommit
  | ResponsePushBranch
  | ResponsePushTag
  | ResponseRebaseOn
  | ResponseRefresh
  | ResponseRenameBranch
  | ResponseResetToCommit
  | ResponseRevertCommit
  | ResponseViewDiff
  | ResponseViewScm
