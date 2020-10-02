# Contributing to Git Graph

Thank you for taking the time to contribute!

The following are a set of guidelines for contributing to vscode-git-graph.

## Code of Conduct

This project and everyone participating in it is governed by the [Git Graph Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [mhutchie@16right.com](mailto:mhutchie@16right.com).

## How Can I Contribute?

### Reporting Bugs

Raise a bug you've found to help us improve!

Check the [open bugs](https://github.com/mhutchie/vscode-git-graph/issues?q=is%3Aissue+is%3Aopen+label%3A"bugs"), and any fixed bugs ready for release on the [project board](https://github.com/mhutchie/vscode-git-graph/projects/1#column-4514040), to see if it's already being resolved. If it is, give the issue a thumbs up, and help provide additional context if the issue author was unable to provide some details.

If the bug hasn't previously been reported, please follow these steps:
1. Raise an issue using the "Bug Report" template. [Create Bug Report](https://github.com/mhutchie/vscode-git-graph/issues/new?assignees=mhutchie&labels=bug&template=bug-report.md&title=)
2. Complete the template, providing information for all of the required sections.
3. Click "Submit new issue"

We will respond promptly, and get it resolved as quickly as possible.

### Feature Requests

Suggest a new feature for this extension! We want to make Git Graph an even more useful tool in Visual Studio Code, so any suggestions you have are greatly appreciated.

Check the [open feature requests](https://github.com/mhutchie/vscode-git-graph/issues?q=is%3Aissue+is%3Aopen+label%3A"feature+request"), and any feature requests ready for release on the [project board](https://github.com/mhutchie/vscode-git-graph/projects/1#column-4514040), to see if your idea is already under consideration or on its way. If it is, give the issue a thumbs up so it will be higher prioritised.

If your feature hasn't previously been suggested, please follow these steps:
1. Raise an issue using the "Feature Request" template. [Create Feature Request](https://github.com/mhutchie/vscode-git-graph/issues/new?assignees=mhutchie&labels=feature+request&template=feature-request.md&title=)
2. Follow the template as you see appropriate, it's only meant to be a guide.
3. Click "Submit new issue"

We will respond promptly, and your request will be prioritised according to the Git Graph [Issue Prioritisation](https://github.com/mhutchie/vscode-git-graph/wiki/Issue-Prioritisation).

### Improvements

Suggest an improvement to existing functionality of this extension! We want to make Git Graph an even more useful tool in Visual Studio Code, so any improvements you have are greatly appreciated.

Check the [open improvements](https://github.com/mhutchie/vscode-git-graph/issues?q=is%3Aissue+is%3Aopen+label%3A"improvement"), and any improvements ready for release on the [project board](https://github.com/mhutchie/vscode-git-graph/projects/1#column-4514040), to see if your improvement is already under consideration or on its way. If it is, give the issue a thumbs up so it will be higher prioritised.

If your improvement hasn't previously been suggested, please follow these steps:
1. Raise an issue using the "Improvement" template. [Create Improvement](https://github.com/mhutchie/vscode-git-graph/issues/new?assignees=mhutchie&labels=improvement&template=improvement.md&title=)
2. Follow the template as you see appropriate, it's only meant to be a guide.
3. Click "Submit new issue"

We will respond promptly, and your request will be prioritised according to the Git Graph [Issue Prioritisation](https://github.com/mhutchie/vscode-git-graph/wiki/Issue-Prioritisation).

### Contributing To Development

If you're interested in helping contribute, either:
* Find an open issue you'd like to work on, and comment on it. Once the code owner has responded with some background information and initial ideas, it will be assigned to you to work on.
* Raise an issue describing the feature you'd like to work on, mentioning that you'd like to implement it. Once it has been responded to by the code owner, it has been confirmed as a suitable feature of Git Graph and it will be assigned to you to work on.

Step 1: To set up your development environment, please follow these steps:
1. Install [Node.js](https://nodejs.org/en/) if it is not already installed.
2. Clone the [vscode-git-graph](https://github.com/mhutchie/vscode-git-graph) repo on GitHub.
3. Open the repo in Visual Studio Code.
4. In the Visual Studio Code terminal, run `npm install` to automatically download all of the required Node.js dependencies.
5. Install the [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) extension if it is not already installed.
6. Create and checkout a branch for the issue you're going to work on.

Step 2: Review the [Codebase Outline](https://github.com/mhutchie/vscode-git-graph/wiki/Codebase-Outline), so you have a general understanding of the structure of the codebase.

Step 3: To compile the code, run the appropriate npm script in the Visual Studio Code terminal as follows:
* `npm run compile`: Compiles both front and backend code
* `npm run compile-src`: Compiles the backend code only
* `npm run compile-web`: Compiles the frontend code only, with minification.
* `npm run compile-web-debug`: Compiles the frontend code, without minification.

_Note: When you first open the codebase, you'll need to run `npm run compile-src` so that the types defined by the backend are made available for the frontend to use, otherwise there will be a number of type errors in the frontend code. Similarly, if you make a change to the backend types that you also want to use in the frontend via the GG namespace, you'll need to run `npm run compile-src` before they can be used._

Step 4: To quickly test your changes:
* Pressing F5 launches the Extension Development Host in a new window, overriding the installed version of Git Graph with the version compiled in Step 3. You can:
    * Use the extension to test your changes
    * View the Webview Developer Tools by running the Visual Studio Code command `Developer: Open Webview Developer Tools`. This allows you to:
        * View the front end JavaScript console
        * View and modify the CSS rules (temporarily)
        * View and modify the DOM tree (temporarily)
        * If you ran `npm run compile-web-debug` in Step 3, you can also add breakpoints to the compiled frontend JavaScript.
* Switching back to the Visual Studio Code window that you were in (from Step 3), you can:
    * Add breakpoints to the backend TypeScript
    * Restart the Extension Development Host
    * Stop the Extension Development Host

Step 5: To do a complete test of your changes:
1. Install Visual Studio Code Extensions `npm install -g vsce` if it is not already installed.
2. Change the version of the extension defined in `package.json` on line 4 to an alpha release, for example `1.13.0-alpha.0`. You should increment the alpha version each time you package a modified version of the extension. _Make sure you don't commit the version number with your changes._
3. Run the npm script `npm run package-and-install` in the Visual Studio Code terminal. This will compile and package the extension into a `vsix` file, and then install it.
4. Restart Visual Studio Code, and verify that you have the correct alpha version installed.
5. Test out the extension, it will behave exactly the same as a published release.

Step 6: Raise a pull request once you've completed development, we'll have a look at it.

#### Style Guide

The required style is produced by running "Format Document" in Visual Studio Code.
