# Git Graph extension for Visual Studio Code

View a Git Graph of your repository in Visual Studio Code. Configurable to look the way you want!

![Recording of Git Graph](https://github.com/mhutchie/vscode-git-graph/raw/master/resources/demo.gif)

## Features

* Git Graph Visualisation
    * Display Local & Remote Branches
    * Display Refs: Heads, Tags & Remotes
    * Display Uncommitted Changes
* Configurable settings (e.g. graph style, branch colours, and more...)
* "Git Graph: View Git Graph" launch command in the Command Palette
* "Git Graph" launch button in the Status Bar

## Extension Settings

This extension contributes the following settings:

* `git-graph.graphColours`: Specifies the colours used on the graph.
* `git-graph.graphStyle`: Specifies the style of the graph.
* `git-graph.dateFormat`: Specifies the number of commits to initially load.
* `git-graph.initialLoadCommits`: Specifies the number of commits to initially load.
* `git-graph.loadMoreCommits`: Specifies the number of commits to load when the "Load More Commits" button is pressed (only shown when more commits are available).
* `git-graph.showStatusBarItem`: Show a Status Bar item which opens Git Graph when clicked.
* `git-graph.showUncommittedChanges`: Show uncommitted changes (set to false to decrease load time on large repositories).

## Extension Commands

This extension contributes the following commands:

* `git-graph.view`: Git Graph: View Git Graph

## Coming Soon

* Interact with commits shown on the Git Graph:
    * View Changes in commit
    * Create Branch from commit
    * Add Tag to commit
    * Checkout Branch

## Release Notes
Detailed Release Notes are available [here](CHANGELOG.md).
