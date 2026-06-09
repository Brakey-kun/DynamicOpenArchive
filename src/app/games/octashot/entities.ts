export type Vec = { x: number; y: number };

export interface Player {
  hp: number;
  maxHp: number;
  rot: number; // 0..7 octagonal direction index
  bullets: number;
  reloading: boolean;
  reloadUntil: number;
  shieldActive: boolean;
  sniperUses: number;
  skin: string;
  // combat/meta systems
  comboCount?: number;
  comboExpireAt?: number;
  comboMultiplier?: number;
  overdriveUntil?: number;
  reflectorCharges?: number;
  timeFreezeUntil?: number;
  piercerShots?: number; // next shots that can pierce once
  burstShots?: number; // next shots fire in burst fan
  siphonActive?: boolean;
  siphonProgress?: number;
  overdriveNextDrainAt?: number;
}

export interface Platform {
  id: number;
  dir: number; // direction index around center
  pos: Vec; // top-left in grid units
  size: Vec; // width/height in grid units
  active: boolean;
  enemiesLeft: number;
  crumble: boolean;
  crumbleProgress: number; // 0..1
  // animation & round state
  spawnProgress: number; // 0..1, platform spawn animation progress
  spawnStartAt?: number; // timestamp when platform became active
  rotation?: number; // rotation angle for continuous spin
  willDespawnAfter?: number; // number of enemies to spawn before despawn (2..6)
  spawnedCount?: number; // count of enemies spawned this round
  killQuota?: number; // number of enemies that MUST be killed by player
  killsAchieved?: number; // how many have been killed by player
  platformType?: 'default' | 'fast_spin' | 'safe' | 'trap';
}

export interface Enemy {
  id: number;
  pos: Vec;
  speed: number;
  alive: boolean;
  fromPlatformId: number;
  hp: number;
  spawnProgress?: number; // 0..1
  deathProgress?: number; // 0..1
  elite?: boolean;
  modifier?: 'fast' | 'split';
}

export interface Boss {
  id: number;
  pos: Vec;
  speed: number;
  hp: number;
  targetPlatformId: number | null;
  shootCooldownUntil: number;
  spawnProgress?: number; // 0..1 spawn animation
  phase?: number; // boss phase index
  teleportAt?: number;
  teleportDelay?: number;
}

export type BulletType = 'player' | 'boss';
export interface Bullet {
  id: number;
  type: BulletType;
  pos: Vec;
  vel: Vec;
  speed: number;
  lifeUntil: number;
  hitsLeft?: number; // for boss bullet destructibility (2 hits)
  ownerBossId?: number; // track owning boss to enforce one bullet at a time
  pierceLeft?: number; // player bullet pierce count
}

export type ItemType = 'heart' | 'apple' | 'shield' | 'sniper' | 'skin' | 'freeze' | 'reflector' | 'siphon' | 'piercer' | 'burst';
export interface Item {
  id: number;
  type: ItemType;
  pos: Vec;
  vel: Vec;
  spawnUntil: number;
}

export interface Impact { id: number; pos: Vec; k: number; }

export interface VisualFX {
  id: number;
  type: 'beam' | 'teleport';
  pos: Vec;
  endPos?: Vec;
  life: number;
  maxLife: number;
  color?: string;
}

export type Mutator = 'fast_enemies' | 'double_quota' | 'boss_burst';
export type Difficulty = 'easy' | 'normal' | 'hard';
export interface SaveData {
  level: number;
  stats: {
    kills: number;
    bosses: number;
    shots: number;
    score: number;
    items: { heart: number; apple: number; shield: number; sniper: number; skin: number; freeze: number; reflector: number; siphon: number; piercer: number; burst: number };
  };
  maxHp: number;
  hp: number;
  skins: string[];
  selectedSkin: string;
  sniperUses: number;
  // playthrough maxima
  maxLevel?: number; // track highest level reached
  maxKills?: number;
  maxBosses?: number;
  maxScore?: number;

  mutators?: Mutator[];
  difficulty?: Difficulty;
}

export const DIRS: Vec[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];