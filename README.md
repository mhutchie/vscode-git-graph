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
        * Add & Delete tags
        * Revert & Cherry Pick commits
        * Reset current branch to commit
        * Copy Commit Hash to Clipboard
* Configurable settings (e.g. graph style, branch colours, and more...)
* "Git Graph: View Git Graph" launch command in the Command Palette
* "Git Graph" launch button in the Status Bar

## Extension Settings

This extension contributes the following settings:

* `git-graph.autoCenterCommitDetailsView`: Automatically center the commit details view when it is opened.
* `git-graph.dateFormat`: Specifies the date format to be used in the date column of the graph.
* `git-graph.graphColours`: Specifies the colours used on the graph.
* `git-graph.graphStyle`: Specifies the style of the graph.
* `git-graph.initialLoadCommits`: Specifies the number of commits to initially load.
* `git-graph.loadMoreCommits`: Specifies the number of commits to load when the "Load More Commits" button is pressed (only shown when more commits are available).
* `git-graph.showCurrentBranchByDefault`: Show the current branch by default when Git Graph is opened. Default: false (show all branches)
* `git-graph.showStatusBarItem`: Show a Status Bar item which opens Git Graph when clicked.
* `git-graph.showUncommittedChanges`: Show uncommitted changes (set to false to decrease load time on large repositories).

This extension consumes the following settings:

* `git.path`: Specifies the path of a portable Git installation.

## Extension Commands

This extension contributes the following commands:

* `git-graph.view`: Git Graph: View Git Graph

## Release Notes

Detailed Release Notes are available [here](CHANGELOG.md).

## Visual Studio Marketplace

This extension is available on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) for Visual Studio Code.