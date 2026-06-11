// Snake Game Implementation
export class SnakeGame {
  // ... existing code ...
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pixelSize: number = 20;
  private width: number;
  private height: number;
  private snake: Array<{x: number, y: number}> = [];
  private direction: string = 'right';
  private nextDirection: string = 'right';
  private score: number = 0;
  private gameSpeed: number = 300; // Slower default speed
  private gameLoop: number | null = null;
  private gameOver: boolean = false;
  private gameConfig: any = null;
  private objects: Array<GameObject> = [];
  private objectIdCounter: number = 0;
  private pixelFont: FontFace | null = null;
  private fontLoaded: boolean = false;
  private lastFrameTime: number = 0;
  private hp: number = 200; // Half the original HP
  private maxHp: number = 200; // Half the original max HP
  private hpDrainRate: number = 0.5; // HP lost per second
  private blockedDirections: Set<string> = new Set();
  
  // New properties for speed boost
  private speedBoostActive: boolean = false;
  private speedBoostEndTime: number = 0;
  private normalSpeed: number = 300; // Slower normal speed
  private targetFPS: number = 15; // Reduced from 40 to 15 FPS for a more retro feel
  private normalFPS: number = 15; // Store normal FPS for returning after boost

  // New properties for shield
  private shieldActive: boolean = false;
  private shieldEndTime: number = 0;
  private shieldDuration: number = 10000; // 10 seconds in milliseconds
  
  // New properties for pause menu
  private isPaused: boolean = false;
  private pauseMenuOptions: string[] = ['Resume Game', 'Restart Game', 'Exit Game'];
  private selectedOption: number = 0;

  

  constructor(container: HTMLElement) {
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.floor((window.innerWidth * 0.8) / this.pixelSize) * this.pixelSize;
    this.canvas.height = Math.floor((window.innerHeight * 0.8) / this.pixelSize) * this.pixelSize;
    this.width = this.canvas.width / this.pixelSize;
    this.height = this.canvas.height / this.pixelSize;
    
    // Style the canvas
    this.canvas.style.border = '4px solid #333';
    this.canvas.style.backgroundColor = '#000';
    this.canvas.style.display = 'block';
    this.canvas.style.margin = '0 auto';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '50%';
    this.canvas.style.left = '50%';
    this.canvas.style.transform = 'translate(-50%, -50%)';
    this.canvas.style.zIndex = '1000';
    
    // Get context
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');
    this.ctx = context;
    
    // Add to container
    container.appendChild(this.canvas);
    
    // Initialize game
    this.initGame();
  }

  private async initGame() {
    // Load pixel font
    this.pixelFont = new FontFace('PixelFont', 'url(https://fonts.gstatic.com/s/pressstart2p/v14/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff2)');
    try {
      await this.pixelFont.load();
      document.fonts.add(this.pixelFont);
      this.fontLoaded = true;
    } catch (e) {
      console.error('Failed to load pixel font:', e);
    }
    
    // Fetch game configuration
    try {
      const response = await fetch('/api/snakegame');
      this.gameConfig = await response.json();
      this.gameSpeed = 400; // Much slower base speed
      this.normalSpeed = this.gameSpeed;
    } catch (e) {
      console.error('Failed to load game config:', e);
      // Use default config if fetch fails
      this.gameConfig = {
        initialSpeed: 400, // Much slower base speed
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
            points: 1.3,
            color: '#00BFFF',
            maxOnScreen: 1,
            spawnRate: 0.1,
            lifespan: { min: 4000, max: 8000 }
          }
        },
        difficultyLevels: [
          { score: 0, speed: 150, spawnMultiplier: 1 },
          { score: 50, speed: 100, spawnMultiplier: 2 },
          { score: 100, speed: 80, spawnMultiplier: 2.5 }
        ]
      };
    }
    
    // Initialize snake
    this.snake = [
      {x: Math.floor(this.width / 2), y: Math.floor(this.height / 2)},
      {x: Math.floor(this.width / 2) - 1, y: Math.floor(this.height / 2)},
      {x: Math.floor(this.width / 2) - 2, y: Math.floor(this.height / 2)}
    ];
    
    // Set up keyboard controls
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Start game loop using requestAnimationFrame for smoother gameplay
    this.lastFrameTime = performance.now();
    this.startGameLoop();
    
    // Start spawning objects
    this.scheduleObjectSpawning();
  }

  // ... existing code ...
  // ... existing code ...
  private handleKeyDown(e: KeyboardEvent) {
    // Handle pause menu navigation
    if (this.isPaused) {
      switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'z':
        case 'Z':
          this.selectedOption = (this.selectedOption - 1 + this.pauseMenuOptions.length) % this.pauseMenuOptions.length;
          this.draw(); // Redraw to show selection change
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.selectedOption = (this.selectedOption + 1) % this.pauseMenuOptions.length;
          this.draw(); // Redraw to show selection change
          break;
        case 'Enter':
        case ' ':
          this.handlePauseMenuSelection();
          break;
        case 'p':
        case 'P':
          this.togglePause(); // Resume game
          break;
      }
      
      e.preventDefault();
      return;
    }
    
    // Toggle pause with P key instead of Escape
    if ((e.key === 'p' || e.key === 'P') && !this.gameOver) {
      this.togglePause();
      e.preventDefault();
      return;
    }
    
    
    // Don't process other inputs if game is paused or over
    if (this.isPaused || this.gameOver) {
      if (e.key === ' ' && this.gameOver) {
        this.restart();
      }
      e.preventDefault();
      return;
    }
    
    // Don't allow direction change if that direction is blocked
    if (this.blockedDirections.has('up') && (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'z' || e.key === 'Z')) return;
    if (this.blockedDirections.has('down') && (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S')) return;
    if (this.blockedDirections.has('left') && (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'q' || e.key === 'Q')) return;
    if (this.blockedDirections.has('right') && (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')) return;
    
    switch(e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
      case 'z':
      case 'Z':
        if (this.direction !== 'down') this.nextDirection = 'up';
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        if (this.direction !== 'up') this.nextDirection = 'down';
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
      case 'q':
      case 'Q':
        if (this.direction !== 'right') this.nextDirection = 'left';
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (this.direction !== 'left') this.nextDirection = 'right';
        break;
      case ' ':
        if (this.gameOver) {
          this.restart();
        }
        break;
      case 'Shift':
        if (!this.gameOver) {
          this.activateSpeedBoost();
        }
        break;
      case 'Control':
        if (!this.gameOver) {
          this.activateShield();
        }
        break;
    }
    
    // Prevent default behavior for game control keys to avoid page scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift', 'Control', 'Escape',
         'w', 'W', 'a', 'A', 's', 'S', 'd', 'D', 
         'z', 'Z', 'q', 'Q', 'Enter'].includes(e.key)) {
      e.preventDefault();
    }
  }
// ... existing code ...
private togglePause() {
  this.isPaused = !this.isPaused;
  this.selectedOption = 0; // Reset selected option
  
  if (this.isPaused) {
    // Cancel the game loop when paused
    if (this.gameLoop !== null) {
      cancelAnimationFrame(this.gameLoop);
      this.gameLoop = null;
    }
    // Draw the pause menu
    this.draw();
  } else {
    // Resume the game loop
    this.lastFrameTime = performance.now();
    this.startGameLoop();
  }
}

private handlePauseMenuSelection() {
  switch (this.selectedOption) {
    case 0: // Resume Game
      this.togglePause();
      break;
    case 1: // Restart Game
      this.restart();
      this.isPaused = false;
      break;
    case 2: // Exit Game
      // Close the game and return to the main page
      this.destroy();
      window.location.href = '/DynamicOpenArchive/'; // Navigate to home page
      break;
  }
}

  // ... existing code ...
  private activateSpeedBoost() {
    // Check if boost is already active
    if (this.speedBoostActive) return;
    
    // If snake is too short (2 or fewer segments), end the game
    if (this.snake.length <= 2) {
      this.endGame();
      return;
    }
    
    // Remove 2 blocks from the snake's tail if snake is long enough
    if (this.snake.length > 3) {
      this.snake.pop();
      this.snake.pop();
    }
    
    // Store normal speed if not already stored
    this.normalSpeed = this.gameSpeed;
    this.normalFPS = this.targetFPS;
    
    // Set speed to double and FPS to 30
    this.gameSpeed = this.normalSpeed / 2;
    this.targetFPS = 30;
    
    // Set end time for boost (3 seconds from now)
    this.speedBoostActive = true;
    this.speedBoostEndTime = Date.now() + 3000;
  }
// ... existing code ...

  private activateShield() {
    // Reset shield timer if already active, otherwise activate it
    this.shieldActive = true;
    this.shieldEndTime = Date.now() + this.shieldDuration;
  }

  private startGameLoop() {
    // Use requestAnimationFrame for smoother gameplay with fixed timestep
    const frameInterval = 1000 / this.targetFPS; // 25ms for 40 FPS
    
    const gameLoop = (timestamp: number) => {
      if (this.gameOver) return;
      
      const deltaTime = timestamp - this.lastFrameTime;
      
      // Check if speed boost should end
      if (this.speedBoostActive && Date.now() >= this.speedBoostEndTime) {
        this.speedBoostActive = false;
    this.shieldActive = false;
        this.gameSpeed = this.normalSpeed;
        this.targetFPS = this.normalFPS;
      }
      
      // Check if shield should end
      if (this.shieldActive && Date.now() >= this.shieldEndTime) {
        this.shieldActive = false;
      }
      
      // Calculate current frame interval based on current targetFPS
      const currentFrameInterval = 1000 / this.targetFPS;
      
      // Only update at the specified frame interval
      if (deltaTime >= currentFrameInterval) {
        // Calculate how many frames we might need to catch up
        const framesToUpdate = Math.min(3, Math.floor(deltaTime / currentFrameInterval));
        
        // Update the game state for each frame we need to catch up
        for (let i = 0; i < framesToUpdate; i++) {
          // Convert to seconds for HP drain (use fixed time step)
          this.update(currentFrameInterval / 1000);
        }
        
        // Draw the game state
        this.draw();
        
        // Update last frame time, accounting for the frames we just simulated
        this.lastFrameTime = timestamp - (deltaTime % currentFrameInterval);
      }
      
      this.gameLoop = requestAnimationFrame(gameLoop);
    };
    
    this.gameLoop = requestAnimationFrame(gameLoop);
  }

  private update(deltaTime: number) {
    if (this.gameOver) return;
    
    // Check if shield should end
    if (this.shieldActive && Date.now() >= this.shieldEndTime) {
      this.shieldActive = false;
    }
    
    // Update HP - drain rate increases with score, but pause if shield is active
    if (!this.shieldActive) {
      const drainMultiplier = this.getDifficultyMultiplier();
      const scoreFactor = 1 + (this.score / 50); // HP drains faster as score increases
      this.hp -= this.hpDrainRate * deltaTime * drainMultiplier * scoreFactor;
    }
    
    // Check if HP is depleted
    if (this.hp <= 0) {
      this.hp = 0;
      this.endGame();
      return;
    }
    
    // Reset blocked directions when changing direction
    if (this.direction !== this.nextDirection) {
      this.blockedDirections.clear();
    }
    
    // Update direction
    this.direction = this.nextDirection;
    
    // Calculate new head position
    const head = {x: this.snake[0].x, y: this.snake[0].y};
    
    switch(this.direction) {
      case 'up': head.y--; break;
      case 'down': head.y++; break;
      case 'left': head.x--; break;
      case 'right': head.x++; break;
    }
    
    // Check for wall collision - block movement instead of ending game
    if (head.x < 0 || head.x >= this.width || head.y < 0 || head.y >= this.height) {
      // Block the current direction
      this.blockedDirections.add(this.direction);
      
      // Don't move in this direction
      return;
    }
    
    // Check for self collision
    for (let i = 0; i < this.snake.length; i++) {
      if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
        if (this.shieldActive) {
          // If shield is active, ignore self collision
        } else {
          this.endGame();
          return;
        }
      }
    }
    
    // Check for obstacle collisions before moving
    let blockedByObstacle = false;
    for (const obj of this.objects) {
      if (obj.type === 'obstacle') {
        // Check if the new head position would collide with a non-lethal obstacle
        if (this.checkObstacleCollision(head, obj)) {
          blockedByObstacle = true;
          // Block the current direction
          this.blockedDirections.add(this.direction);
          
          // Damage player on first contact with this obstacle (25% of max HP) if shield is not active
          if (!obj.hasCollidedWithSnake && !this.shieldActive) {
            this.hp -= this.maxHp * 0.25;
            obj.hasCollidedWithSnake = true;
          }
          
          return; // Don't move in this direction
        }
      }
    }
    
    if (blockedByObstacle) return;
    
    // Add new head
    this.snake.unshift(head);
    
    // Check for object collisions
    let ateApple = false;
    let hpGain = 0;
    
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      
      // Check if snake head collides with object
      if (this.checkCollision(head, obj)) {
        // Handle collision based on object type
        if (obj.type === 'apple') {
          this.score += this.gameConfig.objectTypes.apple.points;
          hpGain += this.maxHp * 0.05; // 5% of max HP instead of 100
          ateApple = true;
          this.objects.splice(i, 1);
        } else if (obj.type === 'diamondApple') {
          this.score = Math.floor(this.score * this.gameConfig.objectTypes.diamondApple.points);
          hpGain += this.maxHp * 0.20; // 5% of max HP instead of 250
          ateApple = true;
          this.objects.splice(i, 1);
        } else if (obj.type === 'shield') {
          this.activateShield();
          ateApple = true;
          this.objects.splice(i, 1);
        } else if (obj.type === 'lethalObstacle' && !this.shieldActive) {
          this.endGame();
          return;
        }
      }
    }
    
    // Update HP if apple was eaten
    if (hpGain > 0) {
      this.hp = Math.min(this.maxHp, this.hp + hpGain);
    }
    
    // Remove tail if no apple was eaten
    if (!ateApple) {
      this.snake.pop();
    }
    
    // Update difficulty based on score
    this.updateDifficulty();
    
    // Update all objects
    this.updateObjects();
  }

  // ... existing code ...
  private checkCollision(head: {x: number, y: number}, obj: GameObject): boolean {
    // For rectangular obstacles, check if the head is within the obstacle's bounds
    if (obj.width && obj.height) {
      return (
        head.x >= obj.x && 
        head.x < obj.x + obj.width && 
        head.y >= obj.y && 
        head.y < obj.y + obj.height
      );
    }
    
    // For apples with larger hitbox (1.5x + a bit more)
    if (obj.type === 'apple' || obj.type === 'diamondApple' || obj.type === 'shield') {
      // Calculate the center of the apple
      const appleCenterX = obj.x + 0.5;
      const appleCenterY = obj.y + 0.5;
      
      // Check if head is within 1.2 units (increased from 0.95) of the apple center
      // This makes it much harder to miss the apple when passing by
      const dx = Math.abs(head.x - appleCenterX);
      const dy = Math.abs(head.y - appleCenterY);
      
      return dx <= 1.2 && dy <= 1.2;
    }
    
    // For other single-cell objects
    return head.x === obj.x && head.y === obj.y;
  }
// ... existing code ...
  
  private checkObstacleCollision(head: {x: number, y: number}, obj: GameObject): boolean {
    // For rectangular obstacles, check if the head is within the obstacle's bounds
    if (obj.width && obj.height) {
      return (
        head.x >= obj.x && 
        head.x < obj.x + obj.width && 
        head.y >= obj.y && 
        head.y < obj.y + obj.height
      );
    }
    
    // For single-cell obstacles
    return head.x === obj.x && head.y === obj.y;
  }

  private updateDifficulty() {
    if (!this.gameConfig || !this.gameConfig.difficultyLevels) return;
    
    // Find the appropriate difficulty level based on score
    let newSpeed = this.gameConfig.initialSpeed;
    
    for (let i = this.gameConfig.difficultyLevels.length - 1; i >= 0; i--) {
      const level = this.gameConfig.difficultyLevels[i];
      if (this.score >= level.score) {
        // Adjust the speed values to be more appropriate for 40fps
        newSpeed = level.speed * 5/3; // Adjust the speed scaling
        break;
      }
    }
    
    // Update game speed if it changed and not in speed boost
    if (newSpeed !== this.gameSpeed && !this.speedBoostActive) {
      this.gameSpeed = newSpeed;
      this.normalSpeed = newSpeed;
    }
  }

  private scheduleObjectSpawning() {
    // Schedule spawning of different object types
    this.scheduleObjectType('apple', 2000);
    this.scheduleObjectType('obstacle', 3000);
    this.scheduleObjectType('lethalObstacle', 5000);
    this.scheduleObjectType('diamondApple', 8000);
    this.scheduleObjectType('shield', 8000); // Same spawn interval as diamond apple
  }

  private scheduleObjectType(type: string, baseInterval: number) {
    const spawnObject = () => {
      if (this.gameOver) return;
      
      const config = this.gameConfig.objectTypes[type];
      const currentCount = this.objects.filter(o => o.type === type).length;
      
      // Check if we can spawn more of this type
      if (currentCount < config.maxOnScreen) {
        // Use spawn rate to determine if we should spawn
        if (Math.random() < config.spawnRate) {
          this.spawnObject(type);
        }
      }
      
      // Schedule next spawn attempt
      const interval = baseInterval / (this.getDifficultyMultiplier() || 1);
      setTimeout(spawnObject, interval);
    };
    
    // Start the spawning cycle
    setTimeout(spawnObject, baseInterval);
  }

  private getDifficultyMultiplier(): number {
    if (!this.gameConfig || !this.gameConfig.difficultyLevels) return 1;
    
    for (let i = this.gameConfig.difficultyLevels.length - 1; i >= 0; i--) {
      const level = this.gameConfig.difficultyLevels[i];
      if (this.score >= level.score) {
        return level.spawnMultiplier;
      }
    }
    
    return 1;
  }

  private spawnObject(type: string) {
    const config = this.gameConfig.objectTypes[type];
    
    // Generate random width and height for obstacles (3x larger than before)
    let width = 1;
    let height = 1;
    
    if (type === 'obstacle' || type === 'lethalObstacle') {
      // Random rectangular shapes for obstacles
      width = Math.floor(Math.random() * 3) + 1;  // Width between 1-3
      height = Math.floor(Math.random() * 3) + 1; // Height between 1-3
      
      // Make obstacles 3 times larger
      width *= 3;
      height *= 3;
    }
    
    // Find a free position (not occupied by snake or other objects)
    let x, y;
    let attempts = 0;
    const maxAttempts = 50;
    
    do {
      x = Math.floor(Math.random() * (this.width - width + 1));
      y = Math.floor(Math.random() * (this.height - height + 1));
      attempts++;
      
      // Check if position is free
      if (this.isPositionFree(x, y, width, height)) break;
      
    } while (attempts < maxAttempts);
    
    // If we couldn't find a free position after max attempts, give up
    if (attempts >= maxAttempts) return;
    
    // Create the object
    const lifespan = Math.floor(Math.random() * (config.lifespan.max - config.lifespan.min + 1)) + config.lifespan.min;
    
    const newObject: GameObject = {
      id: this.objectIdCounter++,
      type,
      x,
      y,
      width: width,
      height: height,
      color: config.color,
      createdAt: Date.now(),
      lifespan,
      scale: 0,
      opacity: 0,
      shape: type === 'obstacle' || type === 'lethalObstacle' ? 'rectangle' : 'circle'
    };
    
    this.objects.push(newObject);
    
    // Schedule object removal
    setTimeout(() => {
      this.startObjectDisappearing(newObject.id);
    }, lifespan - this.gameConfig.animations.disappear.duration);
  }

  private isPositionFree(x: number, y: number, width: number = 1, height: number = 1): boolean {
    // Check if any part of the rectangle overlaps with the snake
    for (let dx = 0; dx < width; dx++) {
      for (let dy = 0; dy < height; dy++) {
        const checkX = x + dx;
        const checkY = y + dy;
        
        // Check if position is out of bounds
        if (checkX < 0 || checkX >= this.width || checkY < 0 || checkY >= this.height) {
          return false;
        }
        
        // Check if position is occupied by snake
        for (const segment of this.snake) {
          if (segment.x === checkX && segment.y === checkY) {
            return false;
          }
        }
        
        // Check if position is occupied by another object
        for (const obj of this.objects) {
          if (obj.width && obj.height) {
            // For rectangular objects
            for (let ox = 0; ox < obj.width; ox++) {
              for (let oy = 0; oy < obj.height; oy++) {
                if (checkX === obj.x + ox && checkY === obj.y + oy) {
                  return false;
                }
              }
            }
          } else {
            // For single-cell objects
            if (checkX === obj.x && checkY === obj.y) {
              return false;
            }
          }
        }
      }
    }
    
    return true;
  }

  private startObjectDisappearing(id: number) {
    const index = this.objects.findIndex(obj => obj.id === id);
    if (index !== -1) {
      this.objects[index].disappearing = true;
      
      // Remove object after animation completes
      setTimeout(() => {
        this.objects = this.objects.filter(obj => obj.id !== id);
      }, this.gameConfig.animations.disappear.duration);
    }
  }

  private updateObjects() {
    const now = Date.now();
    
    // Update animation states for all objects
    this.objects.forEach(obj => {
      const age = now - obj.createdAt;
      
      if (obj.disappearing) {
        // Disappearing animation
        const progress = Math.min(1, (now - (obj.createdAt + obj.lifespan - this.gameConfig.animations.disappear.duration)) / this.gameConfig.animations.disappear.duration);
        obj.scale = 1 - progress;
        obj.opacity = 1 - progress;
      } else {
        // Appearing animation
        const appearDuration = this.gameConfig.animations.appear.duration;
        const progress = Math.min(1, age / appearDuration);
        obj.scale = progress;
        obj.opacity = progress;
      }
    });
  }

  private draw() {
    // Clear canvas
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw objects
    this.objects.forEach(obj => {
      this.drawObject(obj);
    });
    
    // Draw snake
    this.snake.forEach((segment, index) => {
      // Draw snake segments with a slight gradient effect
      const brightness = Math.max(50, 100 - (index * 2));
      
      // Draw shield effect around snake head if active
      if (index === 0 && this.shieldActive) {
        // Draw pixelated RPG-style shield around the head
        this.ctx.fillStyle = '#4169E1'; // Royal blue base color
        
        // Shield border - outer square (slightly bigger)
        this.ctx.fillRect(
          segment.x * this.pixelSize - 6, 
          segment.y * this.pixelSize - 6, 
          this.pixelSize + 12, 
          this.pixelSize + 12
        );
        
        // Shield inner part - lighter blue (slightly bigger)
        this.ctx.fillStyle = '#87CEFA'; // Light sky blue
        this.ctx.fillRect(
          segment.x * this.pixelSize - 4, 
          segment.y * this.pixelSize - 4, 
          this.pixelSize + 8, 
          this.pixelSize + 8
        );
        
        // Shield emblem - pixelated cross (slightly bigger)
        this.ctx.fillStyle = '#FFD700'; // Gold
        // Vertical part of cross
        this.ctx.fillRect(
          segment.x * this.pixelSize + (this.pixelSize/2) - 3,
          segment.y * this.pixelSize - 2,
          6,
          this.pixelSize + 4
        );
        // Horizontal part of cross
        this.ctx.fillRect(
          segment.x * this.pixelSize - 2,
          segment.y * this.pixelSize + (this.pixelSize/2) - 3,
          this.pixelSize + 4,
          6
        );
      } else if (this.shieldActive) {
        // Pixelated shield effect around other snake segments
        const pulseRate = (Date.now() % 1000) / 1000; // 0 to 1 over 1 second
        const pulseIntensity = 0.7 + 0.3 * Math.sin(pulseRate * Math.PI * 2);
        
        this.ctx.fillStyle = `rgba(50, 205, 50, ${pulseIntensity})`;
        
        // Draw rectangular shield aura around snake segment
        this.ctx.fillRect(
          segment.x * this.pixelSize - this.pixelSize * 0.2,
          segment.y * this.pixelSize - this.pixelSize * 0.2,
          this.pixelSize * 1.4,
          this.pixelSize * 1.4
        );
      }
      
      // Draw the actual snake segment
      this.ctx.fillStyle = this.shieldActive ? 
        `rgba(50, 205, 50, 0.9)` : 
        `rgb(0, ${brightness}, 0)`;
      
      this.ctx.fillRect(
        segment.x * this.pixelSize,
        segment.y * this.pixelSize,
        this.pixelSize,
        this.pixelSize
      );
    });
    
    // Draw UI
    this.drawUI();
    
    // Draw pause menu if game is paused
    if (this.isPaused) {
      this.drawPauseMenu();
    }
  }
// ... existing code ...
  
  private drawPauseMenu() {
    // Draw semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw menu title
    this.ctx.font = this.fontLoaded ? '32px PixelFont' : '32px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 3);
    
    // Draw menu options
    this.ctx.font = this.fontLoaded ? '24px PixelFont' : '24px monospace';
    
    const menuStartY = this.canvas.height / 2;
    const menuSpacing = 40;
    
    this.pauseMenuOptions.forEach((option, index) => {
      // Highlight selected option
      if (index === this.selectedOption) {
        this.ctx.fillStyle = '#FFFF00'; // Yellow for selected option
        
        // Draw selection indicator
        this.ctx.fillText('>', this.canvas.width / 2 - 100, menuStartY + index * menuSpacing);
      } else {
        this.ctx.fillStyle = '#FFFFFF';
      }
      
      this.ctx.fillText(option, this.canvas.width / 2, menuStartY + index * menuSpacing);
    });
    
    // Draw controls hint
    this.ctx.font = this.fontLoaded ? '16px PixelFont' : '16px monospace';
    this.ctx.fillStyle = '#AAAAAA';
    this.ctx.fillText('Use Arrow Keys/WASD to navigate, Enter/Space to select', 
                     this.canvas.width / 2, this.canvas.height - 50);
  }
// ... existing code ...

  private drawSpeedBoostIndicator() {
    // Calculate remaining boost time
    const remainingTime = Math.max(0, (this.speedBoostEndTime - Date.now()) / 1000);
    
    // Draw boost indicator
    this.ctx.fillStyle = '#FFFFFF';
    if (this.fontLoaded) {
      this.ctx.font = '14px PixelFont';
    } else {
      this.ctx.font = '14px monospace';
    }
    
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`BOOST: ${remainingTime.toFixed(1)}s`, this.canvas.width - 10, 20);
  }
  
  private drawShieldIndicator() {
    // Calculate remaining shield time
    const remainingTime = Math.max(0, (this.shieldEndTime - Date.now()) / 1000);
    
    // Draw shield indicator
    this.ctx.fillStyle = '#00FFFF'; // Cyan color for shield
    if (this.fontLoaded) {
      this.ctx.font = '14px PixelFont';
    } else {
      this.ctx.font = '14px monospace';
    }
    
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`SHIELD: ${remainingTime.toFixed(1)}s`, this.canvas.width - 10, 40);
    
    // Draw shield effect around snake head
    const head = this.snake[0];
    const x = head.x * this.pixelSize;
    const y = head.y * this.pixelSize;
    
    // Pulsing shield effect
    const pulseIntensity = Math.sin(Date.now() / 200) * 0.3 + 0.7;
    
    this.ctx.strokeStyle = `rgba(0, 255, 255, ${pulseIntensity})`;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(
      x + this.pixelSize / 2,
      y + this.pixelSize / 2,
      this.pixelSize * 1.5,
      0,
      Math.PI * 2
    );
    this.ctx.stroke();
  }

  private drawObject(obj: GameObject) {
    // Skip if object has no opacity (fully transparent)
    if (obj.opacity <= 0) return;
    
    // Set color with opacity
    this.ctx.fillStyle = obj.color.replace(')', `, ${obj.opacity})`).replace('rgb', 'rgba');
    
    // Calculate position and size
    const x = obj.x * this.pixelSize;
    const y = obj.y * this.pixelSize;
    
    // Apply scale animation
    const scale = obj.scale || 1;

    
    
    if (obj.type === 'apple' || obj.type === 'diamondApple') {
      // Make apples 1.5 times larger with square appearance
      const appleSize = this.pixelSize * 1.4 * scale;
      const centerX = x + (this.pixelSize / 2);
      const centerY = y + (this.pixelSize / 2);
      
      // Draw pixelated square apple
      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      
      // Apple body (square)
      this.ctx.fillStyle = obj.type === 'apple' ? '#FF0000' : '#00BFFF';
      this.ctx.fillRect(-appleSize/2, -appleSize/2, appleSize, appleSize);
      
      // Apple stem (small rectangle)
      this.ctx.fillStyle = '#654321'; // Brown color for stem
      this.ctx.fillRect(-appleSize/10, -appleSize/2, appleSize/5, -appleSize/5);
      
      // Apple leaf (small square)
      this.ctx.fillStyle = '#00AA00'; // Green color for leaf
      this.ctx.fillRect(appleSize/10, -appleSize/2 - appleSize/5, appleSize/5, appleSize/5);
      
      // Pixelization effect - add some square pixels on the apple
      if (obj.type === 'diamondApple') {
        // Add sparkle effect for diamond apples
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(-appleSize/4, -appleSize/4, appleSize/6, appleSize/6);
        this.ctx.fillRect(appleSize/4, appleSize/4, appleSize/6, appleSize/6);
        this.ctx.fillRect(-appleSize/4, appleSize/4, appleSize/6, appleSize/6);
        this.ctx.fillRect(appleSize/4, -appleSize/4, appleSize/6, appleSize/6);
      } else {
        // Regular apple pixelization - highlight
        this.ctx.fillStyle = '#FF5555'; // Brighter red for highlights
        this.ctx.fillRect(-appleSize/4, -appleSize/4, appleSize/6, appleSize/6);
      }
      
      this.ctx.restore();
    } else if (obj.type === 'shield') {
      // Draw shield as a pixelated shield icon
      const centerX = x + this.pixelSize / 2;
      const centerY = y + this.pixelSize / 2;
      const radius = this.pixelSize * 0.6 * scale;
      
      // Draw shield base
      this.ctx.fillStyle = '#4169E1'; // Royal Blue
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY - radius);
      this.ctx.lineTo(centerX + radius * 0.8, centerY - radius * 0.3);
      this.ctx.lineTo(centerX + radius * 0.8, centerY + radius * 0.6);
      this.ctx.lineTo(centerX, centerY + radius);
      this.ctx.lineTo(centerX - radius * 0.8, centerY + radius * 0.6);
      this.ctx.lineTo(centerX - radius * 0.8, centerY - radius * 0.3);
      this.ctx.closePath();
      this.ctx.fill();

      // Draw shield border
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Draw dragon emblem
      this.ctx.fillStyle = '#000';
      this.ctx.beginPath();
      // Dragon head
      this.ctx.moveTo(centerX, centerY - radius * 0.2);
      this.ctx.lineTo(centerX + radius * 0.2, centerY - radius * 0.1);
      this.ctx.lineTo(centerX + radius * 0.1, centerY);
      // Dragon body
      this.ctx.quadraticCurveTo(
        centerX, centerY + radius * 0.2,
        centerX - radius * 0.2, centerY
      );
      // Dragon tail
      this.ctx.lineTo(centerX - radius * 0.1, centerY - radius * 0.1);
      this.ctx.closePath();
      this.ctx.fill();

      // Add pulsating glow effect
      const pulseRate = (Date.now() % 1000) / 1000;
      const pulseSize = 0.15 * Math.sin(pulseRate * Math.PI * 2);
      const glowOpacity = 0.3 + 0.2 * Math.sin(pulseRate * Math.PI * 2);
      
      this.ctx.strokeStyle = `rgba(65, 105, 225, ${glowOpacity})`; // Royal Blue glow
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY - radius * (1 + pulseSize));
      this.ctx.lineTo(centerX + radius * 0.8 * (1 + pulseSize), centerY - radius * 0.3 * (1 + pulseSize));
      this.ctx.lineTo(centerX + radius * 0.8 * (1 + pulseSize), centerY + radius * 0.6 * (1 + pulseSize));
      this.ctx.lineTo(centerX, centerY + radius * (1 + pulseSize));
      this.ctx.lineTo(centerX - radius * 0.8 * (1 + pulseSize), centerY + radius * 0.6 * (1 + pulseSize));
      this.ctx.lineTo(centerX - radius * 0.8 * (1 + pulseSize), centerY - radius * 0.3 * (1 + pulseSize));
      this.ctx.closePath();
      this.ctx.stroke();
    } else if (obj.shape === 'rectangle') {
      // For rectangular objects (obstacles)
      const width = (obj.width || 1) * this.pixelSize * scale;
      const height = (obj.height || 1) * this.pixelSize * scale;
      
      // Draw from center for proper scaling
      const centerX = x + ((obj.width || 1) * this.pixelSize) / 2;
      const centerY = y + ((obj.height || 1) * this.pixelSize) / 2;
      
      // Draw the main obstacle body
      this.ctx.fillRect(
        centerX - (width / 2),
        centerY - (height / 2),
        width,
        height
      );
      
      // Add texture to obstacles
      if (obj.type === 'obstacle' || obj.type === 'lethalObstacle') {
        this.ctx.save();
        
        // Determine texture style based on obstacle type
        if (obj.type === 'obstacle') {
          // Building-like texture for blue obstacles
          this.drawBuildingTexture(
            centerX - (width / 2),
            centerY - (height / 2),
            width,
            height,
            obj.color,
            obj.opacity
          );
        } else {
          // Rock-like texture for lethal obstacles
          this.drawRockTexture(
            centerX - (width / 2),
            centerY - (height / 2),
            width,
            height,
            obj.color,
            obj.opacity
          );
        }
        
        this.ctx.restore();
      }
    } else {
      // For other circular objects
      const radius = (this.pixelSize / 2) * scale;
      const centerX = x + (this.pixelSize / 2);
      const centerY = y + (this.pixelSize / 2);
      
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  // New method to draw building-like texture
  private drawBuildingTexture(x: number, y: number, width: number, height: number, baseColor: string, opacity: number) {
    // Create a slightly darker color for the texture details
    const darkerColor = baseColor.replace('rgb', 'rgba').replace(')', `, ${opacity * 0.7})`);
    this.ctx.fillStyle = darkerColor;
    
    // Draw windows pattern
    const windowSize = this.pixelSize / 3;
    const windowSpacing = this.pixelSize / 2;
    
    // Calculate how many windows can fit
    const windowsX = Math.floor(width / windowSpacing) - 1;
    const windowsY = Math.floor(height / windowSpacing) - 1;
    
    // Draw windows
    for (let wx = 0; wx < windowsX; wx++) {
      for (let wy = 0; wy < windowsY; wy++) {
        // Skip some windows randomly for variety
        if (Math.random() > 0.7) continue;
        
        const windowX = x + windowSpacing + (wx * windowSpacing);
        const windowY = y + windowSpacing + (wy * windowSpacing);
        
        // Draw window
        this.ctx.fillRect(windowX, windowY, windowSize, windowSize);
      }
    }
    
    // Draw a darker outline at the top
    this.ctx.fillStyle = 'rgba(0, 0, 0, ' + (opacity * 0.3) + ')';
    this.ctx.fillRect(x, y, width, this.pixelSize / 4);
  }
  
  // New method to draw rock-like texture
  private drawRockTexture(x: number, y: number, width: number, height: number, baseColor: string, opacity: number) {
    // Create a slightly darker color for the texture details
    const darkerColor = 'rgba(0, 0, 0, ' + (opacity * 0.3) + ')';
    this.ctx.fillStyle = darkerColor;
    
    // Draw random cracks and texture
    const crackCount = Math.floor((width + height) / (this.pixelSize * 2));
    
    for (let i = 0; i < crackCount; i++) {
      // Random starting point
      const startX = x + Math.random() * width;
      const startY = y + Math.random() * height;
      
      // Random length and direction
      const length = this.pixelSize * (0.5 + Math.random() * 1.5);
      const angle = Math.random() * Math.PI * 2;
      
      // Calculate end point
      const endX = startX + Math.cos(angle) * length;
      const endY = startY + Math.sin(angle) * length;
      
      // Draw the crack
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(endX, endY);
      this.ctx.lineWidth = this.pixelSize / 8;
      this.ctx.stroke();
      
      // Add some dots for texture
      const dotsCount = Math.floor(Math.random() * 5) + 3;
      for (let j = 0; j < dotsCount; j++) {
        const dotX = x + Math.random() * width;
        const dotY = y + Math.random() * height;
        const dotSize = this.pixelSize / (4 + Math.random() * 4);
        
        this.ctx.beginPath();
        this.ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
  
  // New method to draw building-like texture
  

  private drawHpBar() {
    // This method is now deprecated, using drawUI instead
    this.drawUI();
  }

  private hexToRgba(hex: string, opacity: number): string {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Return rgba
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // ... existing code ...
  private drawUI() {
    // Set font
    this.ctx.font = this.fontLoaded ? '16px PixelFont' : '16px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    
    // Draw score
    this.ctx.fillStyle = '#FFF';
    this.ctx.fillText(`Score: ${this.score}`, 10, 10);
    
    // Draw HP bar
    const hpBarWidth = 200;
    const hpBarHeight = 20;
    const hpBarX = 10;
    const hpBarY = 40;
    
    // Draw HP bar background
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
    
    // Draw HP bar fill
    const hpPercentage = this.hp / this.maxHp;
    this.ctx.fillStyle = this.shieldActive ? '#32CD32' : '#00FF00';
    this.ctx.fillRect(hpBarX, hpBarY, hpBarWidth * hpPercentage, hpBarHeight);
    
    // Draw HP text
    this.ctx.fillStyle = '#FFF';
    this.ctx.fillText(`HP: ${Math.floor(this.hp)}/${this.maxHp}`, hpBarX + 10, hpBarY + 2);
    
    // Draw "P to Pause" text below the HP bar
    this.ctx.fillStyle = '#AAA';
    this.ctx.fillText(`P to Pause`, 10, hpBarY + hpBarHeight + 10);
    
    // Draw shield status if active
    if (this.shieldActive) {
      const remainingTime = Math.ceil((this.shieldEndTime - Date.now()) / 1000);
      this.ctx.fillStyle = '#32CD32';
      this.ctx.fillText(`Shield: ${remainingTime}s`, 10, hpBarY + hpBarHeight + 30);
    }
    
    
    // Draw game over message
    if (this.gameOver) {
      this.ctx.font = this.fontLoaded ? '32px PixelFont' : '32px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = '#FF0000';
      this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 40);
      
      this.ctx.font = this.fontLoaded ? '16px PixelFont' : '16px monospace';
      this.ctx.fillStyle = '#FFF';
      this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.fillText('Press SPACE to restart', this.canvas.width / 2, this.canvas.height / 2 + 30);
    }
  }

  private drawScore() {
    // This method is now deprecated, using drawUI instead
    this.drawUI();
  }

  private drawGameOver() {
    // This method is now deprecated, using drawUI instead
    // Semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Call drawUI to handle the rest
    this.drawUI();
  }

  private endGame() {
    this.gameOver = true;
    if (this.gameLoop) {
      cancelAnimationFrame(this.gameLoop);
      this.gameLoop = null;
    }
  }

  private restart() {
    // Reset game state
    this.snake = [
      {x: Math.floor(this.width / 2), y: Math.floor(this.height / 2)},
      {x: Math.floor(this.width / 2) - 1, y: Math.floor(this.height / 2)},
      {x: Math.floor(this.width / 2) - 2, y: Math.floor(this.height / 2)}
    ];
    this.targetFPS=15;
    this.direction = 'right';
    this.nextDirection = 'right';
    this.score = 0;
    this.gameSpeed = this.gameConfig.initialSpeed;
    this.gameOver = false;
    this.objects = [];
    this.hp = this.maxHp;
    this.speedBoostActive = false;
    this.shieldActive = false;
    this.blockedDirections.clear();
    
    // Restart game loop
    this.lastFrameTime = performance.now();
    this.startGameLoop();
    
    // Restart object spawning
    this.scheduleObjectSpawning();
  }

  public destroy() {
    // Clean up
    if (this.gameLoop) {
      cancelAnimationFrame(this.gameLoop);
      this.gameLoop = null;
    }
    
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

// Game object interface
interface GameObject {
  id: number;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  createdAt: number;
  lifespan: number;
  disappearing?: boolean;
  scale: number;
  opacity: number;
  shape: string;
  hasCollidedWithSnake?: boolean;
}

// Konami Code detector
export class KonamiCode {
  private sequence: string[] = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  private currentIndex: number = 0;
  private callback: () => void;
  
  constructor(callback: () => void) {
    this.callback = callback;
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }
  
  private handleKeyDown(e: KeyboardEvent) {
    // Check if the key matches the expected key in the sequence
    if (e.key === this.sequence[this.currentIndex]) {
      this.currentIndex++;
      
      // If the entire sequence is entered, trigger the callback
      if (this.currentIndex === this.sequence.length) {
        this.callback();
        this.currentIndex = 0; // Reset for next time
      }
    } else {
      // Reset if wrong key is pressed
      this.currentIndex = 0;
      
      // If the wrong key is the first key in the sequence, don't skip it
      if (e.key === this.sequence[0]) {
        this.currentIndex = 1;
      }
    }
  }
  
  public destroy() {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
  }
}