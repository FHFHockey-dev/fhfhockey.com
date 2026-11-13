import React from 'react';
import { createRoot } from 'react-dom/client';
import DRMPage from '../../../pages/drm';
import '../../../styles/globals.css';

document.body.style.cssText = 'margin:0;background:#202020;color:#eee;font-family:Arial,sans-serif';
createRoot(document.getElementById('root')!).render(<>
  <p style={{ margin: 12 }}>Synthetic DRM fixture — real page, readers and matrix; no external services.</p>
  <DRMPage />
</>);
