import { useEffect, useRef } from 'react';

const useAutoRefresh = (
  callback,
  {
    enabled = true,
    interval = 15000,
    immediate = true,
    deps = [],
  } = {}
) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    if (immediate) {
      callbackRef.current();
    }

    const timer = window.setInterval(() => {
      callbackRef.current();
    }, interval);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, interval, immediate, ...deps]);
};

export default useAutoRefresh;
