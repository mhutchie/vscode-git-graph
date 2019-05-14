class Branch {
	private lines: Line[] = [];
	private colour: number;
	private end: number = 0;
	private numUncommitted: number = 0;

	constructor(colour: number) {
		this.colour = colour;
	}

	public addLine(p1: Point, p2: Point, isCommitted: boolean, lockedFirst: boolean) {
		this.lines.push({ p1: p1, p2: p2, lockedFirst: lockedFirst });
		if (isCommitted) {
			if (p2.y < this.numUncommitted) this.numUncommitted = p2.y;
		} else {
			this.numUncommitted++;
		}
	}
	public getColour() {
		return this.colour;
	}
	public getEnd() {
		return this.end;
	}
	public setEnd(end: number) {
		this.end = end;
	}
	public draw(svg: SVGElement, config: Config, expandAt: number) {
		let colour = config.graphColours[this.colour % config.graphColours.length], i, x1, y1, x2, y2, lines: PlacedLine[] = [], curPath = '', curColour = '', d = config.grid.y * (config.graphStyle === 'angular' ? 0.38 : 0.8);

		// Convert branch lines into pixel coordinates, respecting expanded commit extensions
		for (i = 0; i < this.lines.length; i++) {
			x1 = this.lines[i].p1.x * config.grid.x + config.grid.offsetX; y1 = this.lines[i].p1.y * config.grid.y + config.grid.offsetY;
			x2 = this.lines[i].p2.x * config.grid.x + config.grid.offsetX; y2 = this.lines[i].p2.y * config.grid.y + config.grid.offsetY;

			// If a commit is expanded, we needd to stretch the graph for the height of the commit details view
			if (expandAt > -1) {
				if (this.lines[i].p1.y > expandAt) { // If the line starts after the expansion, move the whole line lower
					y1 += config.grid.expandY;
					y2 += config.grid.expandY;
				} else if (this.lines[i].p2.y > expandAt) { // If the line crosses the expansion
					if (x1 === x2) { // The line is vertical, extend the endpoint past the expansion
						y2 += config.grid.expandY;
					} else if (this.lines[i].lockedFirst) { // If the line is locked to the first point, the transition stays in its normal position
						lines.push({ p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, isCommitted: i >= this.numUncommitted, lockedFirst: this.lines[i].lockedFirst }); // Display the normal transition
						lines.push({ p1: { x: x2, y: y1 + config.grid.y }, p2: { x: x2, y: y2 + config.grid.expandY }, isCommitted: i >= this.numUncommitted, lockedFirst: this.lines[i].lockedFirst }); // Extend the line over the expansion from the transition end point
						continue;
					} else { // If the line is locked to the second point, the transition moves to after the expansion
						lines.push({ p1: { x: x1, y: y1 }, p2: { x: x1, y: y2 - config.grid.y + config.grid.expandY }, isCommitted: i >= this.numUncommitted, lockedFirst: this.lines[i].lockedFirst }); // Extend the line over the expansion to the new transition start point
						y1 += config.grid.expandY; y2 += config.grid.expandY;
					}
				}
			}
			lines.push({ p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, isCommitted: i >= this.numUncommitted, lockedFirst: this.lines[i].lockedFirst });
		}

		// Simplify consecutive lines that are straight by removing the 'middle' point 
		i = 0;
		while (i < lines.length - 1) {
			if (lines[i].p1.x === lines[i].p2.x && lines[i].p2.x === lines[i + 1].p1.x && lines[i + 1].p1.x === lines[i + 1].p2.x && lines[i].p2.y === lines[i + 1].p1.y && lines[i].isCommitted === lines[i + 1].isCommitted) {
				lines[i].p2.y = lines[i + 1].p2.y;
				lines.splice(i + 1, 1);
			} else {
				i++;
			}
		}

		// Iterate through all lines, producing and adding the svg paths to the DOM
		for (i = 0; i < lines.length; i++) {
			x1 = lines[i].p1.x; y1 = lines[i].p1.y;
			x2 = lines[i].p2.x; y2 = lines[i].p2.y;

			// If the new point belongs to a different path, render the current path and reset it for the new path
			if (curPath !== '' && i > 0 && lines[i].isCommitted !== lines[i - 1].isCommitted) {
				this.drawPath(svg, curPath, curColour);
				curPath = '';
				curColour = '';
			}

			// If the path hasn't been started or the new point belongs to a different path, move to p1
			if (curPath === '' || (i > 0 && (x1 !== lines[i - 1].p2.x || y1 !== lines[i - 1].p2.y))) curPath += 'M' + x1.toFixed(0) + ',' + y1.toFixed(1);

			// If the path hasn't been assigned a colour, assign it
			if (curColour === '') curColour = lines[i].isCommitted ? colour : '#808080';

			if (x1 === x2) { // If the path is vertical, draw a straight line
				curPath += 'L' + x2.toFixed(0) + ',' + y2.toFixed(1);
			} else { // If the path moves horizontal, draw the appropriate transition
				if (config.graphStyle === 'angular') {
					curPath += 'L' + (lines[i].lockedFirst ? (x2.toFixed(0) + ',' + (y2 - d).toFixed(1)) : (x1.toFixed(0) + ',' + (y1 + d).toFixed(1))) + 'L' + x2.toFixed(0) + ',' + y2.toFixed(1);
				} else {
					curPath += 'C' + x1.toFixed(0) + ',' + (y1 + d).toFixed(1) + ' ' + x2.toFixed(0) + ',' + (y2 - d).toFixed(1) + ' ' + x2.toFixed(0) + ',' + y2.toFixed(1);
				}
			}
		}

		this.drawPath(svg, curPath, curColour); // Draw the remaining path
	}
	private drawPath(svg: SVGElement, path: string, colour: string) {
		let shadow = svg.appendChild(document.createElementNS(SVG_NAMESPACE, 'path')), line = svg.appendChild(document.createElementNS(SVG_NAMESPACE, 'path'));
		shadow.setAttribute('class', 'shadow');
		shadow.setAttribute('d', path);
		line.setAttribute('class', 'line');
		line.setAttribute('d', path);
		line.setAttribute('stroke', colour);
	}
}

class Vertex {
	private x: number = 0;
	private y: number;
	private parents: Vertex[] = [];
	private nextParent: number = 0;
	private onBranch: Branch | null = null;
	private isCommitted: boolean = true;
	private isCurrent: boolean = false;
	private nextX: number = 0;
	private connections: UnavailablePoint[] = [];

	constructor(y: number) {
		this.y = y;
	}

	public addParent(vertex: Vertex) {
		this.parents.push(vertex);
	}
	public hasParents() {
		return this.parents.length > 0;
	}
	public getNextParent(): Vertex | null {
		if (this.nextParent < this.parents.length) return this.parents[this.nextParent];
		return null;
	}
	public getLastParent(): Vertex | null {
		if (this.nextParent < 1) return null;
		return this.parents[this.nextParent - 1];
	}
	public registerParentProcessed() {
		this.nextParent++;
	}
	public isMerge() {
		return this.parents.length > 1;
	}

	public addToBranch(branch: Branch, x: number) {
		if (this.onBranch === null) {
			this.onBranch = branch;
			this.x = x;
		}
	}
	public isNotOnBranch() {
		return this.onBranch === null;
	}
	public isOnThisBranch(branch: Branch) {
		return this.onBranch === branch;
	}
	public getBranch() {
		return this.onBranch;
	}

	public getPoint(): Point {
		return { x: this.x, y: this.y };
	}
	public getNextPoint(): Point {
		return { x: this.nextX, y: this.y };
	}
	public getIsCommitted() {
		return this.isCommitted;
	}

	public getPointConnectingTo(vertex: VertexOrNull, onBranch: Branch) {
		for (let i = 0; i < this.connections.length; i++) {
			if (this.connections[i].connectsTo === vertex && this.connections[i].onBranch === onBranch) return { x: i, y: this.y };
		}
		return null;
	}
	public registerUnavailablePoint(x: number, connectsToVertex: VertexOrNull, onBranch: Branch) {
		if (x === this.nextX) {
			this.nextX = x + 1;
			this.connections[x] = { connectsTo: connectsToVertex, onBranch: onBranch };
		}
	}

	public getColour() {
		return this.onBranch !== null ? this.onBranch.getColour() : 0;
	}
	public setNotCommited() {
		this.isCommitted = false;
	}
	public setCurrent() {
		this.isCurrent = true;
	}
	public draw(svg: SVGElement, config: Config, expandOffset: boolean) {
		if (this.onBranch === null) return;

		let circle = svg.appendChild(document.createElementNS(SVG_NAMESPACE, 'circle'));
		let colour = this.isCommitted ? config.graphColours[this.onBranch.getColour() % config.graphColours.length] : '#808080';
		circle.setAttribute('cx', (this.x * config.grid.x + config.grid.offsetX).toString());
		circle.setAttribute('cy', (this.y * config.grid.y + config.grid.offsetY + (expandOffset ? config.grid.expandY : 0)).toString());
		circle.setAttribute('r', '4');
		if (this.isCurrent) {
			circle.setAttribute('class', 'current');
			circle.setAttribute('stroke', colour);
		} else {
			circle.setAttribute('fill', colour);
		}
	}
}

class Graph {
	private config: Config;

	private svg: SVGElement;
	private svgGroup: SVGGElement | null = null;
	private svgMaskRect: SVGRectElement;
	private svgGradientStop1: SVGStopElement;
	private svgGradientStop2: SVGStopElement;
	private maxWidth: number = -1;

	private vertices: Vertex[] = [];
	private branches: Branch[] = [];
	private availableColours: number[] = [];

	constructor(id: string, config: Config) {
		this.config = config;

		this.svg = document.createElementNS(SVG_NAMESPACE, 'svg');
		let defs = this.svg.appendChild(document.createElementNS(SVG_NAMESPACE, 'defs'));

		let linearGradient = defs.appendChild(document.createElementNS(SVG_NAMESPACE, 'linearGradient'));
		linearGradient.setAttribute('id', 'GraphGradient');
		this.svgGradientStop1 = linearGradient.appendChild(document.createElementNS(SVG_NAMESPACE, 'stop'));
		this.svgGradientStop1.setAttribute('stop-color', 'white');
		this.svgGradientStop2 = linearGradient.appendChild(document.createElementNS(SVG_NAMESPACE, 'stop'));
		this.svgGradientStop2.setAttribute('stop-color', 'black');

		let mask = defs.appendChild(document.createElementNS(SVG_NAMESPACE, 'mask'));
		mask.setAttribute('id', 'GraphMask');
		this.svgMaskRect = mask.appendChild(document.createElementNS(SVG_NAMESPACE, 'rect'));
		this.svgMaskRect.setAttribute('fill', 'url(#GraphGradient)');

		this.setDimensions(0, 0);
		document.getElementById(id)!.appendChild(this.svg);
	}

	public loadCommits(commits: GG.GitCommitNode[], commitHead: string | null, commitLookup: { [hash: string]: number }) {
		this.vertices = [];
		this.branches = [];
		this.availableColours = [];

		let i: number, j: number;
		for (i = 0; i < commits.length; i++) {
			this.vertices.push(new Vertex(i));
		}
		for (i = 0; i < commits.length; i++) {
			for (j = 0; j < commits[i].parentHashes.length; j++) {
				if (typeof commitLookup[commits[i].parentHashes[j]] === 'number') {
					this.vertices[i].addParent(this.vertices[commitLookup[commits[i].parentHashes[j]]]);
				}
			}
		}

		if (commits.length > 0) {
			if (commits[0].hash === '*') {
				this.vertices[0].setCurrent();
				this.vertices[0].setNotCommited();
			} else if (commitHead !== null && typeof commitLookup[commitHead] === 'number') {
				this.vertices[commitLookup[commitHead]].setCurrent();
			}
		}

		while ((i = this.findStart()) !== -1) {
			this.determinePath(i);
		}
	}

	public render(expandedCommit: ExpandedCommit | null) {
		let group = document.createElementNS(SVG_NAMESPACE, 'g'), i, width = this.getWidth();
		group.setAttribute('mask', 'url(#GraphMask)');

		for (i = 0; i < this.branches.length; i++) {
			this.branches[i].draw(group, this.config, expandedCommit !== null ? expandedCommit.id : -1);
		}
		for (i = 0; i < this.vertices.length; i++) {
			this.vertices[i].draw(group, this.config, expandedCommit !== null && i > expandedCommit.id);
		}

		if (this.svgGroup !== null) this.svg.removeChild(this.svgGroup);
		this.svg.appendChild(group);
		this.svgGroup = group;
		this.setDimensions(width, this.getHeight(expandedCommit));
		this.applyMaxWidth(width);
	}

	public clear() {
		if (this.svgGroup !== null) {
			this.svg.removeChild(this.svgGroup);
			this.svgGroup = null;
			this.setDimensions(0, 0);
		}
	}

	public getWidth() {
		let x = 0, i, p;
		for (i = 0; i < this.vertices.length; i++) {
			p = this.vertices[i].getNextPoint();
			if (p.x > x) x = p.x;
		}
		return x * this.config.grid.x;
	}

	public getHeight(expandedCommit: ExpandedCommit | null) {
		return this.vertices.length * this.config.grid.y + this.config.grid.offsetY - this.config.grid.y / 2 + (expandedCommit !== null ? this.config.grid.expandY : 0);
	}

	public getVertexColour(v: number) {
		return this.vertices[v].getColour() % this.config.graphColours.length;
	}

	public limitMaxWidth(maxWidth: number) {
		this.maxWidth = maxWidth;
		this.applyMaxWidth(this.getWidth());
	}

	private setDimensions(width: number, height: number) {
		this.svg.setAttribute('width', width.toString());
		this.svg.setAttribute('height', height.toString());
		this.svgMaskRect.setAttribute('width', width.toString());
		this.svgMaskRect.setAttribute('height', height.toString());
	}

	private applyMaxWidth(width: number) {
		let offset1 = this.maxWidth > -1 ? (this.maxWidth - 12) / width : 1;
		let offset2 = this.maxWidth > -1 ? this.maxWidth / width : 1;
		this.svgGradientStop1.setAttribute('offset', offset1.toString());
		this.svgGradientStop2.setAttribute('offset', offset2.toString());
	}

	private determinePath(startAt: number) {
		let i = startAt;
		let vertex = this.vertices[i], parentVertex = this.vertices[i].getNextParent();
		let lastPoint = vertex.isNotOnBranch() ? vertex.getNextPoint() : vertex.getPoint(), curPoint;

		if (parentVertex !== null && vertex.isMerge() && !vertex.isNotOnBranch() && !parentVertex.isNotOnBranch()) {
			// Branch is a merge between two vertices already on branches
			let foundPointToParent = false, parentBranch = parentVertex.getBranch()!;
			for (i = startAt + 1; i < this.vertices.length; i++) {
				curPoint = this.vertices[i].getPointConnectingTo(parentVertex, parentBranch); // Check if there is already a point connecting the ith vertex to the required parent
				if (curPoint !== null) {
					foundPointToParent = true; // Parent was found
				} else {
					curPoint = this.vertices[i].getNextPoint(); // Parent couldn't be found, choose the next avaialble point for the vertex
				}
				parentBranch.addLine(lastPoint, curPoint, vertex.getIsCommitted(), !foundPointToParent && this.vertices[i] !== parentVertex ? lastPoint.x < curPoint.x : true);
				this.vertices[i].registerUnavailablePoint(curPoint.x, parentVertex, parentBranch);
				lastPoint = curPoint;

				if (foundPointToParent) {
					vertex.registerParentProcessed();
					break;
				}
			}
		} else {
			// Branch is normal
			let branch = new Branch(this.getAvailableColour(startAt));
			vertex.addToBranch(branch, lastPoint.x);
			vertex.registerUnavailablePoint(lastPoint.x, vertex, branch);
			for (i = startAt + 1; i < this.vertices.length; i++) {
				curPoint = parentVertex === this.vertices[i] && !parentVertex.isNotOnBranch() ? this.vertices[i].getPoint() : this.vertices[i].getNextPoint();
				branch.addLine(lastPoint, curPoint, vertex.getIsCommitted(), lastPoint.x < curPoint.x);
				this.vertices[i].registerUnavailablePoint(curPoint.x, parentVertex, branch);
				lastPoint = curPoint;

				if (parentVertex === this.vertices[i]) {
					vertex.registerParentProcessed();
					let parentVertexOnBranch = !parentVertex.isNotOnBranch();
					parentVertex.addToBranch(branch, curPoint.x);
					vertex = parentVertex;
					parentVertex = vertex.getNextParent();
					if (parentVertexOnBranch) break;
				}
			}
			branch.setEnd(i);
			this.branches.push(branch);
			this.availableColours[branch.getColour()] = i;
		}
	}

	private findStart() {
		for (let i = 0; i < this.vertices.length; i++) {
			if (this.vertices[i].getNextParent() !== null || this.vertices[i].isNotOnBranch()) return i;
		}
		return -1;
	}

	private getAvailableColour(startAt: number) {
		for (let i = 0; i < this.availableColours.length; i++) {
			if (startAt > this.availableColours[i]) {
				return i;
			}
		}
		this.availableColours.push(0);
		return this.availableColours.length - 1;
	}
}