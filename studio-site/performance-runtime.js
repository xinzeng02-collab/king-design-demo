(() => {
  const metrics = {
    longTasks: [],
    imageErrors: [],
    marks: new Map(),
  };

  function start(name) {
    metrics.marks.set(name, performance.now());
  }

  function end(name) {
    const startedAt = metrics.marks.get(name);
    if (startedAt == null) return 0;
    metrics.marks.delete(name);
    return Math.round((performance.now() - startedAt) * 10) / 10;
  }

  function idle(callback, timeout = 1200) {
    if ("requestIdleCallback" in window) {
      return window.requestIdleCallback(callback, { timeout });
    }
    return window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 32);
  }

  function cancelIdle(handle) {
    if ("cancelIdleCallback" in window) window.cancelIdleCallback(handle);
    else window.clearTimeout(handle);
  }

  if ("PerformanceObserver" in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          metrics.longTasks.push({
            name: entry.name,
            startTime: Math.round(entry.startTime),
            duration: Math.round(entry.duration),
          });
        });
        if (metrics.longTasks.length > 50) metrics.longTasks.splice(0, metrics.longTasks.length - 50);
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {}
  }

  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    metrics.imageErrors.push({ src: image.currentSrc || image.src, at: Date.now() });
    if (metrics.imageErrors.length > 30) metrics.imageErrors.shift();
    image.closest("[data-image-shell]")?.classList.add("image-load-error");
  }, true);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") metrics.marks.clear();
  });
  window.addEventListener("pagehide", () => window.KingBlobStore?.releaseAll());

  window.KingPerformance = {
    start,
    end,
    idle,
    cancelIdle,
    snapshot: () => ({
      longTasks: [...metrics.longTasks],
      imageErrors: [...metrics.imageErrors],
      memory: performance.memory
        ? {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
          }
        : null,
    }),
  };
})();
