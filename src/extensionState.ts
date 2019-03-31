import { ExtensionContext, Memento } from 'vscode';

const LAST_ACTIVE_REPO = 'lastActiveRepo';

export class ExtensionState {
	private workspaceState: Memento;

	constructor(context: ExtensionContext) {
		this.workspaceState = context.workspaceState;
	}

	public getLastActiveRepo() {
		return this.workspaceState.get<string | null>(LAST_ACTIVE_REPO, null);
	}

	public setLastActiveRepo(repo: string | null) {
		this.workspaceState.update(LAST_ACTIVE_REPO, repo);
	}
}