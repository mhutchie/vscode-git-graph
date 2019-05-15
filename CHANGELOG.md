# Change Log

## 1.5.0 - 2019-05-15
* #29 Compare commits: When the Commit Details View is open for a commit, CTRL/CMD click on another commit to see all of the changes between the two commits.
* #60 Added a tooltip on repo dropdown items, indicating the full path of the repository.
* #62 Support for non-ASCII file names in the Commit Details View.
* #63 Commits can be squashed when merging if the "Squash commits" checkbox is checked on the commit and branch merge dialogs.
* #64 Delete remote branches from the right click context menu of the remote branch.
* #73 New keyboard shortcuts:
    * Up / Down Arrows: When the Commit Details View is open, pressing the up and down arrow keys opens the previous or next commits' Commit Details View.
    * CTRL/CMD + r: Refresh the Git Graph.
    * Enter: If a dialog is open, pressing enter submits the dialog, taking the primary (left) action.
* #74 Dock the Commit Details View to the bottom of the Git Graph view with the new setting `git-graph.commitDetailsViewLocation`, instead of rendering inline with the graph. Default: Inline (with graph)

## 1.4.6 - 2019-04-30
* #33 Support for git repositories in subfolders. New setting `git-graph.maxDepthOfRepoSearch` specifies the maximum depth of subfolders to search (default: 0).
* #50 Branch and repo dropdowns now have a filter to make it faster to find the desired item.
* #52 Copy branch and tag names to the clipboard.
* #53 Flattened the control bar and column header elements, to better suit the majority of Visual Studio Code Themes.
* #54 Graph rendering algorithm changes: performance improvements, and better layout of intermediate branch merges.
* #55 Robustness improvements of the avatar caching mechanism.
* #58 Removed the checkout and delete actions from the context menu of the checked out branch.
* #59 Various performance improvements for: opening Git Graph, loading commits, and opening the commit details view.

## 1.4.5 - 2019-04-15
* #26 Fetch and show commit author / committer avatars from GitHub, GitLab & Gravatar. If you'd like to use this feature, you must enable the setting `git-graph.fetchAvatars`. Thanks @meierw for helping with the development of this!
* #37 Columns can be resized by dragging the dividers in the table header.
* #43 Add more emphasis to the head commit.
* #44 Improved the documentation and descriptions of extension settings.
* #45 Include commits from heads that are only referenced by tags.
* #46 Fixed graph node misalignment when Visual Studio Code is zoomed.
* #51 Observe Visual Studio Code theme changes while Git Graph is open, now required due to a change in Visual Studio Code 1.33.0.

## 1.4.4 - 2019-04-01
* #27 Add lightweight or annotated tags. Add message (optional) to annotated tags.
* #35 Merge a specific commit from the commit context menu.
* #38 Push a tag to origin from the tag context menu.
* #39 Checkout a branch by double clicking on the branch label.
* #40 Reworded context menu actions. Use ellipses to differentiate non-immediate actions. Added support for dividers in the context menus to better segment actions.
* #41 Load the last viewed repo when opening Git Graph in a multi-root workspace.
* #42 New setting `git-graph.dateType` to specify the date type to be displayed, either the author or commit date.

## 1.4.3 - 2019-03-17
* #17 Automatic refresh when repo changes while Git Graph is visible.
* #32 Checkout a specific commit from the commit context menu.
* #20 Hide the "Git Graph" status bar item when the workspace has no Git repository.
* #28 Fixed the text colour used for dropdowns and dialogs, to support use with other VSCode colour themes.
* Added the Git Graph icon to the tab when Git Graph is opened. By default the icon is coloured, but it can be set to greyscale with the new configuration setting `git-graph.tabIconColourTheme`.

## 1.4.2 - 2019-03-10
* #22 New setting to show the current branch by default when Git Graph is opened, instead of showing all branches. By default `git-graph.showCurrentBranchByDefault` is false.
* #24 Display all lines of the commit body in the commit details view. Thanks @ShoshinNikita!

## 1.4.1 - 2019-03-09
* #13 Support for multiple Git repositories in multi-root workspaces.
* #8 Improved control bar style, for improved support of different colour themes.
* #23 Changed "Reverse this Commit" to "Revert this Commit", to match the corresponding Git command. Thanks @Larry850806!
* Several minor consistency improvements.

## 1.4.0 - 2019-02-28
* #12 Revert, cherry-pick & merge git commands are now available from the commit and branch context menus.
* #7 Added a setting to enable / disable automatic centering of the commit details view.
* #11 Context menu closes on the next mouse interaction, instead of when the mouse leaves the context menu.
* #15 Support for portable git installations.
* #18 Fixed handling of detached HEAD's.

## 1.3.3 - 2019-02-22
* #3 & #9: Fixes an issue preventing the graph loading for a few git repositories.
* #10: Fixes an issue where lines extending past the rightmost node of the graph would be cropped.
* Press escape to close any open Git Graph dialog.
* #6: The command title in the Command Palette is changed to "Git Graph: View Git Graph (git log)".
* Refined styling of the commit details view.

## 1.3.2 - 2019-02-18
* Fixes an issue when viewing some large graphs of more than 500 commits.
* Significantly reduced package size.

## 1.3.1 - 2019-02-17
* View the Visual Studio Code Diff of a file change in a commit, by clicking on the file in the commit details view.
* All git commands are run asynchronously to improve responsiveness.

## 1.3.0 - 2019-02-16
* Commit details view (click on a commit to open it). This shows the full commit details, and a tree view of all file changes in the commit.
* Support for git reset hard, mixed & soft.
* Add the branch colour to ref labels to make them easier to read.

## 1.2.0 - 2019-02-12
* Graph generation improvements, making complex graphs easier to read
* Graph rendering performance improvements
* Improved graph styling

## 1.1.0 - 2019-02-11
* Perform Git actions directly from Git Graph by right clicking on a commit / branch / tag:
    * Create, Checkout, Rename & Delete Branches
    * Add & Delete Tags
    * Copy Commit Hash to Clipboard
* Graph generation improvements

## 1.0.1 - 2019-02-10
* Detect & display lightweight tags

## 1.0.0 - 2019-02-10
* Initial release
* Git Graph Visualisation
    * Select from Local & Remote Branches
    * Display Heads, Tags & Remotes
    * Configuration Settings:
        * git-graph.graphColours - Specifies the colours used on the graph.
        * git-graph.graphStyle - Specifies the style of the graph.
        * git-graph.dateFormat - Specifies the number of commits to initially load.
        * git-graph.initialLoadCommits - Specifies the number of commits to initially load.
        * git-graph.loadMoreCommits - Specifies the number of commits to load when the "Load More Commits" button is pressed (only shown when more commits are available).
        * git-graph.showStatusBarItem - Show a Status Bar item which opens Git Graph when clicked.
        * git-graph.showUncommittedChanges - Show uncommitted changes (set to false to decrease load time on large repositories).
* Shortcut Button in the Status Bar