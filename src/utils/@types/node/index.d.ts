/**
 * This file contains types for additional methods used by Git Graph, that were added between the
 * version of @types/node (8.10.62) and the version of Node.js (10.11.0) used by the minimum
 * version of Visual Studio Code that Git Graph supports. Unfortunately @types/node 10.11.0 can't
 * be used, as it is not compatible with Typescript >= 3.7.2. Once the minimum version of Visual
 * Studio Code that Git Graph supports is increased, such that it's version of @types/node is
 * compatible with Typescript >= 3.7.2, @types/node will be updated, and this file will be removed.
 */
declare module 'fs' {
	namespace realpath {
		function native(path: PathLike, callback: (err: NodeJS.ErrnoException | null, resolvedPath: string) => void): void;
	}
}
