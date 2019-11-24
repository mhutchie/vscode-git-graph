import * as fs from 'fs';
import { ExtensionContext, Memento } from 'vscode';
import { Avatar, AvatarCache } from './avatarManager';
import { CodeReview, ErrorInfo, FileViewType, GitRepoSet, GitRepoState } from './types';
import { getPathFromStr } from './utils';

const AVATAR_STORAGE_FOLDER = '/avatars';
const AVATAR_CACHE = 'avatarCache';
const CODE_REVIEWS = 'codeReviews';
const IGNORED_REPOS = 'ignoredRepos';
const LAST_ACTIVE_REPO = 'lastActiveRepo';
const LAST_KNOWN_GIT_PATH = 'lastKnownGitPath';
const REPO_STATES = 'repoStates';

export const DEFAULT_REPO_STATE: GitRepoState = {
	columnWidths: null,
	cdvDivider: 0.5,
	cdvHeight: 250,
	fileViewType: FileViewType.Default,
	issueLinkingConfig: null,
	showRemoteBranches: true,
	hideRemotes: []
};

export interface CodeReviewData {
	lastActive: number;
	lastViewedFile: string | null;
	remainingFiles: string[];
}
type CodeReviews = { [repo: string]: { [id: string]: CodeReviewData } };

export class ExtensionState {
	private readonly globalState: Memento;
	private readonly workspaceState: Memento;
	private readonly globalStoragePath: string;
	private avatarStorageAvailable: boolean = false;

	constructor(context: ExtensionContext) {
		this.globalState = context.globalState;
		this.workspaceState = context.workspaceState;

		this.globalStoragePath = getPathFromStr(context.globalStoragePath);
		fs.stat(this.globalStoragePath + AVATAR_STORAGE_FOLDER, (err) => {
			if (!err) {
				this.avatarStorageAvailable = true;
			} else {
				fs.mkdir(this.globalStoragePath, () => {
					fs.mkdir(this.globalStoragePath + AVATAR_STORAGE_FOLDER, (err) => {
						if (!err) this.avatarStorageAvailable = true;
					});
				});
			}
		});
	}


	/* Discovered Repos */

	public getRepos() {
		const repoSet = this.workspaceState.get<GitRepoSet>(REPO_STATES, {});
		Object.keys(repoSet).forEach(repo => {
			repoSet[repo] = Object.assign({}, DEFAULT_REPO_STATE, repoSet[repo]);
		});
		return repoSet;
	}

	public saveRepos(gitRepoSet: GitRepoSet) {
		this.workspaceState.update(REPO_STATES, gitRepoSet);
	}

	public transferRepo(oldRepo: string, newRepo: string) {
		if (this.getLastActiveRepo() === oldRepo) {
			this.setLastActiveRepo(newRepo);
		}

		let reviews = this.getCodeReviews();
		if (typeof reviews[oldRepo] !== 'undefined') {
			reviews[newRepo] = reviews[oldRepo];
			delete reviews[oldRepo];
			this.setCodeReviews(reviews);
		}
	}


	/* Ignored Repos */

	public getIgnoredRepos() {
		return this.workspaceState.get<string[]>(IGNORED_REPOS, []);
	}

	public setIgnoredRepos(ignoredRepos: string[]) {
		return this.workspaceState.update(IGNORED_REPOS, ignoredRepos);
	}


	/* Last Active Repo */

	public getLastActiveRepo() {
		return this.workspaceState.get<string | null>(LAST_ACTIVE_REPO, null);
	}

	public setLastActiveRepo(repo: string | null) {
		this.workspaceState.update(LAST_ACTIVE_REPO, repo);
	}


	/* Last Known Git Path */

	public getLastKnownGitPath() {
		return this.globalState.get<string | null>(LAST_KNOWN_GIT_PATH, null);
	}

	public setLastKnownGitPath(path: string) {
		this.globalState.update(LAST_KNOWN_GIT_PATH, path);
	}


	/* Avatars */

	public isAvatarStorageAvailable() {
		return this.avatarStorageAvailable;
	}

	public getAvatarStoragePath() {
		return this.globalStoragePath + AVATAR_STORAGE_FOLDER;
	}

	public getAvatarCache() {
		return this.globalState.get<AvatarCache>(AVATAR_CACHE, {});
	}

	public saveAvatar(email: string, avatar: Avatar) {
		let avatars = this.getAvatarCache();
		avatars[email] = avatar;
		this.globalState.update(AVATAR_CACHE, avatars);
	}

	public removeAvatarFromCache(email: string) {
		let avatars = this.getAvatarCache();
		delete avatars[email];
		this.globalState.update(AVATAR_CACHE, avatars);
	}

	public clearAvatarCache() {
		this.globalState.update(AVATAR_CACHE, {});
		fs.readdir(this.globalStoragePath + AVATAR_STORAGE_FOLDER, (err, files) => {
			if (err) return;
			for (let i = 0; i < files.length; i++) {
				fs.unlink(this.globalStoragePath + AVATAR_STORAGE_FOLDER + '/' + files[i], () => { });
			}
		});
	}


	/* Code Review */

	// Note: id => the commit arguments to 'git diff' (either <commit hash> or <commit hash>-<commit hash>)

	public startCodeReview(repo: string, id: string, files: string[], lastViewedFile: string | null) {
		let reviews = this.getCodeReviews();
		if (typeof reviews[repo] === 'undefined') reviews[repo] = {};
		reviews[repo][id] = { lastActive: (new Date()).getTime(), lastViewedFile: lastViewedFile, remainingFiles: files };
		return this.setCodeReviews(reviews).then((err) => ({
			codeReview: <CodeReview>Object.assign({ id: id }, reviews[repo][id]),
			error: err
		}));
	}

	public endCodeReview(repo: string, id: string) {
		let reviews = this.getCodeReviews();
		removeCodeReview(reviews, repo, id);
		this.setCodeReviews(reviews);
	}

	public getCodeReview(repo: string, id: string) {
		let reviews = this.getCodeReviews();
		if (typeof reviews[repo] !== 'undefined' && typeof reviews[repo][id] !== 'undefined') {
			reviews[repo][id].lastActive = (new Date()).getTime();
			this.setCodeReviews(reviews);
			return <CodeReview>Object.assign({ id: id }, reviews[repo][id]);
		} else {
			return null;
		}
	}

	public updateCodeReviewFileReviewed(repo: string, id: string, file: string) {
		let reviews = this.getCodeReviews();
		if (typeof reviews[repo] !== 'undefined' && typeof reviews[repo][id] !== 'undefined') {
			let i = reviews[repo][id].remainingFiles.indexOf(file);
			if (i > -1) reviews[repo][id].remainingFiles.splice(i, 1);
			if (reviews[repo][id].remainingFiles.length > 0) {
				reviews[repo][id].lastViewedFile = file;
				reviews[repo][id].lastActive = (new Date()).getTime();
			} else {
				removeCodeReview(reviews, repo, id);
			}
			this.setCodeReviews(reviews);
		}
	}

	public expireOldCodeReviews() {
		let reviews = this.getCodeReviews(), change = false, expireReviewsBefore = (new Date()).getTime() - 7776000000; // 90 days x 24 hours x 60 minutes x 60 seconds x 1000 milliseconds
		Object.keys(reviews).forEach((repo) => {
			Object.keys(reviews[repo]).forEach((id) => {
				if (reviews[repo][id].lastActive < expireReviewsBefore) {
					delete reviews[repo][id];
					change = true;
				}
			});
			removeCodeReviewRepoIfEmpty(reviews, repo);
		});
		if (change) this.setCodeReviews(reviews);
	}

	public endAllWorkspaceCodeReviews() {
		this.setCodeReviews({});
	}

	private getCodeReviews() {
		return this.workspaceState.get<CodeReviews>(CODE_REVIEWS, {});
	}

	private setCodeReviews(reviews: CodeReviews): Thenable<ErrorInfo> {
		return this.workspaceState.update(CODE_REVIEWS, reviews).then(
			() => null,
			() => 'Visual Studio Code was unable to update the Workspace State.'
		);
	}
}


/* Helper Methods */

function removeCodeReview(reviews: CodeReviews, repo: string, id: string) {
	if (typeof reviews[repo] !== 'undefined' && typeof reviews[repo][id] !== 'undefined') {
		delete reviews[repo][id];
		removeCodeReviewRepoIfEmpty(reviews, repo);
	}
}

function removeCodeReviewRepoIfEmpty(reviews: CodeReviews, repo: string) {
	if (typeof reviews[repo] !== 'undefined' && Object.keys(reviews[repo]).length === 0) {
		delete reviews[repo];
	}
}