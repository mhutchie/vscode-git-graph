# Change Log

## Happy Holidays & New Year
I'd like to wish everyone Happy Holidays and all the best for the New Year! Thank you all for using and supporting Git Graph this year, and making it a part of your development workflow. I first released Git Graph just 11 months ago, and in this short amount of time over 170 feature requests & improvements driven by your feedback have been implemented. I look forward to making Git Graph an even more useful tool in 2020, there's heaps of exciting new features on their way! 

## 1.20.0 - 2019-12-24
* #139 Added a new Extension Setting `git-graph.muteCommitsThatAreNotAncestorsOfHead`, that when enabled will display commits that aren't ancestors of the checked-out branch / commit with a muted text colour. 
* #219 Added a new Extension Setting `git-graph.openRepoToHead`, that when enabled will scroll the Git Graph View to be centered on the commit referenced by HEAD when opening or switching repositories. Default: false (disabled)
* #222 Resolve symbolic links when Git Graph is opened via the Visual Studio Code Source Control View.
* #223 Enhancements to Issue Linking:
    * New checkbox to use the "Issue Regex" and "Issue URL" for all repositories by default (it can be overridden per repository). Note: "Use Globally" is only suitable if identical Issue Linking applies to the majority of your repositories (e.g. when using JIRA or Pivotal Tracker).
    * Automatically prefill the "Issue Regex" field if a common issue pattern is detected in commit messages in the repository.
* #227 Format the leading whitespace of lines in commit messages (in the Commit Details View) and tag messages (in the Tag Details Dialog).
* #232 Limit the maximum width of the Control Bar dropdowns to improve support for lower resolution viewports and long branch names.
* #233 Added an "Always Accept" checkbox on the "Checkout Commit" Dialog.
* #237 When a commit in the graph is a stash, it is now displayed differently from normal commits.
* Various code and UI improvements.

## 1.19.1 - 2019-11-27
* #221 Fixed a compatibility issue with Visual Studio Code Remote Development that was introduced in Git Graph 1.19.0.

## 1.19.0 - 2019-11-27
* #220 Issue Linking - Converts issue numbers in commit messages into hyperlinks, that open the issue in your issue tracking system. This is configured in the Repository Settings Widget (opened from the Git Graph View's Control Bar).
* #208 Include the Untracked Files of Stashes in the Commit Details View.
* #213 Added a new extension setting to set the default state of the "Force Delete" checkbox on the "Delete Branch" dialog.
* #215 Added "Open Git Graph Extension Settings" button on the Repository Settings Widget.
* #216 Added a new "Show Tags" Extension Setting, that can be overridden per repository in the Git Graph View's Repository Settings Widget. Default: true (enabled)
* #218 New Keyboard Shortcut `CTRL/CMD + h` scrolls the Git Graph View to be centered on the commit referenced by HEAD.
* Numerous code and UI improvements, including:
    * #209 Improved handling of Electron `*.asar` files.
    * Push Branch & Push Tag Dialogs now default to pushing to `origin` in repositories with multiple remotes (if it exists).
    * Find Widget - Updated icons, tooltips, and added a new `SHIFT+Enter` keystroke to go to the previous match.

## 1.18.0 - 2019-11-05
* #202 New File List View in the Commit Details / Comparison Views, as an alternative to the existing File Tree View. The default File View Type can be specified using the setting `git-graph.defaultFileViewType`. This can be overridden per repository using the new controls on the right side of the Commit Details / Comparison Views.
* #197 Improved the default column widths when the table is being automatically laid out on narrow width views.
* #198 Customise which context menu actions are visible with the new extension setting `git-graph.contextMenuActionsVisibility`. For more information, see the documentation [here](https://github.com/mhutchie/vscode-git-graph/wiki/Extension-Settings#context-menu-actions-visibility).
* #204 Added a new option to reinstate indexed changes on both the apply and pop stash actions.
* #205 Dialogs now use custom input controls to create a more seamless experience, that respects the active Visual Studio Code Color Theme.
* Various code and UI improvements.

## 1.17.0 - 2019-10-08
* #128 New "Fetch into local branch..." action on the remote branch context menu. This only appears if a local branch shares the same name as the branch being fetched, and the local branch is not checked out.
* #185 Added two new date format options, "ISO Date & Time" and "ISO Date Only", to the Extension Setting `git-graph.dateFormat`.
* #186 Added a new field to the "Add Tag" dialog that enables the extension to push the tag to a remote once it is added. Default: false (can be configured with the new setting `git-graph.dialog.addTag.pushToRemote`)
* #188 Added a new "No Commit" checkbox to the "Cherry Pick Commit" dialog that enables a commits changes to be staged but not committed. This allows you to select and commit specific parts of the cherry picked commit.
* #189 Fixed the handling of filenames containing double quotes in the Commit Details View.
* #190 Show / hide branches of individual remotes from the Repository Settings Widget.
* #192 Fixed the handling of filenames containing URI fragment and query string separators when opening the Diff view.
* Various code, performance, and UI improvements (including #191).

## 1.16.0 - 2019-09-22
* #156 Hover over any commit vertex on the graph to see a tooltip indicating:
    * Whether the commit is included in the HEAD.
    * Which branches, tags and stashes include the commit.
* #161 New option on the "Delete Branch" dialog to also delete the branch on the remote(s). This only appears if one or more remotes contain a branch with the same name as the branch being deleted.
* #180 New "Pop..." action on the Stash Context Menu.
* #181 Added new extension settings to set the default options on the following dialogs: Reset Current Branch To Commit, Reset Uncommitted Changes, and Stash Uncommitted Changes.
* #183 Graph construction, representation, and layout improvements, that produce a better visualisation, and enable topological analysis for exciting new and upcoming features.
* Various code and UI improvements.

## 1.15.0 - 2019-09-13
* #48 Support for Stashes
    * Show Stashes on the Git Graph View.
    * Stash Context Menu:
        * Apply Stash...
        * Create Branch from Stash...
        * Drop Stash...
        * Copy Stash Name to Clipboard
        * Copy Stash Hash to Clipboard
    * New "Stash uncommitted changes..." action on the Uncommitted Changes Context Menu.
    * Commit Details & Comparison View support for Stashes.
* #172 Prevent Visual Studio Code automatically requesting package.json files from Git Graph in the background, when README.md file diffs are opened from the Commit Details & Comparison Views.
* #173 Use .gitmodules (if configured) to automatically add Git submodules to Git Graph.
* #174 New "Drop..." action on the commit context menu to drop a single commit. This is only available on commits without branching or merging in their children.
* #175 Double clicking "Show All" in the Branches dropdown now selects/unselects all branches. This makes it faster to select all but one or two branches. Thanks [Thibault Matot (@thmatot)](https://github.com/thmatot)!
* #177 Display path hints if necessary in the "Repo" dropdown to differentiate multiple repositories that have the same name.
* #178 New setting `git-graph.showCommitsOnlyReferencedByTags` specifies whether commits that are only referenced by tags should be shown in Git Graph. Default: true (enabled)
* Various code, performance, and UI improvements.

## 1.14.0 - 2019-09-02
* Commit Details & Comparison View Enhancements:
    * #122 Code Review - Keep track of which files you have reviewed in the Commit Details & Comparison Views.
        * Code Review's can be performed on any commit, or between any two commits (not on Uncommitted Changes).
        * There is a new button on the right of the Commit Details & Comparison Views to start and stop a code review.
        * When a Code Review is started, all files needing to be reviewed are bolded. When you view the diff / open a file, it will then be un-bolded.
        * Code Reviews persist across Visual Studio Code sessions.
    * #122 The last file viewed is now indicated with an "eye" icon. It's only remembered while the view is open, or until a Code Review is finished.
    * #151 The height and divider of the Commit Details View can now be dragged and resized to better suit your projects. The configured dimensions are stored per repository, across Visual Studio Code sessions.
    * #164 Increased the resolution of commit author avatars for High DPI / Retina Displays. This only applies to all avatars fetched after this update is installed. To trigger higher resolution versions of cached avatars to be fetched (instead of waiting until their next automatic background refresh), you can run the command "Git Graph: Clear Avatar Cache" once, and reopen the Git Graph View.
* #163 Fixed: Viewing branches that share the same name as a file in the repository.
* #165 If the user changes `git.path` to a valid Git executable, the extension will now switch to use it, even if another known Git executable is already being used.
* #168 Fixed: A race condition causing the stdout output of a few Git commands to only be partially returned for a small number of users.
* Various code and UI improvements.

## 1.13.0 - 2019-08-16
* #143 New setting `git-graph.useMailmap` enables the use of .mailmap files when displaying author & committer names and email addresses.
* #145 Added new extension settings to set the default options on the following dialogs: Add Tag, Create Branch, Merge, and Rebase
* #146 New command "Git Graph: Remove Git Repository" removes a repository from Git Graph.
* #149 New setting `git-graph.integratedTerminalShell` allows a specific Shell (not the default) to be used by the Visual Studio Code Integrated Terminal, when opened by Git Graph during Interactive Rebase's. For security reasons, this setting can only be specified in the User Settings, not in the Workspace Settings.
* #150 New setting `git-graph.fileEncoding` specifies the character set encoding used when retrieving a specific version of repository files (e.g. in the Diff View). A list of all supported encodings can be found [here](https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings). Default: utf8
* #154 Fetch Enhancements:
    * New setting `git-graph.fetchAndPrune` enables pruning when fetching from remote(s) using the Fetch button on the Git Graph View Control Bar. Default: false (disabled)
    * Fetch or Prune a specific remote from the Repository Settings widget.
* #155 If a known sub repository is included in the Commit Details View file tree, clicking on it will now load it in the Git Graph View.
* #158 Improved repository management for various Visual Studio Code and Git repository workflows.
* #159 Added force push option on the "Push Branch" dialog.
* #160 Fixed: Shell color codes were included in the Branches dropdown when the user overrides Git Config "color.branch" to "always".
* Various code and UI improvements. 

## 1.12.1 - 2019-07-23
* #137 Fixed a file path construction issue when Visual Studio Code is opened to a subfolder of a repository, and the user clicks to view the current version of a file from the Commit Details View.
* #141 Include the object and commit hashes when showing the new "View Details" action on annotated tags.
* #142 New button to copy the path of any file displayed in the Commit Details View or Commit Comparison View file trees to the clipboard (to the right of each file).
* Various code improvements.

## 1.12.0 - 2019-07-21
* #129 Added logging through a Visual Studio Code Output Channel. The logs currently include all Git commands that are run, and numerous core extension events.
* #130 Added support for repositories with a significant number of branches (1000+).
* #131 When checking out a remote branch and the new branch name already exists, prompt the user with a new dialog to choose another name, or check out the existing branch.
* #135 Git Graph now behaves the same as the Visual Studio Code Git Extensions git executable detection. This allows:
    * A better first experience for users who don't have a Git executable in their PATH.
    * Two new error pages (replacing the existing "Unable to load Git Graph" error page). These new pages provide more useful information and actions to users who are presented with an error.
* #136 View annotated tag details (name, email, date and message) from the tag context menu.
* Various code improvements.

## 1.11.0 - 2019-07-13
* #95 New repository settings menu (opened by clicking on the new settings icon on the top right control bar). Thanks [Raphaël Balet (@rbalet)](https://github.com/rbalet) for helping with this! From the repository settings menu, you can:
    * View the remotes of the repository
    * Add a new remote to the repository
    * Edit an existing remote of the repository
    * Delete an existing remote of the repository
* #117 New setting `git-graph.commitOrdering` allows you to choose the order of commits (date, date-author or topo). See [git log](https://git-scm.com/docs/git-log#_commit_ordering) for more information on each order option. Default: date
* #119 New option to immediately check out a branch after it has been created with the "Create Branch..." action.
* #123 Persist the "Show Remote Branches" checkbox state across Git Graph view sessions per repository.
* #125 Extend avatar fetching to support SSH GitHub & GitLab remotes (prior support for GitHub & GitLab was for HTTPS remotes only).
* #126 When "Show All" is selected for the visible branches, include the HEAD commit on the graph when it is not on a branch (e.g. during rebasing).
* Various code improvements.

## 1.10.0 - 2019-07-02
* #108 New button to open any file displayed in the Commit Details View or Commit Comparison View file trees (to the right of each file).
* #114 Prompt the user for remote credentials if they are requested by commands that communicate with a remote (askpass).
* #115 When running the "Delete Remote Branch..." action and the branch doesn't exist on the remote (i.e. it was already deleted), automatically delete the remote tracking branch instead of showing an error message.
* #116 Detect and generate links for HTTP/HTTPS urls in the commit body on the Commit Details View, so they can be clicked and opened in your default web browser.
* Various minor UI improvements to the Commit Details View and Commit Comparison View file trees.

## 1.9.0 - 2019-06-23
* #31 Find widget allows you to quickly find one or more commits containing a specific phrase (in the commit message / date / author / hash, branch or tag names). The find widget can be activated by the new find icon on the top right control bar, or from the new `CTRL/CMD + f` keystroke.
* #98 New "Pull into current branch..." action available from the remote branch context menu.
* #100 Show merge commits with a muted text colour. This is controlled by the new setting `git-graph.muteMergeCommits`. Default: true (enabled). Thanks [Sebastian Lay (@sebastianlay)](https://github.com/sebastianlay)!
* #104 Common Emoji Shortcodes are automatically replaced with the corresponding emoji in commit messages (including all [gitmoji](https://gitmoji.carloscuesta.me/)). Custom Emoji Shortcode mappings can be defined in `git-graph.customEmojiShortcodeMappings`.
* #105 Add information for troubleshooting repositories in subfolders.
* #107 Support for displaying remote svn branches.
* #109 New option on the existing 'Delete Tag...' action to also delete the tag on a remote (only shown if remotes exist).
* Improved handling of error dialogs.

## 1.8.0 - 2019-06-08
* #90 New command "Git Graph: Add Git Repository" in the Command Palette allows additional Git repositories to be added to Git Graph (e.g. sub-repos).
* #91 New setting to enable Git Graph to open to the repository containing the active Text Editor document `git-graph.openToTheRepoOfTheActiveTextEditorDocument`. Default: false (disabled)
* #92 Various improvements for a better user experience:
    * Display the name of the running Git Action while it is occuring.
    * Maintain the users scroll position when running a Git Action from context menus.
    * The refresh button now indicates if a refresh is occuring.
    * Enabled by default the recently added setting `git-graph.retainContextWhenHidden` to provide near-instant tab restoration when switching back to Git Graph.
    * Many more small tweaks.
* #93 Updates to the push tag action so that it:
    * Only appears if remotes exist
    * Defaults to the remote if only one exists
    * Allows the user to select the remote to push to if multiple exist.
* #94 Support for pushing branches via the local branch context menu. It respects the same new remote conditions as #93.

## 1.7.0 - 2019-05-29
* #34 Support for rebasing the current branch on any branch or commit, from the corresponding branch/commit context menu.
* #57 New "Fetch from Remote(s)" button available on the top control bar (only visible when remotes exist). Redesigned refresh button.
* #79 Show/hide the Date, Author & Commit columns by right clicking on the column header row, and then clicking the desired column to toggle its visibility. The new setting `git-graph.defaultColumnVisibility` can be used to configure the default visibility of each column. For example: `{"Date": true, "Author": true, "Commit": true}`
* #87 More emphasis on the current head branch label.
* Robustness improvements when handling remotes.

## 1.6.0 - 2019-05-24
* #36 New functionality for uncommitted changes:
    * View uncommitted changes by clicking on it, like you would with any commit. 
    * Compare any commit with the uncommitted changes.
    * Three new actions are now available from the new Uncommitted Changes context menu, they are:
        * Reset uncommitted changes to HEAD
        * Clean untracked files
        * Open the Visual Studio Code Source Control View
* New ways to filter branches on the Git Graph view:
    * #77 Allow multiple branches to be selected in the 'Branches' dropdown.
    * #49 Predefine an array of custom glob patterns with the new setting `git-graph.customBranchGlobPatterns`, allowing you to use them anytime from the 'Branches' dropdown. For example: `[{"name": "Feature Requests", "glob": "heads/feature/*"}]`
* #71 Choose from a variety of branch and tag label alignment options to better suit the projects you work on. The alignment options of the new setting `git-graph.referenceLabelAlignment` are:
    * Normal: Show branch & tag labels on the left of the commit message in the 'Description' column.
    * Branches (on the left) & Tags (on the right): Show branch labels on the left of the commit message in the 'Description' column, and tag labels on the right.
    * Branches (aligned to the graph) & Tags (on the right): Show branch labels aligned to the graph in the 'Graph' column, and tag labels on the right in the 'Description' column.
* #30 New setting `git-graph.retainContextWhenHidden` enables faster Git Graph tab restoration at the cost of additional memory usage when Git Graph is opened, but not visible (running in the background). Default: false (not enabled). Thanks [Yu Zhang (@yzhang-gh)](https://github.com/yzhang-gh)!
* #76 Open and view a specific repo in Git Graph directly from the title of a Source Code Provider in the Visual Studio Code SCP View. The new setting `git-graph.sourceCodeProviderIntegrationLocation` specifies if the Git Graph menu item is inline on the title of the Source Code Provider, or on the 'More actions...' menu. Default: Inline
* #78 Combine local and remote branch labels if they refer to the same branch, and are on the same commit. When combined, the local and remote branch context menus are available from the corresponding section of the label. The new setting `git-graph.combineLocalAndRemoteBranchLabels` allows you to disable this behaviour.
* #81 Support for repositories with a very large number of tags. Thanks [egi (@egi)](https://github.com/egi)!
* #83 Support for the upcoming "Remote Development" functionality of Visual Studio Code. Thanks [Kaloyan Arsov (@Dontar)](https://github.com/Dontar) for helping with this!
* #85 New setting `git-graph.openDiffTabLocation` allows you to choose where you'd like the Visual Studio Code Diff to open, either in the Active pane, or Beside to active pane. Default: Active

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
* #26 Fetch and show commit author / committer avatars from GitHub, GitLab & Gravatar. If you'd like to use this feature, you must enable the setting `git-graph.fetchAvatars`. Thanks [Walter Meier (@meierw)](https://github.com/meierw) for helping with the development of this!
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
* #24 Display all lines of the commit body in the commit details view. Thanks [Shoshin Nikita (@ShoshinNikita)](https://github.com/ShoshinNikita)!

## 1.4.1 - 2019-03-09
* #13 Support for multiple Git repositories in multi-root workspaces.
* #8 Improved control bar style, for improved support of different colour themes.
* #23 Changed "Reverse this Commit" to "Revert this Commit", to match the corresponding Git command. Thanks [Larry Lu (@Larry850806)](https://github.com/Larry850806)!
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
* #5 View the Visual Studio Code Diff of a file change in a commit, by clicking on the file in the commit details view.
* All git commands are run asynchronously to improve responsiveness.

## 1.3.0 - 2019-02-16
* #4 Commit details view (click on a commit to open it). This shows the full commit details, and a tree view of all file changes in the commit.
* #2 Support for git reset hard, mixed & soft.
* #1 Add the branch colour to ref labels to make them easier to read.

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