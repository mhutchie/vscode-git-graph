// This is just a working out file where I used Quokka to
// ensure I had the correct results.
// Limited testing indicates that it works, so 🤷‍♂️

const {assert} = require("console");

const commits = [
    {
        "hash": "93d1711b21e5fdb76d064a1b25c75d19512a6405",
        "parents": [
            "64881ccf04586cfeeb0ccea7da74f33468da246c",
            "e8694bdb490e19bfeb51691502d8d8b2cc526869"
        ],
        "author": "TheBrenny",
        "email": "iam+dev@justbrenny.me",
        "date": 1647577375,
        "message": "Merge branch 'third' into second",
        "heads": [
            "second"
        ],
        "tags": [],
        "remotes": [],
        "stash": null
    },
    {
        "hash": "a5243b018fe2c84a0294276f3713aec8e8f2206d",
        "parents": [
            "64881ccf04586cfeeb0ccea7da74f33468da246c"
        ],
        "author": "TheBrenny",
        "email": "iam+dev@justbrenny.me",
        "date": 1647504019,
        "message": "initial commit",
        "heads": [
            "master"
        ],
        "tags": [],
        "remotes": [],
        "stash": null
    },
    {
        "hash": "7ad45d24fc17375dbc4bca90209642ec787ca83a",
        "parents": [
            "3373fc119eec9e42f7e3ca4e5728b129cbfab10e",
            "64881ccf04586cfeeb0ccea7da74f33468da246c"
        ],
        "author": "TheBrenny",
        "email": "iam+dev@justbrenny.me",
        "date": 1647503946,
        "message": "Merge branch 'second'",
        "heads": [
            "main"
        ],
        "tags": [],
        "remotes": [],
        "stash": null
    },
    {
        "hash": "e8694bdb490e19bfeb51691502d8d8b2cc526869",
        "parents": [
            "64881ccf04586cfeeb0ccea7da74f33468da246c"
        ],
        "author": "TheBrenny",
        "email": "iam+dev@justbrenny.me",
        "date": 1647503884,
        "message": "initial commit",
        "heads": [
            "third"
        ],
        "tags": [],
        "remotes": [],
        "stash": null
    },
    {
        "hash": "64881ccf04586cfeeb0ccea7da74f33468da246c",
        "parents": [
            "3373fc119eec9e42f7e3ca4e5728b129cbfab10e"
        ],
        "author": "TheBrenny",
        "email": "iam+dev@justbrenny.me",
        "date": 1647503782,
        "message": "initial commit",
        "heads": [],
        "tags": [],
        "remotes": [],
        "stash": null
    },
    {
        "hash": "3373fc119eec9e42f7e3ca4e5728b129cbfab10e",
        "parents": [],
        "author": "TheBrenny",
        "email": "iam+dev@justbrenny.me",
        "date": 1647503762,
        "message": "initial commit",
        "heads": [],
        "tags": [],
        "remotes": [],
        "stash": null
    }
];

class Branch {
    constructor(x, name) {
        this.x = x;
        this.name = name;
    }

    setPriority(priorities) {
        this.x = priorities.indexOf(this.name);
    }
}

class Commit {
    constructor(y, hash, heads) {
        this.hash = hash;
        this.heads = new Set(heads ?? []);
        this.inferredHeads = new Set([]);
        this.y = y;
        this.branch = null;
        this.parents = [];
    }

    get shortHash() {
        return this.hash.substring(0, 6);
    }

    get allHeads() {
        if(!this._allHeads) this._allHeads = Array.from(new Set([...this.heads, ...this.inferredHeads]));//.sort((a, b) => a.x - b.x);
        return this._allHeads;
    }

    // get branch() {
    //     return Array.from(this.allHeads)[0];
    // }
    get x() {
        return this.branch?.x ?? -1;
    }

    addParent(parent) {
        this.parents.push(parent);
    }

    hasHeads() {
        return this.heads.size > 0;
    }
    hasInferredHeads() {
        return this.inferredHeads.size > 0;
    }

    addHeads(heads) {
        if((heads.size > 0 || heads.length > 0)) {
            // if(heads.length > 0 && this.inferredHeads.size === 0) {
            this.inferredHeads.add(...heads);
            this._allHeads = null;
        }
    }

    setBranchAccordingToPriority(priorities) {
        // Set this.branch to it's head/inferred according to the following algorithm:
        // 1. If the commit has heads:
        //    1. If there is only one head, set it as the branch.
        //    2. If there are multiple heads, set the branch to the one with the best priority.
        // 2. Otherwise, if the commit has inferred heads (all commits will have one or the other):
        //    1. If the inferred heads contain priority heads, set the branch to the first priority head
        //    2. Otherwise, set the branch to the first inferred head
        if(this.hasHeads()) {
            this.branch = [...this.heads][0];
        } else {
            assert(this.hasInferredHeads());
            const priorityHeads = [...this.inferredHeads].filter(head => priorities.includes(head.name));
            if(priorityHeads.length > 0) this.branch = priorityHeads[0];
            else this.branch = this.inferredHeads.values()[0];
        }
    }
}

const commitObjs = {};
commits.forEach((commit, index) => {
    commitObjs[commit.hash] = new Commit(index, commit.hash, commit.heads.map(head => new Branch(-1, head)));
});
commits.forEach(commit => {
    commit.parents.forEach(parent => {
        let commitObj = commitObjs[commit.hash];
        let parentObj = commitObjs[parent];

        // Add the parent to this commit
        commitObj.addParent(parentObj);

        if(!parentObj.hasHeads()) {
            parentObj.addHeads([...commitObj.heads, ...commitObj.inferredHeads]);
        }
    });
});

// console.table(Object.values(commitObjs).map(c => ({
//     // y: c.y,
//     // x: c.x ?? "?",
//     // hash: c.shortHash,
//     // heads: Array.from(c.heads).map(b => b.name).join("\n"),
//     // infers: Array.from(c.inferredHeads).map(b => b.name).join(", "),
// })));

const priorities = ["main", "master"];
let changingPriorities = priorities.slice();
for(let c = 0; c < commits.length; c++) {
    let commitObj = commitObjs[commits[c].hash];

    // Set the priority of branch HEADS (only heads, not inferred)
    if(commitObj.hasHeads()) {
        commitObj.heads.forEach(head => {
            head.setPriority(changingPriorities);
            if(head.x === -1) {
                head.x = changingPriorities.length;
                changingPriorities.push(head.name);
            }
        });
    }

    commitObj.setBranchAccordingToPriority(priorities);
}


let sortedObjs = Object.values(commitObjs).slice();
sortedObjs = sortedObjs.sort((a, b) => a.x - b.x);

console.table(Object.values(sortedObjs).map(c => ({
    x: c.x ?? "?",
    y: c.y,
    hash: c.shortHash,
    branch: c.branch?.name ?? "?",
    parents: c.parents.map(p => (`(${p.x}, ${p.y})`)),
    // heads: Array.from(c.heads).map(b => b.name).join(", "),
    // infers: Array.from(c.inferredHeads).map(b => b.name).join(", "),
})));
/* Output
    ┌─────────┬───┬───┬──────────┬──────────┬────────────────────────┐ 
    │ (index) │ x │ y │   hash   │  branch  │        parents         │ 
    ├─────────┼───┼───┼──────────┼──────────┼────────────────────────┤ 
    │    0    │ 0 │ 2 │ '7ad45d' │  'main'  │ [ '(0, 5)', '(1, 4)' ] │ 
    │    1    │ 0 │ 5 │ '3373fc' │  'main'  │           []           │ 
    │    2    │ 1 │ 1 │ 'a5243b' │ 'master' │      [ '(1, 4)' ]      │ 
    │    3    │ 1 │ 4 │ '64881c' │ 'master' │      [ '(0, 5)' ]      │ 
    │    4    │ 2 │ 0 │ '93d171' │ 'second' │ [ '(1, 4)', '(3, 3)' ] │ 
    │    5    │ 3 │ 3 │ 'e8694b' │ 'third'  │      [ '(1, 4)' ]      │ 
    └─────────┴───┴───┴──────────┴──────────┴────────────────────────┘ 
*/

