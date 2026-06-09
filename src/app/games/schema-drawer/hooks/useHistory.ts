import { useState, useCallback, useRef } from 'react';
import { Shape, Connection, FloatingText, Layer } from '../types';

interface HistorySnapshot {
    shapes: Shape[];
    connections: Connection[];
    texts: FloatingText[];
    layers: Layer[];
}

export function useHistory(
  shapes: Shape[],
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>,
  connections: Connection[],
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>,
  texts: FloatingText[],
  setTexts: React.Dispatch<React.SetStateAction<FloatingText[]>>,
  layers: Layer[],
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>
) {
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Use refs to always access latest state in callbacks
  const shapesRef = useRef(shapes);
  const connectionsRef = useRef(connections);
  const textsRef = useRef(texts);
  const layersRef = useRef(layers);
  const historyRef = useRef(history);
  const historyIndexRef = useRef(historyIndex);

  shapesRef.current = shapes;
  connectionsRef.current = connections;
  textsRef.current = texts;
  layersRef.current = layers;
  historyRef.current = history;
  historyIndexRef.current = historyIndex;

  const addToHistory = useCallback(() => {
    const snapshot: HistorySnapshot = {
      shapes: shapesRef.current,
      connections: connectionsRef.current,
      texts: textsRef.current,
      layers: layersRef.current,
    };
    setHistory(prev => {
        const newHistory = prev.slice(0, historyIndexRef.current + 1);
        newHistory.push(snapshot);
        // Cap at 50 entries to prevent unbounded memory growth
        if (newHistory.length > 50) newHistory.splice(0, newHistory.length - 50);
        return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, []);

  const undo = useCallback(() => {
    const idx = historyIndexRef.current;
    const hist = historyRef.current;
    if (idx > 0) {
        const prevState = hist[idx - 1];
        setShapes(prevState.shapes);
        setConnections(prevState.connections);
        setTexts(prevState.texts);
        setLayers(prevState.layers);
        setHistoryIndex(idx - 1);
    }
  }, [setShapes, setConnections, setTexts, setLayers]);

  const redo = useCallback(() => {
    const idx = historyIndexRef.current;
    const hist = historyRef.current;
    if (idx < hist.length - 1) {
        const nextState = hist[idx + 1];
        setShapes(nextState.shapes);
        setConnections(nextState.connections);
        setTexts(nextState.texts);
        setLayers(nextState.layers);
        setHistoryIndex(idx + 1);
    }
  }, [setShapes, setConnections, setTexts, setLayers]);

  return { history, historyIndex, addToHistory, undo, redo };
}
