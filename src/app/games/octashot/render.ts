import { Player, Platform, Enemy, Boss, Bullet, Item, Vec, VisualFX } from './entities';

export class Renderer {
  constructor(private ctx: CanvasRenderingContext2D, private pixel: number) { }

  clear(w: number, h: number) {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, w, h);
  }

  drawGrid(w: number, h: number) {
    this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < w; x += this.pixel) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, h); this.ctx.stroke();
    }
    for (let y = 0; y < h; y += this.pixel) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(w, y); this.ctx.stroke();
    }
  }

  drawPlayer(center: Vec, p: Player) {
    const c = this.ctx;
    const size = this.pixel * 1.6;
    const x = center.x - size / 2, y = center.y - size / 2;
    c.fillStyle = p.skin === 'red' ? '#D33' : p.skin === 'blue' ? '#39F' : '#CCC';
    c.strokeStyle = '#222'; c.lineWidth = 3;
    c.fillRect(x, y, size, size); c.strokeRect(x, y, size, size);
    // visor/face stripe
    c.fillStyle = '#111';
    c.fillRect(x + size * 0.15, y + size * 0.35, size * 0.7, size * 0.18);
    // gun block
    const gun = this.pixel * 0.9;
    const off = this.dirOffset(p.rot, this.pixel);
    c.fillStyle = '#444';
    c.fillRect(center.x + off.x - gun / 2, center.y + off.y - gun / 2, gun, gun);

    // Shield pulse
    if (p.shieldActive) {
      const shieldK = 0.5 + 0.5 * Math.sin(performance.now() / 150);
      c.strokeStyle = '#42A5F5';
      c.lineWidth = 2;
      c.globalAlpha = 0.4 + 0.4 * shieldK;
      c.beginPath();
      c.arc(center.x, center.y, size * (0.8 + 0.1 * shieldK), 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  private dirOffset(idx: number, d: number): Vec {
    const u = [
      { x: d, y: 0 }, { x: d, y: d }, { x: 0, y: d }, { x: -d, y: d },
      { x: -d, y: 0 }, { x: -d, y: -d }, { x: 0, y: -d }, { x: d, y: -d }
    ];
    return u[idx % 8];
  }

  drawPlatforms(platforms: Platform[]) {
    const c = this.ctx, ps = this.pixel;
    platforms.forEach(pl => {
      const x = (pl.pos.x + pl.size.x / 2) * ps;
      const y = (pl.pos.y + pl.size.y / 2) * ps;
      const r = Math.min(pl.size.x, pl.size.y) * ps * 0.5;
      const spawnK = Math.min(1, (pl.spawnProgress || 0));
      const crumbleK = pl.crumble ? Math.min(1, pl.crumbleProgress) : 0;
      const liveK = pl.crumble ? 1 - crumbleK : spawnK;
      const rot = pl.rotation || 0;
      const aliveMs = pl.spawnStartAt ? (performance.now() - pl.spawnStartAt) : 0;
      const flicker = (!pl.crumble && aliveMs > 8000) ? (0.9 + 0.1 * Math.sin(performance.now() * 30)) : 1;

      c.save();
      // glow ring
      c.globalAlpha = 0.8 * flicker;
      c.strokeStyle = '#27A0FF';
      c.lineWidth = 3;
      const segs = 12;
      for (let i = 0; i < segs; i++) {
        const a0 = (Math.PI * 2) * (i / segs) + rot;
        const a1 = (Math.PI * 2) * ((i + 0.6) / segs) + rot;
        c.beginPath();
        c.arc(x, y, r * liveK * 1.05, a0, Math.min(a1, a0 + Math.PI * 2 * spawnK));
        c.stroke();
      }
      // core circle
      c.globalAlpha = (pl.active ? 0.9 : 0.6) * flicker;
      c.fillStyle = '#27A0FF';
      c.beginPath(); c.arc(x, y, r * liveK, 0, Math.PI * 2); c.fill();
      // inner ring
      c.globalAlpha = 1 * flicker;
      c.strokeStyle = '#0B4C8C'; c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, r * liveK * 0.7, 0, Math.PI * 2); c.stroke();
      // despawn cracks
      if (pl.crumble) {
        c.globalAlpha = 0.9 * flicker;
        c.strokeStyle = '#0B4C8C'; c.lineWidth = 2;
        const cracks = 8;
        for (let k = 0; k < cracks; k++) {
          const ang = (Math.PI * 2) * (k / cracks) + rot;
          const len = r * liveK * (0.6 + 0.3 * Math.sin(performance.now() / 200 + k));
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
        }
      }
      c.restore();

    });
  }

  drawEnemies(enemies: Enemy[], level: number = 1) {
    const c = this.ctx, ps = this.pixel;
    enemies.forEach(e => {
      const x = e.pos.x * ps, y = e.pos.y * ps;
      const s0 = ps * 1.3; // slightly smaller than player (player ~1.6*ps)
      const spawnK = Math.min(1, (e.spawnProgress || 0));
      const deathK = Math.min(1, (e.deathProgress || 0));
      const scale = Math.max(0.2, spawnK) * Math.max(0, 1 - deathK);
      const s = s0 * scale;
      c.save(); c.translate(x, y);
      c.rotate(deathK * Math.PI * 1.5);
      c.globalAlpha = 0.9 * Math.max(0.4, scale);
      // body
      const baseFill = deathK > 0 ? '#C62828' : '#64C864';
      const eliteTint = '#B064E6';
      c.fillStyle = e.elite ? eliteTint : baseFill;
      c.strokeStyle = deathK > 0 ? '#8B1A1A' : (e.elite ? '#6A2AA6' : '#2A5A2A'); c.lineWidth = 2;
      c.beginPath(); c.rect(-s / 2, -s / 2, s, s); c.fill(); c.stroke();
      // eyes
      c.fillStyle = '#FFF';
      c.fillRect(-s * 0.28, -s * 0.15, s * 0.18, s * 0.18);
      c.fillRect(s * 0.10, -s * 0.15, s * 0.18, s * 0.18);
      c.fillStyle = '#9F0000';
      c.fillRect(-s * 0.25, -s * 0.12, s * 0.1, s * 0.1);
      c.fillRect(s * 0.13, -s * 0.12, s * 0.1, s * 0.1);
      // mouth
      c.fillStyle = '#2A2A2A';
      c.fillRect(-s * 0.18, s * 0.1, s * 0.36, s * 0.12);
      // hp bar
      c.strokeStyle = '#1E3A1E'; c.lineWidth = 1;
      c.beginPath(); c.rect(-s * 0.5, -s * 0.8, s, s * 0.12); c.stroke();
      c.fillStyle = '#43A047';
      const hpK = Math.max(0, Math.min(1, (e.hp || 0) / 50));
      c.fillRect(-s * 0.5, -s * 0.8, s * hpK, s * 0.12);
      c.restore();

      // Health bar - only show if damaged and fully spawned
      if (e.hp > 0 && e.hp < (e.elite ? (3 + Math.floor(level / 4)) : (1 + Math.floor(level / 4))) && spawnK >= 1 && deathK === 0) {
        const maxHp = e.elite ? (3 + Math.floor(level / 4)) : (1 + Math.floor(level / 4));
        const barWidth = s * 0.8;
        const barHeight = Math.max(2, s * 0.08);
        const barY = y - s / 2 - barHeight - 2;

        // Background
        c.fillStyle = 'rgba(0,0,0,0.6)';
        c.fillRect(x - barWidth / 2, barY, barWidth, barHeight);

        // Health fill
        const healthRatio = e.hp / maxHp;
        const fillWidth = barWidth * healthRatio;
        c.fillStyle = healthRatio > 0.6 ? '#4CAF50' : healthRatio > 0.3 ? '#FF9800' : '#F44336';
        c.fillRect(x - barWidth / 2, barY, fillWidth, barHeight);

        // Border
        c.strokeStyle = 'rgba(255,255,255,0.8)';
        c.lineWidth = 1;
        c.strokeRect(x - barWidth / 2, barY, barWidth, barHeight);
      }
    });
  }

  drawBosses(bosses: Boss[]) {
    const c = this.ctx, ps = this.pixel;
    bosses.forEach(b => {
      const x = b.pos.x * ps, y = b.pos.y * ps;
      const s0 = ps * 2.2; // larger than player
      const spawnK = Math.min(1, (b.spawnProgress || 0));
      const s = s0 * Math.max(0.25, spawnK);
      c.save(); c.translate(x, y);
      c.fillStyle = '#FF6A00'; c.strokeStyle = '#8A3400'; c.lineWidth = 3;
      c.beginPath(); c.rect(-s / 2, -s / 2, s, s); c.fill(); c.stroke();
      // horns
      c.fillStyle = '#FFB74D';
      c.beginPath(); c.moveTo(-s * 0.45, -s * 0.45); c.lineTo(-s * 0.15, -s * 0.6); c.lineTo(-s * 0.15, -s * 0.3); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(s * 0.45, -s * 0.45); c.lineTo(s * 0.15, -s * 0.6); c.lineTo(s * 0.15, -s * 0.3); c.closePath(); c.fill();
      // eyes
      c.fillStyle = '#FFF';
      c.fillRect(-s * 0.25, -s * 0.1, s * 0.2, s * 0.2);
      c.fillRect(s * 0.05, -s * 0.1, s * 0.2, s * 0.2);
      // mouth
      c.fillStyle = '#4A1F00';
      c.fillRect(-s * 0.22, s * 0.18, s * 0.44, s * 0.16);
      c.restore();

      // health bar (8 segments) above boss
      const segs = 8;
      const bw = s0; const bh = this.pixel * 0.18;
      const bx = x - bw / 2; const by = y - s0 * 0.7;
      c.save();
      c.strokeStyle = '#3E2723'; c.lineWidth = 2;
      c.beginPath(); c.rect(bx, by, bw, bh); c.stroke();
      for (let i = 0; i < segs; i++) {
        const filled = i < Math.max(0, Math.min(segs, b.hp));
        c.fillStyle = filled ? '#FF8F00' : '#5D4037';
        const sw = (bw - 6) / segs; const sx = bx + 3 + i * sw; const sy = by + 3;
        c.beginPath(); c.rect(sx, sy, sw - 4, bh - 6); c.fill();
      }
      c.restore();
    });
  }

  drawBullets(bullets: Bullet[]) {
    const c = this.ctx, ps = this.pixel;
    bullets.forEach(b => {
      const x = b.pos.x * ps, y = b.pos.y * ps;
      if (b.type === 'player') {
        const scale = 1;
        c.save(); c.translate(x, y);
        c.rotate(Math.atan2(b.vel.y, b.vel.x));
        c.fillStyle = '#FFF';
        c.strokeStyle = '#AAA';
        c.beginPath();
        c.moveTo(0, -ps * 0.14 * scale);
        c.lineTo(ps * 0.32 * scale, 0);
        c.lineTo(0, ps * 0.14 * scale);
        c.lineTo(-ps * 0.32 * scale, 0);
        c.closePath();
        c.fill(); c.stroke();
        c.restore();
      } else {
        // boss fireball: bright core with orange glow, ~half player size
        const R = ps * 0.4; // radius ~ half of player side (player side ~1.6*ps)
        const grad = c.createRadialGradient(x, y, R * 0.2, x, y, R);
        grad.addColorStop(0, '#FFF176'); // yellow core
        grad.addColorStop(0.5, '#FFA726'); // orange mid
        grad.addColorStop(1, 'rgba(255,87,34,0.6)'); // orange-red glow
        c.save();
        c.fillStyle = grad;
        c.strokeStyle = '#B71C1C';
        c.lineWidth = 2;
        c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fill(); c.stroke();
        // small flame flicker
        c.globalAlpha = 0.8;
        c.fillStyle = 'rgba(255, 255, 255, 0.4)';
        c.beginPath(); c.arc(x + (Math.random() - 0.5) * ps * 0.1, y + (Math.random() - 0.5) * ps * 0.1, R * 0.35, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    });
  }

  drawImpacts(imps: { pos: Vec; k: number }[]) {
    const c = this.ctx, ps = this.pixel;
    imps.forEach(i => {
      const x = i.pos.x * ps, y = i.pos.y * ps;
      c.save();
      c.globalAlpha = Math.max(0, 1 - i.k);
      c.strokeStyle = '#E53935'; c.lineWidth = 2;
      const R = ps * (0.2 + 0.6 * i.k);
      for (let r = 0; r < 2; r++) {
        c.beginPath();
        c.arc(x, y, R + r * 3, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
    });
  }

  drawFX(fx: VisualFX[]) {
    const c = this.ctx, ps = this.pixel;
    fx.forEach(f => {
      if (f.type === 'beam' && f.endPos) {
        const k = f.life / f.maxLife;
        c.save();
        c.globalAlpha = k;
        c.strokeStyle = f.color || '#0FF';
        c.lineWidth = ps * (0.5 + 2 * k); // expands then shrinks? actually shrinks as life goes down
        // make it expand then shrink: sin wave? or just fade out?
        // "expands fast and then shrinks" -> use k
        // k goes 1 -> 0.
        // width: starts thick, gets thin? or thin->thick->thin?
        // let's do simple fade out with width scaling
        c.lineWidth = ps * 2 * Math.sin(k * Math.PI);
        c.beginPath();
        c.moveTo(f.pos.x * ps, f.pos.y * ps);
        c.lineTo(f.endPos.x * ps, f.endPos.y * ps);
        c.stroke();
        c.restore();
      } else if (f.type === 'teleport') {
        const k = 1 - (f.life / f.maxLife); // 0 -> 1
        const x = f.pos.x * ps, y = f.pos.y * ps;
        c.save();
        c.strokeStyle = f.color || '#F00';
        c.lineWidth = 2;
        c.globalAlpha = 1 - k;
        // expanding ring
        c.beginPath();
        c.arc(x, y, ps * 4 * k, 0, Math.PI * 2);
        c.stroke();
        // imploding ring (reverse)
        c.beginPath();
        c.arc(x, y, ps * 4 * (1 - k), 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
    });
  }

  drawItems(items: Item[]) {
    const c = this.ctx, ps = this.pixel;
    items.forEach(i => {
      const x = i.pos.x * ps, y = i.pos.y * ps, s = ps;
      c.save(); c.translate(x, y);
      if (i.type === 'heart') {
        c.fillStyle = '#E53935'; c.strokeStyle = '#7F1D1D'; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, s * 0.2);
        c.lineTo(-s * 0.28, -s * 0.05);
        c.lineTo(-s * 0.12, -s * 0.25);
        c.lineTo(0, -s * 0.1);
        c.lineTo(s * 0.12, -s * 0.25);
        c.lineTo(s * 0.28, -s * 0.05);
        c.closePath(); c.fill(); c.stroke();
      } else if (i.type === 'apple') {
        c.fillStyle = '#C62828'; c.strokeStyle = '#6D0000'; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, -s * 0.3); c.lineTo(s * 0.3, 0); c.lineTo(0, s * 0.3); c.lineTo(-s * 0.3, 0);
        c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#2E7D32';
        c.fillRect(s * 0.05, -s * 0.38, s * 0.18, s * 0.08);
      } else if (i.type === 'shield') {
        c.fillStyle = '#42A5F5'; c.strokeStyle = '#1976D2'; c.lineWidth = 2;
        c.beginPath();
        for (let k = 0; k < 8; k++) { const ang = (Math.PI / 4) * k; const rx = Math.cos(ang) * s * 0.35, ry = Math.sin(ang) * s * 0.35; if (k === 0) c.moveTo(rx, ry); else c.lineTo(rx, ry); }
        c.closePath(); c.fill(); c.stroke();
      } else if (i.type === 'sniper') {
        c.strokeStyle = '#FFFFFF'; c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, s * 0.32, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.moveTo(-s * 0.35, 0); c.lineTo(s * 0.35, 0); c.moveTo(0, -s * 0.35); c.lineTo(0, s * 0.35); c.stroke();
      } else if (i.type === 'skin') {
        c.fillStyle = '#BA68C8'; c.strokeStyle = '#7B1FA2'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(0, -s * 0.3); c.lineTo(s * 0.25, -s * 0.1); c.lineTo(0, s * 0.3); c.lineTo(-s * 0.25, -s * 0.1); c.closePath(); c.fill(); c.stroke();
      } else if (i.type === 'freeze') {
        c.strokeStyle = '#80DEEA'; c.lineWidth = 2;
        // snowflake asterisk
        c.beginPath();
        c.moveTo(-s * 0.3, 0); c.lineTo(s * 0.3, 0);
        c.moveTo(0, -s * 0.3); c.lineTo(0, s * 0.3);
        c.moveTo(-s * 0.22, -s * 0.22); c.lineTo(s * 0.22, s * 0.22);
        c.moveTo(-s * 0.22, s * 0.22); c.lineTo(s * 0.22, -s * 0.22);
        c.stroke();
      } else if (i.type === 'reflector') {
        c.strokeStyle = '#B3E5FC'; c.lineWidth = 3;
        c.beginPath(); c.arc(0, 0, s * 0.28, 0, Math.PI * 2); c.stroke();
        // highlight arc
        c.strokeStyle = '#E1F5FE'; c.lineWidth = 2;
        c.beginPath(); c.arc(0, 0, s * 0.28, -Math.PI * 0.15, Math.PI * 0.05); c.stroke();
      } else if (i.type === 'piercer') {
        c.fillStyle = '#FFEB3B'; c.strokeStyle = '#FBC02D'; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-s * 0.22, -s * 0.10);
        c.lineTo(-s * 0.22, s * 0.10);
        c.lineTo(s * 0.22, 0);
        c.closePath(); c.fill(); c.stroke();
      } else if (i.type === 'burst') {
        c.fillStyle = '#FFFFFF';
        for (let k = 0; k < 3; k++) {
          c.beginPath(); c.arc(-s * 0.14 + k * s * 0.14, 0, s * 0.08, 0, Math.PI * 2); c.fill();
        }
      } else if (i.type === 'siphon') {
        c.fillStyle = '#26A69A'; c.strokeStyle = '#00796B'; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, -s * 0.22);
        c.quadraticCurveTo(s * 0.18, -s * 0.05, 0, s * 0.28);
        c.quadraticCurveTo(-s * 0.18, -s * 0.05, 0, -s * 0.22);
        c.closePath(); c.fill(); c.stroke();
      }
      c.restore();
    });
  }

  drawUI(w: number, h: number, p: Player, level: number, sniper: number, mutators: string[] = [], comboMult: number = 1, comboCount: number = 0) {
    const c = this.ctx;
    c.fillStyle = '#FFF';
    c.font = `${Math.floor(this.pixel * 0.8)}px PixelFont, monospace`;
    c.textAlign = 'left';
    c.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`, 10, 20);
    c.fillText(`Ammo ${p.bullets}/${p.maxHp} ${p.reloading ? '(reloading)' : ''}`, 10, 40);
    c.fillText(`Level ${level}`, 10, 60);
    // mutator badges top-right
    c.textAlign = 'right';
    const badge = mutators.length ? `Mutators: ${mutators.join(' · ')}` : '';
    if (badge) { c.fillText(badge, w - 10, 20); }
    // combo mid-top
    c.textAlign = 'center';
    const comboStr = comboCount > 1 ? `Combo x${comboMult.toFixed(2)} (${comboCount})` : (sniper > 0 ? `Sniper: ${sniper}` : '');
    if (comboStr) { c.fillText(comboStr, w / 2, 20); }
    // overdrive indicator and bar below combo
    const overMs = Math.max(0, (p.overdriveUntil || 0) - performance.now());
    if (overMs > 0) {
      const secs = (overMs / 1000).toFixed(1);
      c.fillText(`Overdrive ${secs}s`, w / 2, 40);
      const bx = Math.floor(w / 2 - 100), by = 46, bw = 200, bh = 8;
      c.save();
      c.globalAlpha = 0.8;
      c.strokeStyle = '#FF9800'; c.lineWidth = 2;
      c.beginPath(); c.rect(bx, by, bw, bh); c.stroke();
      const k = Math.max(0, Math.min(1, overMs / 5000));
      c.fillStyle = '#FF6F00';
      c.beginPath(); c.rect(bx + 2, by + 2, (bw - 4) * k, bh - 4); c.fill();
      c.restore();
    }
  }

  drawLevelTransition(w: number, h: number, k: number, nextLevel: number) {
    const c = this.ctx;
    c.save();
    // darken overlay
    c.globalAlpha = Math.min(0.7, k * 0.7);
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    // pulse ring from center
    const cx = w / 2, cy = h / 2;
    c.globalAlpha = Math.min(1, 0.5 + 0.5 * k);
    c.strokeStyle = '#27A0FF';
    c.lineWidth = 4;
    const R = Math.min(w, h) * (0.15 + 0.6 * k);
    for (let i = 0; i < 8; i++) {
      const a0 = (Math.PI * 2) * (i / 8) + performance.now() / 800;
      const a1 = a0 + Math.PI * 0.15;
      c.beginPath();
      c.arc(cx, cy, R, a0, a1);
      c.stroke();
    }
    // text
    c.globalAlpha = 1;
    c.fillStyle = '#FFF';
    c.textAlign = 'center';
    c.font = `${Math.floor(this.pixel * 1.2)}px PixelFont, monospace`;
    c.fillText(`Level ${nextLevel}`, cx, cy);
    c.restore();
  }

  drawPauseMenu(w: number, h: number, options: string[], sel: number) {
    const c = this.ctx;
    c.save();
    // dim background
    c.globalAlpha = 0.6;
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    // panel
    const pw = Math.min(420, w * 0.7), ph = Math.min(260, h * 0.6);
    const px = (w - pw) / 2, py = (h - ph) / 2;
    c.globalAlpha = 0.9;
    c.fillStyle = '#111';
    c.strokeStyle = '#27A0FF';
    c.lineWidth = 4;
    c.beginPath(); c.rect(px, py, pw, ph); c.fill(); c.stroke();
    // title
    c.globalAlpha = 1;
    c.fillStyle = '#FFF';
    c.textAlign = 'center';
    c.font = `${Math.floor(this.pixel * 1.2)}px PixelFont, monospace`;
    c.fillText('Paused', w / 2, py + 40);
    // options
    c.font = `${Math.floor(this.pixel * 0.9)}px PixelFont, monospace`;
    options.forEach((opt, i) => {
      const y = py + 90 + i * 40;
      if (i === sel) {
        c.fillStyle = '#27A0FF';
        c.globalAlpha = 0.25;
        c.beginPath(); c.rect(px + 20, y - 26, pw - 40, 32); c.fill();
        c.globalAlpha = 1;
        c.fillStyle = '#FFF';
      } else {
        c.fillStyle = '#AAA';
      }
      c.fillText(opt, w / 2, y);
    });
    c.restore();
  }
}