export function abbrevCommit(commitHash: string) {
	return commitHash.substring(0, 8);
}