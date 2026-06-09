// Ambria FnB — Global CSS injection
// Extracted from App.jsx lines 6-80

const LUXURY_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

:root {
  --font-display: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
  --font-body: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --ease-luxury: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}

body { font-family: var(--font-body); }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #0A0908; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 6px; }
::-webkit-scrollbar-thumb:hover { background: #555; }

/* Smooth transitions for all interactive elements */
button, select, input, textarea {
  font-family: var(--font-body) !important;
  transition: all 0.2s var(--ease-luxury) !important;
}
button:hover { filter: brightness(1.08); }
button:active { transform: scale(0.97); filter: brightness(0.95); }

select, input, textarea {
  transition: border-color 0.25s ease, box-shadow 0.25s ease !important;
}
input:focus, select:focus, textarea:focus {
  outline: none !important;
  border-color: #D4B44A !important;
  box-shadow: 0 0 0 3px rgba(212,180,74,.12) !important;
}

/* Animations */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .5; }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes glow {
  0%, 100% { box-shadow: 0 0 8px rgba(212,180,74,.15); }
  50% { box-shadow: 0 0 20px rgba(212,180,74,.3); }
}
@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.015); }
}

.fade-in { animation: fadeIn 0.4s var(--ease-luxury) both; }
.fade-in-up { animation: fadeInUp 0.5s var(--ease-luxury) both; }
.slide-in { animation: slideInRight 0.4s var(--ease-luxury) both; }
`;

if(typeof document!=="undefined"&&!document.getElementById("ambria-luxury-css")){
  const s=document.createElement("style");s.id="ambria-luxury-css";s.textContent=LUXURY_CSS;document.head.appendChild(s);
}

export { LUXURY_CSS };
