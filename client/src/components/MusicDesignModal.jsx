import React from 'react';

function MusicDesignModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="music-modal-backdrop" onClick={onClose}>
      <div className="music-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="music-modal-header">
          <div>
            <span className="badge-pill">Question 2 System Design Deliverable</span>
            <h2>🎧 Listen Together: Collaborative Music Streaming Architecture</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="music-modal-body">
          <div className="design-card-grid">
            <div className="design-summary-card">
              <h4>🎯 Core Constraints & Scale</h4>
              <ul>
                <li><strong>20M MAU</strong> & <strong>2M peak concurrent listeners</strong></li>
                <li><strong>50 Million</strong> track catalog</li>
                <li><strong>200,000 rooms</strong> (2 up to 5,000 users per room)</li>
                <li><strong>Sub-200ms</strong> global audio sync across all room members</li>
              </ul>
            </div>

            <div className="design-summary-card">
              <h4>⚡ Sync & Audio Streaming Architecture</h4>
              <ul>
                <li><strong>CDN Audio Chunks (HLS/AAC):</strong> Audio bits are NEVER piped through WebSockets. They are served via CDN edge nodes for infinite scalability.</li>
                <li><strong>WebSockets + Redis Pub/Sub:</strong> Host play/pause commands fan out instantly across clustered sync nodes to 5,000 listeners.</li>
                <li><strong>Polyglot Persistence:</strong> PostgreSQL (Catalog), Elasticsearch (Fuzzy Search), DynamoDB (Room State), Kafka + ClickHouse (Royalties).</li>
              </ul>
            </div>
          </div>

          <div className="logic-highlight-box">
            <h4>⏱️ Sub-200ms Playback Drift Correction Algorithm (Music Sync Logic)</h4>
            <p>To avoid audible stutters or sudden jumps, listeners do not abruptly hard-seek on tiny network jitters:</p>
            <pre>
{`// Client calculates drift on every periodic sync heartbeat:
const expectedPosition = payload.trackOffsetMs + (Date.now() - payload.serverTimestamp);
const currentPosition = audioPlayer.currentTime * 1000;
const drift = expectedPosition - currentPosition;

if (Math.abs(drift) < 50) {
  // Imperceptible skew: Maintain normal playback
  audioPlayer.playbackRate = 1.0;
} else if (Math.abs(drift) <= 500) {
  // Micro-adjust speed smoothly (no audio popping/clicks)
  audioPlayer.playbackRate = drift > 0 ? 1.05 : 0.95;
} else {
  // Major desync (e.g. background tab or packet drop): Hard seek
  audioPlayer.currentTime = expectedPosition / 1000;
  audioPlayer.playbackRate = 1.0;
}`}
            </pre>
          </div>

          <div className="modal-actions-footer">
            <a 
              href="/design_doc.html" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn primary-btn view-full-doc-btn"
            >
              📄 Open Full Architecture Document with Interactive Diagrams
            </a>
            <button onClick={onClose} className="btn secondary-btn">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MusicDesignModal;
