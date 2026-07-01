function buildWeightedPool(healthyBackends) {
  const pool = [];
  for (const backend of healthyBackends) {
    const slots = Math.max(1, Math.round(backend.weight ?? 1));
    for (let i = 0; i < slots; i++) {
      pool.push(backend);
    }
  }
  return pool;
}

function selectBackend(strategy, healthyBackends, weightedPool, currentIndex) {
  switch (strategy) {
    case "round-robin": {
      if (!weightedPool.length) return { backend: healthyBackends[0], nextIndex: 0 };
      const backend = weightedPool[currentIndex % weightedPool.length];
      return { backend, nextIndex: (currentIndex + 1) % weightedPool.length };
    }

    case "least-connections": {
      // Pick the healthy backend with the lowest activeConnections count.
      // Ties broken by whichever appears first (effectively round-robin on ties).
      const backend = healthyBackends.reduce((best, candidate) =>
        candidate.activeConnections < best.activeConnections ? candidate : best
      );
      return { backend, nextIndex: currentIndex };
    }

    case "random": {
      // Weighted random — pick a random slot from the weighted pool.
      if (!weightedPool.length) return { backend: healthyBackends[0], nextIndex: 0 };
      const idx = Math.floor(Math.random() * weightedPool.length);
      return { backend: weightedPool[idx], nextIndex: currentIndex };
    }

    default:
      return { backend: healthyBackends[0], nextIndex: 0 };
  }
}

module.exports = { buildWeightedPool, selectBackend };