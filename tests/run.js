#!/usr/bin/env node
"use strict";
/* Headless tests for beamcore (the puzzle logic inside mirrorbeam.html).
   The game is one HTML file by design, so this harness extracts the
   <script id="beamcore"> block, runs it in Node, and asserts the sim
   behaves. The renderer script is compile-checked too. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const htmlPath = path.join(__dirname, "..", "mirrorbeam.html");
const html = fs.readFileSync(htmlPath, "utf8");

function extract(id) {
  const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`));
  assert.ok(m, `script block #${id} not found`);
  return m[1];
}

const coreSrc = extract("beamcore");

// 1. the renderer script must at least parse (it needs a DOM to actually run)
const renderMatch = html.match(/<script>\n\/\* renderer[\s\S]*?<\/script>/);
assert.ok(renderMatch, "renderer script block not found");
new vm.Script(renderMatch[0].replace(/^<script>/, "").replace(/<\/script>$/, ""),
  { filename: "renderer.js" });
console.log("ok  - renderer script parses");

// run the core in a sandbox; it only declares beamcore + LEVELS
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(coreSrc + "\n;globalThis.__out = { beamcore, LEVELS };", sandbox);
const { beamcore, LEVELS } = sandbox.__out;
const { trace, solve, reflect, initialOrientations, isSolved } = beamcore;

let passed = 0;
function check(name, cond) {
  assert.ok(cond, name);
  passed++;
  console.log("ok  - " + name);
}

// --- reflection rules -------------------------------------------------------
check("'/' sends E->N", reflect("/", "E") === "N");
check("'/' sends N->E", reflect("/", "N") === "E");
check("'/' sends W->S", reflect("/", "W") === "S");
check("'/' sends S->W", reflect("/", "S") === "W");
check("'\\' sends E->S", reflect("\\", "E") === "S");
check("'\\' sends S->E", reflect("\\", "S") === "E");
check("'\\' sends W->N", reflect("\\", "W") === "N");
check("'\\' sends N->W", reflect("\\", "N") === "W");

// --- tracing basics ---------------------------------------------------------
const straight = { cols: 5, rows: 1, emitter: { x: 0, y: 0, dir: "E" },
  targets: [{ x: 4, y: 0 }], blocks: [], mirrors: [] };
check("straight beam reaches the target", trace(straight).lit.join() === "0");
check("straight beam path is 5 cells", trace(straight).path.length === 5);

const blocked = { cols: 5, rows: 1, emitter: { x: 0, y: 0, dir: "E" },
  targets: [{ x: 4, y: 0 }], blocks: [{ x: 2, y: 0 }], mirrors: [] };
const bt = trace(blocked);
check("block absorbs the beam", bt.blocked === true && bt.lit.length === 0);
check("beam stops at the block", bt.path[bt.path.length - 1].join() === "2,0");

const twoTargets = { cols: 5, rows: 1, emitter: { x: 0, y: 0, dir: "E" },
  targets: [{ x: 2, y: 0 }, { x: 4, y: 0 }], blocks: [], mirrors: [] };
check("beam passes through targets and lights both",
  trace(twoTargets).lit.join() === "0,1");

const turn = { cols: 5, rows: 5, emitter: { x: 0, y: 2, dir: "E" },
  targets: [{ x: 2, y: 0 }], blocks: [],
  mirrors: [{ x: 2, y: 2, orient: "/", fixed: false }] };
check("'/' mirror turns the beam up onto the target", trace(turn).lit.join() === "0");

const turnBack = { cols: 5, rows: 5, emitter: { x: 0, y: 2, dir: "E" },
  targets: [{ x: 2, y: 0 }], blocks: [],
  mirrors: [{ x: 2, y: 2, orient: "\\", fixed: false }] };
check("'\\' mirror turns the beam away from the target", trace(turnBack).lit.length === 0);

// --- loops terminate --------------------------------------------------------
// A closed 4-mirror orbit, emitter placed on the orbit itself so the beam
// enters it. Without loop detection this would run forever.
const loopLevel = { cols: 10, rows: 10, emitter: { x: 4, y: 2, dir: "W" },
  targets: [], blocks: [],
  mirrors: [
    { x: 3, y: 2, orient: "/", fixed: false },
    { x: 3, y: 5, orient: "\\", fixed: false },
    { x: 6, y: 5, orient: "/", fixed: false },
    { x: 6, y: 2, orient: "\\", fixed: false }] };
const lt = trace(loopLevel);
check("beam trapped in a mirror loop is detected, not infinite",
  lt.looped === true && lt.path.length < 100);

// --- the solver -------------------------------------------------------------
const unsolvable = { cols: 5, rows: 5, emitter: { x: 0, y: 0, dir: "E" },
  targets: [{ x: 4, y: 4 }], blocks: [],
  mirrors: [{ x: 2, y: 0, orient: "/", fixed: false }] };
check("solver returns null for a level no mirror can fix", solve(unsolvable) === null);

const trivial = { cols: 5, rows: 1, emitter: { x: 0, y: 0, dir: "E" },
  targets: [{ x: 4, y: 0 }], blocks: [], mirrors: [] };
check("already-solved level needs 0 moves", solve(trivial).moves === 0);

// --- every shipped level: unsolved at start, solvable, par as designed ------
const EXPECTED_PAR = [1, 2, 4, 3, 4, 5, 6, 4, 6, 6];
check("10 levels shipped", LEVELS.length === 10);
LEVELS.forEach((lv, i) => {
  const start = initialOrientations(lv);
  check(`level ${i + 1} (${lv.name}) starts unsolved`, !isSolved(lv, start));
  const s = solve(lv);
  check(`level ${i + 1} (${lv.name}) is solvable`, s !== null);
  check(`level ${i + 1} (${lv.name}) par is ${EXPECTED_PAR[i]}`,
    s !== null && s.moves === EXPECTED_PAR[i]);
  // applying the solver's flips really does solve it
  const ov = Object.assign({}, start);
  s.flips.forEach((key) => { ov[key] = ov[key] === "/" ? "\\" : "/"; });
  check(`level ${i + 1} (${lv.name}) solver flips solve it`, isSolved(lv, ov));
  // solving from a scrambled board still works (the Hint button relies on this)
  const scrambled = Object.assign({}, start);
  lv.mirrors.filter((m) => !m.fixed).forEach((m) => {
    scrambled[m.x + "," + m.y] = scrambled[m.x + "," + m.y] === "/" ? "\\" : "/";
  });
  const s2 = solve(lv, scrambled);
  check(`level ${i + 1} (${lv.name}) solvable from a scrambled board`, s2 !== null);
});

// --- level data sanity -------------------------------------------------------
LEVELS.forEach((lv, i) => {
  const inBounds = (c) => c.x >= 0 && c.y >= 0 && c.x < lv.cols && c.y < lv.rows;
  check(`level ${i + 1} emitter/targets/blocks/mirrors all on the board`,
    inBounds(lv.emitter) && lv.targets.every(inBounds) &&
    lv.blocks.every(inBounds) && lv.mirrors.every(inBounds));
  const occupied = new Set();
  [...lv.targets, ...lv.blocks, ...lv.mirrors].forEach((c) => {
    const k = c.x + "," + c.y;
    assert.ok(!occupied.has(k), `level ${i + 1}: two things on cell ${k}`);
    occupied.add(k);
  });
  check(`level ${i + 1} no two objects share a cell`, true);
});

console.log(`\n${passed} checks passed.`);
