'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Copy, Check, ChevronRight, ChevronLeft, RotateCw } from 'lucide-react';

// Types
interface FlashCard {
    id: number | string;
    subject: string;
    chapter: string;
    question: string;
    answer: string;
}

type GameState = 'intro' | 'playing' | 'finished';

export default function FlashCardsPage() {
    const [gameState, setGameState] = useState<GameState>('intro');
    const [cards, setCards] = useState<FlashCard[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const [jsonText, setJsonText] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // AI Prompt
    const aiPrompt = `I need you to generate a JSON file for a flashcard game based on the notes I will provide. 
The JSON structure should be an array of objects, where each object represents a flashcard.
Each object MUST have the following fields:
- "id": A unique number or string for order.
- "subject": The general subject name (e.g., "History", "Biology").
- "chapter": The specific chapter or topic (e.g., "World War II", "Cell Structure").
- "question": The question for the flashcard.
- "answer": The answer for the flashcard.

Example:
[
  {
    "id": 1,
    "subject": "Biology",
    "chapter": "Cell Structure",
    "question": "What is the powerhouse of the cell?",
    "answer": "Mitochondria"
  }
]

Please generate at least 10 flashcards if possible. Output ONLY the valid JSON code, no markdown formatting or extra text.`;

    const handleCopyPrompt = () => {
        navigator.clipboard.writeText(aiPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const parsed = JSON.parse(content);

                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question && parsed[0].answer) {
                    setCards(parsed);
                    setGameState('playing');
                    setError('');
                } else {
                    setError('Invalid JSON format. Please ensure it matches the required structure.');
                }
            } catch (err) {
                setError('Error parsing file. Please ensure it is a valid JSON file.');
            }
        };
        reader.readAsText(file);
    };

    const handleTextSubmit = () => {
        if (!jsonText.trim()) return;

        try {
            const parsed = JSON.parse(jsonText);

            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question && parsed[0].answer) {
                setCards(parsed);
                setGameState('playing');
                setError('');
            } else {
                setError('Invalid JSON format. Please ensure it matches the required structure.');
            }
        } catch (err) {
            setError('Error parsing text. Please ensure it is valid JSON.');
        }
    };

    const handleNext = () => {
        setIsFlipped(false);
        setTimeout(() => {
            if (currentCardIndex < cards.length - 1) {
                setCurrentCardIndex(prev => prev + 1);
            } else {
                setGameState('finished');
            }
        }, 200);
    };

    const handlePrev = () => {
        if (currentCardIndex > 0) {
            setIsFlipped(false);
            setTimeout(() => {
                setCurrentCardIndex(prev => prev - 1);
            }, 200);
        }
    };

    const handleRestart = () => {
        setGameState('intro');
        setCards([]);
        setCurrentCardIndex(0);
        setIsFlipped(false);
    };

    // Liquid Progress Bar Component
    const LiquidProgressBar = ({ progress }: { progress: number }) => {
        return (
            <div className="relative w-full h-4 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700">
                <div
                    className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                >
                    {/* Liquid/Wave Effect */}
                    <div className="absolute top-0 right-0 w-full h-full opacity-50 animate-pulse bg-blue-400 blur-[2px]"></div>
                    <div
                        className="absolute top-0 right-0 h-full w-2 bg-white/30 blur-[1px]"
                        style={{ transform: 'skewX(-20deg)' }}
                    ></div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-4 flex flex-col items-center">
            {/* Header */}
            <header className="w-full max-w-4xl flex justify-between items-center mb-8">
                <Link href="/games" className="flex items-center text-neutral-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Games
                </Link>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Flash Cards
                </h1>
            </header>

            {gameState === 'intro' && (
                <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
                    <h2 className="text-3xl font-bold mb-6 text-center">Welcome to Flash Cards</h2>

                    <div className="space-y-6">
                        <div className="bg-neutral-800/50 p-6 rounded-xl border border-neutral-700">
                            <h3 className="text-xl font-semibold mb-4 flex items-center">
                                <span className="bg-blue-500/20 text-blue-400 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">1</span>
                                Get Your Data Ready
                            </h3>
                            <p className="text-neutral-400 mb-4">
                                Use our AI prompt to convert your notes into a compatible JSON format.
                            </p>
                            <button
                                onClick={() => setShowPrompt(true)}
                                className="w-full py-3 px-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-lg flex items-center justify-center transition-all group"
                            >
                                <Copy className="w-4 h-4 mr-2 group-hover:text-blue-400" />
                                View & Copy AI Prompt
                            </button>
                        </div>

                        <div className="bg-neutral-800/50 p-6 rounded-xl border border-neutral-700">
                            <h3 className="text-xl font-semibold mb-4 flex items-center">
                                <span className="bg-purple-500/20 text-purple-400 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">2</span>
                                Upload File
                            </h3>
                            <p className="text-neutral-400 mb-4">
                                Upload the generated JSON file to start studying.
                            </p>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-32 border-2 border-dashed border-neutral-600 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-neutral-900/50 hover:bg-neutral-800/50"
                            >
                                <Upload className="w-8 h-8 text-neutral-500 mb-2" />
                                <span className="text-neutral-400">Click to upload JSON file</span>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".json,.txt"
                                    className="hidden"
                                />
                            </div>
                            {error && <p className="text-red-400 mt-2 text-sm text-center">{error}</p>}
                        </div>

                        <div className="bg-neutral-800/50 p-6 rounded-xl border border-neutral-700">
                            <h3 className="text-xl font-semibold mb-4 flex items-center">
                                <span className="bg-green-500/20 text-green-400 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm">3</span>
                                Or Paste JSON
                            </h3>
                            <p className="text-neutral-400 mb-4">
                                Directly paste the JSON code here if you don't have a file.
                            </p>
                            <textarea
                                value={jsonText}
                                onChange={(e) => setJsonText(e.target.value)}
                                placeholder="Paste your JSON here..."
                                className="w-full h-32 bg-neutral-900 border border-neutral-600 rounded-xl p-4 text-sm font-mono text-neutral-300 focus:border-blue-500 focus:outline-none resize-none mb-4"
                            />
                            <button
                                onClick={handleTextSubmit}
                                disabled={!jsonText.trim()}
                                className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg font-medium transition-colors"
                            >
                                Start Game from Text
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {gameState === 'playing' && cards.length > 0 && (
                <div className="w-full max-w-4xl flex flex-col items-center">
                    {/* Progress Section */}
                    <div className="w-full mb-8 space-y-2">
                        <div className="flex justify-between items-end text-sm text-neutral-400">
                            <div className="flex flex-col">
                                <span className="text-xs uppercase tracking-wider text-blue-400 font-semibold mb-1">Subject</span>
                                <span className="text-white text-lg font-medium">{cards[currentCardIndex].subject}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs uppercase tracking-wider text-purple-400 font-semibold mb-1">Chapter</span>
                                <span className="text-white text-lg font-medium">{cards[currentCardIndex].chapter}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <LiquidProgressBar progress={((currentCardIndex + 1) / cards.length) * 100} />
                            <span className="text-neutral-500 font-mono whitespace-nowrap">
                                {currentCardIndex + 1} / {cards.length}
                            </span>
                        </div>
                    </div>

                    {/* Card Area */}
                    <div className="perspective-1000 w-full max-w-2xl h-[400px] cursor-pointer group" onClick={() => setIsFlipped(!isFlipped)}>
                        <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>

                            {/* Front (Question) */}
                            <div className="absolute w-full h-full backface-hidden">
                                <div className="w-full h-full bg-neutral-900 border border-neutral-700 rounded-2xl p-8 flex flex-col items-center justify-center shadow-xl hover:border-blue-500/50 transition-colors">
                                    <span className="absolute top-6 left-6 text-xs font-bold text-neutral-500 uppercase tracking-widest">Question</span>
                                    <p className="text-2xl md:text-3xl text-center font-medium leading-relaxed">
                                        {cards[currentCardIndex].question}
                                    </p>
                                    <span className="absolute bottom-6 text-sm text-neutral-500 animate-pulse">Click to flip</span>
                                </div>
                            </div>

                            {/* Back (Answer) */}
                            <div className="absolute w-full h-full backface-hidden rotate-y-180">
                                <div className="w-full h-full bg-neutral-800 border border-blue-500/30 rounded-2xl p-8 flex flex-col items-center justify-center shadow-xl shadow-blue-900/10">
                                    <span className="absolute top-6 left-6 text-xs font-bold text-blue-400 uppercase tracking-widest">Answer</span>
                                    <p className="text-2xl md:text-3xl text-center font-medium leading-relaxed text-blue-100">
                                        {cards[currentCardIndex].answer}
                                    </p>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-6 mt-10">
                        <button
                            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                            disabled={currentCardIndex === 0}
                            className="p-4 rounded-full bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); handleNext(); }}
                            className="px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-900/20 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95"
                        >
                            {currentCardIndex === cards.length - 1 ? 'Finish' : 'Next Card'}
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {gameState === 'finished' && (
                <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center shadow-2xl">
                    <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-bold mb-2">All Done!</h2>
                    <p className="text-neutral-400 mb-8">You've completed all {cards.length} flashcards.</p>
                    <button
                        onClick={handleRestart}
                        className="w-full py-3 px-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-lg flex items-center justify-center transition-all"
                    >
                        <RotateCw className="w-4 h-4 mr-2" />
                        Start Over
                    </button>
                </div>
            )}

            {/* Prompt Modal */}
            {showPrompt && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold">AI Prompt</h3>
                            <button onClick={() => setShowPrompt(false)} className="text-neutral-400 hover:text-white">Close</button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <p className="text-neutral-400 mb-4">
                                Copy this prompt and paste it into ChatGPT, Claude, or Gemini along with your notes to generate the flashcards file.
                            </p>
                            <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 font-mono text-sm text-neutral-300 whitespace-pre-wrap">
                                {aiPrompt}
                            </div>
                        </div>
                        <div className="p-6 border-t border-neutral-800 flex justify-end">
                            <button
                                onClick={handleCopyPrompt}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors flex items-center"
                            >
                                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                {copied ? 'Copied!' : 'Copy to Clipboard'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
        </div>
    );
}
