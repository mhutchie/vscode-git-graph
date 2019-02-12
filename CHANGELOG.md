# Change Log

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