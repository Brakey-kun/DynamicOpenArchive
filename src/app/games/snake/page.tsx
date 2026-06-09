'use client';

import React, { useEffect, useRef } from 'react';
import { SnakeGame } from './snake-game'; // Assuming snake-game.ts is in the same directory

const SnakePage: React.FC = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<SnakeGame | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && gameContainerRef.current) {
      // Ensure this code runs only on the client side
      if (!gameInstanceRef.current) {
        // Append a new div for the game canvas to be placed into by SnakeGame constructor
        const canvasContainer = document.createElement('div');
        canvasContainer.id = 'snake-game-canvas-container'; // Optional: for styling or specific targeting
        gameContainerRef.current.appendChild(canvasContainer);
        
        gameInstanceRef.current = new SnakeGame(canvasContainer);
      }
    }

    return () => {
      // Cleanup when the component unmounts
      if (gameInstanceRef.current) {
        // Assuming SnakeGame class has a destroy method to clean up resources
        // (e.g., remove canvas, event listeners)
        if (typeof gameInstanceRef.current.destroy === 'function') {
          gameInstanceRef.current.destroy();
        }
        gameInstanceRef.current = null;
      }
      if (gameContainerRef.current) {
        // Remove the dynamically created canvas container
        const canvasContainer = gameContainerRef.current.querySelector('#snake-game-canvas-container');
        if (canvasContainer) {
          gameContainerRef.current.removeChild(canvasContainer);
        }
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  return (
    <div ref={gameContainerRef} style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* The SnakeGame will create and append its canvas inside this div */}
    </div>
  );
};

export default SnakePage;