const CLASS_GRAPH_VERTEX_ACTIVE = 'graphVertexActive';
const NULL_VERTEX_ID = -1;
const DEFAULT_COLOUR = '#808080';

/* Types */

interface Point {
	x: number;
	y: number;
}
interface Line {
	p1: Point;
	p2: Point;
	collisionType: LineCollisionType;
	// readonly lockedFirst: boolean; // TRUE => The line is locked to p1, FALSE => The line is locked to p2
}
enum LineCollisionType {
	NoIssue = 0,
	NoCollision = 1,
	Collision = 2
}

/* Branch Class */


// The Branch2 class represents a particular "channel" in the graph, which is denoted by the 'x' variable.
// This way, we can modify the priority of this "channel".
// The original Branch class doesn't do this, and instead, holds the rendering
// information of where and how to draw lines. This meant my initial attempts
// of prioritising "branches" failed, because I would always get weird connections...
// This way, we can prioritise which channel each commit goes into, and then only
// the commit is responsible for drawing dots and lines
class Branch2 {
	public readonly name: string;
	public readonly tip: Commit2;

	public x: number;

	private lines: Line[] = [];
	private numUncommittedFoundWhileBuilding: number = 0;

	constructor(x: number, name: string, tip: Commit2) {
		this.x = x;
		this.name = name;
		this.tip = tip;
	}

	public setPriority(priorities: string[]) {
		this.x = priorities.indexOf(this.name);
	}

	public draw(svg: SVGElement, config: GG.GraphConfig, expandAt: number) {
		this.buildLines();

		let p1: Point; // Source
		let p2: Point; // Dest
		let p3: Point; // Collision Move-To Point
		let screenLines: Line[] = [];
		let curLine: Line | undefined;

		// First passthrough creates screenLines from this.lines
		// It also simplifies consecutive straight lines
		for (let i = 0; i < this.lines.length; i++) {
			curLine = this.lines[i];

			p1 = { x: curLine.p1.x * config.grid.x + config.grid.offsetX, y: curLine.p1.y * config.grid.y + config.grid.offsetY };
			p2 = { x: curLine.p2.x * config.grid.x + config.grid.offsetX, y: curLine.p2.y * config.grid.y + config.grid.offsetY };

			if (expandAt > -1) {
				if (curLine.p1.y > expandAt) { // If the line starts after the expansion, move the whole line lower
					p1.y += config.grid.expandY;
					p2.y += config.grid.expandY;
				} else if (curLine.p2.y > expandAt) { // If it's just the end, only move the end
					p2.y += config.grid.expandY;
				}
				// I wasn't sure how "locking" fit into the mix...
			}

			screenLines.push({ p1, p2, collisionType: curLine.collisionType });
		}

		const colour = this.getColour(config);
		const isAngular = config.style === GG.GraphStyle.Angular;
		let svgPath: string = '';
		let rowHeightOffset: number = config.grid.y * (isAngular ? 0.38 : 0.8);

		// This second passthrough generates the SVG "path"s, uhm, path code - but just the path, not the element
		// When we're done with a path, we add it to the DOM
		for (let i = 0; i < screenLines.length; i++) {
			svgPath = '';
			curLine = screenLines[i];
			p1 = curLine.p1;
			p2 = curLine.p2;

			// Set SVG Path
			svgPath += `M${p1.x.toFixed(0)},${p1.y.toFixed(1)} `; // Move to P1
			if (curLine.collisionType === LineCollisionType.NoIssue) {
				// No issue means no channel change, so draw a line straight down
				svgPath += `L${p2.x.toFixed(0)},${p2.y.toFixed(1)} `;
			} else if (curLine.collisionType === LineCollisionType.Collision) {
				// Collision means draw a curve now
				if (isAngular) svgPath += `L${p2.x.toFixed(0)},${(p1.y + rowHeightOffset).toFixed(1)} `;
				else {
					p3 = { x: p2.x, y: p1.y + config.grid.y };
					svgPath += `C${p1.x.toFixed(0)},${(p1.y + rowHeightOffset).toFixed(1)} ${p3.x.toFixed(0)},${(p3.y - rowHeightOffset).toFixed(1)} ${p3.x.toFixed(0)},${(p3.y).toFixed(1)} `;
				}

				svgPath += `L${p2.x.toFixed(0)},${p2.y.toFixed(1)} `;
			} else if (curLine.collisionType === LineCollisionType.NoCollision) {
				// NoCollision means draw a curve later

				// Draw line
				p3 = { x: p1.x, y: p2.y - config.grid.y };
				svgPath += `L${p3.x.toFixed(0)},${p3.y.toFixed(1)} `;

				if (isAngular) svgPath += `L${p2.x.toFixed(0)},${(p2.y).toFixed(1)} `;
				else svgPath += `C${p3.x.toFixed(0)},${(p3.y + rowHeightOffset).toFixed(1)} ${p2.x.toFixed(0)},${(p2.y - rowHeightOffset).toFixed(1)} ${p2.x.toFixed(0)},${p2.y.toFixed(1)} `;
			}

			const shadow = svg.appendChild(document.createElementNS(SVG_NAMESPACE, 'path'));
			const line = svg.appendChild(document.createElementNS(SVG_NAMESPACE, 'path'));
			shadow.setAttribute('class', 'shadow');
			shadow.setAttribute('fill', 'transparent');
			shadow.setAttribute('d', svgPath);
			line.setAttribute('class', 'line');
			// line.setAttribute('fill', 'transparent');
			line.setAttribute('d', svgPath);
			line.setAttribute('stroke', this.numUncommittedFoundWhileBuilding === 0 ? colour : DEFAULT_COLOUR);
			if (this.numUncommittedFoundWhileBuilding === 0 && config.uncommittedChanges === GG.GraphUncommittedChangesStyle.OpenCircleAtTheCheckedOutCommit) {
				line.setAttribute('stroke-dasharray', '2px');
			}
		}
	}

	public resetLines(): void {
		this.lines = [];
	}

	public buildLines(commit: Commit2 = this.tip): void {
		if (!commit.isCommitted()) this.numUncommittedFoundWhileBuilding++;

		let parents = commit.getParents();
		let otherParent: Commit2 | undefined;
		for (let parent of parents) {
			otherParent = parents.find(p => p !== parent);
			// Duck-typing lets us cheat and this works
			// TODO: Another option is to let branches have maximum time in
			// the right most channel, but I don't know the algorithm for that...
			this.lines.push({
				p1: commit,
				p2: parent,
				collisionType: commit.x === parent.x ?
					LineCollisionType.NoIssue :
					otherParent !== undefined && commit.x === otherParent.x && otherParent.y < parent.y ?
						LineCollisionType.Collision :
						LineCollisionType.NoCollision
			});
			if (parent.branch === this) this.buildLines(parent);
		}
	}

	public getColour(config: GG.GraphConfig) {
		return Branch2.getBranchColor(this, config);
	}

	public static getBranchColor(branch: Branch2, config: GG.GraphConfig) {
		return config.colours[branch.x % config.colours.length];
	}
}


/* Commit Class */
class Commit2 {
	public readonly y: number;
	public readonly commit: GG.GitCommit;
	public readonly definedHeads: Set<Branch2>;
	public readonly inferredHeads: Set<Branch2> = new Set<Branch2>([]);

	private _branch: Branch2 | null;
	private _childrenCommits: Commit2[] = [];
	private _parentCommits: Commit2[] = [];
	private _isDroppable: boolean = false;

	private _allHeads: Set<Branch2> | null = null;
	public isCurrent: boolean = false;

	constructor(y: number, commit: GG.GitCommit, heads: Set<Branch2> = new Set<Branch2>([])) {
		this.y = y;
		this.commit = commit;
		this.definedHeads = heads;
		this._branch = null;

		commit.heads.map(h => new Branch2(-1, h, this)).forEach(b => this.definedHeads.add(b));
	}

	get id() {
		// this ID is the same as the "y" value
		// 'y' is generated from the commit's position in
		// commit history which is what the ID refers to
		return this.y;
	}
	get hash() {
		return this.commit.hash;
	}
	get parents() {
		return this.commit.parents;
	}
	get author() {
		return this.commit.author;
	}
	get email() {
		return this.commit.email;
	}
	get date() {
		return this.commit.date;
	}
	get message() {
		return this.commit.message;
	}
	get heads() {
		return this.commit.heads;
	}
	get tags() {
		return this.commit.tags;
	}
	get remotes() {
		return this.commit.remotes;
	}
	get stash() {
		return this.commit.stash;
	}

	get shortHash() {
		return abbrevCommit(this.hash);
	}

	get children() {
		return this._childrenCommits.map(c => c.hash);
	}

	public getChildren() {
		return this._childrenCommits;
	}
	public getParents() {
		return this._parentCommits;
	}
	public getPoint() {
		return { x: this.x, y: this.y } as Point;
	}

	get branch() {
		return this._branch;
	}

	get allHeads(): Set<Branch2> {
		if (!this._allHeads) this._allHeads = new Set([...Array.from(this.definedHeads), ...Array.from(this.inferredHeads)]);
		return this._allHeads;
	}

	get x() {
		return this._branch?.x ?? -1;
	}

	get isStashed() {
		return this.stash !== null;
	}

	public getColour(config: GG.GraphConfig) {
		if (!this.isCommitted()) return DEFAULT_COLOUR;
		return this._branch?.getColour(config) ?? DEFAULT_COLOUR;
	}

	public isCommitted() {
		return this.hash !== UNCOMMITTED;
	}

	public addParent(parent: Commit2) {
		this._parentCommits.push(parent);
		parent._childrenCommits.push(this);
	}
	public hasParents() {
		return this.parents.length > 0;
	}
	public isMerge() {
		return this.parents.length >= 2;
	}

	get isDroppable() {
		return this._isDroppable;
	}
	public setDroppable() {
		this._isDroppable = true;
	}

	public hasHeads() {
		return this.definedHeads.size > 0;
	}
	public hasInferredHeads() {
		return this.inferredHeads.size > 0;
	}

	public addHeads(heads: Set<Branch2>) {
		if (heads.size > 0) {
			heads.forEach(head => this.inferredHeads.add(head));
			this._allHeads = null;
		}
	}

	public setBranchAccordingToPriority(priorities: readonly string[]) {
		// Set this.branch to it's head/inferred according to the following algorithm:
		// 1. If the commit has heads:
		//    1. If there is only one head, set it as the branch.
		//    2. If there are multiple heads, set the branch to the one with the best priority.
		// 2. Otherwise, if the commit has inferred heads (all commits will have one or the other):
		//    1. If the inferred heads contain priority heads, set the branch to the first priority head
		//    2. Otherwise, set the branch to the first inferred head
		let priorityHeads: Branch2[] = [];
		let headsToUse: Branch2[];

		if (this.hasHeads()) headsToUse = Array.from(this.definedHeads);
		else headsToUse = Array.from(this.inferredHeads);

		priorityHeads = headsToUse.filter(head => priorities.includes(head.name));
		if (priorityHeads.length > 0) this._branch = priorityHeads[0];
		else this._branch = headsToUse[0];

		return this._branch;
	}

	public draw(svg: SVGElement, config: GG.GraphConfig, expandOffsetNeeded: boolean, overListener: (event: MouseEvent) => void, outListener: (event: MouseEvent) => void) {
		if (this._branch === null) return;

		const colour = this.getColour(config);
		const cx = (this.x * config.grid.x + config.grid.offsetX).toString();
		const cy = (this.y * config.grid.y + config.grid.offsetY + (expandOffsetNeeded ? config.grid.expandY : 0)).toString();

		const circle = document.createElementNS(SVG_NAMESPACE, 'circle');
		circle.dataset.id = this.id.toString();
		circle.setAttribute('cx', cx);
		circle.setAttribute('cy', cy);
		circle.setAttribute('r', '4');
		circle.dataset.coord = `(${this.x}, ${this.y})`;
		if (this.isCurrent) {
			circle.setAttribute('class', 'current');
			circle.setAttribute('stroke', colour);
		} else {
			circle.setAttribute('fill', colour);
		}

		svg.appendChild(circle);

		if (this.isStashed && !this.isCurrent) {
			circle.setAttribute('r', '4.5');
			circle.setAttribute('class', 'stashOuter');
			const innerCircle = document.createElementNS(SVG_NAMESPACE, 'circle');
			innerCircle.setAttribute('cx', cx);
			innerCircle.setAttribute('cy', cy);
			innerCircle.setAttribute('r', '2');
			innerCircle.setAttribute('class', 'stashInner');
			svg.appendChild(innerCircle);
		}

		circle.addEventListener('mouseover', overListener);
		circle.addEventListener('mouseout', outListener);
	}

	public toJSON() {
		return this.commit;
	}
}


/* Graph Class */

class Graph {
	private readonly config: GG.GraphConfig;
	private readonly muteConfig: GG.MuteCommitsConfig;
	private branches: Branch2[] = [];
	private maxWidth: number = -1;

	private commits: ReadonlyArray<Commit2> = [];
	private commitHead: string | null = null;
	private commitLookup: { [hash: string]: number } = {};
	private onlyFollowFirstParent: boolean = false;
	private expandedCommitIndex: number = -1;

	private readonly viewElem: HTMLElement;
	private readonly contentElem: HTMLElement;
	private readonly svg: SVGElement;
	private readonly maskRect: SVGRectElement;
	private readonly gradientStop1: SVGStopElement;
	private readonly gradientStop2: SVGStopElement;
	private group: SVGGElement | null = null;

	private tooltipId: number = -1;
	private tooltipElem: HTMLElement | null = null;
	private tooltipTimeout: NodeJS.Timer | null = null;
	private tooltipCommit: HTMLElement | null = null;

	constructor(id: string, viewElem: HTMLElement, config: GG.GraphConfig, muteConfig: GG.MuteCommitsConfig) {
		this.viewElem = viewElem;
		this.config = config;
		this.muteConfig = muteConfig;

		const elem = document.getElementById(id)!;
		this.contentElem = elem.parentElement!;
		this.svg = document.createElementNS(SVG_NAMESPACE, 'svg');
		let defs = this.svg.appendChild(document.createElementNS(SVG_NAMESPACE, 'defs'));

		let linearGradient = defs.appendChild(document.createElementNS(SVG_NAMESPACE, 'linearGradient'));
		linearGradient.setAttribute('id', 'GraphGradient');
		this.gradientStop1 = linearGradient.appendChild(document.createElementNS(SVG_NAMESPACE, 'stop'));
		this.gradientStop1.setAttribute('stop-color', 'white');
		this.gradientStop2 = linearGradient.appendChild(document.createElementNS(SVG_NAMESPACE, 'stop'));
		this.gradientStop2.setAttribute('stop-color', 'black');

		let mask = defs.appendChild(document.createElementNS(SVG_NAMESPACE, 'mask'));
		mask.setAttribute('id', 'GraphMask');
		this.maskRect = mask.appendChild(document.createElementNS(SVG_NAMESPACE, 'rect'));
		this.maskRect.setAttribute('fill', 'url(#GraphGradient)');

		this.setDimensions(0, 0);
		elem.appendChild(this.svg);
	}


	/* Graph Operations */
	public loadCommits(commits: ReadonlyArray<Commit2>, commitHead: string | null, commitLookup: { [hash: string]: number }, onlyFollowFirstParent: boolean, priorityBranches: ReadonlyArray<string>) {
		this.commits = commits;
		this.commitHead = commitHead;
		this.commitLookup = commitLookup;
		this.onlyFollowFirstParent = onlyFollowFirstParent;
		this.branches = [];
		if (commits.length === 0) return;

		// Everything above is to hush the TS compiler
		// It actually doesn't give anything valuable to the below code, except for the commits array.

		// The first passthrough is to create the Commit2 lookup
		// This should be made redundant by enhancing the GitCommit Interface to a Class
		if (this.commits[0].hash === UNCOMMITTED && this.config.uncommittedChanges === GG.GraphUncommittedChangesStyle.OpenCircleAtTheUncommittedChanges) {
			this.commits[0].isCurrent = true;
		} else if (commitHead !== null && typeof commitLookup[commitHead] === 'number') {
			this.getCommitFromHash(commitHead)!.isCurrent = true;
		}

		// The second passthrough is to link parents, and share heads (aka Branch2) to ancestors
		// This should be done with remotes as well, but let's see if this works first.
		// We also set droppable branches here.
		let droppable = true;
		let headProcessed = false;
		commits.forEach((commitObj) => {
			commitObj.definedHeads.forEach((b) => {
				if (!this.branches.includes(b)) this.branches.push(b);
			});

			commitObj.parents.forEach((parent, i) => {
				if (this.onlyFollowFirstParent && i !== 0) return;

				let parentObj = this.getCommitFromHash(parent);
				if(parentObj === undefined) return;

				commitObj.addParent(parentObj);

				// heads are sets, so if we happen to add two "main"s, we don't get dupes
				if (!parentObj.hasHeads()) {
					parentObj.addHeads(commitObj.definedHeads);
					parentObj.addHeads(commitObj.inferredHeads);
				}
			});

			// FIXME: Somepone please review if this works legally.
			// I understood the onld code as if any commit us undroppable, all its parents become undroppable.
			// This means we can "early exit" (using the droppable bool) to say when to stop checking if commits are droppable
			// I could be wrong, but that's what I understood. Please correct me? 🙏
			// By default, all commits are non-droppable, and must satisfy a condition to become droppable
			if (droppable) {
				if (commitObj.isMerge()) {
					droppable = false;
				} else if (commitObj.hash === this.commitHead || headProcessed) {
					commitObj.setDroppable();
					headProcessed = true;
					// This bottom bit, idk...
					// } else {
					// 	droppable = false;
				} // are there any other conditions making commits droppable/not?
			}
		});

		// The third passthrough is what actually creates the priorities for the branches
		// This could be condensed into the second passthrough, but let's see if this works first..
		// Changing priorities allows us to assign "channels" to non-prioritised branches
		// Because the passed commits are sorted by date, we will always have the latest
		// non-priority commit as high as possible. Ie, if we're working on a feature, and
		// "main" is prioritised, "channel 0" will be main and "channel 1" will be the feature.
		let changingPriorities = priorityBranches.slice();
		for (let c = 0; c < this.commits.length; c++) {
			// We loop through commits to do this, because we need to loop through commits anyway
			let commitObj = this.commits[c];

			// If we have our own head (not an ancesstor head)
			if (commitObj.hasHeads()) {
				commitObj.definedHeads.forEach((head) => {
					head.setPriority(changingPriorities);
					if (head.x === -1) {
						head.x = changingPriorities.length;
						changingPriorities.push(head.name);
					}
				});
			}

			// This will set the commit's branch to the highest priority
			// If it doesn't have a priority branch, then the next "best" branch is used
			// ("best" bc lack of a better word...)
			commitObj.setBranchAccordingToPriority(priorityBranches);
		}

		// This last passthrough ensures that there are no gaps between branches (no empty channels)
		let sortedBranches = this.branches.sort((a, b) => a.x - b.x);
		for (let x = 0; x < sortedBranches.length; x++) sortedBranches[x].x = x;
	}

	public render(expandedCommit: ExpandedCommit | null) {
		this.expandedCommitIndex = expandedCommit !== null ? expandedCommit.index : -1;
		let group = document.createElementNS(SVG_NAMESPACE, 'g');
		let i: number;
		let contentWidth = this.getContentWidth();
		group.setAttribute('mask', 'url(#GraphMask)');

		for (i = 0; i < this.branches.length; i++) {
			this.branches[i].draw(group, this.config, this.expandedCommitIndex);
		}

		const overListener = (e: MouseEvent) => this.commitPointHoverStart(e);
		const outListener = (e: MouseEvent) => this.commitPointHoverEnd(e);
		for (i = 0; i < this.commits.length; i++) {
			this.commits[i].draw(group, this.config, expandedCommit !== null && i > expandedCommit.index, overListener, outListener);
		}

		if (this.group !== null) this.svg.removeChild(this.group);
		this.svg.appendChild(group);
		this.group = group;
		this.setDimensions(contentWidth, this.getHeight(expandedCommit));
		this.applyMaxWidth(contentWidth);
		this.closeTooltip();
	}


	/* Get */

	public getCommitFromHash(hash: string): Commit2 | undefined {
		return this.commits[this.commitLookup[hash]];
	}

	public getContentWidth() {
		let x = 0;
		let bx;
		for (let i = 0; i < this.commits.length; i++) {
			bx = this.commits[i].branch?.x ?? 0;
			if (bx > x) x = bx;
		}
		return 2 * this.config.grid.offsetX + x * this.config.grid.x;
	}

	public getHeight(expandedCommit: ExpandedCommit | null) {
		return this.commits.length * this.config.grid.y + this.config.grid.offsetY - this.config.grid.y / 2 + (expandedCommit !== null ? this.config.grid.expandY : 0);
	}

	public getWidthsAtVertices() {
		let widths = [];
		for (let i = 0; i < this.commits.length; i++) {
			// Plus 1 because otherwise the first column has no width
			widths[i] = this.config.grid.offsetX + (this.commits[i].x + 1) * this.config.grid.x - 2;
		}
		return widths;
	}


	/* Graph Queries */

	/**
	 * Determine whether a commit can be dropped.
	 * @param i Index of the commit to test.
	 * @returns TRUE => Commit can be dropped, FALSE => Commit can't be dropped
	 */
	public dropCommitPossible(i: number | string) {
		if (typeof i === 'number') {
			return this.commits[i].isDroppable;
		} else if (typeof i === 'string') {
			return this.getCommitFromHash(i)?.isDroppable ?? false;
		}

		return false;
	}

	private getAllChildren(i: number) {
		let visited: Set<Commit2> = new Set<Commit2>();
		const recurse = (commit: Commit2) => {
			if (visited.has(commit)) return;

			visited.add(commit);
			let children = commit.getChildren();
			children.forEach(recurse);
		};
		recurse(this.commits[i]);
		return Array.from(visited).sort((a, b) => a.id - b.id);
	}

	public getMutedCommits(currentHash: string | null) {
		const muted = new Array(this.commits.length).fill(false);
		let shownAncestors: string[] | null = null;
		if (currentHash !== null && typeof this.commitLookup[currentHash] === 'number') shownAncestors = [currentHash];

		let commit: Commit2;
		for (let i = 0; i < this.commits.length; i++) {
			muted[i] = false;
			commit = this.commits[i];

			// Mute any merge commits if the Extension Setting is enabled
			if (this.muteConfig.mergeCommits) {
				if (commit.isMerge() && !commit.isStashed) muted[i] = true;
			}


			// Mute commits that are not ancestors of the commit head if the Extension Setting is enabled, and the head commit is in the graph
			// If Non-Ancestors should be muted && we have a shownAncestors array (we have a current hash AND it's in the graph)
			if (this.muteConfig.commitsNotAncestorsOfHead && shownAncestors !== null) {
				muted[i] = true;

				let ancestorIndex = shownAncestors.indexOf(commit.hash);
				let isStashOfAncestor = commit.isStashed && typeof this.commitLookup[commit.hash] === 'number' && shownAncestors.includes(commit.stash!.baseHash); // this has no performance effect
				if (ancestorIndex !== -1 || isStashOfAncestor) {
					// Unmute this commit
					muted[i] = false;
					// Remove this ancestor to keep the array slim
					shownAncestors.splice(ancestorIndex, 1);
					// Push parent hashes
					shownAncestors.push(...commit.parents);
				}
			}
		}

		return muted;
	}


	/**
	 * Get the index of the first parent of the commit at the specified index.
	 * @param i The index of the commit.
	 * @returns The index of the first parent, or -1 if there is no parent.
	 */
	public getFirstParentIndex(i: number) {
		const parents = this.commits[i].getParents();
		return parents[0]?.id ?? -1;
	}

	/**
	 * Get the index of the alternative parent of the commit at the specified index.
	 * @param i The index of the commit.
	 * @returns The index of the alternative parent, or -1 if there is no parent.
	 */
	public getAlternativeParentIndex(i: number) {
		const parents = this.commits[i].getParents();
		return parents[1]?.id ?? parents[0]?.id ?? -1;
	}

	/**
	 * Get the index of the first child of the commit at the specified index.
	 * @param i The index of the commit.
	 * @returns The index of the first child, or -1 if there is no child.
	 */
	public getFirstChildIndex(i: number) {
		const children = this.commits[i].getChildren();
		if (children.length > 1) {
			// The vertex has multiple children
			const branch = this.commits[i].branch;
			let childOnSameBranch: Commit2 | undefined;
			if (branch !== null && !!(childOnSameBranch = children.find((child) => child.branch === branch))) {
				// If a child could be found on the same branch as the vertex
				return childOnSameBranch.id;
			} else {
				// No child could be found on the same branch as the vertex
				// return the largest ID because that's the closest commit
				return Math.max(...children.map((child) => child.id));
			}
		} else if (children.length === 1) {
			// The vertex has a single child
			return children[0].id;
		} else {
			// The vertex has no children
			return -1;
		}
	}

	/**
	 * Get the index of the alternative child of the commit at the specified index.
	 * @param i The index of the commit.
	 * @returns The index of the alternative child, or -1 if there is no child.
	 */
	public getAlternativeChildIndex(i: number) {
		const children = this.commits[i].getChildren();
		if (children.length > 1) {
			// The vertex has multiple children
			const branch = this.commits[i].branch;
			let childrenOnSameBranch: Commit2[] | undefined;
			if (branch !== null && (childrenOnSameBranch = children.filter((child) => child.branch === branch)).length > 0) {
				// If a child could be found on the same branch as the commit
				return Math.max(...childrenOnSameBranch.map((child) => child.id));
			} else {
				// No child could be found on the same branch as the vertex
				const childIndexes = children.map((child) => child.id).sort(); // closest child is highest index
				return childIndexes[childIndexes.length - 2]; // get second last bc last is returned from getFirstChildIndex
			}
		} else if (children.length === 1) {
			// The vertex has a single child
			return children[0].id;
		} else {
			// The vertex has no children
			return -1;
		}
	}


	/* Width Adjustment Methods */

	public limitMaxWidth(maxWidth: number) {
		this.maxWidth = maxWidth;
		this.applyMaxWidth(this.getContentWidth());
	}

	private setDimensions(contentWidth: number, height: number) {
		this.setSvgWidth(contentWidth);
		this.svg.setAttribute('height', height.toString());
		this.maskRect.setAttribute('width', contentWidth.toString());
		this.maskRect.setAttribute('height', height.toString());
	}

	private applyMaxWidth(contentWidth: number) {
		this.setSvgWidth(contentWidth);
		let offset1 = this.maxWidth > -1 ? (this.maxWidth - 12) / contentWidth : 1;
		let offset2 = this.maxWidth > -1 ? this.maxWidth / contentWidth : 1;
		this.gradientStop1.setAttribute('offset', offset1.toString());
		this.gradientStop2.setAttribute('offset', offset2.toString());
	}

	private setSvgWidth(contentWidth: number) {
		let width = this.maxWidth > -1 ? Math.min(contentWidth, this.maxWidth) : contentWidth;
		this.svg.setAttribute('width', width.toString());
	}



	/* Vertex Info */

	private commitPointHoverStart(event: MouseEvent) {
		if (event.target === null) return;
		this.closeTooltip();

		const commitPoint = <HTMLElement>event.target;
		const id = parseInt(commitPoint.dataset.id!);
		this.tooltipId = id;
		const commitElem = findCommitElemWithId(getCommitElems(), id);
		if (commitElem !== null) commitElem.classList.add(CLASS_GRAPH_VERTEX_ACTIVE);

		if (id < this.commits.length && this.commits[id].hash !== UNCOMMITTED) { // Only show tooltip for commits (not the uncommitted changes)
			this.tooltipTimeout = setTimeout(() => {
				this.tooltipTimeout = null;
				let commitPointScreenY = commitPoint.getBoundingClientRect().top + 4; // Get center of the circle
				if (commitPointScreenY >= 5 && commitPointScreenY <= this.viewElem.clientHeight - 5) {
					// Vertex is completely visible on the screen (not partially off)
					this.tooltipCommit = commitPoint;
					closeDialogAndContextMenu();
					this.showTooltip(id, commitPointScreenY);
				}
			}, 100);
		}
	}

	private commitPointHoverEnd(event: MouseEvent) {
		if (event.target === null) return;
		this.closeTooltip();
	}

	private showTooltip(id: number, vertexScreenY: number) {
		if (this.tooltipCommit !== null) {
			this.tooltipCommit.setAttribute('r', this.tooltipCommit.classList.contains('stashOuter') ? '5.5' : '5');
		}

		const commit = this.commits[id];

		const children = this.getAllChildren(id);
		let heads: string[] = [], remotes: GG.GitCommitRemote[] = [], stashes: string[] = [], tags: string[] = [], childrenIncludesHead = false;
		for (let i = 0; i < children.length; i++) {
			let child = children[i];
			for (let j = 0; j < child.heads.length; j++) heads.push(child.heads[j]);
			for (let j = 0; j < child.remotes.length; j++) remotes.push(child.remotes[j]);
			for (let j = 0; j < child.tags.length; j++) tags.push(child.tags[j].name);
			if (child.stash !== null) stashes.push(child.stash.selector.substring(5));
			if (child.hash === this.commitHead) childrenIncludesHead = true;
		}

		const getLimitedRefs = (htmlRefs: string[]) => {
			if (htmlRefs.length > 10) htmlRefs.splice(5, htmlRefs.length - 10, ' ' + ELLIPSIS + ' ');
			return htmlRefs.join('');
		};

		let html = '<div class="graphTooltipTitle">Commit ' + commit.shortHash + '</div>';
		if (this.commitHead !== null && typeof this.commitLookup[this.commitHead] === 'number') {
			html += '<div class="graphTooltipSection">This commit is ' + (childrenIncludesHead ? '' : '<b><i>not</i></b> ') + 'included in <span class="graphTooltipRef">HEAD</span></div>';
		}
		if (heads.length > 0 || remotes.length > 0) {
			let branchLabels = getBranchLabels(heads, remotes), htmlRefs: string[] = [];
			branchLabels.heads.forEach((head) => {
				let html = head.remotes.reduce((prev, remote) => prev + '<span class="graphTooltipCombinedRef">' + escapeHtml(remote) + '</span>', '');
				htmlRefs.push('<span class="graphTooltipRef">' + escapeHtml(head.name) + html + '</span>');
			});
			branchLabels.remotes.forEach((remote) => htmlRefs.push('<span class="graphTooltipRef">' + escapeHtml(remote.name) + '</span>'));
			html += '<div class="graphTooltipSection">Branches: ' + getLimitedRefs(htmlRefs) + '</div>';
		}
		if (tags.length > 0) {
			let htmlRefs = tags.map((tag) => '<span class="graphTooltipRef">' + escapeHtml(tag) + '</span>');
			html += '<div class="graphTooltipSection">Tags: ' + getLimitedRefs(htmlRefs) + '</div>';
		}
		if (stashes.length > 0) {
			let htmlRefs = stashes.map((stash) => '<span class="graphTooltipRef">' + escapeHtml(stash) + '</span>');
			html += '<div class="graphTooltipSection">Stashes: ' + getLimitedRefs(htmlRefs) + '</div>';
		}

		const point = commit as Point;
		const color = 'var(--git-graph-color' + (commit.getColour(this.config)) + ')';
		const anchor = document.createElement('div'), pointer = document.createElement('div'), content = document.createElement('div'), shadow = document.createElement('div');
		const pixel: Point = {
			x: point.x * this.config.grid.x + this.config.grid.offsetX,
			y: point.y * this.config.grid.y + this.config.grid.offsetY + (this.expandedCommitIndex > -1 && id > this.expandedCommitIndex ? this.config.grid.expandY : 0)
		};

		anchor.setAttribute('id', 'graphTooltip');
		anchor.style.opacity = '0';
		pointer.setAttribute('id', 'graphTooltipPointer');
		pointer.style.backgroundColor = color;
		content.setAttribute('id', 'graphTooltipContent');
		content.style.borderColor = color;
		content.innerHTML = html;
		content.style.maxWidth = Math.min(this.contentElem.getBoundingClientRect().width - pixel.x - 35, 600) + 'px'; // Tooltip Offset [23px] + Tooltip Border [2 * 2px] + Right Page Margin [8px] = 35px
		shadow.setAttribute('id', 'graphTooltipShadow');
		anchor.appendChild(shadow);
		anchor.appendChild(pointer);
		anchor.appendChild(content);
		anchor.style.left = pixel.x + 'px';
		anchor.style.top = pixel.y + 'px';
		this.contentElem.appendChild(anchor);
		this.tooltipElem = anchor;

		let tooltipRect = content.getBoundingClientRect();
		let relativeOffset = -tooltipRect.height / 2; // Center the tooltip vertically on the vertex
		if (vertexScreenY + relativeOffset + tooltipRect.height > this.viewElem.clientHeight - 4) {
			// Not enough height below the vertex to fit the vertex, shift it up.
			relativeOffset = (this.viewElem.clientHeight - vertexScreenY - 4) - tooltipRect.height;
		}
		if (vertexScreenY + relativeOffset < 4) {
			// Not enough height above the vertex to fit the tooltip, shift it down.
			relativeOffset = -vertexScreenY + 4;
		}
		pointer.style.top = (-relativeOffset) + 'px';
		anchor.style.top = (pixel.y + relativeOffset) + 'px';
		shadow.style.width = tooltipRect.width + 'px';
		shadow.style.height = tooltipRect.height + 'px';
		anchor.style.opacity = '1';
	}

	private closeTooltip() {
		if (this.tooltipId > -1) {
			const commitElem = findCommitElemWithId(getCommitElems(), this.tooltipId);
			if (commitElem !== null) commitElem.classList.remove(CLASS_GRAPH_VERTEX_ACTIVE);
			this.tooltipId = -1;
		}

		if (this.tooltipElem !== null) {
			this.tooltipElem.remove();
			this.tooltipElem = null;
		}

		if (this.tooltipTimeout !== null) {
			clearTimeout(this.tooltipTimeout);
			this.tooltipTimeout = null;
		}

		if (this.tooltipCommit !== null) {
			this.tooltipCommit.setAttribute('r', this.tooltipCommit.classList.contains('stashOuter') ? '4.5' : '4');
			this.tooltipCommit = null;
		}
	}
}
