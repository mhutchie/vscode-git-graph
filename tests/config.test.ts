import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });

import { getConfig } from '../src/config';
import { CommitDetailsViewLocation, CommitOrdering, DateFormatType, DateType, FileViewType, GitResetMode, GraphStyle, RefLabelAlignment, TabIconColourTheme } from '../src/types';

let workspaceConfiguration = vscode.mocks.workspaceConfiguration;

beforeEach(() => {
	vscode.workspace.getConfiguration.mockClear();
	workspaceConfiguration.get.mockClear();
});

describe('Config', () => {
	let config: ReturnType<typeof getConfig>;
	beforeEach(() => {
		config = getConfig();
	});

	describe('autoCenterCommitDetailsView', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.autoCenterCommitDetailsView;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('autoCenterCommitDetailsView', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.autoCenterCommitDetailsView;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('autoCenterCommitDetailsView', true);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.autoCenterCommitDetailsView;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('autoCenterCommitDetailsView', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.autoCenterCommitDetailsView;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('autoCenterCommitDetailsView', true);
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.autoCenterCommitDetailsView;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('autoCenterCommitDetailsView', true);
			expect(value).toBe(true);
		});
	});

	describe('combineLocalAndRemoteBranchLabels', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.combineLocalAndRemoteBranchLabels;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('combineLocalAndRemoteBranchLabels', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.combineLocalAndRemoteBranchLabels;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('combineLocalAndRemoteBranchLabels', true);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.combineLocalAndRemoteBranchLabels;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('combineLocalAndRemoteBranchLabels', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.combineLocalAndRemoteBranchLabels;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('combineLocalAndRemoteBranchLabels', true);
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.combineLocalAndRemoteBranchLabels;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('combineLocalAndRemoteBranchLabels', true);
			expect(value).toBe(true);
		});
	});

	describe('commitDetailsViewLocation', () => {
		it('Should return CommitDetailsViewLocation.Inline when the configuration value is "Inline"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Inline');

			// Run
			const value = config.commitDetailsViewLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('commitDetailsViewLocation', 'Inline');
			expect(value).toBe(CommitDetailsViewLocation.Inline);
		});

		it('Should return CommitDetailsViewLocation.DockedToBottom when the configuration value is "Docked to Bottom"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Docked to Bottom');

			// Run
			const value = config.commitDetailsViewLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('commitDetailsViewLocation', 'Inline');
			expect(value).toBe(CommitDetailsViewLocation.DockedToBottom);
		});

		it('Should return the default value (CommitDetailsViewLocation.Inline) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.commitDetailsViewLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('commitDetailsViewLocation', 'Inline');
			expect(value).toBe(CommitDetailsViewLocation.Inline);
		});

		it('Should return the default value (CommitDetailsViewLocation.Inline) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.commitDetailsViewLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('commitDetailsViewLocation', 'Inline');
			expect(value).toBe(CommitDetailsViewLocation.Inline);
		});
	});

	describe('commitOrdering', () => {
		it('Should return CommitOrdering.Date when the configuration value is "date"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('date');

			// Run
			const value = config.commitOrdering;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('commitOrdering', 'date');
			expect(value).toBe(CommitOrdering.Date);
		});

		it('Should return CommitOrdering.AuthorDate when the configuration value is "author-date"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('author-date');

			// Run
			const value = config.commitOrdering;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('commitOrdering', 'date');
			expect(value).toBe(CommitOrdering.AuthorDate);
		});

		it('Should return CommitOrdering.Topological when the configuration value is "topo"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('topo');

			// Run
			const value = config.commitOrdering;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('commitOrdering', 'date');
			expect(value).toBe(CommitOrdering.Topological);
		});

		it('Should return the default value (CommitOrdering.Date) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.commitOrdering;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('commitOrdering', 'date');
			expect(value).toBe(CommitOrdering.Date);
		});

		it('Should return the default value (CommitOrdering.Date) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.commitOrdering;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('commitOrdering', 'date');
			expect(value).toBe(CommitOrdering.Date);
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
			workspaceConfiguration.get.mockReturnValueOnce('Date & Time');

			// Run
			const value = config.dateFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dateFormat', 'Date & Time');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: false });
		});

		it('Should successfully parse the configuration value "Date Only"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Date Only');

			// Run
			const value = config.dateFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dateFormat', 'Date & Time');
			expect(value).toStrictEqual({ type: DateFormatType.DateOnly, iso: false });
		});

		it('Should successfully parse the configuration value "ISO Date & Time"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('ISO Date & Time');

			// Run
			const value = config.dateFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dateFormat', 'Date & Time');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: true });
		});

		it('Should successfully parse the configuration value "ISO Date Only"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('ISO Date Only');

			// Run
			const value = config.dateFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dateFormat', 'Date & Time');
			expect(value).toStrictEqual({ type: DateFormatType.DateOnly, iso: true });
		});

		it('Should successfully parse the configuration value "Relative"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Relative');

			// Run
			const value = config.dateFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dateFormat', 'Date & Time');
			expect(value).toStrictEqual({ type: DateFormatType.Relative, iso: false });
		});

		it('Should return the default value when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.dateFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dateFormat', 'Date & Time');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: false });
		});

		it('Should return the default value when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.dateFormat;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dateFormat', 'Date & Time');
			expect(value).toStrictEqual({ type: DateFormatType.DateAndTime, iso: false });
		});
	});

	describe('dateType', () => {
		it('Should return DateType.Author when the configuration value is "Author Date"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Author Date');

			// Run
			const value = config.dateType;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dateType', 'Author Date');
			expect(value).toBe(DateType.Author);
		});

		it('Should return DateType.Commit when the configuration value is "Commit Date"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Commit Date');

			// Run
			const value = config.dateType;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dateType', 'Author Date');
			expect(value).toBe(DateType.Commit);
		});

		it('Should return the default value (DateType.Author) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.dateType;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dateType', 'Author Date');
			expect(value).toBe(DateType.Author);
		});

		it('Should return the default value (DateType.Author) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.dateType;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('dateType', 'Author Date');
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

	describe('defaultFileViewType', () => {
		it('Should return FileViewType.Tree when the configuration value is "File Tree"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('File Tree');

			// Run
			const value = config.defaultFileViewType;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultFileViewType', 'File Tree');
			expect(value).toBe(FileViewType.Tree);
		});

		it('Should return FileViewType.List when the configuration value is "File List"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('File List');

			// Run
			const value = config.defaultFileViewType;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultFileViewType', 'File Tree');
			expect(value).toBe(FileViewType.List);
		});

		it('Should return the default value (FileViewType.Tree) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.defaultFileViewType;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultFileViewType', 'File Tree');
			expect(value).toBe(FileViewType.Tree);
		});

		it('Should return the default value (FileViewType.Tree) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.defaultFileViewType;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('defaultFileViewType', 'File Tree');
			expect(value).toBe(FileViewType.Tree);
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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
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
					recordOrigin: true
				},
				createBranch: {
					checkout: true
				},
				deleteBranch: {
					forceDelete: true
				},
				merge: {
					noCommit: true,
					noFastForward: true,
					squash: true
				},
				popStash: {
					reinstateIndex: true
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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
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
					recordOrigin: false
				},
				createBranch: {
					checkout: false
				},
				deleteBranch: {
					forceDelete: false
				},
				merge: {
					noCommit: false,
					noFastForward: false,
					squash: false
				},
				popStash: {
					reinstateIndex: false
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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
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
					recordOrigin: true
				},
				createBranch: {
					checkout: true
				},
				deleteBranch: {
					forceDelete: true
				},
				merge: {
					noCommit: true,
					noFastForward: true,
					squash: true
				},
				popStash: {
					reinstateIndex: true
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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
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
					recordOrigin: false
				},
				createBranch: {
					checkout: false
				},
				deleteBranch: {
					forceDelete: false
				},
				merge: {
					noCommit: false,
					noFastForward: false,
					squash: false
				},
				popStash: {
					reinstateIndex: false
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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
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
					recordOrigin: false
				},
				createBranch: {
					checkout: false
				},
				deleteBranch: {
					forceDelete: false
				},
				merge: {
					noCommit: false,
					noFastForward: true,
					squash: false
				},
				popStash: {
					reinstateIndex: false
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
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.cherryPick.recordOrigin', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.createBranch.checkOut', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.deleteBranch.forceDelete', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noCommit', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.noFastForward', true);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.merge.squashCommits', false);
			expect(workspaceConfiguration.get).toBeCalledWith('dialog.popStash.reinstateIndex', false);
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
					recordOrigin: false
				},
				createBranch: {
					checkout: false
				},
				deleteBranch: {
					forceDelete: false
				},
				merge: {
					noCommit: false,
					noFastForward: true,
					squash: false
				},
				popStash: {
					reinstateIndex: false
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

	describe('fetchAndPrune', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.fetchAndPrune;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fetchAndPrune', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.fetchAndPrune;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fetchAndPrune', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.fetchAndPrune;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fetchAndPrune', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.fetchAndPrune;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fetchAndPrune', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.fetchAndPrune;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fetchAndPrune', false);
			expect(value).toBe(false);
		});
	});

	describe('fetchAvatars', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.fetchAvatars;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fetchAvatars', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.fetchAvatars;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fetchAvatars', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.fetchAvatars;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fetchAvatars', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.fetchAvatars;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fetchAvatars', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.fetchAvatars;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('fetchAvatars', false);
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

	describe('graphColours', () => {
		it('Should return a filtered array of colours based on the configuration value', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(['#ff0000', '#0000000', '#00ff0088', 'rgb(1,2,3)', 'rgb(1,2,x)']);

			// Run
			const value = config.graphColours;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('graphColours', []);
			expect(value).toHaveLength(3);
			expect(value[0]).toBe('#ff0000');
			expect(value[1]).toBe('#00ff0088');
			expect(value[2]).toBe('rgb(1,2,3)');
		});

		it('Should return the default value when the configuration value is invalid (not an array)', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.graphColours;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('graphColours', []);
			expect(value).toStrictEqual(['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00']);
		});

		it('Should return the default value when the configuration value is invalid (an empty array)', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce([]);

			// Run
			const value = config.graphColours;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('graphColours', []);
			expect(value).toStrictEqual(['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00']);
		});

		it('Should return the default value when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.graphColours;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('graphColours', []);
			expect(value).toStrictEqual(['#0085d9', '#d9008f', '#00d90a', '#d98500', '#a300d9', '#ff0000', '#00d9cc', '#e138e8', '#85d900', '#dc5b23', '#6f24d6', '#ffcc00']);
		});
	});

	describe('graphStyle', () => {
		it('Should return GraphStyle.Rounded when the configuration value is "rounded"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('rounded');

			// Run
			const value = config.graphStyle;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('graphStyle', 'rounded');
			expect(value).toBe(GraphStyle.Rounded);
		});

		it('Should return GraphStyle.Angular when the configuration value is "angular"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('angular');

			// Run
			const value = config.graphStyle;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('graphStyle', 'rounded');
			expect(value).toBe(GraphStyle.Angular);
		});

		it('Should return the default value (GraphStyle.Rounded) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.graphStyle;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('graphStyle', 'rounded');
			expect(value).toBe(GraphStyle.Rounded);
		});

		it('Should return the default value (GraphStyle.Rounded) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.graphStyle;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('graphStyle', 'rounded');
			expect(value).toBe(GraphStyle.Rounded);
		});
	});

	describe('includeCommitsMentionedByReflogs', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.includeCommitsMentionedByReflogs;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('includeCommitsMentionedByReflogs', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.includeCommitsMentionedByReflogs;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('includeCommitsMentionedByReflogs', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.includeCommitsMentionedByReflogs;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('includeCommitsMentionedByReflogs', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.includeCommitsMentionedByReflogs;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('includeCommitsMentionedByReflogs', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.includeCommitsMentionedByReflogs;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('includeCommitsMentionedByReflogs', false);
			expect(value).toBe(false);
		});
	});

	describe('initialLoadCommits', () => {
		it('Should return the configured value', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(600);

			// Run
			const value = config.initialLoadCommits;

			expect(workspaceConfiguration.get).toBeCalledWith('initialLoadCommits', 300);
			expect(value).toBe(600);
		});

		it('Should return the default configuration value (300)', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.initialLoadCommits;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('initialLoadCommits', 300);
			expect(value).toBe(300);
		});
	});

	describe('integratedTerminalShell', () => {
		it('Should return the configured value', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('/path/to/shell');

			// Run
			const value = config.integratedTerminalShell;

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

	describe('loadMoreCommits', () => {
		it('Should return the configured value', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(200);

			// Run
			const value = config.loadMoreCommits;

			expect(workspaceConfiguration.get).toBeCalledWith('loadMoreCommits', 100);
			expect(value).toBe(200);
		});

		it('Should return the default configuration value (100)', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.loadMoreCommits;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('loadMoreCommits', 100);
			expect(value).toBe(100);
		});
	});

	describe('loadMoreCommitsAutomatically', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.loadMoreCommitsAutomatically;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('loadMoreCommitsAutomatically', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.loadMoreCommitsAutomatically;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('loadMoreCommitsAutomatically', true);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.loadMoreCommitsAutomatically;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('loadMoreCommitsAutomatically', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.loadMoreCommitsAutomatically;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('loadMoreCommitsAutomatically', true);
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.loadMoreCommitsAutomatically;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('loadMoreCommitsAutomatically', true);
			expect(value).toBe(true);
		});
	});

	describe('muteCommitsThatAreNotAncestorsOfHead', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.muteCommitsThatAreNotAncestorsOfHead;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('muteCommitsThatAreNotAncestorsOfHead', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.muteCommitsThatAreNotAncestorsOfHead;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('muteCommitsThatAreNotAncestorsOfHead', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.muteCommitsThatAreNotAncestorsOfHead;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('muteCommitsThatAreNotAncestorsOfHead', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.muteCommitsThatAreNotAncestorsOfHead;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('muteCommitsThatAreNotAncestorsOfHead', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.muteCommitsThatAreNotAncestorsOfHead;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('muteCommitsThatAreNotAncestorsOfHead', false);
			expect(value).toBe(false);
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

	describe('muteMergeCommits', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.muteMergeCommits;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('muteMergeCommits', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.muteMergeCommits;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('muteMergeCommits', true);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.muteMergeCommits;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('muteMergeCommits', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.muteMergeCommits;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('muteMergeCommits', true);
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.muteMergeCommits;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('muteMergeCommits', true);
			expect(value).toBe(true);
		});
	});

	describe('onlyFollowFirstParent', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.onlyFollowFirstParent;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('onlyFollowFirstParent', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.onlyFollowFirstParent;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('onlyFollowFirstParent', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.onlyFollowFirstParent;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('onlyFollowFirstParent', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.onlyFollowFirstParent;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('onlyFollowFirstParent', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.onlyFollowFirstParent;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('onlyFollowFirstParent', false);
			expect(value).toBe(false);
		});
	});

	describe('openDiffTabLocation', () => {
		it('Should return vscode.ViewColumn.Active when the configuration value is "Active"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Active');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Active);
		});

		it('Should return vscode.ViewColumn.Beside when the configuration value is "Beside"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Beside');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Beside);
		});

		it('Should return vscode.ViewColumn.One when the configuration value is "One"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('One');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.One);
		});

		it('Should return vscode.ViewColumn.Two when the configuration value is "Two"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Two');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Two);
		});

		it('Should return vscode.ViewColumn.Three when the configuration value is "Three"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Three');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Three);
		});

		it('Should return vscode.ViewColumn.Four when the configuration value is "Four"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Four');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Four);
		});

		it('Should return vscode.ViewColumn.Five when the configuration value is "Five"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Five');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Five);
		});

		it('Should return vscode.ViewColumn.Six when the configuration value is "Six"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Six');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Six);
		});

		it('Should return vscode.ViewColumn.Seven when the configuration value is "Seven"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Seven');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Seven);
		});

		it('Should return vscode.ViewColumn.Eight when the configuration value is "Eight"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Eight');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Eight);
		});

		it('Should return vscode.ViewColumn.Nine when the configuration value is "Nine"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Nine');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Nine);
		});

		it('Should return the default value (vscode.ViewColumn.Active) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Active);
		});

		it('Should return the default value (vscode.ViewColumn.Active) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.openDiffTabLocation;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openDiffTabLocation', 'Active');
			expect(value).toBe(vscode.ViewColumn.Active);
		});
	});

	describe('openRepoToHead', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.openRepoToHead;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openRepoToHead', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.openRepoToHead;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openRepoToHead', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.openRepoToHead;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openRepoToHead', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.openRepoToHead;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openRepoToHead', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.openRepoToHead;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('openRepoToHead', false);
			expect(value).toBe(false);
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

	describe('refLabelAlignment', () => {
		it('Should return RefLabelAlignment.Normal when the configuration value is "Normal"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Normal');

			// Run
			const value = config.refLabelAlignment;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('referenceLabelAlignment', 'Normal');
			expect(value).toBe(RefLabelAlignment.Normal);
		});

		it('Should return RefLabelAlignment.BranchesOnLeftAndTagsOnRight when the configuration value is "Branches (on the left) & Tags (on the right)"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Branches (on the left) & Tags (on the right)');

			// Run
			const value = config.refLabelAlignment;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('referenceLabelAlignment', 'Normal');
			expect(value).toBe(RefLabelAlignment.BranchesOnLeftAndTagsOnRight);
		});

		it('Should return RefLabelAlignment.BranchesAlignedToGraphAndTagsOnRight when the configuration value is "Branches (aligned to the graph) & Tags (on the right)"', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('Branches (aligned to the graph) & Tags (on the right)');

			// Run
			const value = config.refLabelAlignment;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('referenceLabelAlignment', 'Normal');
			expect(value).toBe(RefLabelAlignment.BranchesAlignedToGraphAndTagsOnRight);
		});

		it('Should return the default value (RefLabelAlignment.Normal) when the configuration value is invalid', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce('invalid');

			// Run
			const value = config.refLabelAlignment;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('referenceLabelAlignment', 'Normal');
			expect(value).toBe(RefLabelAlignment.Normal);
		});

		it('Should return the default value (RefLabelAlignment.Normal) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.refLabelAlignment;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('referenceLabelAlignment', 'Normal');
			expect(value).toBe(RefLabelAlignment.Normal);
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

	describe('showCommitsOnlyReferencedByTags', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.showCommitsOnlyReferencedByTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showCommitsOnlyReferencedByTags', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.showCommitsOnlyReferencedByTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showCommitsOnlyReferencedByTags', true);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.showCommitsOnlyReferencedByTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showCommitsOnlyReferencedByTags', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.showCommitsOnlyReferencedByTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showCommitsOnlyReferencedByTags', true);
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.showCommitsOnlyReferencedByTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showCommitsOnlyReferencedByTags', true);
			expect(value).toBe(true);
		});
	});

	describe('showCurrentBranchByDefault', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.showCurrentBranchByDefault;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showCurrentBranchByDefault', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.showCurrentBranchByDefault;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showCurrentBranchByDefault', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.showCurrentBranchByDefault;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showCurrentBranchByDefault', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.showCurrentBranchByDefault;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showCurrentBranchByDefault', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.showCurrentBranchByDefault;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showCurrentBranchByDefault', false);
			expect(value).toBe(false);
		});
	});

	describe('showSignatureStatus', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.showSignatureStatus;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showSignatureStatus', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.showSignatureStatus;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showSignatureStatus', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.showSignatureStatus;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showSignatureStatus', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.showSignatureStatus;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showSignatureStatus', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.showSignatureStatus;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showSignatureStatus', false);
			expect(value).toBe(false);
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

	describe('showTags', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.showTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showTags', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.showTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showTags', true);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.showTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showTags', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.showTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showTags', true);
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.showTags;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showTags', true);
			expect(value).toBe(true);
		});
	});

	describe('showUncommittedChanges', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.showUncommittedChanges;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showUncommittedChanges', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.showUncommittedChanges;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showUncommittedChanges', true);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.showUncommittedChanges;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showUncommittedChanges', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.showUncommittedChanges;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showUncommittedChanges', true);
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.showUncommittedChanges;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showUncommittedChanges', true);
			expect(value).toBe(true);
		});
	});

	describe('showUntrackedFiles', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.showUntrackedFiles;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showUntrackedFiles', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.showUntrackedFiles;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showUntrackedFiles', true);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.showUntrackedFiles;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showUntrackedFiles', true);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.showUntrackedFiles;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showUntrackedFiles', true);
			expect(value).toBe(false);
		});

		it('Should return the default value (TRUE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.showUntrackedFiles;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('showUntrackedFiles', true);
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

	describe('useMailmap', () => {
		it('Should return TRUE when the configuration value is TRUE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(true);

			// Run
			const value = config.useMailmap;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('useMailmap', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is FALSE', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(false);

			// Run
			const value = config.useMailmap;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('useMailmap', false);
			expect(value).toBe(false);
		});

		it('Should return TRUE when the configuration value is truthy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(5);

			// Run
			const value = config.useMailmap;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('useMailmap', false);
			expect(value).toBe(true);
		});

		it('Should return FALSE when the configuration value is falsy', () => {
			// Setup
			workspaceConfiguration.get.mockReturnValueOnce(0);

			// Run
			const value = config.useMailmap;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('useMailmap', false);
			expect(value).toBe(false);
		});

		it('Should return the default value (FALSE) when the configuration value is not set', () => {
			// Setup
			workspaceConfiguration.get.mockImplementationOnce((_, defaultValue) => defaultValue);

			// Run
			const value = config.useMailmap;

			// Assert
			expect(workspaceConfiguration.get).toBeCalledWith('useMailmap', false);
			expect(value).toBe(false);
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
});
