import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as url from 'url';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { Logger } from './logger';
import { Disposable, toDisposable } from './utils/disposable';
import { EventEmitter } from './utils/event';

/**
 * Manages fetching and caching Avatars.
 */
export class AvatarManager extends Disposable {
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly logger: Logger;
	private readonly avatarStorageFolder: string;
	private readonly avatarEventEmitter: EventEmitter<AvatarEvent>;

	private avatars: AvatarCache;
	private queue: AvatarRequestQueue;
	private remoteSourceCache: { [repo: string]: RemoteSource } = {};
	private interval: NodeJS.Timer | null = null;

	private githubTimeout: number = 0;
	private gitLabTimeout: number = 0;

	/**
	 * Creates the Git Graph Avatar Manager.
	 * @param dataSource The Git Graph DataSource instance.
	 * @param extensionState The Git Graph ExtensionState instance.
	 * @param logger The Git Graph Logger instance.
	 */
	constructor(dataSource: DataSource, extensionState: ExtensionState, logger: Logger) {
		super();
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.logger = logger;
		this.avatarStorageFolder = this.extensionState.getAvatarStoragePath();
		this.avatarEventEmitter = new EventEmitter<AvatarEvent>();
		this.avatars = this.extensionState.getAvatarCache();
		this.queue = new AvatarRequestQueue(() => {
			if (this.interval !== null) return;
			this.interval = setInterval(() => {
				// Fetch avatars every 10 seconds
				this.fetchAvatarsInterval();
			}, 10000);
			this.fetchAvatarsInterval();
		});

		this.registerDisposables(
			// Stop fetching avatars when disposed
			toDisposable(() => {
				this.stopInterval();
			}),

			// Dispose the avatar event emitter
			this.avatarEventEmitter
		);
	}

	/**
	 * Stops the interval used to fetch avatars.
	 */
	private stopInterval() {
		if (this.interval !== null) {
			clearInterval(this.interval);
			this.interval = null;
			this.remoteSourceCache = {};
		}
	}

	/**
	 * Fetch an avatar, either from the cache if it already exists, or queue it to be fetched.
	 * @param email The email address identifying the avatar.
	 * @param repo The repository that the avatar is used in.
	 * @param remote The remote that the avatar can be fetched from.
	 * @param commits The commits that reference the avatar.
	 */
	public fetchAvatarImage(email: string, repo: string, remote: string | null, commits: string[]) {
		if (typeof this.avatars[email] !== 'undefined') {
			// Avatar exists in the cache
			let t = (new Date()).getTime();
			if (this.avatars[email].timestamp < t - 1209600000 || (this.avatars[email].identicon && this.avatars[email].timestamp < t - 345600000)) {
				// Refresh avatar after 14 days, or if an avatar couldn't previously be found after 4 days
				this.queue.add(email, repo, remote, commits, false);
			}

			this.emitAvatar(email).catch(() => {
				// Avatar couldn't be found, request it again
				this.removeAvatarFromCache(email);
				this.queue.add(email, repo, remote, commits, true);
			});
		} else {
			// Avatar not in the cache, request it
			this.queue.add(email, repo, remote, commits, true);
		}
	}

	/**
	 * Get the image data of an avatar.
	 * @param email The email address identifying the avatar.
	 * @returns A base64 encoded data URI if the avatar exists, otherwise NULL.
	 */
	public getAvatarImage(email: string) {
		return new Promise<string | null>((resolve) => {
			if (typeof this.avatars[email] !== 'undefined' && this.avatars[email].image !== null) {
				fs.readFile(this.avatarStorageFolder + '/' + this.avatars[email].image, (err, data) => {
					resolve(err ? null : 'data:image/' + this.avatars[email].image.split('.')[1] + ';base64,' + data.toString('base64'));
				});
			} else {
				resolve(null);
			}
		});
	}

	/**
	 * Get the Event that can be used to subscribe to receive requested avatars.
	 * @returns The Event.
	 */
	get onAvatar() {
		return this.avatarEventEmitter.subscribe;
	}

	/**
	 * Remove an avatar from the cache.
	 * @param email The email address identifying the avatar.
	 */
	private removeAvatarFromCache(email: string) {
		delete this.avatars[email];
		this.extensionState.removeAvatarFromCache(email);
	}

	/**
	 * Remove all avatars from the cache.
	 * @returns A Thenable resolving to the ErrorInfo that resulted from executing this method.
	 */
	public clearCache() {
		this.avatars = {};
		return this.extensionState.clearAvatarCache();
	}

	/**
	 * Triggered by an interval to fetch avatars from Github, GitLab and Gravatar.
	 */
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
		} else {
			// Stop the interval if there are no items remaining in the queue
			this.stopInterval();
		}
	}

	/**
	 * Get the remote source of an avatar request.
	 * @param avatarRequest The avatar request.
	 * @returns The remote source.
	 */
	private async getRemoteSource(avatarRequest: AvatarRequestItem) {
		if (typeof this.remoteSourceCache[avatarRequest.repo] === 'object') {
			// If the repo exists in the cache of remote sources
			return this.remoteSourceCache[avatarRequest.repo];
		} else {
			// Fetch the remote repo source
			let remoteSource: RemoteSource = { type: 'gravatar' };
			if (avatarRequest.remote !== null) {
				let remoteUrl = await this.dataSource.getRemoteUrl(avatarRequest.repo, avatarRequest.remote);
				if (remoteUrl !== null) {
					// Depending on the domain of the remote repo source, determine the type of source it is
					let match;
					if ((match = remoteUrl.match(/^(https:\/\/github\.com\/|git@github\.com:)([^\/]+)\/(.*)\.git$/)) !== null) {
						remoteSource = { type: 'github', owner: match[2], repo: match[3] };
					} else if (remoteUrl.startsWith('https://gitlab.com/') || remoteUrl.startsWith('git@gitlab.com:')) {
						remoteSource = { type: 'gitlab' };
					}
				}
			}
			this.remoteSourceCache[avatarRequest.repo] = remoteSource; // Add the remote source to the cache for future use
			return remoteSource;
		}
	}

	/**
	 * Fetch an avatar from Github.
	 * @param avatarRequest The avatar request to fetch.
	 * @param owner The owner of the repository.
	 * @param repo The repository that the avatar is used in.
	 */
	private fetchFromGithub(avatarRequest: AvatarRequestItem, owner: string, repo: string) {
		let t = (new Date()).getTime();
		if (t < this.githubTimeout) {
			// Defer request until after timeout
			this.queue.addItem(avatarRequest, this.githubTimeout, false);
			this.fetchAvatarsInterval();
			return;
		}

		this.logger.log('Requesting Avatar for ' + maskEmail(avatarRequest.email) + ' from GitHub');

		const commitIndex = avatarRequest.commits.length < 5
			? avatarRequest.commits.length - 1 - avatarRequest.attempts
			: Math.round((4 - avatarRequest.attempts) * 0.25 * (avatarRequest.commits.length - 1));

		let triggeredOnError = false;
		const onError = () => {
			if (!triggeredOnError) {
				// If an error occurs, try again after 5 minutes
				triggeredOnError = true;
				this.githubTimeout = t + 300000;
				this.queue.addItem(avatarRequest, this.githubTimeout, false);
			}
		};

		https.get({
			hostname: 'api.github.com', path: '/repos/' + owner + '/' + repo + '/commits/' + avatarRequest.commits[commitIndex],
			headers: { 'User-Agent': 'vscode-git-graph' },
			agent: false, timeout: 15000
		}, (res) => {
			let respBody = '';
			res.on('data', (chunk: Buffer) => { respBody += chunk; });
			res.on('end', async () => {
				if (res.headers['x-ratelimit-remaining'] === '0') {
					// If the GitHub Api rate limit was reached, store the github timeout to prevent subsequent requests
					this.githubTimeout = parseInt(<string>res.headers['x-ratelimit-reset']) * 1000;
					this.logger.log('GitHub API Rate Limit Reached - Paused fetching from GitHub until the Rate Limit is reset');
				}

				if (res.statusCode === 200) { // Success
					let commit: any = JSON.parse(respBody);
					if (commit.author && commit.author.avatar_url) { // Avatar url found
						let img = await this.downloadAvatarImage(avatarRequest.email, commit.author.avatar_url + '&size=162');
						if (img !== null) {
							this.saveAvatar(avatarRequest.email, img, false);
						} else {
							this.logger.log('Failed to download avatar from GitHub for ' + maskEmail(avatarRequest.email));
						}
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
			res.on('error', onError);
		}).on('error', onError);
	}

	/**
	 * Fetch an avatar from GitLab.
	 * @param avatarRequest The avatar request to fetch.
	 */
	private fetchFromGitLab(avatarRequest: AvatarRequestItem) {
		let t = (new Date()).getTime();
		if (t < this.gitLabTimeout) {
			// Defer request until after timeout
			this.queue.addItem(avatarRequest, this.gitLabTimeout, false);
			this.fetchAvatarsInterval();
			return;
		}

		this.logger.log('Requesting Avatar for ' + maskEmail(avatarRequest.email) + ' from GitLab');

		let triggeredOnError = false;
		const onError = () => {
			if (!triggeredOnError) {
				// If an error occurs, try again after 5 minutes
				triggeredOnError = true;
				this.gitLabTimeout = t + 300000;
				this.queue.addItem(avatarRequest, this.gitLabTimeout, false);
			}
		};

		https.get({
			hostname: 'gitlab.com', path: '/api/v4/users?search=' + avatarRequest.email,
			headers: { 'User-Agent': 'vscode-git-graph', 'Private-Token': 'w87U_3gAxWWaPtFgCcus' }, // Token only has read access
			agent: false, timeout: 15000
		}, (res) => {
			let respBody = '';
			res.on('data', (chunk: Buffer) => { respBody += chunk; });
			res.on('end', async () => {
				if (res.headers['ratelimit-remaining'] === '0') {
					// If the GitLab Api rate limit was reached, store the gitlab timeout to prevent subsequent requests
					this.gitLabTimeout = parseInt(<string>res.headers['ratelimit-reset']) * 1000;
					this.logger.log('GitLab API Rate Limit Reached - Paused fetching from GitLab until the Rate Limit is reset');
				}

				if (res.statusCode === 200) { // Success
					let users: any = JSON.parse(respBody);
					if (users.length > 0 && users[0].avatar_url) { // Avatar url found
						let img = await this.downloadAvatarImage(avatarRequest.email, users[0].avatar_url);
						if (img !== null) {
							this.saveAvatar(avatarRequest.email, img, false);
						} else {
							this.logger.log('Failed to download avatar from GitLab for ' + maskEmail(avatarRequest.email));
						}
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
			res.on('error', onError);
		}).on('error', onError);
	}

	/**
	 * Fetch an avatar from Gravatar.
	 * @param avatarRequest The avatar request to fetch.
	 */
	private async fetchFromGravatar(avatarRequest: AvatarRequestItem) {
		this.logger.log('Requesting Avatar for ' + maskEmail(avatarRequest.email) + ' from Gravatar');
		const hash: string = crypto.createHash('md5').update(avatarRequest.email.trim().toLowerCase()).digest('hex');

		let img = await this.downloadAvatarImage(avatarRequest.email, 'https://secure.gravatar.com/avatar/' + hash + '?s=162&d=404'), identicon = false;
		if (img === null) {
			img = await this.downloadAvatarImage(avatarRequest.email, 'https://secure.gravatar.com/avatar/' + hash + '?s=162&d=identicon');
			identicon = true;
		}

		if (img !== null) {
			this.saveAvatar(avatarRequest.email, img, identicon);
		} else {
			this.logger.log('No Avatar could be found for ' + maskEmail(avatarRequest.email));
		}
	}

	/**
	 * Download and save an avatar image.
	 * @param email The email address identifying the avatar.
	 * @param imageUrl The URL the avatar can be downloaded from.
	 * @returns A promise that resolves to the image name of the avatar on disk, or NULL if downloading failed.
	 */
	private downloadAvatarImage(email: string, imageUrl: string) {
		return (new Promise<string | null>((resolve) => {
			const hash = crypto.createHash('md5').update(email).digest('hex');
			const imgUrl = url.parse(imageUrl);

			let completed = false;
			const complete = (fileName: string | null = null) => {
				if (!completed) {
					completed = true;
					resolve(fileName);
				}
			};

			https.get({
				hostname: imgUrl.hostname, path: imgUrl.path,
				headers: { 'User-Agent': 'vscode-git-graph' },
				agent: false, timeout: 15000
			}, (res) => {
				let imageBufferArray: Buffer[] = [];
				res.on('data', (chunk: Buffer) => { imageBufferArray.push(chunk); });
				res.on('end', () => {
					if (res.statusCode === 200) { // If success response, save the image to the avatar folder
						let format = res.headers['content-type']!.split('/')[1];
						fs.writeFile(this.avatarStorageFolder + '/' + hash + '.' + format, Buffer.concat(imageBufferArray), err => {
							complete(err ? null : hash + '.' + format);
						});
					} else {
						complete();
					}
				});
				res.on('error', complete);
			}).on('error', complete);
		})).catch(() => null);
	}

	/**
	 * Emit an AvatarEvent to any listeners.
	 * @param email The email address identifying the avatar.
	 * @returns A promise indicating if the event was emitted successfully.
	 */
	private emitAvatar(email: string) {
		return new Promise<boolean>((resolve, reject) => {
			if (this.avatarEventEmitter.hasSubscribers()) {
				this.getAvatarImage(email).then((image) => {
					if (image === null) {
						reject();
					} else {
						this.avatarEventEmitter.emit({
							email: email,
							image: image
						});
						resolve(true);
					}
				});
			} else {
				resolve(false);
			}
		});
	}

	/**
	 * Save an avatar in the cache.
	 * @param email The email address identifying the avatar.
	 * @param image The image name of the avatar on disk.
	 * @param identicon Whether this avatar is an identicon.
	 */
	private saveAvatar(email: string, image: string, identicon: boolean) {
		if (typeof this.avatars[email] !== 'undefined') {
			if (!identicon || this.avatars[email].identicon) {
				this.avatars[email].image = image;
				this.avatars[email].identicon = identicon;
			}
			this.avatars[email].timestamp = (new Date()).getTime();
		} else {
			this.avatars[email] = { image: image, timestamp: (new Date()).getTime(), identicon: identicon };
		}
		this.extensionState.saveAvatar(email, this.avatars[email]);
		this.logger.log('Saved Avatar for ' + maskEmail(email));
		this.emitAvatar(email).then(
			(sent) => this.logger.log(sent
				? 'Sent Avatar for ' + maskEmail(email) + ' to the Git Graph View'
				: 'Avatar for ' + maskEmail(email) + ' is ready to be used the next time the Git Graph View is opened'
			),
			() => this.logger.log('Failed to Send Avatar for ' + maskEmail(email) + ' to the Git Graph View')
		);
	}
}

/**
 * Represents a queue of avatar requests, ordered by their `checkAfter` value.
 */
class AvatarRequestQueue {
	private queue: AvatarRequestItem[] = [];
	private itemsAvailableCallback: () => void;

	/**
	 * Create an Avatar Request Queue.
	 * @param itemsAvailableCallback A callback that is invoked when the queue transitions from having no items, to having at least one item.
	 */
	constructor(itemsAvailableCallback: () => void) {
		this.itemsAvailableCallback = itemsAvailableCallback;
	}

	/**
	 * Create and add a new avatar request to the queue.
	 * @param email The email address identifying the avatar.
	 * @param repo The repository that the avatar is used in.
	 * @param remote The remote that the avatar can be fetched from.
	 * @param commits The commits that reference the avatar.
	 * @param immediate Whether the avatar should be fetched immediately.
	 */
	public add(email: string, repo: string, remote: string | null, commits: string[], immediate: boolean) {
		const existingRequest = this.queue.find((request) => request.email === email && request.repo === repo);
		if (existingRequest) {
			commits.forEach((commit) => {
				if (!existingRequest.commits.includes(commit)) {
					existingRequest.commits.push(commit);
				}
			});
		} else {
			this.insertItem({
				email: email,
				repo: repo,
				remote: remote,
				commits: commits,
				checkAfter: immediate || this.queue.length === 0
					? 0
					: this.queue[this.queue.length - 1].checkAfter + 1,
				attempts: 0
			});
		}
	}

	/**
	 * Add an existing avatar request item back onto the queue.
	 * @param item The avatar request item.
	 * @param checkAfter The earliest time the avatar should be requested.
	 * @param failedAttempt Did the fetch attempt fail.
	 */
	public addItem(item: AvatarRequestItem, checkAfter: number, failedAttempt: boolean) {
		item.checkAfter = checkAfter;
		if (failedAttempt) item.attempts++;
		this.insertItem(item);
	}

	/**
	 * Check if there are items in the queue.
	 * @returns TRUE => Items in the queue, FALSE => Queue is empty.
	 */
	public hasItems() {
		return this.queue.length > 0;
	}

	/**
	 * Take the next item from the queue if an item is available.
	 * @returns An avatar request item, or NULL if no item is available.
	 */
	public takeItem() {
		if (this.queue.length > 0 && this.queue[0].checkAfter < (new Date()).getTime()) return this.queue.shift()!;
		return null;
	}

	/**
	 * Insert an avatar request item into the queue.
	 * @param item The avatar request item.
	 */
	private insertItem(item: AvatarRequestItem) {
		let l = 0, r = this.queue.length - 1, c, prevLength = this.queue.length;
		while (l <= r) {
			c = l + r >> 1;
			if (this.queue[c].checkAfter <= item.checkAfter) {
				l = c + 1;
			} else {
				r = c - 1;
			}
		}
		this.queue.splice(l, 0, item);
		if (prevLength === 0) this.itemsAvailableCallback();
	}
}

/**
 * Mask an email address for logging.
 * @param email The string containing the email address.
 * @returns The masked email address.
 */
function maskEmail(email: string) {
	return email.substring(0, email.indexOf('@')) + '@*****';
}

export interface Avatar {
	image: string;
	timestamp: number;
	identicon: boolean;
}

export type AvatarCache = { [email: string]: Avatar };

interface AvatarRequestItem {
	email: string;
	repo: string;
	remote: string | null;
	commits: string[];
	checkAfter: number;
	attempts: number;
}

interface GitHubRemoteSource {
	readonly type: 'github';
	readonly owner: string;
	readonly repo: string;
}

export interface AvatarEvent {
	email: string;
	image: string;
}

interface GitLabRemoteSource {
	readonly type: 'gitlab';
}

interface GravatarRemoteSource {
	readonly type: 'gravatar';
}

type RemoteSource = GitHubRemoteSource | GitLabRemoteSource | GravatarRemoteSource;
