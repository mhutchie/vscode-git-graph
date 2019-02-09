import * as cp from 'child_process';
import { Config } from './config';
import { GitCommit, GitCommitNode, GitRef, GitUnsavedChanges } from './types';

export class DataSource {
	private workspaceDir: string | null;
	private readonly gitLogFormat: string;
	private readonly gitLogSeparator: string;

	constructor(workspaceDir: string | null) {
		this.workspaceDir = workspaceDir;
		this.gitLogSeparator = '4Rvn5rwg14BTwO3msm0ftBCk';
		this.gitLogFormat = ['%H', '%P', '%an', '%ae', '%at', '%s'].join(this.gitLogSeparator);
	}

	public isGitRepository(): boolean {
		if (this.workspaceDir === null) return false;

		try {
			cp.execSync('git rev-parse --git-dir', { cwd: this.workspaceDir });
			return true;
		} catch (e) {
			return false;
		}
	}

	public getBranches(showRemoteBranches: boolean): string[] {
		if (this.workspaceDir === null) return [];

		try {
			let lines = cp.execSync('git branch' + (showRemoteBranches ? ' -a' : ''), { cwd: this.workspaceDir }).toString().split(/\r\n|\r|\n/g);
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

	public getCommits(branch: string, maxCommits: number, showRemoteBranches: boolean) {
		let i, j;
		let commits = this.getGitLog(branch, maxCommits + 1, showRemoteBranches);
		let refs = this.getRefs(showRemoteBranches);
		let unsavedChanges = (new Config()).showUncommittedChanges() ? this.getGitUnsavedChanges() : null;

		let moreCommitsAvailable = commits.length === maxCommits + 1;
		if (moreCommitsAvailable) commits.pop();

		if (unsavedChanges !== null) {
			let unsavedChangesBranchHash = null;
			for (i = 0; i < refs.length; i++) {
				if (refs[i].name === unsavedChanges.branch && refs[i].type === 'head') {
					unsavedChangesBranchHash = refs[i].hash;
					break;
				}
			}
			if (unsavedChangesBranchHash !== null) {
				for (j = 0; j < commits.length; j++) {
					if (unsavedChangesBranchHash === commits[j].hash) {
						commits.unshift({ hash: '*', parentHashes: [unsavedChangesBranchHash], author: '*', email: '', date: Math.round((new Date()).getTime() / 1000), message: 'Uncommitted Changes (' + unsavedChanges.changes + ')' });
						break;
					}
				}
			}
		}

		let commitNodes: GitCommitNode[] = [];
		let commitLookup: { [hash: string]: number } = {};

		for (i = 0; i < commits.length; i++) {
			commitLookup[commits[i].hash] = i;
			commitNodes.push({ hash: commits[i].hash, parents: [], author: commits[i].author, email: commits[i].email, date: commits[i].date, message: commits[i].message, refs: [] });
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

		return { commits: commitNodes, moreCommitsAvailable: moreCommitsAvailable };
	}

	private getRefs(showRemoteBranches: boolean): GitRef[] {
		if (this.workspaceDir === null) return [];
		try {
			let lines = cp.execSync('git show-ref ' + (showRemoteBranches ? '' : '--heads --tags') + ' -d', { cwd: this.workspaceDir }).toString().split(/\r\n|\r|\n/g);
			let refs: GitRef[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				let line = lines[i].split(' ');
				if (line.length < 2) continue;

				let hash = line.shift()!;
				let ref = line.join(' ');

				if (ref.startsWith('refs/heads/')) {
					refs.push({ hash: hash, name: ref.substring(11), type: 'head' });
				} else if (ref.startsWith('refs/tags/') && ref.endsWith('^{}')) {
					refs.push({ hash: hash, name: ref.substring(10, ref.length - 3), type: 'tag' });
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
		if (this.workspaceDir === null) return [];

		try {
			let lines = cp.execSync('git log ' + (branch !== '' ? branch : '--branches' + (showRemoteBranches ? ' --remotes' : '')) + ' --max-count=' + num + ' --format="' + this.gitLogFormat + '"', { cwd: this.workspaceDir }).toString().split(/\r\n|\r|\n/g);
			let gitCommits: GitCommit[] = [];
			for (let i = 0; i < lines.length - 1; i++) {
				let line = lines[i].split(this.gitLogSeparator);
				if (line.length !== 6) break;
				gitCommits.push({ hash: line[0], parentHashes: line[1].split(' '), author: line[2], email: line[3], date: parseInt(line[4]), message: line[5] });
			}
			return gitCommits;
		} catch (e) {
			return [];
		}
	}

	private getGitUnsavedChanges(): GitUnsavedChanges | null {
		if (this.workspaceDir === null) return null;

		try {
			let lines = cp.execSync('git status -s --branch --untracked-files --porcelain', { cwd: this.workspaceDir }).toString().split(/\r\n|\r|\n/g);
			return lines.length > 2 ? { branch: lines[0].substring(3).split('...')[0], changes: lines.length - 2 } : null;
		} catch (e) {
			return null;
		}
	}
}