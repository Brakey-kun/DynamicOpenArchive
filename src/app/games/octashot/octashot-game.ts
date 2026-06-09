import { Player, Platform, Enemy, Boss, Bullet, Item, SaveData, DIRS, Vec, Impact, Mutator, Difficulty, VisualFX } from './entities';
import { Renderer } from './render';
import { createPlatforms, spawnBosses, spawnEnemyFromPlatform } from './spawner';
import { loadSave, save as saveLS, exportJSON, importJSON, defaultSave } from './save';

export class OctaShotGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pixel = 20;
  private gridW = 0; private gridH = 0;
  private center: Vec = { x: 0, y: 0 };
  private renderer: Renderer;
  private lastFrame = 0; private loop: number | undefined; private targetFPS = 60;
  private fontLoaded = false; private pixelFont: FontFace | undefined;
  private audioCtx: AudioContext | null = null;
  private keyboardLayout: 'azerty' | 'qwerty' = 'azerty';

  private p: Player; private level = 1; private stats: SaveData['stats'] = { kills: 0, bosses: 0, shots: 0, score: 0, items: { heart: 0, apple: 0, shield: 0, sniper: 0, skin: 0, freeze: 0, reflector: 0, siphon: 0, piercer: 0, burst: 0 } };
  private platforms: Platform[] = []; private enemies: Enemy[] = []; private bosses: Boss[] = [];
  private bullets: Bullet[] = [];
  private items: Item[] = [];
  private impacts: Impact[] = [];
  private fx: VisualFX[] = [];
  private id = 1;
  private paused = false; private over = false;
  private keys = new Set<string>();
  private enemyCap = 8;
  private nextPlatformIndex = 0;
  private lastActivationTime = 0;
  private levelTransitionK = 0; // 0..1 fade between levels
  private transitioning = false;
  private nextLevel = 0;
  // mutators per level
  private mutators: Mutator[] = [];
  // run stats for maxima tracking
  private runKills = 0; private runBosses = 0; private runScore = 0;
  private runItems: SaveData['stats']['items'] = { heart: 0, apple: 0, shield: 0, sniper: 0, skin: 0, freeze: 0, reflector: 0, siphon: 0, piercer: 0, burst: 0 };
  // pause menu
  private pauseOptions = ['Resume', 'Restart', 'Difficulty: Easy', 'Main Menu'];
  private pauseSel = 0;
  private difficulty: Difficulty = 'easy';
  private lastHitSoundAt = 0;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.floor((window.innerWidth * 0.8) / this.pixel) * this.pixel;
    this.canvas.height = Math.floor((window.innerHeight * 0.8) / this.pixel) * this.pixel;
    this.gridW = this.canvas.width / this.pixel; this.gridH = this.canvas.height / this.pixel;
    this.center = { x: this.gridW / 2, y: this.gridH / 2 };
    Object.assign(this.canvas.style, { border: '4px solid #333', backgroundColor: '#000', display: 'block', margin: '0 auto', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: '1000' });
    const c = this.canvas.getContext('2d'); if (!c) throw new Error('ctx'); this.ctx = c;
    container.appendChild(this.canvas);
    this.renderer = new Renderer(this.ctx, this.pixel);
    const s = loadSave();
    this.p = { hp: s.hp, maxHp: s.maxHp, rot: 0, bullets: s.maxHp, reloading: false, reloadUntil: 0, shieldActive: false, sniperUses: s.sniperUses, skin: s.selectedSkin, comboCount: 0, comboExpireAt: 0, comboMultiplier: 1, overdriveUntil: 0, reflectorCharges: 0, timeFreezeUntil: 0, piercerShots: 0, burstShots: 0, siphonActive: false, siphonProgress: 0, overdriveNextDrainAt: 0 };
    this.level = s.level; this.stats = s.stats;
    this.difficulty = s.difficulty || 'easy';
    this.updatePauseMenuDiff();
    this.init();
  }

  private async init() {
    this.pixelFont = new FontFace('PixelFont', 'url(https://fonts.gstatic.com/s/pressstart2p/v14/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff2)');
    try { await this.pixelFont.load(); document.fonts.add(this.pixelFont); this.fontLoaded = true; } catch { }
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    // Menu handles import/export; remove in-canvas overlay
    this.startLevel();
    this.lastFrame = performance.now();
    this.loop = requestAnimationFrame(this.frame);
  }

  private startLevel() {
    // pick mutators per level (lightweight director)
    this.mutators = this.pickMutators(this.level);
    this.platforms = createPlatforms(this.level, this.center, this.gridW, this.gridH);
    // apply mutator effects on platforms
    if (this.hasMut('double_quota')) { this.platforms.forEach(pl => { pl.killQuota = Math.round((pl.killQuota || 2) * 2); pl.willDespawnAfter = Math.round((pl.willDespawnAfter || 2) * 2); }); }
    this.enemies = []; this.bosses = []; this.bullets = []; this.items = [];
    this.nextPlatformIndex = 0; this.levelTransitionK = 0; this.transitioning = false;
    if (this.isBossRound()) {
      this.bosses = spawnBosses(this.level, this.platforms, this.baseEnemySpeed(), this.difficulty);
      if (this.bosses.length > 0) { this.playSfx('boss_spawn'); }
      // Boss round: no standard platform activation needed here, bosses spawn directly
    } else {
      // Standard round: platforms will be activated in update()
      this.lastActivationTime = performance.now(); // Start delay from now
    }
    this.autosave();
  }

  private activatePlatform(idx: number) {
    if (idx >= this.platforms.length) return;
    const pl = this.platforms[idx];
    pl.active = true; pl.spawnProgress = 0; pl.crumble = false; pl.crumbleProgress = 0; pl.killsAchieved = 0;
    pl.spawnStartAt = performance.now(); pl.rotation = 0;
    // spawn one enemy immediately if allowed; subsequent spawns are gated
    this.trySpawnFromPlatform(pl);
    this.schedulePlatformTick(pl);
  }

  private schedulePlatformTick(pl: Platform) {
    let waveDelay = 1600 / (1 + this.level * 0.10);
    if (this.hasMut('fast_enemies')) waveDelay *= 0.80;
    const tick = () => {
      if (this.over || this.paused || pl.crumble) return;
      if ((pl.killsAchieved || 0) >= (pl.killQuota || 0)) return; // done
      this.trySpawnFromPlatform(pl);
      // Continue ticking only if platform is still active and not crumbling
      if (!pl.crumble && pl.active && (pl.killsAchieved || 0) < (pl.killQuota || 0)) {
        setTimeout(tick, waveDelay);
      }
    };
    setTimeout(tick, waveDelay);
  }

  private baseEnemySpeed() {
    const f = 0.36 + this.level * 0.028;
    let mult = 1;
    if (this.difficulty === 'normal') mult = 3;
    if (this.difficulty === 'hard') mult = 5;
    return (this.hasMut('fast_enemies') ? f * 1.35 : f) * mult;
  }

  private hasMut(m: Mutator) { return this.mutators.includes(m); }
  private pickMutators(level: number): Mutator[] {
    const pool: Mutator[] = ['fast_enemies', 'double_quota', 'boss_burst'];
    const count = level % 6 === 0 ? 2 : (level > 4 ? 1 : 0);
    const res: Mutator[] = []; const avail = [...pool];
    for (let i = 0; i < count; i++) {
      if (avail.length === 0) break;
      const j = Math.floor(Math.random() * avail.length);
      res.push(avail.splice(j, 1)[0]);
    }
    return res;
  }

  private frame = (t: number) => {
    if (this.over) { return; }
    const dt = t - this.lastFrame; const step = 1000 / this.targetFPS;
    if (dt >= step) { this.update(step / 1000); this.draw(); this.lastFrame = t - (dt % step); }
    this.loop = requestAnimationFrame(this.frame);
  };

  private update(dt: number) {
    if (this.paused) return;

    // Level transition animation
    if (this.transitioning) {
      this.levelTransitionK = Math.min(1, this.levelTransitionK + dt * 1.2);
      if (this.levelTransitionK >= 1) {
        this.level = this.nextLevel; this.p.hp = this.p.maxHp; this.startLevel();
      }
      return;
    }

    const freezeActive = !!this.p.timeFreezeUntil && performance.now() < (this.p.timeFreezeUntil || 0);
    // overdrive drain (ammo)
    if ((this.p.overdriveUntil || 0) > 0) {
      if (performance.now() >= (this.p.overdriveUntil || 0)) { this.p.overdriveUntil = 0; }
      else if (performance.now() >= (this.p.overdriveNextDrainAt || 0)) {
        this.p.bullets = Math.max(0, this.p.bullets - 1);
        this.p.overdriveNextDrainAt = performance.now() + 800;
        if (this.p.bullets <= 0 && !this.p.reloading) { this.p.reloading = true; this.p.reloadUntil = performance.now() + 1500; this.p.overdriveUntil = 0; this.playSfx('reload_start'); }
      }
    }
    // expire combo if time window passes
    if ((this.p.comboExpireAt || 0) > 0 && performance.now() > (this.p.comboExpireAt || 0)) {
      this.p.comboCount = 0; this.p.comboMultiplier = 1; this.p.comboExpireAt = 0;
    }

    // reload/shield timers
    if (this.p.reloading && performance.now() >= this.p.reloadUntil) { this.p.reloading = false; this.p.bullets = this.p.maxHp; this.playSfx('reload_done'); }

    // platform spawn/despawn animations (faster)
    this.platforms.forEach(pl => {
      if (!pl.crumble) { pl.spawnProgress = Math.min(1, (pl.spawnProgress || 0) + dt * 1.8); }
      if (pl.crumble) { pl.crumbleProgress = Math.min(1, pl.crumbleProgress + dt * 0.9); }
      // continuous rotation
      pl.rotation = ((pl.rotation || 0) + dt * 1.5) % (Math.PI * 2);
      // despawn after 10s regardless of spawn count
      if (!pl.crumble && pl.spawnStartAt && (performance.now() - pl.spawnStartAt) >= 10000) { pl.crumble = true; pl.active = false; }
    });

    // enemies spawn/death animations
    this.enemies.forEach(e => {
      e.spawnProgress = Math.min(1, (e.spawnProgress || 0) + dt * 2.2);
      if (!e.alive && (e.deathProgress || 0) < 1) { e.deathProgress = Math.min(1, (e.deathProgress || 0) + dt * 2.0); }
    });

    // enemies move radially toward center
    const cx = this.center.x, cy = this.center.y; const hurtDist = 0.8;
    this.enemies.forEach(e => {
      if (!e.alive) return; // dying or dead do not move
      const dx = cx - e.pos.x, dy = cy - e.pos.y; const len = Math.hypot(dx, dy) || 1;
      const k = freezeActive ? 0.45 : 1.0;
      e.pos.x += (dx / len) * e.speed * dt * k; e.pos.y += (dy / len) * e.speed * dt * k;
      if (Math.hypot(cx - e.pos.x, cy - e.pos.y) < hurtDist) {
        if (this.p.shieldActive) { this.p.shieldActive = false; this.playSfx('shield_break'); }
        else { this.p.hp = Math.max(0, this.p.hp - 2); this.playSfx('hurt'); if (this.p.hp <= 0) this.gameOver(); }
        // enemy reached center: not counted as kill, it will respawn
        e.alive = false; e.deathProgress = 0;
        const pl = this.platforms.find(p => p.id === e.fromPlatformId);
        if (pl && !pl.crumble) {
          setTimeout(() => { const ne = spawnEnemyFromPlatform(pl!, this.level, this.baseEnemySpeed()); this.trySpawnEnemy(ne); }, 600);
        }
      }
    });
    // keep dying enemies for animation
    this.enemies = this.enemies.filter(e => e.alive || ((e.deathProgress || 0) < 1));

    // bosses movement and shooting
    this.bosses.forEach(b => {
      // Boss teleportation logic
      const now = performance.now();
      if (now >= (b.teleportAt || 0)) {
        const pls = this.platforms.filter(x => !x.crumble);
        if (pls.length > 0) {
          // Teleport to a random platform (try to pick a different one)
          let targetPl = pls[Math.floor(Math.random() * pls.length)];
          // Simple retry to avoid same platform if possible
          if (pls.length > 1 && dist(b.pos, { x: targetPl.pos.x + targetPl.size.x / 2, y: targetPl.pos.y + targetPl.size.y / 2 }) < 1) {
            targetPl = pls[Math.floor(Math.random() * pls.length)];
          }
          b.pos = { x: targetPl.pos.x + targetPl.size.x / 2, y: targetPl.pos.y + targetPl.size.y / 2 };
          // Play teleport sound (reuse spawn sound for now or add new)
          this.playSfx('boss_spawn');
          // Teleport FX
          this.fx.push({ id: this.id++, type: 'teleport', pos: { ...b.pos }, life: 0.5, maxLife: 0.5, color: '#FF6A00' });
        }
        b.teleportAt = now + (b.teleportDelay || 3000);
      }

      const hasActive = this.bullets.some(bb => bb.type === 'boss' && bb.ownerBossId === b.id && now <= bb.lifeUntil);
      let cd = this.hasMut('boss_burst') ? 900 : 1300;
      if (this.difficulty === 'normal') cd = 2000; // Slower shooting on normal
      if (now >= b.shootCooldownUntil && !hasActive) {
        b.shootCooldownUntil = now + cd;
        // phase-based pattern: low HP -> twin shots; mutator -> triple burst
        b.phase = (b.hp <= 2) ? 1 : 0;
        const v = norm({ x: cx - b.pos.x, y: cy - b.pos.y });
        const count = this.hasMut('boss_burst') ? 3 : ((b.phase || 0) >= 1 ? 2 : 1);
        const a = Math.PI / 22;
        if (count === 1) { this.spawnBullet(false, { x: b.pos.x, y: b.pos.y }, v, 1.0, true, b.id); }
        else if (count === 2) { this.spawnBullet(false, { x: b.pos.x, y: b.pos.y }, rotate(v, -a), 1.0, true, b.id); this.spawnBullet(false, { x: b.pos.x, y: b.pos.y }, rotate(v, a), 1.0, true, b.id); }
        else { this.spawnBullet(false, { x: b.pos.x, y: b.pos.y }, rotate(v, -a), 1.0, true, b.id); this.spawnBullet(false, { x: b.pos.x, y: b.pos.y }, v, 1.0, true, b.id); this.spawnBullet(false, { x: b.pos.x, y: b.pos.y }, rotate(v, a), 1.0, true, b.id); }
      }
    });

    // bullets
    this.bullets.forEach(b => {
      const k = freezeActive ? 0.6 : 1.0;
      b.pos.x += b.vel.x * b.speed * dt * k; b.pos.y += b.vel.y * b.speed * dt * k;
      if (b.type === 'boss') { if (performance.now() > b.lifeUntil) b.lifeUntil = Infinity; }
    });
    // boss bullets hit player (6 damage) and disappear or reflect
    this.bullets.forEach(b => {
      if (b.type === 'boss') {
        const d = dist(b.pos, { x: cx, y: cy });
        if (d < 0.8) {
          if ((this.p.reflectorCharges || 0) > 0) {
            // reflect away from center as player bullet
            const away = norm({ x: b.pos.x - cx, y: b.pos.y - cy });
            b.type = 'player'; b.vel = away; b.speed = 35; b.lifeUntil = performance.now() + 1200; this.p.reflectorCharges = (this.p.reflectorCharges || 0) - 1;
            this.impacts.push({ id: this.id++, pos: { x: b.pos.x, y: b.pos.y }, k: 0 });
            this.playSfx('reflect');
          } else {
            if (this.p.shieldActive) { this.p.shieldActive = false; this.playSfx('shield_break'); }
            else { this.p.hp = Math.max(0, this.p.hp - 6); this.playSfx('hurt'); if (this.p.hp <= 0) this.gameOver(); }
            b.lifeUntil = 0;
            this.impacts.push({ id: this.id++, pos: { x: b.pos.x, y: b.pos.y }, k: 0 });
          }
        }
      }
    });
    // impacts animation progress
    this.impacts.forEach(i => { i.k = Math.min(1, i.k + dt * 2.8); });
    this.impacts = this.impacts.filter(i => i.k < 1);

    // fx
    this.fx.forEach(f => f.life -= dt);
    this.fx = this.fx.filter(f => f.life > 0);

    // collisions bullets vs enemies/bosses/boss bullets/items
    for (const b of this.bullets) {
      if (b.type === 'player') {
        if (b.lifeUntil <= 0) continue;
        let consumed = false;
        // player vs boss bullets (destructible) — single target
        const bb = this.bullets.find(bb => bb.type === 'boss' && dist(b.pos, bb.pos) < 0.6);
        if (bb) {
          bb.hitsLeft = (bb.hitsLeft || 2) - 1;
          this.impacts.push({ id: this.id++, pos: { x: bb.pos.x, y: bb.pos.y }, k: 0 });
          this.maybePlayHitSfx();
          if ((bb.hitsLeft || 0) <= 0) { bb.lifeUntil = 0; }
          consumed = true;
        }
        // player vs enemies — pick nearest and consume
        if (!consumed) {
          let target: Enemy | undefined; let best = Infinity;
          for (const e of this.enemies) { if (e.alive) { const d = dist(b.pos, e.pos); if (d < 0.7 && d < best) { best = d; target = e; } } }
          if (target) {
            // always apply damage; shields no longer prevent bullet damage
            target.hp -= (this.p.overdriveUntil && performance.now() < (this.p.overdriveUntil || 0)) ? 2 : 1;
            this.impacts.push({ id: this.id++, pos: { x: target.pos.x, y: target.pos.y }, k: 0 });
            this.maybePlayHitSfx();
            if (target.hp <= 0) {
              target.alive = false; target.deathProgress = 0;
              this.playSfx('kill');
              this.stats.kills++;
              this.runKills++;
              this.bumpCombo();
              const mult = this.p.comboMultiplier || 1;
              const od = (this.p.overdriveUntil && performance.now() < (this.p.overdriveUntil || 0)) ? 1.5 : 1;
              const delta = Math.round(10 * mult * od);
              this.stats.score = (this.stats.score || 0) + delta; this.runScore += delta;
              this.maybeDrop(target.pos);
              const pl = this.platforms.find(p => p.id === target.fromPlatformId);
              if (pl) { pl.killsAchieved = (pl.killsAchieved || 0) + 1; }
              // siphon passive: gain one ammo every 5 kills
              if (this.p.siphonActive) { this.p.siphonProgress = (this.p.siphonProgress || 0) + 1; if ((this.p.siphonProgress || 0) >= 5) { this.p.siphonProgress = 0; this.p.bullets = Math.min(this.p.maxHp, this.p.bullets + 1); } }
              // split modifier spawns two children
              if (target.elite && target.modifier === 'split') {
                const off = [{ x: 0.4, y: 0 }, { x: -0.4, y: 0 }];
                off.forEach(o => { const child: Enemy = { id: this.id++, pos: { x: target.pos.x + o.x, y: target.pos.y + o.y }, speed: (target.speed || 0) * 0.9, alive: true, fromPlatformId: target.fromPlatformId, hp: 1, spawnProgress: 0, deathProgress: 0 } as Enemy; this.enemies.push(child); });
              }
            }
            // piercer: allow one pass-through
            if ((b.pierceLeft || 0) > 0) { b.pierceLeft = (b.pierceLeft || 0) - 1; consumed = false; }
            else { consumed = true; }
          }
        }
        // player vs items (shoot to collect)
        if (!consumed) {
          let got: Item | undefined; let bestI = Infinity;
          for (const it of this.items) { const d = dist(b.pos, it.pos); if (d < 0.7 && d < bestI) { bestI = d; got = it; } }
          if (got) {
            this.applyItem(got);
            got.spawnUntil = performance.now() - 1;
            this.impacts.push({ id: this.id++, pos: { x: got.pos.x, y: got.pos.y }, k: 0 });
            consumed = true;
          }
        }
        // player vs bosses
        if (!consumed) {
          let bossHit: Boss | undefined; let bestB = Infinity;
          for (const x of this.bosses) { const d = dist(b.pos, x.pos); if (d < 1 && d < bestB) { bestB = d; bossHit = x; } }
          if (bossHit) {
            bossHit.hp -= (this.p.overdriveUntil && performance.now() < (this.p.overdriveUntil || 0)) ? 2 : 1;
            this.impacts.push({ id: this.id++, pos: { x: bossHit.pos.x, y: bossHit.pos.y }, k: 0 });
            this.maybePlayHitSfx();
            if (bossHit.hp <= 0) {
              this.stats.bosses++; this.runBosses++;
              this.bumpCombo();
              const mult = this.p.comboMultiplier || 1; const od = (this.p.overdriveUntil && performance.now() < (this.p.overdriveUntil || 0)) ? 1.5 : 1;
              const delta = Math.round(100 * mult * od);
              this.stats.score = (this.stats.score || 0) + delta; this.runScore += delta;
              this.items.push(makeItem('heart', bossHit.pos));
              this.bosses = this.bosses.filter(q => q.id !== bossHit.id);
              this.playSfx('boss_down');
              // Immediate level progression if all bosses dead
              if (this.bosses.length === 0) {
                this.checkLevelCompletion();
              }
            }
            consumed = true;
          }
        }
        if (consumed) { b.lifeUntil = 0; }
      }
    }
    const now = performance.now();
    this.items = this.items.filter(i => now <= i.spawnUntil);
    this.bullets = this.bullets.filter(b => now <= b.lifeUntil);

    // platforms crumble when their kill quota is achieved
    this.platforms.forEach(pl => {
      if (!pl.crumble && (pl.killsAchieved || 0) >= (pl.killQuota || 0)) { pl.crumble = true; pl.active = false; }
    });

    // Concurrent Platform Activation Logic
    if (!this.isBossRound()) {
      const activeCount = this.platforms.filter(p => p.active && !p.crumble).length;
      // Max concurrent platforms: 1 (Lvl 1-3), 2 (Lvl 4-7), 3 (Lvl 8+)
      const maxConcurrent = this.level < 4 ? 1 : (this.level < 8 ? 2 : 3);

      // Activation delay decreases with level: 4000ms -> ~1000ms
      // Formula: 4000 / (1 + level * 0.15)
      const activationDelay = 4000 / (1 + this.level * 0.15);

      const now = performance.now();
      if (activeCount < maxConcurrent &&
        this.nextPlatformIndex < this.platforms.length &&
        now > this.lastActivationTime + activationDelay) {

        this.activatePlatform(this.nextPlatformIndex);
        this.nextPlatformIndex++;
        this.lastActivationTime = now;
      }
    }

    // items drift toward center and apply
    this.items.forEach(it => { const v = norm({ x: cx - it.pos.x, y: cy - it.pos.y }); it.pos.x += v.x * 0.8 * dt; it.pos.y += v.y * 0.8 * dt; if (dist(it.pos, { x: cx, y: cy }) < 0.7) { this.applyItem(it); it.spawnUntil = 0; } });
    this.items = this.items.filter(i => performance.now() <= i.spawnUntil);

    // progress to next level when all platforms are gone (and bosses cleared)
    if (this.platforms.every(p => p.crumbleProgress >= 1) && this.bosses.length === 0 && this.enemies.length === 0) {
      this.completeLevel();
    } else {
      // Fallback: if we've been stuck too long, force level completion
      this.checkLevelCompletion();
    }
  }

  private checkLevelCompletion() {
    // Check if all platforms have achieved their kill quota or are crumbling
    const allPlatformsComplete = this.platforms.every(p =>
      (p.killsAchieved || 0) >= (p.killQuota || 0) || p.crumble
    );

    // If all platforms are complete and no bosses remain, complete the level
    // OR if it's a boss round and bosses are dead (immediate progression)
    if ((allPlatformsComplete && this.bosses.length === 0 && this.enemies.length === 0) || (this.isBossRound() && this.bosses.length === 0)) {
      // Force any remaining platforms to crumble
      this.platforms.forEach(p => {
        if (!p.crumble) {
          p.crumble = true;
          p.active = false;
        }
      });

      // If all platforms are now crumbling/crumbled, complete the level
      // For boss rounds, we can just complete immediately
      if (this.platforms.every(p => p.crumble) || this.isBossRound()) {
        this.completeLevel();
      }
    }
  }

  private completeLevel() {
    // start animated transition
    this.transitioning = true; this.levelTransitionK = 0; this.nextLevel = this.level + 1; this.playSfx('level_up');
    const s = loadSave();
    s.maxLevel = Math.max(s.maxLevel || 1, this.nextLevel);
    s.maxKills = Math.max(s.maxKills || 0, this.runKills);
    s.maxBosses = Math.max(s.maxBosses || 0, this.runBosses);
    s.maxScore = Math.max(s.maxScore || 0, this.runScore);
    s.level = this.nextLevel; s.stats = this.stats; s.hp = this.p.maxHp; s.maxHp = this.p.maxHp; s.selectedSkin = this.p.skin; s.sniperUses = this.p.sniperUses;
    saveLS(s);
  }

  private draw() {
    const w = this.canvas.width, h = this.canvas.height;
    this.renderer.clear(w, h);
    this.renderer.drawGrid(w, h);
    this.renderer.drawPlatforms(this.platforms);
    this.renderer.drawEnemies(this.enemies, this.level);
    this.renderer.drawBosses(this.bosses);
    this.renderer.drawItems(this.items);
    this.renderer.drawBullets(this.bullets);
    this.renderer.drawImpacts(this.impacts);
    this.renderer.drawFX(this.fx);
    this.renderer.drawPlayer({ x: this.center.x * this.pixel, y: this.center.y * this.pixel }, this.p);
    this.renderer.drawUI(w, h, this.p, this.level, this.p.sniperUses, this.mutators, this.p.comboMultiplier || 1, this.p.comboCount || 0);
    if (this.transitioning) { this.renderer.drawLevelTransition(w, h, this.levelTransitionK, this.level + 1); }
    if (this.paused && !this.over) { this.renderer.drawPauseMenu(w, h, this.pauseOptions, this.pauseSel); }
  }

  private onKey = (e: KeyboardEvent) => {
    const k = e.key;
    this.ensureAudio();
    if (this.over) { if (k === ' ') this.reset(); e.preventDefault(); return; }

    // Get valid keys based on current layout
    const validKeys = this.keyboardLayout === 'azerty'
      ? ['z', 'Z', 'q', 'Q', 'd', 'D', 's', 'S', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'p', 'P', 'Enter', 'o', 'O']
      : ['w', 'W', 'a', 'A', 'd', 'D', 's', 'S', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'p', 'P', 'Enter', 'o', 'O'];

    if (validKeys.includes(k)) e.preventDefault();
    if (k === 'p' || k === 'P') { this.paused = !this.paused; this.pauseSel = 0; return; }
    if (k === 'o' || k === 'O') { this.p.overdriveUntil = performance.now() + 5000; this.p.overdriveNextDrainAt = performance.now() + 800; this.playSfx('overdrive_on'); return; }
    if (this.paused) {
      // Get pause navigation keys based on layout
      const upKeys = this.keyboardLayout === 'azerty' ? ['ArrowUp', 'z', 'Z'] : ['ArrowUp', 'w', 'W'];
      const downKeys = ['ArrowDown', 's', 'S'];

      if (upKeys.includes(k)) { this.pauseSel = (this.pauseSel - 1 + this.pauseOptions.length) % this.pauseOptions.length; return; }
      if (downKeys.includes(k)) { this.pauseSel = (this.pauseSel + 1) % this.pauseOptions.length; return; }
      if (k === 'Enter' || k === ' ') { this.handlePauseSelection(); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight') { this.handlePauseHorizontal(k === 'ArrowRight'); return; }
      return;
    }
    if (k === ' ') { this.shoot(); return; }
    // Track directional keys for both layouts + arrows and update facing
    this.keys.add(k.toLowerCase());
    this.updateRotationFromKeys();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    // Get valid movement keys based on current layout
    const validKeys = this.keyboardLayout === 'azerty'
      ? ['z', 'q', 'd', 's', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']
      : ['w', 'a', 'd', 's', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

    if (validKeys.includes(k)) {
      this.keys.delete(k);
      this.updateRotationFromKeys();
    }
  };

  private updateRotationFromKeys() {
    // Get movement keys based on current layout
    const moveKeys = this.keyboardLayout === 'azerty' ? {
      up: this.keys.has('z') || this.keys.has('arrowup'),
      right: this.keys.has('d') || this.keys.has('arrowright'),
      down: this.keys.has('s') || this.keys.has('arrowdown'),
      left: this.keys.has('q') || this.keys.has('arrowleft')
    } : {
      up: this.keys.has('w') || this.keys.has('arrowup'),
      right: this.keys.has('d') || this.keys.has('arrowright'),
      down: this.keys.has('s') || this.keys.has('arrowdown'),
      left: this.keys.has('a') || this.keys.has('arrowleft')
    };

    let idx = this.p.rot;
    // Check diagonals first
    if (moveKeys.up && moveKeys.right) idx = 7; // up-right
    else if (moveKeys.down && moveKeys.right) idx = 1; // down-right
    else if (moveKeys.down && moveKeys.left) idx = 3; // down-left
    else if (moveKeys.up && moveKeys.left) idx = 5; // up-left
    // Then cardinals
    else if (moveKeys.up) idx = 6; // up
    else if (moveKeys.right) idx = 0; // right
    else if (moveKeys.down) idx = 2; // down
    else if (moveKeys.left) idx = 4; // left

    this.p.rot = idx;
  }

  private spawnWaveSlow(es: Enemy[], perDelay: number = 500) {
    es.forEach((e, i) => {
      setTimeout(() => { this.trySpawnEnemy(e); }, i * perDelay + Math.random() * perDelay * 0.25);
    });
  }

  private aliveEnemyCount() { return this.enemies.filter(e => e.alive).length; }
  private aliveOnPlatform(plId: number) { return this.enemies.filter(e => e.alive && e.fromPlatformId === plId).length; }
  private platformCenterPos(pl: Platform) { return { x: pl.pos.x + pl.size.x / 2, y: pl.pos.y + pl.size.y / 2 }; }

  private trySpawnFromPlatform(pl: Platform) {
    if (this.over || this.paused || pl.crumble || !pl.active) return;
    if ((pl.spawnProgress || 0) < 1) return; // wait for platform spawn animation
    // limit concurrent alive enemies per platform based on level (4..10)
    let densityAdd = 0;
    if (this.difficulty === 'normal') densityAdd = 1;
    if (this.difficulty === 'hard') densityAdd = 2;
    const maxConcurrent = Math.min(12, 4 + Math.floor(this.level / 3) + densityAdd);
    if (this.aliveOnPlatform(pl.id) >= maxConcurrent) return;
    // stop spawning when quota achieved
    if ((pl.killsAchieved || 0) >= (pl.killQuota || 0)) {
      // Mark platform for crumbling if quota is met
      if (!pl.crumble) {
        pl.crumble = true;
        pl.active = false;
      }
      return;
    }
    // ensure previous enemy moved away from platform center
    const c = this.platformCenterPos(pl);
    const nearPrev = this.enemies.some(q => q.alive && q.fromPlatformId === pl.id && dist(q.pos, c) < 1.0);
    if (nearPrev) return;
    // Only check global cap, but don't block platform-specific spawning
    // Each platform spawns independently based on its own timer and limits
    const ne = spawnEnemyFromPlatform(pl, this.level, this.baseEnemySpeed());
    this.trySpawnEnemy(ne);
  }

  private trySpawnEnemy(e: Enemy) {
    if (this.over || this.paused) return;
    const pl = this.platforms.find(p => p.id === e.fromPlatformId);
    if (!pl || pl.crumble || !pl.active) return;
    // gate until platform spawn animation finishes
    if ((pl.spawnProgress || 0) < 1) { setTimeout(() => this.trySpawnEnemy(e), 250); return; }
    // per-platform concurrency limit
    let densityAdd = 0;
    if (this.difficulty === 'normal') densityAdd = 1;
    if (this.difficulty === 'hard') densityAdd = 2;
    const maxConcurrent = Math.min(12, 4 + Math.floor(this.level / 3) + densityAdd);
    if (this.aliveOnPlatform(pl.id) >= maxConcurrent) { setTimeout(() => this.trySpawnEnemy(e), 600); return; }
    // only spawn once the previous has moved away from platform center
    const c = this.platformCenterPos(pl);
    const nearPrev = this.enemies.some(q => q.alive && q.fromPlatformId === pl.id && dist(q.pos, c) < 1.0);
    if (nearPrev) { setTimeout(() => this.trySpawnEnemy(e), 300); return; }
    // prevent overlap within enemy hitbox area on same platform
    const overlapping = this.enemies.some(q => q.alive && q.fromPlatformId === pl.id && dist(q.pos, c) < 0.8);
    if (overlapping) { setTimeout(() => this.trySpawnEnemy(e), 300); return; }
    // Only respect global cap for environment management, but allow platform independence
    // Force spawn if platform has 0 enemies (min guarantee)
    const countOnPl = this.aliveOnPlatform(pl.id);
    if (countOnPl > 0 && this.aliveEnemyCount() >= this.enemyCap * 2) { setTimeout(() => this.trySpawnEnemy(e), 350); return; }
    // spawn on exact radial line (platform center already aligned)
    this.enemies.push(e);
    // track per-round spawn count
    pl.spawnedCount = (pl.spawnedCount || 0) + 1;
  }

  private shoot() {
    if (this.p.reloading) return;
    if (this.p.sniperUses > 0) { // clear two random platforms
      const alivePl = this.platforms.filter(p => !p.crumble);
      shuffle(alivePl); alivePl.slice(0, 2).forEach(pl => {
        this.enemies.forEach(e => { if (e.fromPlatformId === pl.id) e.alive = false; });
        pl.killsAchieved = pl.killQuota || 0; pl.crumble = true;
        // Beam FX
        const start = { x: this.center.x, y: this.center.y };
        const end = { x: pl.pos.x + pl.size.x / 2, y: pl.pos.y + pl.size.y / 2 };
        this.fx.push({ id: this.id++, type: 'beam', pos: start, endPos: end, life: 0.3, maxLife: 0.3, color: '#00FFFF' });
      });
      this.p.sniperUses--; this.stats.shots++; saveLS(this.buildSave()); return;
    }
    if (this.p.bullets <= 0 && !this.p.reloading) { this.p.reloading = true; this.p.reloadUntil = performance.now() + 1500; this.playSfx('reload_start'); return; }
    const d = DIRS[this.p.rot]; const v = norm(d);
    const start = { x: this.center.x, y: this.center.y };
    const burst = (this.p.burstShots || 0) > 0 && this.p.bullets >= 3;
    if (burst) {
      const a = Math.PI / 18; // ~10deg spread
      this.spawnBullet(true, start, rotate(v, -a), 40, false);
      this.spawnBullet(true, start, v, 40, false);
      this.spawnBullet(true, start, rotate(v, a), 40, false);
      this.playSfx('shot_burst');
      this.p.burstShots = Math.max(0, (this.p.burstShots || 0) - 1);
      this.p.bullets -= 3; this.stats.shots += 3;
    } else {
      this.spawnBullet(true, start, v, 40, false);
      this.playSfx('shot');
      this.p.bullets--; this.stats.shots++;
    }
    if (this.p.bullets <= 0 && !this.p.reloading) { this.p.reloading = true; this.p.reloadUntil = performance.now() + 1500; this.playSfx('reload_start'); }
  }

  private spawnBullet(player: boolean, pos: Vec, v: Vec, speed: number, bossSlow: boolean, ownerBossId?: number) {
    const id = this.id++;
    const life = performance.now() + 1500;
    let spd = speed;
    if (!player && bossSlow) {
      const L = dist(pos, this.center);
      // reach player in 8 seconds
      spd = L / 8;
    }
    const pierceLeft = player ? ((this.p.piercerShots || 0) > 0 ? 1 : undefined) : undefined;
    this.bullets.push({ id, type: player ? 'player' : 'boss', pos: { ...pos }, vel: { ...v }, speed: spd, lifeUntil: life, hitsLeft: player ? undefined : 2, ownerBossId, pierceLeft });
    if (player && pierceLeft) { this.p.piercerShots = Math.max(0, (this.p.piercerShots || 0) - 1); }
  }

  private maybeDrop(pos: Vec) {
    const lvl = this.level;
    const commonApple = Math.max(0.05, 0.08 - lvl * 0.003);
    const commonShield = Math.min(0.13, 0.09 + lvl * 0.004);
    const sniperChance = Math.max(0.09, 0.11 - lvl * 0.002);
    const skinChance = 0.03;
    const specialChance = Math.min(0.20, 0.10 + lvl * 0.006);
    const r = Math.random(); let it: Item | null = null; let acc = 0;
    if (r < (acc += commonApple)) it = makeItem('apple', pos);
    else if (r < (acc += commonShield)) it = makeItem('shield', pos);
    else if (r < (acc += sniperChance)) it = makeItem('sniper', pos);
    else if (r < (acc += skinChance)) it = makeItem('skin', pos);
    else if (r < (acc += specialChance)) { const pool: Item['type'][] = ['freeze', 'reflector', 'piercer', 'burst', 'siphon', 'heart']; const t = pool[Math.floor(Math.random() * pool.length)]; it = makeItem(t, pos); }
    if (it) this.items.push(it);
  }

  private applyItem(i: Item) {
    switch (i.type) {
      case 'heart': this.p.maxHp += 1; this.p.hp = this.p.maxHp; this.p.bullets = this.p.maxHp; break;
      case 'apple': this.p.hp = Math.min(this.p.maxHp, this.p.hp + 3); break;
      case 'shield': this.p.shieldActive = true; break;
      case 'sniper': this.p.sniperUses += 1; break;
      case 'skin': const pool = ['default', 'red', 'blue']; const nxt = pool[(pool.indexOf(this.p.skin) + 1) % pool.length]; this.p.skin = nxt; break;
      case 'freeze': this.p.timeFreezeUntil = performance.now() + 4000; break;
      case 'reflector': this.p.reflectorCharges = (this.p.reflectorCharges || 0) + 1; break;
      case 'siphon': this.p.siphonActive = true; this.p.siphonProgress = this.p.siphonProgress || 0; break;
      case 'piercer': this.p.piercerShots = (this.p.piercerShots || 0) + 5; break;
      case 'burst': this.p.burstShots = (this.p.burstShots || 0) + 1; break;
    }
    this.playSfx('pickup_' + i.type);
    // stats and run item counters + score
    this.stats.items = this.stats.items || { heart: 0, apple: 0, shield: 0, sniper: 0, skin: 0, freeze: 0, reflector: 0, siphon: 0, piercer: 0, burst: 0 };
    const k = i.type as keyof SaveData['stats']['items'];
    if (this.stats.items[k] !== undefined) { this.stats.items[k] += 1; }
    if (this.runItems[k] !== undefined) { this.runItems[k] += 1; }
    const itemScore = k === 'heart' ? 20 : k === 'sniper' ? 8 : k === 'skin' ? 10 : (k === 'freeze' || k === 'reflector' || k === 'piercer' || k === 'burst' || k === 'siphon' ? 6 : 3);
    let scoreMult = 1;
    if (this.difficulty === 'normal') scoreMult = 2;
    if (this.difficulty === 'hard') scoreMult = 4;
    this.stats.score = (this.stats.score || 0) + itemScore * scoreMult;
    this.runScore += itemScore * scoreMult;
    saveLS(this.buildSave());
  }

  private bumpCombo() {
    const now = performance.now();
    const prevMul = this.p.comboMultiplier || 1;
    if (now <= (this.p.comboExpireAt || 0)) { this.p.comboCount = (this.p.comboCount || 0) + 1; }
    else { this.p.comboCount = 1; }
    this.p.comboExpireAt = now + 1600;
    this.p.comboMultiplier = 1 + Math.min(2, (this.p.comboCount || 1) * 0.08);
    if ((this.p.comboMultiplier || 1) > prevMul) { this.playSfx('combo_up'); }
  }

  private isBossRound() { return this.level % 6 === 0; }

  private autosave() { saveLS(this.buildSave()); }
  private buildSave(): SaveData {
    const s = loadSave();
    return {
      level: this.level, stats: this.stats, maxHp: this.p.maxHp, hp: this.p.hp, skins: ['default', 'red', 'blue'], selectedSkin: this.p.skin, sniperUses: this.p.sniperUses,
      maxLevel: Math.max(s.maxLevel || 1, this.level),
      maxKills: s.maxKills || 0,
      maxBosses: s.maxBosses || 0,
      maxScore: s.maxScore || 0,
      difficulty: this.difficulty
    };
  }

  private onResize = () => { this.canvas.width = Math.floor((window.innerWidth * 0.8) / this.pixel) * this.pixel; this.canvas.height = Math.floor((window.innerHeight * 0.8) / this.pixel) * this.pixel; this.gridW = this.canvas.width / this.pixel; this.gridH = this.canvas.height / this.pixel; this.center = { x: this.gridW / 2, y: this.gridH / 2 }; };

  private gameOver() {
    this.over = true;
    const s = loadSave();
    s.maxKills = Math.max(s.maxKills || 0, this.runKills);
    s.maxBosses = Math.max(s.maxBosses || 0, this.runBosses);
    s.maxScore = Math.max(s.maxScore || 0, this.runScore);
    s.stats = this.stats; s.level = 1; s.hp = this.p.maxHp; s.maxHp = this.p.maxHp; s.selectedSkin = this.p.skin; s.sniperUses = this.p.sniperUses; s.difficulty = this.difficulty;
    saveLS(s);
    this.level = 1;
  }
  private reset() {
    this.over = false;
    this.level = 1;
    // Default stats: Easy=15, Normal=10, Hard=5
    this.p.maxHp = this.difficulty === 'hard' ? 5 : (this.difficulty === 'normal' ? 10 : 15);
    this.p.hp = this.p.maxHp;
    this.p.reloading = false;
    this.p.bullets = this.p.maxHp;
    this.platforms = []; this.enemies = []; this.bullets = []; this.items = []; this.fx = [];
    this.runKills = 0; this.runBosses = 0; this.runScore = 0;
    this.runItems = { heart: 0, apple: 0, shield: 0, sniper: 0, skin: 0, freeze: 0, reflector: 0, siphon: 0, piercer: 0, burst: 0 };
    this.startLevel();
  }

  private handlePauseSelection() {
    const opt = this.pauseOptions[this.pauseSel];
    if (opt === 'Resume') { this.paused = false; }
    else if (opt === 'Restart') { this.reset(); this.paused = false; }
    else if (opt === 'Main Menu') {
      const s = loadSave(); s.level = 1; s.hp = this.p.maxHp; s.maxHp = this.p.maxHp; s.stats = this.stats; s.selectedSkin = this.p.skin; s.sniperUses = this.p.sniperUses; s.difficulty = this.difficulty; saveLS(s);
      this.destroy(); window.location.href = '/games/octashot';
    }
  }

  private handlePauseHorizontal(right: boolean) {
    const opt = this.pauseOptions[this.pauseSel];
    if (opt.startsWith('Difficulty')) {
      const diffs: Difficulty[] = ['easy', 'normal', 'hard'];
      let idx = diffs.indexOf(this.difficulty);
      if (right) idx = (idx + 1) % diffs.length;
      else idx = (idx - 1 + diffs.length) % diffs.length;
      this.difficulty = diffs[idx];
      this.updatePauseMenuDiff();
      // Save immediately
      const s = loadSave(); s.difficulty = this.difficulty; saveLS(s);
    }
  }

  private updatePauseMenuDiff() {
    const label = this.difficulty.charAt(0).toUpperCase() + this.difficulty.slice(1);
    this.pauseOptions[2] = `Difficulty: ${label}`;
  }

  public setKeyboardLayout(layout: 'azerty' | 'qwerty') {
    this.keyboardLayout = layout;
    // Clear current keys to avoid conflicts when switching layouts
    this.keys.clear();
  }

  public getKeyboardLayout(): 'azerty' | 'qwerty' {
    return this.keyboardLayout;
  }

  public destroy() { cancelAnimationFrame(this.loop!); document.removeEventListener('keydown', this.onKey); document.removeEventListener('keyup', this.onKeyUp); window.removeEventListener('resize', this.onResize); this.canvas.remove(); }

  private ensureAudio() {
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx && AC) {
        this.audioCtx = new AC();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => { });
      }
    } catch { }
  }

  private playSfx(kind: string) {
    if (!this.audioCtx || this.audioCtx.state === 'suspended') { this.ensureAudio(); }
    const ctx = this.audioCtx; if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freqMap: Record<string, number> = {
      'pickup_heart': 500,
      'pickup_apple': 640,
      'pickup_shield': 400,
      'pickup_sniper': 900,
      'pickup_skin': 700,
      'pickup_freeze': 560,
      'pickup_reflector': 880,
      'pickup_siphon': 600,
      'pickup_piercer': 680,
      'pickup_burst': 820,
      'overdrive_on': 1200,
      'shot': 950,
      'shot_burst': 780,
      'reload_start': 300,
      'reload_done': 640,
      'hit': 450,
      'kill': 520,
      'boss_spawn': 220,
      'boss_down': 260,
      'level_up': 1050,
      'reflect': 1000,
      'hurt': 200,
      'combo_up': 1150,
    };
    const f = freqMap[kind] || 700;
    osc.type = 'square';
    osc.frequency.value = f;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  private maybePlayHitSfx() {
    const now = performance.now();
    if (now - (this.lastHitSoundAt || 0) > 80) {
      this.playSfx('hit');
      this.lastHitSoundAt = now;
    }
  }
}

// helpers
function norm(v: Vec) { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; }
function dist(a: Vec, b: Vec) { return Math.hypot(a.x - b.x, a.y - b.y); }
function rotate(v: Vec, a: number) { const ca = Math.cos(a), sa = Math.sin(a); return { x: v.x * ca - v.y * sa, y: v.x * sa + v.y * ca }; }
function shuffle<T>(x: T[]) { for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; } }
function makeItem(type: Item['type'], pos: Vec) { const id = Math.floor(Math.random() * 100000); return { id, type, pos: { ...pos }, vel: { x: 0, y: 0 }, spawnUntil: performance.now() + 10000 }; }