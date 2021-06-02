import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });

import { getConfig } from '../src/config';
import { CommitDetailsViewLocation, CommitOrdering, DateFormatType, DateType, FileViewType, GitResetMode, GraphStyle, GraphUncommittedChangesStyle, RepoDropdownOrder, SquashMessageFormat, TabIconColourTheme, TagType } from '../src/types';

import { expectRenamedExtensionSettingToHaveBeenCalled } from './helpers/expectations';

const workspaceConfiguration = vscode.mocks.workspaceConfiguration;

type Config = ReturnType<typeof getConfig>;

describe('Config', () => {
	let config: Config;
	beforeEach(() => {
		config = getConfig();
	});

	it('Should construct a Config instance', () => {
		// Run
		getConfig();

		// Assert
		expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('git-graph', undefined);
	});

	it('Should construct a Config instance (for a specific repository)', () => {
		// Run
		getConfig('/path/to/repo');

		// Assert
		expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('git-graph', {
			scheme: 'file',
			authority: '',
			path: '/path/to/repo',
			query: '',
			fragment: ''
		});
	});

	describe('commitDetailsView', () => {
		describe('autoCenter', () => {
			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.autoCenter', true);

				// Run
				const value = config.commitDetailsView.autoCenter;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.autoCenter', 'autoCenterCommitDetailsView');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.autoCenter', false);

				// Run
				const value = config.commitDetailsView.autoCenter;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.autoCenter', 'autoCenterCommitDetailsView');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.autoCenter', 5);

				// Run
				const value = config.commitDetailsView.autoCenter;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.autoCenter', 'autoCenterCommitDetailsView');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.autoCenter', 0);

				// Run
				const value = config.commitDetailsView.autoCenter;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.autoCenter', 'autoCenterCommitDetailsView');
				expect(value).toBe(false);
			});

			it('Should return the default value (TRUE) when the configuration value is unknown', () => {
				// Run
				const value = config.commitDetailsView.autoCenter;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.autoCenter', 'autoCenterCommitDetailsView');
				expect(value).toBe(true);
			});
		});

		describe('fileTreeCompactFolders', () => {
			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.fileView.fileTree.compactFolders', true);

				// Run
				const value = config.commitDetailsView.fileTreeCompactFolders;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.fileTree.compactFolders', 'commitDetailsViewFileTreeCompactFolders');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.fileView.fileTree.compactFolders', false);

				// Run
				const value = config.commitDetailsView.fileTreeCompactFolders;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.fileTree.compactFolders', 'commitDetailsViewFileTreeCompactFolders');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.fileView.fileTree.compactFolders', 5);

				// Run
				const value = config.commitDetailsView.fileTreeCompactFolders;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.fileTree.compactFolders', 'commitDetailsViewFileTreeCompactFolders');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.fileView.fileTree.compactFolders', 0);

				// Run
				const value = config.commitDetailsView.fileTreeCompactFolders;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.fileTree.compactFolders', 'commitDetailsViewFileTreeCompactFolders');
				expect(value).toBe(false);
			});

			it('Should return the default value (TRUE) when the configuration value is unknown', () => {
				// Run
				const value = config.commitDetailsView.fileTreeCompactFolders;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.fileTree.compactFolders', 'commitDetailsViewFileTreeCompactFolders');
				expect(value).toBe(true);
			});
		});

		describe('fileViewType', () => {
			it('Should return FileViewType.Tree when the configuration value is "File Tree"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.fileView.type', 'File Tree');

				// Run
				const value = config.commitDetailsView.fileViewType;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.type', 'defaultFileViewType');
				expect(value).toBe(FileViewType.Tree);
			});

			it('Should return FileViewType.List when the configuration value is "File List"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.fileView.type', 'File List');

				// Run
				const value = config.commitDetailsView.fileViewType;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.type', 'defaultFileViewType');
				expect(value).toBe(FileViewType.List);
			});

			it('Should return the default value (FileViewType.Tree) when the configuration value is invalid', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.fileView.type', 'invalid');

				// Run
				const value = config.commitDetailsView.fileViewType;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.type', 'defaultFileViewType');
				expect(value).toBe(FileViewType.Tree);
			});

			it('Should return the default value (FileViewType.Tree) when the configuration value is unknown', () => {
				// Run
				const value = config.commitDetailsView.fileViewType;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.type', 'defaultFileViewType');
				expect(value).toBe(FileViewType.Tree);
			});
		});

		describe('location', () => {
			it('Should return CommitDetailsViewLocation.Inline when the configuration value is "Inline"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.location', 'Inline');

				// Run
				const value = config.commitDetailsView.location;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.location', 'commitDetailsViewLocation');
				expect(value).toBe(CommitDetailsViewLocation.Inline);
			});

			it('Should return CommitDetailsViewLocation.DockedToBottom when the configuration value is "Docked to Bottom"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.location', 'Docked to Bottom');

				// Run
				const value = config.commitDetailsView.location;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.location', 'commitDetailsViewLocation');
				expect(value).toBe(CommitDetailsViewLocation.DockedToBottom);
			});

			it('Should return the default value (CommitDetailsViewLocation.Inline) when the configuration value is invalid', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('commitDetailsView.location', 'invalid');

				// Run
				const value = config.commitDetailsView.location;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.location', 'commitDetailsViewLocation');
				expect(value).toBe(CommitDetailsViewLocation.Inline);
			});

			it('Should return the default value (CommitDetailsViewLocation.Inline) when the configuration value is unknown', () => {
				// Run
				const value = config.commitDetailsView.location;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.location', 'commitDetailsViewLocation');
				expect(value).toBe(CommitDetailsViewLocation.Inline);
			});
		});
	});

	describe('contextMenuActionsVisibility', () => {
		it('Should return the default value (all items enabled) when the configuration value is invalid', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('contextMenuActionsVisibility', 1);

			// Run
			const value = config.contextMenuActionsVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('contextMenuActionsVisibility', {});
			expect(value).toStrictEqual({
				branch: {
					checkout: true,
					rename: true,
					delete: true,
					merge: true,
					rebase: true,
					push: true,
					viewIssue: true,
					createPullRequest: true,
					createArchive: true,
					selectInBranchesDropdown: true,
					unselectInBranchesDropdown: true,
					copyName: true
				},
				commit: {
					addTag: true,
					createBranch: true,
					checkout: true,
					cherrypick: true,
					revert: true,
					drop: true,
					merge: true,
					rebase: true,
					reset: true,
					copyHash: true,
					copySubject: true
				},
				commitDetailsViewFile: {
					viewDiff: true,
					viewFileAtThisRevision: true,
					viewDiffWithWorkingFile: true,
					openFile: true,
					markAsReviewed: true,
					markAsNotReviewed: true,
					resetFileToThisRevision: true,
					copyAbsoluteFilePath: true,
					copyRelativeFilePath: true
				},
				remoteBranch: {
					checkout: true,
					delete: true,
					fetch: true,
					merge: true,
					pull: true,
					viewIssue: true,
					createPullRequest: true,
					createArchive: true,
					selectInBranchesDropdown: true,
					unselectInBranchesDropdown: true,
					copyName: true
				},
				stash: {
					apply: true,
					createBranch: true,
					pop: true,
					drop: true,
					copyName: true,
					copyHash: true
				},
				tag: {
					viewDetails: true,
					delete: true,
					push: true,
					createArchive: true,
					copyName: true
				},
				uncommittedChanges: {
					stash: true,
					reset: true,
					clean: true,
					openSourceControlView: true
				}
			});
		});

		it('Should return the default value (all items enabled) when the configuration value is not set', () => {
			// Run
			const value = config.contextMenuActionsVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('contextMenuActionsVisibility', {});
			expect(value).toStrictEqual({
				branch: {
					checkout: true,
					rename: true,
					delete: true,
					merge: true,
					rebase: true,
					push: true,
					viewIssue: true,
					createPullRequest: true,
					createArchive: true,
					selectInBranchesDropdown: true,
					unselectInBranchesDropdown: true,
					copyName: true
				},
				commit: {
					addTag: true,
					createBranch: true,
					checkout: true,
					cherrypick: true,
					revert: true,
					drop: true,
					merge: true,
					rebase: true,
					reset: true,
					copyHash: true,
					copySubject: true
				},
				commitDetailsViewFile: {
					viewDiff: true,
					viewFileAtThisRevision: true,
					viewDiffWithWorkingFile: true,
					openFile: true,
					markAsReviewed: true,
					markAsNotReviewed: true,
					resetFileToThisRevision: true,
					copyAbsoluteFilePath: true,
					copyRelativeFilePath: true
				},
				remoteBranch: {
					checkout: true,
					delete: true,
					fetch: true,
					merge: true,
					pull: true,
					viewIssue: true,
					createPullRequest: true,
					createArchive: true,
					selectInBranchesDropdown: true,
					unselectInBranchesDropdown: true,
					copyName: true
				},
				stash: {
					apply: true,
					createBranch: true,
					pop: true,
					drop: true,
					copyName: true,
					copyHash: true
				},
				tag: {
					viewDetails: true,
					delete: true,
					push: true,
					createArchive: true,
					copyName: true
				},
				uncommittedChanges: {
					stash: true,
					reset: true,
					clean: true,
					openSourceControlView: true
				}
			});
		});

		it('Should only affect the provided configuration overrides', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('contextMenuActionsVisibility', {
				branch: {
					rename: false
				},
				commit: {
					checkout: false
				},
				commitDetailsViewFile: {
					resetFileToThisRevision: false
				},
				remoteBranch: {
					delete: true,
					fetch: false,
					pull: true
				}
			});

			// Run
			const value = config.contextMenuActionsVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('contextMenuActionsVisibility', {});
			expect(value).toStrictEqual({
				branch: {
					checkout: true,
					rename: false,
					delete: true,
					merge: true,
					rebase: true,
					push: true,
					viewIssue: true,
					createPullRequest: true,
					createArchive: true,
					selectInBranchesDropdown: true,
					unselectInBranchesDropdown: true,
					copyName: true
				},
				commit: {
					addTag: true,
					createBranch: true,
					checkout: false,
					cherrypick: true,
					revert: true,
					drop: true,
					merge: true,
					rebase: true,
					reset: true,
					copyHash: true,
					copySubject: true
				},
				commitDetailsViewFile: {
					viewDiff: true,
					viewFileAtThisRevision: true,
					viewDiffWithWorkingFile: true,
					openFile: true,
					markAsReviewed: true,
					markAsNotReviewed: true,
					resetFileToThisRevision: false,
					copyAbsoluteFilePath: true,
					copyRelativeFilePath: true
				},
				remoteBranch: {
					checkout: true,
					delete: true,
					fetch: false,
					merge: true,
					pull: true,
					viewIssue: true,
					createPullRequest: true,
					createArchive: true,
					selectInBranchesDropdown: true,
					unselectInBranchesDropdown: true,
					copyName: true
				},
				stash: {
					apply: true,
					createBranch: true,
					pop: true,
					drop: true,
					copyName: true,
					copyHash: true
				},
				tag: {
					viewDetails: true,
					delete: true,
					push: true,
					createArchive: true,
					copyName: true
				},
				uncommittedChanges: {
					stash: true,
					reset: true,
					clean: true,
					openSourceControlView: true
				}
			});
		});
	});

	describe('customBranchGlobPatterns', () => {
		it('Should return a filtered array of glob patterns based on the configuration value', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('customBranchGlobPatterns', [
				{ name: 'Name 1', glob: 'glob1' },
				{ name: 'Name 2', glob: 'glob2' },
				{ name: 'Name 3' },
				{ name: 'Name 4', glob: 'glob4' }
			]);

			// Run
			const value = config.customBranchGlobPatterns;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('customBranchGlobPatterns', []);
			expect(value).toHaveLength(3);
			expect(value[0]).toStrictEqual({ name: 'Name 1', glob: '--glob=glob1' });
			expect(value[1]).toStrictEqual({ name: 'Name 2', glob: '--glob=glob2' });
			expect(value[2]).toStrictEqual({ name: 'Name 4', glob: '--glob=glob4' });
		});

		it('Should return the default value ([]) when the configuration value is not set', () => {
			// Run
			const value = config.customBranchGlobPatterns;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('customBranchGlobPatterns', []);
			expect(value).toHaveLength(0);
		});
	});

	describe('customEmojiShortcodeMappings', () => {
		it('Should return a filtered array of emoji shortcode mappings based on the configuration value', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('customEmojiShortcodeMappings', [
				{ shortcode: 'dog', emoji: '🍎' },
				{ shortcode: 'cat', emoji: '🎨' },
				{ shortcode: 'bird' },
				{ shortcode: 'fish', emoji: '🐛' }
			]);

			// Run
			const value = config.customEmojiShortcodeMappings;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('customEmojiShortcodeMappings', []);
			expect(value).toStrictEqual([
				{ shortcode: 'dog', emoji: '🍎' },
				{ shortcode: 'cat', emoji: '🎨' },
				{ shortcode: 'fish', emoji: '🐛' }
			]);
		});

		it('Should return the default value ([]) when the configuration value is not set', () => {
			// Run
			const value = config.customEmojiShortcodeMappings;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('customEmojiShortcodeMappings', []);
			expect(value).toHaveLength(0);
		});
	});

	describe('customPullRequestProviders', () => {
		it('Should return a filtered array of pull request providers based on the configuration value', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('customPullRequestProviders', [
				{ name: 'dog', templateUrl: '$1/$2' },
				{ name: 'cat', templateUrl: '$1/$3' },
				{ name: 'bird' },
				{ name: 'fish', templateUrl: '$1/$4' },
				{ templateUrl: '$1/$5' }
			]);

			// Run
			const value = config.customPullRequestProviders;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('customPullRequestProviders', []);
			expect(value).toStrictEqual([
				{ name: 'dog', templateUrl: '$1/$2' },
				{ name: 'cat', templateUrl: '$1/$3' },
				{ name: 'fish', templateUrl: '$1/$4' }
			]);
		});

		it('Should return the default value ([]) when the configuration value is invalid', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('customPullRequestProviders', 5);

			// Run
			const value = config.customPullRequestProviders;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('customPullRequestProviders', []);
			expect(value).toHaveLength(0);
		});

		it('Should return the default value ([]) when the configuration value is not set', () => {
			// Run
			const value = config.customPullRequestProviders;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('customPullRequestProviders', []);
			expect(value).toHaveLength(0);
		});
	});

	describe('dateFormat', () => {
		it('Should successfully parse the configuration value "Date & Time"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('date.format', 'Date & Time');

			// Run
			const value = config.dateFormat;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: false });
		});

		it('Should successfully parse the configuration value "Date Only"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('date.format', 'Date Only');

			// Run
			const value = config.dateFormat;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateOnly, iso: false });
		});

		it('Should successfully parse the configuration value "ISO Date & Time"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('date.format', 'ISO Date & Time');

			// Run
			const value = config.dateFormat;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: true });
		});

		it('Should successfully parse the configuration value "ISO Date Only"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('date.format', 'ISO Date Only');

			// Run
			const value = config.dateFormat;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateOnly, iso: true });
		});

		it('Should successfully parse the configuration value "Relative"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('date.format', 'Relative');

			// Run
			const value = config.dateFormat;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.Relative, iso: false });
		});

		it('Should return the default value when the configuration value is invalid', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('date.format', 'invalid');

			// Run
			const value = config.dateFormat;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: false });
		});

		it('Should return the default value when the configuration value is unknown', () => {
			// Run
			const value = config.dateFormat;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: false });
		});
	});

	describe('dateType', () => {
		it('Should return DateType.Author when the configuration value is "Author Date"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('date.type', 'Author Date');

			// Run
			const value = config.dateType;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('date.type', 'dateType');
			expect(value).toBe(DateType.Author);
		});

		it('Should return DateType.Commit when the configuration value is "Commit Date"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('date.type', 'Commit Date');

			// Run
			const value = config.dateType;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('date.type', 'dateType');
			expect(value).toBe(DateType.Commit);
		});

		it('Should return the default value (DateType.Author) when the configuration value is invalid', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('date.type', 'invalid');

			// Run
			const value = config.dateType;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('date.type', 'dateType');
			expect(value).toBe(DateType.Author);
		});

		it('Should return the default value (DateType.Author) when the configuration value is unknown', () => {
			// Run
			const value = config.dateType;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('date.type', 'dateType');
			expect(value).toBe(DateType.Author);
		});
	});

	describe('defaultColumnVisibility', () => {
		it('Should successfully parse the configuration value (Date column disabled)', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('defaultColumnVisibility', { Date: false, Author: true, Commit: true });

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: false, author: true, commit: true });
		});

		it('Should successfully parse the configuration value (Author column disabled)', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('defaultColumnVisibility', { Date: true, Author: false, Commit: true });

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: true, author: false, commit: true });
		});

		it('Should successfully parse the configuration value (Commit  column disabled)', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('defaultColumnVisibility', { Date: true, Author: true, Commit: false });

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: true, author: true, commit: false });
		});

		it('Should return the default value when the configuration value is invalid (not an object)', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('defaultColumnVisibility', 'invalid');

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: true, author: true, commit: true });
		});

		it('Should return the default value when the configuration value is invalid (NULL)', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('defaultColumnVisibility', null);

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: true, author: true, commit: true });
		});

		it('Should return the default value when the configuration value is invalid (column value is not a boolean)', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('defaultColumnVisibility', { Date: true, Author: true, Commit: 5 });

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: true, author: true, commit: true });
		});

		it('Should return the default value when the configuration value is not set', () => {
			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: true, author: true, commit: true });
		});
	});

	describe('dialogDefaults', () => {
		it('Should return TRUE values for boolean-based configuration values when they are TRUE', () => {
			// Setup
			[
				'dialog.addTag.pushToRemote',
				'dialog.applyStash.reinstateIndex',
				'dialog.cherryPick.noCommit',
				'dialog.cherryPick.recordOrigin',
				'dialog.createBranch.checkOut',
				'dialog.deleteBranch.forceDelete',
				'dialog.fetchIntoLocalBranch.forceFetch',
				'dialog.fetchRemote.prune',
				'dialog.fetchRemote.pruneTags',
				'dialog.merge.noCommit',
				'dialog.merge.noFastForward',
				'dialog.merge.squashCommits',
				'dialog.popStash.reinstateIndex',
				'dialog.pullBranch.noFastForward',
				'dialog.pullBranch.squashCommits',
				'dialog.rebase.ignoreDate',
				'dialog.rebase.launchInteractiveRebase',
				'dialog.stashUncommittedChanges.includeUntracked'
			].forEach((section) => vscode.mockExtensionSettingReturnValue(section, true));

			// Run
			const value = config.dialogDefaults;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.pushToRemote', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.type', 'Annotated');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.applyStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchIntoLocalBranch.forceFetch', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.general.referenceInputSpaceSubstitution', 'None');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.noFastForward', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.ignoreDate', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.launchInteractiveRebase', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetCurrentBranchToCommit.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetUncommittedChanges.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.stashUncommittedChanges.includeUntracked', true);
			expect(value).toStrictEqual({
				addTag: {
					pushToRemote: true,
					type: TagType.Annotated
				},
				applyStash: {
					reinstateIndex: true
				},
				cherryPick: {
					noCommit: true,
					recordOrigin: true
				},
				createBranch: {
					checkout: true
				},
				deleteBranch: {
					forceDelete: true
				},
				fetchIntoLocalBranch: {
					forceFetch: true
				},
				fetchRemote: {
					prune: true,
					pruneTags: true
				},
				general: {
					referenceInputSpaceSubstitution: null
				},
				merge: {
					noCommit: true,
					noFastForward: true,
					squash: true
				},
				popStash: {
					reinstateIndex: true
				},
				pullBranch: {
					noFastForward: true,
					squash: true
				},
				rebase: {
					ignoreDate: true,
					interactive: true
				},
				resetCommit: {
					mode: GitResetMode.Mixed
				},
				resetUncommitted: {
					mode: GitResetMode.Mixed
				},
				stashUncommittedChanges: {
					includeUntracked: true
				}
			});
		});

		it('Should return FALSE values for boolean-based configuration values when they are FALSE', () => {
			// Setup
			[
				'dialog.addTag.pushToRemote',
				'dialog.applyStash.reinstateIndex',
				'dialog.cherryPick.noCommit',
				'dialog.cherryPick.recordOrigin',
				'dialog.createBranch.checkOut',
				'dialog.deleteBranch.forceDelete',
				'dialog.fetchIntoLocalBranch.forceFetch',
				'dialog.fetchRemote.prune',
				'dialog.fetchRemote.pruneTags',
				'dialog.merge.noCommit',
				'dialog.merge.noFastForward',
				'dialog.merge.squashCommits',
				'dialog.popStash.reinstateIndex',
				'dialog.pullBranch.noFastForward',
				'dialog.pullBranch.squashCommits',
				'dialog.rebase.ignoreDate',
				'dialog.rebase.launchInteractiveRebase',
				'dialog.stashUncommittedChanges.includeUntracked'
			].forEach((section) => vscode.mockExtensionSettingReturnValue(section, false));

			// Run
			const value = config.dialogDefaults;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.pushToRemote', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.type', 'Annotated');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.applyStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchIntoLocalBranch.forceFetch', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.general.referenceInputSpaceSubstitution', 'None');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.noFastForward', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.ignoreDate', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.launchInteractiveRebase', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetCurrentBranchToCommit.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetUncommittedChanges.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.stashUncommittedChanges.includeUntracked', true);
			expect(value).toStrictEqual({
				addTag: {
					pushToRemote: false,
					type: TagType.Annotated
				},
				applyStash: {
					reinstateIndex: false
				},
				cherryPick: {
					noCommit: false,
					recordOrigin: false
				},
				createBranch: {
					checkout: false
				},
				deleteBranch: {
					forceDelete: false
				},
				fetchIntoLocalBranch: {
					forceFetch: false
				},
				fetchRemote: {
					prune: false,
					pruneTags: false
				},
				general: {
					referenceInputSpaceSubstitution: null
				},
				merge: {
					noCommit: false,
					noFastForward: false,
					squash: false
				},
				popStash: {
					reinstateIndex: false
				},
				pullBranch: {
					noFastForward: false,
					squash: false
				},
				rebase: {
					ignoreDate: false,
					interactive: false
				},
				resetCommit: {
					mode: GitResetMode.Mixed
				},
				resetUncommitted: {
					mode: GitResetMode.Mixed
				},
				stashUncommittedChanges: {
					includeUntracked: false
				}
			});
		});

		it('Should return TRUE values for boolean-based configuration values when they are truthy', () => {
			// Setup
			[
				'dialog.addTag.pushToRemote',
				'dialog.applyStash.reinstateIndex',
				'dialog.cherryPick.noCommit',
				'dialog.cherryPick.recordOrigin',
				'dialog.createBranch.checkOut',
				'dialog.deleteBranch.forceDelete',
				'dialog.fetchIntoLocalBranch.forceFetch',
				'dialog.fetchRemote.prune',
				'dialog.fetchRemote.pruneTags',
				'dialog.merge.noCommit',
				'dialog.merge.noFastForward',
				'dialog.merge.squashCommits',
				'dialog.popStash.reinstateIndex',
				'dialog.pullBranch.noFastForward',
				'dialog.pullBranch.squashCommits',
				'dialog.rebase.ignoreDate',
				'dialog.rebase.launchInteractiveRebase',
				'dialog.stashUncommittedChanges.includeUntracked'
			].forEach((section) => vscode.mockExtensionSettingReturnValue(section, 1));

			// Run
			const value = config.dialogDefaults;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.pushToRemote', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.type', 'Annotated');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.applyStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchIntoLocalBranch.forceFetch', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.general.referenceInputSpaceSubstitution', 'None');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.noFastForward', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.ignoreDate', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.launchInteractiveRebase', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetCurrentBranchToCommit.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetUncommittedChanges.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.stashUncommittedChanges.includeUntracked', true);
			expect(value).toStrictEqual({
				addTag: {
					pushToRemote: true,
					type: TagType.Annotated
				},
				applyStash: {
					reinstateIndex: true
				},
				cherryPick: {
					noCommit: true,
					recordOrigin: true
				},
				createBranch: {
					checkout: true
				},
				deleteBranch: {
					forceDelete: true
				},
				fetchIntoLocalBranch: {
					forceFetch: true
				},
				fetchRemote: {
					prune: true,
					pruneTags: true
				},
				general: {
					referenceInputSpaceSubstitution: null
				},
				merge: {
					noCommit: true,
					noFastForward: true,
					squash: true
				},
				popStash: {
					reinstateIndex: true
				},
				pullBranch: {
					noFastForward: true,
					squash: true
				},
				rebase: {
					ignoreDate: true,
					interactive: true
				},
				resetCommit: {
					mode: GitResetMode.Mixed
				},
				resetUncommitted: {
					mode: GitResetMode.Mixed
				},
				stashUncommittedChanges: {
					includeUntracked: true
				}
			});
		});

		it('Should return FALSE values for boolean-based configuration values when they are falsy', () => {
			// Setup
			[
				'dialog.addTag.pushToRemote',
				'dialog.applyStash.reinstateIndex',
				'dialog.cherryPick.noCommit',
				'dialog.cherryPick.recordOrigin',
				'dialog.createBranch.checkOut',
				'dialog.deleteBranch.forceDelete',
				'dialog.fetchIntoLocalBranch.forceFetch',
				'dialog.fetchRemote.prune',
				'dialog.fetchRemote.pruneTags',
				'dialog.merge.noCommit',
				'dialog.merge.noFastForward',
				'dialog.merge.squashCommits',
				'dialog.popStash.reinstateIndex',
				'dialog.pullBranch.noFastForward',
				'dialog.pullBranch.squashCommits',
				'dialog.rebase.ignoreDate',
				'dialog.rebase.launchInteractiveRebase',
				'dialog.stashUncommittedChanges.includeUntracked'
			].forEach((section) => vscode.mockExtensionSettingReturnValue(section, 0));

			// Run
			const value = config.dialogDefaults;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.pushToRemote', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.type', 'Annotated');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.applyStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchIntoLocalBranch.forceFetch', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.general.referenceInputSpaceSubstitution', 'None');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.noFastForward', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.ignoreDate', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.launchInteractiveRebase', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetCurrentBranchToCommit.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetUncommittedChanges.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.stashUncommittedChanges.includeUntracked', true);
			expect(value).toStrictEqual({
				addTag: {
					pushToRemote: false,
					type: TagType.Annotated
				},
				applyStash: {
					reinstateIndex: false
				},
				cherryPick: {
					noCommit: false,
					recordOrigin: false
				},
				createBranch: {
					checkout: false
				},
				deleteBranch: {
					forceDelete: false
				},
				fetchIntoLocalBranch: {
					forceFetch: false
				},
				fetchRemote: {
					prune: false,
					pruneTags: false
				},
				general: {
					referenceInputSpaceSubstitution: null
				},
				merge: {
					noCommit: false,
					noFastForward: false,
					squash: false
				},
				popStash: {
					reinstateIndex: false
				},
				pullBranch: {
					noFastForward: false,
					squash: false
				},
				rebase: {
					ignoreDate: false,
					interactive: false
				},
				resetCommit: {
					mode: GitResetMode.Mixed
				},
				resetUncommitted: {
					mode: GitResetMode.Mixed
				},
				stashUncommittedChanges: {
					includeUntracked: false
				}
			});
		});

		it('Should return the default values for text-based configuration values when they are invalid', () => {
			// Setup
			[
				'dialog.addTag.type',
				'dialog.resetCurrentBranchToCommit.mode',
				'dialog.resetUncommittedChanges.mode'
			].forEach((section) => vscode.mockExtensionSettingReturnValue(section, 'invalid'));

			// Run
			const value = config.dialogDefaults;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.pushToRemote', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.type', 'Annotated');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.applyStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchIntoLocalBranch.forceFetch', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.general.referenceInputSpaceSubstitution', 'None');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.noFastForward', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.ignoreDate', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.launchInteractiveRebase', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetCurrentBranchToCommit.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetUncommittedChanges.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.stashUncommittedChanges.includeUntracked', true);
			expect(value).toStrictEqual({
				addTag: {
					pushToRemote: false,
					type: TagType.Annotated
				},
				applyStash: {
					reinstateIndex: false
				},
				cherryPick: {
					noCommit: false,
					recordOrigin: false
				},
				createBranch: {
					checkout: false
				},
				deleteBranch: {
					forceDelete: false
				},
				fetchIntoLocalBranch: {
					forceFetch: false
				},
				fetchRemote: {
					prune: false,
					pruneTags: false
				},
				general: {
					referenceInputSpaceSubstitution: null
				},
				merge: {
					noCommit: false,
					noFastForward: true,
					squash: false
				},
				popStash: {
					reinstateIndex: false
				},
				pullBranch: {
					noFastForward: false,
					squash: false
				},
				rebase: {
					ignoreDate: true,
					interactive: false
				},
				resetCommit: {
					mode: GitResetMode.Mixed
				},
				resetUncommitted: {
					mode: GitResetMode.Mixed
				},
				stashUncommittedChanges: {
					includeUntracked: true
				}
			});
		});

		it('Should return the default values when the configuration values are not set', () => {
			// Run
			const value = config.dialogDefaults;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.pushToRemote', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.addTag.type', 'Annotated');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.applyStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchIntoLocalBranch.forceFetch', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.general.referenceInputSpaceSubstitution', 'None');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.noFastForward', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.ignoreDate', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.rebase.launchInteractiveRebase', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetCurrentBranchToCommit.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.resetUncommittedChanges.mode', 'Mixed');
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.stashUncommittedChanges.includeUntracked', true);
			expect(value).toStrictEqual({
				addTag: {
					pushToRemote: false,
					type: TagType.Annotated
				},
				applyStash: {
					reinstateIndex: false
				},
				cherryPick: {
					noCommit: false,
					recordOrigin: false
				},
				createBranch: {
					checkout: false
				},
				deleteBranch: {
					forceDelete: false
				},
				fetchIntoLocalBranch: {
					forceFetch: false
				},
				fetchRemote: {
					prune: false,
					pruneTags: false
				},
				general: {
					referenceInputSpaceSubstitution: null
				},
				merge: {
					noCommit: false,
					noFastForward: true,
					squash: false
				},
				popStash: {
					reinstateIndex: false
				},
				pullBranch: {
					noFastForward: false,
					squash: false
				},
				rebase: {
					ignoreDate: true,
					interactive: false
				},
				resetCommit: {
					mode: GitResetMode.Mixed
				},
				resetUncommitted: {
					mode: GitResetMode.Mixed
				},
				stashUncommittedChanges: {
					includeUntracked: true
				}
			});
		});

		describe('dialogDefaults.addTag.type', () => {
			it('Should return TagType.Annotated when the configuration value is "Annotated"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('dialog.addTag.type', 'Annotated');

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.addTag.type).toBe(TagType.Annotated);
			});

			it('Should return TagType.Lightweight when the configuration value is "Lightweight"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('dialog.addTag.type', 'Lightweight');

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.addTag.type).toBe(TagType.Lightweight);
			});
		});

		describe('dialogDefaults.general.referenceInputSpaceSubstitution', () => {
			it('Should return NULL when the configuration value is "None"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('dialog.general.referenceInputSpaceSubstitution', 'None');

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.general.referenceInputSpaceSubstitution).toBe(null);
			});

			it('Should return "-" when the configuration value is "Hyphen"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('dialog.general.referenceInputSpaceSubstitution', 'Hyphen');

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.general.referenceInputSpaceSubstitution).toBe('-');
			});

			it('Should return "_" when the configuration value is "Underscore"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('dialog.general.referenceInputSpaceSubstitution', 'Underscore');

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.general.referenceInputSpaceSubstitution).toBe('_');
			});

			it('Should return the default value (NULL) when the configuration value is invalid', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('dialog.general.referenceInputSpaceSubstitution', 'invalid');

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.general.referenceInputSpaceSubstitution).toBe(null);
			});
		});

		describe('dialogDefaults.resetCommit.mode', () => {
			it('Should return GitResetMode.Hard when the configuration value is "Hard"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('dialog.resetCurrentBranchToCommit.mode', 'Hard');

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.resetCommit.mode).toBe(GitResetMode.Hard);
			});

			it('Should return GitResetMode.Mixed when the configuration value is "Mixed"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('dialog.resetCurrentBranchToCommit.mode', 'Mixed');

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.resetCommit.mode).toBe(GitResetMode.Mixed);
			});

			it('Should return GitResetMode.Soft when the configuration value is "Soft"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('dialog.resetCurrentBranchToCommit.mode', 'Soft');

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.resetCommit.mode).toBe(GitResetMode.Soft);
			});
		});

		describe('dialogDefaults.resetUncommitted.mode', () => {
			it('Should return GitResetMode.Hard when the configuration value is "Hard"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('dialog.resetUncommittedChanges.mode', 'Hard');

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.resetUncommitted.mode).toBe(GitResetMode.Hard);
			});

			it('Should return GitResetMode.Mixed when the configuration value is "Mixed"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('dialog.resetUncommittedChanges.mode', 'Mixed');

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.resetUncommitted.mode).toBe(GitResetMode.Mixed);
			});
		});
	});

	describe('squashMergeMessageFormat', () => {
		it('Should return SquashMessageFormat.Default when the configuration value is "Default"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('dialog.merge.squashMessageFormat', 'Default');

			// Run
			const value = config.squashMergeMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.Default);
		});

		it('Should return SquashMessageFormat.GitSquashMsg when the configuration value is "Git SQUASH_MSG"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('dialog.merge.squashMessageFormat', 'Git SQUASH_MSG');

			// Run
			const value = config.squashMergeMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.GitSquashMsg);
		});

		it('Should return the default value (SquashMessageFormat.Default) when the configuration value is invalid', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('dialog.merge.squashMessageFormat', 'invalid');

			// Run
			const value = config.squashMergeMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.Default);
		});

		it('Should return the default value (SquashMessageFormat.Default) when the configuration value is not set', () => {
			// Run
			const value = config.squashMergeMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.Default);
		});
	});

	describe('squashPullMessageFormat', () => {
		it('Should return SquashMessageFormat.Default when the configuration value is "Default"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('dialog.pullBranch.squashMessageFormat', 'Default');

			// Run
			const value = config.squashPullMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.Default);
		});

		it('Should return SquashMessageFormat.GitSquashMsg when the configuration value is "Git SQUASH_MSG"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('dialog.pullBranch.squashMessageFormat', 'Git SQUASH_MSG');

			// Run
			const value = config.squashPullMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.GitSquashMsg);
		});

		it('Should return the default value (SquashMessageFormat.Default) when the configuration value is invalid', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('dialog.pullBranch.squashMessageFormat', 'invalid');

			// Run
			const value = config.squashPullMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.Default);
		});

		it('Should return the default value (SquashMessageFormat.Default) when the configuration value is not set', () => {
			// Run
			const value = config.squashPullMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.Default);
		});
	});

	describe('enhancedAccessibility', testBooleanExtensionSetting('enhancedAccessibility', 'enhancedAccessibility', false));

	describe('fileEncoding', () => {
		it('Should return the configured value', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('fileEncoding', 'file-encoding');

			// Run
			const value = config.fileEncoding;

			expect(workspaceConfiguration.get).toBeCalledWith('fileEncoding', 'utf8');
			expect(value).toBe('file-encoding');
		});

		it('Should return the default configuration value ("utf8")', () => {
			// Run
			const value = config.fileEncoding;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fileEncoding', 'utf8');
			expect(value).toBe('utf8');
		});
	});

	describe('graph', () => {
		describe('colours', () => {
			it('Should return a filtered array of colours based on the configuration value', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('graph.colours', ['#ff0000', '#0000000', '#00ff0088', 'rgb(1,2,3)', 'rgb(1,2,x)']);

				// Run
				const value = config.graph.colours;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('graph.colours', 'graphColours');
				expect(value).toHaveLength(3);
				expect(value[0]).toBe('#ff0000');
				expect(value[1]).toBe('#00ff0088');
				expect(value[2]).toBe('rgb(1,2,3)');
			});

			it('Should return the default value when the configuration value is invalid (not an array)', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('graph.colours', 5);

				// Run
				const value = config.graph.colours;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('graph.colours', 'graphColours');
				expect(value).toStrictEqual(['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00']);
			});

			it('Should return the default value when the configuration value is invalid (an empty array)', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('graph.colours', []);

				// Run
				const value = config.graph.colours;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('graph.colours', 'graphColours');
				expect(value).toStrictEqual(['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00']);
			});

			it('Should return the default value when the configuration value is unknown', () => {
				// Run
				const value = config.graph.colours;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('graph.colours', 'graphColours');
				expect(value).toStrictEqual(['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00']);
			});
		});

		describe('style', () => {
			it('Should return GraphStyle.Rounded when the configuration value is "rounded"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('graph.style', 'rounded');

				// Run
				const value = config.graph.style;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('graph.style', 'graphStyle');
				expect(value).toBe(GraphStyle.Rounded);
			});

			it('Should return GraphStyle.Angular when the configuration value is "angular"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('graph.style', 'angular');

				// Run
				const value = config.graph.style;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('graph.style', 'graphStyle');
				expect(value).toBe(GraphStyle.Angular);
			});

			it('Should return the default value (GraphStyle.Rounded) when the configuration value is invalid', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('graph.style', 'invalid');

				// Run
				const value = config.graph.style;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('graph.style', 'graphStyle');
				expect(value).toBe(GraphStyle.Rounded);
			});

			it('Should return the default value (GraphStyle.Rounded) when the configuration value is unknown', () => {
				// Run
				const value = config.graph.style;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('graph.style', 'graphStyle');
				expect(value).toBe(GraphStyle.Rounded);
			});
		});

		describe('uncommittedChanges', () => {
			it('Should return GraphUncommittedChangesStyle.OpenCircleAtTheUncommittedChanges when the configuration value is "Open Circle at the Uncommitted Changes"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('graph.uncommittedChanges', 'Open Circle at the Uncommitted Changes');

				// Run
				const value = config.graph.uncommittedChanges;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('graph.uncommittedChanges', 'Open Circle at the Uncommitted Changes');
				expect(value).toBe(GraphUncommittedChangesStyle.OpenCircleAtTheUncommittedChanges);
			});

			it('Should return GraphUncommittedChangesStyle.OpenCircleAtTheCheckedOutCommit when the configuration value is "Open Circle at the Checked Out Commit"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('graph.uncommittedChanges', 'Open Circle at the Checked Out Commit');

				// Run
				const value = config.graph.uncommittedChanges;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('graph.uncommittedChanges', 'Open Circle at the Uncommitted Changes');
				expect(value).toBe(GraphUncommittedChangesStyle.OpenCircleAtTheCheckedOutCommit);
			});

			it('Should return the default value (GraphUncommittedChangesStyle.OpenCircleAtTheUncommittedChanges) when the configuration value is invalid', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('graph.uncommittedChanges', 'invalid');

				// Run
				const value = config.graph.uncommittedChanges;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('graph.uncommittedChanges', 'Open Circle at the Uncommitted Changes');
				expect(value).toBe(GraphUncommittedChangesStyle.OpenCircleAtTheUncommittedChanges);
			});

			it('Should return the default value (GraphUncommittedChangesStyle.OpenCircleAtTheUncommittedChanges) when the configuration value is unknown', () => {
				// Run
				const value = config.graph.uncommittedChanges;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('graph.uncommittedChanges', 'Open Circle at the Uncommitted Changes');
				expect(value).toBe(GraphUncommittedChangesStyle.OpenCircleAtTheUncommittedChanges);
			});
		});
	});

	describe('integratedTerminalShell', () => {
		it('Should return the configured value', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('integratedTerminalShell', '/path/to/shell');

			// Run
			const value = config.integratedTerminalShell;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('integratedTerminalShell', '');
			expect(value).toBe('/path/to/shell');
		});

		it('Should return the default configuration value ("")', () => {
			// Run
			const value = config.integratedTerminalShell;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('integratedTerminalShell', '');
			expect(value).toBe('');
		});
	});

	describe('keybindings', () => {
		describe('find', () => {
			it('Should return the configured keybinding', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.find', 'CTRL/CMD + A');

				// Run
				const value = config.keybindings.find;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.find');
				expect(value).toBe('a');
			});

			it('Should return the configured keybinding (unassigned)', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.find', 'UNASSIGNED');

				// Run
				const value = config.keybindings.find;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.find');
				expect(value).toBeNull();
			});

			it('Should return the default keybinding when the value is not one of the available keybindings', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.find', 'CTRL/CMD + Shift + A');

				// Run
				const value = config.keybindings.find;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.find');
				expect(value).toBe('f');
			});

			it('Should return the default keybinding when the value is invalid', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.find', 5);

				// Run
				const value = config.keybindings.find;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.find');
				expect(value).toBe('f');
			});

			it('Should return the default keybinding', () => {
				// Run
				const value = config.keybindings.find;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.find');
				expect(value).toBe('f');
			});
		});

		describe('refresh', () => {
			it('Should return the configured keybinding', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.refresh', 'CTRL/CMD + A');

				// Run
				const value = config.keybindings.refresh;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.refresh');
				expect(value).toBe('a');
			});

			it('Should return the configured keybinding (unassigned)', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.refresh', 'UNASSIGNED');

				// Run
				const value = config.keybindings.refresh;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.refresh');
				expect(value).toBeNull();
			});

			it('Should return the default keybinding when the value is not one of the available keybindings', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.refresh', 'CTRL/CMD + Shift + A');

				// Run
				const value = config.keybindings.refresh;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.refresh');
				expect(value).toBe('r');
			});

			it('Should return the default keybinding when the value is invalid', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.refresh', 5);

				// Run
				const value = config.keybindings.refresh;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.refresh');
				expect(value).toBe('r');
			});

			it('Should return the default keybinding', () => {
				// Run
				const value = config.keybindings.refresh;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.refresh');
				expect(value).toBe('r');
			});
		});

		describe('scrollToHead', () => {
			it('Should return the configured keybinding', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.scrollToHead', 'CTRL/CMD + A');

				// Run
				const value = config.keybindings.scrollToHead;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.scrollToHead');
				expect(value).toBe('a');
			});

			it('Should return the configured keybinding (unassigned)', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.scrollToHead', 'UNASSIGNED');

				// Run
				const value = config.keybindings.scrollToHead;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.scrollToHead');
				expect(value).toBeNull();
			});

			it('Should return the default keybinding when the value is not one of the available keybindings', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.scrollToHead', 'CTRL/CMD + Shift + A');

				// Run
				const value = config.keybindings.scrollToHead;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.scrollToHead');
				expect(value).toBe('h');
			});

			it('Should return the default keybinding when the value is invalid', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.scrollToHead', 5);

				// Run
				const value = config.keybindings.scrollToHead;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.scrollToHead');
				expect(value).toBe('h');
			});

			it('Should return the default keybinding', () => {
				// Run
				const value = config.keybindings.scrollToHead;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.scrollToHead');
				expect(value).toBe('h');
			});
		});

		describe('scrollToStash', () => {
			it('Should return the configured keybinding', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.scrollToStash', 'CTRL/CMD + A');

				// Run
				const value = config.keybindings.scrollToStash;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.scrollToStash');
				expect(value).toBe('a');
			});

			it('Should return the configured keybinding (unassigned)', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.scrollToStash', 'UNASSIGNED');

				// Run
				const value = config.keybindings.scrollToStash;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.scrollToStash');
				expect(value).toBeNull();
			});

			it('Should return the default keybinding when the value is not one of the available keybindings', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.scrollToStash', 'CTRL/CMD + Shift + A');

				// Run
				const value = config.keybindings.scrollToStash;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.scrollToStash');
				expect(value).toBe('s');
			});

			it('Should return the default keybinding when the value is invalid', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('keyboardShortcut.scrollToStash', 5);

				// Run
				const value = config.keybindings.scrollToStash;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.scrollToStash');
				expect(value).toBe('s');
			});

			it('Should return the default keybinding', () => {
				// Run
				const value = config.keybindings.scrollToStash;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('keyboardShortcut.scrollToStash');
				expect(value).toBe('s');
			});
		});
	});

	describe('markdown', testBooleanExtensionSetting('markdown', 'markdown', true));

	describe('maxDepthOfRepoSearch', () => {
		it('Should return the configured value', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('maxDepthOfRepoSearch', 5);

			// Run
			const value = config.maxDepthOfRepoSearch;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('maxDepthOfRepoSearch', 0);
			expect(value).toBe(5);
		});

		it('Should return the default configuration value (0)', () => {
			// Run
			const value = config.maxDepthOfRepoSearch;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('maxDepthOfRepoSearch', 0);
			expect(value).toBe(0);
		});
	});

	describe('openNewTabEditorGroup', () => {
		it('Should return vscode.ViewColumn.Active when the configuration value is "Active"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'Active');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Active);
		});

		it('Should return vscode.ViewColumn.Beside when the configuration value is "Beside"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'Beside');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Beside);
		});

		it('Should return vscode.ViewColumn.One when the configuration value is "One"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'One');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.One);
		});

		it('Should return vscode.ViewColumn.Two when the configuration value is "Two"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'Two');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Two);
		});

		it('Should return vscode.ViewColumn.Three when the configuration value is "Three"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'Three');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Three);
		});

		it('Should return vscode.ViewColumn.Four when the configuration value is "Four"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'Four');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Four);
		});

		it('Should return vscode.ViewColumn.Five when the configuration value is "Five"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'Five');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Five);
		});

		it('Should return vscode.ViewColumn.Six when the configuration value is "Six"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'Six');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Six);
		});

		it('Should return vscode.ViewColumn.Seven when the configuration value is "Seven"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'Seven');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Seven);
		});

		it('Should return vscode.ViewColumn.Eight when the configuration value is "Eight"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'Eight');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Eight);
		});

		it('Should return vscode.ViewColumn.Nine when the configuration value is "Nine"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'Nine');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Nine);
		});

		it('Should return the default value (vscode.ViewColumn.Active) when the configuration value is invalid', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('openNewTabEditorGroup', 'invalid');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Active);
		});

		it('Should return the default value (vscode.ViewColumn.Active) when the configuration value is unknown', () => {
			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Active);
		});
	});

	describe('openToTheRepoOfTheActiveTextEditorDocument', testBooleanExtensionSetting('openToTheRepoOfTheActiveTextEditorDocument', 'openToTheRepoOfTheActiveTextEditorDocument', false));

	describe('referenceLabels', () => {
		describe('combineLocalAndRemoteBranchLabels', () => {
			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('referenceLabels.combineLocalAndRemoteBranchLabels', true);

				// Run
				const value = config.referenceLabels.combineLocalAndRemoteBranchLabels;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.combineLocalAndRemoteBranchLabels', 'combineLocalAndRemoteBranchLabels');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('referenceLabels.combineLocalAndRemoteBranchLabels', false);

				// Run
				const value = config.referenceLabels.combineLocalAndRemoteBranchLabels;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.combineLocalAndRemoteBranchLabels', 'combineLocalAndRemoteBranchLabels');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('referenceLabels.combineLocalAndRemoteBranchLabels', 5);

				// Run
				const value = config.referenceLabels.combineLocalAndRemoteBranchLabels;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.combineLocalAndRemoteBranchLabels', 'combineLocalAndRemoteBranchLabels');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('referenceLabels.combineLocalAndRemoteBranchLabels', 0);

				// Run
				const value = config.referenceLabels.combineLocalAndRemoteBranchLabels;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.combineLocalAndRemoteBranchLabels', 'combineLocalAndRemoteBranchLabels');
				expect(value).toBe(false);
			});

			it('Should return the default value (TRUE) when the configuration value is unknown', () => {
				// Run
				const value = config.referenceLabels.combineLocalAndRemoteBranchLabels;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.combineLocalAndRemoteBranchLabels', 'combineLocalAndRemoteBranchLabels');
				expect(value).toBe(true);
			});
		});

		describe('branchLabelsAlignedToGraph & tagLabelsOnRight', () => {
			it('Should return correct alignment values when the configuration value is "Normal"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('referenceLabels.alignment', 'Normal');

				// Run
				const value = config.referenceLabels;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.alignment', 'referenceLabelAlignment');
				expect(value.branchLabelsAlignedToGraph).toBe(false);
				expect(value.tagLabelsOnRight).toBe(false);
			});

			it('Should return correct alignment values when the configuration value is "Branches (on the left) & Tags (on the right)"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('referenceLabels.alignment', 'Branches (on the left) & Tags (on the right)');

				// Run
				const value = config.referenceLabels;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.alignment', 'referenceLabelAlignment');
				expect(value.branchLabelsAlignedToGraph).toBe(false);
				expect(value.tagLabelsOnRight).toBe(true);
			});

			it('Should return correct alignment values when the configuration value is "Branches (aligned to the graph) & Tags (on the right)"', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('referenceLabels.alignment', 'Branches (aligned to the graph) & Tags (on the right)');

				// Run
				const value = config.referenceLabels;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.alignment', 'referenceLabelAlignment');
				expect(value.branchLabelsAlignedToGraph).toBe(true);
				expect(value.tagLabelsOnRight).toBe(true);
			});

			it('Should return the default values when the configuration value is invalid', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('referenceLabels.alignment', 'invalid');

				// Run
				const value = config.referenceLabels;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.alignment', 'referenceLabelAlignment');
				expect(value.branchLabelsAlignedToGraph).toBe(false);
				expect(value.tagLabelsOnRight).toBe(false);
			});

			it('Should return the default values when the configuration value is unknown', () => {
				// Run
				const value = config.referenceLabels;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.alignment', 'referenceLabelAlignment');
				expect(value.branchLabelsAlignedToGraph).toBe(false);
				expect(value.tagLabelsOnRight).toBe(false);
			});
		});
	});

	describe('fetchAvatars', testRenamedBooleanExtensionSetting('fetchAvatars', 'repository.commits.fetchAvatars', 'fetchAvatars', false));

	describe('initialLoadCommits', () => {
		it('Should return the configured value', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('repository.commits.initialLoad', 600);

			// Run
			const value = config.initialLoadCommits;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.initialLoad', 'initialLoadCommits');
			expect(value).toBe(600);
		});

		it('Should return the default configuration value (300)', () => {
			// Run
			const value = config.initialLoadCommits;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.initialLoad', 'initialLoadCommits');
			expect(value).toBe(300);
		});
	});

	describe('loadMoreCommits', () => {
		it('Should return the configured value', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('repository.commits.loadMore', 200);

			// Run
			const value = config.loadMoreCommits;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.loadMore', 'loadMoreCommits');
			expect(value).toBe(200);
		});

		it('Should return the default configuration value (100)', () => {
			// Run
			const value = config.loadMoreCommits;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.loadMore', 'loadMoreCommits');
			expect(value).toBe(100);
		});
	});

	describe('loadMoreCommitsAutomatically', testRenamedBooleanExtensionSetting('loadMoreCommitsAutomatically', 'repository.commits.loadMoreAutomatically', 'loadMoreCommitsAutomatically', true));

	describe('muteCommits', () => {
		describe('commitsNotAncestorsOfHead', () => {
			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.commits.mute.commitsThatAreNotAncestorsOfHead', true);

				// Run
				const value = config.muteCommits.commitsNotAncestorsOfHead;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 'muteCommitsThatAreNotAncestorsOfHead');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.commits.mute.commitsThatAreNotAncestorsOfHead', false);

				// Run
				const value = config.muteCommits.commitsNotAncestorsOfHead;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 'muteCommitsThatAreNotAncestorsOfHead');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 5);

				// Run
				const value = config.muteCommits.commitsNotAncestorsOfHead;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 'muteCommitsThatAreNotAncestorsOfHead');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 0);

				// Run
				const value = config.muteCommits.commitsNotAncestorsOfHead;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 'muteCommitsThatAreNotAncestorsOfHead');
				expect(value).toBe(false);
			});

			it('Should return the default value (FALSE) when the configuration value is unknown', () => {
				// Run
				const value = config.muteCommits.commitsNotAncestorsOfHead;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 'muteCommitsThatAreNotAncestorsOfHead');
				expect(value).toBe(false);
			});
		});

		describe('mergeCommits', () => {
			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.commits.mute.mergeCommits', true);

				// Run
				const value = config.muteCommits.mergeCommits;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.mergeCommits', 'muteMergeCommits');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.commits.mute.mergeCommits', false);

				// Run
				const value = config.muteCommits.mergeCommits;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.mergeCommits', 'muteMergeCommits');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.commits.mute.mergeCommits', 5);

				// Run
				const value = config.muteCommits.mergeCommits;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.mergeCommits', 'muteMergeCommits');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.commits.mute.mergeCommits', 0);

				// Run
				const value = config.muteCommits.mergeCommits;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.mergeCommits', 'muteMergeCommits');
				expect(value).toBe(false);
			});

			it('Should return the default value (TRUE) when the configuration value is unknown', () => {
				// Run
				const value = config.muteCommits.mergeCommits;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.mergeCommits', 'muteMergeCommits');
				expect(value).toBe(true);
			});
		});
	});

	describe('commitOrder', () => {
		it('Should return CommitOrdering.Date when the configuration value is "date"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('repository.commits.order', 'date');

			// Run
			const value = config.commitOrder;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.order', 'commitOrdering');
			expect(value).toBe(CommitOrdering.Date);
		});

		it('Should return CommitOrdering.AuthorDate when the configuration value is "author-date"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('repository.commits.order', 'author-date');

			// Run
			const value = config.commitOrder;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.order', 'commitOrdering');
			expect(value).toBe(CommitOrdering.AuthorDate);
		});

		it('Should return CommitOrdering.Topological when the configuration value is "topo"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('repository.commits.order', 'topo');

			// Run
			const value = config.commitOrder;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.order', 'commitOrdering');
			expect(value).toBe(CommitOrdering.Topological);
		});

		it('Should return the default value (CommitOrdering.Date) when the configuration value is invalid', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('repository.commits.order', 'invalid');

			// Run
			const value = config.commitOrder;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.order', 'commitOrdering');
			expect(value).toBe(CommitOrdering.Date);
		});

		it('Should return the default value (CommitOrdering.Date) when the configuration value is unknown', () => {
			// Run
			const value = config.commitOrder;

			// Assert
			expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.order', 'commitOrdering');
			expect(value).toBe(CommitOrdering.Date);
		});
	});

	describe('fetchAndPrune', testRenamedBooleanExtensionSetting('fetchAndPrune', 'repository.fetchAndPrune', 'fetchAndPrune', false));

	describe('fetchAndPruneTags', testBooleanExtensionSetting('fetchAndPruneTags', 'repository.fetchAndPruneTags', false));

	describe('includeCommitsMentionedByReflogs', testRenamedBooleanExtensionSetting('includeCommitsMentionedByReflogs', 'repository.includeCommitsMentionedByReflogs', 'includeCommitsMentionedByReflogs', false));

	describe('onRepoLoad', () => {
		describe('scrollToHead', () => {
			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.onLoad.scrollToHead', true);

				// Run
				const value = config.onRepoLoad.scrollToHead;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.scrollToHead', 'openRepoToHead');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.onLoad.scrollToHead', false);

				// Run
				const value = config.onRepoLoad.scrollToHead;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.scrollToHead', 'openRepoToHead');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.onLoad.scrollToHead', 5);

				// Run
				const value = config.onRepoLoad.scrollToHead;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.scrollToHead', 'openRepoToHead');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.onLoad.scrollToHead', 0);

				// Run
				const value = config.onRepoLoad.scrollToHead;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.scrollToHead', 'openRepoToHead');
				expect(value).toBe(false);
			});

			it('Should return the default value (FALSE) when the configuration value is unknown', () => {
				// Run
				const value = config.onRepoLoad.scrollToHead;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.scrollToHead', 'openRepoToHead');
				expect(value).toBe(false);
			});
		});

		describe('showCheckedOutBranch', () => {
			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.onLoad.showCheckedOutBranch', true);

				// Run
				const value = config.onRepoLoad.showCheckedOutBranch;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.showCheckedOutBranch', 'showCurrentBranchByDefault');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.onLoad.showCheckedOutBranch', false);

				// Run
				const value = config.onRepoLoad.showCheckedOutBranch;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.showCheckedOutBranch', 'showCurrentBranchByDefault');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.onLoad.showCheckedOutBranch', 5);

				// Run
				const value = config.onRepoLoad.showCheckedOutBranch;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.showCheckedOutBranch', 'showCurrentBranchByDefault');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.onLoad.showCheckedOutBranch', 0);

				// Run
				const value = config.onRepoLoad.showCheckedOutBranch;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.showCheckedOutBranch', 'showCurrentBranchByDefault');
				expect(value).toBe(false);
			});

			it('Should return the default value (FALSE) when the configuration value is unknown', () => {
				// Run
				const value = config.onRepoLoad.showCheckedOutBranch;

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.showCheckedOutBranch', 'showCurrentBranchByDefault');
				expect(value).toBe(false);
			});
		});

		describe('showSpecificBranches', () => {
			it('Should return all branches when correctly configured', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.onLoad.showSpecificBranches', ['master', 'develop']);

				// Run
				const value = config.onRepoLoad.showSpecificBranches;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('repository.onLoad.showSpecificBranches', expect.anything());
				expect(value).toStrictEqual(['master', 'develop']);
			});

			it('Should filter out all non-string branches', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.onLoad.showSpecificBranches', ['master', 5, 'develop']);

				// Run
				const value = config.onRepoLoad.showSpecificBranches;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('repository.onLoad.showSpecificBranches', expect.anything());
				expect(value).toStrictEqual(['master', 'develop']);
			});

			it('Should return the default value ([]) when the configuration value is invalid', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue('repository.onLoad.showSpecificBranches', 'master');

				// Run
				const value = config.onRepoLoad.showSpecificBranches;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('repository.onLoad.showSpecificBranches', expect.anything());
				expect(value).toStrictEqual([]);
			});

			it('Should return the default value ([]) when the configuration value is unknown', () => {
				// Run
				const value = config.onRepoLoad.showSpecificBranches;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('repository.onLoad.showSpecificBranches', expect.anything());
				expect(value).toStrictEqual([]);
			});
		});
	});

	describe('onlyFollowFirstParent', testRenamedBooleanExtensionSetting('onlyFollowFirstParent', 'repository.onlyFollowFirstParent', 'onlyFollowFirstParent', false));

	describe('showCommitsOnlyReferencedByTags', testRenamedBooleanExtensionSetting('showCommitsOnlyReferencedByTags', 'repository.showCommitsOnlyReferencedByTags', 'showCommitsOnlyReferencedByTags', true));

	describe('showSignatureStatus', testRenamedBooleanExtensionSetting('showSignatureStatus', 'repository.commits.showSignatureStatus', 'showSignatureStatus', false));

	describe('showRemoteBranches', testBooleanExtensionSetting('showRemoteBranches', 'repository.showRemoteBranches', true));

	describe('showRemoteHeads', testBooleanExtensionSetting('showRemoteHeads', 'repository.showRemoteHeads', true));

	describe('showStashes', testBooleanExtensionSetting('showStashes', 'repository.showStashes', true));

	describe('showTags', testRenamedBooleanExtensionSetting('showTags', 'repository.showTags', 'showTags', true));

	describe('showUncommittedChanges', testRenamedBooleanExtensionSetting('showUncommittedChanges', 'repository.showUncommittedChanges', 'showUncommittedChanges', true));

	describe('showUntrackedFiles', testRenamedBooleanExtensionSetting('showUntrackedFiles', 'repository.showUntrackedFiles', 'showUntrackedFiles', true));

	describe('signCommits', testBooleanExtensionSetting('signCommits', 'repository.sign.commits', false));

	describe('signTags', testBooleanExtensionSetting('signTags', 'repository.sign.tags', false));

	describe('useMailmap', testRenamedBooleanExtensionSetting('useMailmap', 'repository.useMailmap', 'useMailmap', false));

	describe('repoDropdownOrder', () => {
		it('Should return RepoDropdownOrder.Name when the configuration value is "Name"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('repositoryDropdownOrder', 'Name');

			// Run
			const value = config.repoDropdownOrder;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repositoryDropdownOrder', 'Workspace Full Path');
			expect(value).toBe(RepoDropdownOrder.Name);
		});

		it('Should return RepoDropdownOrder.FullPath when the configuration value is "Full Path"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('repositoryDropdownOrder', 'Full Path');

			// Run
			const value = config.repoDropdownOrder;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repositoryDropdownOrder', 'Workspace Full Path');
			expect(value).toBe(RepoDropdownOrder.FullPath);
		});

		it('Should return RepoDropdownOrder.WorkspaceFullPath when the configuration value is "Workspace Full Path"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('repositoryDropdownOrder', 'Workspace Full Path');

			// Run
			const value = config.repoDropdownOrder;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repositoryDropdownOrder', 'Workspace Full Path');
			expect(value).toBe(RepoDropdownOrder.WorkspaceFullPath);
		});

		it('Should return the default value (RepoDropdownOrder.WorkspaceFullPath) when the configuration value is invalid', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('repositoryDropdownOrder', 'invalid');

			// Run
			const value = config.repoDropdownOrder;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repositoryDropdownOrder', 'Workspace Full Path');
			expect(value).toBe(RepoDropdownOrder.WorkspaceFullPath);
		});

		it('Should return the default value (RepoDropdownOrder.WorkspaceFullPath) when the configuration value is not set', () => {
			// Run
			const value = config.repoDropdownOrder;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repositoryDropdownOrder', 'Workspace Full Path');
			expect(value).toBe(RepoDropdownOrder.WorkspaceFullPath);
		});
	});

	describe('retainContextWhenHidden', testBooleanExtensionSetting('retainContextWhenHidden', 'retainContextWhenHidden', true));

	describe('showStatusBarItem', testBooleanExtensionSetting('showStatusBarItem', 'showStatusBarItem', true));

	describe('stickyHeader', testBooleanExtensionSetting('stickyHeader', 'stickyHeader', true));

	describe('tabIconColourTheme', () => {
		it('Should return TabIconColourTheme.Colour when the configuration value is "colour"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('tabIconColourTheme', 'colour');

			// Run
			const value = config.tabIconColourTheme;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('tabIconColourTheme', 'colour');
			expect(value).toBe(TabIconColourTheme.Colour);
		});

		it('Should return TabIconColourTheme.Grey when the configuration value is "grey"', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('tabIconColourTheme', 'grey');

			// Run
			const value = config.tabIconColourTheme;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('tabIconColourTheme', 'colour');
			expect(value).toBe(TabIconColourTheme.Grey);
		});

		it('Should return the default value (TabIconColourTheme.Colour) when the configuration value is invalid', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('tabIconColourTheme', 'invalid');

			// Run
			const value = config.tabIconColourTheme;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('tabIconColourTheme', 'colour');
			expect(value).toBe(TabIconColourTheme.Colour);
		});

		it('Should return the default value (TabIconColourTheme.Colour) when the configuration value is not set', () => {
			// Run
			const value = config.tabIconColourTheme;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('tabIconColourTheme', 'colour');
			expect(value).toBe(TabIconColourTheme.Colour);
		});
	});

	describe('gitPaths', () => {
		it('Should return the configured path', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('path', '/path/to/git');

			// Run
			const value = config.gitPaths;

			// Assert
			expect(vscode.workspace.getConfiguration).toBeCalledWith('git');
			expect(workspaceConfiguration.get).toBeCalledWith('path', null);
			expect(value).toStrictEqual(['/path/to/git']);
		});

		it('Should return the valid configured paths', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('path', ['/path/to/first/git', '/path/to/second/git', 4, {}, null, '/path/to/third/git']);

			// Run
			const value = config.gitPaths;

			// Assert
			expect(vscode.workspace.getConfiguration).toBeCalledWith('git');
			expect(workspaceConfiguration.get).toBeCalledWith('path', null);
			expect(value).toStrictEqual(['/path/to/first/git', '/path/to/second/git', '/path/to/third/git']);
		});

		it('Should return an empty array when the configuration value is NULL', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('path', null);

			// Run
			const value = config.gitPaths;

			// Assert
			expect(vscode.workspace.getConfiguration).toBeCalledWith('git');
			expect(workspaceConfiguration.get).toBeCalledWith('path', null);
			expect(value).toStrictEqual([]);
		});

		it('Should return an empty array when the configuration value is invalid', () => {
			// Setup
			vscode.mockExtensionSettingReturnValue('path', 4);

			// Run
			const value = config.gitPaths;

			// Assert
			expect(vscode.workspace.getConfiguration).toBeCalledWith('git');
			expect(workspaceConfiguration.get).toBeCalledWith('path', null);
			expect(value).toStrictEqual([]);
		});

		it('Should return an empty array when the default configuration value (NULL) is received', () => {
			// Run
			const value = config.gitPaths;

			// Assert
			expect(vscode.workspace.getConfiguration).toBeCalledWith('git');
			expect(workspaceConfiguration.get).toBeCalledWith('path', null);
			expect(value).toStrictEqual([]);
		});
	});

	describe('getRenamedExtensionSetting', () => {
		it('Should return new workspace value', () => {
			// Setup
			workspaceConfiguration.inspect.mockReturnValueOnce({
				workspaceValue: true,
				globalValue: false
			});
			workspaceConfiguration.inspect.mockReturnValueOnce({
				workspaceValue: false,
				globalValue: false
			});

			// Run
			const value = config.fetchAndPrune;

			// Assert
			expect(value).toBe(true);
		});

		it('Should return old workspace value', () => {
			// Setup
			workspaceConfiguration.inspect.mockReturnValueOnce({
				workspaceValue: undefined,
				globalValue: false
			});
			workspaceConfiguration.inspect.mockReturnValueOnce({
				workspaceValue: true,
				globalValue: false
			});

			// Run
			const value = config.fetchAndPrune;

			// Assert
			expect(value).toBe(true);
		});

		it('Should return new global value', () => {
			// Setup
			workspaceConfiguration.inspect.mockReturnValueOnce({
				workspaceValue: undefined,
				globalValue: true
			});
			workspaceConfiguration.inspect.mockReturnValueOnce({
				workspaceValue: undefined,
				globalValue: false
			});

			// Run
			const value = config.fetchAndPrune;

			// Assert
			expect(value).toBe(true);
		});

		it('Should return old global value', () => {
			// Setup
			workspaceConfiguration.inspect.mockReturnValueOnce({
				workspaceValue: undefined,
				globalValue: undefined
			});
			workspaceConfiguration.inspect.mockReturnValueOnce({
				workspaceValue: undefined,
				globalValue: true
			});

			// Run
			const value = config.fetchAndPrune;

			// Assert
			expect(value).toBe(true);
		});

		it('Should return the default value', () => {
			// Setup
			workspaceConfiguration.inspect.mockReturnValueOnce({
				workspaceValue: undefined,
				globalValue: undefined
			});
			workspaceConfiguration.inspect.mockReturnValueOnce({
				workspaceValue: undefined,
				globalValue: undefined
			});

			// Run
			const value = config.fetchAndPrune;

			// Assert
			expect(value).toBe(false);
		});
	});

	function testBooleanExtensionSetting(configKey: keyof Config, section: string, defaultValue: boolean) {
		return () => {
			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue(section, true);

				// Run
				const value = config[configKey];

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith(section, defaultValue);
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue(section, false);

				// Run
				const value = config[configKey];

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith(section, defaultValue);
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue(section, 5);

				// Run
				const value = config[configKey];

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith(section, defaultValue);
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue(section, 0);

				// Run
				const value = config[configKey];

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith(section, defaultValue);
				expect(value).toBe(false);
			});

			it('Should return the default value (' + (defaultValue ? 'TRUE' : 'FALSE') + ') when the configuration value is not set', () => {
				// Run
				const value = config[configKey];

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith(section, defaultValue);
				expect(value).toBe(defaultValue);
			});
		};
	}

	function testRenamedBooleanExtensionSetting(configKey: keyof Config, section: string, oldSection: string, defaultValue: boolean) {
		return () => {
			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue(section, true);

				// Run
				const value = config[configKey];

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled(section, oldSection);
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue(section, false);

				// Run
				const value = config[configKey];

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled(section, oldSection);
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue(section, 5);

				// Run
				const value = config[configKey];

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled(section, oldSection);
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				vscode.mockExtensionSettingReturnValue(section, 0);

				// Run
				const value = config[configKey];

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled(section, oldSection);
				expect(value).toBe(false);
			});

			it('Should return the default value (' + (defaultValue ? 'TRUE' : 'FALSE') + ') when the configuration value is not set', () => {
				// Run
				const value = config[configKey];

				// Assert
				expectRenamedExtensionSettingToHaveBeenCalled(section, oldSection);
				expect(value).toBe(defaultValue);
			});
		};
	}
});
