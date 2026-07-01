const express = require("express");
const http = require("http");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cookieParser = require("cookie-parser");
const socketIo = require("socket.io");
const { startHealthChecker, resolveHealthConfig } = require("./healthChecker");
const { sendDownAlert, sendUpAlert } = require("./notifier");
const { buildWeightedPool, selectBackend } = require("./router");

function createStickyProxy(options = {}) {
  if (!options.port) {
    throw new Error("[smart-stick-loadbalancer] 'port' is required in config.");
  }
  if (!options.backends || !Array.isArray(options.backends) || options.backends.length === 0) {
    throw new Error("[smart-stick-loadbalancer] 'backends' must be a non-empty array in config.");
  }

  const strategy = options.strategy || "round-robin";
  const validStrategies = ["round-robin", "least-connections", "random"];
  if (!validStrategies.includes(strategy)) {
    throw new Error(
      `[smart-stick-loadbalancer] Unknown strategy '${strategy}'. Valid options: ${validStrategies.join(", ")}`
    );
  }

  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);

  const servers = options.backends.map((b) => ({
    ...b,
    weight: b.weight ?? 1,
    healthy: true,
    requests: 0,
    activeConnections: 0,
    lastChecked: null,
  }));

  // Pre-build weighted pool for round-robin (rebuilt when health changes)
  let weightedPool = buildWeightedPool(servers.filter((s) => s.healthy));
  let poolIndex = 0;

  function rebuildPool() {
    weightedPool = buildWeightedPool(servers.filter((s) => s.healthy));
    poolIndex = 0;
  }

  // Middleware
  app.use(cookieParser());

  // Health endpoint
  const healthConfig = options.health || {};
  app.get("/_lb/health", (req, res) => {
    res.json({
      timestamp: new Date().toISOString(),
      strategy,
      total: servers.length,
      healthy: servers.filter((s) => s.healthy).length,
      unhealthy: servers.filter((s) => !s.healthy).length,
      backends: servers.map((s) => {
        const resolved = resolveHealthConfig(s, healthConfig);
        return {
          id: s.id,
          url: s.url,
          healthy: s.healthy,
          weight: s.weight,
          requests: s.requests,
          activeConnections: s.activeConnections,
          lastChecked: s.lastChecked,
          healthCheck: {
            path: resolved.path,
            method: resolved.method,
            algorithm: resolved.algorithm,
            timeout: resolved.timeout,
            // Don't expose headers (may contain auth tokens) or function source
            hasCustomHeaders: Object.keys(resolved.headers).length > 0,
            hasCustomFunction: typeof resolved.check === "function",
          },
        };
      }),
    });
  });

  // Sticky selection logic
  function getHealthyBackend(req, res) {
    const healthyBackends = servers.filter((s) => s.healthy);
    if (!healthyBackends.length) return null;

    // Honour sticky cookie if backend is still healthy
    const cookieId = parseInt(req.cookies["X-Backend-ID"]);
    if (!isNaN(cookieId)) {
      const sticky = servers.find((s) => s.id === cookieId && s.healthy);
      if (sticky) return sticky;
    }

    // No valid sticky — select via chosen strategy
    const result = selectBackend(strategy, healthyBackends, weightedPool, poolIndex);
    if (strategy === "round-robin") {
      poolIndex = result.nextIndex;
    }

    res.cookie("X-Backend-ID", result.backend.id, { httpOnly: true });
    return result.backend;
  }

  // Proxy instances
  const proxies = new Map();
  servers.forEach((backend) => {
    proxies.set(
      backend.id,
      createProxyMiddleware({
        target: backend.url,
        changeOrigin: true,
        ws: true,
        on: {
          proxyRes(proxyRes, req, res) {
            if (!res.headersSent) {
              res.setHeader("x-backend", backend.url);
              res.setHeader("x-backend-id", backend.id);
            }
          },
          error(err, req, res) {
            backend.activeConnections = Math.max(0, backend.activeConnections - 1);
            if (!res.headersSent) {
              res.status(502).json({ error: "Bad gateway — backend did not respond." });
            }
          },
        },
      })
    );
  });

  // Proxy handler
  app.use((req, res, next) => {
    const backend = getHealthyBackend(req, res);
    if (!backend) {
      return res.status(503).json({ error: "No healthy backends available." });
    }

    backend.requests++;
    backend.activeConnections++;

    // Decrement active connections when response finishes
    res.on("finish", () => {
      backend.activeConnections = Math.max(0, backend.activeConnections - 1);
    });

    // Emit per-request event for live dashboards — lightweight, no full server list
    io.emit("request", { ip: req.ip, to: backend.url, backendId: backend.id, strategy });

    const proxy = proxies.get(backend.id);
    proxy(req, res, next);
  });

  // Health checks — rebuild weighted pool on status change
  startHealthChecker(
    servers,
    options.health || { interval: 10000, timeout: 2000 },
    (server) => {
      rebuildPool();
      io.emit("update", servers);
      if (options.email) sendDownAlert(server, options.email);
    },
    (server) => {
      rebuildPool();
      io.emit("update", servers);
      if (options.email) sendUpAlert(server, options.email);
    }
  );

  function start() {
    server.listen(options.port, () =>
      console.log(`[smart-stick-loadbalancer] Running on port ${options.port} | strategy: ${strategy}`)
    );
  }

  return { app, server, io, start, servers };
}

module.exports = { createStickyProxy };