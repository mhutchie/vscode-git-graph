import { DEFAULT_REPO_STATE } from '../../src/extensionState';
import { GitRepoState } from '../../src/types';

export function mockRepoState(custom: Partial<GitRepoState> = {}): GitRepoState {
	return Object.assign({}, DEFAULT_REPO_STATE, custom);
}
