# Contributing to Git Graph

Thank you for taking the time to contribute!

The following are a set of guidelines for contributing to vscode-git-graph.

## Code of Conduct

This project and everyone participating in it is governed by the [Git Graph Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [mhutchie@16right.com](mailto:mhutchie@16right.com).

## How Can I Contribute?

### Reporting Bugs

Raise a bug you've found to help us improve! Due to the extremely broad nature of Git repositories, some bugs might slip through the cracks.

Check the [open bugs](https://github.com/mhutchie/vscode-git-graph/issues?q=is%3Aissue+is%3Aopen+label%3A"bugs"), and bugs ready for release on the [project board](https://github.com/mhutchie/vscode-git-graph/projects/1#column-4514040) to see if it is already in the process of being resolved. If it is, give the issue a thumbs up, and help provide additional context if the issue author was unable to provide some details.

If the bug hasn't previously been reported, please follow these steps:
1. Raise an issue by selecting the "Bug Report" template on [this page](https://github.com/mhutchie/vscode-git-graph/issues/new/choose).
2. Follow the template as you see appropriate, it's only meant to be a guide.
3. Click "Submit new issue"

We aim to respond promptly, and get it resolved as quickly as possible.

### Feature Suggestions

Suggest an idea for this extension! We want to make Git Graph an even more useful tool in Visual Studio Code, so any suggestions you have are greatly appreciated.

Check the [open feature requests](https://github.com/mhutchie/vscode-git-graph/issues?q=is%3Aissue+is%3Aopen+label%3A"feature+request"), and feature requests ready for release on the [project board](https://github.com/mhutchie/vscode-git-graph/projects/1#column-4514040) to see if your idea is already under consideration or on its way. If it is, give the issue a thumbs up so it will be higher prioritsed.

If your feature hasn't previously been suggested, please follow these steps:
1. Raise an issue by selecting the "Feature Request" template on [this page](https://github.com/mhutchie/vscode-git-graph/issues/new/choose).
2. Follow the template as you see appropriate, it's only meant to be a guide.
3. Click "Submit new issue"

We aim to respond promptly, and prioritise it as we and the community see appropriate.

### Contributing To Development

If you're interested in helping contribute, find an open issue you'd like to work on and comment on it.

To set up your development environment, please follow these steps:
1. Clone the repo
2. Open the repo in Visual Studio Code
3. In the terminal, run `npm run install` to download the required dependencies
4. Install the tslint extension if it is not already installed
5. Create and checkout a branch for the issue you're going to work on

The npm scripts are as follows:
`npm run compile` compiles both front and backend code
`npm run compile-src` compiles the backend code only
`npm run compile-web` compiles the frontend code only

Raise a pull request once you've completed development, we'll have a look at it.

#### Style Guide

The required style is produced by running "Format Document" in Visual Studio Code.
