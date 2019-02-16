import * as cp from 'child_process';
import { Config } from './config';
import { GitCommandStatus, GitCommit, GitCommitDetails, GitCommitNode, GitFileChangeType, GitRef, GitResetMode, GitUnsavedChanges } from './types';

const eolRegex = /\r\n|\r|\n/g;
const gitLogSeparator = 'XX7Nal-YARtTpjCikii9nJxER19D6diSyk-AWkPb';
const gitLogFormat = ['%H', '%P', '%an', '%ae', '%at', '%s'].join(gitLogSeparator);
const gitCommitDetailsFormat = ['%H', '%P', '%an', '%ae', '%at', '%cn', '%B'].join(gitLogSeparator);

export class DataSource {
	private workspaceDir: string;

	constructor(workspaceDir: string) {
		this.workspaceDir = workspaceDir;
	}

	public isGitRepository(): boolean {
		try {
			cp.execSync('git rev-parse --git-dir', { cwd: this.workspaceDir });
			return true;
		} catch (e) {
			return false;
		}
	}

	public getBranches(showRemoteBranches: boolean): string[] {
		try {
			let lines = cp.execSync('git branch' + (showRemoteBranches ? ' -a' : ''), { cwd: this.workspaceDir }).toString().split(eolRegex);
			let branches: string[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				let active = lines[i][0] === '*';
				let name = lines[i].substring(2).split(' ')[0];
				if (active) {
					branches.unshift(name);
				} else {
					branches.push(name);
				}
			}
			return branches;
		} catch (e) {
			return [];
		}
	}

	public getCommits(branch: string, maxCommits: number, showRemoteBranches: boolean, currentBranch: string | null) {
		let i, j;
		let commits = this.getGitLog(branch, maxCommits + 1, showRemoteBranches);
		let refs = this.getRefs(showRemoteBranches);
		let unsavedChanges = null;

		let moreCommitsAvailable = commits.length === maxCommits + 1;
		if (moreCommitsAvailable) commits.pop();

		let currentBranchHash = null;
		for (i = 0; i < refs.length; i++) {
			if (refs[i].name === currentBranch && refs[i].type === 'head') {
				currentBranchHash = refs[i].hash;
				break;
			}
		}
		if (currentBranchHash !== null && (branch === '' || branch === currentBranch)) {
			unsavedChanges = (new Config()).showUncommittedChanges() ? this.getGitUnsavedChanges() : null;
			if (unsavedChanges !== null) {
				for (j = 0; j < commits.length; j++) {
					if (currentBranchHash === commits[j].hash) {
						commits.unshift({ hash: '*', parentHashes: [currentBranchHash], author: '*', email: '', date: Math.round((new Date()).getTime() / 1000), message: 'Uncommitted Changes (' + unsavedChanges.changes + ')' });
						break;
					}
				}
			}
		}

		let commitNodes: GitCommitNode[] = [];
		let commitLookup: { [hash: string]: number } = {};

		for (i = 0; i < commits.length; i++) {
			commitLookup[commits[i].hash] = i;
			commitNodes.push({ hash: commits[i].hash, parents: [], author: commits[i].author, email: commits[i].email, date: commits[i].date, message: commits[i].message, refs: [], current: false });
		}
		for (i = 0; i < refs.length; i++) {
			if (typeof commitLookup[refs[i].hash] === 'number') {
				commitNodes[commitLookup[refs[i].hash]].refs.push(refs[i]);
			}
		}
		for (i = commits.length - 1; i >= 0; i--) {
			for (j = 0; j < commits[i].parentHashes.length; j++) {
				if (typeof commitLookup[commits[i].parentHashes[j]] === 'number') {
					commitNodes[i].parents.push(commitLookup[commits[i].parentHashes[j]]);
				}
			}
		}

		if (unsavedChanges !== null) {
			commitNodes[0].current = true;
		} else if (currentBranchHash !== null && typeof commitLookup[currentBranchHash] === 'number') {
			commitNodes[commitLookup[currentBranchHash]].current = true;
		}

		return { commits: commitNodes, moreCommitsAvailable: moreCommitsAvailable };
	}

	public commitDetails(commitHash: string) {
		try {
			let lines = cp.execSync('git show --quiet ' + commitHash + ' --format="' + gitCommitDetailsFormat + '"', { cwd: this.workspaceDir }).toString().split(eolRegex);
			let commitInfo = lines[0].split(gitLogSeparator);
			let details: GitCommitDetails = {
				hash: commitInfo[0],
				parents: commitInfo[1].split(' '),
				author: commitInfo[2],
				email: commitInfo[3],
				date: parseInt(commitInfo[4]),
				committer: commitInfo[5],
				body: commitInfo[6],
				fileChanges: []
			};

			let fileLookup: { [file: string]: number } = {};
			lines = cp.execSync('git diff-tree --name-status -r -m --root --find-renames --diff-filter=AMDR ' + commitHash, { cwd: this.workspaceDir }).toString().split(eolRegex);
			for (let i = 1; i < lines.length - 1; i++) {
				let line = lines[i].split('\t');
				if (line.length < 2) break;
				let oldFilePath = line[1].replace(/\\/g, '/'), newFilePath = line[line.length-1].replace(/\\/g, '/');
				fileLookup[newFilePath] = details.fileChanges.length;
				details.fileChanges.push({ oldFilePath: oldFilePath, newFilePath: newFilePath, type: <GitFileChangeType>line[0][0], additions: null, deletions: null });
			}
			lines = cp.execSync('git diff-tree --numstat -r -m --root --find-renames --diff-filter=AMDR ' + commitHash, { cwd: this.workspaceDir }).toString().split(eolRegex);
			for (let i = 1; i < lines.length - 1; i++) {
				let line = lines[i].split('\t');
				if (line.length !== 3) break;
				let fileName = line[2].replace(/(.*){.* => (.*)}/, '$1$2').replace(/.* => (.*)/, '$1');
				if (typeof fileLookup[fileName] === 'number') {
					details.fileChanges[fileLookup[fileName]].additions = parseInt(line[0]);
					details.fileChanges[fileLookup[fileName]].deletions = parseInt(line[1]);
				}
			}
			return details;
		} catch (e) {
			return null;
		}
	}

	public getFile(commitHash: string, filePath: string) {
		try {
			return cp.execSync('git show "' + commitHash + '":"' + filePath + '"', { cwd: this.workspaceDir }).toString();
		} catch (e) {
			return '';
		}
	}

	public addTag(tagName: string, commitHash: string): GitCommandStatus {
		return this.runGitCommand('git tag -a ' + escapeRefName(tagName) + ' -m "" ' + commitHash);
	}

	public deleteTag(tagName: string): GitCommandStatus {
		return this.runGitCommand('git tag -d ' + escapeRefName(tagName));
	}

	public createBranch(branchName: string, commitHash: string): GitCommandStatus {
		return this.runGitCommand('git branch ' + escapeRefName(branchName) + ' ' + commitHash);
	}

	public checkoutBranch(branchName: string, remoteBranch: string | null): GitCommandStatus {
		return this.runGitCommand('git checkout ' + (remoteBranch === null ? escapeRefName(branchName) : ' -b ' + escapeRefName(branchName) + ' ' + escapeRefName(remoteBranch)));
	}

	public deleteBranch(branchName: string, forceDelete: boolean): GitCommandStatus {
		return this.runGitCommand('git branch --delete' + (forceDelete ? ' --force' : '') + ' ' + escapeRefName(branchName));
	}

	public renameBranch(oldName: string, newName: string): GitCommandStatus {
		return this.runGitCommand('git branch -m ' + escapeRefName(oldName) + ' ' + escapeRefName(newName));
	}

	public resetToCommit(commitHash: string, resetMode: GitResetMode): GitCommandStatus {
		return this.runGitCommand('git reset --' + resetMode + ' ' + commitHash);
	}

	private runGitCommand(command: string): GitCommandStatus {
		try {
			cp.execSync(command, { cwd: this.workspaceDir });
			return null;
		} catch (e) {
			let lines = e.message.split(eolRegex);
			return lines.slice(1, lines.length - 1).join('\n');
		}
	}

	private getRefs(showRemoteBranches: boolean): GitRef[] {
		try {
			let lines = cp.execSync('git show-ref ' + (showRemoteBranches ? '' : '--heads --tags') + ' -d', { cwd: this.workspaceDir }).toString().split(eolRegex);
			let refs: GitRef[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				let line = lines[i].split(' ');
				if (line.length < 2) continue;

				let hash = line.shift()!;
				let ref = line.join(' ');

				if (ref.startsWith('refs/heads/')) {
					refs.push({ hash: hash, name: ref.substring(11), type: 'head' });
				} else if (ref.startsWith('refs/tags/')) {
					refs.push({ hash: hash, name: (ref.endsWith('^{}') ? ref.substring(10, ref.length - 3) : ref.substring(10)), type: 'tag' });
				} else if (ref.startsWith('refs/remotes/')) {
					refs.push({ hash: hash, name: ref.substring(13), type: 'remote' });
				}
			}
			return refs;
		} catch (e) {
			return [];
		}
	}

	private getGitLog(branch: string, num: number, showRemoteBranches: boolean): GitCommit[] {
		try {
			let lines = cp.execSync('git log ' + (branch !== '' ? escapeRefName(branch) : '--branches' + (showRemoteBranches ? ' --remotes' : '')) + ' --max-count=' + num + ' --format="' + gitLogFormat + '"', { cwd: this.workspaceDir }).toString().split(eolRegex);
			let gitCommits: GitCommit[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				let line = lines[i].split(gitLogSeparator);
				if (line.length !== 6) break;
				gitCommits.push({ hash: line[0], parentHashes: line[1].split(' '), author: line[2], email: line[3], date: parseInt(line[4]), message: line[5] });
			}
			return gitCommits;
		} catch (e) {
			return [];
		}
	}

	private getGitUnsavedChanges(): GitUnsavedChanges | null {
		try {
			let lines = cp.execSync('git status -s --branch --untracked-files --porcelain', { cwd: this.workspaceDir }).toString().split(eolRegex);
			return lines.length > 2 ? { branch: lines[0].substring(3).split('...')[0], changes: lines.length - 2 } : null;
		} catch (e) {
			return null;
		}
	}
}

function escapeRefName(str: string) {
	return str.replace(/'/g, '\'');
}