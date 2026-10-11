import React, { useState, useEffect, useRef } from 'react';

function ReplayViewer({ gameHistory, onClose }) {
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [speed, setSpeed] = useState(2); // 1x, 2x, 4x

  const canvasRef = useRef(null);
  const animationTimerRef = useRef(null);

  const currentRoundData = gameHistory && gameHistory.length > 0 ? gameHistory[selectedRoundIndex] : null;
  const strokes = currentRoundData?.strokes || [];

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 2;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    clearCanvas();
    setProgressIndex(0);
    setIsPlaying(false);
  }, [selectedRoundIndex]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  };

  const drawStrokeSegment = (stroke) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 2;

    if (stroke.type === 'clear') {
      clearCanvas();
      return;
    }

    if (stroke.type === 'fill') {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = stroke.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.beginPath();
    ctx.moveTo(stroke.x0, stroke.y0);
    ctx.lineTo(stroke.x1, stroke.y1);
    ctx.strokeStyle = stroke.color || '#000000';
    ctx.lineWidth = stroke.lineWidth || 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  };

  // Replay animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      return;
    }

    if (progressIndex >= strokes.length) {
      setIsPlaying(false);
      return;
    }

    const stroke = strokes[progressIndex];
    drawStrokeSegment(stroke);

    const stepDelay = Math.max(10, Math.floor(40 / speed));
    animationTimerRef.current = setTimeout(() => {
      setProgressIndex(prev => prev + 1);
    }, stepDelay);

    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, [isPlaying, progressIndex, speed, strokes]);

  const handlePlayPause = () => {
    if (progressIndex >= strokes.length) {
      clearCanvas();
      setProgressIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setIsPlaying(false);
    clearCanvas();
    setProgressIndex(0);
  };

  if (!gameHistory || gameHistory.length === 0) {
    return (
      <div className="music-modal-backdrop" onClick={onClose}>
        <div className="music-modal-content replay-modal" onClick={e => e.stopPropagation()}>
          <div className="music-modal-header">
            <h3>🎬 Game Drawing Replay</h3>
            <button className="modal-close-btn" onClick={onClose}>&times;</button>
          </div>
          <div className="music-modal-body">
            <p>No drawing history recorded for this match.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="music-modal-backdrop" onClick={onClose}>
      <div className="music-modal-content replay-modal" onClick={e => e.stopPropagation()}>
        <div className="music-modal-header">
          <div>
            <span className="badge-pill">Stroke-by-Stroke Replay</span>
            <h2>🎬 Match Drawing Replay</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="music-modal-body">
          {/* Round Selector Tabs */}
          <div className="replay-round-tabs">
            {gameHistory.map((item, idx) => (
              <button 
                key={idx}
                className={`replay-tab-btn ${selectedRoundIndex === idx ? 'active' : ''}`}
                onClick={() => setSelectedRoundIndex(idx)}
              >
                Round {item.round}: {item.drawer} ("{item.word}")
              </button>
            ))}
          </div>

          <div className="replay-info-banner">
            <span>🎨 Drawer: <strong>{currentRoundData?.drawer}</strong></span>
            <span>🔑 Secret Word: <strong className="revealed-word">{currentRoundData?.word}</strong></span>
            <span>📊 Strokes: {progressIndex} / {strokes.length}</span>
          </div>

          <div className="replay-canvas-wrapper">
            <canvas ref={canvasRef} className="replay-canvas" />
          </div>

          <div className="replay-controls-bar">
            <div className="replay-control-buttons">
              <button onClick={handlePlayPause} className="btn primary-btn play-replay-btn">
                {isPlaying ? '⏸ Pause' : progressIndex >= strokes.length ? '🔄 Replay' : '▶ Play'}
              </button>
              <button onClick={handleRestart} className="btn secondary-btn">
                ⏮ Restart
              </button>
            </div>

            <div className="replay-speed-controls">
              <span>Speed:</span>
              {[1, 2, 4].map(s => (
                <button 
                  key={s} 
                  className={`speed-btn ${speed === s ? 'active' : ''}`}
                  onClick={() => setSpeed(s)}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReplayViewer;
