# mirrorbeam

A laser mirror puzzle in a single HTML file. Rotate the mirrors, bend the
beam, light every target.

No build step, no dependencies, no server. Open `mirrorbeam.html` in a
browser and you're playing.

## Play it

Double-click `mirrorbeam.html`, or serve the folder however you like:

```
python3 -m http.server
# then open http://localhost:8000/mirrorbeam.html
```

**How to play**

- Click a mirror to rotate it 90°. `/` and `\` bend the beam in different
  directions, so the same mirror does two different jobs depending on how
  it sits.
- The laser fires from the red emitter and bounces until it leaves the board
  or a grey block swallows it.
- Light every amber target to clear the level. The beam passes *through* a
  target and keeps going, so one beam can light several.
- Fixed mirrors (with a dot in the middle) can't be turned — plan around them.

**Controls**

- Mouse / touch — click a mirror to rotate it
- Arrow keys — move the cursor, Space / Enter — rotate
- R — reset the level, H — hint, N — next level after a win

Your best move count per level is saved in the browser.

## The levels

| # | Name | What it teaches |
|---|------|-----------------|
| 1 | First Light | Rotating a mirror, in one move |
| 2 | Around the Corner | Two mirrors, one path |
| 3 | The Long Way | A block in the way — go around it |
| 4 | Triple Threat | One beam, three targets |
| 5 | Crossfire | Fixed mirrors you can't turn |
| 6 | Zigzag | Five mirrors, one long path |
| 7 | Double Back | Six mirrors, up and over |
| 8 | Slalom | The emitter fires from the other side |
| 9 | The Gauntlet | Six mirrors and two blocks |
| 10 | Final Exam | Two targets, two red-herring mirrors |

Every level shows its **par** — the fewest moves any solution needs. Par isn't
something I typed in by hand; the game works it out with a built-in solver
(see below), so it's always honest.

## Why I made this

I kept seeing puzzle games that needed an install, an account, or a 40 MB
download for what is really a grid and a ray. I wanted the opposite: one file
you can send to a friend, double-click, and be stuck on level 5 within a
minute. The solver started as a way to check my own levels weren't broken —
turns out it's also the best feature, because it means par is real and the
Hint button actually knows the next move instead of guessing.

## How the beam works

Everything puzzle-related lives in `beamcore`, a DOM-free block inside
`mirrorbeam.html`:

- `trace(level, overrides)` — walks the beam cell by cell from the emitter,
  reflecting off mirrors, lighting targets it crosses, stopping at blocks or
  the board edge. It tracks every (cell, direction) pair it visits, so a beam
  caught in a mirror loop is detected instead of spinning forever.
- `solve(level, startOv)` — breadth-first search over mirror orientations.
  Each move flips one rotatable mirror, so BFS finds the fewest rotations that
  light every target. The game uses it for par and for hints; the tests use
  it to prove every level is solvable.
- `LEVELS` — the ten hand-built levels as plain data. No level is generated;
  I placed every mirror and then let the solver tell me if the level was
  fair.

The renderer is a separate script block: canvas drawing, the animated beam,
input, HUD, a small WebAudio blip for rotations, and localStorage bests.

## Tests

The core is tested headlessly — `tests/run.js` pulls `beamcore` out of the
HTML and drives it in Node, no browser needed:

```
node tests/run.js
```

89 checks: reflection rules for both mirror types in all four directions,
beam stopping at blocks and board edges, targets lighting through, loop
detection, solver returning null for an impossible level, and — for every
shipped level — that it starts unsolved, that the solver can finish it, that
the solver's moves match the designed par, and that it's still solvable from
a scrambled board. The renderer script is compile-checked too.

## Limitations, honestly

- No level editor — adding a level means editing the `LEVELS` array by hand.
- No touch-drag; it's tap-to-rotate, which is fine on a phone but not fancy.
- The solver is exhaustive BFS, so it gets slow past about a dozen rotatable
  mirrors. Ten levels with at most eight was the practical ceiling.
- Sound is a couple of oscillator blips with a mute toggle; there's no music.
- Best scores live in localStorage, so they don't follow you across browsers.

## Project structure

```
mirrorbeam/
  mirrorbeam.html   # the whole game: beamcore + levels + canvas renderer
  tests/
    run.js          # headless Node tests for beamcore (node tests/run.js)
  README.md
  LICENSE
```

## License

MIT — see [LICENSE](LICENSE).

## Author

Krrish — [github.com/codewithkrrish](https://github.com/codewithkrrish)
