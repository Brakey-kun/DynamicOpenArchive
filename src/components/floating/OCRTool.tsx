"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Tesseract from 'tesseract.js';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export interface OCRToolProps {
  isOpen: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex?: number;
  onClose: () => void;
  onPositionChange: (pos: { x: number; y: number }) => void;
  onSizeChange: (size: { width: number; height: number }) => void;
}

// Helper to clamp values
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

export default function OCRTool({
  isOpen,
  position,
  size,
  zIndex = 1100,
  onClose,
  onPositionChange,
  onSizeChange,
}: OCRToolProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("eng");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [hasProcessedCurrentImage, setHasProcessedCurrentImage] = useState<boolean>(false);
  const [mathMode, setMathMode] = useState<boolean>(false);
  const [latexOutput, setLatexOutput] = useState<string>("");
  const [renderedMath, setRenderedMath] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag state
  const dragState = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
  });

  // Resize state
  const resizeState = useRef({
    resizing: false,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
  });

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      setError(null);
      setHasProcessedCurrentImage(false); // Reset processing flag for new image
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setError("Please select a valid image file (PNG, JPG, JPEG, WEBP)");
    }
  }, []);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setSelectedImage(file);
        setError(null);
        setHasProcessedCurrentImage(false); // Reset processing flag for new image
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setError("Please select a valid image file (PNG, JPG, JPEG, WEBP)");
      }
    }
  }, []);

  // Handle paste
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            setSelectedImage(blob);
            setError(null);
            setHasProcessedCurrentImage(false); // Reset processing flag for new image
            
            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
              setImagePreview(e.target?.result as string);
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    }
  }, []);

  // Add paste event listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('paste', handlePaste);
    }
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, handlePaste]);

  // Handle screenshot capture
  const handleScreenCapture = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      video.addEventListener('loadedmetadata', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'screenshot.png', { type: 'image/png' });
            setSelectedImage(file);
            setImagePreview(canvas.toDataURL());
          }
        });
        
        // Stop the stream
        stream.getTracks().forEach(track => track.stop());
      });
    } catch (err) {
      // Remove the error message for screenshot capture
      console.error('Screenshot capture error:', err);
    }
  }, []);

  // Mathematical formula detection and processing
  const detectAndProcessMath = useCallback((text: string) => {
    if (!mathMode) return text;
    
    // Common mathematical patterns to detect
    const mathPatterns = [
      /\b\d+\s*[\+\-\*\/\=]\s*\d+/g, // Basic arithmetic
      /\b[a-zA-Z]\s*[\+\-\*\/\=]\s*[a-zA-Z0-9]/g, // Algebraic expressions
      /\b\d*[a-zA-Z]\^?\d*/g, // Variables with potential exponents
      /\b(sin|cos|tan|log|ln|sqrt|integral|sum|lim)\b/gi, // Mathematical functions
      /[∫∑∏√±×÷≤≥≠≈∞]/g, // Mathematical symbols
      /\b\d+\/\d+\b/g, // Fractions
      /\([^)]*\)/g, // Expressions in parentheses
    ];
    
    let processedText = text;
    let hasmath = false;
    
    // Check if text contains mathematical content
    mathPatterns.forEach(pattern => {
      if (pattern.test(text)) {
        hasmath = true;
      }
    });
    
    if (hasmath) {
      // Convert common OCR mistakes in mathematical context
      processedText = processedText
        .replace(/\bx\b/g, '×') // Replace x with multiplication symbol when appropriate
        .replace(/\b0\b(?=\s*[a-zA-Z])/g, 'O') // Fix common O/0 confusion
        .replace(/\bl\b/g, '1') // Fix common l/1 confusion in math
        .replace(/\bS\b/g, '5') // Fix common S/5 confusion
        .replace(/\|\|/g, '=') // Fix common = symbol recognition
        .replace(/\bO\b(?=\s*[\+\-\*\/])/g, '0') // Fix O back to 0 in arithmetic context
        .replace(/(\d)\s+(\d)/g, '$1$2') // Remove spaces between digits
        .replace(/(\w)\s*\^\s*(\w)/g, '$1^{$2}') // Format exponents for LaTeX
        .replace(/(\d+)\s*\/\s*(\d+)/g, '\\frac{$1}{$2}') // Convert fractions to LaTeX
        .replace(/sqrt\s*\(([^)]+)\)/gi, '\\sqrt{$1}') // Convert sqrt to LaTeX
        .replace(/\bsum\b/gi, '\\sum') // Convert sum to LaTeX
        .replace(/\bintegral\b/gi, '\\int') // Convert integral to LaTeX
        .replace(/\blim\b/gi, '\\lim') // Convert limit to LaTeX
        .replace(/\bsin\b/gi, '\\sin') // Convert trig functions to LaTeX
        .replace(/\bcos\b/gi, '\\cos')
        .replace(/\btan\b/gi, '\\tan')
        .replace(/\blog\b/gi, '\\log')
        .replace(/\bln\b/gi, '\\ln');
      
      setLatexOutput(processedText);
      
      // Try to render with KaTeX
      try {
        const rendered = katex.renderToString(processedText, {
          throwOnError: false,
          displayMode: true,
        });
        setRenderedMath(rendered);
      } catch (err) {
        console.log('KaTeX rendering failed, using plain text:', err);
        setRenderedMath('');
      }
    }
    
    return processedText;
  }, [mathMode]);

  // Enhanced OCR processing with math support
  const handleOCR = useCallback(async () => {
    if (!selectedImage || hasProcessedCurrentImage) return;
    
    setIsProcessing(true);
    setError(null);
    setLatexOutput('');
    setRenderedMath('');
    
    try {
      let ocrOptions: any = {
        logger: (m: any) => console.log(m)
      };
      
      // Enhanced OCR settings for mathematical content
      if (mathMode) {
        ocrOptions = {
          ...ocrOptions,
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-*/=()[]{}^.,∫∑∏√±×÷≤≥≠≈∞',
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        };
      }
      
      const { data: { text } } = await Tesseract.recognize(selectedImage, selectedLanguage, ocrOptions);
      
      const processedText = detectAndProcessMath(text);
      setOcrText(processedText);
      setHasProcessedCurrentImage(true);
    } catch (err) {
      setError("OCR processing failed. Please try again.");
      console.error('OCR error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedImage, selectedLanguage, hasProcessedCurrentImage, mathMode, detectAndProcessMath]);

  // Auto-run OCR when image is selected
  useEffect(() => {
    if (selectedImage && !isProcessing && !hasProcessedCurrentImage) {
      handleOCR();
    }
  }, [selectedImage, handleOCR, isProcessing, hasProcessedCurrentImage]);

  // Copy text to clipboard
  const copyToClipboard = useCallback(async () => {
    const textToCopy = mathMode && latexOutput ? latexOutput : ocrText;
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        // Could add a toast notification here
      } catch (err) {
        console.error('Failed to copy text:', err);
      }
    }
  }, [ocrText, latexOutput, mathMode]);

  // Export as text file
  const exportAsTextFile = useCallback(() => {
    const textToExport = mathMode && latexOutput ? latexOutput : ocrText;
    const fileName = mathMode && latexOutput ? 'ocr-math-result.tex' : 'ocr-result.txt';
    
    if (textToExport) {
      const blob = new Blob([textToExport], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [ocrText, latexOutput, mathMode]);

  // Drag functionality
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.ocr-header')) {
        e.preventDefault();
        dragState.current = {
          dragging: true,
          startX: e.clientX - position.x,
          startY: e.clientY - position.y,
        };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current.dragging) return;
      const newX = e.clientX - dragState.current.startX;
      const newY = e.clientY - dragState.current.startY;
      onPositionChange({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      dragState.current.dragging = false;
    };

    if (isOpen) {
      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isOpen, position, onPositionChange]);

  // Resize functionality
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('resize-handle')) {
        e.preventDefault();
        resizeState.current = {
          resizing: true,
          startX: e.clientX,
          startY: e.clientY,
          startW: size.width,
          startH: size.height,
        };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!resizeState.current.resizing) return;
      const dx = e.clientX - resizeState.current.startX;
      const dy = e.clientY - resizeState.current.startY;
      const newW = clamp(resizeState.current.startW + dx, 400, window.innerWidth);
      const newH = clamp(resizeState.current.startH + dy, 300, window.innerHeight);
      onSizeChange({ width: newW, height: newH });
    };

    const onMouseUp = () => {
      resizeState.current.resizing = false;
    };

    if (isOpen) {
      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isOpen, size, onSizeChange]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex,
      }}
    >
      {/* Header */}
      <div className="ocr-header flex items-center justify-between p-3 bg-blue-600 text-white cursor-move">
        <h4 className="text-sm font-medium">OCR Reader {mathMode && '📐'}</h4>
        <div className="flex items-center gap-2">
          {/* Math Mode Toggle */}
          <button
            onClick={() => setMathMode(!mathMode)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              mathMode 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-blue-700 hover:bg-blue-800'
            }`}
            title="Toggle mathematical formula recognition"
          >
            {mathMode ? '📐 Math' : 'ABC'}
          </button>
          {/* Language selector */}
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="text-xs bg-blue-700 text-white border border-blue-600 rounded px-2 py-1 cursor-pointer hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
            style={{ 
              appearance: 'auto',
              WebkitAppearance: 'menulist',
              MozAppearance: 'menulist'
            }}
          >
            <option value="eng" className="bg-white text-black">English</option>
            <option value="fra" className="bg-white text-black">French</option>
            <option value="deu" className="bg-white text-black">German</option>
            <option value="spa" className="bg-white text-black">Spanish</option>
            <option value="ara" className="bg-white text-black">Arabic</option>
            <option value="chi_sim" className="bg-white text-black">Chinese (Simplified)</option>
            <option value="chi_tra" className="bg-white text-black">Chinese (Traditional)</option>
            <option value="jpn" className="bg-white text-black">Japanese</option>
          </select>
          <button
            onClick={onClose}
            className="text-xs bg-red-500 hover:bg-red-600 px-2 py-1 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col h-full overflow-hidden">
        {/* Instruction text */}
        {!selectedImage && (
          <div className="px-4 pt-3 pb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Take a screenshot of the concerned text area and paste it here for text extraction:
            </p>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-500 text-center">
              <p className="mb-1">
                <strong>Windows:</strong> Win + Shift + S
              </p>
              <p>
                <strong>Mac:</strong> Command + Shift + 4, then right-click the image in bottom right → Save to Clipboard
              </p>
            </div>
          </div>
        )}
        
        {/* Main upload area - drag and drop zone */}
        {!selectedImage && (
          <div
            className={`flex flex-col items-center justify-center border-2 border-dashed m-4 rounded-lg transition-colors cursor-pointer h-32 ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-center p-4">
              {/* Upload icon */}
              <div className="mb-2">
                <svg 
                  className="mx-auto h-8 w-8 text-gray-400" 
                  stroke="currentColor" 
                  fill="none" 
                  viewBox="0 0 48 48"
                >
                  <path 
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" 
                    strokeWidth={2} 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                </svg>
              </div>
              
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Drag & drop an image here, or click to upload
              </h3>
              
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                You can also paste an image (Ctrl+V / Cmd+V)
              </p>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Select Image
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Error display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mx-4 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Image preview and results */}
        {selectedImage && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            {/* Image preview */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={imagePreview || ''}
                  alt="Selected for OCR"
                  className="w-16 h-16 object-cover border rounded"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedImage.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(selectedImage.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview(null);
                  setOcrText('');
                  setError(null);
                  setHasProcessedCurrentImage(false);
                  setLatexOutput('');
                  setRenderedMath('');
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                className="text-xs bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Loading indicator */}
            {isProcessing && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Processing OCR...</span>
              </div>
            )}

            {/* OCR Results */}
            {ocrText && !isProcessing && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Extracted Text:</h5>
                  <div className="flex gap-2">
                    <button
                      onClick={copyToClipboard}
                      className="text-xs bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded transition-colors"
                    >
                      Copy
                    </button>
                    {mathMode && latexOutput && (
                      <button
                        onClick={() => navigator.clipboard.writeText(latexOutput)}
                        className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded transition-colors"
                        title="Copy LaTeX code"
                      >
                        LaTeX
                      </button>
                    )}
                    <button
                      onClick={exportAsTextFile}
                      className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded transition-colors"
                    >
                      Export
                    </button>
                  </div>
                </div>
                
                {/* Math Formula Preview */}
                {mathMode && renderedMath && (
                  <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded">
                    <h6 className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">Rendered Formula:</h6>
                    <div 
                      className="text-center"
                      dangerouslySetInnerHTML={{ __html: renderedMath }}
                    />
                  </div>
                )}
                
                {/* LaTeX Output */}
                {mathMode && latexOutput && (
                  <div className="mb-3">
                    <h6 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">LaTeX Code:</h6>
                    <textarea
                      value={latexOutput}
                      readOnly
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-mono resize-none"
                      style={{ minHeight: '60px' }}
                    />
                  </div>
                )}
                
                <textarea
                  value={ocrText}
                  readOnly
                  className="flex-1 w-full p-3 border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-mono resize-none"
                  style={{ minHeight: mathMode ? '100px' : '150px' }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div className="resize-handle absolute bottom-0 right-0 w-4 h-4 bg-gray-400 cursor-se-resize opacity-50 hover:opacity-100"></div>
    </div>
  );
}