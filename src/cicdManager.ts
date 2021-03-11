import * as crypto from 'crypto';
import * as https from 'https';
import * as url from 'url';
import { DataSource } from './dataSource';
import { ExtensionState } from './extensionState';
import { Logger } from './logger';
import { Disposable, toDisposable } from './utils/disposable';
import { EventEmitter } from './utils/event';

/**
 * Manages fetching and caching CICDs.
 */
export class CicdManager extends Disposable {
	private readonly dataSource: DataSource;
	private readonly extensionState: ExtensionState;
	private readonly logger: Logger;
	private readonly cicdEventEmitter: EventEmitter<CICDEvent>;

	private cicds: CICDCache;
	private queue: CicdRequestQueue;
	private remoteSourceCache: { [repo: string]: RemoteSource } = {};
	private interval: NodeJS.Timer | null = null;

	private githubTimeout: number = 0;
	private gitLabTimeout: number = 0;

	/**
	 * Creates the Git Graph CICD Manager.
	 * @param dataSource The Git Graph DataSource instance.
	 * @param extensionState The Git Graph ExtensionState instance.
	 * @param logger The Git Graph Logger instance.
	 */
	constructor(dataSource: DataSource, extensionState: ExtensionState, logger: Logger) {
		super();
		this.dataSource = dataSource;
		this.extensionState = extensionState;
		this.logger = logger;
		this.cicdEventEmitter = new EventEmitter<CICDEvent>();
		this.cicds = this.extensionState.getCICDCache();
		this.queue = new CicdRequestQueue(() => {
			if (this.interval !== null) return;
			this.interval = setInterval(() => {
				// Fetch cicds every 10 seconds
				this.fetchCICDsInterval();
			}, 10000);
			this.fetchCICDsInterval();
		});

		this.registerDisposables(
			// Stop fetching cicds when disposed
			toDisposable(() => {
				this.stopInterval();
			}),

			// Dispose the cicd event emitter
			this.cicdEventEmitter
		);
	}

	/**
	 * Stops the interval used to fetch cicds.
	 */
	private stopInterval() {
		if (this.interval !== null) {
			clearInterval(this.interval);
			this.interval = null;
			this.remoteSourceCache = {};
		}
	}

	/**
	 * Fetch an cicd, either from the cache if it already exists, or queue it to be fetched.
	 * @param email The email address identifying the cicd.
	 * @param repo The repository that the cicd is used in.
	 * @param remote The remote that the cicd can be fetched from.
	 * @param commits The commits that reference the cicd.
	 */
	public fetchCICDImage(email: string, repo: string, remote: string | null, commits: string[]) {
		if (typeof this.cicds[email] !== 'undefined') {
			// CICD exists in the cache
			let t = (new Date()).getTime();
			if (this.cicds[email].timestamp < t - 1209600000 || (this.cicds[email].identicon && this.cicds[email].timestamp < t - 345600000)) {
				// Refresh cicd after 14 days, or if an cicd couldn't previously be found after 4 days
				this.queue.add(email, repo, remote, commits, false);
			}

			this.emitCICD(email).catch(() => {
				// CICD couldn't be found, request it again
				this.removeCICDFromCache(email);
				this.queue.add(email, repo, remote, commits, true);
			});
		} else {
			// CICD not in the cache, request it
			this.queue.add(email, repo, remote, commits, true);
		}
	}

	/**
	 * Get the image data of an cicd.
	 * @param email The email address identifying the cicd.
	 * @returns A base64 encoded data URI if the cicd exists, otherwise NULL.
	 */
	public getCICDImage(email: string) {
		return new Promise<string | null>((resolve) => {
			if (typeof this.cicds[email] !== 'undefined' && this.cicds[email].image !== null) {
				// fs.readFile(this.cicdStorageFolder + '/' + this.cicds[email].image, (err, data) => {
				// 	resolve(err ? null : 'data:image/' + this.cicds[email].image.split('.')[1] + ';base64,' + data.toString('base64'));
				// });
			} else {
				resolve(null);
			}
		});
	}

	/**
	 * Get the Event that can be used to subscribe to receive requested cicds.
	 * @returns The Event.
	 */
	get onCICD() {
		return this.cicdEventEmitter.subscribe;
	}

	/**
	 * Remove an cicd from the cache.
	 * @param email The email address identifying the cicd.
	 */
	private removeCICDFromCache(email: string) {
		delete this.cicds[email];
		this.extensionState.removeCICDFromCache(email);
	}

	/**
	 * Remove all cicds from the cache.
	 */
	public clearCache() {
		this.cicds = {};
		this.extensionState.clearCICDCache();
	}

	/**
	 * Triggered by an interval to fetch cicds from Github, GitLab and Grcicd.
	 */
	private async fetchCICDsInterval() {
		if (this.queue.hasItems()) {
			let cicdRequest = this.queue.takeItem();
			if (cicdRequest === null) return; // No cicd can be checked at the current time

			let remoteSource = await this.getRemoteSource(cicdRequest); // Fetch the remote source of the cicd
			switch (remoteSource.type) {
				case 'github':
					this.fetchFromGithub(cicdRequest, remoteSource.owner, remoteSource.repo);
					break;
				case 'gitlab':
					this.fetchFromGitLab(cicdRequest);
					break;
				default:
					this.fetchFromGrcicd(cicdRequest);
			}
		} else {
			// Stop the interval if there are no items remaining in the queue
			this.stopInterval();
		}
	}

	/**
	 * Get the remote source of an cicd request.
	 * @param cicdRequest The cicd request.
	 * @returns The remote source.
	 */
	private async getRemoteSource(cicdRequest: CICDRequestItem) {
		if (typeof this.remoteSourceCache[cicdRequest.repo] === 'object') {
			// If the repo exists in the cache of remote sources
			return this.remoteSourceCache[cicdRequest.repo];
		} else {
			// Fetch the remote repo source
			let remoteSource: RemoteSource = { type: 'grcicd' };
			if (cicdRequest.remote !== null) {
				let remoteUrl = await this.dataSource.getRemoteUrl(cicdRequest.repo, cicdRequest.remote);
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
			this.remoteSourceCache[cicdRequest.repo] = remoteSource; // Add the remote source to the cache for future use
			return remoteSource;
		}
	}

	/**
	 * Fetch an cicd from Github.
	 * @param cicdRequest The cicd request to fetch.
	 * @param owner The owner of the repository.
	 * @param repo The repository that the cicd is used in.
	 */
	private fetchFromGithub(cicdRequest: CICDRequestItem, owner: string, repo: string) {
		let t = (new Date()).getTime();
		if (t < this.githubTimeout) {
			// Defer request until after timeout
			this.queue.addItem(cicdRequest, this.githubTimeout, false);
			this.fetchCICDsInterval();
			return;
		}

		this.logger.log('Requesting CICD for ' + maskEmail(cicdRequest.email) + ' from GitHub');

		const commitIndex = cicdRequest.commits.length < 5
			? cicdRequest.commits.length - 1 - cicdRequest.attempts
			: Math.round((4 - cicdRequest.attempts) * 0.25 * (cicdRequest.commits.length - 1));

		let triggeredOnError = false;
		const onError = () => {
			if (!triggeredOnError) {
				// If an error occurs, try again after 5 minutes
				triggeredOnError = true;
				this.githubTimeout = t + 300000;
				this.queue.addItem(cicdRequest, this.githubTimeout, false);
			}
		};

		https.get({
			hostname: 'api.github.com', path: '/repos/' + owner + '/' + repo + '/commits/' + cicdRequest.commits[commitIndex],
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
					if (commit.author && commit.author.cicd_url) { // CICD url found
						let img = await this.downloadCICDImage(cicdRequest.email, commit.author.cicd_url + '&size=162');
						if (img !== null) {
							this.saveCICD(cicdRequest.email, img, false);
						} else {
							this.logger.log('Failed to download cicd from GitHub for ' + maskEmail(cicdRequest.email));
						}
						return;
					}
				} else if (res.statusCode === 403) {
					// Rate limit reached, try again after timeout
					this.queue.addItem(cicdRequest, this.githubTimeout, false);
					return;
				} else if (res.statusCode === 422 && cicdRequest.commits.length > cicdRequest.attempts + 1 && cicdRequest.attempts < 4) {
					// Commit not found on remote, try again with the next commit if less than 5 attempts have been made
					this.queue.addItem(cicdRequest, 0, true);
					return;
				} else if (res.statusCode! >= 500) {
					// If server error, try again after 10 minutes
					this.githubTimeout = t + 600000;
					this.queue.addItem(cicdRequest, this.githubTimeout, false);
					return;
				}
				this.fetchFromGrcicd(cicdRequest); // Fallback to Grcicd
			});
			res.on('error', onError);
		}).on('error', onError);
	}

	/**
	 * Fetch an cicd from GitLab.
	 * @param cicdRequest The cicd request to fetch.
	 */
	private fetchFromGitLab(cicdRequest: CICDRequestItem) {
		let t = (new Date()).getTime();
		if (t < this.gitLabTimeout) {
			// Defer request until after timeout
			this.queue.addItem(cicdRequest, this.gitLabTimeout, false);
			this.fetchCICDsInterval();
			return;
		}

		this.logger.log('Requesting CICD for ' + maskEmail(cicdRequest.email) + ' from GitLab');

		let triggeredOnError = false;
		const onError = () => {
			if (!triggeredOnError) {
				// If an error occurs, try again after 5 minutes
				triggeredOnError = true;
				this.gitLabTimeout = t + 300000;
				this.queue.addItem(cicdRequest, this.gitLabTimeout, false);
			}
		};

		https.get({
			hostname: 'gitlab.com', path: '/api/v4/users?search=' + cicdRequest.email,
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
					if (users.length > 0 && users[0].cicd_url) { // CICD url found
						let img = await this.downloadCICDImage(cicdRequest.email, users[0].cicd_url);
						if (img !== null) {
							this.saveCICD(cicdRequest.email, img, false);
						} else {
							this.logger.log('Failed to download cicd from GitLab for ' + maskEmail(cicdRequest.email));
						}
						return;
					}
				} else if (res.statusCode === 429) {
					// Rate limit reached, try again after timeout
					this.queue.addItem(cicdRequest, this.gitLabTimeout, false);
					return;
				} else if (res.statusCode! >= 500) {
					// If server error, try again after 10 minutes
					this.gitLabTimeout = t + 600000;
					this.queue.addItem(cicdRequest, this.gitLabTimeout, false);
					return;
				}
				this.fetchFromGrcicd(cicdRequest); // Fallback to Grcicd
			});
			res.on('error', onError);
		}).on('error', onError);
	}

	/**
	 * Fetch an cicd from Grcicd.
	 * @param cicdRequest The cicd request to fetch.
	 */
	private async fetchFromGrcicd(cicdRequest: CICDRequestItem) {
		this.logger.log('Requesting CICD for ' + maskEmail(cicdRequest.email) + ' from Grcicd');
		const hash: string = crypto.createHash('md5').update(cicdRequest.email.trim().toLowerCase()).digest('hex');

		let img = await this.downloadCICDImage(cicdRequest.email, 'https://secure.grcicd.com/cicd/' + hash + '?s=162&d=404'), identicon = false;
		if (img === null) {
			img = await this.downloadCICDImage(cicdRequest.email, 'https://secure.grcicd.com/cicd/' + hash + '?s=162&d=identicon');
			identicon = true;
		}

		if (img !== null) {
			this.saveCICD(cicdRequest.email, img, identicon);
		} else {
			this.logger.log('No CICD could be found for ' + maskEmail(cicdRequest.email));
		}
	}

	/**
	 * Download and save an cicd image.
	 * @param _email The email address identifying the cicd.
	 * @param imageUrl The URL the cicd can be downloaded from.
	 * @returns A promise that resolves to the image name of the cicd on disk, or NULL if downloading failed.
	 */
	private downloadCICDImage(_email: string, imageUrl: string) {
		return (new Promise<string | null>((resolve) => {
			// const hash = crypto.createHash('md5').update(email).digest('hex');
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
					if (res.statusCode === 200) { // If success response, save the image to the cicd folder
						// let format = res.headers['content-type']!.split('/')[1];
						// fs.writeFile(this.cicdStorageFolder + '/' + hash + '.' + format, Buffer.concat(imageBufferArray), err => {
						// 	complete(err ? null : hash + '.' + format);
						// });
					} else {
						complete();
					}
				});
				res.on('error', complete);
			}).on('error', complete);
		})).catch(() => null);
	}

	/**
	 * Emit an CICDEvent to any listeners.
	 * @param email The email address identifying the cicd.
	 * @returns A promise indicating if the event was emitted successfully.
	 */
	private emitCICD(email: string) {
		return new Promise<boolean>((resolve, reject) => {
			if (this.cicdEventEmitter.hasSubscribers()) {
				this.getCICDImage(email).then((image) => {
					if (image === null) {
						reject();
					} else {
						this.cicdEventEmitter.emit({
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
	 * Save an cicd in the cache.
	 * @param email The email address identifying the cicd.
	 * @param image The image name of the cicd on disk.
	 * @param identicon Whether this cicd is an identicon.
	 */
	private saveCICD(email: string, image: string, identicon: boolean) {
		if (typeof this.cicds[email] !== 'undefined') {
			if (!identicon || this.cicds[email].identicon) {
				this.cicds[email].image = image;
				this.cicds[email].identicon = identicon;
			}
			this.cicds[email].timestamp = (new Date()).getTime();
		} else {
			this.cicds[email] = { image: image, timestamp: (new Date()).getTime(), identicon: identicon };
		}
		this.extensionState.saveCICD(email, this.cicds[email]);
		this.logger.log('Saved CICD for ' + maskEmail(email));
		this.emitCICD(email).then(
			(sent) => this.logger.log(sent
				? 'Sent CICD for ' + maskEmail(email) + ' to the Git Graph View'
				: 'CICD for ' + maskEmail(email) + ' is ready to be used the next time the Git Graph View is opened'
			),
			() => this.logger.log('Failed to Send CICD for ' + maskEmail(email) + ' to the Git Graph View')
		);
	}
}

/**
 * Represents a queue of cicd requests, ordered by their `checkAfter` value.
 */
class CicdRequestQueue {
	private queue: CICDRequestItem[] = [];
	private itemsAvailableCallback: () => void;

	/**
	 * Create an CICD Request Queue.
	 * @param itemsAvailableCallback A callback that is invoked when the queue transitions from having no items, to having at least one item.
	 */
	constructor(itemsAvailableCallback: () => void) {
		this.itemsAvailableCallback = itemsAvailableCallback;
	}

	/**
	 * Create and add a new cicd request to the queue.
	 * @param email The email address identifying the cicd.
	 * @param repo The repository that the cicd is used in.
	 * @param remote The remote that the cicd can be fetched from.
	 * @param commits The commits that reference the cicd.
	 * @param immediate Whether the cicd should be fetched immediately.
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
	 * Add an existing cicd request item back onto the queue.
	 * @param item The cicd request item.
	 * @param checkAfter The earliest time the cicd should be requested.
	 * @param failedAttempt Did the fetch attempt fail.
	 */
	public addItem(item: CICDRequestItem, checkAfter: number, failedAttempt: boolean) {
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
	 * @returns An cicd request item, or NULL if no item is available.
	 */
	public takeItem() {
		if (this.queue.length > 0 && this.queue[0].checkAfter < (new Date()).getTime()) return this.queue.shift()!;
		return null;
	}

	/**
	 * Insert an cicd request item into the queue.
	 * @param item The cicd request item.
	 */
	private insertItem(item: CICDRequestItem) {
		var l = 0, r = this.queue.length - 1, c, prevLength = this.queue.length;
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

export interface CICD {
	image: string;
	timestamp: number;
	identicon: boolean;
}

export type CICDCache = { [email: string]: CICD };

interface CICDRequestItem {
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

export interface CICDEvent {
	email: string;
	image: string;
}

interface GitLabRemoteSource {
	readonly type: 'gitlab';
}

interface GrcicdRemoteSource {
	readonly type: 'grcicd';
}

type RemoteSource = GitHubRemoteSource | GitLabRemoteSource | GrcicdRemoteSource;
