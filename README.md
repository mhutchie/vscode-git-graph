# Git Graph extension for Visual Studio Code

View a Git Graph of your repository, and easily perform Git actions from the graph. Configurable to look the way you want!

![Recording of Git Graph](https://github.com/mhutchie/vscode-git-graph/raw/master/resources/demo.gif)

## Features

* Git Graph View:
    * Display:
        * Local & Remote Branches
        * Local Refs: Heads, Tags & Remotes
        * Local Uncommitted Changes
    * View commit details and file changes by clicking on a commit
        * View the Visual Studio Code Diff of a file change by clicking on it in the commit details view
    * Perform Git Actions (available by right clicking on a commit / branch / tag):
        * Create, Checkout, Rename, Delete & Merge branches
        * Add, Delete & Push tags
        * Checkout, Cherry Pick, Merge & Revert commits
        * Reset current branch to commit
        * Copy commit hashes, tag names & branch names to the clipboard
* Configurable settings (e.g. graph style, branch colours, and more...)
* "Git Graph: View Git Graph" launch command in the Command Palette
* "Git Graph" launch button in the Status Bar

## Extension Settings

This extension contributes the following settings:

* `git-graph.autoCenterCommitDetailsView`: Automatically center the commit details view when it is opened.
* `git-graph.dateFormat`: Specifies the date format to be used in the date column of the graph.
* `git-graph.dateType`: Specifies the date type to be displayed throughout Git Graph, either the author or commit date.
* `git-graph.fetchAvatars`: Fetch avatars of commit authors and committers. Default: false (disabled)
* `git-graph.graphColours`: Specifies the colours used on the graph.
* `git-graph.graphStyle`: Specifies the style of the graph.
* `git-graph.initialLoadCommits`: Specifies the number of commits to initially load.
* `git-graph.maxDepthOfRepoSearch`: Specifies the maximum depth of subfolders to search when discovering repositories in the workspace. Default: 0 (don't search subfolders)
* `git-graph.loadMoreCommits`: Specifies the number of commits to load when the "Load More Commits" button is pressed (only shown when more commits are available).
* `git-graph.showCurrentBranchByDefault`: Show the current branch by default when Git Graph is opened. Default: false (show all branches)
* `git-graph.showStatusBarItem`: Show a Status Bar item which opens Git Graph when clicked.
* `git-graph.showUncommittedChanges`: Show uncommitted changes (set to false to decrease load time on large repositories).
* `git-graph.tabIconColourTheme`: Specifies the colour theme of the icon displayed on the Git Graph tab.

This extension consumes the following settings:

* `git.path`: Specifies the path of a portable Git installation.

More information on each setting, including detailed descriptions, default values and types is available [here](https://github.com/mhutchie/vscode-git-graph/wiki/Extension-Settings).

## Extension Commands

This extension contributes the following commands:

* `git-graph.view`: Git Graph: View Git Graph
* `git-graph.clearAvatarCache`: Git Graph: Clear Avatar Cache

## Release Notes

Detailed Release Notes are available [here](CHANGELOG.md).

## Visual Studio Marketplace

This extension is available on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) for Visual Studio Code.