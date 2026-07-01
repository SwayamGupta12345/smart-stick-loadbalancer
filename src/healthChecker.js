const axios = require("axios");
function resolveHealthConfig(server, globalConfig = {}) {
  return {
    path:      server.healthPath      ?? globalConfig.path      ?? "/",
    method:    server.healthMethod    ?? globalConfig.method    ?? "GET",
    algorithm: server.healthAlgorithm ?? globalConfig.algorithm ?? "http-status",
    timeout:   server.healthTimeout   ?? globalConfig.timeout   ?? 2000,
    headers:   server.healthHeaders   ?? globalConfig.headers   ?? {},
    check:     server.healthCheck     ?? globalConfig.check     ?? null,
  };
}

async function checkHealth(server, globalConfig = {}) {
  const cfg = resolveHealthConfig(server, globalConfig);
  const url = server.url.replace(/\/$/, "") + cfg.path;

  // Custom function — per-backend or global
  if (typeof cfg.check === "function") {
    try {
      const result = await cfg.check(server);
      return Boolean(result);
    } catch {
      return false;
    }
  }

  try {
    const response = await axios.request({
      method: cfg.method,
      url,
      timeout: cfg.timeout,
      headers: cfg.headers,
      // Never throw on status — we inspect it ourselves
      validateStatus: () => true,
    });

    if (cfg.algorithm === "http") {
      // Any response at all = healthy
      return true;
    }

    // "http-status" — only 2xx
    return response.status >= 200 && response.status < 300;
  } catch {
    // Network error, timeout, DNS failure — always unhealthy
    return false;
  }
}

function startHealthChecker(servers, globalConfig, onDown, onUp) {
  const lastStatus = new Map();
  const interval = globalConfig?.interval || 10000;

  setInterval(async () => {
    for (const server of servers) {
      try {
        const isUp = await checkHealth(server, globalConfig);
        const wasUp = lastStatus.get(server.url) ?? true;
        server.healthy = isUp;
        server.lastChecked = new Date().toISOString();

        if (!isUp && wasUp && onDown) onDown(server);
        if (isUp && !wasUp && onUp) onUp(server);

        lastStatus.set(server.url, isUp);
      } catch (err) {
        // Safety net — a bug in checkHealth should never kill the interval
        console.error(
          `[smart-stick-loadbalancer] Health check error for ${server.url}:`,
          err.message
        );
      }
    }
  }, interval);
}

module.exports = { checkHealth, startHealthChecker, resolveHealthConfig };