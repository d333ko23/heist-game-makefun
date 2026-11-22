// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot, so the frame
// is what a short game really looks like and the same seed always gives the same frame.
//
// The play scene's pilot heads for the nearest loot and steers around the guards' and cameras'
// vision cones, so the frame shows the thief mid-route with the room, a patrol, a cone, a
// camera, loot still on the floor and the alarm meter. The end scene's pilot is greedy and
// careless: it grabs what it can, then walks into the guard's lane and waits there until the
// alarm fills — a hurried thief, caught.
//
// Both pilots navigate on a breadth-first distance field over the room, so they walk around a
// display case instead of pushing into it forever: a plain greedy pilot wedges in the local
// minimum directly below a case, which the first version of this file did.
import { FIELD, PLAYER, STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_WIN, canSee, pointBlocked, slideMove } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 11;
const END_LIMIT_SECONDS = 120;

/** The eight compass directions plus standing still. */
const MOVES = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Navigation grid over the room: 40 px cells, small enough to thread between the cases. */
const CELL = 40;
const COLS = Math.ceil(FIELD.width / CELL);
const ROWS = Math.ceil(FIELD.height / CELL);

/** Whether the centre of a navigation cell is inside a wall or a case. */
function cellBlocked(cx, cy) {
  return pointBlocked(cx * CELL + CELL / 2, cy * CELL + CELL / 2, 6);
}

function cellOf(x, y) {
  return [
    Math.min(COLS - 1, Math.max(0, Math.floor(x / CELL))),
    Math.min(ROWS - 1, Math.max(0, Math.floor(y / CELL))),
  ];
}

// A breadth-first distance field from the target cell, cached per target: the pilot follows
// its gradient, so it walks around a display case instead of pushing into it forever.
let navCache = { key: '', dist: null };
function navDist(tx, ty) {
  const key = `${Math.round(tx)},${Math.round(ty)}`;
  if (navCache.key === key && navCache.dist !== null) return navCache.dist;
  const dist = new Array(COLS * ROWS).fill(Infinity);
  let [tcx, tcy] = cellOf(tx, ty);
  if (cellBlocked(tcx, tcy)) {
    // The target's cell is blocked: take the nearest open cell instead.
    let found = false;
    for (let r = 1; r < Math.max(COLS, ROWS) && !found; r += 1) {
      for (let dy = -r; dy <= r && !found; dy += 1) {
        for (let dx = -r; dx <= r && !found; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = tcx + dx;
          const ny = tcy + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || cellBlocked(nx, ny)) continue;
          [tcx, tcy] = [nx, ny];
          found = true;
        }
      }
    }
    if (!found) {
      navCache = { key, dist };
      return dist;
    }
  }
  const start = tcy * COLS + tcx;
  dist[start] = 0;
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    const cx = cur % COLS;
    const cy = Math.floor(cur / COLS);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const ni = ny * COLS + nx;
      if (dist[ni] !== Infinity || cellBlocked(nx, ny)) continue;
      dist[ni] = dist[cur] + 1;
      queue.push(ni);
    }
  }
  navCache = { key, dist };
  return dist;
}

/** Whether the thief would be seen standing at (x, y) right now. */
function wouldBeSeen(state, x, y) {
  for (const g of state.guards) {
    if (canSee(g.x, g.y, g.facing, g.range, g.halfAngle, x, y)) return true;
  }
  for (const c of state.cameras) {
    if (canSee(c.x, c.y, c.angle, c.range, c.halfAngle, x, y)) return true;
  }
  return false;
}

/** The nearest loot still on the floor, or null. */
function nearestLoot(state) {
  let best = null;
  let bestDist = Infinity;
  for (const item of state.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

/**
 * The centre of the neighbouring cell the distance field says to head for next, or the exact
 * target when the thief is already in the target's cell. Following cell centres keeps the
 * pilot moving between cells: scoring moves by raw distance to the target instead stalls in
 * the cell directly below a case, where every step away from the target's column looks worse.
 */
function nextWaypoint(state, tx, ty) {
  const dist = navDist(tx, ty);
  const [cx, cy] = cellOf(state.player.x, state.player.y);
  const here = dist[cy * COLS + cx];
  if (here === 0 || here === Infinity) return [tx, ty];
  let bestCell = null;
  let bestD = here;
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = cx + ox;
    const ny = cy + oy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    const d = dist[ny * COLS + nx];
    if (d < bestD) {
      bestD = d;
      bestCell = [nx, ny];
    }
  }
  if (bestCell === null) return [tx, ty];
  return [bestCell[0] * CELL + CELL / 2, bestCell[1] * CELL + CELL / 2];
}

/**
 * One step of the navigating pilot: of the nine moves, the one that gets closest to the next
 * waypoint — and, when `cautious`, never steps into a vision cone. Each move is scored by
 * where it really ends up after sliding around the walls.
 */
function navPilot(state, tx, ty, cautious) {
  const [wx, wy] = nextWaypoint(state, tx, ty);
  let best = [0, 0];
  let bestScore = Infinity;
  for (const [mx, my] of MOVES) {
    const len = Math.hypot(mx, my) || 1;
    const [nx, ny] = slideMove(
      state.player.x, state.player.y,
      (mx / len) * PLAYER.speed * STEP, (my / len) * PLAYER.speed * STEP,
      PLAYER.radius,
    );
    const dist = Math.hypot(wx - nx, wy - ny);
    const danger = cautious && wouldBeSeen(state, nx, ny) ? 10000 : 0;
    const still = mx === 0 && my === 0 ? 40 : 0;
    const score = dist + danger + still;
    if (score < bestScore) {
      bestScore = score;
      best = [mx, my];
    }
  }
  return best;
}

/** One step of the cautious pilot: toward the nearest loot, steering around the vision cones. */
function cautiousPilot(state) {
  const target = nearestLoot(state) ?? { x: FIELD.width / 2, y: FIELD.height - 60 };
  return navPilot(state, target.x, target.y, true);
}

/** One step of the greedy pilot: toward the nearest loot, cones ignored. */
function greedyPilot(state) {
  const target = nearestLoot(state) ?? { x: FIELD.width / 2, y: FIELD.height - 30 };
  return navPilot(state, target.x, target.y, false);
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best haul to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, 0, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      const [dx, dy] = cautiousPilot(world.state);
      const events = world.step(STEP, dx, dy, false);
      if (events & (EVENT_CAUGHT | EVENT_WIN)) break;
    }
    const over = world.state.caught;
    const won = world.state.won;
    return { screen: over ? SCREEN_OVER : won ? SCREEN_WIN : SCREEN_PLAY, best: world.state.lootValue };
  }
  // End: grab greedily for a while, then walk into the guard's lane and wait to be caught.
  for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
    const t = world.state.elapsed;
    let move;
    if (t < 8) move = greedyPilot(world.state);
    else move = navPilot(world.state, 640, 196, false);
    const events = world.step(STEP, move[0], move[1], false);
    if (events & EVENT_CAUGHT) break;
    if (events & EVENT_WIN) break;
  }
  return { screen: world.state.won ? SCREEN_WIN : SCREEN_OVER, best: world.state.lootValue };
}
