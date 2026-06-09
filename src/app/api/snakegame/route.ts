import { NextResponse } from 'next/server';

// Game configuration that will be sent to the client
export async function GET() {
  const gameConfig = {
    version: '1.0.0',
    initialSpeed: 150,
    maxApples: 8,
    objectTypes: {
      apple: {
        points: 1,
        color: '#FF0000',
        maxOnScreen: 8,
        spawnRate: 0.8,
        lifespan: { min: 8000, max: 15000 }
      },
      obstacle: {
        color: '#0000FF',
        maxOnScreen: 5,
        spawnRate: 0.5,
        lifespan: { min: 10000, max: 20000 }
      },
      lethalObstacle: {
        color: '#FFA500',
        maxOnScreen: 2,
        spawnRate: 0.2,
        lifespan: { min: 5000, max: 12000 }
      },
      diamondApple: {
        points: 1.3, // Multiplier
        color: '#00BFFF',
        maxOnScreen: 1,
        spawnRate: 0.1,
        lifespan: { min: 4000, max: 8000 }
      },
      shield: {
        color: '#32CD32', // Lime green for shield
        maxOnScreen: 1,
        spawnRate: 0.1, // Same rarity as diamond apple
        lifespan: { min: 4000, max: 8000 }
      }
    },
    difficultyLevels: [
      { score: 0, speed: 150, spawnMultiplier: 1 },
      { score: 10, speed: 140, spawnMultiplier: 1.2 },
      { score: 20, speed: 130, spawnMultiplier: 1.4 },
      { score: 30, speed: 120, spawnMultiplier: 1.6 },
      { score: 50, speed: 110, spawnMultiplier: 1.8 },
      { score: 75, speed: 100, spawnMultiplier: 2 },
      { score: 100, speed: 90, spawnMultiplier: 2.2 },
      { score: 150, speed: 80, spawnMultiplier: 2.5 }
    ],
    animations: {
      appear: {
        duration: 500, // ms
        easing: 'ease-out'
      },
      disappear: {
        duration: 800, // ms
        easing: 'ease-in'
      }
    }
  };

  return NextResponse.json(gameConfig);
}