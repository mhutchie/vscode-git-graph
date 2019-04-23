import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { GitGraphView } from './gitGraphView';
import { AvatarCache } from './types';

export class AvatarManager {
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly avatarStorageFolder: string;
	private view: GitGraphView | null = null;
	private avatars: AvatarCache;
	private queue: AvatarRequestQueue;
	private remoteSourceCache: { [repo: string]: RemoteSource } = {};
	private interval: NodeJS.Timer | null = null;

	private githubTimeout: number = 0;
	private gitLabTimeout: number = 0;

	constructor(dataSource: DataSource, extensionState: ExtensionState) {
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.avatarStorageFolder = this.extensionState.getAvatarStoragePath();
		this.avatars = this.extensionState.getAvatarCache();
		this.queue = new AvatarRequestQueue(() => {
			if (this.interval !== null) return;
			this.interval = setInterval(() => {
				// Fetch avatars every 10 seconds
				this.fetchAvatarsInterval();
			}, 10000);
			this.fetchAvatarsInterval();
		});
	}

	public fetchAvatarImage(email: string, repo: string, commits: string[]) {
		if (typeof this.avatars[email] !== 'undefined') {
			// Avatar exists in the cache
			let t = (new Date()).getTime();
			if (this.avatars[email].timestamp < t - 1209600000 || (this.avatars[email].identicon && this.avatars[email].timestamp < t - 345600000)) {
				// Refresh avatar after 14 days, or if an avatar couldn't previously be found after 4 days
				this.queue.add(email, repo, commits, false);
			}
			if (this.avatars[email].image !== null) {
				// Avatar image is available
				this.sendAvatarToWebView(email, () => {
					// Avatar couldn't be found, request it again
					this.removeAvatarFromCache(email);
					this.queue.add(email, repo, commits, true);
				});
			}
		} else {
			// Avatar not in the cache, request it
			this.queue.add(email, repo, commits, true);
		}
	}

	public registerView(view: GitGraphView) {
		this.view = view;
	}

	public deregisterView() {
		this.view = null;
	}

	public removeAvatarFromCache(email: string) {
		delete this.avatars[email];
		this.extensionState.removeAvatarFromCache(email);
	}

	public clearCache() {
		this.avatars = {};
		this.extensionState.clearAvatarCache();
	}

	private async fetchAvatarsInterval() {
		if (this.queue.hasItems()) {
			let avatarRequest = this.queue.takeItem();
			if (avatarRequest === null) return; // No avatar can be checked at the current time

			let remoteSource = await this.getRemoteSource(avatarRequest); // Fetch the remote source of the avatar
			switch (remoteSource.type) {
				case 'github':
					this.fetchFromGithub(avatarRequest, remoteSource.owner, remoteSource.repo);
					break;
				case 'gitlab':
					this.fetchFromGitLab(avatarRequest);
					break;
				default:
					this.fetchFromGravatar(avatarRequest);
			}
		} else if (this.interval !== null) {
			// Stop the interval if there are no items remaining in the queue
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	private async getRemoteSource(avatarRequest: AvatarRequestItem) {
		if (typeof this.remoteSourceCache[avatarRequest.repo] === 'string') {
			// If the repo exists in the cache of remote sources
			return this.remoteSourceCache[avatarRequest.repo];
		} else {
			// Fetch the remote repo source
			let remoteUrl = await this.dataSource.getRemoteUrl(avatarRequest.repo), remoteSource: RemoteSource;
			if (remoteUrl !== null) {
				// Depending on the domain of the remote repo source, determine the type of source it is
				if (remoteUrl.startsWith('https://github.com/')) {
					let remoteUrlComps = remoteUrl.split('/');
					remoteSource = { type: 'github', owner: remoteUrlComps[3], repo: remoteUrlComps[4].replace(/\.git$/, '') };
				} else if (remoteUrl.startsWith('https://gitlab.com/')) {
					remoteSource = { type: 'gitlab' };
				} else {
					remoteSource = { type: 'gravatar' };
				}
			} else {
				remoteSource = { type: 'gravatar' };
			}
			this.remoteSourceCache[avatarRequest.repo] = remoteSource; // Add the remote source to the cache for future use
			return remoteSource;
		}
	}

	private fetchFromGithub(avatarRequest: AvatarRequestItem, owner: string, repo: string) {
		let t = (new Date()).getTime();
		if (t < this.githubTimeout) {
			// Defer request until after timeout
			this.queue.addItem(avatarRequest, this.githubTimeout, false);
			this.fetchAvatarsInterval();
			return;
		}
		let commitIndex = avatarRequest.commits.length < 5 ? avatarRequest.commits.length - 1 - avatarRequest.attempts : Math.round((4 - avatarRequest.attempts) * 0.25 * (avatarRequest.commits.length - 1));
		https.get({
			hostname: 'api.github.com', path: '/repos/' + owner + '/' + repo + '/commits/' + avatarRequest.commits[commitIndex],
			headers: { 'User-Agent': 'vscode-git-graph' },
			agent: false, timeout: 15000
		}, (res: http.IncomingMessage) => {
			let respBody = '';
			res.on('data', (chunk: Buffer) => { respBody += chunk; });
			res.on('end', async () => {
				if (res.headers['x-ratelimit-remaining'] === '0') {
					// If the GitHub Api rate limit was reached, store the github timeout to prevent subsequent requests
					this.githubTimeout = parseInt(<string>res.headers['x-ratelimit-reset']) * 1000;
				}

				if (res.statusCode === 200) { // Sucess
					let commit: any = JSON.parse(respBody);
					if (commit.author && commit.author.avatar_url) { // Avatar url found
						let img = await this.downloadAvatarImage(avatarRequest.email, commit.author.avatar_url + '&size=54');
						if (img !== null) this.saveAvatar(avatarRequest.email, img, false);
						return;
					}
				} else if (res.statusCode === 403) {
					// Rate limit reached, try again after timeout
					this.queue.addItem(avatarRequest, this.githubTimeout, false);
					return;
				} else if (res.statusCode === 422 && avatarRequest.commits.length > avatarRequest.attempts + 1 && avatarRequest.attempts < 4) {
					// Commit not found on remote, try again with the next commit if less than 5 attempts have been made
					this.queue.addItem(avatarRequest, 0, true);
					return;
				} else if (res.statusCode! >= 500) {
					// If server error, try again after 10 minutes
					this.githubTimeout = t + 600000;
					this.queue.addItem(avatarRequest, this.githubTimeout, false);
					return;
				}
				this.fetchFromGravatar(avatarRequest); // Fallback to Gravatar
			});
		}).on('error', () => {
			// If connection error, try again after 5 minutes
			this.githubTimeout = t + 300000;
			this.queue.addItem(avatarRequest, this.githubTimeout, false);
		});
	}

	private fetchFromGitLab(avatarRequest: AvatarRequestItem) {
		let t = (new Date()).getTime();
		if (t < this.gitLabTimeout) {
			// Defer request until after timeout
			this.queue.addItem(avatarRequest, this.gitLabTimeout, false);
			this.fetchAvatarsInterval();
			return;
		}
		https.get({
			hostname: 'gitlab.com', path: '/api/v4/users?search=' + avatarRequest.email,
			headers: { 'User-Agent': 'vscode-git-graph', 'Private-Token': 'w87U_3gAxWWaPtFgCcus' }, // Token only has read access
			agent: false, timeout: 15000,
		}, (res: http.IncomingMessage) => {
			let respBody = '';
			res.on('data', (chunk: Buffer) => { respBody += chunk; });
			res.on('end', async () => {
				if (res.headers['ratelimit-remaining'] === '0') {
					// If the GitLab Api rate limit was reached, store the github timeout to prevent subsequent requests
					this.gitLabTimeout = parseInt(<string>res.headers['ratelimit-reset']) * 1000;
				}

				if (res.statusCode === 200) { // Sucess
					let users: any = JSON.parse(respBody);
					if (users.length > 0 && users[0].avatar_url) { // Avatar url found
						let img = await this.downloadAvatarImage(avatarRequest.email, users[0].avatar_url);
						if (img !== null) this.saveAvatar(avatarRequest.email, img, false);
						return;
					}
				} else if (res.statusCode === 429) {
					// Rate limit reached, try again after timeout
					this.queue.addItem(avatarRequest, this.gitLabTimeout, false);
					return;
				} else if (res.statusCode! >= 500) {
					// If server error, try again after 10 minutes
					this.gitLabTimeout = t + 600000;
					this.queue.addItem(avatarRequest, this.gitLabTimeout, false);
					return;
				}
				this.fetchFromGravatar(avatarRequest); // Fallback to Gravatar
			});
		}).on('error', () => {
			// If connection error, try again after 5 minutes
			this.gitLabTimeout = t + 300000;
			this.queue.addItem(avatarRequest, this.gitLabTimeout, false);
		});
	}

	private async fetchFromGravatar(avatarRequest: AvatarRequestItem) {
		let hash: string = crypto.createHash('md5').update(avatarRequest.email).digest('hex');
		let img = await this.downloadAvatarImage(avatarRequest.email, 'https://secure.gravatar.com/avatar/' + hash + '?s=54&d=404'), identicon = false;
		if (img === null) {
			img = await this.downloadAvatarImage(avatarRequest.email, 'https://secure.gravatar.com/avatar/' + hash + '?s=54&d=identicon');
			identicon = true;
		}
		if (img !== null) this.saveAvatar(avatarRequest.email, img, identicon);
	}

	private async downloadAvatarImage(email: string, imageUrl: string): Promise<string | null> {
		let hash: string = crypto.createHash('md5').update(email).digest('hex'), imgUrl = url.parse(imageUrl);
		return new Promise((resolve) => {
			https.get({
				hostname: imgUrl.hostname, path: imgUrl.path,
				headers: { 'User-Agent': 'vscode-git-graph' },
				agent: false, timeout: 15000
			}, (res: http.IncomingMessage) => {
				let imageBufferArray: Buffer[] = [];
				res.on('data', (chunk: Buffer) => { imageBufferArray.push(chunk); });
				res.on('end', () => {
					if (res.statusCode === 200) { // If success response, save the image to the avatar folder
						let format = res.headers['content-type']!.split('/')[1];
						fs.writeFile(this.avatarStorageFolder + '/' + hash + '.' + format, Buffer.concat(imageBufferArray), err => {
							resolve(err ? null : hash + '.' + format);
						});
					} else {
						resolve(null);
					}
				});
			}).on('error', () => {
				resolve(null);
			});
		});
	}

	private saveAvatar(email: string, image: string, identicon: boolean) {
		if (typeof this.avatars[email] === 'string') {
			if (!identicon || this.avatars[email].identicon) {
				this.avatars[email].image = image;
				this.avatars[email].identicon = identicon;
			}
			this.avatars[email].timestamp = (new Date()).getTime();
		} else {
			this.avatars[email] = { image: image, timestamp: (new Date()).getTime(), identicon: identicon };
		}
		this.extensionState.saveAvatar(email, this.avatars[email]);
		this.sendAvatarToWebView(email, () => { });
	}

	private sendAvatarToWebView(email: string, onError: () => void) {
		if (this.view !== null) {
			fs.readFile(this.avatarStorageFolder + '/' + this.avatars[email].image, (err, data) => {
				if (err) {
					onError();
				} else if (this.view !== null) {
					// Send avatar to the webview as a base64 encoded data uri
					this.view.sendMessage({
						command: 'fetchAvatar',
						email: email,
						image: 'data:image/' + this.avatars[email].image!.split('.')[1] + ';base64,' + data.toString('base64')
					});
				}
			});
		}
	}
}

// Queue implementation, ordering avatar requests by their checkAfter value
class AvatarRequestQueue {
	private queue: AvatarRequestItem[] = [];
	private itemsAvailableCallback: () => void;

	constructor(itemsAvailableCallback: () => void) {
		this.itemsAvailableCallback = itemsAvailableCallback;
	}

	// Add a new avatar request to queue
	public add(email: string, repo: string, commits: string[], immediate: boolean) {
		let emailIndex = this.queue.findIndex(v => v.email === email && v.repo === repo);
		if (emailIndex > -1) {
			let l = commits.indexOf(this.queue[emailIndex].commits[this.queue[emailIndex].commits.length - 1]);
			// Index of the last commit of the existing request, in the new request commits
			if (l > -1 && l < commits.length - 1) {
				this.queue[emailIndex].commits.push(...commits.slice(l + 1)); // Append all new commits
			}
		} else {
			this.insertItem({
				email: email,
				repo: repo,
				commits: commits,
				checkAfter: immediate || this.queue.length === 0 ? 0 : this.queue[this.queue.length - 1].checkAfter + 1,
				attempts: 0
			});
		}
	}

	// Add an existing avatar request item, setting the next time the request should be checked and registering if the current attempt failed
	public addItem(item: AvatarRequestItem, checkAfter: number, failedAttempt: boolean) {
		item.checkAfter = checkAfter;
		if (failedAttempt) item.attempts++;
		this.insertItem(item);
	}

	// Returns a boolean indicating if there are items in the queue
	public hasItems() {
		return this.queue.length > 0;
	}

	// Takes an item from the queue if possible, respecting the value set for checkAfter
	public takeItem() {
		if (this.queue.length > 0 && this.queue[0].checkAfter < (new Date()).getTime()) return this.queue.shift()!;
		return null;
	}

	// Binary insertion of avatar request item, ordered by checkAfter
	private insertItem(item: AvatarRequestItem) {
		var l = 0, r = this.queue.length - 1, c, prevLength = this.queue.length;
		while (l <= r) {
			c = l + r >> 1;
			if (this.queue[c].checkAfter <= item.checkAfter) l = c + 1; else r = c - 1;
		}
		this.queue.splice(l, 0, item);
		if (prevLength === 0) this.itemsAvailableCallback();
	}
}

interface AvatarRequestItem {
	email: string;
	repo: string;
	commits: string[];
	checkAfter: number;
	attempts: number;
}
interface GitHubRemoteSource {
	type: 'github';
	owner: string;
	repo: string;
}
interface GitLabRemoteSource {
	type: 'gitlab';
}
interface GravatarRemoteSource {
	type: 'gravatar';
}
type RemoteSource = GitHubRemoteSource | GitLabRemoteSource | GravatarRemoteSource;