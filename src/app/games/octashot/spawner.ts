import { Platform, Enemy, Boss, Vec, DIRS, Difficulty } from './entities';

export function createPlatforms(level: number, center: Vec, gridW: number, gridH: number): Platform[] {
  const max = Math.min(5, 2 + Math.floor(level / 2)); // 5 only on higher levels
  const dirs = [0, 1, 2, 3, 4, 5, 6, 7];
  shuffle(dirs);
  const picked = dirs.slice(0, max);
  const res: Platform[] = [];
  const size = { x: 4, y: 4 }; // smaller circular footprint
  // allowed center bounds so the platform circle stays fully inside
  const halfX = size.x / 2, halfY = size.y / 2;
  const cminX = 1 + halfX;
  const cmaxX = gridW - 1 - halfX;
  const cminY = 1 + halfY;
  const cmaxY = gridH - 1 - halfY;
  for (const dir of picked) {
    const u = norm(DIRS[dir]);
    // compute max radius along this direction without crossing bounds
    const Rx = u.x === 0 ? Infinity : (u.x > 0 ? (cmaxX - center.x) / u.x : (center.x - cminX) / (-u.x));
    const Ry = u.y === 0 ? Infinity : (u.y > 0 ? (cmaxY - center.y) / u.y : (center.y - cminY) / (-u.y));
    const r = Math.min(Rx, Ry) * 0.92; // margin from edge to avoid clamping
    const cx = center.x + u.x * r;
    const cy = center.y + u.y * r;
    const pos = {
      x: Math.max(1, Math.min(gridW - size.x - 1, cx - halfX)),
      y: Math.max(1, Math.min(gridH - size.y - 1, cy - halfY)),
    };
    const will = Math.min(10, 3 + Math.floor(level / 2));
    const types: Platform['platformType'][] = ['default', 'fast_spin', 'safe'];
    const platformType = types[Math.floor(Math.random() * types.length)];
    let killQuota = will;
    let willDespawnAfter = will;
    if (platformType === 'safe') { killQuota = will + 1; willDespawnAfter = will + 2; }
    // fast_spin rotates faster; handled in renderer/update via rotation
    res.push({ id: dir + 1, dir, pos, size: { ...size }, active: false, enemiesLeft: 0, crumble: false, crumbleProgress: 0, spawnProgress: 0, spawnStartAt: 0, rotation: 0, willDespawnAfter, killQuota, killsAchieved: 0, spawnedCount: 0, platformType });
  }
  return res;
}


export function spawnEnemyFromPlatform(pl: Platform, level: number, baseSpeed: number): Enemy {
  const speed = baseSpeed * (1 + level * 0.01);
  const cx = pl.pos.x + pl.size.x / 2;
  const cy = pl.pos.y + pl.size.y / 2;
  // elite chance increases slightly with level
  const eliteChance = Math.min(0.28, 0.08 + level * 0.015);
  const elite = Math.random() < eliteChance;
  const mods: (Enemy['modifier'])[] = ['fast', 'split'];
  const modifier = elite ? mods[Math.floor(Math.random() * mods.length)] : undefined;
  let s = speed * (0.32 + Math.random() * 0.28);
  if (elite && modifier === 'fast') { s *= 1.25; }
  const hpBase = 1 + Math.floor(level / 4);
  const hp = elite ? hpBase + 2 : hpBase; // Elite enemies get +2 HP bonus
  return { id: pl.id * 1000 + Math.floor(Math.random() * 1000), pos: { x: cx, y: cy }, speed: s, alive: true, fromPlatformId: pl.id, hp, spawnProgress: 0, deathProgress: 0, elite, modifier };
}

export function spawnBosses(level: number, platforms: Platform[], baseSpeed: number, difficulty: Difficulty): Boss[] {
  const n = Math.min(3, 1 + Math.floor(level / 6));
  const arr: Boss[] = [];
  let hpMult = 1.0;
  if (difficulty === 'normal') hpMult = 1.25;
  if (difficulty === 'hard') hpMult = 1.5;

  for (let i = 0; i < n; i++) {
    const pl = platforms[i % platforms.length];
    const pos = { x: pl.pos.x + pl.size.x / 2, y: pl.pos.y + pl.size.y / 2 };
    arr.push({ id: 5000 + i, pos, speed: baseSpeed * 0.45 * (1 + level * 0.02), hp: Math.floor((8 + Math.floor(level * 2)) * hpMult), targetPlatformId: null, shootCooldownUntil: 0, spawnProgress: 0, teleportAt: performance.now() + 3000, teleportDelay: 3000 });
  }
  return arr;
}

function randInt(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function shuffle<T>(x: T[]) { for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; } }
function norm(v: Vec) { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; }