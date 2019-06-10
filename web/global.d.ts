import * as GG from '../out/types'

declare global {
  function acquireVsCodeApi(): {
    getState(): WebViewState | null
    postMessage(message: GG.RequestMessage): void
    setState(state: WebViewState): void
  }

  var viewState: GG.GitGraphViewState

  interface Config {
    autoCenterCommitDetailsView: boolean
    branchLabelsAlignedToGraph: boolean
    combineLocalAndRemoteBranchLabels: boolean
    commitDetailsViewLocation: GG.CommitDetailsViewLocation
    customBranchGlobPatterns: GG.CustomBranchGlobPattern[]
    defaultColumnVisibility: GG.DefaultColumnVisibility
    fetchAvatars: boolean
    graphColours: string[]
    graphStyle: 'rounded' | 'angular'
    grid: { x: number; y: number; offsetX: number; offsetY: number; expandY: number }
    initialLoadCommits: number
    loadMoreCommits: number
    showCurrentBranchByDefault: boolean
    tagLabelsOnRight: boolean
  }

  interface ContextMenuItem {
    title: string
    onClick: () => void
    checked?: boolean // Required in checked context menus
  }

  type ContextMenuElement = ContextMenuItem | null

  interface DialogTextInput {
    type: 'text'
    name: string
    default: string
    placeholder: string | null
  }
  interface DialogTextRefInput {
    type: 'text-ref'
    name: string
    default: string
  }
  interface DialogUrlInput {
    type: 'url'
    name: string
    default: string
    placeholder: string | null
  }
  interface DialogSelectInput {
    type: 'select'
    name: string
    options: { name: string; value: string }[]
    default: string
  }
  // On select, change another input field content
  interface DialogSelectAndChangeInput {
    type: 'selectAndChange'
    name: string
    options: { name: string; value: string }[]
    default: string
  }
  interface DialogCheckboxInput {
    type: 'checkbox'
    name: string
    value: boolean
  }
  type DialogInput =
    | DialogUrlInput
    | DialogTextInput
    | DialogTextRefInput
    | DialogSelectInput
    | DialogCheckboxInput
    | DialogSelectAndChangeInput
  type DialogInputValue = string | boolean

  interface ExpandedCommit {
    id: number
    hash: string
    srcElem: HTMLElement | null
    commitDetails: GG.GitCommitDetails | null
    fileChanges: GG.GitFileChange[] | null
    fileTree: GitFolder | null
    compareWithHash: string | null
    compareWithSrcElem: HTMLElement | null
    loading: boolean
    fileChangesScrollTop: number
  }

  interface GitFile {
    type: 'file'
    name: string
    index: number
  }

  interface GitFolder {
    type: 'folder'
    name: string
    folderPath: string
    contents: GitFolderContents
    open: boolean
  }

  type GitFolderOrFile = GitFolder | GitFile
  type GitFolderContents = { [name: string]: GitFolderOrFile }

  interface Point {
    x: number
    y: number
  }
  interface Line {
    p1: Point
    p2: Point
    lockedFirst: boolean // TRUE => The line is locked to p1, FALSE => The line is locked to p2
  }

  interface Pixel {
    x: number
    y: number
  }
  interface PlacedLine {
    p1: Pixel
    p2: Pixel
    isCommitted: boolean
    lockedFirst: boolean // TRUE => The line is locked to p1, FALSE => The line is locked to p2
  }

  interface UnavailablePoint {
    connectsTo: VertexOrNull
    onBranch: Branch
  }
  type VertexOrNull = Vertex | null

  type AvatarImageCollection = { [email: string]: string }

  interface WebViewState {
    gitRepos: GG.GitRepoSet
    gitBranches: string[]
    gitBranchHead: string | null
    gitRemotes: string[]
    commits: GG.GitCommitNode[]
    commitHead: string | null
    avatars: AvatarImageCollection
    currentBranches: string[] | null
    currentRepo: string
    moreCommitsAvailable: boolean
    maxCommits: number
    showRemoteBranches: boolean
    expandedCommit: ExpandedCommit | null
    scrollTop: number
  }
}

export as namespace GG
export = GG
