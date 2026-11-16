'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem('carrybee-theme');
    // Dark is the default; honor an explicit saved light-mode choice.
    const initialDark = saved !== 'light';
    setDark(initialDark);
    document.documentElement.dataset.theme = initialDark ? 'dark' : 'light';
  }, []);

  function handleChange(checked: boolean) {
    setDark(checked);
    const theme = checked ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('carrybee-theme', theme);
  }

  return (
    <div className="theme-toggle-wrap">
      <span className="theme-toggle-label" aria-hidden="true">Dark</span>
      <label className="theme-switch" title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
        <input
          className="theme-switch-input"
          type="checkbox"
          checked={dark}
          onChange={(event) => handleChange(event.target.checked)}
          aria-label="Toggle dark mode"
        />
        <span className="theme-switch-track" aria-hidden="true">
          <span className="theme-switch-orb">
            <svg className="theme-moon-dot moon-dot-one" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
            <svg className="theme-moon-dot moon-dot-two" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
            <svg className="theme-moon-dot moon-dot-three" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
            <svg className="theme-light-ray ray-one" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
            <svg className="theme-light-ray ray-two" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          </span>
          <span className="theme-switch-stars" aria-hidden="true">
            <svg className="theme-star star-one" viewBox="0 0 20 20"><path d="M10 0 12.2 7.8 20 10l-7.8 2.2L10 20l-2.2-7.8L0 10l7.8-2.2z" /></svg>
            <svg className="theme-star star-two" viewBox="0 0 20 20"><path d="M10 0 12.2 7.8 20 10l-7.8 2.2L10 20l-2.2-7.8L0 10l7.8-2.2z" /></svg>
            <svg className="theme-star star-three" viewBox="0 0 20 20"><path d="M10 0 12.2 7.8 20 10l-7.8 2.2L10 20l-2.2-7.8L0 10l7.8-2.2z" /></svg>
          </span>
          <span className="theme-switch-clouds" aria-hidden="true"><i /><i /><i /></span>
        </span>
      </label>
    </div>
  );
}
