const express = require("express");
const http = require("http");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cookieParser = require("cookie-parser");
const socketIo = require("socket.io");
const { startHealthChecker } = require("./healthChecker");
const { sendDownAlert, sendUpAlert } = require("./notifier");

function createStickyProxy(options = {}) {
  if (!options.port || !options.backends) {
    throw new Error("Port and backends must be provided");
  }

  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);

  let current = 0;
  const servers = options.backends.map((b) => ({
    ...b,
    healthy: true,
    requests: 0,
    lastChecked: null,
  }));

  // Middleware
  app.use(cookieParser());

  // Health endpoint
  app.get("/_lb/health", (req, res) => {
    res.json({
      timestamp: new Date().toISOString(),
      total: servers.length,
      healthy: servers.filter((s) => s.healthy).length,
      unhealthy: servers.filter((s) => !s.healthy).length,
      backends: servers.map((s) => ({
        id: s.id,
        url: s.url,
        healthy: s.healthy,
        requests: s.requests,
        lastChecked: s.lastChecked,
      })),
    });
  });

  // Sticky selection logic
  function getHealthyBackend(req, res) {
    const healthyBackends = servers.filter((s) => s.healthy);
    if (!healthyBackends.length) return null;

    let backendId = parseInt(req.cookies["X-Backend-ID"]);
    if (!isNaN(backendId) && servers[backendId]?.healthy) {
      return servers[backendId];
    }

    const selected = healthyBackends[current % healthyBackends.length];
    current++;
    res.cookie("X-Backend-ID", selected.id, { httpOnly: true });
    return selected;
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
        onProxyRes(proxyRes, req, res) {
          res.setHeader("x-backend", backend.url);
        },
      })
    );
  });

  // Proxy handler
  app.use((req, res, next) => {
    const backend = getHealthyBackend(req, res);
    if (!backend) return res.status(503).send("All servers down.");

    backend.requests++;
    io.emit("request", { ip: req.ip, to: backend.url });
    io.emit("update", servers);

    const proxy = proxies.get(backend.id);
    proxy(req, res, next);
  });

  // Health checks with optional email alerts
  startHealthChecker(
    servers,
    options.health || { interval: 10000, timeout: 2000 },
    options.email ? (server) => { sendDownAlert(server, options.email); io.emit("update", servers); } : null,
    options.email ? (server) => { sendUpAlert(server, options.email); io.emit("update", servers); } : null
  );

  function start() {
    server.listen(options.port, () =>
      console.log(`Sticky Proxy running on port ${options.port}`)
    );
  }

  return { app, server, io, start, servers };
}

module.exports = { createStickyProxy };
