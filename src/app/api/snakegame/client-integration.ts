import { KonamiCode, SnakeGame } from './snake-game';

let snakeGame: SnakeGame | null = null;
let konamiDetector: KonamiCode | null = null;

export function initSnakeGameEasterEgg() {
  // Only initialize once
  if (konamiDetector) return;
  
  // Create Konami code detector
  konamiDetector = new KonamiCode(() => {
    // If game is already active, do nothing
    if (snakeGame) return;
    
    // Create and start the game
    snakeGame = new SnakeGame(document.body);
    
    // Add event listener to close game with Escape key
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && snakeGame) {
        snakeGame.destroy();
        snakeGame = null;
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    
    document.addEventListener('keydown', escapeHandler);
  });
}

// Clean up function
export function cleanupSnakeGameEasterEgg() {
  if (konamiDetector) {
    konamiDetector.destroy();
    konamiDetector = null;
  }
  
  if (snakeGame) {
    snakeGame.destroy();
    snakeGame = null;
  }
}