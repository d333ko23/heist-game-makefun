// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 playfield
// is scaled to fit the window and centred, the margin filled with the backdrop colour. Every
// picture is drawn from code on the canvas: the museum floor, the display cases, the vault
// pillar, the guards and their vision cones, the sweeping cameras, the gold loot and the thief.
import { EXIT, FIELD, FONT, LOOT_DEFS, OBSTACLES, PALETTE, WALL } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };
const ALARM = { x: 470, y: 22, width: 340, height: 20 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

const money = (value) => `$${value.toLocaleString('en-US')}`;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const lootLabel = cachedLabel('LOOT ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function cone(x, y, angle, range, halfAngle, fill, edge) {
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawFloor(state) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Checker tiles, faint.
    context.fillStyle = PALETTE.floorAlt;
    const tile = 64;
    for (let ty = WALL; ty < FIELD.height - WALL; ty += tile) {
      for (let tx = WALL + ((ty / tile) % 2 === 0 ? 0 : tile); tx < FIELD.width - WALL; tx += tile * 2) {
        context.fillRect(tx, ty, tile, tile);
      }
    }
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    for (let x = WALL; x <= FIELD.width - WALL; x += tile) {
      context.beginPath();
      context.moveTo(x, WALL);
      context.lineTo(x, FIELD.height - WALL);
      context.stroke();
    }
    for (let y = WALL; y <= FIELD.height - WALL; y += tile) {
      context.beginPath();
      context.moveTo(WALL, y);
      context.lineTo(FIELD.width - WALL, y);
      context.stroke();
    }
    // Gold inlay border around the floor.
    context.strokeStyle = PALETTE.goldDim;
    context.lineWidth = 2;
    context.strokeRect(WALL + 8, WALL + 8, FIELD.width - 2 * WALL - 16, FIELD.height - 2 * WALL - 16);
  }

  function drawWalls(state) {
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, WALL);
    context.fillRect(0, 0, WALL, FIELD.height);
    context.fillRect(FIELD.width - WALL, 0, WALL, FIELD.height);
    context.fillRect(0, FIELD.height - WALL, EXIT.x, WALL);
    context.fillRect(EXIT.x + EXIT.width, FIELD.height - WALL, FIELD.width - EXIT.x - EXIT.width, WALL);
    context.fillStyle = PALETTE.wallTop;
    context.fillRect(0, WALL - 4, FIELD.width, 4);
    context.fillRect(WALL - 4, 0, 4, FIELD.height);
    context.fillRect(FIELD.width - WALL, 0, 4, FIELD.height);
    // The exit doorway.
    context.fillStyle = state.exitOpen ? '#2f6b45' : '#3a3222';
    context.fillRect(EXIT.x, FIELD.height - WALL, EXIT.width, WALL);
    context.strokeStyle = state.exitOpen ? PALETTE.goldBright : PALETTE.goldDim;
    context.lineWidth = 2;
    context.strokeRect(EXIT.x + 2, FIELD.height - WALL + 2, EXIT.width - 4, WALL - 4);
    text('EXIT', EXIT.x + EXIT.width / 2, FIELD.height - 8, 13, state.exitOpen ? '#eafff0' : PALETTE.gold, 'center');
    if (state.exitOpen) {
      context.fillStyle = 'rgba(242, 201, 76, 0.25)';
      context.fillRect(EXIT.x - 14, FIELD.height - WALL - 46, EXIT.width + 28, 46);
    }
  }

  function drawObstacles() {
    for (const o of OBSTACLES) {
      if (o.kind === 'pillar') {
        context.fillStyle = PALETTE.pillar;
        context.fillRect(o.x, o.y, o.width, o.height);
        context.strokeStyle = PALETTE.pillarTrim;
        context.lineWidth = 3;
        context.strokeRect(o.x + 4, o.y + 4, o.width - 8, o.height - 8);
        context.fillStyle = PALETTE.goldDim;
        context.beginPath();
        context.arc(o.x + o.width / 2, o.y + o.height / 2, 16, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.goldBright;
        context.font = `bold 20px ${FONT}`;
        context.textAlign = 'center';
        context.fillText('$', o.x + o.width / 2, o.y + o.height / 2 + 7);
      } else {
        context.fillStyle = PALETTE.caseGlass;
        context.fillRect(o.x, o.y, o.width, o.height);
        context.strokeStyle = PALETTE.caseFrame;
        context.lineWidth = 4;
        context.strokeRect(o.x + 2, o.y + 2, o.width - 4, o.height - 4);
        context.strokeStyle = PALETTE.goldDim;
        context.lineWidth = 1;
        context.strokeRect(o.x + 8, o.y + 8, o.width - 16, o.height - 16);
        // A glint of treasure inside the case.
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.arc(o.x + o.width / 2, o.y + o.height / 2, 7, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawLootShape(item, t) {
    const bob = Math.sin(t * 2 + item.x) * 2;
    const y = item.y + bob;
    const pulse = 1 + Math.sin(t * 3 + item.x) * 0.06;
    context.save();
    context.translate(item.x, y);
    context.scale(pulse, pulse);
    context.fillStyle = PALETTE.lootGlow;
    context.beginPath();
    context.arc(0, 0, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.goldBright;
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    if (item.shape === 'idol') {
      context.beginPath();
      context.moveTo(0, -14);
      context.lineTo(10, 10);
      context.lineTo(-10, 10);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = '#7a5c00';
      context.beginPath();
      context.arc(-3, -4, 2, 0, Math.PI * 2);
      context.arc(3, -4, 2, 0, Math.PI * 2);
      context.fill();
    } else if (item.shape === 'crown') {
      context.beginPath();
      context.moveTo(-13, 10);
      context.lineTo(-13, -4);
      context.lineTo(-6, 4);
      context.lineTo(0, -12);
      context.lineTo(6, 4);
      context.lineTo(13, -4);
      context.lineTo(13, 10);
      context.closePath();
      context.fill();
      context.stroke();
    } else if (item.shape === 'vase') {
      context.beginPath();
      context.ellipse(0, 2, 10, 12, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillRect(-4, -14, 8, 6);
    } else if (item.shape === 'coins') {
      for (let i = 0; i < 3; i += 1) {
        context.beginPath();
        context.ellipse(0, 8 - i * 6, 11, 4.5, 0, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
    } else {
      // Necklace: an arc of pearls.
      context.strokeStyle = PALETTE.goldBright;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, -2, 11, 0.15 * Math.PI, 0.85 * Math.PI);
      context.stroke();
      for (let i = 0; i <= 6; i += 1) {
        const a = 0.15 * Math.PI + (i / 6) * 0.7 * Math.PI;
        context.beginPath();
        context.arc(Math.cos(a) * 11, -2 + Math.sin(a) * 11, 2.4, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
    text(item.name, item.x, item.y + 34, 12, PALETTE.muted, 'center');
    text(money(item.value), item.x, item.y + 50, 12, PALETTE.gold, 'center');
  }

  function drawGuards(state) {
    for (const g of state.guards) {
      cone(g.x, g.y, g.facing, g.range, g.halfAngle, PALETTE.coneGuard, PALETTE.coneGuardEdge);
    }
    for (const g of state.guards) {
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(g.x, g.y, 15, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.guardTrim;
      context.lineWidth = 2;
      context.stroke();
      // Cap brim and facing tick.
      context.fillStyle = PALETTE.guardTrim;
      context.beginPath();
      context.arc(g.x + Math.cos(g.facing) * 9, g.y + Math.sin(g.facing) * 9, 4, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.goldBright;
      context.beginPath();
      context.moveTo(g.x, g.y);
      context.lineTo(g.x + Math.cos(g.facing) * 20, g.y + Math.sin(g.facing) * 20);
      context.stroke();
    }
  }

  function drawCameras(state) {
    for (const c of state.cameras) {
      cone(c.x, c.y, c.angle, c.range, c.halfAngle, PALETTE.coneCamera, PALETTE.coneCameraEdge);
    }
    for (const c of state.cameras) {
      context.fillStyle = '#3a3f4d';
      context.beginPath();
      context.arc(c.x, c.y, 9, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.goldBright;
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = state.seen && state.seenBy === 'camera' ? '#ff5040' : PALETTE.goldBright;
      context.beginPath();
      context.arc(c.x + Math.cos(c.angle) * 6, c.y + Math.sin(c.angle) * 6, 3.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    const carrying = state.lootCount > 0;
    // Visual-only enlargement: the drawn thief is a touch larger than the
    // collision radius, so it reads clearly without touching gameplay.
    const r = p.radius + 2;
    // Soft shadow.
    context.fillStyle = 'rgba(0, 0, 0, 0.4)';
    context.beginPath();
    context.ellipse(p.x, p.y + 10, 15, 6, 0, 0, Math.PI * 2);
    context.fill();
    // A stronger gold halo, so the dark thief still reads against the dark floor.
    context.fillStyle = 'rgba(242, 201, 76, 0.28)';
    context.beginPath();
    context.arc(p.x, p.y, r + 16, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(242, 201, 76, 0.55)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(p.x, p.y, r + 16, 0, Math.PI * 2);
    context.stroke();
    // Hooded thief: dark cloak, gold trim, pale mask band.
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(p.x, p.y, r, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.thiefTrim;
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = '#f7f3e8';
    context.fillRect(p.x - 9, p.y - 5, 18, 7);
    context.strokeStyle = PALETTE.goldBright;
    context.lineWidth = 1;
    context.strokeRect(p.x - 9, p.y - 5, 18, 7);
    context.fillStyle = '#0a0b10';
    context.fillRect(p.x - 6, p.y - 3, 4, 4);
    context.fillRect(p.x + 2, p.y - 3, 4, 4);
    if (carrying) {
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(p.x + 12, p.y + 10, 6, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#7a5c00';
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function drawField(state) {
    drawFloor(state);
    drawWalls(state);
    drawObstacles();
    for (const item of state.loot) {
      if (!item.taken) drawLootShape(item, state.elapsed);
    }
    drawGuards(state);
    drawCameras(state);
    drawPlayer(state);
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    text(lootLabel(state.lootCount) + `/ ${LOOT_DEFS.length}`, 32, 18, 24, PALETTE.text, 'left');
    text(money(state.lootValue), 32, 46, 16, PALETTE.gold, 'left');
    // Alarm meter, centred at the top.
    text('ALARM', ALARM.x - 12, 20, 18, state.seen ? PALETTE.alarm : PALETTE.muted, 'right');
    context.fillStyle = '#232733';
    context.fillRect(ALARM.x, ALARM.y, ALARM.width, ALARM.height);
    const frac = state.alarm / 100;
    context.fillStyle = frac > 0.66 ? PALETTE.alarm : frac > 0.33 ? '#e8a13c' : PALETTE.alarmCalm;
    context.fillRect(ALARM.x, ALARM.y, ALARM.width * frac, ALARM.height);
    context.strokeStyle = PALETTE.goldDim;
    context.lineWidth = 1.5;
    context.strokeRect(ALARM.x, ALARM.y, ALARM.width, ALARM.height);
    text(`${Math.round(state.alarm)}%`, ALARM.x + ALARM.width + 10, 20, 18, PALETTE.text, 'left');
    const mins = Math.floor(state.elapsed / 60);
    const secs = Math.floor(state.elapsed % 60);
    text(`${mins}:${String(secs).padStart(2, '0')}`, FIELD.width - 32, 18, 24, PALETTE.text, 'right');
    if (state.seen) {
      const blink = Math.floor(state.elapsed * 6) % 2 === 0;
      if (blink) text('! SPOTTED !', FIELD.width / 2, 56, 26, PALETTE.alarm, 'center');
    } else if (state.exitOpen) {
      text('ALL LOOT TAKEN — REACH THE EXIT!', FIELD.width / 2, 56, 22, PALETTE.goldBright, 'center');
    }
    text('Move: WASD / arrows   •   Pause: P', 32, FIELD.height - 26, 14, PALETTE.muted, 'left');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(5, 6, 9, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.goldBright, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  const TITLE_LINES = [
    'A midnight heist in the Grand Museum.',
    'Slip past the guards and the cameras,',
    'take all five treasures, then reach the EXIT.',
    'Seen? The alarm rises. Full alarm — caught.',
    '',
  ];
  const PAUSED_LINES = ['The guards keep their rounds. The gold waits.'];
  const OVER_LINES = ['', ''];
  const WIN_LINES = ['', '', ''];

  /** Paint one frame: the room, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = best > 0 ? `Best haul ${money(best)}` : 'WASD / arrows to move';
      drawPanel('GILDED VAULT', TITLE_LINES, 'Press Space or click to start the heist');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = `Loot taken ${state.lootCount} / ${LOOT_DEFS.length}  •  ${money(state.lootValue)}`;
      OVER_LINES[1] = best > 0 ? `Best haul ${money(best)}` : '';
      drawPanel('CAUGHT!', OVER_LINES, 'Press Space or click to try again');
    } else if (screen === SCREEN_WIN) {
      const mins = Math.floor(state.elapsed / 60);
      const secs = Math.floor(state.elapsed % 60);
      WIN_LINES[0] = `Haul ${money(state.lootValue)} — all five treasures`;
      WIN_LINES[1] = `Clean getaway in ${mins}:${String(secs).padStart(2, '0')}`;
      WIN_LINES[2] = best > 0 ? `Best haul ${money(best)}` : '';
      drawPanel('CLEAN GETAWAY!', WIN_LINES, 'Press Space or click to heist again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
