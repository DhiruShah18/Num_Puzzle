/**
 * ============================================================
 *  8-PUZZLE SOLVER — script.js
 *  Artificial Intelligence Class Demo
 *
 *  Features:
 *    - Manual tile sliding with click
 *    - Manhattan Distance heuristic (per tile + total)
 *    - A* Search solver (optimal)
 *    - Greedy Best-First Search solver (fast, non-optimal)
 *    - Step-by-step animated AI solution playback
 * ============================================================
 */

"use strict";

/* ============================================================
   SOUND ENGINE  (Web Audio API — no external files needed)
   ============================================================ */

const SFX = (() => {
  let ctx = null;
  let bgGain = null;
  let bgOscillators = [];
  let bgStarted = false;

  /** Lazily create the AudioContext (must be triggered by user gesture) */
  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      _buildBackground();
    }
    // Resume if suspended (browser autoplay policy)
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /** Low ambient drone — two detuned oscillators + LFO tremolo */
  function _buildBackground() {
    bgGain = ctx.createGain();
    bgGain.gain.setValueAtTime(0, ctx.currentTime);
    bgGain.connect(ctx.destination);

    const freqs = [55, 55.3]; // low A + slight detune
    freqs.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      // Slow tremolo via LFO
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.18;
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfo.start();

      const oscGain = ctx.createGain();
      oscGain.gain.value = 0.07;
      lfoGain.connect(oscGain.gain);

      osc.connect(oscGain);
      oscGain.connect(bgGain);
      osc.start();
      bgOscillators.push(osc);
    });
  }

  /** Fade background music in */
  function startBg() {
    if (!bgStarted) {
      getCtx();
      bgGain.gain.cancelScheduledValues(ctx.currentTime);
      bgGain.gain.setValueAtTime(0, ctx.currentTime);
      bgGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5);
      bgStarted = true;
    }
  }

  /** Fade background music out */
  function stopBg() {
    if (!ctx || !bgGain) return;
    bgGain.gain.cancelScheduledValues(ctx.currentTime);
    bgGain.gain.setValueAtTime(bgGain.gain.value, ctx.currentTime);
    bgGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
    bgStarted = false;
  }

  /** Short percussive "click-slide" for tile movement */
  function tileMove() {
    const c = getCtx();
    const now = c.currentTime;

    // Noise burst (attack transient)
    const bufSize = c.sampleRate * 0.04;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const noise = c.createBufferSource();
    noise.buffer = buf;

    const noiseFilter = c.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 2;

    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.18, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(c.destination);
    noise.start(now);
    noise.stop(now + 0.06);

    // Tonal "thud"
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);

    const oscGain = c.createGain();
    oscGain.gain.setValueAtTime(0.22, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

    osc.connect(oscGain);
    oscGain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.10);
  }

  /** Victory fanfare — ascending arpeggio + sparkle */
  function win() {
    const c = getCtx();
    const now = c.currentTime;

    // Mute background for the fanfare
    if (bgGain) {
      bgGain.gain.cancelScheduledValues(now);
      bgGain.gain.setValueAtTime(bgGain.gain.value, now);
      bgGain.gain.linearRampToValueAtTime(0.15, now + 0.3);
    }

    // Note sequence: C4 E4 G4 C5 E5 G5 C6
    const notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.50];
    const spacing = 0.13;

    notes.forEach((freq, i) => {
      const t = now + i * spacing;
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;

      const gain = c.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      // Chorus-like detune on upper notes
      if (i >= 3) osc.detune.value = 5;

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });

    // Shimmery high sparkle overlay
    [1318.5, 1567.98, 2093].forEach((freq, i) => {
      const t = now + 0.55 + i * 0.09;
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const gain = c.createGain();
      gain.gain.setValueAtTime(0.10, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  return { startBg, stopBg, tileMove, win };
})();

/* ============================================================
   CONSTANTS & GOAL STATE
   ============================================================ */

/** The solved / goal configuration (0 = empty tile) */
const GOAL_STATE = [1, 2, 3, 4, 5, 6, 7, 8, 0];

/** Move directions: [row delta, col delta, label] */
const DIRECTIONS = [
  [-1,  0, "↑ UP"],
  [ 1,  0, "↓ DOWN"],
  [ 0, -1, "← LEFT"],
  [ 0,  1, "→ RIGHT"],
];

/* ============================================================
   STATE
   ============================================================ */

let state = {
  board:       [...GOAL_STATE],  // current 9-element flat array
  initialBoard:[...GOAL_STATE],  // board at start of current game
  moves:       0,
  solved:      false,
  aiRunning:   false,
  aiTimer:     null,             // setInterval handle during AI playback
  aiSteps:     [],               // solution move sequence from solver
  aiStepIndex: 0,
};

/* ============================================================
   UTILITIES
   ============================================================ */

/**
 * Convert flat index to [row, col]
 * @param {number} idx  0–8
 * @returns {[number,number]}
 */
const idxToPos = idx => [Math.floor(idx / 3), idx % 3];

/**
 * Convert [row, col] to flat index
 * @param {number} r
 * @param {number} c
 * @returns {number}
 */
const posToIdx = (r, c) => r * 3 + c;

/**
 * Deep copy a flat 9-element board array
 * @param {number[]} board
 * @returns {number[]}
 */
const copyBoard = board => [...board];

/**
 * Check if two boards are equal
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean}
 */
const boardsEqual = (a, b) => a.every((v, i) => v === b[i]);

/**
 * Serialize a board to a string key (for visited set)
 * @param {number[]} board
 * @returns {string}
 */
const boardKey = board => board.join(",");

/* ============================================================
   HEURISTIC — Manhattan Distance
   ============================================================

   For each tile t (1–8):
     goalRow = Math.floor((t-1) / 3)
     goalCol = (t-1) % 3
     currentRow = row of t in current board
     currentCol = col of t in current board
     distance[t] = |currentRow - goalRow| + |currentCol - goalCol|

   Total h(n) = sum of all distances
*/

/**
 * Compute Manhattan distance for a single tile value
 * @param {number} value  tile number 1–8
 * @param {number} idx    current flat index of that tile
 * @returns {number}
 */
function tileDistance(value, idx) {
  if (value === 0) return 0;                     // empty tile: ignore
  const [cr, cc] = idxToPos(idx);               // current pos
  const [gr, gc] = idxToPos(value - 1);         // goal pos (1→0, 2→1, … 8→7)
  return Math.abs(cr - gr) + Math.abs(cc - gc);
}

/**
 * Compute total Manhattan Distance heuristic h(n) for a board
 * @param {number[]} board
 * @returns {number}
 */
function manhattanDistance(board) {
  return board.reduce((sum, val, idx) => sum + tileDistance(val, idx), 0);
}

/**
 * Get per-tile distance breakdown for display
 * @param {number[]} board
 * @returns {{value:number, dist:number}[]}  only tiles 1–8
 */
function tileDistances(board) {
  return board
    .map((val, idx) => ({ value: val, dist: tileDistance(val, idx) }))
    .filter(t => t.value !== 0);
}

/* ============================================================
   SOLVABILITY CHECK

   An 8-puzzle is solvable if and only if the number of
   inversions in the flat array (ignoring 0) is even.

   An inversion is a pair (i,j) where i < j but board[i] > board[j].
*/

/**
 * Count inversions in a board (ignoring the empty tile 0)
 * @param {number[]} board
 * @returns {number}
 */
function countInversions(board) {
  const tiles = board.filter(v => v !== 0);
  let count = 0;
  for (let i = 0; i < tiles.length; i++)
    for (let j = i + 1; j < tiles.length; j++)
      if (tiles[i] > tiles[j]) count++;
  return count;
}

/**
 * Shuffle a board randomly, ensuring the result is solvable
 * @returns {number[]}
 */
function shuffleBoard() {
  let board;
  do {
    board = [...GOAL_STATE].sort(() => Math.random() - 0.5);
  } while (
    countInversions(board) % 2 !== 0 || // must be solvable
    boardsEqual(board, GOAL_STATE)       // must not already be solved
  );
  return board;
}

/* ============================================================
   MOVE LOGIC
   ============================================================ */

/**
 * Find the flat index of the empty tile (0)
 * @param {number[]} board
 * @returns {number}
 */
const findEmpty = board => board.indexOf(0);

/**
 * Get all valid neighbor boards (one tile slide each)
 * Returns array of { board, tileValue, direction }
 * @param {number[]} board
 * @returns {{board:number[], tileValue:number, direction:string}[]}
 */
function getNeighbors(board) {
  const emptyIdx = findEmpty(board);
  const [er, ec] = idxToPos(emptyIdx);
  const neighbors = [];

  for (const [dr, dc, label] of DIRECTIONS) {
    const nr = er + dr, nc = ec + dc;
    if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
    const tileIdx = posToIdx(nr, nc);
    const newBoard = copyBoard(board);
    // Swap empty with tile
    [newBoard[emptyIdx], newBoard[tileIdx]] = [newBoard[tileIdx], newBoard[emptyIdx]];
    neighbors.push({ board: newBoard, tileValue: board[tileIdx], direction: label });
  }
  return neighbors;
}

/**
 * Attempt to move a tile at `tileIdx` into the empty space.
 * Returns true if the move was valid and applied.
 * @param {number} tileIdx  flat index of clicked tile
 * @returns {boolean}
 */
function moveTile(tileIdx) {
  if (state.solved || state.aiRunning) return false;

  const emptyIdx = findEmpty(state.board);
  const [er, ec] = idxToPos(emptyIdx);
  const [tr, tc] = idxToPos(tileIdx);

  // Only adjacent (not diagonal) tiles can move
  const adjacent = (Math.abs(er - tr) + Math.abs(ec - tc)) === 1;
  if (!adjacent) return false;

  // Perform the swap
  const newBoard = copyBoard(state.board);
  [newBoard[emptyIdx], newBoard[tileIdx]] = [newBoard[tileIdx], newBoard[emptyIdx]];
  state.board = newBoard;
  state.moves++;

  SFX.tileMove();
  renderBoard(tileIdx);   // pass the moved tile index for animation
  updateInfoPanel();

  if (boardsEqual(state.board, GOAL_STATE)) triggerSolved();
  return true;
}

/* ============================================================
   A* SEARCH
   ============================================================

   f(n) = g(n) + h(n)
     g(n) = number of moves from start (path cost)
     h(n) = Manhattan Distance heuristic

   The algorithm expands the node with the lowest f(n) first.
   It is complete and optimal when h is admissible (never overestimates).
   Manhattan Distance is admissible for the 8-puzzle.

   Returns: array of {direction, board, g, h} steps, or null if unsolvable.
*/

/**
 * Simple min-heap (priority queue) for A* / Greedy
 * Stores {f, g, h, board, path}
 */
class MinHeap {
  constructor() { this.data = []; }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.data[parent].f <= this.data[i].f) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2*i+1, r = 2*i+2;
      if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
      if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
      i = smallest;
    }
  }
}

/**
 * Run A* Search from a given start board.
 * @param {number[]} startBoard
 * @param {boolean} greedy  if true, use Greedy BFS (f = h only)
 * @returns {{ steps: {direction:string, board:number[], g:number, h:number}[], nodesExpanded:number } | null}
 */
function solveAStar(startBoard, greedy = false) {
  const h0 = manhattanDistance(startBoard);
  const heap = new MinHeap();
  // Each node: { f, g, h, board, path:[{direction, board, g, h}] }
  heap.push({ f: h0, g: 0, h: h0, board: startBoard, path: [] });

  const visited = new Set();
  visited.add(boardKey(startBoard));

  let nodesExpanded = 0;
  const MAX_NODES = 200000; // safety limit

  while (heap.size > 0 && nodesExpanded < MAX_NODES) {
    const { g, board, path } = heap.pop();
    nodesExpanded++;

    // Goal check
    if (boardsEqual(board, GOAL_STATE)) {
      return { steps: path, nodesExpanded };
    }

    // Expand neighbors
    for (const { board: nb, tileValue, direction } of getNeighbors(board)) {
      const key = boardKey(nb);
      if (visited.has(key)) continue;
      visited.add(key);

      const ng = g + 1;
      const nh = manhattanDistance(nb);
      const nf = greedy ? nh : ng + nh;  // A*: g+h  |  Greedy: h only

      const stepRecord = { direction, board: nb, g: ng, h: nh, tile: tileValue };
      heap.push({ f: nf, g: ng, h: nh, board: nb, path: [...path, stepRecord] });
    }
  }

  return null; // No solution found (shouldn't happen for solvable puzzles)
}

/* ============================================================
   DOM HELPERS
   ============================================================ */

/** Show a screen by id */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.remove("active");
    s.style.display = "none";
  });
  const el = document.getElementById(id);
  el.style.display = "flex";
  // Trigger reflow for transition
  requestAnimationFrame(() => el.classList.add("active"));
}

/* ============================================================
   RENDER FUNCTIONS
   ============================================================ */

/**
 * Render the 3×3 puzzle board to the DOM.
 * @param {number|null} movedTileIdx  flat index of the tile that just moved (for animation)
 */
function renderBoard(movedTileIdx = null) {
  const boardEl = document.getElementById("puzzle-board");
  boardEl.innerHTML = "";

  const emptyIdx = findEmpty(state.board);
  const [er, ec] = idxToPos(emptyIdx);

  state.board.forEach((val, idx) => {
    const tile = document.createElement("div");
    tile.className = "tile";

    if (val === 0) {
      tile.classList.add("empty");
    } else {
      const dist = tileDistance(val, idx);

      // Highlight tiles in-place
      if (dist === 0) tile.classList.add("in-place");

      // Highlight movable tiles (adjacent to empty)
      const [r, c] = idxToPos(idx);
      const adjacentToEmpty = (Math.abs(r - er) + Math.abs(c - ec)) === 1;
      if (adjacentToEmpty) tile.classList.add("movable");

      // Tile number
      const numEl = document.createElement("div");
      numEl.className = "tile-num";
      numEl.textContent = val;

      // Manhattan distance badge
      const distEl = document.createElement("div");
      distEl.className = "tile-dist" + (dist === 0 ? " tile-dist-zero" : "");
      distEl.textContent = dist === 0 ? "✓" : `h=${dist}`;

      tile.appendChild(numEl);
      tile.appendChild(distEl);
      tile.addEventListener("click", () => moveTile(idx));
    }

    // Animate the tile that just moved
    if (idx === movedTileIdx || (movedTileIdx === emptyIdx)) {
      // We animate the tile that moved into the empty slot
    }
    if (val !== 0 && idx === emptyIdx) {
      // This is where the empty used to be — animate the tile that is now here
      tile.classList.add("just-moved");
    }

    boardEl.appendChild(tile);
  });
}

/**
 * Render the goal state reference grid
 */
function renderGoalGrid() {
  const el = document.getElementById("goalGrid");
  el.innerHTML = "";
  GOAL_STATE.forEach(val => {
    const cell = document.createElement("div");
    cell.className = "goal-cell" + (val === 0 ? " goal-empty" : "");
    cell.textContent = val || "";
    el.appendChild(cell);
  });
}

/**
 * Render the menu preview grid (shows a shuffled board for aesthetics)
 */
function renderMenuPreview() {
  const preview = [1, 4, 2, 7, 0, 3, 8, 5, 6]; // interesting-looking partial board
  const el = document.getElementById("menuPreview");
  el.innerHTML = "";
  preview.forEach(val => {
    const tile = document.createElement("div");
    tile.className = "menu-tile" + (val === 0 ? " empty" : "");
    tile.textContent = val || "";
    el.appendChild(tile);
  });
}

/**
 * Update the info panel stats and Manhattan breakdown
 */
function updateInfoPanel() {
  const h = manhattanDistance(state.board);

  // Stats
  document.getElementById("moveCount").textContent  = state.moves;
  document.getElementById("heuristicVal").textContent = h;

  const statusEl = document.getElementById("statusText");
  if (state.solved) {
    statusEl.textContent = "SOLVED ✓";
    statusEl.className   = "stat-val status-solved";
  } else if (state.aiRunning) {
    statusEl.textContent = "AI RUNNING";
    statusEl.className   = "stat-val status-ai";
  } else {
    statusEl.textContent = "PLAYING";
    statusEl.className   = "stat-val status-play";
  }

  // Distance breakdown
  const breakdown = tileDistances(state.board);
  const maxDist   = 6; // max possible per tile in a 3×3
  const listEl    = document.getElementById("distanceBreakdown");
  listEl.innerHTML = "";
  breakdown.sort((a, b) => a.value - b.value).forEach(({ value, dist }) => {
    const row = document.createElement("div");
    row.className = "dist-row" + (dist === 0 ? " zero" : "");
    row.innerHTML = `
      <span class="tile-id">${value}</span>
      <div class="dist-bar-wrap">
        <div class="dist-bar" style="width:${Math.min(100, (dist/maxDist)*100)}%"></div>
      </div>
      <span class="dist-num">${dist}</span>
    `;
    listEl.appendChild(row);
  });
  document.getElementById("distanceTotal").textContent = h;
}

/**
 * Render the AI solution steps list in the right panel
 * @param {Array} steps
 * @param {number} nodesExpanded
 * @param {string} algoName
 */
function renderSolutionSteps(steps, nodesExpanded, algoName) {
  const stepsEl = document.getElementById("solutionSteps");
  const metaEl  = document.getElementById("solutionMeta");

  metaEl.textContent = `${algoName} · ${steps.length} moves · ${nodesExpanded} nodes expanded`;
  stepsEl.innerHTML  = "";

  steps.forEach((step, i) => {
    const item = document.createElement("div");
    item.className   = "step-item";
    item.id          = `step-${i}`;
    item.innerHTML   = `
      <span class="step-num">${i + 1}.</span>
      <span>Move <strong style="color:var(--green)">${step.tile}</strong></span>
      <span class="step-dir">${step.direction}</span>
      <span class="step-h">h=${step.h}</span>
    `;
    stepsEl.appendChild(item);
  });
}

/**
 * Highlight the current AI step in the steps list
 * @param {number} stepIndex
 */
function highlightStep(stepIndex) {
  document.querySelectorAll(".step-item").forEach(el => el.classList.remove("active"));
  const el = document.getElementById(`step-${stepIndex}`);
  if (el) {
    el.classList.add("active");
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

/* ============================================================
   GAME ACTIONS
   ============================================================ */

/**
 * Start a new game with a shuffled board
 */
function startGame() {
  stopAI();
  state.board        = shuffleBoard();
  state.initialBoard = copyBoard(state.board);
  state.moves        = 0;
  state.solved       = false;
  state.aiSteps      = [];
  state.aiStepIndex  = 0;

  document.getElementById("solved-overlay").style.display = "none";
  document.getElementById("solutionSteps").innerHTML = '<span class="muted">No solution computed yet.</span>';
  document.getElementById("solutionMeta").textContent = "";
  document.getElementById("aiInfoBox").innerHTML = 'Select an algorithm and press <strong>SOLVE WITH AI</strong> to watch the puzzle solve step by step.';

  renderBoard();
  updateInfoPanel();
  showScreen("screen-game");
  SFX.startBg();
}

/**
 * Restart to the board as it was at the start of this game
 */
function restartGame() {
  stopAI();
  state.board       = copyBoard(state.initialBoard);
  state.moves       = 0;
  state.solved      = false;
  state.aiSteps     = [];
  state.aiStepIndex = 0;

  document.getElementById("solved-overlay").style.display = "none";
  document.getElementById("solutionSteps").innerHTML = '<span class="muted">No solution computed yet.</span>';
  document.getElementById("solutionMeta").textContent = "";
  document.getElementById("aiInfoBox").innerHTML = 'Select an algorithm and press <strong>SOLVE WITH AI</strong> to watch the puzzle solve step by step.';

  renderBoard();
  updateInfoPanel();
}

/**
 * Show the solved overlay
 */
function triggerSolved() {
  state.solved = true;
  SFX.win();
  updateInfoPanel();
  document.getElementById("solvedMoves").textContent = `Solved in ${state.moves} move${state.moves !== 1 ? "s" : ""}`;
  document.getElementById("solved-overlay").style.display = "flex";
}

/* ============================================================
   AI SOLVER ACTIONS
   ============================================================ */

/**
 * Run the selected algorithm, display solution path, then animate it
 */
function runAISolver() {
  if (state.solved) return;
  stopAI();

  const algo    = document.querySelector('input[name="algo"]:checked').value;
  const greedy  = algo === "greedy";
  const algoName = greedy ? "Greedy Best-First Search" : "A* Search";

  // Update badge
  document.getElementById("algoBadge").textContent = greedy ? "GREEDY BFS" : "A* SEARCH";

  // Update info box
  document.getElementById("aiInfoBox").innerHTML =
    `<strong>Running ${algoName}…</strong><br/>Computing optimal path…`;

  // Run solver (synchronous; fast enough for 8-puzzle)
  const result = solveAStar(state.board, greedy);

  if (!result || result.steps.length === 0) {
    document.getElementById("aiInfoBox").innerHTML =
      '<strong>Already solved!</strong> The puzzle is at the goal state.';
    return;
  }

  const { steps, nodesExpanded } = result;
  state.aiSteps     = steps;
  state.aiStepIndex = 0;

  // Render the step list in the right panel
  renderSolutionSteps(steps, nodesExpanded, algoName);

  // Update info box
  document.getElementById("aiInfoBox").innerHTML =
    `<strong>${algoName}</strong><br/>
     Solution: <span style="color:var(--green)">${steps.length} moves</span><br/>
     Nodes expanded: <span style="color:var(--amber)">${nodesExpanded}</span><br/>
     Animating step-by-step…`;

  // Disable controls during AI play
  state.aiRunning = true;
  updateInfoPanel();
  toggleSolveButtons(true);

  // Animate each step
  const STEP_DELAY = 420; // ms between moves
  state.aiTimer = setInterval(() => {
    if (state.aiStepIndex >= state.aiSteps.length) {
      clearInterval(state.aiTimer);
      state.aiRunning = false;
      toggleSolveButtons(false);
      triggerSolved();
      return;
    }

    const step = state.aiSteps[state.aiStepIndex];
    state.board = step.board;
    state.moves++;
    SFX.tileMove();
    highlightStep(state.aiStepIndex);
    renderBoard();
    updateInfoPanel();
    state.aiStepIndex++;
  }, STEP_DELAY);
}

/**
 * Stop any running AI animation
 */
function stopAI() {
  if (state.aiTimer) {
    clearInterval(state.aiTimer);
    state.aiTimer = null;
  }
  state.aiRunning = false;
  toggleSolveButtons(false);
}

/**
 * Toggle button states based on whether AI is running
 * @param {boolean} running
 */
function toggleSolveButtons(running) {
  document.getElementById("btnSolve").style.display    = running ? "none"  : "block";
  document.getElementById("btnStopSolve").style.display = running ? "block" : "none";
  document.getElementById("btnShuffle").disabled  = running;
  document.getElementById("btnRestart").disabled  = running;
  document.getElementById("btnMainMenu").disabled = running;
  updateInfoPanel();
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  // Render static elements
  renderMenuPreview();
  renderGoalGrid();

  // ---- Menu Screen ----
  document.getElementById("btnStartGame").addEventListener("click", startGame);
  document.getElementById("btnAbout").addEventListener("click", () => {
    document.getElementById("aboutModal").style.display = "flex";
  });
  document.getElementById("btnCloseAbout").addEventListener("click", () => {
    document.getElementById("aboutModal").style.display = "none";
  });

  // ---- Game Controls ----
  document.getElementById("btnMainMenu").addEventListener("click", () => {
    stopAI();
    SFX.stopBg();
    showScreen("screen-menu");
  });
  document.getElementById("btnShuffle").addEventListener("click", startGame);
  document.getElementById("btnRestart").addEventListener("click", restartGame);
  document.getElementById("btnSolve").addEventListener("click", runAISolver);
  document.getElementById("btnStopSolve").addEventListener("click", () => {
    stopAI();
    document.getElementById("aiInfoBox").innerHTML =
      'AI stopped. Press <strong>SOLVE WITH AI</strong> to try again.';
  });

  // ---- Algorithm radio: update badge label ----
  document.querySelectorAll('input[name="algo"]').forEach(radio => {
    radio.addEventListener("change", () => {
      const isGreedy = radio.value === "greedy";
      document.getElementById("algoBadge").textContent = isGreedy ? "GREEDY BFS" : "A* SEARCH";
    });
  });

  // Kick off on menu screen
  showScreen("screen-menu");
});

/* ============================================================
   END OF script.js
   ============================================================ */