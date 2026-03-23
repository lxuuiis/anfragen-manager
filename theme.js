// ── Dark Mode ──────────────────────────────────────────────────
(function() {
  const stored = localStorage.getItem('am_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
})();

function initDarkModeToggle() {
  const btn = document.getElementById('dmToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('am_theme', next);
  });
}
document.addEventListener('DOMContentLoaded', initDarkModeToggle);
