// import * as crypto from 'crypto';
import { IncomingMessage } from 'http';
import * as https from 'https';
import * as http from 'http';
import { getConfig } from './config';
// import * as url from 'url';
import { ExtensionState } from './extensionState';
import { Logger } from './logger';
import { CICDConfig, CICDData, CICDDataSave, CICDProvider } from './types';
import { Disposable, toDisposable } from './utils/disposable';
import { EventEmitter } from './utils/event';
import { RepoManager } from './repoManager';

/**
 * Manages fetching and caching CICDs.
 */
export class CicdManager extends Disposable {
	private readonly extensionState: ExtensionState;
	private readonly logger: Logger;
	private readonly cicdEventEmitter: EventEmitter<CICDEvent>;
	private readonly repoManager: RepoManager;

	private cicds: CICDCache;
	private queue: CicdRequestQueue;
	private interval: NodeJS.Timer | null = null;

	private githubTimeout: number = 0;
	private gitLabTimeout: number = 0;
	private jenkinsTimeout: number = 0;
	private initialState: boolean = true;
	private requestPage: number = -1;
	private requestPageTimeout: NodeJS.Timer | null = null;
	private cicdConfigsPrev: CICDConfig[] = [];

	private per_page: number = 100;

	/**
	 * Creates the Git Graph CICD Manager.
	 * @param extensionState The Git Graph ExtensionState instance.
	 * @param logger The Git Graph Logger instance.
	 */
	constructor(extensionState: ExtensionState, repoManager: RepoManager, logger: Logger) {
		super();
		this.extensionState = extensionState;
		this.repoManager = repoManager;
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
	 * @param repo The repository that the cicd is used in.
	 * @param hash The hash identifying the cicd commit.
	 * @param cicdConfigs The CICDConfigs.
	 */
	public fetchCICDStatus(repo: string, hash: string) {
		if (typeof this.cicds[repo] !== 'undefined' && typeof this.cicds[repo][hash] !== 'undefined') {
			// CICD exists in the cache
			this.emitCICD(repo, hash, this.cicds[repo][hash]);
		} else {

			let repos = this.repoManager.getRepos();
			if (typeof repos[repo] !== 'undefined') {
				if (repos[repo].cicdConfigs !== null) {
					let cicdConfigs = repos[repo].cicdConfigs;
					if (cicdConfigs !== null) {
						// Check update user config
						const cicdConfigsJSON = JSON.stringify(Object.entries(cicdConfigs).sort());
						const cicdConfigsPrevJSON = JSON.stringify(Object.entries(this.cicdConfigsPrev).sort());
						if (cicdConfigsJSON !== cicdConfigsPrevJSON) {
							this.initialState = true;
							this.requestPage = -1;
							if (this.requestPageTimeout !== null) {
								clearTimeout(this.requestPageTimeout);
							}
							this.requestPageTimeout = null;
						}
						// Deep Clone cicdConfigs
						this.cicdConfigsPrev = JSON.parse(JSON.stringify(cicdConfigs));
						// CICD not in the cache, request it
						if (this.initialState) {
							this.initialState = false;
							cicdConfigs.forEach(cicdConfig => {
								this.queue.add(repo, cicdConfig, this.requestPage, true);
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
			}
		}
	}

	/**
	 * Get the data of an cicd.
	 * @param repo The repository that the cicd is used in.
	 * @param hash The hash identifying the cicd commit.
	 * @param cicdConfigs The CICDConfigs.
	 * @returns A JSON encoded data of an cicd if the cicd exists, otherwise NULL.
	 */
	public getCICDDetail(repo: string, hash: string, cicdConfigs: CICDConfig[]) {
		return new Promise<string | null>((resolve) => {
			cicdConfigs.forEach(cicdConfig => {
				this.queue.add(repo, cicdConfig, -1, true, true, hash);
			});
			if (typeof this.cicds[repo] !== 'undefined' && typeof this.cicds[repo][hash] !== 'undefined' && this.cicds[repo][hash] !== null) {
				resolve(JSON.stringify(this.cicds[repo][hash]));
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
				case CICDProvider.JenkinsV2:
					this.fetchFromJenkins(cicdRequest);
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
		if (t < this.githubTimeout) {
			// Defer request until after timeout
			this.queue.addItem(cicdRequest, this.githubTimeout, false);
			this.fetchCICDsInterval();
			return;
		}

		let cicdConfig = cicdRequest.cicdConfig;

		const match1 = cicdConfig.cicdUrl.match(/^(https?:\/\/|git@)((?=[^/]+@)[^@]+@|(?![^/]+@))([^/:]+)/);
		let hostRootUrl = match1 !== null ? 'api.' + match1[3] : '';

		const match2 = cicdConfig.cicdUrl.match(/^(https?:\/\/|git@)[^/:]+[/:]([^/]+)\/([^/]*?)(.git|)$/);
		let sourceOwner = match2 !== null ? match2[2] : '';
		let sourceRepo = match2 !== null ? match2[3] : '';

		// https://docs.github.com/en/rest/reference/actions#list-workflow-runs-for-a-repository
		let cicdRootPath = `/repos/${sourceOwner}/${sourceRepo.replace(/\//g, '%2F')}/actions/runs?per_page=${this.per_page}`;
		if (cicdRequest.detail) {
			// https://docs.github.com/en/rest/reference/checks#list-check-runs-for-a-git-reference
			cicdRootPath = `/repos/${sourceOwner}/${sourceRepo.replace(/\//g, '%2F')}/commits/${cicdRequest.hash}/check-runs?per_page=${this.per_page}`;
		}
		if (cicdRequest.page > 1) {
			cicdRootPath = `${cicdRootPath}&page=${cicdRequest.page}`;
		}

		let headers: any = {
			'Accept': 'application/vnd.github.v3+json',
			'User-Agent': 'vscode-git-graph'
		};
		if (cicdConfig.cicdToken !== '') {
			headers['Authorization'] = `token ${cicdConfig.cicdToken}`;
		}

		let triggeredOnError = false;
		const onError = (err: Error) => {
			this.logger.log('GitHub API HTTPS Error - ' + err?.message);
			if (!triggeredOnError) {
				// If an error occurs, try again after 5 minutes
				triggeredOnError = true;
				this.githubTimeout = t + 300000;
				this.queue.addItem(cicdRequest, this.githubTimeout, false);
			}
		};

		this.logger.log('Requesting CICD for https://' + hostRootUrl + cicdRootPath + ' detail=' + cicdRequest.detail + ' page=' + cicdRequest.page + ' from GitHub');
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
					this.logger.log('GitHub API Rate Limit Reached - Paused fetching from GitLab until the Rate Limit is reset (RateLimit=' + res.headers['x-ratelimit-limit'] + '(1 hour)/' + new Date(this.githubTimeout).toString() + ')');
					if (cicdRequest.cicdConfig.cicdToken === '') {
						this.logger.log('GitHub API Rate Limit can upgrade by Access Token.');
					}
				}

				if (res.statusCode === 200) { // Success
					this.logger.log('GitHub API - (' + res.statusCode + ')' + 'https://' + hostRootUrl + cicdRootPath);
					try {
						let respJson: any = JSON.parse(respBody);
						if (typeof respJson['check_runs'] !== 'undefined' && respJson['check_runs'].length >= 1) { // url found
							let ret: CICDData[] = respJson['check_runs'].map((elm: { [x: string]: any; }) => {
								return {
									id: elm['id'],
									status: elm['conclusion'] === null ? elm['status'] : elm['conclusion'],
									ref: '',
									sha: elm['head_sha'],
									web_url: elm['html_url'],
									created_at: elm['created_at'],
									updated_at: elm['updated_at'],
									name: elm['app']!['name'] + '(' + elm['name'] + ')',
									event: '',
									detail: cicdRequest.detail
								};
							});
							ret.forEach(element => {
								let save = this.convCICDData2CICDDataSave(element);
								this.saveCICD(cicdRequest.repo, element.sha, element.id, save);
							});
							this.reFetchPageGitHub(cicdRequest, res, cicdConfig);
							return;
						} else if (typeof respJson['workflow_runs'] !== 'undefined' && respJson['workflow_runs'].length >= 1) { // url found
							let ret: CICDData[] = respJson['workflow_runs'].map((elm: { [x: string]: any; }) => {
								return {
									id: elm['id'],
									status: elm['conclusion'] === null ? elm['status'] : elm['conclusion'],
									ref: elm['head_branch'],
									sha: elm['head_sha'],
									web_url: elm['html_url'],
									created_at: elm['created_at'],
									updated_at: elm['updated_at'],
									name: elm['name'],
									event: elm['event'],
									detail: cicdRequest.detail
								};
							});
							ret.forEach(element => {
								let save = this.convCICDData2CICDDataSave(element);
								this.saveCICD(cicdRequest.repo, element.sha, element.id, save);
							});
							this.reFetchPageGitHub(cicdRequest, res, cicdConfig);
							return;
						}
					} catch (e) {
						this.logger.log('GitHub API Error - (' + res.statusCode + ')API Result error. : ' + e.message);
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
	 * ReFetch an cicd from GitHub.
	 * @param cicdRequest The cicd request to fetch.
	 * @param res The IncomingMessage.
	 * @param cicdConfig The CICDConfig.
	 */
	private reFetchPageGitHub(cicdRequest: CICDRequestItem, res: IncomingMessage, cicdConfig: CICDConfig) {
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
			if (last > Math.ceil(cicdRequest.maximumStatuses / this.per_page)) {
				last = Math.ceil(cicdRequest.maximumStatuses / this.per_page);
				this.logger.log('CICD Maximum Statuses(maximumStatuses=' + cicdRequest.maximumStatuses + ') reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
			}

			this.logger.log('Added CICD for ' + cicdConfig.cicdUrl + ' last_page=' + last + '(RateLimit=' + (res.headers['x-ratelimit-limit'] || 'None') + '(1 hour)/Remaining=' + (res.headers['x-ratelimit-remaining'] || 'None') + (res.headers['x-ratelimit-reset'] ? '/' + new Date(parseInt(<string>res.headers['x-ratelimit-reset']) * 1000).toString() : '') + ') from GitHub');
			for (let i = 1; i < last; i++) {
				this.queue.add(cicdRequest.repo, cicdRequest.cicdConfig, i + 1, true);
			}
		}
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

		let cicdConfig = cicdRequest.cicdConfig;

		let gitUrl = cicdConfig.cicdUrl.replace(/\/$/g, '');
		gitUrl = gitUrl.replace(/.git$/g, '');
		const match1 = gitUrl.match(/^(.+?):\/\/(.+?):?(\d+)?(\/.*)?$/);
		let hostProtocol = match1 !== null ? '' + match1[1] : '';
		let hostRootUrl = match1 !== null ? '' + match1[2] : '';
		let hostPort = match1 !== null ? (match1[3] || '') : '';
		let hostpath = match1 !== null ? '' + match1[4].replace(/^\//, '').replace(/\//g, '%2F') : '';

		// Pipelines API https://docs.gitlab.com/ee/api/pipelines.html#list-project-pipelines
		let cicdRootPath = `/api/v4/projects/${hostpath}/pipelines?per_page=${this.per_page}`;
		if (cicdRequest.detail) {
			// Commits API https://docs.gitlab.com/ee/api/commits.html#list-the-statuses-of-a-commit
			cicdRootPath = `/api/v4/projects/${hostpath}/repository/commits/${cicdRequest.hash}/statuses?per_page=${this.per_page}`;
		}

		let headers: any = {
			'User-Agent': 'vscode-git-graph'
		};
		if (cicdConfig.cicdToken !== '') {
			headers['PRIVATE-TOKEN'] = cicdConfig.cicdToken;
		}

		let triggeredOnError = false;
		const onError = (err: Error) => {
			this.logger.log('GitLab API ' + hostProtocol + ' Error - ' + err.message);
			if (!triggeredOnError) {
				// If an error occurs, try again after 5 minutes
				triggeredOnError = true;
				this.gitLabTimeout = t + 300000;
				this.queue.addItem(cicdRequest, this.gitLabTimeout, false);
			}
		};

		this.logger.log('Requesting CICD for ' + hostProtocol + '://' + hostRootUrl + cicdRootPath + ' page=' + cicdRequest.page + ' from GitLab');
		(hostProtocol === 'http' ? http : https).get({
			hostname: hostRootUrl, path: cicdRootPath,
			port: hostPort,
			headers: headers,
			agent: false, timeout: 15000
		}, (res) => {
			let respBody = '';
			res.on('data', (chunk: Buffer) => { respBody += chunk; });
			res.on('end', async () => {
				if (res.headers['ratelimit-remaining'] === '0') {
					// If the GitLab Api rate limit was reached, store the gitlab timeout to prevent subsequent requests
					this.gitLabTimeout = parseInt(<string>res.headers['ratelimit-reset']) * 1000;
					this.logger.log('GitLab API Rate Limit Reached - Paused fetching from GitLab until the Rate Limit is reset (RateLimit=' + res.headers['ratelimit-limit'] + '(every minute)/' + new Date(this.gitLabTimeout).toString() + ')');
				}

				if (res.statusCode === 200) { // Success
					try {
						this.logger.log('GitLab API - (' + res.statusCode + ')' + hostProtocol + '://' + hostRootUrl + cicdRootPath);
						if (typeof res.headers['x-page'] === 'string' && typeof res.headers['x-total-pages'] === 'string' && typeof res.headers['x-total'] === 'string') {
							let respJson: any = JSON.parse(respBody);
							if (parseInt(res.headers['x-total']) !== 0 && respJson.length && respJson[0].id) { // url found
								let ret: CICDData[] = respJson;
								ret.forEach(element => {
									let save: CICDDataSave;
									if (cicdRequest.detail) {
										save = this.convGitLabComitStatuses2CICDDataSave(element, cicdRequest.detail,
											`${hostProtocol}://${hostRootUrl}${hostPort === '' ? '' : ':' + hostPort}/${hostpath.replace(/%2F/g, '/')}/-/jobs/`);
									} else {
										save = this.convCICDData2CICDDataSave(element);
									}
									this.saveCICD(cicdRequest.repo, element.sha, element.id, save);
								});
							}

							if (cicdRequest.page === -1) {
								let last = parseInt(res.headers['x-total-pages']);
								if (last > Math.ceil(cicdRequest.maximumStatuses / this.per_page)) {
									last = Math.ceil(cicdRequest.maximumStatuses / this.per_page);
									this.logger.log('CICD Maximum Statuses(maximumStatuses=' + cicdRequest.maximumStatuses + ') reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
								}

								this.logger.log('Added CICD for ' + cicdConfig.cicdUrl + ' last_page=' + last + '(RateLimit=' + (res.headers['ratelimit-limit'] || 'None') + '(every minute)/Remaining=' + (res.headers['ratelimit-remaining'] || 'None') + (res.headers['ratelimit-reset'] ? '/' + new Date(parseInt(<string>res.headers['ratelimit-reset']) * 1000).toString() : '') + ') from GitLab');
								for (let i = 1; i < last; i++) {
									this.queue.add(cicdRequest.repo, cicdRequest.cicdConfig, i + 1, true);
								}
							}
							return;
						}
					} catch (e) {
						this.logger.log('GitLab API Error - (' + res.statusCode + ')API Result error. : ' + e.message);
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
	 * Fetch an cicd from Jenkins.
	 * @param cicdRequest The cicd request to fetch.
	 */
	private fetchFromJenkins(cicdRequest: CICDRequestItem) {
		if (cicdRequest.detail) {
			return;
		}
		let t = (new Date()).getTime();
		if (cicdRequest.checkAfter !== 0 && t < this.jenkinsTimeout) {
			// Defer request until after timeout
			this.queue.addItem(cicdRequest, this.jenkinsTimeout, false);
			this.fetchCICDsInterval();
			return;
		}

		let cicdConfig = cicdRequest.cicdConfig;

		let gitUrl = cicdConfig.cicdUrl.replace(/\/$/g, '');
		gitUrl = gitUrl.replace(/.git$/g, '');
		const match1 = gitUrl.match(/^(.+?):\/\/(.+?):?(\d+)?(\/.*)?$/);
		let hostProtocol = match1 !== null ? '' + match1[1] : '';
		let hostRootUrl = match1 !== null ? '' + match1[2] : '';
		let hostPort = match1 !== null ? (match1[3] || '') : '';
		let hostpath = match1 !== null ? '' + match1[4].replace(/^\//, '') : '';

		let cicdRootPath = `/${hostpath}/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]`;

		let headers: any = {
			'User-Agent': 'vscode-git-graph'
		};
		if (cicdConfig.cicdToken !== '') {
			// headers['Authorization'] = 'Basic ' + new Buffer(username + ':' + passw).toString('base64');
			headers['Authorization'] = 'Basic ' + new Buffer(cicdConfig.cicdToken).toString('base64');
		}

		let triggeredOnError = false;
		const onError = (err: Error) => {
			this.logger.log('Jenkins API HTTPS Error - ' + err.message);
			if (!triggeredOnError) {
				// If an error occurs, try again after 5 minutes
				triggeredOnError = true;
				this.jenkinsTimeout = t + 300000;
				this.queue.addItem(cicdRequest, this.jenkinsTimeout, false);
			}
		};

		this.logger.log('Requesting CICD for ' + hostProtocol + '://' + hostRootUrl + cicdRootPath + ' page=' + cicdRequest.page + ' from Jenkins');
		(hostProtocol === 'http' ? http : https).get({
			hostname: hostRootUrl, path: cicdRootPath,
			port: hostPort,
			headers: headers,
			agent: false, timeout: 15000
		}, (res) => {
			let respBody = '';
			res.on('data', (chunk: Buffer) => { respBody += chunk; });
			res.on('end', async () => {
				if (res.headers['ratelimit-remaining'] === '0') {
					// If the GitLab Api rate limit was reached, store the gitlab timeout to prevent subsequent requests
					this.jenkinsTimeout = parseInt(<string>res.headers['ratelimit-reset']) * 1000;
					this.logger.log('GitLab API Rate Limit Reached - Paused fetching from GitLab until the Rate Limit is reset (RateLimit=' + res.headers['ratelimit-limit'] + '(every minute)/' + new Date(this.jenkinsTimeout).toString() + ')');
				}

				if (res.statusCode === 200) { // Success
					try {
						if (typeof res.headers['x-jenkins'] === 'string' && res.headers['x-jenkins'].startsWith('2.')) {
							let respJson: any = JSON.parse(respBody);
							if (respJson['builds'].length) { // url found
								let ret: CICDData[] = [];
								respJson['builds'].forEach((elmBuild: { [x: string]: any; }) => {
									elmBuild['actions'].forEach((elmAction: { [x: string]: any; }) => {
										if (typeof elmAction['lastBuiltRevision'] !== 'undefined' && typeof elmAction['lastBuiltRevision']['branch'] !== 'undefined'
											&& typeof elmAction['lastBuiltRevision']['branch'][0] !== 'undefined' && typeof elmAction['lastBuiltRevision']['branch'][0].SHA1 !== 'undefined') {
											ret.push(
												{
													id: elmBuild['id'],
													status: elmBuild['result'],
													ref: elmAction['lastBuiltRevision']!['branch']![0]!.name,
													sha: elmAction['lastBuiltRevision']!['branch']![0]!.SHA1,
													web_url: elmBuild['url'],
													created_at: '',
													updated_at: elmBuild['timestamp'],
													name: elmBuild['fullDisplayName'],
													event: '',
													detail: cicdRequest.detail
												}
											);
										}
									});
								});
								ret.forEach(element => {
									let save = this.convCICDData2CICDDataSave(element);
									this.saveCICD(cicdRequest.repo, element.sha, element.id, save);
								});
								return;
							}
						}
					} catch (e) {
						this.logger.log('Jenkins API Error - (' + res.statusCode + ')API Result error. : ' + e.message);
					}
				} else if (res.statusCode === 429) {
					// Rate limit reached, try again after timeout
					this.queue.addItem(cicdRequest, this.jenkinsTimeout, false);
					return;
				} else if (res.statusCode! >= 500) {
					// If server error, try again after 10 minutes
					this.jenkinsTimeout = t + 600000;
					this.queue.addItem(cicdRequest, this.jenkinsTimeout, false);
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
	 * Fetch an cicd from GitHub/GitLab/Jenkins.
	 * @param cicdData The CICDData.
	 * @returns The CICDDataSave.
	 */
	private convCICDData2CICDDataSave(cicdData: CICDData): CICDDataSave {
		return {
			name: cicdData!.name,
			ref: cicdData!.ref,
			status: cicdData!.status,
			web_url: cicdData!.web_url,
			event: cicdData!.event,
			detail: cicdData!.detail
		};
	}

	/**
	 * Fetch an cicd from GitLab.
	 * @param data The result of GitLab commit statuses API.
	 * @param detail Detail fetch flag.
	 * @returns The CICDDataSave.
	 */
	private convGitLabComitStatuses2CICDDataSave(data: any, detail: boolean, url: string): CICDDataSave {
		let ret = {
			name: data!.name,
			ref: data!.ref,
			status: data!.status,
			web_url: data!.target_url,
			event: '',
			detail: detail
		};
		if (typeof ret.web_url === 'undefined' || ret.web_url === null) {
			ret.web_url = url + data.id;
		}
		return ret;
	}

	/**
	 * Emit an CICDEvent to any listeners.
	 * @param repo The repository that the cicd is used in.
	 * @param hash The hash identifying the cicd commit.
	 * @param cicdDataSaves The hash of CICDDataSave.
	 * @returns A promise indicating if the event was emitted successfully.
	 */
	private emitCICD(repo: string, hash: string, cicdDataSaves: { [id: string]: CICDDataSave }) {
		return new Promise<boolean>((resolve, _reject) => {
			if (this.cicdEventEmitter.hasSubscribers()) {
				this.cicdEventEmitter.emit({
					repo: repo,
					hash: hash,
					cicdDataSaves: cicdDataSaves
				});
				resolve(true);
			} else {
				resolve(false);
			}
		});
	}

	/**
	 * Save an cicd in the cache.
	 * @param repo The repository that the cicd is used in.
	 * @param hash The hash identifying the cicd commit.
	 * @param id The identifying the cicdDataSave.
	 * @param cicdDataSave The CICDDataSave.
	 */
	private saveCICD(repo: string, hash: string, id: string, cicdDataSave: CICDDataSave) {
		if (typeof this.cicds[repo] === 'undefined') {
			this.cicds[repo] = {};
		}
		if (typeof this.cicds[repo][hash] === 'undefined') {
			this.cicds[repo][hash] = {};
		}
		this.cicds[repo][hash][id] = cicdDataSave;
		this.extensionState.saveCICD(repo, hash, id, cicdDataSave);
		// this.logger.log('Saved CICD for ' + cicdData.sha);
		this.emitCICD(repo, hash, this.cicds[repo][hash]);
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
	 * @param repo The repository that the cicd is used in.
	 * @param cicdConfig The CICDConfig.
	 * @param page The page of cicd request.
	 * @param immediate Whether the avatar should be fetched immediately.
	 * @param detail Flag of fetch detail.
	 * @param hash hash for fetch detail.
	 */
	public add(repo: string, cicdConfig: CICDConfig, page: number, immediate: boolean, detail: boolean = false, hash: string = '') {
		const existingRequest = this.queue.find((request) => request.cicdConfig.cicdUrl === cicdConfig.cicdUrl && request.page === page && request.detail === detail && request.hash === hash);
		if (existingRequest) {
		} else {
			const config = getConfig();
			this.insertItem({
				repo: repo,
				cicdConfig: cicdConfig,
				page: page,
				checkAfter: immediate || this.queue.length === 0
					? 0
					: this.queue[this.queue.length - 1].checkAfter + 1,
				attempts: 0,
				detail: detail,
				hash: hash,
				maximumStatuses: config.fetchCICDsMaximumStatuses
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


export type CICDCache = { [repo: string]: { [hash: string]: { [id: string]: CICDDataSave } } };


// Request item to CicdRequestQueue
interface CICDRequestItem {
	repo: string;
	cicdConfig: CICDConfig;
	page: number;
	checkAfter: number;
	attempts: number;
	detail: boolean;
	hash: string;
	maximumStatuses: number;
}

// Event to GitGraphView
export interface CICDEvent {
	repo: string;
	hash: string;
	cicdDataSaves: { [id: string]: CICDDataSave };
}
