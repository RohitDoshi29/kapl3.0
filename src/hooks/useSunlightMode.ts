import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'kapl-sunlight-mode';

export function useSunlightMode() {
  const [isSunlightMode, setIsSunlightMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isSunlightMode) {
      root.classList.add('sunlight-mode');
    } else {
      root.classList.remove('sunlight-mode');
    }
    localStorage.setItem(STORAGE_KEY, isSunlightMode ? 'true' : 'false');
  }, [isSunlightMode]);

  const toggleSunlightMode = useCallback(() => {
    setIsSunlightMode(prev => !prev);
  }, []);

  return {
    isSunlightMode,
    toggleSunlightMode,
  };
}

