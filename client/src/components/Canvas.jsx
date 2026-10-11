import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { soundManager } from '../utils/soundManager';

function Canvas({ socket, roomId, isDrawing }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawingMouse, setIsDrawingMouse] = useState(false);
  
  const [color, setColor] = useState('#2563eb');
  const [lineWidth, setLineWidth] = useState(5);
  const [tool, setTool] = useState('pen'); // 'pen', 'eraser', 'fill'

  const lastPointRef = useRef(null);
  const currentStrokeIdRef = useRef(null);

  // Initialize canvas with high-DPI scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 2;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const context = canvas.getContext('2d');
      context.scale(dpr, dpr);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      contextRef.current = context;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Update stroke style when color, tool or lineWidth changes
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
      contextRef.current.lineWidth = lineWidth;
    }
  }, [color, lineWidth, tool]);

  // Socket event listeners for drawing, clearing, and syncing
  useEffect(() => {
    if (!socket) return;

    const handleDrawStroke = (stroke) => {
      drawOnCanvas(stroke);
    };

    const handleClear = () => {
      if (contextRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = contextRef.current;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    };

    const handleSync = (strokes) => {
      handleClear();
      if (Array.isArray(strokes)) {
        strokes.forEach(stroke => {
          if (stroke.type === 'clear') {
            handleClear();
          } else {
            drawOnCanvas(stroke);
          }
        });
      }
    };

    const handleStrokeUndone = () => {
      soundManager.playUndo();
      toast('Stroke undone ↩', { id: 'stroke-undo', duration: 1500 });
    };

    socket.on('draw_stroke', handleDrawStroke);
    socket.on('clear_canvas', handleClear);
    socket.on('canvas_sync', handleSync);
    socket.on('stroke_undone', handleStrokeUndone);

    return () => {
      socket.off('draw_stroke', handleDrawStroke);
      socket.off('clear_canvas', handleClear);
      socket.off('canvas_sync', handleSync);
      socket.off('stroke_undone', handleStrokeUndone);
    };
  }, [socket, color, lineWidth, tool]);

  const drawOnCanvas = (stroke) => {
    if (!contextRef.current || !canvasRef.current) return;
    const ctx = contextRef.current;
    
    if (stroke.type === 'fill') {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = stroke.color;
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.x0, stroke.y0);
    ctx.lineTo(stroke.x1, stroke.y1);
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.stroke();
    ctx.closePath();
    
    // Restore active drawing properties
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = lineWidth;
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (!isDrawing) return;

    if (tool === 'fill') {
      const fillStroke = {
        type: 'fill',
        strokeId: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        color
      };
      drawOnCanvas(fillStroke);
      socket.emit('draw_stroke', { roomId, stroke: fillStroke });
      return;
    }

    const { x, y } = getCoordinates(e);
    currentStrokeIdRef.current = 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    lastPointRef.current = { x, y };
    setIsDrawingMouse(true);
  };

  const draw = (e) => {
    if (!isDrawingMouse || !isDrawing || !lastPointRef.current || tool === 'fill') return;
    const { x, y } = getCoordinates(e);

    const stroke = {
      strokeId: currentStrokeIdRef.current,
      x0: lastPointRef.current.x,
      y0: lastPointRef.current.y,
      x1: x,
      y1: y,
      color: tool === 'eraser' ? '#ffffff' : color,
      lineWidth: lineWidth
    };

    drawOnCanvas(stroke);
    socket.emit('draw_stroke', { roomId, stroke });
    
    lastPointRef.current = { x, y };
  };

  const finishDrawing = () => {
    if (!isDrawing) return;
    setIsDrawingMouse(false);
    lastPointRef.current = null;
    currentStrokeIdRef.current = null;
  };

  const handleUndo = () => {
    if (!isDrawing) return;
    socket.emit('undo_stroke', { roomId });
  };

  const handleClearCanvas = () => {
    if (!isDrawing) return;
    socket.emit('clear_canvas', { roomId });
    if (contextRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = contextRef.current;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  };

  return (
    <div className="canvas-container">
      {isDrawing ? (
        <div className="toolbar">
          <div className="tool-group">
            <input 
              type="color" 
              value={color} 
              onChange={e => { setColor(e.target.value); }} 
              title="Pick Color"
              className="color-picker-input"
            />
            <div className="brush-slider">
              <span>Size: {lineWidth}px</span>
              <input 
                type="range" 
                min="2" 
                max="30" 
                value={lineWidth} 
                onChange={e => setLineWidth(parseInt(e.target.value))} 
              />
            </div>
          </div>

          <div className="tool-actions">
            <button 
              className={`tool-btn ${tool === 'pen' ? 'active' : ''}`} 
              onClick={() => setTool('pen')}
              title="Pen tool"
            >
              ✏️ Pen
            </button>
            <button 
              className={`tool-btn ${tool === 'fill' ? 'active' : ''}`} 
              onClick={() => setTool('fill')}
              title="Bucket Fill tool"
            >
              🪣 Fill
            </button>
            <button 
              className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`} 
              onClick={() => setTool('eraser')}
              title="Eraser tool"
            >
              🧹 Eraser
            </button>
            <button 
              className="tool-btn undo-btn" 
              onClick={handleUndo}
              title="Undo last stroke"
            >
              ↩ Undo
            </button>
            <button 
              className="tool-btn clear-btn" 
              onClick={handleClearCanvas}
              title="Clear all"
            >
              🗑️ Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="guesser-banner">
          <span>👀 You are guessing! Watch the canvas closely and type your guess in the chat.</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseUp={finishDrawing}
        onMouseLeave={finishDrawing}
        onMouseMove={draw}
        onTouchStart={startDrawing}
        onTouchEnd={finishDrawing}
        onTouchCancel={finishDrawing}
        onTouchMove={draw}
        className={`drawing-board ${!isDrawing ? 'disabled' : ''}`}
      />
    </div>
  );
}

export default Canvas;
