"use client";

import React, { useState, useEffect, useRef } from 'react';

const ThrobPage = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [initialMousePos, setInitialMousePos] = useState({ x: 0, y: 0 });
  const [rotationAngle, setRotationAngle] = useState(-90);
  const [scale, setScale] = useState(1);

  const draggableRef = useRef<HTMLHeadingElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const defaultXRef = useRef<number | null>(null);

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isIdle, setIsIdle] = useState(true);
  const baseRotationForIdleRef = useRef(-90);

  const idleTargetPositionRef = useRef<{ x: number; y: number } | null>(null);
  const idleMoveStartTimeRef = useRef(performance.now());
  const idleLastPositionRef = useRef({ x: 0, y: 0 });

  const lastMousePosForShakeRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);
  const resetScaleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Effect to center the element initially
  useEffect(() => {
    if (containerRef.current && draggableRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const draggableVisualWidth = draggableRef.current.offsetHeight;
      const draggableVisualHeight = draggableRef.current.offsetWidth;

      const initialX = (containerRect.width - draggableVisualWidth) / 2;
      const initialY = (containerRect.height - draggableVisualHeight) / 2;

      setPosition({ x: initialX, y: initialY });
      idleLastPositionRef.current = { x: initialX, y: initialY };
      if (draggableRef.current) {
        defaultXRef.current = initialX + (draggableVisualWidth / 2);
      }
      idleMoveStartTimeRef.current = performance.now();
      setIsIdle(true);
    }
  }, []);

  const handleBecomeIdle = () => {
    setIsIdle(true);
    idleMoveStartTimeRef.current = performance.now();
    if (containerRef.current && draggableRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elementWidth = draggableRef.current.offsetWidth;
      const elementHeight = draggableRef.current.offsetHeight;
      const targetX = Math.random() * (containerRect.width - elementWidth);
      const targetY = Math.random() * (containerRect.height - elementHeight);
      idleTargetPositionRef.current = { x: targetX, y: targetY };
      idleLastPositionRef.current = { ...position };
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLHeadingElement>) => {
    if (!draggableRef.current) return;
    setIsDragging(true);
    setIsIdle(false);
    if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (resetScaleTimeoutRef.current) clearTimeout(resetScaleTimeoutRef.current); // Clear any pending scale reset
    idleTargetPositionRef.current = null;

    setInitialMousePos({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    lastMousePosForShakeRef.current = { x: e.clientX, y: e.clientY, timestamp: performance.now() };
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - initialMousePos.x;
    const newY = e.clientY - initialMousePos.y;
    setPosition({ x: newX, y: newY });
    idleLastPositionRef.current = { x: newX, y: newY };

    if (containerRef.current && defaultXRef.current !== null && draggableRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseXInContainer = e.clientX - containerRect.left;
      // Ensure defaultXRef.current is not null before using it for deltaX calculation
      const currentDefaultX = defaultXRef.current ?? (containerRect.width / 2);
      const deltaX = mouseXInContainer - currentDefaultX;
      const rotationAdjustment = deltaX * 0.07;
      const newAngle = -90 + rotationAdjustment;
      setRotationAngle(newAngle);
      baseRotationForIdleRef.current = newAngle;
    }

    // Shake detection and progressive scaling logic
    if (lastMousePosForShakeRef.current) {
      const now = performance.now();
      const deltaTime = now - lastMousePosForShakeRef.current.timestamp;

      // Ensure deltaTime is positive and not too small to avoid extreme velocity values
      if (deltaTime > 10) { // Increased minimum deltaTime slightly for stability
        const deltaMouseX = e.clientX - lastMousePosForShakeRef.current.x;
        const deltaMouseY = e.clientY - lastMousePosForShakeRef.current.y;
        const distance = Math.sqrt(deltaMouseX * deltaMouseX + deltaMouseY * deltaMouseY);
        const velocity = distance / deltaTime; // pixels per millisecond

        const MIN_SHAKE_VELOCITY = 0.4; // Lowered for more sensitivity
        const MAX_SHAKE_VELOCITY = 2.5; // Adjusted max for sensitivity range
        const MIN_SCALE = 0.15;         // Smallest it can get
        const BASE_SCALE_DECREMENT = 0.01; // Increased base decrement
        const INTENSITY_SCALE_FACTOR = 0.03; // Increased effect of intensity

        if (velocity > MIN_SHAKE_VELOCITY) {
          if (resetScaleTimeoutRef.current) clearTimeout(resetScaleTimeoutRef.current);
          resetScaleTimeoutRef.current = null;

          const normalizedVelocity = Math.min(Math.max(velocity - MIN_SHAKE_VELOCITY, 0) / (MAX_SHAKE_VELOCITY - MIN_SHAKE_VELOCITY), 1);
          const scaleDecrement = BASE_SCALE_DECREMENT + (normalizedVelocity * INTENSITY_SCALE_FACTOR);

          setScale(prevScale => Math.max(prevScale - scaleDecrement, MIN_SCALE));
        }
      }
      // Always update last mouse position for next calculation
      lastMousePosForShakeRef.current = { x: e.clientX, y: e.clientY, timestamp: now };
    } else {
      // If lastMousePosForShakeRef is null (can happen at the very start of a drag), initialize it
      lastMousePosForShakeRef.current = { x: e.clientX, y: e.clientY, timestamp: performance.now() };
    }

    if (isIdle) setIsIdle(false);
    if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(handleBecomeIdle, 700);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    lastMousePosForShakeRef.current = null;

    // If it was shaken (scale is less than 1), start timer to reset scale
    if (scale < 1) {
      if (resetScaleTimeoutRef.current) clearTimeout(resetScaleTimeoutRef.current);
      resetScaleTimeoutRef.current = setTimeout(() => {
        setScale(1);
      }, 1000); // Reset after 1 second of no shaking
    }

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(handleBecomeIdle, 700);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // If not dragging and scale is small, ensure reset timer is running
      if (scale < 1 && !resetScaleTimeoutRef.current) {
        resetScaleTimeoutRef.current = setTimeout(() => {
          setScale(1);
        }, 1000);
      }
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (resetScaleTimeoutRef.current) clearTimeout(resetScaleTimeoutRef.current);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [isDragging, initialMousePos, position, scale]); // Added scale to dependencies

  // Effect for idle animation (rotation and position)
  useEffect(() => {
    if (isIdle && containerRef.current && draggableRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const elementVisualWidth = draggableRef.current.offsetHeight; // visual width when rotated
      const elementVisualHeight = draggableRef.current.offsetWidth; // visual height when rotated

      const pickNewTarget = () => {
        const targetX = Math.random() * (containerRect.width - elementVisualWidth);
        const targetY = Math.random() * (containerRect.height - elementVisualHeight);
        idleTargetPositionRef.current = { x: targetX, y: targetY };
        idleMoveStartTimeRef.current = performance.now();
        idleLastPositionRef.current = { ...position };
      };

      if (!idleTargetPositionRef.current) {
        pickNewTarget();
      }

      const idleAnimate = () => {
        const now = performance.now();
        const timeSinceMoveStart = now - idleMoveStartTimeRef.current;

        setRotationAngle(baseRotationForIdleRef.current + Math.sin(now / 700) * 3);

        if (idleTargetPositionRef.current) {
          const duration = 5000;
          const progress = Math.min(timeSinceMoveStart / duration, 1);

          const nextX = idleLastPositionRef.current.x + (idleTargetPositionRef.current.x - idleLastPositionRef.current.x) * progress;
          const nextY = idleLastPositionRef.current.y + (idleTargetPositionRef.current.y - idleLastPositionRef.current.y) * progress;

          setPosition({ x: nextX, y: nextY });

          if (progress >= 1) {
            pickNewTarget();
          }
        }
        animationFrameIdRef.current = requestAnimationFrame(idleAnimate);
      };
      animationFrameIdRef.current = requestAnimationFrame(idleAnimate);
    } else {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
      // No need to clear idleTargetPositionRef here, handleMouseDown and handleMouseMove do it.
    }
    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [isIdle, position]); // position dependency is important here

  return (
    <>
      <style jsx>{`
        .fullscreen-container {
          width: 100vw;
          height: 100vh;
          position: relative; 
          overflow: hidden; 
          display: flex; 
          justify-content: center;
          align-items: center;
          background-color: #1a1a1a; 
        }

        #peen span {
          font-weight: normal;
          font-size: 60px;
          animation: boldWave 1s infinite;
          display: inline-block;
        }

        @keyframes boldWave {
          0%, 100% {
            font-weight: normal;
          }
          50% {
            font-weight: 900;
            color: red;
            font-size: 90px;
          }
        }
        
        .vertical-text {
          transform-origin: left top; 
          display: inline-block; 
          font-size: 24px;
          white-space: nowrap;
          position: absolute; 
          cursor: grab; 
          user-select: none; 
          transition: transform 0.1s ease-out; // For smooth scale transition
        }

        .vertical-text.dragging {
          cursor: grabbing;
        }

        @media (max-width: 768px) {
          #peen span {
            font-size: 30px;
          }
          @keyframes boldWave {
            50% {
              font-size: 45px;
            }
          }
        }
      `}</style>
      <div ref={containerRef} className="fullscreen-container">
        <h1
          ref={draggableRef}
          id="peen"
          className={`vertical-text ${isDragging ? 'dragging' : ''}`}
          style={{
            top: `${position.y}px`,
            left: `${position.x}px`,
            transform: `rotate(${rotationAngle}deg)`,
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={(e) => {
            if (!draggableRef.current) return;
            setIsDragging(true);
            setIsIdle(false);
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            if (resetScaleTimeoutRef.current) clearTimeout(resetScaleTimeoutRef.current);
            idleTargetPositionRef.current = null;

            const touch = e.touches[0];
            setInitialMousePos({
              x: touch.clientX - position.x,
              y: touch.clientY - position.y,
            });
            lastMousePosForShakeRef.current = { x: touch.clientX, y: touch.clientY, timestamp: performance.now() };
            // e.preventDefault(); // Removed to allow scrolling if needed, or keep if full screen app
          }}
          onTouchMove={(e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            const newX = touch.clientX - initialMousePos.x;
            const newY = touch.clientY - initialMousePos.y;

            // Reuse logic from handleMouseMove (simplified for brevity or extract to common function)
            // For now, just updating position and rotation
            setPosition({ x: newX, y: newY });
            idleLastPositionRef.current = { x: newX, y: newY };

            if (containerRef.current && defaultXRef.current !== null && draggableRef.current) {
              const containerRect = containerRef.current.getBoundingClientRect();
              const mouseXInContainer = touch.clientX - containerRect.left;
              const currentDefaultX = defaultXRef.current ?? (containerRect.width / 2);
              const deltaX = mouseXInContainer - currentDefaultX;
              const rotationAdjustment = deltaX * 0.07;
              const newAngle = -90 + rotationAdjustment;
              setRotationAngle(newAngle);
              baseRotationForIdleRef.current = newAngle;
            }

            // Shake logic (simplified/copied)
            if (lastMousePosForShakeRef.current) {
              const now = performance.now();
              const deltaTime = now - lastMousePosForShakeRef.current.timestamp;
              if (deltaTime > 10) {
                const deltaMouseX = touch.clientX - lastMousePosForShakeRef.current.x;
                const deltaMouseY = touch.clientY - lastMousePosForShakeRef.current.y;
                const distance = Math.sqrt(deltaMouseX * deltaMouseX + deltaMouseY * deltaMouseY);
                const velocity = distance / deltaTime;

                const MIN_SHAKE_VELOCITY = 0.4;
                const MAX_SHAKE_VELOCITY = 2.5;
                const MIN_SCALE = 0.15;
                const BASE_SCALE_DECREMENT = 0.01;
                const INTENSITY_SCALE_FACTOR = 0.03;

                if (velocity > MIN_SHAKE_VELOCITY) {
                  if (resetScaleTimeoutRef.current) clearTimeout(resetScaleTimeoutRef.current);
                  resetScaleTimeoutRef.current = null;
                  const normalizedVelocity = Math.min(Math.max(velocity - MIN_SHAKE_VELOCITY, 0) / (MAX_SHAKE_VELOCITY - MIN_SHAKE_VELOCITY), 1);
                  const scaleDecrement = BASE_SCALE_DECREMENT + (normalizedVelocity * INTENSITY_SCALE_FACTOR);
                  setScale(prevScale => Math.max(prevScale - scaleDecrement, MIN_SCALE));
                }
              }
              lastMousePosForShakeRef.current = { x: touch.clientX, y: touch.clientY, timestamp: now };
            } else {
              lastMousePosForShakeRef.current = { x: touch.clientX, y: touch.clientY, timestamp: performance.now() };
            }

            if (isIdle) setIsIdle(false);
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(handleBecomeIdle, 700);
          }}
          onTouchEnd={() => {
            if (!isDragging) return;
            setIsDragging(false);
            lastMousePosForShakeRef.current = null;
            if (scale < 1) {
              if (resetScaleTimeoutRef.current) clearTimeout(resetScaleTimeoutRef.current);
              resetScaleTimeoutRef.current = setTimeout(() => {
                setScale(1);
              }, 1000);
            }
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(handleBecomeIdle, 700);
          }}
        >
          {/* Spans for 8----- > */}
          <span style={{ animationDelay: '0s' }}>8</span>
          <span style={{ animationDelay: '0.1s' }}>-</span>
          <span style={{ animationDelay: '0.2s' }}>-</span>
          <span style={{ animationDelay: '0.4s' }}>-</span>
          <span style={{ animationDelay: '0.6s' }}>-</span>
          <span style={{ animationDelay: '0.8s' }}>-</span>
          <span style={{ animationDelay: '1s' }}>-</span>
          <span style={{ animationDelay: '1.1s' }}>-</span>
          <span style={{ animationDelay: '1.2s' }}>-</span>
          <span style={{ animationDelay: '1.4s' }}>-</span>
          <span style={{ animationDelay: '1.6s' }}>-</span>
          <span style={{ animationDelay: '1.8s' }}>-</span>
          <span style={{ animationDelay: '2.2s' }}>-</span>
          <span style={{ animationDelay: '2.4s' }}>-</span>
          <span style={{ animationDelay: '2.6s' }}> &gt; </span>
        </h1>
      </div>
    </>
  );
};

export default ThrobPage;