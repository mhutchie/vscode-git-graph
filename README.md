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
        * View the Visual Studio Code Diff of any file change by clicking on it in the Commit Details View.
    * Compare commits by clicking on a commit, and then CTRL/CMD clicking on another commit
        * View the Visual Studio Code Diff of any file change between the selected commits by clicking on the desired file in the Commit Details View.
    * Perform Git Actions (available by right clicking on a commit / branch / tag):
        * Create, Checkout, Rename, Delete & Merge branches
        * Add, Delete & Push tags
        * Checkout, Cherry Pick, Merge & Revert commits
        * Reset current branch to commit
        * Copy commit hashes, tag names & branch names to the clipboard
    * Keyboard Shortcuts:
        * Up / Down Arrows: When the Commit Details View is open, pressing the up and down arrow keys opens the previous or next commits' Commit Details View.
        * CTRL/CMD + r: Refresh the Git Graph View.
        * Enter: If a dialog is open, pressing enter submits the dialog, taking the primary (left) action.
        * Escape: Closes the active dialog, context menu or the Commit Details View.
* A broad range of configurable settings (e.g. graph style, branch colours, and more...). See the 'Extension Settings' section below for more information.
* "Git Graph" launch button in the Status Bar
* "Git Graph: View Git Graph" launch command in the Command Palette

## Extension Settings

Detailed information of all Git Graph settings is available [here](https://github.com/mhutchie/vscode-git-graph/wiki/Extension-Settings), including: descriptions, screenshots, default values and types.

A summary of the Git Graph extension settings are:

* **Auto Center Commit Details View**: Automatically center the commit details view when it is opened.
* **Commit Details View Location**: Specifies where the Commit Details View is rendered in the Git Graph view. Default: Inline (with graph)
* **Date Format**: Specifies the date format to be used in the date column of the graph.
* **Date Type**: Specifies the date type to be displayed throughout Git Graph, either the author or commit date.
* **Fetch Avatars**: Fetch avatars of commit authors and committers. Default: false (disabled)
* **Graph Colours**: Specifies the colours used on the graph.
* **Graph Style**: Specifies the style of the graph.
* **Initial Load Commits**: Specifies the number of commits to initially load.
* **Load More Commits**: Specifies the number of commits to load when the "Load More Commits" button is pressed (only shown when more commits are available).
* **Max Depth Of Repo Search**: Specifies the maximum depth of subfolders to search when discovering repositories in the workspace. Default: 0 (don't search subfolders)
* **Show Current Branch By Default**: Show the current branch by default when Git Graph is opened. Default: false (show all branches)
* **Show Status Bar Item**: Show a Status Bar item which opens Git Graph when clicked.
* **Show Uncommitted Changes**: Show uncommitted changes (set to false to decrease load time on large repositories).
* **Tab Icon Colour Theme**: Specifies the colour theme of the icon displayed on the Git Graph tab.

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