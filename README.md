# Git Graph extension for Visual Studio Code

View a Git Graph of your repository, and easily perform Git actions from the graph. Configurable to look the way you want!

![Recording of Git Graph](https://github.com/mhutchie/vscode-git-graph/raw/master/resources/demo.gif)

## Features

* Git Graph View:
    * Display:
        * Local & Remote Branches
        * Local Refs: Heads, Tags & Remotes
        * Uncommitted Changes
    * Perform Git Actions (available by right clicking on a commit / branch / tag):
        * Create, Checkout, Delete, Fetch, Merge, Pull, Push, Rebase, Rename & Reset Branches
        * Add, Delete & Push Tags
        * Checkout, Cherry Pick, Drop, Merge & Revert Commits
        * Clean, Reset & Stash Uncommitted Changes
        * Apply, Create Branch From, Drop & Pop Stashes
        * View annotated tag details (name, email, date and message)
        * Copy commit hashes, and branch, stash & tag names to the clipboard
    * View commit details and file changes by clicking on a commit. On the Commit Details View you can:
        * View the Visual Studio Code Diff of any file change by clicking on it.
        * Open the current version of any file that was affected in the commit.
        * Copy the path of any file that was affected in the commit to the clipboard.
        * Click on any HTTP/HTTPS url in the commit body to open it in your default web browser.
    * Compare any two commits by clicking on a commit, and then CTRL/CMD clicking on another commit. On the Commit Comparison View you can:
        * View the Visual Studio Code Diff of any file change between the selected commits by clicking on it.
        * Open the current version of any file that was affected between the selected commits.
        * Copy the path of any file that was affected between the selected commits to the clipboard.
    * Code Review - Keep track of which files you have reviewed in the Commit Details & Comparison Views.
        * Code Review's can be performed on any commit, or between any two commits (not on Uncommitted Changes).
        * When a Code Review is started, all files needing to be reviewed are bolded. When you view the diff / open a file, it will then be un-bolded.
        * Code Reviews persist across Visual Studio Code sessions. They are automatically closed after 90 days of inactivity.
    * View uncommitted changes, and compare the uncommitted changes with any commit.
    * Hover over any commit vertex on the graph to see a tooltip indicating:
        * Whether the commit is included in the HEAD.
        * Which branches, tags and stashes include the commit. 
    * Filter the branches shown in Git Graph using the 'Branches' dropdown menu. The options for filtering the branches are:
        * Show All branches
        * Select one or more branches to be viewed
        * Select from a user predefined array of custom glob patterns (by setting `git-graph.customBranchGlobPatterns`)
    * Fetch from Remote(s) _(available on the top control bar)_
    * Find Widget allows you to quickly find one or more commits containing a specific phrase (in the commit message / date / author / hash, branch or tag names).
    * Repository Settings Widget allows you to view, add, edit, delete, fetch & prune remotes of the repository.
    * Keyboard Shortcuts:
        * Up / Down Arrows: When the Commit Details View is open, pressing the up and down arrow keys opens the previous or next commits' Commit Details View.
        * CTRL/CMD + f: Open the find widget.
        * CTRL/CMD + r: Refresh the Git Graph View.
        * Enter: If a dialog is open, pressing enter submits the dialog, taking the primary (left) action.
        * Escape: Closes the active dialog, context menu or the Commit Details View.
    * Resize the width of each column, and show/hide the Date, Author & Commit columns.
    * Common Emoji Shortcodes are automatically replaced with the corresponding emoji in commit messages (including all [gitmoji](https://gitmoji.carloscuesta.me/)). Custom Emoji Shortcode mappings can be defined in `git-graph.customEmojiShortcodeMappings`.
* A broad range of configurable settings (e.g. graph style, branch colours, and more...). See the 'Extension Settings' section below for more information.
* "Git Graph" launch button in the Status Bar
* "Git Graph: View Git Graph" launch command in the Command Palette

## Extension Settings

Detailed information of all Git Graph settings is available [here](https://github.com/mhutchie/vscode-git-graph/wiki/Extension-Settings), including: descriptions, screenshots, default values and types.

A summary of the Git Graph extension settings are:

* **Auto Center Commit Details View**: Automatically center the commit details view when it is opened.
* **Combine Local And Remote Branch Labels**: Combine local and remote branch labels if they refer to the same branch, and are on the same commit.
* **Commit Details View Location**: Specifies where the Commit Details View is rendered in the Git Graph view. Default: Inline (with graph)
* **Commit Ordering**: Specifies the order of commits on the Git Graph view. See [git log](https://git-scm.com/docs/git-log#_commit_ordering) for more information on each order option. Default: date
* **Context Menu Actions Visibility**: Customise which context menu actions are visible. For more information, see the documentation [here](https://github.com/mhutchie/vscode-git-graph/wiki/Extension-Settings#context-menu-actions-visibility).
* **Custom Branch Glob Patterns**: An array of Custom Glob Patterns to be shown in the "Branches" dropdown. Example: `[{"name":"Feature Requests", "glob":"heads/feature/*"}]`
* **Custom Emoji Shortcode Mappings**: An array of custom Emoji Shortcode mappings. Example: `[{"shortcode": ":sparkles:", "emoji":"✨"}]`
* **Date Format**: Specifies the date format to be used in the date column of the graph.
* **Date Type**: Specifies the date type to be displayed throughout Git Graph, either the author or commit date.
* **Default Column Visibility**: An object specifying the default visibility of the Date, Author & Commit columns. Example: `{"Date": true, "Author": true, "Commit": true}`
* **Default File View Type**: Sets the default type of File View (Tree or List) used in the Commit Details / Comparison Views. This can be overridden per repository using the controls on the right side of the Commit Details / Comparison Views.
* **Dialog.\***: Set the default options on the following dialogs: Add Tag, Apply Stash, Create Branch, Merge, Pop Stash, Rebase, Reset, and Stash Uncommitted Changes
* **Fetch and Prune**: Before fetching from remote(s) using the Fetch button on the Git Graph View Control Bar, remove any remote-tracking references that no longer exist on the remote. Default: false (disabled)
* **Fetch Avatars**: Fetch avatars of commit authors and committers. Default: false (disabled)
* **File Encoding**: The character set encoding used when retrieving a specific version of repository files (e.g. in the Diff View). A list of all supported encodings can be found [here](https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings). Default: utf8
* **Graph Colours**: Specifies the colours used on the graph.
* **Graph Style**: Specifies the style of the graph.
* **Initial Load Commits**: Specifies the number of commits to initially load.
* **Integrated Terminal Shell**: Specifies the path and filename of the Shell executable to be used by the Visual Studio Code Integrated Terminal, when opened by Git Graph during Interactive Rebase's.
* **Load More Commits**: Specifies the number of commits to load when the "Load More Commits" button is pressed (only shown when more commits are available).
* **Max Depth Of Repo Search**: Specifies the maximum depth of subfolders to search when discovering repositories in the workspace. Default: 0 (don't search subfolders)
* **Mute Merge Commits**: Show merge commits with a muted text colour. Default: true (enabled)
* **Open Diff Tab Location**: Specifies which pane the Visual Studio Code Diff is opened in. Default: Active
* **Open To The Repo Of The Active Text Editor Document**: Open Git Graph to the repository containing the active Text Editor document. Default: false (disabled)
* **Reference Label Alignment**: Specifies how branch and tag reference labels are aligned for each commit.
* **Retain Context When Hidden**: Specifies if the Git Graph view Visual Studio Code context is kept when the panel is no longer visible (e.g. moved to background tab). Enabling this setting will make Git Graph load significantly faster when switching back to the Git Graph tab, however has a higher memory overhead. Default: true (enabled)
* **Show Commits Only Referenced By Tags**: Show commits that are only referenced by tags in Git Graph. Default: true (enabled)
* **Show Current Branch By Default**: Show the current branch by default when Git Graph is opened. Default: false (show all branches)
* **Show Status Bar Item**: Show a Status Bar item which opens Git Graph when clicked.
* **Show Uncommitted Changes**: Show uncommitted changes (set to false to decrease load time on large repositories).
* **Source Code Provider Integration Location**: Specifies where the "View Git Graph" action appears on the title of SCM Providers. Default: Inline
* **Tab Icon Colour Theme**: Specifies the colour theme of the icon displayed on the Git Graph tab.
* **Use Mailmap**: Respect [.mailmap](https://git-scm.com/docs/git-check-mailmap#_mapping_authors) files when displaying author & committer names and email addresses. Default: false (disabled)

This extension consumes the following settings:

* `git.path`: Specifies the path and filename of a portable Git installation.

## Extension Commands

This extension contributes the following commands:

* `git-graph.view`: Git Graph: View Git Graph
* `git-graph.addGitRepository`: Git Graph: Add Git Repository _(can be used to add sub-repos to Git Graph)_
* `git-graph.clearAvatarCache`: Git Graph: Clear Avatar Cache
* `git-graph.endAllWorkspaceCodeReviews`: Git Graph: End All Code Reviews in Workspace
* `git-graph.removeGitRepository`: Git Graph: Remove Git Repository _(can be used to remove repositories from Git Graph)_

## Release Notes

Detailed Release Notes are available [here](CHANGELOG.md).

## Visual Studio Marketplace

This extension is available on the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph) for Visual Studio Code.

## Acknowledgements

Thank you to all of the contributors that help with the development of Git Graph!

Some of the icons used in Git Graph are from the following sources, please support them for their excellent work!
- [GitHub Octicons](https://octicons.github.com/) ([License](https://github.com/primer/octicons/blob/master/LICENSE))
- [Icons8](https://icons8.com/icon/pack/free-icons/ios11) ([License](https://icons8.com/license))