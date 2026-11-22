// The game's rules and state, with no drawing and no browser in it: the thief, the patrolling
// guards and their vision cones, the sweeping cameras, the loot, the alarm meter, the exit and
// the win/lose conditions. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react without the world knowing about screens or sound. Walls and
// display cases block both movement and sight. Nothing here allocates after createWorld returns.
import {
  ALARM_DECAY,
  ALARM_MAX,
  CAMERA,
  CAMERA_DEFS,
  EXIT,
  FIELD,
  GUARD,
  GUARD_DEFS,
  LOOT_DEFS,
  OBSTACLES,
  PLAYER,
  PLAYER_START,
  STEP,
  WALL,
} from './config.js';

export const EVENT_LOOT = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;

/** Whether the segment (x1,y1)-(x2,y2) touches the rectangle r. */
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.width) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.width - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.height) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.height - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/**
 * Move a circle from (x, y) by (dx, dy), sliding around solid rectangles: the move is applied
 * whole, then the circle is pushed out of anything it overlaps, a few passes so corners slide
 * instead of wedging it in place. Returns the new position. Pure, so the screenshot autopilot
 * can score a move by where it really ends up.
 */
export function slideMove(x, y, dx, dy, radius) {
  let nx = x + dx;
  let ny = y + dy;
  for (let iter = 0; iter < 3; iter += 1) {
    for (const rect of SOLIDS) {
      const cx = Math.max(rect.x, Math.min(nx, rect.x + rect.width));
      const cy = Math.max(rect.y, Math.min(ny, rect.y + rect.height));
      const ddx = nx - cx;
      const ddy = ny - cy;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 >= radius * radius) continue;
      if (d2 === 0) {
        const left = nx - rect.x;
        const right = rect.x + rect.width - nx;
        const top = ny - rect.y;
        const bottom = rect.y + rect.height - ny;
        const m = Math.min(left, right, top, bottom);
        if (m === left) nx = rect.x - radius;
        else if (m === right) nx = rect.x + rect.width + radius;
        else if (m === top) ny = rect.y - radius;
        else ny = rect.y + rect.height + radius;
        continue;
      }
      const d = Math.sqrt(d2);
      const push = radius - d;
      nx += (ddx / d) * push;
      ny += (ddy / d) * push;
    }
  }
  // The exit gap is open floor, so the room itself is the last bound: the thief may stand in
  // the doorway (where the win triggers) but never wander out of the room.
  nx = Math.max(WALL + radius, Math.min(FIELD.width - WALL - radius, nx));
  ny = Math.max(WALL + radius, Math.min(FIELD.height - radius, ny));
  return [nx, ny];
}
function solidRects() {
  const rects = [
    { x: 0, y: 0, width: FIELD.width, height: WALL },
    { x: 0, y: 0, width: WALL, height: FIELD.height },
    { x: FIELD.width - WALL, y: 0, width: WALL, height: FIELD.height },
    { x: 0, y: FIELD.height - WALL, width: EXIT.x, height: WALL },
    { x: EXIT.x + EXIT.width, y: FIELD.height - WALL, width: FIELD.width - EXIT.x - EXIT.width, height: WALL },
  ];
  for (const o of OBSTACLES) rects.push({ x: o.x, y: o.y, width: o.width, height: o.height });
  return rects;
}

const SOLIDS = solidRects();

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Whether a circle at (x, y) with the given radius overlaps any solid shape. */
export function pointBlocked(x, y, radius) {
  for (const rect of SOLIDS) {
    const cx = Math.max(rect.x, Math.min(x, rect.x + rect.width));
    const cy = Math.max(rect.y, Math.min(y, rect.y + rect.height));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

/** Whether the watcher at (ex, ey) facing `angle` can see the point (px, py). */
export function canSee(ex, ey, angle, range, halfAngle, px, py) {
  const dx = px - ex;
  const dy = py - ey;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist > 1 && Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfAngle) return false;
  for (const r of OBSTACLES) {
    if (segmentHitsRect(ex, ey, px, py, r)) return false;
  }
  return true;
}

export function createWorld(random) {
  const player = { x: PLAYER_START.x, y: PLAYER_START.y, radius: PLAYER.radius };
  const guards = GUARD_DEFS.map((def) => {
    const [sx, sy] = def.waypoints[def.start];
    return {
      x: sx,
      y: sy,
      waypoints: def.waypoints,
      wpIndex: (def.start + 1) % def.waypoints.length,
      pause: 0,
      facing: 0,
      scanBase: 0,
      scanDir: 1,
      range: GUARD.range,
      halfAngle: GUARD.halfAngle,
    };
  });
  const cameras = CAMERA_DEFS.map((def) => ({
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    speed: def.speed,
    phase: def.phase,
    angle: def.baseAngle,
    range: CAMERA.range,
    halfAngle: CAMERA.halfAngle,
  }));
  const loot = LOOT_DEFS.map((def) => ({ ...def, taken: false }));
  const state = {
    player,
    guards,
    cameras,
    loot,
    alarm: 0,
    seen: false,
    seenBy: '',
    lootCount: 0,
    lootValue: 0,
    elapsed: 0,
    won: false,
    caught: false,
    exitOpen: false,
  };

  function reset() {
    player.x = PLAYER_START.x;
    player.y = PLAYER_START.y;
    for (let i = 0; i < guards.length; i += 1) {
      const g = guards[i];
      const def = GUARD_DEFS[i];
      const [sx, sy] = def.waypoints[def.start];
      g.x = sx;
      g.y = sy;
      g.wpIndex = (def.start + 1) % def.waypoints.length;
      g.pause = 0;
      g.facing = Math.atan2(
        def.waypoints[g.wpIndex][1] - sy,
        def.waypoints[g.wpIndex][0] - sx,
      );
      g.scanBase = g.facing;
      g.scanDir = 1;
    }
    for (let i = 0; i < cameras.length; i += 1) {
      cameras[i].angle = CAMERA_DEFS[i].baseAngle;
    }
    for (const item of loot) item.taken = false;
    state.alarm = 0;
    state.seen = false;
    state.seenBy = '';
    state.lootCount = 0;
    state.lootValue = 0;
    state.elapsed = 0;
    state.won = false;
    state.caught = false;
    state.exitOpen = false;
    void random;
  }

  function movePlayer(dx, dy) {
    [player.x, player.y] = slideMove(player.x, player.y, dx, dy, player.radius);
  }

  /**
   * One fixed step. `dx, dy` is the wanted move direction (each -1, 0 or 1). With `harmless`
   * set (the title screen's backdrop) the patrols run but nothing is seen, taken or won.
   */
  function step(dt, dx, dy, harmless) {
    let events = 0;
    if (state.won || state.caught) return events;
    state.elapsed += dt;

    // The thief.
    const len = Math.hypot(dx, dy);
    if (len > 0 && !harmless) {
      movePlayer((dx / len) * PLAYER.speed * dt, (dy / len) * PLAYER.speed * dt);
    } else if (len > 0) {
      // On the title backdrop the thief still drifts, so the room feels alive.
      movePlayer((dx / len) * PLAYER.speed * dt * 0.4, (dy / len) * PLAYER.speed * dt * 0.4);
    }

    // The guards: walk to the next waypoint, pause there and scan.
    for (const g of guards) {
      if (g.pause > 0) {
        g.pause -= dt;
        g.facing = g.scanBase + Math.sin((GUARD.pause - g.pause) * GUARD.scanSpeed) * GUARD.scanSwing * g.scanDir;
        continue;
      }
      const [tx, ty] = g.waypoints[g.wpIndex];
      const ddx = tx - g.x;
      const ddy = ty - g.y;
      const dist = Math.hypot(ddx, ddy);
      const stepLen = GUARD.speed * dt;
      if (dist <= stepLen) {
        g.x = tx;
        g.y = ty;
        g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
        g.pause = GUARD.pause;
        g.scanBase = g.facing;
        g.scanDir = g.scanDir === 1 ? -1 : 1;
      } else {
        g.x += (ddx / dist) * stepLen;
        g.y += (ddy / dist) * stepLen;
        g.facing = Math.atan2(ddy, ddx);
      }
    }

    // The cameras sweep back and forth.
    for (const c of cameras) {
      c.angle = c.baseAngle + Math.sin(state.elapsed * c.speed + c.phase) * c.sweep;
    }

    // Who sees the thief?
    let seen = false;
    let seenBy = '';
    let rate = 0;
    if (!harmless) {
      for (const g of guards) {
        if (canSee(g.x, g.y, g.facing, g.range, g.halfAngle, player.x, player.y)) {
          seen = true;
          seenBy = 'guard';
          rate += GUARD.alarmRate;
        }
      }
      for (const c of cameras) {
        if (canSee(c.x, c.y, c.angle, c.range, c.halfAngle, player.x, player.y)) {
          seen = true;
          if (seenBy === '') seenBy = 'camera';
          rate += CAMERA.alarmRate;
        }
      }
    }
    if (!state.seen && seen) events |= EVENT_SPOTTED;
    state.seen = seen;
    state.seenBy = seen ? seenBy : '';
    if (seen) state.alarm = Math.min(ALARM_MAX, state.alarm + rate * dt);
    else state.alarm = Math.max(0, state.alarm - ALARM_DECAY * dt);

    if (state.alarm >= ALARM_MAX) {
      state.caught = true;
      return events | EVENT_CAUGHT;
    }

    // Loot.
    if (!harmless) {
      for (const item of loot) {
        if (item.taken) continue;
        if (Math.hypot(item.x - player.x, item.y - player.y) < player.radius + 18) {
          item.taken = true;
          state.lootCount += 1;
          state.lootValue += item.value;
          events |= EVENT_LOOT;
        }
      }
    }
    state.exitOpen = state.lootCount === loot.length;

    // The exit: slip out once every piece is taken.
    if (!harmless && state.exitOpen && player.y > FIELD.height - WALL - 6 && player.x > EXIT.x && player.x < EXIT.x + EXIT.width) {
      state.won = true;
      return events | EVENT_WIN;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}

export { STEP };
