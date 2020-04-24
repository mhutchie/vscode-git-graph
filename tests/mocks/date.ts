const RealDate = Date;
const InitialNow = 1587559258;

export let now = InitialNow;

class MockDate extends RealDate {
	constructor(now: number) {
		super(now);
	}

	public getFullYear() {
		return this.getUTCFullYear();
	}

	public getMonth() {
		return this.getUTCMonth();
	}

	public getDate() {
		return this.getUTCDate();
	}

	public getHours() {
		return this.getUTCHours();
	}

	public getMinutes() {
		return this.getUTCMinutes();
	}

	public getSeconds() {
		return this.getUTCSeconds();
	}

	public getMilliseconds() {
		return this.getUTCMilliseconds();
	}
}

export function beforeEach() {
	// Reset now to its initial value
	now = InitialNow;

	// Override Date
	Date = class extends RealDate {
		constructor() {
			super();
			return new MockDate(now * 1000);
		}
	} as DateConstructor;
}

export function afterEach() {
	Date = RealDate;
}

export function setCurrentTime(newNow: number) {
	now = newNow;
}
