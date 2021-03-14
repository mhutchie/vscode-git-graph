// import * as crypto from 'crypto';
import * as https from 'https';
// import * as url from 'url';
import { ExtensionState } from './extensionState';
import { Logger } from './logger';
import { CICDConfig, CICDData, CICDProvider } from './types';
import { Disposable, toDisposable } from './utils/disposable';
import { EventEmitter } from './utils/event';

/**
 * Manages fetching and caching CICDs.
 */
export class CicdManager extends Disposable {
	private readonly extensionState: ExtensionState;
	private readonly logger: Logger;
	private readonly cicdEventEmitter: EventEmitter<CICDEvent>;

	private cicds: CICDCache;
	private queue: CicdRequestQueue;
	private interval: NodeJS.Timer | null = null;

	private githubTimeout: number = 0;
	private gitLabTimeout: number = 0;
	private initialState: boolean = true;
	private requestPage: number = -1;
	private requestPageTimeout: NodeJS.Timer | null = null;
	private cicdConfigsPrev: CICDConfig[] = [];

	/**
	 * Creates the Git Graph CICD Manager.
	 * @param extensionState The Git Graph ExtensionState instance.
	 * @param logger The Git Graph Logger instance.
	 */
	constructor(extensionState: ExtensionState, logger: Logger) {
		super();
		this.extensionState = extensionState;
		this.logger = logger;
		this.cicdEventEmitter = new EventEmitter<CICDEvent>();
		this.cicds = this.extensionState.getCICDCache();
		this.queue = new CicdRequestQueue(() => {
			if (this.interval !== null) return;
			this.interval = setInterval(() => {
				// Fetch cicds every 1 seconds
				this.fetchCICDsInterval();
			}, 1000);
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
		}
	}

	/**
	 * Fetch an cicd, either from the cache if it already exists, or queue it to be fetched.
	 * @param hash The hash identifying the cicd.
	 */
	public fetchCICDStatus(hash: string, cicdConfigs: CICDConfig[]) {
		if (typeof this.cicds[hash] !== 'undefined') {
			// CICD exists in the cache
			this.emitCICD(this.cicds[hash]).catch(() => {
				// CICD couldn't be found
				this.removeCICDFromCache(hash);
			});
		} else {

			// Check update user config
			const cicdConfigsJSON = Object.entries(cicdConfigs).sort().toString();
			const cicdConfigsPrevJSON = Object.entries(this.cicdConfigsPrev).sort().toString();
			if (cicdConfigsJSON !== cicdConfigsPrevJSON) {
				this.initialState = true;
				this.requestPage = -1;
				if (this.requestPageTimeout !== null) {
					clearTimeout(this.requestPageTimeout);
				}
				this.requestPageTimeout = null;
			}
			this.cicdConfigsPrev = Object.assign({}, cicdConfigs);
			// CICD not in the cache, request it
			if (this.initialState === true) {
				this.initialState = false;
				cicdConfigs.forEach(cicdConfig => {
					this.queue.add(cicdConfig, this.requestPage, true);
				});
				// Reset initial state for 10 seconds
				setTimeout(() => {
					this.logger.log('Reset initial timer of CICD');
					this.initialState = true;
				}, 10000);
				// set request page to top 
				this.requestPage = 1;
				// Reset request page to all after 10 minutes
				if (this.requestPageTimeout === null) {
					this.requestPageTimeout = setTimeout(() => {
						this.logger.log('Reset request page of CICD');
						this.requestPage = -1;
						this.requestPageTimeout = null;
					}, 600000);
				}
			}
		}
	}

	/**
	 * Get the data of an cicd.
	 * @param hash The hash identifying the cicd.
	 * @returns A JSON encoded data of an cicd if the cicd exists, otherwise NULL.
	 */
	public getCICDImage(hash: string) {
		return new Promise<string | null>((resolve) => {
			if (typeof this.cicds[hash] !== 'undefined' && this.cicds[hash] !== null) {
				resolve(JSON.stringify(this.cicds[hash]));
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
	 * @param hash The hash identifying the cicd.
	 */
	private removeCICDFromCache(hash: string) {
		delete this.cicds[hash];
		this.extensionState.removeCICDFromCache(hash);
	}

	/**
	 * Remove all cicds from the cache.
	 */
	public clearCache() {
		this.cicds = {};
		this.extensionState.clearCICDCache();
	}

	/**
	 * Triggered by an interval to fetch cicds from GitHub and GitLab.
	 */
	private async fetchCICDsInterval() {
		if (this.queue.hasItems()) {

			let cicdRequest = this.queue.takeItem();
			if (cicdRequest === null) return; // No cicd can be checked at the current time

			switch (cicdRequest.cicdConfig.provider) {
				case CICDProvider.GitHubV3:
					this.fetchFromGitHub(cicdRequest);
					break;
				case CICDProvider.GitLabV4:
					this.fetchFromGitLab(cicdRequest);
					break;
				default:
					break;
			}
		} else {
			// Stop the interval if there are no items remaining in the queue
			this.stopInterval();
		}
	}

	/**
	 * Fetch an cicd from GitHub.
	 * @param cicdRequest The cicd request to fetch.
	 */
	private fetchFromGitHub(cicdRequest: CICDRequestItem) {
		let t = (new Date()).getTime();
		if (cicdRequest.checkAfter !== 0 && t < this.githubTimeout) {
			// Defer request until after timeout
			this.queue.addItem(cicdRequest, this.githubTimeout, false);
			this.fetchCICDsInterval();
			return;
		}

		let cicdConfig = cicdRequest.cicdConfig;
		this.logger.log('Requesting CICD for ' + cicdConfig.gitUrl + ' page=' + cicdRequest.page + ' from GitHub');

		const match1 = cicdConfig.gitUrl.match(/^(https?:\/\/|git@)((?=[^/]+@)[^@]+@|(?![^/]+@))([^/:]+)/);
		let hostRootUrl = match1 !== null ? 'api.' + match1[3] : '';

		const match2 = cicdConfig.gitUrl.match(/^(https?:\/\/|git@)[^/:]+[/:]([^/]+)\/([^/]*?)(.git|)$/);
		let sourceOwner = match2 !== null ? match2[2] : '';
		let sourceRepo = match2 !== null ? match2[3] : '';

		let cicdRootPath = `/repos/${sourceOwner}/${sourceRepo.replace(/\//g, '%2F')}/actions/runs?per_page=100`;
		if (cicdRequest.page > 1) {
			cicdRootPath = `${cicdRootPath}&page=${cicdRequest.page}`;
		}

		let headers: any = {
			'Accept': 'application/vnd.github.v3+json',
			'User-Agent': 'vscode-git-graph'
		};
		if (cicdConfig.glToken !== '') {
			headers['Authorization'] = `token ${cicdConfig.glToken}`;
		}

		let triggeredOnError = false;
		const onError = (err: Error) => {
			this.logger.log('GitHub API HTTPS Error - ' + err.message);
			if (!triggeredOnError) {
				// If an error occurs, try again after 5 minutes
				triggeredOnError = true;
				this.githubTimeout = t + 300000;
				this.queue.addItem(cicdRequest, this.githubTimeout, false);
			}
		};

		https.get({
			hostname: hostRootUrl, path: cicdRootPath,
			headers: headers,
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
					try {
						let respJson: any = JSON.parse(respBody);
						if (typeof respJson['workflow_runs'] !== 'undefined' && respJson['workflow_runs'].length >= 1) { // url found
							let ret: CICDData[] = respJson['workflow_runs'].map((elm: { [x: string]: any; }) => {
								return {
									id: elm['id'],
									status: elm['conclusion'] === null ? elm['status'] : elm['conclusion'],
									ref: elm['name'],
									sha: elm['head_sha'],
									web_url: elm['html_url'],
									created_at: elm['created_at'],
									updated_at: elm['updated_at']
								};
							});
							ret.forEach(element => {
								this.saveCICD(element);
							});

							if (cicdRequest.page === -1) {
								let last = 1;
								if (typeof res.headers['link'] === 'string') {
									const DELIM_LINKS = ',';
									const DELIM_LINK_PARAM = ';';
									let links = res.headers['link'].split(DELIM_LINKS);
									links.forEach(link => {
										let segments = link.split(DELIM_LINK_PARAM);

										let linkPart = segments[0].trim();
										if (!linkPart.startsWith('<') || !linkPart.endsWith('>')) {
											return true;
										}
										linkPart = linkPart.substring(1, linkPart.length - 1);
										let match3 = linkPart.match(/&page=(\d+).*$/);
										let linkPage = match3 !== null ? match3[1] : '0';

										for (let i = 1; i < segments.length; i++) {
											let rel = segments[i].trim().split('=');
											if (rel.length < 2) {
												continue;
											}

											let relValue = rel[1];
											if (relValue.startsWith('"') && relValue.endsWith('"')) {
												relValue = relValue.substring(1, relValue.length - 1);
											}

											if (relValue === 'last') {
												last = parseInt(linkPage);
											}
										}
									});
								}

								for (var i = 1; i < last; i++) {
									// let cicdRequestNew = Object.assign({}, cicdRequest);;
									// cicdRequestNew.page = i + 1;
									// this.queue.addItem(cicdRequestNew, 0, false);
									this.queue.add(cicdRequest.cicdConfig, i + 1, true);
								}
							}
							return;
						}
					} catch (e) {
						this.logger.log('GitHub API Error - (' + res.statusCode + ')API Result error.');
					}
					return;
				} else if (res.statusCode === 403) {
					// Rate limit reached, try again after timeout
					this.queue.addItem(cicdRequest, this.githubTimeout, false);
					return;
				} else if (res.statusCode === 422 && cicdRequest.attempts < 4) {
					// Commit not found on remote, try again with the next commit if less than 5 attempts have been made
					this.queue.addItem(cicdRequest, 0, true);
					return;
				} else if (res.statusCode! >= 500) {
					// If server error, try again after 10 minutes
					this.githubTimeout = t + 600000;
					this.queue.addItem(cicdRequest, this.githubTimeout, false);
					return;
				} else {
					// API Error
					try {
						let respJson: any = JSON.parse(respBody);
						this.logger.log('GitHub API Error - (' + res.statusCode + ')' + respJson.message);
					} catch (e) {
						this.logger.log('GitHub API Error - (' + res.statusCode + ')' + res.statusMessage);
					}
				}
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
		if (cicdRequest.checkAfter !== 0 && t < this.gitLabTimeout) {
			// Defer request until after timeout
			this.queue.addItem(cicdRequest, this.gitLabTimeout, false);
			this.fetchCICDsInterval();
			return;
		}

		let cicdConfig = cicdRequest.cicdConfig;
		this.logger.log('Requesting CICD for ' + cicdConfig.gitUrl + ' page=' + cicdRequest.page + ' from GitLab');

		const match1 = cicdConfig.gitUrl.match(/^(https?:\/\/|git@)((?=[^/]+@)[^@]+@|(?![^/]+@))([^/:]+)/);
		let hostRootUrl = match1 !== null ? '' + match1[3] : '';

		const match2 = cicdConfig.gitUrl.match(/^(https?:\/\/|git@)[^/:]+[/:]([^/]+)\/([^/]*?)(.git|)$/);
		let sourceOwner = match2 !== null ? match2[2] : '';
		let sourceRepo = match2 !== null ? match2[3] : '';

		const cicdRootPath = `/api/v4/projects/${sourceOwner}%2F${sourceRepo.replace(/\//g, '%2F')}/pipelines?per_page=100`;

		let headers: any = {
			'User-Agent': 'vscode-git-graph'
		};
		if (cicdConfig.glToken !== '') {
			headers['PRIVATE-TOKEN'] = cicdConfig.glToken;
		}

		let triggeredOnError = false;
		const onError = (err: Error) => {
			this.logger.log('GitLab API HTTPS Error - ' + err.message);
			if (!triggeredOnError) {
				// If an error occurs, try again after 5 minutes
				triggeredOnError = true;
				this.gitLabTimeout = t + 300000;
				this.queue.addItem(cicdRequest, this.gitLabTimeout, false);
			}
		};

		https.get({
			hostname: hostRootUrl, path: cicdRootPath,
			headers: headers,
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
					try {
						if (typeof res.headers['x-page'] === 'string' && typeof res.headers['x-total-pages'] === 'string' && typeof res.headers['x-total'] === 'string') {
							let respJson: any = JSON.parse(respBody);
							if (parseInt(res.headers['x-total']) !== 0 && respJson.length && respJson[0].id) { // url found
								let ret: CICDData[] = respJson;
								ret.forEach(element => {
									this.saveCICD(element);
								});

								let last = parseInt(res.headers['x-total-pages']);
								if (cicdRequest.page === -1) {
									for (var i = 1; i < last; i++) {
										// let cicdRequestNew = Object.assign({}, cicdRequest);;
										// cicdRequestNew.page = i + 1;
										// this.queue.addItem(cicdRequestNew, 0, false);
										this.queue.add(cicdRequest.cicdConfig, i + 1, true);
									}
								}
								return;
							}
						}
					} catch (e) {
						this.logger.log('GitLab API Error - (' + res.statusCode + ')API Result error.');
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
				} else {
					// API Error
					try {
						let respJson: any = JSON.parse(respBody);
						this.logger.log('GitLab API Error - (' + res.statusCode + ')' + respJson.message);
					} catch (e) {
						this.logger.log('GitLab API Error - (' + res.statusCode + ')' + res.statusMessage);
					}
				}
			});
			res.on('error', onError);
		}).on('error', onError);
	}

	/**
	 * Emit an CICDEvent to any listeners.
	 * @param cicdData The CICDData.
	 * @returns A promise indicating if the event was emitted successfully.
	 */
	private emitCICD(cicdData: CICDData) {
		return new Promise<boolean>((resolve, _reject) => {
			if (this.cicdEventEmitter.hasSubscribers()) {
				this.cicdEventEmitter.emit({
					cicdData: cicdData
				});
				resolve(true);
			} else {
				resolve(false);
			}
		});
	}

	/**
	 * Save an cicd in the cache.
	 * @param cicdData The CICDData.
	 */
	private saveCICD(cicdData: CICDData) {
		this.cicds[cicdData.sha] = cicdData;
		this.extensionState.saveCICD(this.cicds[cicdData.sha]);
		// this.logger.log('Saved CICD for ' + cicdData.sha);
		this.emitCICD(this.cicds[cicdData.sha]).then(
			// (sent) => this.logger.log(sent
			// 	? 'Sent CICD for ' + cicdData.sha + ' to the Git Graph View'
			// 	: 'CICD for ' + cicdData.sha + ' is ready to be used the next time the Git Graph View is opened'
			// ),
			() => { },
			() => this.logger.log('Failed to Send CICD for ' + cicdData.sha + ' to the Git Graph View')
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
	 * @param cicdConfig The CICDConfig.
	 * @param page The page of cicd request.
	 * @param immediate Whether the avatar should be fetched immediately.
	 */
	public add(cicdConfig: CICDConfig, page: number, immediate: boolean) {
		const existingRequest = this.queue.find((request) => request.cicdConfig.gitUrl === cicdConfig.gitUrl && request.page === page);
		if (existingRequest) {
		} else {
			this.insertItem({
				cicdConfig: cicdConfig,
				page: page,
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


export type CICDCache = { [hash: string]: CICDData };


// Request item to CicdRequestQueue
interface CICDRequestItem {
	cicdConfig: CICDConfig;
	page: number;
	checkAfter: number;
	attempts: number;
}

// Event to GitGraphView
export interface CICDEvent {
	cicdData: CICDData;
}
