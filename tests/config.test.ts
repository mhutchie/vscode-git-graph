import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });

import { getConfig } from '../src/config';
import { CommitDetailsViewLocation, CommitOrdering, DateFormatType, DateType, FileViewType, GitResetMode, GraphStyle, RepoDropdownOrder, SquashMessageFormat, TabIconColourTheme } from '../src/types';

let workspaceConfiguration = vscode.mocks.workspaceConfiguration;

beforeEach(() => {
	vscode.workspace.getConfiguration.mockClear();
	workspaceConfiguration.get.mockClear();
	workspaceConfiguration.inspect.mockClear();
});

describe('Config', () => {
	let config: ReturnType<typeof getConfig>;
	beforeEach(() => {
		config = getConfig();
	});

	describe('commitDetailsView', () => {
		describe('autoCenter', () => {
			const mockAutoCenterExtensionSetting = (value: any) => {
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
			};

			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				mockAutoCenterExtensionSetting(true);

				// Run
				const value = config.commitDetailsView.autoCenter;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.autoCenter', 'autoCenterCommitDetailsView');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				mockAutoCenterExtensionSetting(false);

				// Run
				const value = config.commitDetailsView.autoCenter;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.autoCenter', 'autoCenterCommitDetailsView');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				mockAutoCenterExtensionSetting(5);

				// Run
				const value = config.commitDetailsView.autoCenter;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.autoCenter', 'autoCenterCommitDetailsView');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				mockAutoCenterExtensionSetting(0);

				// Run
				const value = config.commitDetailsView.autoCenter;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.autoCenter', 'autoCenterCommitDetailsView');
				expect(value).toBe(false);
			});

			it('Should return the default value (TRUE) when the configuration value is unknown', () => {
				// Setup
				mockAutoCenterExtensionSetting(undefined);

				// Run
				const value = config.commitDetailsView.autoCenter;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.autoCenter', 'autoCenterCommitDetailsView');
				expect(value).toBe(true);
			});
		});

		describe('fileTreeCompactFolders', () => {
			const mockFileTreeCompactFoldersExtensionSetting = (value: any) => {
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
			};

			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				mockFileTreeCompactFoldersExtensionSetting(true);

				// Run
				const value = config.commitDetailsView.fileTreeCompactFolders;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.fileTree.compactFolders', 'commitDetailsViewFileTreeCompactFolders');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				mockFileTreeCompactFoldersExtensionSetting(false);

				// Run
				const value = config.commitDetailsView.fileTreeCompactFolders;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.fileTree.compactFolders', 'commitDetailsViewFileTreeCompactFolders');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				mockFileTreeCompactFoldersExtensionSetting(5);

				// Run
				const value = config.commitDetailsView.fileTreeCompactFolders;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.fileTree.compactFolders', 'commitDetailsViewFileTreeCompactFolders');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				mockFileTreeCompactFoldersExtensionSetting(0);

				// Run
				const value = config.commitDetailsView.fileTreeCompactFolders;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.fileTree.compactFolders', 'commitDetailsViewFileTreeCompactFolders');
				expect(value).toBe(false);
			});

			it('Should return the default value (TRUE) when the configuration value is unknown', () => {
				// Setup
				mockFileTreeCompactFoldersExtensionSetting(undefined);

				// Run
				const value = config.commitDetailsView.fileTreeCompactFolders;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.fileTree.compactFolders', 'commitDetailsViewFileTreeCompactFolders');
				expect(value).toBe(true);
			});
		});

		describe('fileViewType', () => {
			const mockFileViewTypeExtensionSetting = (value: any) => {
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
			};

			it('Should return FileViewType.Tree when the configuration value is "File Tree"', () => {
				// Setup
				mockFileViewTypeExtensionSetting('File Tree');

				// Run
				const value = config.commitDetailsView.fileViewType;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.type', 'defaultFileViewType');
				expect(value).toBe(FileViewType.Tree);
			});

			it('Should return FileViewType.List when the configuration value is "File List"', () => {
				// Setup
				mockFileViewTypeExtensionSetting('File List');

				// Run
				const value = config.commitDetailsView.fileViewType;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.type', 'defaultFileViewType');
				expect(value).toBe(FileViewType.List);
			});

			it('Should return the default value (FileViewType.Tree) when the configuration value is invalid', () => {
				// Setup
				mockFileViewTypeExtensionSetting('invalid');

				// Run
				const value = config.commitDetailsView.fileViewType;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.type', 'defaultFileViewType');
				expect(value).toBe(FileViewType.Tree);
			});

			it('Should return the default value (FileViewType.Tree) when the configuration value is unknown', () => {
				// Setup
				mockFileViewTypeExtensionSetting(undefined);

				// Run
				const value = config.commitDetailsView.fileViewType;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.fileView.type', 'defaultFileViewType');
				expect(value).toBe(FileViewType.Tree);
			});
		});

		describe('location', () => {
			const mockLocationExtensionSetting = (value: any) => {
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
			};

			it('Should return CommitDetailsViewLocation.Inline when the configuration value is "Inline"', () => {
				// Setup
				mockLocationExtensionSetting('Inline');

				// Run
				const value = config.commitDetailsView.location;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.location', 'commitDetailsViewLocation');
				expect(value).toBe(CommitDetailsViewLocation.Inline);
			});

			it('Should return CommitDetailsViewLocation.DockedToBottom when the configuration value is "Docked to Bottom"', () => {
				// Setup
				mockLocationExtensionSetting('Docked to Bottom');

				// Run
				const value = config.commitDetailsView.location;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.location', 'commitDetailsViewLocation');
				expect(value).toBe(CommitDetailsViewLocation.DockedToBottom);
			});

			it('Should return the default value (CommitDetailsViewLocation.Inline) when the configuration value is invalid', () => {
				// Setup
				mockLocationExtensionSetting('invalid');

				// Run
				const value = config.commitDetailsView.location;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.location', 'commitDetailsViewLocation');
				expect(value).toBe(CommitDetailsViewLocation.Inline);
			});

			it('Should return the default value (CommitDetailsViewLocation.Inline) when the configuration value is unknown', () => {
				// Setup
				mockLocationExtensionSetting(undefined);

				// Run
				const value = config.commitDetailsView.location;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('commitDetailsView.location', 'commitDetailsViewLocation');
				expect(value).toBe(CommitDetailsViewLocation.Inline);
			});
		});
	});

	describe('contextMenuActionsVisibility', () => {
		it('Should return the default value (all items enabled) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(1);

			// Run
			const value = config.contextMenuActionsVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('contextMenuActionsVisibility', {});
			expect(value.branch.checkout).toBe(true);
			expect(value.branch.rename).toBe(true);
			expect(value.branch.delete).toBe(true);
			expect(value.branch.merge).toBe(true);
			expect(value.branch.rebase).toBe(true);
			expect(value.branch.push).toBe(true);
			expect(value.branch.createPullRequest).toBe(true);
			expect(value.branch.createArchive).toBe(true);
			expect(value.branch.copyName).toBe(true);
			expect(value.commit.addTag).toBe(true);
			expect(value.commit.createBranch).toBe(true);
			expect(value.commit.checkout).toBe(true);
			expect(value.commit.cherrypick).toBe(true);
			expect(value.commit.revert).toBe(true);
			expect(value.commit.drop).toBe(true);
			expect(value.commit.merge).toBe(true);
			expect(value.commit.rebase).toBe(true);
			expect(value.commit.reset).toBe(true);
			expect(value.commit.copyHash).toBe(true);
			expect(value.commit.copySubject).toBe(true);
			expect(value.remoteBranch.checkout).toBe(true);
			expect(value.remoteBranch.delete).toBe(true);
			expect(value.remoteBranch.fetch).toBe(true);
			expect(value.remoteBranch.merge).toBe(true);
			expect(value.remoteBranch.pull).toBe(true);
			expect(value.remoteBranch.createPullRequest).toBe(true);
			expect(value.remoteBranch.createArchive).toBe(true);
			expect(value.remoteBranch.copyName).toBe(true);
			expect(value.stash.apply).toBe(true);
			expect(value.stash.createBranch).toBe(true);
			expect(value.stash.pop).toBe(true);
			expect(value.stash.drop).toBe(true);
			expect(value.stash.copyName).toBe(true);
			expect(value.stash.copyHash).toBe(true);
			expect(value.tag.viewDetails).toBe(true);
			expect(value.tag.delete).toBe(true);
			expect(value.tag.push).toBe(true);
			expect(value.tag.createArchive).toBe(true);
			expect(value.tag.copyName).toBe(true);
			expect(value.uncommittedChanges.stash).toBe(true);
			expect(value.uncommittedChanges.reset).toBe(true);
			expect(value.uncommittedChanges.clean).toBe(true);
			expect(value.uncommittedChanges.openSourceControlView).toBe(true);
		});

		it('Should return the default value (all items enabled) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.contextMenuActionsVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('contextMenuActionsVisibility', {});
			expect(value.branch.checkout).toBe(true);
			expect(value.branch.rename).toBe(true);
			expect(value.branch.delete).toBe(true);
			expect(value.branch.merge).toBe(true);
			expect(value.branch.rebase).toBe(true);
			expect(value.branch.push).toBe(true);
			expect(value.branch.createPullRequest).toBe(true);
			expect(value.branch.createArchive).toBe(true);
			expect(value.branch.copyName).toBe(true);
			expect(value.commit.addTag).toBe(true);
			expect(value.commit.createBranch).toBe(true);
			expect(value.commit.checkout).toBe(true);
			expect(value.commit.cherrypick).toBe(true);
			expect(value.commit.revert).toBe(true);
			expect(value.commit.drop).toBe(true);
			expect(value.commit.merge).toBe(true);
			expect(value.commit.rebase).toBe(true);
			expect(value.commit.reset).toBe(true);
			expect(value.commit.copyHash).toBe(true);
			expect(value.commit.copySubject).toBe(true);
			expect(value.remoteBranch.checkout).toBe(true);
			expect(value.remoteBranch.delete).toBe(true);
			expect(value.remoteBranch.fetch).toBe(true);
			expect(value.remoteBranch.merge).toBe(true);
			expect(value.remoteBranch.pull).toBe(true);
			expect(value.remoteBranch.createPullRequest).toBe(true);
			expect(value.remoteBranch.createArchive).toBe(true);
			expect(value.remoteBranch.copyName).toBe(true);
			expect(value.stash.apply).toBe(true);
			expect(value.stash.createBranch).toBe(true);
			expect(value.stash.pop).toBe(true);
			expect(value.stash.drop).toBe(true);
			expect(value.stash.copyName).toBe(true);
			expect(value.stash.copyHash).toBe(true);
			expect(value.tag.viewDetails).toBe(true);
			expect(value.tag.delete).toBe(true);
			expect(value.tag.push).toBe(true);
			expect(value.tag.createArchive).toBe(true);
			expect(value.tag.copyName).toBe(true);
			expect(value.uncommittedChanges.stash).toBe(true);
			expect(value.uncommittedChanges.reset).toBe(true);
			expect(value.uncommittedChanges.clean).toBe(true);
			expect(value.uncommittedChanges.openSourceControlView).toBe(true);
		});

		it('Should only affect the provided configuration overrides', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce({
				branch: {
					rename: false
				},
				commit: {
					checkout: false
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
			expect(value.branch.checkout).toBe(true);
			expect(value.branch.rename).toBe(false);
			expect(value.branch.delete).toBe(true);
			expect(value.branch.merge).toBe(true);
			expect(value.branch.rebase).toBe(true);
			expect(value.branch.push).toBe(true);
			expect(value.branch.createPullRequest).toBe(true);
			expect(value.branch.createArchive).toBe(true);
			expect(value.branch.copyName).toBe(true);
			expect(value.commit.addTag).toBe(true);
			expect(value.commit.createBranch).toBe(true);
			expect(value.commit.checkout).toBe(false);
			expect(value.commit.cherrypick).toBe(true);
			expect(value.commit.revert).toBe(true);
			expect(value.commit.drop).toBe(true);
			expect(value.commit.merge).toBe(true);
			expect(value.commit.rebase).toBe(true);
			expect(value.commit.reset).toBe(true);
			expect(value.commit.copyHash).toBe(true);
			expect(value.commit.copySubject).toBe(true);
			expect(value.remoteBranch.checkout).toBe(true);
			expect(value.remoteBranch.delete).toBe(true);
			expect(value.remoteBranch.fetch).toBe(false);
			expect(value.remoteBranch.merge).toBe(true);
			expect(value.remoteBranch.pull).toBe(true);
			expect(value.remoteBranch.createPullRequest).toBe(true);
			expect(value.remoteBranch.createArchive).toBe(true);
			expect(value.remoteBranch.copyName).toBe(true);
			expect(value.stash.apply).toBe(true);
			expect(value.stash.createBranch).toBe(true);
			expect(value.stash.pop).toBe(true);
			expect(value.stash.drop).toBe(true);
			expect(value.stash.copyName).toBe(true);
			expect(value.stash.copyHash).toBe(true);
			expect(value.tag.viewDetails).toBe(true);
			expect(value.tag.delete).toBe(true);
			expect(value.tag.push).toBe(true);
			expect(value.tag.createArchive).toBe(true);
			expect(value.tag.copyName).toBe(true);
			expect(value.uncommittedChanges.stash).toBe(true);
			expect(value.uncommittedChanges.reset).toBe(true);
			expect(value.uncommittedChanges.clean).toBe(true);
			expect(value.uncommittedChanges.openSourceControlView).toBe(true);
		});
	});

	describe('customBranchGlobPatterns', () => {
		it('Should return a filtered array of glob patterns based on the configuration value', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce([
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
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

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
			workspaceConfiguration.get.mockReturnValueOnce([
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
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

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
			workspaceConfiguration.get.mockReturnValueOnce([
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
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.customPullRequestProviders;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('customPullRequestProviders', []);
			expect(value).toHaveLength(0);
		});

		it('Should return the default value ([]) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

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
			vscode.mockRenamedExtensionSettingReturningValueOnce('Date & Time');

			// Run
			const value = config.dateFormat;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: false });
		});

		it('Should successfully parse the configuration value "Date Only"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Date Only');

			// Run
			const value = config.dateFormat;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateOnly, iso: false });
		});

		it('Should successfully parse the configuration value "ISO Date & Time"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('ISO Date & Time');

			// Run
			const value = config.dateFormat;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: true });
		});

		it('Should successfully parse the configuration value "ISO Date Only"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('ISO Date Only');

			// Run
			const value = config.dateFormat;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateOnly, iso: true });
		});

		it('Should successfully parse the configuration value "Relative"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Relative');

			// Run
			const value = config.dateFormat;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.Relative, iso: false });
		});

		it('Should return the default value when the configuration value is invalid', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('invalid');

			// Run
			const value = config.dateFormat;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: false });
		});

		it('Should return the default value when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.dateFormat;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('date.format', 'dateFormat');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: false });
		});
	});

	describe('dateType', () => {
		it('Should return DateType.Author when the configuration value is "Author Date"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Author Date');

			// Run
			const value = config.dateType;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('date.type', 'dateType');
			expect(value).toBe(DateType.Author);
		});

		it('Should return DateType.Commit when the configuration value is "Commit Date"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Commit Date');

			// Run
			const value = config.dateType;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('date.type', 'dateType');
			expect(value).toBe(DateType.Commit);
		});

		it('Should return the default value (DateType.Author) when the configuration value is invalid', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('invalid');

			// Run
			const value = config.dateType;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('date.type', 'dateType');
			expect(value).toBe(DateType.Author);
		});

		it('Should return the default value (DateType.Author) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.dateType;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('date.type', 'dateType');
			expect(value).toBe(DateType.Author);
		});
	});

	describe('defaultColumnVisibility', () => {
		it('Should successfully parse the configuration value (Date column disabled)', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce({ Date: false, Author: true, Commit: true });

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: false, author: true, commit: true });
		});

		it('Should successfully parse the configuration value (Author column disabled)', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce({ Date: true, Author: false, Commit: true });

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: true, author: false, commit: true });
		});

		it('Should successfully parse the configuration value (Commit  column disabled)', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce({ Date: true, Author: true, Commit: false });

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: true, author: true, commit: false });
		});

		it('Should return the default value when the configuration value is invalid (not an object)', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: true, author: true, commit: true });
		});

		it('Should return the default value when the configuration value is invalid (NULL)', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(null);

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: true, author: true, commit: true });
		});

		it('Should return the default value when the configuration value is invalid (column value is not a boolean)', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce({ Date: true, Author: true, Commit: 5 });

			// Run
			const value = config.defaultColumnVisibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultColumnVisibility', {});
			expect(value).toStrictEqual({ date: true, author: true, commit: true });
		});

		it('Should return the default value when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

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
			workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
				if (section === 'dialog.addTag.type' || section === 'dialog.resetCurrentBranchToCommit.mode' || section === 'dialog.resetUncommittedChanges.mode') {
					return defaultValue;
				} else {
					return true;
				}
			});

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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
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
					type: 'annotated'
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
				fetchRemote: {
					prune: true,
					pruneTags: true
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
			workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
				if (section === 'dialog.addTag.type' || section === 'dialog.resetCurrentBranchToCommit.mode' || section === 'dialog.resetUncommittedChanges.mode') {
					return defaultValue;
				} else {
					return false;
				}
			});

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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
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
					type: 'annotated'
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
				fetchRemote: {
					prune: false,
					pruneTags: false
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
			workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
				if (section === 'dialog.addTag.type' || section === 'dialog.resetCurrentBranchToCommit.mode' || section === 'dialog.resetUncommittedChanges.mode') {
					return defaultValue;
				} else {
					return 1;
				}
			});

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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
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
					type: 'annotated'
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
				fetchRemote: {
					prune: true,
					pruneTags: true
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
			workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
				if (section === 'dialog.addTag.type' || section === 'dialog.resetCurrentBranchToCommit.mode' || section === 'dialog.resetUncommittedChanges.mode') {
					return defaultValue;
				} else {
					return 0;
				}
			});

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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
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
					type: 'annotated'
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
				fetchRemote: {
					prune: false,
					pruneTags: false
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
			workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
				if (section === 'dialog.addTag.type' || section === 'dialog.resetCurrentBranchToCommit.mode' || section === 'dialog.resetUncommittedChanges.mode') {
					return 'invalid';
				} else {
					return defaultValue;
				}
			});

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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
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
					type: 'annotated'
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
				fetchRemote: {
					prune: false,
					pruneTags: false
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
			// Setup
			workspaceConfiguration.get.mockImplementation((_, defaultValue) => defaultValue);

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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.prune', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.fetchRemote.pruneTags', false);
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
					type: 'annotated'
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
				fetchRemote: {
					prune: false,
					pruneTags: false
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
			it('Should return "annotated" the configuration value is "Annotated"', () => {
				// Setup
				workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
					if (section === 'dialog.addTag.type') {
						return 'Annotated';
					} else {
						return defaultValue;
					}
				});

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.addTag.type).toBe('annotated');
			});

			it('Should return "lightweight" the configuration value is "Annotated"', () => {
				// Setup
				workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
					if (section === 'dialog.addTag.type') {
						return 'Lightweight';
					} else {
						return defaultValue;
					}
				});

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.addTag.type).toBe('lightweight');
			});
		});

		describe('dialogDefaults.resetCommit.mode', () => {
			it('Should return GitResetMode.Hard the configuration value is "Hard"', () => {
				// Setup
				workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
					if (section === 'dialog.resetCurrentBranchToCommit.mode') {
						return 'Hard';
					} else {
						return defaultValue;
					}
				});

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.resetCommit.mode).toBe(GitResetMode.Hard);
			});

			it('Should return GitResetMode.Mixed the configuration value is "Mixed"', () => {
				// Setup
				workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
					if (section === 'dialog.resetCurrentBranchToCommit.mode') {
						return 'Mixed';
					} else {
						return defaultValue;
					}
				});

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.resetCommit.mode).toBe(GitResetMode.Mixed);
			});

			it('Should return GitResetMode.Soft the configuration value is "Soft"', () => {
				// Setup
				workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
					if (section === 'dialog.resetCurrentBranchToCommit.mode') {
						return 'Soft';
					} else {
						return defaultValue;
					}
				});

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.resetCommit.mode).toBe(GitResetMode.Soft);
			});
		});

		describe('dialogDefaults.resetUncommitted.mode', () => {
			it('Should return GitResetMode.Hard the configuration value is "Hard"', () => {
				// Setup
				workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
					if (section === 'dialog.resetUncommittedChanges.mode') {
						return 'Hard';
					} else {
						return defaultValue;
					}
				});

				// Run
				const value = config.dialogDefaults;

				// Assert
				expect(value.resetUncommitted.mode).toBe(GitResetMode.Hard);
			});

			it('Should return GitResetMode.Mixed the configuration value is "Mixed"', () => {
				// Setup
				workspaceConfiguration.get.mockImplementation((section, defaultValue) => {
					if (section === 'dialog.resetUncommittedChanges.mode') {
						return 'Mixed';
					} else {
						return defaultValue;
					}
				});

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
			workspaceConfiguration.get.mockReturnValueOnce('Default');

			// Run
			const value = config.squashMergeMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.Default);
		});

		it('Should return SquashMessageFormat.GitSquashMsg when the configuration value is "Git SQUASH_MSG"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Git SQUASH_MSG');

			// Run
			const value = config.squashMergeMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.GitSquashMsg);
		});

		it('Should return the default value (SquashMessageFormat.Default) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.squashMergeMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.Default);
		});

		it('Should return the default value (SquashMessageFormat.Default) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

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
			workspaceConfiguration.get.mockReturnValueOnce('Default');

			// Run
			const value = config.squashPullMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.Default);
		});

		it('Should return SquashMessageFormat.GitSquashMsg when the configuration value is "Git SQUASH_MSG"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Git SQUASH_MSG');

			// Run
			const value = config.squashPullMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.GitSquashMsg);
		});

		it('Should return the default value (SquashMessageFormat.Default) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.squashPullMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.Default);
		});

		it('Should return the default value (SquashMessageFormat.Default) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.squashPullMessageFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.pullBranch.squashMessageFormat', 'Default');
			expect(value).toBe(SquashMessageFormat.Default);
		});
	});

	describe('enhancedAccessibility', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.enhancedAccessibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('enhancedAccessibility', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.enhancedAccessibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('enhancedAccessibility', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.enhancedAccessibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('enhancedAccessibility', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.enhancedAccessibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('enhancedAccessibility', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.enhancedAccessibility;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('enhancedAccessibility', false);
			expect(value).toBe(false);
		});
	});

	describe('fileEncoding', () => {
		it('Should return the configured value', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('file-encoding');

			// Run
			const value = config.fileEncoding;

			expect(workspaceConfiguration.get).toBeCalledWith('fileEncoding', 'utf8');
			expect(value).toBe('file-encoding');
		});

		it('Should return the default configuration value ("utf8")', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.fileEncoding;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fileEncoding', 'utf8');
			expect(value).toBe('utf8');
		});
	});

	describe('graph', () => {
		describe('colours', () => {
			const mockColoursExtensionSetting = (value: any) => {
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
			};

			it('Should return a filtered array of colours based on the configuration value', () => {
				// Setup
				mockColoursExtensionSetting(['#ff0000', '#0000000', '#00ff0088', 'rgb(1,2,3)', 'rgb(1,2,x)']);

				// Run
				const value = config.graph.colours;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('graph.colours', 'graphColours');
				expect(value).toHaveLength(3);
				expect(value[0]).toBe('#ff0000');
				expect(value[1]).toBe('#00ff0088');
				expect(value[2]).toBe('rgb(1,2,3)');
			});

			it('Should return the default value when the configuration value is invalid (not an array)', () => {
				// Setup
				mockColoursExtensionSetting(5);

				// Run
				const value = config.graph.colours;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('graph.colours', 'graphColours');
				expect(value).toStrictEqual(['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00']);
			});

			it('Should return the default value when the configuration value is invalid (an empty array)', () => {
				// Setup
				mockColoursExtensionSetting([]);

				// Run
				const value = config.graph.colours;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('graph.colours', 'graphColours');
				expect(value).toStrictEqual(['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00']);
			});

			it('Should return the default value when the configuration value is unknown', () => {
				// Setup
				mockColoursExtensionSetting(undefined);

				// Run
				const value = config.graph.colours;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('graph.colours', 'graphColours');
				expect(value).toStrictEqual(['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00']);
			});
		});

		describe('style', () => {
			const mockStyleExtensionSetting = (value: any) => {
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
			};

			it('Should return GraphStyle.Rounded when the configuration value is "rounded"', () => {
				// Setup
				mockStyleExtensionSetting('rounded');

				// Run
				const value = config.graph.style;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('graph.style', 'graphStyle');
				expect(value).toBe(GraphStyle.Rounded);
			});

			it('Should return GraphStyle.Angular when the configuration value is "angular"', () => {
				// Setup
				mockStyleExtensionSetting('angular');

				// Run
				const value = config.graph.style;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('graph.style', 'graphStyle');
				expect(value).toBe(GraphStyle.Angular);
			});

			it('Should return the default value (GraphStyle.Rounded) when the configuration value is invalid', () => {
				// Setup
				mockStyleExtensionSetting('invalid');

				// Run
				const value = config.graph.style;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('graph.style', 'graphStyle');
				expect(value).toBe(GraphStyle.Rounded);
			});

			it('Should return the default value (GraphStyle.Rounded) when the configuration value is unknown', () => {
				// Setup
				mockStyleExtensionSetting(undefined);

				// Run
				const value = config.graph.style;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('graph.style', 'graphStyle');
				expect(value).toBe(GraphStyle.Rounded);
			});
		});
	});

	describe('integratedTerminalShell', () => {
		it('Should return the configured value', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('/path/to/shell');

			// Run
			const value = config.integratedTerminalShell;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('integratedTerminalShell', '');
			expect(value).toBe('/path/to/shell');
		});

		it('Should return the default configuration value ("")', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.integratedTerminalShell;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('integratedTerminalShell', '');
			expect(value).toBe('');
		});
	});

	describe('maxDepthOfRepoSearch', () => {
		it('Should return the configured value', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.maxDepthOfRepoSearch;

			expect(workspaceConfiguration.get).toBeCalledWith('maxDepthOfRepoSearch', 0);
			expect(value).toBe(5);
		});

		it('Should return the default configuration value (0)', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

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
			vscode.mockRenamedExtensionSettingReturningValueOnce('Active');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Active);
		});

		it('Should return vscode.ViewColumn.Beside when the configuration value is "Beside"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Beside');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Beside);
		});

		it('Should return vscode.ViewColumn.One when the configuration value is "One"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('One');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.One);
		});

		it('Should return vscode.ViewColumn.Two when the configuration value is "Two"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Two');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Two);
		});

		it('Should return vscode.ViewColumn.Three when the configuration value is "Three"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Three');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Three);
		});

		it('Should return vscode.ViewColumn.Four when the configuration value is "Four"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Four');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Four);
		});

		it('Should return vscode.ViewColumn.Five when the configuration value is "Five"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Five');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Five);
		});

		it('Should return vscode.ViewColumn.Six when the configuration value is "Six"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Six');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Six);
		});

		it('Should return vscode.ViewColumn.Seven when the configuration value is "Seven"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Seven');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Seven);
		});

		it('Should return vscode.ViewColumn.Eight when the configuration value is "Eight"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Eight');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Eight);
		});

		it('Should return vscode.ViewColumn.Nine when the configuration value is "Nine"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('Nine');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Nine);
		});

		it('Should return the default value (vscode.ViewColumn.Active) when the configuration value is invalid', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('invalid');

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Active);
		});

		it('Should return the default value (vscode.ViewColumn.Active) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.openNewTabEditorGroup;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('openNewTabEditorGroup', 'openDiffTabLocation');
			expect(value).toBe(vscode.ViewColumn.Active);
		});
	});

	describe('openToTheRepoOfTheActiveTextEditorDocument', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.openToTheRepoOfTheActiveTextEditorDocument;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openToTheRepoOfTheActiveTextEditorDocument', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.openToTheRepoOfTheActiveTextEditorDocument;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openToTheRepoOfTheActiveTextEditorDocument', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.openToTheRepoOfTheActiveTextEditorDocument;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openToTheRepoOfTheActiveTextEditorDocument', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.openToTheRepoOfTheActiveTextEditorDocument;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openToTheRepoOfTheActiveTextEditorDocument', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.openToTheRepoOfTheActiveTextEditorDocument;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openToTheRepoOfTheActiveTextEditorDocument', false);
			expect(value).toBe(false);
		});
	});

	describe('referenceLabels', () => {
		describe('combineLocalAndRemoteBranchLabels', () => {
			const mockCombineLocalAndRemoteBranchLabelsExtensionSetting = (value: any) => {
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
			};

			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				mockCombineLocalAndRemoteBranchLabelsExtensionSetting(true);

				// Run
				const value = config.referenceLabels.combineLocalAndRemoteBranchLabels;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.combineLocalAndRemoteBranchLabels', 'combineLocalAndRemoteBranchLabels');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				mockCombineLocalAndRemoteBranchLabelsExtensionSetting(false);

				// Run
				const value = config.referenceLabels.combineLocalAndRemoteBranchLabels;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.combineLocalAndRemoteBranchLabels', 'combineLocalAndRemoteBranchLabels');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				mockCombineLocalAndRemoteBranchLabelsExtensionSetting(5);

				// Run
				const value = config.referenceLabels.combineLocalAndRemoteBranchLabels;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.combineLocalAndRemoteBranchLabels', 'combineLocalAndRemoteBranchLabels');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				mockCombineLocalAndRemoteBranchLabelsExtensionSetting(0);

				// Run
				const value = config.referenceLabels.combineLocalAndRemoteBranchLabels;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.combineLocalAndRemoteBranchLabels', 'combineLocalAndRemoteBranchLabels');
				expect(value).toBe(false);
			});

			it('Should return the default value (TRUE) when the configuration value is unknown', () => {
				// Setup
				mockCombineLocalAndRemoteBranchLabelsExtensionSetting(undefined);

				// Run
				const value = config.referenceLabels.combineLocalAndRemoteBranchLabels;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.combineLocalAndRemoteBranchLabels', 'combineLocalAndRemoteBranchLabels');
				expect(value).toBe(true);
			});
		});

		describe('branchLabelsAlignedToGraph & tagLabelsOnRight', () => {
			const mockAlignmentExtensionSetting = (value: any) => {
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
			};

			it('Should return correct alignment values when the configuration value is "Normal"', () => {
				// Setup
				mockAlignmentExtensionSetting('Normal');

				// Run
				const value = config.referenceLabels;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.alignment', 'referenceLabelAlignment');
				expect(value.branchLabelsAlignedToGraph).toBe(false);
				expect(value.tagLabelsOnRight).toBe(false);
			});

			it('Should return correct alignment values when the configuration value is "Branches (on the left) & Tags (on the right)"', () => {
				// Setup
				mockAlignmentExtensionSetting('Branches (on the left) & Tags (on the right)');

				// Run
				const value = config.referenceLabels;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.alignment', 'referenceLabelAlignment');
				expect(value.branchLabelsAlignedToGraph).toBe(false);
				expect(value.tagLabelsOnRight).toBe(true);
			});

			it('Should return correct alignment values when the configuration value is "Branches (aligned to the graph) & Tags (on the right)"', () => {
				// Setup
				mockAlignmentExtensionSetting('Branches (aligned to the graph) & Tags (on the right)');

				// Run
				const value = config.referenceLabels;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.alignment', 'referenceLabelAlignment');
				expect(value.branchLabelsAlignedToGraph).toBe(true);
				expect(value.tagLabelsOnRight).toBe(true);
			});

			it('Should return the default values when the configuration value is invalid', () => {
				// Setup
				mockAlignmentExtensionSetting('invalid');

				// Run
				const value = config.referenceLabels;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.alignment', 'referenceLabelAlignment');
				expect(value.branchLabelsAlignedToGraph).toBe(false);
				expect(value.tagLabelsOnRight).toBe(false);
			});

			it('Should return the default values when the configuration value is unknown', () => {
				// Setup
				mockAlignmentExtensionSetting(undefined);

				// Run
				const value = config.referenceLabels;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('referenceLabels.alignment', 'referenceLabelAlignment');
				expect(value.branchLabelsAlignedToGraph).toBe(false);
				expect(value.tagLabelsOnRight).toBe(false);
			});
		});
	});

	describe('fetchAvatars', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(true);

			// Run
			const value = config.fetchAvatars;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.fetchAvatars', 'fetchAvatars');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(false);

			// Run
			const value = config.fetchAvatars;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.fetchAvatars', 'fetchAvatars');
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(5);

			// Run
			const value = config.fetchAvatars;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.fetchAvatars', 'fetchAvatars');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(0);

			// Run
			const value = config.fetchAvatars;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.fetchAvatars', 'fetchAvatars');
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.fetchAvatars;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.fetchAvatars', 'fetchAvatars');
			expect(value).toBe(false);
		});
	});

	describe('initialLoadCommits', () => {
		it('Should return the configured value', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(600);

			// Run
			const value = config.initialLoadCommits;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.initialLoad', 'initialLoadCommits');
			expect(value).toBe(600);
		});

		it('Should return the default configuration value (300)', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.initialLoadCommits;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.initialLoad', 'initialLoadCommits');
			expect(value).toBe(300);
		});
	});

	describe('loadMoreCommits', () => {
		it('Should return the configured value', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(200);

			// Run
			const value = config.loadMoreCommits;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.loadMore', 'loadMoreCommits');
			expect(value).toBe(200);
		});

		it('Should return the default configuration value (100)', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.loadMoreCommits;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.loadMore', 'loadMoreCommits');
			expect(value).toBe(100);
		});
	});

	describe('loadMoreCommitsAutomatically', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(true);

			// Run
			const value = config.loadMoreCommitsAutomatically;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.loadMoreAutomatically', 'loadMoreCommitsAutomatically');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(false);

			// Run
			const value = config.loadMoreCommitsAutomatically;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.loadMoreAutomatically', 'loadMoreCommitsAutomatically');
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(5);

			// Run
			const value = config.loadMoreCommitsAutomatically;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.loadMoreAutomatically', 'loadMoreCommitsAutomatically');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(0);

			// Run
			const value = config.loadMoreCommitsAutomatically;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.loadMoreAutomatically', 'loadMoreCommitsAutomatically');
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.loadMoreCommitsAutomatically;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.loadMoreAutomatically', 'loadMoreCommitsAutomatically');
			expect(value).toBe(true);
		});
	});

	describe('muteCommits', () => {
		describe('commitsNotAncestorsOfHead', () => {
			const mockCommitsNotAncestorsOfHeadExtensionSetting = (value: any) => {
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
			};

			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				mockCommitsNotAncestorsOfHeadExtensionSetting(true);

				// Run
				const value = config.muteCommits.commitsNotAncestorsOfHead;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 'muteCommitsThatAreNotAncestorsOfHead');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				mockCommitsNotAncestorsOfHeadExtensionSetting(false);

				// Run
				const value = config.muteCommits.commitsNotAncestorsOfHead;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 'muteCommitsThatAreNotAncestorsOfHead');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				mockCommitsNotAncestorsOfHeadExtensionSetting(5);

				// Run
				const value = config.muteCommits.commitsNotAncestorsOfHead;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 'muteCommitsThatAreNotAncestorsOfHead');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				mockCommitsNotAncestorsOfHeadExtensionSetting(0);

				// Run
				const value = config.muteCommits.commitsNotAncestorsOfHead;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 'muteCommitsThatAreNotAncestorsOfHead');
				expect(value).toBe(false);
			});

			it('Should return the default value (FALSE) when the configuration value is unknown', () => {
				// Setup
				mockCommitsNotAncestorsOfHeadExtensionSetting(undefined);

				// Run
				const value = config.muteCommits.commitsNotAncestorsOfHead;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.commitsThatAreNotAncestorsOfHead', 'muteCommitsThatAreNotAncestorsOfHead');
				expect(value).toBe(false);
			});
		});

		describe('mergeCommits', () => {
			const mockMergeCommitsExtensionSetting = (value: any) => {
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
			};

			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				mockMergeCommitsExtensionSetting(true);

				// Run
				const value = config.muteCommits.mergeCommits;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.mergeCommits', 'muteMergeCommits');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				mockMergeCommitsExtensionSetting(false);

				// Run
				const value = config.muteCommits.mergeCommits;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.mergeCommits', 'muteMergeCommits');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				mockMergeCommitsExtensionSetting(5);

				// Run
				const value = config.muteCommits.mergeCommits;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.mergeCommits', 'muteMergeCommits');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				mockMergeCommitsExtensionSetting(0);

				// Run
				const value = config.muteCommits.mergeCommits;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.mergeCommits', 'muteMergeCommits');
				expect(value).toBe(false);
			});

			it('Should return the default value (TRUE) when the configuration value is unknown', () => {
				// Setup
				mockMergeCommitsExtensionSetting(undefined);

				// Run
				const value = config.muteCommits.mergeCommits;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.mute.mergeCommits', 'muteMergeCommits');
				expect(value).toBe(true);
			});
		});
	});

	describe('commitOrder', () => {
		it('Should return CommitOrdering.Date when the configuration value is "date"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('date');

			// Run
			const value = config.commitOrder;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.order', 'commitOrdering');
			expect(value).toBe(CommitOrdering.Date);
		});

		it('Should return CommitOrdering.AuthorDate when the configuration value is "author-date"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('author-date');

			// Run
			const value = config.commitOrder;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.order', 'commitOrdering');
			expect(value).toBe(CommitOrdering.AuthorDate);
		});

		it('Should return CommitOrdering.Topological when the configuration value is "topo"', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('topo');

			// Run
			const value = config.commitOrder;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.order', 'commitOrdering');
			expect(value).toBe(CommitOrdering.Topological);
		});

		it('Should return the default value (CommitOrdering.Date) when the configuration value is invalid', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce('invalid');

			// Run
			const value = config.commitOrder;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.order', 'commitOrdering');
			expect(value).toBe(CommitOrdering.Date);
		});

		it('Should return the default value (CommitOrdering.Date) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.commitOrder;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.order', 'commitOrdering');
			expect(value).toBe(CommitOrdering.Date);
		});
	});

	describe('fetchAndPrune', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(true);

			// Run
			const value = config.fetchAndPrune;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.fetchAndPrune', 'fetchAndPrune');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(false);

			// Run
			const value = config.fetchAndPrune;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.fetchAndPrune', 'fetchAndPrune');
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(5);

			// Run
			const value = config.fetchAndPrune;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.fetchAndPrune', 'fetchAndPrune');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(0);

			// Run
			const value = config.fetchAndPrune;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.fetchAndPrune', 'fetchAndPrune');
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.fetchAndPrune;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.fetchAndPrune', 'fetchAndPrune');
			expect(value).toBe(false);
		});
	});

	describe('fetchAndPruneTags', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.fetchAndPruneTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repository.fetchAndPruneTags', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.fetchAndPruneTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repository.fetchAndPruneTags', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.fetchAndPruneTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repository.fetchAndPruneTags', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.fetchAndPruneTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repository.fetchAndPruneTags', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.fetchAndPruneTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repository.fetchAndPruneTags', false);
			expect(value).toBe(false);
		});
	});

	describe('includeCommitsMentionedByReflogs', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(true);

			// Run
			const value = config.includeCommitsMentionedByReflogs;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.includeCommitsMentionedByReflogs', 'includeCommitsMentionedByReflogs');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(false);

			// Run
			const value = config.includeCommitsMentionedByReflogs;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.includeCommitsMentionedByReflogs', 'includeCommitsMentionedByReflogs');
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(5);

			// Run
			const value = config.includeCommitsMentionedByReflogs;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.includeCommitsMentionedByReflogs', 'includeCommitsMentionedByReflogs');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(0);

			// Run
			const value = config.includeCommitsMentionedByReflogs;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.includeCommitsMentionedByReflogs', 'includeCommitsMentionedByReflogs');
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.includeCommitsMentionedByReflogs;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.includeCommitsMentionedByReflogs', 'includeCommitsMentionedByReflogs');
			expect(value).toBe(false);
		});
	});

	describe('onRepoLoad', () => {
		describe('scrollToHead', () => {
			const mockScrollToHeadExtensionSetting = (value: any) => {
				workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
			};

			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				mockScrollToHeadExtensionSetting(true);

				// Run
				const value = config.onRepoLoad.scrollToHead;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.scrollToHead', 'openRepoToHead');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				mockScrollToHeadExtensionSetting(false);

				// Run
				const value = config.onRepoLoad.scrollToHead;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.scrollToHead', 'openRepoToHead');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				mockScrollToHeadExtensionSetting(5);

				// Run
				const value = config.onRepoLoad.scrollToHead;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.scrollToHead', 'openRepoToHead');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				mockScrollToHeadExtensionSetting(0);

				// Run
				const value = config.onRepoLoad.scrollToHead;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.scrollToHead', 'openRepoToHead');
				expect(value).toBe(false);
			});

			it('Should return the default value (FALSE) when the configuration value is unknown', () => {
				// Setup
				mockScrollToHeadExtensionSetting(undefined);

				// Run
				const value = config.onRepoLoad.scrollToHead;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.scrollToHead', 'openRepoToHead');
				expect(value).toBe(false);
			});
		});

		describe('showCheckedOutBranch', () => {
			const mockShowCheckedOutBranchExtensionSetting = (value: any) => {
				workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(value);
			};

			it('Should return TRUE when the configuration value is TRUE', () => {
				// Setup
				mockShowCheckedOutBranchExtensionSetting(true);

				// Run
				const value = config.onRepoLoad.showCheckedOutBranch;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.showCheckedOutBranch', 'showCurrentBranchByDefault');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is FALSE', () => {
				// Setup
				mockShowCheckedOutBranchExtensionSetting(false);

				// Run
				const value = config.onRepoLoad.showCheckedOutBranch;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.showCheckedOutBranch', 'showCurrentBranchByDefault');
				expect(value).toBe(false);
			});

			it('Should return TRUE when the configuration value is truthy', () => {
				// Setup
				mockShowCheckedOutBranchExtensionSetting(5);

				// Run
				const value = config.onRepoLoad.showCheckedOutBranch;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.showCheckedOutBranch', 'showCurrentBranchByDefault');
				expect(value).toBe(true);
			});

			it('Should return FALSE when the configuration value is falsy', () => {
				// Setup
				mockShowCheckedOutBranchExtensionSetting(0);

				// Run
				const value = config.onRepoLoad.showCheckedOutBranch;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.showCheckedOutBranch', 'showCurrentBranchByDefault');
				expect(value).toBe(false);
			});

			it('Should return the default value (FALSE) when the configuration value is unknown', () => {
				// Setup
				mockShowCheckedOutBranchExtensionSetting(undefined);

				// Run
				const value = config.onRepoLoad.showCheckedOutBranch;

				// Assert
				vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onLoad.showCheckedOutBranch', 'showCurrentBranchByDefault');
				expect(value).toBe(false);
			});
		});

		describe('showSpecificBranches', () => {
			const mockShowSpecificBranchesExtensionSetting = (value: any) => {
				workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => value || defaultValue);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
				vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);
			};

			it('Should return all branches when correctly configured', () => {
				// Setup
				mockShowSpecificBranchesExtensionSetting(['master', 'develop']);

				// Run
				const value = config.onRepoLoad.showSpecificBranches;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('repository.onLoad.showSpecificBranches', expect.anything());
				expect(value).toStrictEqual(['master', 'develop']);
			});

			it('Should filter out all non-string branches', () => {
				// Setup
				mockShowSpecificBranchesExtensionSetting(['master', 5, 'develop']);

				// Run
				const value = config.onRepoLoad.showSpecificBranches;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('repository.onLoad.showSpecificBranches', expect.anything());
				expect(value).toStrictEqual(['master', 'develop']);
			});

			it('Should return the default value ([]) when the configuration value is invalid', () => {
				// Setup
				mockShowSpecificBranchesExtensionSetting('master');

				// Run
				const value = config.onRepoLoad.showSpecificBranches;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('repository.onLoad.showSpecificBranches', expect.anything());
				expect(value).toStrictEqual([]);
			});

			it('Should return the default value ([]) when the configuration value is unknown', () => {
				// Setup
				mockShowSpecificBranchesExtensionSetting(undefined);

				// Run
				const value = config.onRepoLoad.showSpecificBranches;

				// Assert
				expect(workspaceConfiguration.get).toBeCalledWith('repository.onLoad.showSpecificBranches', expect.anything());
				expect(value).toStrictEqual([]);
			});
		});
	});

	describe('onlyFollowFirstParent', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(true);

			// Run
			const value = config.onlyFollowFirstParent;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onlyFollowFirstParent', 'onlyFollowFirstParent');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(false);

			// Run
			const value = config.onlyFollowFirstParent;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onlyFollowFirstParent', 'onlyFollowFirstParent');
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(5);

			// Run
			const value = config.onlyFollowFirstParent;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onlyFollowFirstParent', 'onlyFollowFirstParent');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(0);

			// Run
			const value = config.onlyFollowFirstParent;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onlyFollowFirstParent', 'onlyFollowFirstParent');
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.onlyFollowFirstParent;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.onlyFollowFirstParent', 'onlyFollowFirstParent');
			expect(value).toBe(false);
		});
	});

	describe('showCommitsOnlyReferencedByTags', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(true);

			// Run
			const value = config.showCommitsOnlyReferencedByTags;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showCommitsOnlyReferencedByTags', 'showCommitsOnlyReferencedByTags');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(false);

			// Run
			const value = config.showCommitsOnlyReferencedByTags;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showCommitsOnlyReferencedByTags', 'showCommitsOnlyReferencedByTags');
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(5);

			// Run
			const value = config.showCommitsOnlyReferencedByTags;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showCommitsOnlyReferencedByTags', 'showCommitsOnlyReferencedByTags');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(0);

			// Run
			const value = config.showCommitsOnlyReferencedByTags;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showCommitsOnlyReferencedByTags', 'showCommitsOnlyReferencedByTags');
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.showCommitsOnlyReferencedByTags;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showCommitsOnlyReferencedByTags', 'showCommitsOnlyReferencedByTags');
			expect(value).toBe(true);
		});
	});

	describe('showSignatureStatus', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(true);

			// Run
			const value = config.showSignatureStatus;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.showSignatureStatus', 'showSignatureStatus');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(false);

			// Run
			const value = config.showSignatureStatus;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.showSignatureStatus', 'showSignatureStatus');
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(5);

			// Run
			const value = config.showSignatureStatus;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.showSignatureStatus', 'showSignatureStatus');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(0);

			// Run
			const value = config.showSignatureStatus;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.showSignatureStatus', 'showSignatureStatus');
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.showSignatureStatus;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.commits.showSignatureStatus', 'showSignatureStatus');
			expect(value).toBe(false);
		});
	});

	describe('showRemoteBranches', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.showRemoteBranches;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repository.showRemoteBranches', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.showRemoteBranches;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repository.showRemoteBranches', true);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.showRemoteBranches;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repository.showRemoteBranches', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.showRemoteBranches;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repository.showRemoteBranches', true);
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.showRemoteBranches;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repository.showRemoteBranches', true);
			expect(value).toBe(true);
		});
	});

	describe('showTags', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(true);

			// Run
			const value = config.showTags;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showTags', 'showTags');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(false);

			// Run
			const value = config.showTags;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showTags', 'showTags');
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(5);

			// Run
			const value = config.showTags;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showTags', 'showTags');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(0);

			// Run
			const value = config.showTags;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showTags', 'showTags');
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.showTags;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showTags', 'showTags');
			expect(value).toBe(true);
		});
	});

	describe('showUncommittedChanges', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(true);

			// Run
			const value = config.showUncommittedChanges;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showUncommittedChanges', 'showUncommittedChanges');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(false);

			// Run
			const value = config.showUncommittedChanges;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showUncommittedChanges', 'showUncommittedChanges');
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(5);

			// Run
			const value = config.showUncommittedChanges;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showUncommittedChanges', 'showUncommittedChanges');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(0);

			// Run
			const value = config.showUncommittedChanges;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showUncommittedChanges', 'showUncommittedChanges');
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.showUncommittedChanges;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showUncommittedChanges', 'showUncommittedChanges');
			expect(value).toBe(true);
		});
	});

	describe('showUntrackedFiles', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(true);

			// Run
			const value = config.showUntrackedFiles;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showUntrackedFiles', 'showUntrackedFiles');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(false);

			// Run
			const value = config.showUntrackedFiles;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showUntrackedFiles', 'showUntrackedFiles');
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(5);

			// Run
			const value = config.showUntrackedFiles;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showUntrackedFiles', 'showUntrackedFiles');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(0);

			// Run
			const value = config.showUntrackedFiles;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showUntrackedFiles', 'showUntrackedFiles');
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.showUntrackedFiles;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.showUntrackedFiles', 'showUntrackedFiles');
			expect(value).toBe(true);
		});
	});

	describe('useMailmap', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(true);

			// Run
			const value = config.useMailmap;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.useMailmap', 'useMailmap');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(false);

			// Run
			const value = config.useMailmap;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.useMailmap', 'useMailmap');
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(5);

			// Run
			const value = config.useMailmap;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.useMailmap', 'useMailmap');
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(0);

			// Run
			const value = config.useMailmap;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.useMailmap', 'useMailmap');
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is unknown', () => {
			// Setup
			vscode.mockRenamedExtensionSettingReturningValueOnce(undefined);

			// Run
			const value = config.useMailmap;

			// Assert
			vscode.expectRenamedExtensionSettingToHaveBeenCalled('repository.useMailmap', 'useMailmap');
			expect(value).toBe(false);
		});
	});

	describe('repoDropdownOrder', () => {
		it('Should return RepoDropdownOrder.Name when the configuration value is "Name"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Name');

			// Run
			const value = config.repoDropdownOrder;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repositoryDropdownOrder', 'Full Path');
			expect(value).toBe(RepoDropdownOrder.Name);
		});

		it('Should return RepoDropdownOrder.FullPath when the configuration value is "Full Path"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Full Path');

			// Run
			const value = config.repoDropdownOrder;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repositoryDropdownOrder', 'Full Path');
			expect(value).toBe(RepoDropdownOrder.FullPath);
		});

		it('Should return the default value (RepoDropdownOrder.FullPath) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.repoDropdownOrder;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repositoryDropdownOrder', 'Full Path');
			expect(value).toBe(RepoDropdownOrder.FullPath);
		});

		it('Should return the default value (RepoDropdownOrder.FullPath) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.repoDropdownOrder;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('repositoryDropdownOrder', 'Full Path');
			expect(value).toBe(RepoDropdownOrder.FullPath);
		});
	});

	describe('retainContextWhenHidden', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.retainContextWhenHidden;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('retainContextWhenHidden', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.retainContextWhenHidden;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('retainContextWhenHidden', true);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.retainContextWhenHidden;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('retainContextWhenHidden', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.retainContextWhenHidden;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('retainContextWhenHidden', true);
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.retainContextWhenHidden;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('retainContextWhenHidden', true);
			expect(value).toBe(true);
		});
	});

	describe('showStatusBarItem', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.showStatusBarItem;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showStatusBarItem', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.showStatusBarItem;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showStatusBarItem', true);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.showStatusBarItem;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showStatusBarItem', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.showStatusBarItem;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showStatusBarItem', true);
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.showStatusBarItem;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showStatusBarItem', true);
			expect(value).toBe(true);
		});
	});

	describe('tabIconColourTheme', () => {
		it('Should return TabIconColourTheme.Colour when the configuration value is "colour"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('colour');

			// Run
			const value = config.tabIconColourTheme;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('tabIconColourTheme', 'colour');
			expect(value).toBe(TabIconColourTheme.Colour);
		});

		it('Should return TabIconColourTheme.Grey when the configuration value is "grey"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('grey');

			// Run
			const value = config.tabIconColourTheme;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('tabIconColourTheme', 'colour');
			expect(value).toBe(TabIconColourTheme.Grey);
		});

		it('Should return the default value (TabIconColourTheme.Colour) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.tabIconColourTheme;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('tabIconColourTheme', 'colour');
			expect(value).toBe(TabIconColourTheme.Colour);
		});

		it('Should return the default value (TabIconColourTheme.Colour) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.tabIconColourTheme;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('tabIconColourTheme', 'colour');
			expect(value).toBe(TabIconColourTheme.Colour);
		});
	});

	describe('gitPath', () => {
		it('Should return the configured path', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('/path/to/git');

			// Run
			const value = config.gitPath;

			// Assert
			expect(vscode.workspace.getConfiguration).toBeCalledWith('git');
			expect(workspaceConfiguration.get).toBeCalledWith('path', null);
			expect(value).toBe('/path/to/git');
		});

		it('Should return NULL when the configuration value is NULL', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(null);

			// Run
			const value = config.gitPath;

			// Assert
			expect(vscode.workspace.getConfiguration).toBeCalledWith('git');
			expect(workspaceConfiguration.get).toBeCalledWith('path', null);
			expect(value).toBe(null);
		});

		it('Should return the default configuration value (NULL)', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.gitPath;

			// Assert
			expect(vscode.workspace.getConfiguration).toBeCalledWith('git');
			expect(workspaceConfiguration.get).toBeCalledWith('path', null);
			expect(value).toBe(null);
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
});
