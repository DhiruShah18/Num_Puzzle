# Num_Puzzle
# 🧩 8-Puzzle Solver


## 📖 About

The **8-Puzzle Solver** is an interactive browser-based demo built for an Artificial Intelligence class. It lets you manually slide tiles or watch an AI algorithm solve the puzzle step by step — with real-time heuristic feedback.

The goal is to arrange the tiles on a 3×3 grid to match the target state:

```
1  2  3
4  5  6
7  8  _
```

---

## ✨ Features

- 🎮 **Manual Play** — Click adjacent tiles to slide them into the empty space
- 🤖 **AI Solver** — Watch the puzzle solve itself automatically, step by step
- 📊 **A\* Search** — Finds the optimal (shortest) solution using `f(n) = g(n) + h(n)`
- ⚡ **Greedy Best-First Search** — Faster but not guaranteed to be optimal
- 📐 **Manhattan Distance** — Live per-tile heuristic breakdown shown in the panel
- 🔢 **Solution Path** — Full move-by-move AI solution displayed with tile and direction
- 🔊 **Sound Effects** — Tile slide sounds, ambient background music, and a win fanfare
- 🎨 **Retro Terminal UI** — Green-on-dark aesthetic with scanlines and glow effects

---

## 🧠 Algorithms

### A* Search
Expands the node with the lowest `f(n) = g(n) + h(n)`:
- `g(n)` = number of moves made so far (path cost)
- `h(n)` = Manhattan Distance heuristic (estimated cost to goal)

Guaranteed to find the **optimal solution** since Manhattan Distance is admissible (never overestimates).

### Greedy Best-First Search
Expands the node with the lowest `h(n)` only — ignores path cost. Faster in practice but **not guaranteed** to find the shortest path.

### Manhattan Distance Heuristic
For each tile, calculates the horizontal + vertical steps needed to reach its goal position:

```
h(n) = Σ |currentRow - goalRow| + |currentCol - goalCol|
```

---

## 🚀 Getting Started

No installation or build step required. Just open the file in a browser.

```bash
# Clone the repository
git clone https://github.com/DhiruShah18/Num_Puzzle.git

# Open in browser
open index.html
```

Or simply download the ZIP and open `index.html` directly.

---

## 📁 Project Structure

```
Num_Puzzle/
├── index.html      # Main HTML — screens, layout, modals
├── style.css       # Retro terminal styling & animations
├── script.js       # Game logic, A* solver, sound engine
└── README.md       # You are here
```

---

## 🎮 How to Play

1. Click **▶ START GAME** on the main menu
2. A shuffled (solvable) board is generated automatically
3. **Manual mode** — click any tile adjacent to the empty space to slide it
4. **AI mode** — select A* or Greedy BFS, then click **🤖 SOLVE WITH AI**
5. Watch the AI animate each step and highlight the solution path
6. Click **🔀 SHUFFLE** for a new puzzle or **↺ RESTART** to reset to the starting board

---

## 🔊 Sound System

Built entirely with the **Web Audio API** — no external audio files needed:

| Sound | Trigger |
|---|---|
| 🎵 Ambient drone | Plays when game screen is entered |
| 🔲 Tile click | Every tile slide (manual or AI) |
| 🏆 Win fanfare | Ascending arpeggio when puzzle is solved |

---

## 📸 Screenshot

> *Retro terminal green-on-dark UI with live Manhattan Distance breakdown*

---

## 👨‍💻 Developer

**Dhirajan Shah**
Artificial Intelligence Class Project

