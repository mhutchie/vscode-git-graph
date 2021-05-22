import * as date from './mocks/date';
import * as vscode from './mocks/vscode';
jest.mock('vscode', () => vscode, { virtual: true });
jest.mock('fs');
jest.mock('https');
jest.mock('http');
jest.mock('../src/dataSource');
jest.mock('../src/extensionState');
jest.mock('../src/logger');
jest.mock('../src/repoManager');

import { ClientRequest, IncomingMessage } from 'http';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { ConfigurationChangeEvent } from 'vscode';
import { CICDEvent, CicdManager } from '../src/cicdManager';
import { DataSource } from '../src/dataSource';
import { DEFAULT_REPO_STATE, ExtensionState } from '../src/extensionState';
import { Logger } from '../src/logger';
import { GitExecutable } from '../src/utils';
import { EventEmitter } from '../src/utils/event';
import { RepoManager } from '../src/repoManager';
import { CICDConfig, CICDProvider } from '../src/types';
import { waitForExpect } from './helpers/expectations';

let onDidChangeConfiguration: EventEmitter<ConfigurationChangeEvent>;
let onDidChangeGitExecutable: EventEmitter<GitExecutable>;
let logger: Logger;
let dataSource: DataSource;
let extensionState: ExtensionState;
let repoManager: RepoManager;
let spyOnSaveCicd: jest.SpyInstance, spyOnHttpsGet: jest.SpyInstance, spyOnHttpGet: jest.SpyInstance, spyOnLog: jest.SpyInstance;
let spyOnGetRepos: jest.SpyInstance;
// , spyOnGetKnownRepo: jest.SpyInstance, spyOnRegisterRepo: jest.SpyInstance, spyOnGetCommitSubject: jest.SpyInstance;
// let spyOnGetCodeReviews: jest.SpyInstance;
// , spyOnEndCodeReview: jest.SpyInstance;
const GitHubResponse = JSON.stringify({
	total_count: 1,
	check_runs: [{
		id: 2211653232,
		head_sha: '149ecc50e5c223251f80a0223cfbbd9822307224',
		html_url: 'https://github.com/mhutchie/vscode-git-graph/runs/2211653232',
		status: 'completed',
		conclusion: 'success',
		name: 'build',
		app: { name: 'GitHub Actions' }
	}]
});

const GitLabResponse = JSON.stringify([
	{
		id: 2211653232,
		sha: '149ecc50e5c223251f80a0223cfbbd9822307224',
		ref: 'main',
		status: 'success',
		name: 'eslint-sast',
		target_url: 'https://gitlab.com/mhutchie/vscode-git-graph/runs/2211653232',
		allow_failure: false
	}
]);

const JenkinsResponse = JSON.stringify(
	{
		_class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
		builds: [
			{
				_class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
				actions: [
					{
						_class: 'hudson.plugins.git.util.BuildData',
						lastBuiltRevision: {
							branch: [
								{
									SHA1: '149ecc50e5c223251f80a0223cfbbd9822307224',
									name: 'master'
								}
							]
						}
					}
				],
				fullDisplayName: 'job01 » MultiBranch » master #3',
				id: '3',
				result: 'SUCCESS',
				timestamp: 1620716982997,
				url: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/'
			}
		]
	}
);

const GitHubHeader = {
	'content-type': 'application/json; charset=utf-8',
	'link': '<https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=325>; rel="last"',
	'x-github-media-type': 'unknown, github.v3',
	'x-ratelimit-limit': '60',
	'x-ratelimit-remaining': '57',
	'x-ratelimit-reset': '1618343683'
};

const GitLabHeader = {
	'content-type': 'application/json',
	'x-page': '1',
	'x-total': '32500',
	'x-total-pages': '325',
	'ratelimit-limit': '60',
	'ratelimit-observed': '3',
	'ratelimit-remaining': '57',
	'ratelimit-reset': '1618343683'
};

const JenkinsHeader = {
	'content-type': 'application/json',
	'x-jenkins': '2.235.1'
};

const GitHubCicdEvents = {
	'cicdDataSaves': {
		'2211653232': {
			name: 'GitHub Actions(build)',
			status: 'success',
			ref: '',
			web_url: 'https://github.com/mhutchie/vscode-git-graph/runs/2211653232',
			event: '',
			detail: true,
			allow_failure: false
		}
	},
	'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
	'repo': '/path/to/repo1'
};

const GitLabCicdEvents = {
	'cicdDataSaves': {
		'2211653232': {
			name: 'eslint-sast',
			status: 'success',
			ref: 'main',
			web_url: 'https://gitlab.com/mhutchie/vscode-git-graph/runs/2211653232',
			event: '',
			detail: true,
			allow_failure: false
		}
	},
	'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
	'repo': '/path/to/repo1'
};


const JenkinsCicdEvents = {
	'cicdDataSaves': {
		'3': {
			name: 'job01 » MultiBranch » master #3',
			status: 'SUCCESS',
			ref: 'master',
			web_url: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
			event: '',
			detail: true,
			allow_failure: false
		}
	},
	'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
	'repo': '/path/to/repo1'
};

const GitHubHttpsGet = {
	hostname: 'api.github.com',
	path: '/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100',
	headers: {
		'Accept': 'application/vnd.github.v3+json',
		'User-Agent': 'vscode-git-graph'
	},
	port: '',
	agent: false,
	timeout: 15000
};

const GitLabHttpsGet = {
	hostname: 'gitlab.com',
	path: '/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100',
	headers: {
		'User-Agent': 'vscode-git-graph'
	},
	port: '',
	agent: false,
	timeout: 15000
};

const JenkinsHttpsGet = {
	hostname: 'jenkins.net',
	path: '/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]',
	headers: {
		'User-Agent': 'vscode-git-graph'
	},
	port: '',
	agent: false,
	timeout: 15000
};

const GitHubGetRspos = {
	'/path/to/repo1': mockRepoState(null, 0,
		'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
			provider: CICDProvider.GitHubV3,
			cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
			cicdToken: ''
		}]),
	'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
};

const GitLabGetRspos = {
	'/path/to/repo1': mockRepoState(null, 0,
		'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
			provider: CICDProvider.GitLabV4,
			cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
			cicdToken: ''
		}]),
	'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
};

const JenkinsGetRspos = {
	'/path/to/repo1': mockRepoState(null, 0,
		'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
			provider: CICDProvider.JenkinsV2,
			cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
			cicdToken: ''
		}]),
	'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
};

const GitHubSaveCicd = [
	'/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224', 2211653232,
	{
		name: 'GitHub Actions(build)',
		status: 'success',
		ref: '',
		web_url: 'https://github.com/mhutchie/vscode-git-graph/runs/2211653232',
		event: '',
		detail: true,
		allow_failure: false
	}
];

const GitLabSaveCicd = [
	'/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224', 2211653232,
	{
		name: 'eslint-sast',
		status: 'success',
		ref: 'main',
		web_url: 'https://gitlab.com/mhutchie/vscode-git-graph/runs/2211653232',
		event: '',
		detail: true,
		allow_failure: false
	}
];

const JenkinsSaveCicd = [
	'/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224', '3',
	{
		name: 'job01 » MultiBranch » master #3',
		status: 'SUCCESS',
		ref: 'master',
		web_url: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
		event: '',
		detail: true,
		allow_failure: false
	}
];

beforeAll(() => {
	onDidChangeConfiguration = new EventEmitter<ConfigurationChangeEvent>();
	onDidChangeGitExecutable = new EventEmitter<GitExecutable>();
	logger = new Logger();
	dataSource = new DataSource(null, onDidChangeConfiguration.subscribe, onDidChangeGitExecutable.subscribe, logger);
	extensionState = new ExtensionState(vscode.mocks.extensionContext, onDidChangeGitExecutable.subscribe);
	repoManager = new RepoManager(dataSource, extensionState, onDidChangeConfiguration.subscribe, logger);
	spyOnGetRepos = jest.spyOn(repoManager, 'getRepos');
	// spyOnGetKnownRepo = jest.spyOn(repoManager, 'getKnownRepo');
	// spyOnRegisterRepo = jest.spyOn(repoManager, 'registerRepo');
	spyOnSaveCicd = jest.spyOn(extensionState, 'saveCICD');
	// spyOnGetCodeReviews = jest.spyOn(extensionState, 'getCodeReviews');
	// spyOnEndCodeReview = jest.spyOn(extensionState, 'endCodeReview');
	// spyOnGetCommitSubject = jest.spyOn(dataSource, 'getCommitSubject');
	spyOnHttpsGet = jest.spyOn(https, 'get');
	spyOnHttpGet = jest.spyOn(http, 'get');
	spyOnLog = jest.spyOn(logger, 'log');
});

afterAll(() => {
	extensionState.dispose();
	repoManager.dispose();
	dataSource.dispose();
	logger.dispose();
	onDidChangeConfiguration.dispose();
	onDidChangeGitExecutable.dispose();
});


describe('CicdManager', () => {
	let cicdManager: CicdManager;
	// let spyOnGetLastActiveRepo: jest.SpyInstance;
	// beforeAll(() => {
	// 	spyOnGetLastActiveRepo = jest.spyOn(extensionState, 'getLastActiveRepo');
	// });
	beforeEach(() => {
		jest.spyOn(extensionState, 'getCICDCache').mockReturnValueOnce({
			'/path/to/repo': {
				'hash0': {
					'id0': {
						name: 'string',
						status: 'string',
						ref: 'string',
						web_url: 'string',
						event: 'string',
						detail: true,
						allow_failure: false
					}
				}
			}
		});
		cicdManager = new CicdManager(extensionState, repoManager, logger);
		jest.clearAllTimers();
		jest.useRealTimers();
	});
	afterEach(() => {
		cicdManager.dispose();
	});

	it('Should construct an CicdManager, and be disposed', () => {
		// Assert
		expect(cicdManager['disposables']).toHaveLength(2);

		// Run
		cicdManager.dispose();

		// Assert
		expect(cicdManager['disposables']).toHaveLength(0);
	});

	describe('getCICDDetail', () => {
		it('Should trigger the cicd to not be emitted when a known cicd is requested', async () => {
			// Setup
			spyOnGetRepos.mockReturnValueOnce({
				'/path/to/repo': mockRepoState(null, 0, null, null)
			});

			// Run
			let data = await cicdManager.getCICDDetail('/path/to/repo', 'hash0');

			// Assert
			expect.assertions(1);
			if (data) {
				expect(JSON.parse(data)).toStrictEqual({
					'id0': {
						name: 'string',
						status: 'string',
						ref: 'string',
						web_url: 'string',
						event: 'string',
						detail: true,
						allow_failure: false
					}});
			}
		});

		it('Should trigger the cicd to not be emitted when a unknown cicd is requested multi repo', async () => {
			// Setup
			spyOnGetRepos.mockReturnValueOnce({
				'/path/to/repo1': mockRepoState(null, 0, null, null),
				'/path/to/repo2': mockRepoState(null, 0, null, null)
			});

			// Run
			let data = await cicdManager.getCICDDetail('/path/to/repo2', 'hash0');

			// Assert
			expect(data).toStrictEqual(null);
		});

		it('Should trigger the cicd to not be emitted when a unknown cicd is requested', async () => {
			// Setup
			spyOnGetRepos.mockReturnValueOnce({
				'/path/to/repo1': mockRepoState(null, 0, null, null)
			});

			// Run
			let data = await cicdManager.getCICDDetail('/path/to/repoX', 'hash0');

			// Assert
			expect(data).toStrictEqual(null);
		});


		describe('Unknown provider', () => {
			it('Should Unknown provider Error', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: -1,
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}])
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenCalledWith( 'Unknown provider Error');
				expect(spyOnLog).toHaveBeenCalledTimes(1);
			});
		});


		describe('GitHub', () => {
			it('Should fetch a new cicd from GitHub (HTTPS Remote)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(200, GitHubResponse, GitHubHeader);
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([GitHubCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitHubHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...GitHubSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for https://github.com/keydepth/vscode-git-graph.git last_page=10(RateLimit=60(1 hour)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(4);
			});

			it('Should fetch a new cicd from GitHub (HTTPS Remote) with port', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitHubV3,
							cicdUrl: 'https://github.com:80/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});
				mockHttpsResponse(200, GitHubResponse, GitHubHeader);
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([GitHubCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'api.github.com',
					path: '/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100',
					headers: {
						'Accept': 'application/vnd.github.v3+json',
						'User-Agent': 'vscode-git-graph'
					},
					port: '80',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...GitHubSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for https://github.com:80/keydepth/vscode-git-graph.git last_page=10(RateLimit=60(1 hour)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(4);
			});

			it('Should fetch a new cicd from GitHub (HTTP Remote)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitHubV3,
							cicdUrl: 'http://github.com/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});
				mockHttpResponse(200, JSON.stringify({
					total_count: 1,
					check_runs: [{
						id: 2211653232,
						head_sha: '149ecc50e5c223251f80a0223cfbbd9822307224',
						html_url: 'http://github.com/mhutchie/vscode-git-graph/runs/2211653232',
						status: 'completed',
						conclusion: 'success',
						name: 'build',
						app: { name: 'GitHub Actions' }
					}]
				}), GitHubHeader);
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'2211653232': {
							name: 'GitHub Actions(build)',
							status: 'success',
							ref: '',
							web_url: 'http://github.com/mhutchie/vscode-git-graph/runs/2211653232',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}]);
				expect(spyOnHttpGet).toHaveBeenCalledWith(GitHubHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(
					'/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224', 2211653232,
					{
						name: 'GitHub Actions(build)',
						status: 'success',
						ref: '',
						web_url: 'http://github.com/mhutchie/vscode-git-graph/runs/2211653232',
						event: '',
						detail: true,
						allow_failure: false
					});
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for http://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API - (200)http://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for http://github.com/keydepth/vscode-git-graph.git last_page=10(RateLimit=60(1 hour)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(4);
			});

			it('Should fetch a new cicd from GitHub (SSH Remote)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitHubV3,
							cicdUrl: 'git@github.com:keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD is not match URL (git@github.com:keydepth/vscode-git-graph.git) for GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(1);
			});

			it('Should fetch a new cicd from GitHub (HTTPS Remote) not detail', async () => {
				// Setup
				jest.useFakeTimers();
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(200, JSON.stringify({
					total_count: 324,
					workflow_runs: [
						{
							id: 740791415,
							name: 'Update Milestone on Release',
							head_branch: 'v1.31.0-beta.0',
							head_sha: 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
							event: 'release',
							status: 'completed',
							conclusion: 'success',
							url: 'https://api.github.com/repos/mhutchie/vscode-git-graph/actions/runs/740791415',
							html_url: 'https://github.com/mhutchie/vscode-git-graph/actions/runs/740791415',
							pull_requests: [],
							created_at: '2021-04-12T10:24:48Z',
							updated_at: '2021-04-12T10:25:06Z'
						}
					]
				}), Object.assign({}, GitHubHeader, {
					'link': '<https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel="next", <https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel="last"'
				}));
				mockHttpsResponse(200, GitHubResponse, Object.assign({}, GitHubHeader, {
					'link': '<https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel="next", <https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel="last"'
				}));
				const cicdEvents = waitForEvents(cicdManager, 2, true);
				cicdManager['queue']['queue'] = [{
					repo: '/path/to/repo1',
					cicdConfig: {
						provider: CICDProvider.GitHubV3,
						cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
						cicdToken: ''
					},
					page: -1,
					checkAfter: 0,
					attempts: 0,
					detail: false,
					hash: 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
					maximumStatuses: 1000
				}];

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'b9112e60f5fb3d8bc2a387840577b4756a12f357');
				cicdManager['queue']['itemsAvailableCallback']();

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'740791415': {
							name: 'Update Milestone on Release',
							status: 'success',
							ref: 'v1.31.0-beta.0',
							web_url: 'https://github.com/mhutchie/vscode-git-graph/actions/runs/740791415',
							event: 'release',
							detail: false,
							allow_failure: false
						}
					},
					'hash': 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
					'repo': '/path/to/repo1'
				}, GitHubCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'api.github.com',
					path: '/repos/keydepth/vscode-git-graph/actions/runs?per_page=100',
					headers: {
						'Accept': 'application/vnd.github.v3+json',
						'User-Agent': 'vscode-git-graph'
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(
					'/path/to/repo1', 'b9112e60f5fb3d8bc2a387840577b4756a12f357', 740791415,
					{
						name: 'Update Milestone on Release',
						status: 'success',
						ref: 'v1.31.0-beta.0',
						web_url: 'https://github.com/mhutchie/vscode-git-graph/actions/runs/740791415',
						event: 'release',
						detail: false,
						allow_failure: false
					});
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/actions/runs?per_page=100 detail=false page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenCalledWith('GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/actions/runs?per_page=100');
				expect(spyOnLog).toHaveBeenCalledWith('Added CICD for https://github.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=60(1 hour)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitHub');
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/b9112e60f5fb3d8bc2a387840577b4756a12f357/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenCalledWith('GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/commits/b9112e60f5fb3d8bc2a387840577b4756a12f357/check-runs?per_page=100');
				expect(spyOnLog).toHaveBeenCalledWith('Added CICD for https://github.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=60(1 hour)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(6);
				jest.useRealTimers();
			});

			it('Should fetch a new cicd from GitHub (HTTPS Remote) not detail with no conclusion', async () => {
				// Setup
				jest.useFakeTimers();
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(200, JSON.stringify({
					total_count: 324,
					workflow_runs: [
						{
							id: 740791415,
							name: 'Update Milestone on Release',
							head_branch: 'v1.31.0-beta.0',
							head_sha: 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
							event: 'release',
							status: 'pending',
							conclusion: null,
							url: 'https://api.github.com/repos/mhutchie/vscode-git-graph/actions/runs/740791415',
							html_url: 'https://github.com/mhutchie/vscode-git-graph/actions/runs/740791415',
							pull_requests: [],
							created_at: '2021-04-12T10:24:48Z',
							updated_at: '2021-04-12T10:25:06Z'
						}
					]
				}), Object.assign({}, GitHubHeader, {
					'link': '<https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel="next", <https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel="last"'
				}));
				mockHttpsResponse(200, JSON.stringify({
					total_count: 1,
					check_runs: [{
						id: 2211653232,
						head_sha: '149ecc50e5c223251f80a0223cfbbd9822307224',
						html_url: 'https://github.com/mhutchie/vscode-git-graph/runs/2211653232',
						status: 'pending',
						conclusion: null,
						name: 'build',
						app: { name: 'GitHub Actions' }
					}]
				}), Object.assign({}, GitHubHeader, {
					'link': '<https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel="next", <https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel="last"'
				}));
				const cicdEvents = waitForEvents(cicdManager, 2, true);
				cicdManager['queue']['queue'] = [{
					repo: '/path/to/repo1',
					cicdConfig: {
						provider: CICDProvider.GitHubV3,
						cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
						cicdToken: ''
					},
					page: -1,
					checkAfter: 0,
					attempts: 0,
					detail: false,
					hash: 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
					maximumStatuses: 1000
				}];

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'b9112e60f5fb3d8bc2a387840577b4756a12f357');
				cicdManager['queue']['itemsAvailableCallback']();

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'740791415': {
							name: 'Update Milestone on Release',
							status: 'pending',
							ref: 'v1.31.0-beta.0',
							web_url: 'https://github.com/mhutchie/vscode-git-graph/actions/runs/740791415',
							event: 'release',
							detail: false,
							allow_failure: false
						}
					},
					'hash': 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
					'repo': '/path/to/repo1'
				}, {
					'cicdDataSaves': {
						'2211653232': {
							name: 'GitHub Actions(build)',
							status: 'pending',
							ref: '',
							web_url: 'https://github.com/mhutchie/vscode-git-graph/runs/2211653232',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'api.github.com',
					path: '/repos/keydepth/vscode-git-graph/actions/runs?per_page=100',
					headers: {
						'Accept': 'application/vnd.github.v3+json',
						'User-Agent': 'vscode-git-graph'
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(
					'/path/to/repo1', 'b9112e60f5fb3d8bc2a387840577b4756a12f357', 740791415,
					{
						name: 'Update Milestone on Release',
						status: 'pending',
						ref: 'v1.31.0-beta.0',
						web_url: 'https://github.com/mhutchie/vscode-git-graph/actions/runs/740791415',
						event: 'release',
						detail: false,
						allow_failure: false
					});
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/actions/runs?per_page=100 detail=false page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenCalledWith('GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/actions/runs?per_page=100');
				expect(spyOnLog).toHaveBeenCalledWith('Added CICD for https://github.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=60(1 hour)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitHub');
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/b9112e60f5fb3d8bc2a387840577b4756a12f357/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenCalledWith('GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/commits/b9112e60f5fb3d8bc2a387840577b4756a12f357/check-runs?per_page=100');
				expect(spyOnLog).toHaveBeenCalledWith('Added CICD for https://github.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=60(1 hour)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(6);
				jest.useRealTimers();
			});

			it('Should fetch a new cicd from GitHub (HTTPS Remote) with ratelimit header', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(200, GitHubResponse, Object.assign({}, GitHubHeader, {
					'link': '<https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel="next", <https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel"last", <https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel=last',
					'x-ratelimit-limit': '',
					'x-ratelimit-remaining': '',
					'x-ratelimit-reset': ''
				}));
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([GitHubCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitHubHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...GitHubSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'Added CICD for https://github.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=None(1 hour)/Remaining=None) from GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(3);
			});

			it('Should fetch a new cicd from GitHub (HTTPS Remote) with link error header (number)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(200, GitHubResponse, Object.assign({}, GitHubHeader, {
					'link': 0
				}));
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([GitHubCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitHubHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...GitHubSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'Added CICD for https://github.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=60(1 hour)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(3);
			});

			it('Should fetch a new cicd from GitHub (HTTPS Remote) with link error header (string)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(200, GitHubResponse, Object.assign({}, GitHubHeader, {
					'link': ''
				}));
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([GitHubCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitHubHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...GitHubSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'Added CICD for https://github.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=60(1 hour)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(3);
			});

			it('Should fetch a new cicd from GitHub (HTTPS Remote) with link error header (page)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(200, GitHubResponse, Object.assign({}, GitHubHeader, {
					'link': '<https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=>; rel="next", <https://api.github.com/repositories/169864645/actions/runs?per_page=1&page=1>; rel="last"'
				}));
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([GitHubCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitHubHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...GitHubSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'Added CICD for https://github.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=60(1 hour)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(3);
			});

			it('Should fetch a new cicd from GitHub (HTTPS Remote) no emmit', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(200, GitHubResponse, GitHubHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenCalledTimes(4);
			});

			it('Should fetch a new cicd from GitHub (URL is Not Match)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitHubV3,
							cicdUrl: 'ftp://github.com/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD is not match URL (ftp://github.com/keydepth/vscode-git-graph.git) for GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(1);
			});

			it('Should fetch a new cicd from GitHub (Bad URL)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitHubV3,
							cicdUrl: 'github.com/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD is not match URL (github.com/keydepth/vscode-git-graph.git) for GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(1);
			});

			it('Should fetch a new multiple cicd from GitHub', async () => {
				// Setup
				jest.useFakeTimers();
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				for (let i = 0; i < 10; i++) {
					mockHttpsResponse(200, GitHubResponse, GitHubHeader);
				}
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([GitHubCicdEvents]);
				expect(cicdManager['queue']['queue'].length).toBe(9);
				expect(cicdManager['queue']['queue'][0].attempts).toBe(0);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitHubHttpsGet, expect.anything());
				jest.runAllTimers();
				for (let i = 1; i < 10; i++) {
					// jest.runOnlyPendingTimers();
					expect(spyOnLog).toHaveBeenNthCalledWith(3 + i * 2, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100&page=' + (i + 1) + ' detail=true page=' + (i + 1) + ' from GitHub');
					expect(spyOnLog).toHaveBeenNthCalledWith(4 + i * 2, 'GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100&page=' + (i + 1));
				}
				jest.useRealTimers();
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...GitHubSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for https://github.com/keydepth/vscode-git-graph.git last_page=10(RateLimit=60(1 hour)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitHub');
				expect(spyOnLog).toHaveBeenCalledTimes(22);
			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo', async () => {
				// Setup
				const cicdEvents = waitForEvents(cicdManager, 1);
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo': mockRepoState(null, 0, 'hash0', [{
						provider: CICDProvider.GitHubV3,
						cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
						cicdToken: ''
					}])
				});
				mockHttpsResponse(200, GitHubResponse, GitHubHeader);

				// Run
				let data = await cicdManager.getCICDDetail('/path/to/repo', 'hash0');

				// Assert
				expect.assertions(2);
				if (data) {
					expect(JSON.parse(data)).toStrictEqual({
						'id0': {
							name: 'string',
							status: 'string',
							ref: 'string',
							web_url: 'string',
							event: 'string',
							detail: true,
							allow_failure: false
						}
					});
				}
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'2211653232': {
							name: 'GitHub Actions(build)',
							status: 'success',
							ref: '',
							web_url: 'https://github.com/mhutchie/vscode-git-graph/runs/2211653232',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo'
				}]);
			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo with cicdToken', async () => {
				// Setup
				const cicdEvents = waitForEvents(cicdManager, 1);
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0, 'nonce', [{
						provider: CICDProvider.GitHubV3,
						cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
						cicdToken: 'aaaaaa'
					}])
				});
				mockHttpsResponse(200, GitHubResponse, GitHubHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash0');

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'2211653232': {
							name: 'GitHub Actions(build)',
							status: 'success',
							ref: '',
							web_url: 'https://github.com/mhutchie/vscode-git-graph/runs/2211653232',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'api.github.com',
					path: '/repos/keydepth/vscode-git-graph/commits/hash0/check-runs?per_page=100',
					headers: {
						'Accept': 'application/vnd.github.v3+json',
						'User-Agent': 'vscode-git-graph',
						'Authorization': 'token aaaaaa'
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo with responce is empty JSON', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo': mockRepoState(null, 0, 'hash0', [{
						provider: CICDProvider.GitHubV3,
						cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
						cicdToken: ''
					}])
				});
				mockHttpsResponse(200, JSON.stringify({}), GitHubHeader);

				// Run
				let data = await cicdManager.getCICDDetail('/path/to/repo', 'hash0');

				// Assert
				expect.assertions(1);
				if (data) {
					expect(JSON.parse(data)).toStrictEqual({
						'id0': {
							name: 'string',
							status: 'string',
							ref: 'string',
							web_url: 'string',
							event: 'string',
							detail: true,
							allow_failure: false
						}
					});
				}
			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo with responce is Not JSON format', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0, 'hash0', [{
						provider: CICDProvider.GitHubV3,
						cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
						cicdToken: ''
					}])
				});
				mockHttpsResponse(200, 'Not JSON format', GitHubHeader);

				// Run
				let data = await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect.assertions(5);
				expect(data).toStrictEqual(null);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API - (200)https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'GitHub API Error - (200)API Result error. : Unexpected token N in JSON at position 0');
				expect(spyOnLog).toHaveBeenCalledTimes(3);
			});

			it('Should halt fetching the cicd when the GitHub cicd url request is unsuccessful', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(404, '', GitHubHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitHubHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API Error - (404)undefined');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should halt fetching the cicd when the GitHub cicd url request is unsuccessful with Message Body', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(404, '{"message":"Error Message Body"}', GitHubHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitHubHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API Error - (404)Error Message Body');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should halt fetching the cicd when the GitHub cicd url request is unsuccessful with No Message Body', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(404, '{}', GitHubHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitHubHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API Error - (404)undefined');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should requeue the request when the GitHub API cannot find the commit', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(422, '', Object.assign({}, GitHubHeader, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': (date.now + 1).toString() }));

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['queue']['queue'].length).toBe(1);
					expect(cicdManager['queue']['queue'][0].attempts).toBe(1);
				});
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitHubV3
						},
						page: -1,
						checkAfter: 0,
						attempts: 1,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitHubHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API Rate Limit Reached - Paused fetching from GitHub until the Rate Limit is reset (RateLimit=60(1 hour)/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00))');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'GitHub API Rate Limit can upgrade by Access Token.');
				expect(spyOnLog).toHaveBeenCalledTimes(3);
			});

			it('Should set the GitHub API timeout and requeue the request when the rate limit is reached with cicdToken', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitHubV3,
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							cicdToken: 'aaaaaa'
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});
				mockHttpsResponse(403, '', Object.assign({}, GitHubHeader, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': (date.now + 1).toString() }));

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(spyOnLog).toHaveBeenCalledWith('GitHub API Rate Limit Reached - Paused fetching from GitHub until the Rate Limit is reset (RateLimit=60(1 hour)/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00))');
				});
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: 'aaaaaa',
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitHubV3
						},
						page: -1,
						checkAfter: (date.now + 1) * 1000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'api.github.com',
					path: '/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100',
					headers: {
						'Accept': 'application/vnd.github.v3+json',
						'User-Agent': 'vscode-git-graph',
						'Authorization': 'token aaaaaa'
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://api.github.com/repos/keydepth/vscode-git-graph/commits/149ecc50e5c223251f80a0223cfbbd9822307224/check-runs?per_page=100 detail=true page=-1 from GitHub');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitHub API Rate Limit Reached - Paused fetching from GitHub until the Rate Limit is reset (RateLimit=60(1 hour)/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00))');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
				expect(cicdManager['gitHubTimeout']).toBe((date.now + 1) * 1000);
			});

			it('Should set the GitHub API timeout and requeue the request when the API returns a 5xx error', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsResponse(500, '', GitHubHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['gitHubTimeout']).toBe(date.now * 1000 + 600000);
				});
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitHubV3
						},
						page: -1,
						checkAfter: date.now * 1000 + 600000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should set the GitHub API timeout and requeue the request when there is an HTTPS Client Request Error', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsClientRequestErrorEvent({ message: 'Error Message' });

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['gitHubTimeout']).toBe(date.now * 1000 + 300000);
				});
				expect(spyOnLog).toHaveBeenCalledWith('GitHub API https Error - Error Message');
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitHubV3
						},
						page: -1,
						checkAfter: date.now * 1000 + 300000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should set the GitHub API timeout and requeue the request when there is an HTTPS Client Request Error', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsClientRequestErrorEvent({ message: 'Error Message' });

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['gitHubTimeout']).toBe(date.now * 1000 + 300000);
				});
				expect(spyOnLog).toHaveBeenCalledWith('GitHub API https Error - Error Message');
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitHubV3
						},
						page: -1,
						checkAfter: date.now * 1000 + 300000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should set the GitHub API timeout and requeue the request when there is an HTTPS Incoming Message Error', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsIncomingMessageErrorEvent();

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['gitHubTimeout']).toBe(date.now * 1000 + 300000);
				});
				expect(spyOnLog).toHaveBeenCalledWith('GitHub API https Error - undefined');
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitHubV3
						},
						page: -1,
						checkAfter: date.now * 1000 + 300000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should set the GitHub API timeout and requeue the request once when there are multiple HTTPS Error Events', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				mockHttpsMultipleErrorEvents();

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['gitHubTimeout']).toBe(date.now * 1000 + 300000);
				});
				expect(spyOnLog).toHaveBeenCalledWith('GitHub API https Error - undefined');
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitHubV3
						},
						page: -1,
						checkAfter: date.now * 1000 + 300000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should requeue the request when it\'s before the GitHub API timeout', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitHubGetRspos);
				cicdManager['gitHubTimeout'] = (date.now + 1) * 1000;

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['queue']['queue']).toStrictEqual([
						{
							repo: '/path/to/repo1',
							cicdConfig: {
								cicdToken: '',
								cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
								provider: CICDProvider.GitHubV3
							},
							page: -1,
							checkAfter: (date.now + 1) * 1000,
							attempts: 0,
							detail: true,
							hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
							maximumStatuses: 1000
						}
					]);
				});
			});

			it('Should insert requests into the priority queue in the correct order', async () => {
				// Setup
				spyOnGetRepos.mockReturnValue({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitHubV3,
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}])
				});
				mockHttpsResponse(403, '', Object.assign({}, GitHubHeader, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': (date.now + 1).toString() }));

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash0');

				// Assert
				await waitForExpect(() => {
					expect(spyOnLog).toHaveBeenCalledWith('GitHub API Rate Limit Reached - Paused fetching from GitHub until the Rate Limit is reset (RateLimit=60(1 hour)/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00))');
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash1');
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash2');
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash2');
				cicdManager['queue']['add']('/path/to/repo1', {
					provider: CICDProvider.GitHubV3,
					cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
					cicdToken: ''
				}, -1, false, true, 'hash3');

				// Assert
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitHubV3
						},
						page: -1,
						checkAfter: 0,
						attempts: 0,
						detail: true,
						hash: 'hash1',
						maximumStatuses: 1000
					},
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitHubV3
						},
						page: -1,
						checkAfter: 0,
						attempts: 0,
						detail: true,
						hash: 'hash2',
						maximumStatuses: 1000
					},
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitHubV3
						},
						page: -1,
						checkAfter: (date.now + 1) * 1000,
						attempts: 0,
						detail: true,
						hash: 'hash0',
						maximumStatuses: 1000
					},
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://github.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitHubV3
						},
						page: -1,
						checkAfter: (date.now + 1) * 1000 + 1,
						attempts: 0,
						detail: true,
						hash: 'hash3',
						maximumStatuses: 1000
					}
				]);
			});

		});


		describe('GitLab', () => {
			it('Should fetch a new cicd from GitLab (HTTPS Remote)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(200, GitLabResponse, GitLabHeader);
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([GitLabCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...GitLabSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for https://gitlab.com/keydepth/vscode-git-graph.git last_page=10(RateLimit=60(every minute)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(4);
			});

			it('Should fetch a new cicd from GitLab (HTTPS Remote) with port', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitLabV4,
							cicdUrl: 'https://gitlab.com:80/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});
				mockHttpsResponse(200, GitLabResponse, GitLabHeader);
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([GitLabCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'gitlab.com',
					path: '/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100',
					headers: {
						'User-Agent': 'vscode-git-graph'
					},
					port: '80',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...GitLabSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for https://gitlab.com:80/keydepth/vscode-git-graph.git last_page=10(RateLimit=60(every minute)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(4);
			});

			it('Should fetch a new cicd from GitLab (HTTP Remote)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitLabV4,
							cicdUrl: 'http://gitlab.com/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});
				mockHttpResponse(200, JSON.stringify([
					{
						id: 2211653232,
						sha: '149ecc50e5c223251f80a0223cfbbd9822307224',
						ref: 'main',
						status: 'success',
						name: 'eslint-sast',
						target_url: 'http://gitlab.com/mhutchie/vscode-git-graph/runs/2211653232',
						allow_failure: false
					}
				]), GitLabHeader);
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'2211653232': {
							name: 'eslint-sast',
							status: 'success',
							ref: 'main',
							web_url: 'http://gitlab.com/mhutchie/vscode-git-graph/runs/2211653232',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}]);
				expect(spyOnHttpGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(
					'/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224', 2211653232,
					{
						name: 'eslint-sast',
						status: 'success',
						ref: 'main',
						web_url: 'http://gitlab.com/mhutchie/vscode-git-graph/runs/2211653232',
						event: '',
						detail: true,
						allow_failure: false
					});
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for http://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)http://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for http://gitlab.com/keydepth/vscode-git-graph.git last_page=10(RateLimit=60(every minute)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(4);
			});

			it('Should fetch a new cicd from GitLab (SSH Remote)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitLabV4,
							cicdUrl: 'git@gitlab.com:keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD is not match URL (git@gitlab.com:keydepth/vscode-git-graph.git) for GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(1);
			});

			it('Should fetch a new cicd from GitLab (HTTPS Remote) not detail', async () => {
				// Setup
				jest.useFakeTimers();
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(200, JSON.stringify([
					{
						id: 740791415,
						sha: 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
						ref: 'v1.31.0-beta.0',
						status: 'success',
						created_at: '2021-05-14T11:31:37.881Z',
						updated_at: '2021-05-14T11:35:45.904Z',
						web_url: 'https://gitlab.com/mhutchie/vscode-git-graph/actions/runs/740791415'
					}
				]), Object.assign({}, GitLabHeader, {
					'x-total': '1',
					'x-total-pages': '1'
				}));
				mockHttpsResponse(200, GitLabResponse, Object.assign({}, GitLabHeader, {
					'x-total': '1',
					'x-total-pages': '1'
				}));
				const cicdEvents = waitForEvents(cicdManager, 2, true);
				cicdManager['queue']['queue'] = [{
					repo: '/path/to/repo1',
					cicdConfig: {
						provider: CICDProvider.GitLabV4,
						cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
						cicdToken: ''
					},
					page: -1,
					checkAfter: 0,
					attempts: 0,
					detail: false,
					hash: 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
					maximumStatuses: 1000
				}];

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'b9112e60f5fb3d8bc2a387840577b4756a12f357');
				cicdManager['queue']['itemsAvailableCallback']();

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'740791415': {
							name: '',
							status: 'success',
							ref: 'v1.31.0-beta.0',
							web_url: 'https://gitlab.com/mhutchie/vscode-git-graph/actions/runs/740791415',
							event: '',
							detail: false,
							allow_failure: false
						}
					},
					'hash': 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
					'repo': '/path/to/repo1'
				}, GitLabCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'gitlab.com',
					path: '/api/v4/projects/keydepth%2Fvscode-git-graph/pipelines?per_page=100',
					headers: {
						'User-Agent': 'vscode-git-graph'
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(
					'/path/to/repo1', 'b9112e60f5fb3d8bc2a387840577b4756a12f357', 740791415,
					{
						name: '',
						status: 'success',
						ref: 'v1.31.0-beta.0',
						web_url: 'https://gitlab.com/mhutchie/vscode-git-graph/actions/runs/740791415',
						event: '',
						detail: false,
						allow_failure: false
					});
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/pipelines?per_page=100 detail=false page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenCalledWith('GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/pipelines?per_page=100');
				expect(spyOnLog).toHaveBeenCalledWith('Added CICD for https://gitlab.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=60(every minute)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitLab');
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/b9112e60f5fb3d8bc2a387840577b4756a12f357/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenCalledWith('GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/b9112e60f5fb3d8bc2a387840577b4756a12f357/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenCalledWith('Added CICD for https://gitlab.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=60(every minute)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(6);
				jest.useRealTimers();
			});

			it('Should fetch a new cicd from GitLab (HTTPS Remote) not detail with no conclusion', async () => {
				// Setup
				jest.useFakeTimers();
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(200, JSON.stringify([
					{
						id: 740791415,
						sha: 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
						ref: 'v1.31.0-beta.0',
						status: 'pending',
						created_at: '2021-05-14T11:31:37.881Z',
						updated_at: '2021-05-14T11:35:45.904Z',
						web_url: 'https://gitlab.com/mhutchie/vscode-git-graph/actions/runs/740791415'
					}
				]), Object.assign({}, GitLabHeader, {
					'x-total': '1',
					'x-total-pages': '1'
				}));
				mockHttpsResponse(200, JSON.stringify([
					{
						id: 2211653232,
						sha: '149ecc50e5c223251f80a0223cfbbd9822307224',
						ref: 'main',
						status: 'pending',
						name: 'eslint-sast',
						target_url: 'https://gitlab.com/mhutchie/vscode-git-graph/runs/2211653232',
						allow_failure: false
					}
				]), Object.assign({}, GitLabHeader, {
					'x-total': '1',
					'x-total-pages': '1'
				}));
				const cicdEvents = waitForEvents(cicdManager, 2, true);
				cicdManager['queue']['queue'] = [{
					repo: '/path/to/repo1',
					cicdConfig: {
						provider: CICDProvider.GitLabV4,
						cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
						cicdToken: ''
					},
					page: -1,
					checkAfter: 0,
					attempts: 0,
					detail: false,
					hash: 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
					maximumStatuses: 1000
				}];

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'b9112e60f5fb3d8bc2a387840577b4756a12f357');
				cicdManager['queue']['itemsAvailableCallback']();

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'740791415': {
							name: '',
							status: 'pending',
							ref: 'v1.31.0-beta.0',
							web_url: 'https://gitlab.com/mhutchie/vscode-git-graph/actions/runs/740791415',
							event: '',
							detail: false,
							allow_failure: false
						}
					},
					'hash': 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
					'repo': '/path/to/repo1'
				}, {
					'cicdDataSaves': {
						'2211653232': {
							name: 'eslint-sast',
							status: 'pending',
							ref: 'main',
							web_url: 'https://gitlab.com/mhutchie/vscode-git-graph/runs/2211653232',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'gitlab.com',
					path: '/api/v4/projects/keydepth%2Fvscode-git-graph/pipelines?per_page=100',
					headers: {
						'User-Agent': 'vscode-git-graph'
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(
					'/path/to/repo1', 'b9112e60f5fb3d8bc2a387840577b4756a12f357', 740791415,
					{
						name: '',
						status: 'pending',
						ref: 'v1.31.0-beta.0',
						web_url: 'https://gitlab.com/mhutchie/vscode-git-graph/actions/runs/740791415',
						event: '',
						detail: false,
						allow_failure: false
					});
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/pipelines?per_page=100 detail=false page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenCalledWith('GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/pipelines?per_page=100');
				expect(spyOnLog).toHaveBeenCalledWith('Added CICD for https://gitlab.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=60(every minute)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitLab');
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/b9112e60f5fb3d8bc2a387840577b4756a12f357/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenCalledWith('GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/b9112e60f5fb3d8bc2a387840577b4756a12f357/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenCalledWith('Added CICD for https://gitlab.com/keydepth/vscode-git-graph.git last_page=1(RateLimit=60(every minute)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(6);
				jest.useRealTimers();
			});

			it('Should fetch a new cicd from GitLab (HTTPS Remote) with ratelimit header', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(200, GitLabResponse, Object.assign({}, GitLabHeader, {
					'ratelimit-limit': '',
					'ratelimit-remaining': '',
					'ratelimit-reset': ''
				}));
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([GitLabCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...GitLabSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for https://gitlab.com/keydepth/vscode-git-graph.git last_page=10(RateLimit=None(every minute)/Remaining=None) from GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(4);
			});

			it('Should fetch a new cicd from GitLab (HTTPS Remote) with x-page error header (number)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(200, GitLabResponse, Object.assign({}, GitLabHeader, {
					'x-page': 1
				}));

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should fetch a new cicd from GitLab (HTTPS Remote) with x-total-pages error header (number)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(200, GitLabResponse, Object.assign({}, GitLabHeader, {
					'x-total-pages': 1
				}));

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should fetch a new cicd from GitLab (HTTPS Remote) with x-total error header (number)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(200, GitLabResponse, Object.assign({}, GitLabHeader, {
					'x-total': 1
				}));

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should fetch a new cicd from GitLab (HTTPS Remote) no emmit', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(200, GitLabResponse, GitLabHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenCalledTimes(4);
			});

			it('Should fetch a new cicd from GitLab (URL is Not Match)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitLabV4,
							cicdUrl: 'ftp://gitlab.com/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD is not match URL (ftp://gitlab.com/keydepth/vscode-git-graph.git) for GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(1);
			});

			it('Should fetch a new cicd from GitLab (Bad URL)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitLabV4,
							cicdUrl: 'gitlab.com/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD is not match URL (gitlab.com/keydepth/vscode-git-graph.git) for GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(1);
			});

			it('Should fetch a new cicd from GitLab (No target_url)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(200, JSON.stringify([
					{
						id: 2211653232,
						sha: '149ecc50e5c223251f80a0223cfbbd9822307224',
						ref: 'main',
						status: 'success',
						name: 'eslint-sast',
						allow_failure: false
					}
				]), GitLabHeader);
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'2211653232': {
							name: 'eslint-sast',
							status: 'success',
							ref: 'main',
							web_url: 'https://gitlab.com/keydepth/vscode-git-graph/-/jobs/2211653232',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(
					'/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224', 2211653232,
					{
						name: 'eslint-sast',
						status: 'success',
						ref: 'main',
						web_url: 'https://gitlab.com/keydepth/vscode-git-graph/-/jobs/2211653232',
						event: '',
						detail: true,
						allow_failure: false
					});
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for https://gitlab.com/keydepth/vscode-git-graph.git last_page=10(RateLimit=60(every minute)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(4);
			});

			it('Should fetch a new multiple cicd from GitLab', async () => {
				// Setup
				jest.useFakeTimers();
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				for (let i = 0; i < 10; i++) {
					mockHttpsResponse(200, GitLabResponse, GitLabHeader);
				}
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([GitLabCicdEvents]);
				expect(cicdManager['queue']['queue'].length).toBe(9);
				expect(cicdManager['queue']['queue'][0].attempts).toBe(0);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				jest.runAllTimers();
				for (let i = 1; i < 10; i++) {
					// jest.runOnlyPendingTimers();
					expect(spyOnLog).toHaveBeenNthCalledWith(3 + i * 2, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100&page=' + (i + 1) + ' detail=true page=' + (i + 1) + ' from GitLab');
					expect(spyOnLog).toHaveBeenNthCalledWith(4 + i * 2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100&page=' + (i + 1));
				}
				jest.useRealTimers();
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...GitLabSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for https://gitlab.com/keydepth/vscode-git-graph.git last_page=10(RateLimit=60(every minute)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(22);
			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo', async () => {
				// Setup
				const cicdEvents = waitForEvents(cicdManager, 1);
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo': mockRepoState(null, 0, 'hash0', [{
						provider: CICDProvider.GitLabV4,
						cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
						cicdToken: ''
					}])
				});
				mockHttpsResponse(200, GitLabResponse, GitLabHeader);

				// Run
				let data = await cicdManager.getCICDDetail('/path/to/repo', 'hash0');

				// Assert
				expect.assertions(2);
				if (data) {
					expect(JSON.parse(data)).toStrictEqual({
						'id0': {
							name: 'string',
							status: 'string',
							ref: 'string',
							web_url: 'string',
							event: 'string',
							detail: true,
							allow_failure: false
						}
					});
				}
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'2211653232': {
							name: 'eslint-sast',
							status: 'success',
							ref: 'main',
							web_url: 'https://gitlab.com/mhutchie/vscode-git-graph/runs/2211653232',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo'
				}]);
			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo with cicdToken', async () => {
				// Setup
				const cicdEvents = waitForEvents(cicdManager, 1);
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0, 'nonce', [{
						provider: CICDProvider.GitLabV4,
						cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
						cicdToken: 'aaaaaa'
					}])
				});
				mockHttpsResponse(200, GitLabResponse, GitLabHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash0');

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'2211653232': {
							name: 'eslint-sast',
							status: 'success',
							ref: 'main',
							web_url: 'https://gitlab.com/mhutchie/vscode-git-graph/runs/2211653232',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'gitlab.com',
					path: '/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/hash0/statuses?per_page=100',
					headers: {
						'User-Agent': 'vscode-git-graph',
						'PRIVATE-TOKEN': 'aaaaaa'
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo with responce is empty JSON', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo': mockRepoState(null, 0, 'hash0', [{
						provider: CICDProvider.GitLabV4,
						cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
						cicdToken: ''
					}])
				});
				mockHttpsResponse(200, JSON.stringify({}), GitLabHeader);

				// Run
				let data = await cicdManager.getCICDDetail('/path/to/repo', 'hash0');

				// Assert
				expect.assertions(1);
				if (data) {
					expect(JSON.parse(data)).toStrictEqual({
						'id0': {
							name: 'string',
							status: 'string',
							ref: 'string',
							web_url: 'string',
							event: 'string',
							detail: true,
							allow_failure: false
						}
					});
				}
			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo with responce is Not JSON format', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0, 'hash0', [{
						provider: CICDProvider.GitLabV4,
						cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
						cicdToken: ''
					}])
				});
				mockHttpsResponse(200, 'Not JSON format', GitLabHeader);

				// Run
				let data = await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect.assertions(5);
				expect(data).toStrictEqual(null);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'GitLab API Error - (200)API Result error. : Unexpected token N in JSON at position 0');
				expect(spyOnLog).toHaveBeenCalledTimes(3);
			});

			it('Should halt fetching the cicd when a known cicd is requested repo with responce is No id JSON format', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(200, JSON.stringify([
					{
						sha: '149ecc50e5c223251f80a0223cfbbd9822307224',
						ref: 'main',
						status: 'success',
						name: 'eslint-sast',
						target_url: 'https://gitlab.com/mhutchie/vscode-git-graph/runs/2211653232',
						allow_failure: false
					}
				]), GitLabHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for https://gitlab.com/keydepth/vscode-git-graph.git last_page=10(RateLimit=60(every minute)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(4);
			});

			it('Should halt fetching the cicd when the GitLab cicd url request is unsuccessful with Message Body', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(404, '{"message":"Error Message Body"}', GitLabHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API Error - (404)Error Message Body');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should halt fetching the cicd when the GitLab cicd url request is unsuccessful with No Message Body', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(404, '{}', GitLabHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API Error - (404)undefined');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should requeue the request when the GitLab API cannot find the commit', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(200, JSON.stringify([]), GitLabHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(GitLabHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API - (200)https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'CICD Maximum Statuses(maximumStatuses=1000) reached, if you want to change Maximum page, please configure git-graph.repository.commits.fetchCICDsMaximumStatuses');
				expect(spyOnLog).toHaveBeenNthCalledWith(4, 'Added CICD for https://gitlab.com/keydepth/vscode-git-graph.git last_page=10(RateLimit=60(every minute)/Remaining=57/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00)) from GitLab');
				expect(spyOnLog).toHaveBeenCalledTimes(4);

			});

			it('Should set the GitLab API timeout and requeue the request when the rate limit is reached with cicdToken', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitLabV4,
							cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
							cicdToken: 'aaaaaa'
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});
				mockHttpsResponse(429, '', Object.assign({}, GitLabHeader, { 'ratelimit-remaining': '0', 'ratelimit-reset': (date.now + 1).toString() }));

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(spyOnLog).toHaveBeenCalledWith('GitLab API Rate Limit Reached - Paused fetching from GitLab until the Rate Limit is reset (RateLimit=60(every minute)/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00))');
				});
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						attempts: 0,
						checkAfter: 1587559259000,
						cicdConfig: {
							cicdToken: 'aaaaaa',
							cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitLabV4
						},
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000,
						page: -1,
						repo: '/path/to/repo1'
					}
				]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'gitlab.com',
					path: '/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100',
					headers: {
						'User-Agent': 'vscode-git-graph',
						'PRIVATE-TOKEN': 'aaaaaa'
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://gitlab.com/api/v4/projects/keydepth%2Fvscode-git-graph/repository/commits/149ecc50e5c223251f80a0223cfbbd9822307224/statuses?per_page=100 detail=true page=-1 from GitLab');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'GitLab API Rate Limit Reached - Paused fetching from GitLab until the Rate Limit is reset (RateLimit=60(every minute)/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00))');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
				expect(cicdManager['gitLabTimeout']).toBe((date.now + 1) * 1000);
			});

			it('Should set the GitLab API timeout and requeue the request when the API returns a 5xx error', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsResponse(500, '', GitLabHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['gitLabTimeout']).toBe(date.now * 1000 + 600000);
				});
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitLabV4
						},
						page: -1,
						checkAfter: date.now * 1000 + 600000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should set the GitLab API timeout and requeue the request when there is an HTTPS Client Request Error', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsClientRequestErrorEvent({ message: 'Error Message' });

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['gitLabTimeout']).toBe(date.now * 1000 + 300000);
				});
				expect(spyOnLog).toHaveBeenCalledWith('GitLab API https Error - Error Message');
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitLabV4
						},
						page: -1,
						checkAfter: date.now * 1000 + 300000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should set the GitLab API timeout and requeue the request when there is an HTTPS Incoming Message Error', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsIncomingMessageErrorEvent();

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['gitLabTimeout']).toBe(date.now * 1000 + 300000);
				});
				expect(spyOnLog).toHaveBeenCalledWith('GitLab API https Error - undefined');
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitLabV4
						},
						page: -1,
						checkAfter: date.now * 1000 + 300000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should set the GitLab API timeout and requeue the request once when there are multiple HTTPS Error Events', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				mockHttpsMultipleErrorEvents();

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['gitLabTimeout']).toBe(date.now * 1000 + 300000);
				});
				expect(spyOnLog).toHaveBeenCalledWith('GitLab API https Error - undefined');
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitLabV4
						},
						page: -1,
						checkAfter: date.now * 1000 + 300000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should requeue the request when it\'s before the GitLab API timeout', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(GitLabGetRspos);
				cicdManager['gitLabTimeout'] = (date.now + 1) * 1000;

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['queue']['queue']).toStrictEqual([
						{
							repo: '/path/to/repo1',
							cicdConfig: {
								cicdToken: '',
								cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
								provider: CICDProvider.GitLabV4
							},
							page: -1,
							checkAfter: (date.now + 1) * 1000,
							attempts: 0,
							detail: true,
							hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
							maximumStatuses: 1000
						}
					]);
				});
			});

			it('Should insert requests into the priority queue in the correct order', async () => {
				// Setup
				spyOnGetRepos.mockReturnValue({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.GitLabV4,
							cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}])
				});
				mockHttpsResponse(403, '', Object.assign({}, GitLabHeader, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': (date.now + 1).toString() }));

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash0');

				// Assert
				await waitForExpect(() => {
					expect(spyOnLog).toHaveBeenCalledWith('GitLab API Error - (403)undefined');
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash1');
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash2');
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash2');
				cicdManager['queue']['add']('/path/to/repo1', {
					provider: CICDProvider.GitLabV4,
					cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
					cicdToken: ''
				}, -1, false, true, 'hash3');

				// Assert
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitLabV4
						},
						page: -1,
						checkAfter: 0,
						attempts: 0,
						detail: true,
						hash: 'hash1',
						maximumStatuses: 1000
					},
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitLabV4
						},
						page: -1,
						checkAfter: 0,
						attempts: 0,
						detail: true,
						hash: 'hash2',
						maximumStatuses: 1000
					},
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://gitlab.com/keydepth/vscode-git-graph.git',
							provider: CICDProvider.GitLabV4
						},
						page: -1,
						checkAfter: 1,
						attempts: 0,
						detail: true,
						hash: 'hash3',
						maximumStatuses: 1000
					}
				]);
			});
		});



		describe('Jenkins', () => {
			it('Should fetch a new cicd from Jenkins (HTTPS Remote)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(200, JenkinsResponse, JenkinsHeader);
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([JenkinsCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(JenkinsHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...JenkinsSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should fetch a new cicd from Jenkins (HTTPS Remote) with port', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.JenkinsV2,
							cicdUrl: 'https://jenkins.net:80/job/job01/job/MultiBranch/job/master/3/',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});
				mockHttpsResponse(200, JenkinsResponse, JenkinsHeader);
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([JenkinsCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'jenkins.net',
					path: '/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]',
					headers: {
						'User-Agent': 'vscode-git-graph'
					},
					port: '80',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(...JenkinsSaveCicd);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should fetch a new cicd from Jenkins (HTTP Remote)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.JenkinsV2,
							cicdUrl: 'http://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});
				mockHttpResponse(200, JSON.stringify(
					{
						_class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
						builds: [
							{
								_class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
								actions: [
									{
										_class: 'hudson.plugins.git.util.BuildData',
										lastBuiltRevision: {
											branch: [
												{
													SHA1: '149ecc50e5c223251f80a0223cfbbd9822307224',
													name: 'master'
												}
											]
										}
									}
								],
								fullDisplayName: 'job01 » MultiBranch » master #3',
								id: '3',
								result: 'SUCCESS',
								timestamp: 1620716982997,
								url: 'http://jenkins.net/job/job01/job/MultiBranch/job/master/3/'
							}
						]
					}
				), JenkinsHeader);
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'3': {
							name: 'job01 » MultiBranch » master #3',
							status: 'SUCCESS',
							ref: 'master',
							web_url: 'http://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}]);
				expect(spyOnHttpGet).toHaveBeenCalledWith(JenkinsHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(
					'/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224', '3',
					{
						name: 'job01 » MultiBranch » master #3',
						status: 'SUCCESS',
						ref: 'master',
						web_url: 'http://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
						event: '',
						detail: true,
						allow_failure: false
					});
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for http://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API - (200)http://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should fetch a new cicd from Jenkins (SSH Remote)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.JenkinsV2,
							cicdUrl: 'git@jenkins.net:keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD is not match URL (git@jenkins.net:keydepth/vscode-git-graph.git) for Jenkins');
				expect(spyOnLog).toHaveBeenCalledTimes(1);
			});

			it('Should fetch a new cicd from Jenkins (HTTPS Remote) not detail', async () => {
				// Setup
				jest.useFakeTimers();
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(200, JSON.stringify(
					{
						_class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
						builds: [
							{
								_class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
								actions: [
									{
										_class: 'hudson.plugins.git.util.BuildData',
										lastBuiltRevision: {
											branch: [
												{
													SHA1: 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
													name: 'master'
												}
											]
										}
									}
								],
								fullDisplayName: 'job01 » MultiBranch » master #3',
								id: '3',
								result: 'SUCCESS',
								timestamp: 1620716982997,
								url: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/'
							}
						]
					}
				), Object.assign({}, JenkinsHeader, {
					'x-total': '1',
					'x-total-pages': '1'
				}));
				mockHttpsResponse(200, JenkinsResponse, Object.assign({}, JenkinsHeader, {
					'x-total': '1',
					'x-total-pages': '1'
				}));
				const cicdEvents = waitForEvents(cicdManager, 2, true);
				cicdManager['queue']['queue'] = [{
					repo: '/path/to/repo1',
					cicdConfig: {
						provider: CICDProvider.JenkinsV2,
						cicdUrl: 'https://jenkins.net/job/job02/job/MultiBranch/job/master/3/',
						cicdToken: ''
					},
					page: -1,
					checkAfter: 0,
					attempts: 0,
					detail: false,
					hash: 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
					maximumStatuses: 1000
				}];

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'b9112e60f5fb3d8bc2a387840577b4756a12f357');
				cicdManager['queue']['itemsAvailableCallback']();

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'3': {
							name: 'job01 » MultiBranch » master #3',
							status: 'SUCCESS',
							ref: 'master',
							web_url: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							event: '',
							detail: false,
							allow_failure: false
						}
					},
					'hash': 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
					'repo': '/path/to/repo1'
				}, JenkinsCicdEvents]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'jenkins.net',
					path: '/job/job02/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]',
					headers: {
						'User-Agent': 'vscode-git-graph'
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(
					'/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224', '3',
					{
						name: 'job01 » MultiBranch » master #3',
						status: 'SUCCESS',
						ref: 'master',
						web_url: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
						event: '',
						detail: true,
						allow_failure: false
					});
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenCalledWith('Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenCalledWith('Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenCalledTimes(4);
				jest.useRealTimers();
			});

			it('Should fetch a new cicd from Jenkins (HTTPS Remote) not detail with no conclusion', async () => {
				// Setup
				jest.useFakeTimers();
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(200, JSON.stringify(
					{
						_class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
						builds: [
							{
								_class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
								actions: [
									{
										_class: 'hudson.plugins.git.util.BuildData',
										lastBuiltRevision: {
											branch: [
												{
													SHA1: '149ecc50e5c223251f80a0223cfbbd9822307224',
													name: 'master'
												}
											]
										}
									}
								],
								fullDisplayName: 'job02 » MultiBranch » master #23',
								id: '23',
								result: 'pending',
								timestamp: 1620716982997,
								url: 'https://jenkins.net/job/job02/job/MultiBranch/job/master/23/'
							}
						]
					}
				), Object.assign({}, JenkinsHeader, {
					'x-total': '1',
					'x-total-pages': '1'
				}));
				mockHttpsResponse(200, JenkinsResponse, Object.assign({}, JenkinsHeader, {
					'x-total': '1',
					'x-total-pages': '1'
				}));
				const cicdEvents = waitForEvents(cicdManager, 2, true);
				cicdManager['queue']['queue'] = [{
					repo: '/path/to/repo1',
					cicdConfig: {
						provider: CICDProvider.JenkinsV2,
						cicdUrl: 'https://jenkins.net/job/job02/job/MultiBranch/job/master/23/',
						cicdToken: ''
					},
					page: -1,
					checkAfter: 0,
					attempts: 0,
					detail: false,
					hash: 'b9112e60f5fb3d8bc2a387840577b4756a12f357',
					maximumStatuses: 1000
				}];

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'b9112e60f5fb3d8bc2a387840577b4756a12f357');
				cicdManager['queue']['itemsAvailableCallback']();

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'23': {
							name: 'job02 » MultiBranch » master #23',
							status: 'pending',
							ref: 'master',
							web_url: 'https://jenkins.net/job/job02/job/MultiBranch/job/master/23/',
							event: '',
							detail: false,
							allow_failure: false
						},
						'3': {
							name: 'job01 » MultiBranch » master #3',
							status: 'SUCCESS',
							ref: 'master',
							web_url: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}, {
					'cicdDataSaves': {
						'23': {
							name: 'job02 » MultiBranch » master #23',
							status: 'pending',
							ref: 'master',
							web_url: 'https://jenkins.net/job/job02/job/MultiBranch/job/master/23/',
							event: '',
							detail: false,
							allow_failure: false
						},
						'3': {
							name: 'job01 » MultiBranch » master #3',
							status: 'SUCCESS',
							ref: 'master',
							web_url: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'jenkins.net',
					path: '/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]',
					headers: {
						'User-Agent': 'vscode-git-graph'
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(
					'/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224', '23',
					{
						name: 'job02 » MultiBranch » master #23',
						status: 'pending',
						ref: 'master',
						web_url: 'https://jenkins.net/job/job02/job/MultiBranch/job/master/23/',
						event: '',
						detail: false,
						allow_failure: false
					});
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenCalledWith('Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenCalledWith('Requesting CICD for https://jenkins.net/job/job02/job/MultiBranch/job/master/23/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenCalledWith('Jenkins API - (200)https://jenkins.net/job/job02/job/MultiBranch/job/master/23/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenCalledTimes(4);
				jest.useRealTimers();
			});

			it('Should fetch a new cicd from Jenkins (HTTPS Remote) with x-jenkins error header (number)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(200, JenkinsResponse, Object.assign({}, JenkinsHeader, {
					'x-jenkins': '1.1.1'
				}));

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(JenkinsHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should fetch a new cicd from Jenkins (HTTPS Remote) with builds format error header (number)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(200, JSON.stringify(
					{
						_class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
						builds: {}
					}
				), JenkinsHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(JenkinsHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should fetch a new cicd from Jenkins (HTTPS Remote) with lastBuiltRevision format error header (number)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(200, JSON.stringify(
					{
						_class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
						builds: [
							{
								_class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
								actions: [
									{
										_class: 'hudson.plugins.git.util.BuildData'
									}
								],
								fullDisplayName: 'job01 » MultiBranch » master #3',
								id: '3',
								result: 'SUCCESS',
								timestamp: 1620716982997,
								url: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/'
							}
						]
					}
				), JenkinsHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(JenkinsHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should fetch a new cicd from Jenkins (HTTPS Remote) no emmit', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(200, JenkinsResponse, JenkinsHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should fetch a new cicd from Jenkins (URL is Not Match)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.JenkinsV2,
							cicdUrl: 'ftp://jenkins.net/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD is not match URL (ftp://jenkins.net/keydepth/vscode-git-graph.git) for Jenkins');
				expect(spyOnLog).toHaveBeenCalledTimes(1);
			});

			it('Should fetch a new cicd from Jenkins (Bad URL)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.JenkinsV2,
							cicdUrl: 'jenkins.net/keydepth/vscode-git-graph.git',
							cicdToken: ''
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD is not match URL (jenkins.net/keydepth/vscode-git-graph.git) for Jenkins');
				expect(spyOnLog).toHaveBeenCalledTimes(1);
			});

			it('Should fetch a new cicd from Jenkins (No url)', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(200, JSON.stringify(
					{
						_class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob',
						builds: [
							{
								_class: 'org.jenkinsci.plugins.workflow.job.WorkflowRun',
								actions: [
									{
										_class: 'hudson.plugins.git.util.BuildData',
										lastBuiltRevision: {
											branch: [
												{
													SHA1: '149ecc50e5c223251f80a0223cfbbd9822307224',
													name: 'master'
												}
											]
										}
									}
								],
								fullDisplayName: 'job01 » MultiBranch » master #3',
								id: '3',
								result: 'SUCCESS',
								timestamp: 1620716982997
							}
						]
					}
				), JenkinsHeader);
				const cicdEvents = waitForEvents(cicdManager, 1);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'3': {
							name: 'job01 » MultiBranch » master #3',
							status: 'SUCCESS',
							ref: 'master',
							web_url: '',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith(JenkinsHttpsGet, expect.anything());
				expect(spyOnSaveCicd).toHaveBeenCalledWith(
					'/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224', '3',
					{
						name: 'job01 » MultiBranch » master #3',
						status: 'SUCCESS',
						ref: 'master',
						web_url: '',
						event: '',
						detail: true,
						allow_failure: false
					});
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo', async () => {
				// Setup
				const cicdEvents = waitForEvents(cicdManager, 1);
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo': mockRepoState(null, 0, 'hash0', [{
						provider: CICDProvider.JenkinsV2,
						cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
						cicdToken: ''
					}])
				});
				mockHttpsResponse(200, JenkinsResponse, JenkinsHeader);

				// Run
				let data = await cicdManager.getCICDDetail('/path/to/repo', 'hash0');

				// Assert
				expect.assertions(2);
				if (data) {
					expect(JSON.parse(data)).toStrictEqual({
						'id0': {
							name: 'string',
							status: 'string',
							ref: 'string',
							web_url: 'string',
							event: 'string',
							detail: true,
							allow_failure: false
						}
					});
				}
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'3': {
							name: 'job01 » MultiBranch » master #3',
							status: 'SUCCESS',
							ref: 'master',
							web_url: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo'
				}]);
			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo with cicdToken', async () => {
				// Setup
				const cicdEvents = waitForEvents(cicdManager, 1);
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0, 'nonce', [{
						provider: CICDProvider.JenkinsV2,
						cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
						cicdToken: 'user:aaaaaa'
					}])
				});
				mockHttpsResponse(200, JenkinsResponse, JenkinsHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash0');

				// Assert
				expect(await cicdEvents).toStrictEqual([{
					'cicdDataSaves': {
						'3': {
							name: 'job01 » MultiBranch » master #3',
							status: 'SUCCESS',
							ref: 'master',
							web_url: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							event: '',
							detail: true,
							allow_failure: false
						}
					},
					'hash': '149ecc50e5c223251f80a0223cfbbd9822307224',
					'repo': '/path/to/repo1'
				}]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'jenkins.net',
					path: '/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]',
					headers: {
						'User-Agent': 'vscode-git-graph',
						'Authorization': 'Basic ' + new Buffer('user:aaaaaa').toString('base64')
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo with responce is empty JSON', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo': mockRepoState(null, 0, 'hash0', [{
						provider: CICDProvider.JenkinsV2,
						cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
						cicdToken: ''
					}])
				});
				mockHttpsResponse(200, JSON.stringify({}), JenkinsHeader);

				// Run
				let data = await cicdManager.getCICDDetail('/path/to/repo', 'hash0');

				// Assert
				expect.assertions(5);
				if (data) {
					expect(JSON.parse(data)).toStrictEqual({
						'id0': {
							name: 'string',
							status: 'string',
							ref: 'string',
							web_url: 'string',
							event: 'string',
							detail: true,
							allow_failure: false
						}
					});
				}
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'Jenkins API Error - (200)API Result error. : Cannot read property \'length\' of undefined');
				expect(spyOnLog).toHaveBeenCalledTimes(3);

			});

			it('Should trigger the cicd to be emitted when a known cicd is requested repo with responce is Not JSON format', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0, 'hash0', [{
						provider: CICDProvider.JenkinsV2,
						cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
						cicdToken: ''
					}])
				});
				mockHttpsResponse(200, 'Not JSON format', JenkinsHeader);

				// Run
				let data = await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect.assertions(5);
				expect(data).toStrictEqual(null);
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'Jenkins API Error - (200)API Result error. : Unexpected token N in JSON at position 0');
				expect(spyOnLog).toHaveBeenCalledTimes(3);
			});

			it('Should halt fetching the cicd when a known cicd is requested repo with responce is No id JSON format', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(200, JSON.stringify([
					{
						sha: '149ecc50e5c223251f80a0223cfbbd9822307224',
						ref: 'main',
						status: 'success',
						name: 'eslint-sast',
						target_url: 'https://jenkins.net/mhutchie/vscode-git-graph/runs/2211653232',
						allow_failure: false
					}
				]), JenkinsHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(JenkinsHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'Jenkins API Error - (200)API Result error. : Cannot read property \'length\' of undefined');
				expect(spyOnLog).toHaveBeenCalledTimes(3);
			});

			it('Should halt fetching the cicd when the Jenkins cicd url request is unsuccessful with Message Body', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(404, '{"message":"Error Message Body"}', JenkinsHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(JenkinsHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API Error - (404)Error Message Body');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should halt fetching the cicd when the Jenkins cicd url request is unsuccessful with No Message Body', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(404, '{}', JenkinsHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(JenkinsHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API Error - (404)undefined');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
			});

			it('Should requeue the request when the Jenkins API cannot find the commit', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(200, JSON.stringify([]), JenkinsHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				expect(spyOnHttpsGet).toHaveBeenCalledWith(JenkinsHttpsGet, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API - (200)https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]');
				expect(spyOnLog).toHaveBeenNthCalledWith(3, 'Jenkins API Error - (200)API Result error. : Cannot read property \'length\' of undefined');
				expect(spyOnLog).toHaveBeenCalledTimes(3);

			});

			it('Should set the Jenkins API timeout and requeue the request when the rate limit is reached with cicdToken', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.JenkinsV2,
							cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							cicdToken: 'user:aaaaaa'
						}]),
					'/path/to/repo2': mockRepoState('Custom Name', 0, null, null)
				});
				mockHttpsResponse(429, '', Object.assign({}, JenkinsHeader, { 'ratelimit-remaining': '0', 'ratelimit-reset': (date.now + 1).toString() }));

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(spyOnLog).toHaveBeenCalledWith('Jenkins API Rate Limit Reached - Paused fetching from Jenkins until the Rate Limit is reset (RateLimit=undefined(every minute)/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00))');
				});
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						attempts: 0,
						checkAfter: 1587559259000,
						cicdConfig: {
							cicdToken: 'user:aaaaaa',
							cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							provider: CICDProvider.JenkinsV2
						},
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000,
						page: -1,
						repo: '/path/to/repo1'
					}
				]);
				expect(spyOnHttpsGet).toHaveBeenCalledWith({
					hostname: 'jenkins.net',
					path: '/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]]',
					headers: {
						'User-Agent': 'vscode-git-graph',
						'Authorization': 'Basic ' + new Buffer('user:aaaaaa').toString('base64')
					},
					port: '',
					agent: false,
					timeout: 15000
				}, expect.anything());
				expect(spyOnLog).toHaveBeenNthCalledWith(1, 'Requesting CICD for https://jenkins.net/job/job01/job/MultiBranch/job/master/3/api/json?tree=builds[id,timestamp,fullDisplayName,result,url,actions[lastBuiltRevision[branch[*]]]] page=-1 from Jenkins');
				expect(spyOnLog).toHaveBeenNthCalledWith(2, 'Jenkins API Rate Limit Reached - Paused fetching from Jenkins until the Rate Limit is reset (RateLimit=undefined(every minute)/Wed Apr 22 2020 21:40:58 GMT+0900 (GMT+09:00))');
				expect(spyOnLog).toHaveBeenCalledTimes(2);
				expect(cicdManager['jenkinsTimeout']).toBe((date.now + 1) * 1000);
			});

			it('Should set the Jenkins API timeout and requeue the request when the API returns a 5xx error', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsResponse(500, '', JenkinsHeader);

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['jenkinsTimeout']).toBe(date.now * 1000 + 600000);
				});
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							provider: CICDProvider.JenkinsV2
						},
						page: -1,
						checkAfter: date.now * 1000 + 600000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should set the Jenkins API timeout and requeue the request when there is an HTTPS Client Request Error', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsClientRequestErrorEvent({ message: 'Error Message' });

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['jenkinsTimeout']).toBe(date.now * 1000 + 300000);
				});
				expect(spyOnLog).toHaveBeenCalledWith('Jenkins API https Error - Error Message');
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							provider: CICDProvider.JenkinsV2
						},
						page: -1,
						checkAfter: date.now * 1000 + 300000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should set the Jenkins API timeout and requeue the request when there is an HTTPS Incoming Message Error', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsIncomingMessageErrorEvent();

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['jenkinsTimeout']).toBe(date.now * 1000 + 300000);
				});
				expect(spyOnLog).toHaveBeenCalledWith('Jenkins API https Error - undefined');
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							provider: CICDProvider.JenkinsV2
						},
						page: -1,
						checkAfter: date.now * 1000 + 300000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should set the Jenkins API timeout and requeue the request once when there are multiple HTTPS Error Events', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				mockHttpsMultipleErrorEvents();

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['jenkinsTimeout']).toBe(date.now * 1000 + 300000);
				});
				expect(spyOnLog).toHaveBeenCalledWith('Jenkins API https Error - undefined');
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							provider: CICDProvider.JenkinsV2
						},
						page: -1,
						checkAfter: date.now * 1000 + 300000,
						attempts: 0,
						detail: true,
						hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
						maximumStatuses: 1000
					}
				]);
			});

			it('Should requeue the request when it\'s before the Jenkins API timeout', async () => {
				// Setup
				spyOnGetRepos.mockReturnValueOnce(JenkinsGetRspos);
				cicdManager['jenkinsTimeout'] = (date.now + 1) * 1000;

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', '149ecc50e5c223251f80a0223cfbbd9822307224');

				// Assert
				await waitForExpect(() => {
					expect(cicdManager['queue']['queue']).toStrictEqual([
						{
							repo: '/path/to/repo1',
							cicdConfig: {
								cicdToken: '',
								cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
								provider: CICDProvider.JenkinsV2
							},
							page: -1,
							checkAfter: (date.now + 1) * 1000,
							attempts: 0,
							detail: true,
							hash: '149ecc50e5c223251f80a0223cfbbd9822307224',
							maximumStatuses: 1000
						}
					]);
				});
			});

			it('Should insert requests into the priority queue in the correct order', async () => {
				// Setup
				spyOnGetRepos.mockReturnValue({
					'/path/to/repo1': mockRepoState(null, 0,
						'ElZJNHSyT6JDjOGDaVaPiZenu3Xu2MZf', [{
							provider: CICDProvider.JenkinsV2,
							cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							cicdToken: ''
						}])
				});
				mockHttpsResponse(403, '', Object.assign({}, JenkinsHeader, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': (date.now + 1).toString() }));

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash0');

				// Assert
				await waitForExpect(() => {
					expect(spyOnLog).toHaveBeenCalledWith('Jenkins API Error - (403)undefined');
				});

				// Run
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash1');
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash2');
				await cicdManager.getCICDDetail('/path/to/repo1', 'hash2');
				cicdManager['queue']['add']('/path/to/repo1', {
					provider: CICDProvider.JenkinsV2,
					cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
					cicdToken: ''
				}, -1, false, true, 'hash3');

				// Assert
				expect(cicdManager['queue']['queue']).toStrictEqual([
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							provider: CICDProvider.JenkinsV2
						},
						page: -1,
						checkAfter: 0,
						attempts: 0,
						detail: true,
						hash: 'hash1',
						maximumStatuses: 1000
					},
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							provider: CICDProvider.JenkinsV2
						},
						page: -1,
						checkAfter: 0,
						attempts: 0,
						detail: true,
						hash: 'hash2',
						maximumStatuses: 1000
					},
					{
						repo: '/path/to/repo1',
						cicdConfig: {
							cicdToken: '',
							cicdUrl: 'https://jenkins.net/job/job01/job/MultiBranch/job/master/3/',
							provider: CICDProvider.JenkinsV2
						},
						page: -1,
						checkAfter: 1,
						attempts: 0,
						detail: true,
						hash: 'hash3',
						maximumStatuses: 1000
					}
				]);
			});
		});

	});


	describe('clearCache', () => {
		let spyOnClearCICDCache: jest.SpyInstance;
		beforeAll(() => {
			spyOnClearCICDCache = jest.spyOn(extensionState, 'clearCICDCache');
		});

		it('Should clear the cache of cicd', async () => {
			// Setup
			spyOnClearCICDCache.mockResolvedValueOnce(null);

			// Run
			cicdManager.clearCache();

			// Assert
			expect(cicdManager['cicds']).toStrictEqual({});
			expect(spyOnClearCICDCache).toHaveBeenCalledTimes(1);
		});

	});
});


function mockHttpsResponse(statusCode: number, resData: string, headers: { [header: string]: string | number } = {}) {
	spyOnHttpsGet.mockImplementationOnce((_: string | https.RequestOptions | URL, callback: (res: IncomingMessage) => void): ClientRequest => {
		if (callback) {
			const callbacks: { [event: string]: (...args: any) => void } = {};
			const message: IncomingMessage = <any>{
				statusCode: statusCode,
				headers: Object.assign({}, headers),
				on: (event: string, listener: () => void) => {
					callbacks[event] = listener;
					return message;
				}
			};
			callback(message);
			callbacks['data'](Buffer.from(resData));
			callbacks['end']();
		}
		return ({
			on: jest.fn()
		}) as any as ClientRequest;
	});
}

function mockHttpResponse(statusCode: number, resData: string, headers: { [header: string]: string } = {}) {
	spyOnHttpGet.mockImplementationOnce((_: string | http.RequestOptions | URL, callback: (res: IncomingMessage) => void): ClientRequest => {
		if (callback) {
			const callbacks: { [event: string]: (...args: any) => void } = {};
			const message: IncomingMessage = <any>{
				statusCode: statusCode,
				headers: Object.assign({}, headers),
				on: (event: string, listener: () => void) => {
					callbacks[event] = listener;
					return message;
				}
			};
			callback(message);
			callbacks['data'](Buffer.from(resData));
			callbacks['end']();
		}
		return ({
			on: jest.fn()
		}) as any as ClientRequest;
	});
}

function mockHttpsClientRequestErrorEvent(err: any) {
	spyOnHttpsGet.mockImplementationOnce((_1: string | https.RequestOptions | URL, _2: (res: IncomingMessage) => void): ClientRequest => {
		const request: ClientRequest = <any>{
			on: (event: string, callback: (err: any) => void) => {
				if (event === 'error') {
					callback(err);
				}
				return request;
			}
		};
		return request;
	});
}

function mockHttpsIncomingMessageErrorEvent() {
	spyOnHttpsGet.mockImplementationOnce((_: string | https.RequestOptions | URL, callback: (res: IncomingMessage) => void): ClientRequest => {
		const callbacks: { [event: string]: (...args: any) => void } = {};
		const message: IncomingMessage = <any>{
			on: (event: string, listener: () => void) => {
				callbacks[event] = listener;
				return message;
			}
		};
		callback(message);
		callbacks['error']();
		return ({
			on: jest.fn()
		}) as any as ClientRequest;
	});
}

function mockHttpsMultipleErrorEvents() {
	spyOnHttpsGet.mockImplementationOnce((_: string | https.RequestOptions | URL, callback: (res: IncomingMessage) => void): ClientRequest => {
		const callbacks: { [event: string]: (...args: any) => void } = {};
		const message: IncomingMessage = <any>{
			on: (event: string, listener: () => void) => {
				callbacks[event] = listener;
				return message;
			}
		};
		callback(message);
		callbacks['error']();

		const request: ClientRequest = <any>{
			on: (event: string, callback: () => void) => {
				if (event === 'error') {
					callback();
				}
				return request;
			}
		};
		return request;
	});
}

function waitForEvents(cicdManager: CicdManager, n: number, runPendingTimers = false) {
	return new Promise<CICDEvent[]>((resolve) => {
		const events: CICDEvent[] = [];
		cicdManager.onCICD((event) => {
			events.push(event);
			if (runPendingTimers) {
				jest.runOnlyPendingTimers();
			}
			if (events.length === n) {
				resolve(events);
			}
		});
	});
}

function mockRepoState(name: string | null, workspaceFolderIndex: number | null, cicdNonce: string | null, cicdConfigs: CICDConfig[] | null) {
	return Object.assign({}, DEFAULT_REPO_STATE, { name: name, workspaceFolderIndex: workspaceFolderIndex, cicdNonce: cicdNonce, cicdConfigs: cicdConfigs });
}

