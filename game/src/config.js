// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Outer wall thickness; the room's floor is the field minus this border. */
export const WALL = 24;

export const PLAYER = {
  radius: 14,
  speed: 215,
};

export const GUARD = {
  radius: 15,
  speed: 78,
  /** How far a guard can see, in pixels. */
  range: 235,
  /** Half of the vision cone's angle, in radians. */
  halfAngle: 0.5,
  /** Seconds a guard pauses at each waypoint, scanning left and right. */
  pause: 1.4,
  /** How far the scan swings each way while paused, in radians. */
  scanSwing: 0.85,
  scanSpeed: 1.6,
  /** Alarm points per second while a guard sees the thief. */
  alarmRate: 55,
};

export const CAMERA = {
  range: 275,
  halfAngle: 0.45,
  /** Alarm points per second while a camera sees the thief. */
  alarmRate: 45,
};

/** Alarm points per second the meter cools down while nobody sees the thief. */
export const ALARM_DECAY = 10;
export const ALARM_MAX = 100;

/** The loot: name, position, value and the shape the renderer draws. */
export const LOOT_DEFS = [
  { name: 'Golden Idol', x: 280, y: 112, value: 5000, shape: 'idol' },
  { name: 'Royal Crown', x: 1000, y: 112, value: 4000, shape: 'crown' },
  { name: 'Jade Vase', x: 640, y: 480, value: 3000, shape: 'vase' },
  { name: 'Coin Hoard', x: 280, y: 608, value: 2000, shape: 'coins' },
  { name: 'Pearl Necklace', x: 1000, y: 608, value: 2500, shape: 'necklace' },
];

/** Interior obstacles (display cases and the central vault pillar). */
export const OBSTACLES = [
  { x: 180, y: 150, width: 180, height: 70, kind: 'case' },
  { x: 920, y: 150, width: 180, height: 70, kind: 'case' },
  { x: 590, y: 300, width: 100, height: 100, kind: 'pillar' },
  { x: 180, y: 500, width: 180, height: 70, kind: 'case' },
  { x: 920, y: 500, width: 180, height: 70, kind: 'case' },
];

/** The guards' patrol routes (waypoints) and their start. */
export const GUARD_DEFS = [
  { waypoints: [[340, 196], [940, 196]], start: 0 },
  { waypoints: [[820, 300], [820, 560]], start: 0 },
];

/** Wall-mounted security cameras: position, the direction they face at rest, sweep and speed. */
export const CAMERA_DEFS = [
  { x: 180, y: 34, baseAngle: Math.PI / 2, sweep: 0.95, speed: 0.55, phase: 0 },
  { x: 1246, y: 360, baseAngle: Math.PI, sweep: 0.85, speed: 0.45, phase: 1.7 },
];

/** Where the thief slips in: the gap in the bottom wall, and the start spot just inside it. */
export const EXIT = { x: 600, y: 696, width: 80, height: 24 };
export const PLAYER_START = { x: 640, y: 636 };

export const PALETTE = {
  backdrop: '#0b0d12',
  floor: '#161922',
  floorAlt: '#1a1e28',
  floorLine: '#20242f',
  wall: '#2b3040',
  wallTop: '#3a4157',
  gold: '#d4af37',
  goldBright: '#f2c94c',
  goldDim: '#8a7433',
  caseGlass: '#222838',
  caseFrame: '#4a4230',
  pillar: '#262b38',
  pillarTrim: '#d4af37',
  text: '#eef1f5',
  muted: '#9aa1b2',
  panel: '#171a23',
  panelEdge: '#d4af37',
  thief: '#14161d',
  thiefTrim: '#f2c94c',
  guard: '#3d5a80',
  guardTrim: '#e0e6ef',
  coneGuard: 'rgba(255, 84, 60, 0.16)',
  coneGuardEdge: 'rgba(255, 84, 60, 0.45)',
  coneCamera: 'rgba(242, 201, 76, 0.13)',
  coneCameraEdge: 'rgba(242, 201, 76, 0.45)',
  alarm: '#e5534b',
  alarmCalm: '#3fae6a',
  lootGlow: 'rgba(242, 201, 76, 0.25)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best haul is kept between visits (this browser only). */
export const BEST_KEY = 'gilded-vault.best';
