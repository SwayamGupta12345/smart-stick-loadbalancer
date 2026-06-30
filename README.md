# Smart Stick Load Balancer

A lightweight sticky-session load balancer for Node.js with health checks, automatic failover, WebSocket support, configurable routing strategies, and optional email alerts.

Designed for developers who want a simple load-balancing solution directly inside the Node.js ecosystem — no Nginx, no HAProxy, no external configuration.

---

## Features

- Sticky sessions using cookies
- Three routing strategies: `round-robin`, `least-connections`, `random`
- Weight support — send more traffic to stronger backends
- Configurable health check path per backend
- Configurable health check algorithm (`http`, `http-status`, or your own function)
- Automatic backend health checks with configurable interval
- Automatic failover and recovery
- Active connection tracking per backend
- WebSocket and HTTP support
- Optional email alerts when backends go down or recover
- Simple JSON configuration
- Pure Node.js — no external servers required

---

## Installation

```bash
npm install smart-stick-loadbalancer
```

---

## Project Structure

Create a `config.json` and `index.js` inside your own project folder:

```text
my-project/
├── config.json   ← your configuration
└── index.js      ← your entry point
```

> ⚠️ **Never commit `config.json` to a public repository if it contains email credentials.**
> Add it to your `.gitignore`:
> ```
> config.json
> ```

---

## Configuration

### config.json

```json
{
  "port": 3001,
  "strategy": "round-robin",
  "backends": [
    {
      "id": 0,
      "url": "http://localhost:5000",
      "weight": 2,
      "healthPath": "/health",
      "healthMethod": "GET",
      "owner": "your-email@example.com"
    },
    {
      "id": 1,
      "url": "http://localhost:5001",
      "weight": 1,
      "healthPath": "/ready",
      "healthMethod": "HEAD",
      "healthTimeout": 5000,
      "owner": "your-email@example.com"
    }
  ],
  "health": {
    "interval": 10000,
    "timeout": 2000,
    "algorithm": "http-status"
  },
  "email": {
    "service": "gmail",
    "auth": {
      "user": "your-email@gmail.com",
      "pass": "your-app-password"
    }
  }
}
```

### Config fields

| Field | Required | Default | Description |
|---|---|---|---|
| `port` | Yes | — | Port the load balancer listens on |
| `strategy` | No | `"round-robin"` | Routing strategy: `"round-robin"`, `"least-connections"`, `"random"` |
| `backends` | Yes | — | Array of backend servers (minimum 1) |
| `backends[].id` | Yes | — | Unique integer ID for each backend |
| `backends[].url` | Yes | — | Full URL of the backend server |
| `backends[].weight` | No | `1` | Relative traffic weight (higher = more requests) |
| `backends[].owner` | No | — | Email to notify when this backend changes state (requires `email` config) |
| `backends[].healthPath` | No | `"/"` | Health check path — overrides global `health.path` |
| `backends[].healthMethod` | No | `"GET"` | HTTP method for health checks — overrides global `health.method` |
| `backends[].healthAlgorithm` | No | `"http-status"` | Health algorithm — overrides global `health.algorithm` |
| `backends[].healthTimeout` | No | `2000` | Timeout in ms — overrides global `health.timeout` |
| `backends[].healthHeaders` | No | `{}` | Headers sent with health check requests — overrides global `health.headers` |
| `backends[].healthCheck` | No | — | Custom check function for this backend — overrides global `health.check` (JS only) |
| `health.interval` | No | `10000` | How often to run health checks, in ms (no per-backend override) |
| `health.path` | No | `"/"` | Default health check path for all backends |
| `health.method` | No | `"GET"` | Default HTTP method for all health checks |
| `health.algorithm` | No | `"http-status"` | Default algorithm: `"http"` (any response) or `"http-status"` (2xx only) |
| `health.timeout` | No | `2000` | Default timeout in ms for health check requests |
| `health.headers` | No | `{}` | Default headers sent with all health check requests |
| `health.check` | No | — | Default custom check function for all backends (JS only) |
| `email` | No | — | Nodemailer config — omit entirely to disable email alerts |

---

## Usage

### index.js

```js
const { createStickyProxy } = require("smart-stick-loadbalancer");
const config = require("./config.json");

const lb = createStickyProxy(config);
lb.start();
```

---

## Routing Strategies

### `round-robin` (default)

Requests cycle through backends in order. Weight controls how many slots each backend gets in the rotation.

```
Backend A (weight: 2), Backend B (weight: 1)
Request order: A → A → B → A → A → B → ...
```

Good for: general use, backends with similar but not identical capacity.

### `least-connections`

Each request goes to the backend currently handling the fewest active connections.

```json
"strategy": "least-connections"
```

Good for: backends where some requests take much longer than others — file uploads, long polling, slow queries. Naturally balances load without needing weights.

### `random`

Picks a backend at random. Weight controls probability — a backend with `weight: 3` is 3x more likely to be chosen than one with `weight: 1`.

```json
"strategy": "random"
```

Good for: testing, simple distribution, situations where order doesn't matter.

---

## Health Checks

Every health check setting can be set globally under `health:` and overridden per backend. Per-backend always wins.

### Per-backend health path

By default the health checker hits `/` on each backend. Point each backend to its own endpoint:

```json
"backends": [
  { "id": 0, "url": "http://localhost:5000", "healthPath": "/health" },
  { "id": 1, "url": "http://localhost:5001", "healthPath": "/ready" },
  { "id": 2, "url": "http://localhost:5002", "healthPath": "/ping" }
]
```

Or set a global default that all backends fall back to:

```json
"health": { "path": "/health" }
```

### Per-backend HTTP method

Some health endpoints respond only to `HEAD` (faster, no body). Others need `GET`. Set per backend or globally:

```json
"backends": [
  { "id": 0, "url": "http://localhost:5000", "healthMethod": "HEAD" },
  { "id": 1, "url": "http://localhost:5001", "healthMethod": "GET" }
]
```

### Per-backend algorithm

**`"http-status"` (default)** — healthy only if the response is `2xx`. Recommended.

**`"http"`** — healthy if any response comes back at all, regardless of status code. Use this for backends that return non-2xx on their health path but are actually running.

```json
"backends": [
  { "id": 0, "url": "http://localhost:5000", "healthAlgorithm": "http-status" },
  { "id": 1, "url": "http://localhost:5001", "healthAlgorithm": "http" }
]
```

### Per-backend timeout

A slow database-heavy backend might need a longer timeout before being declared unhealthy:

```json
"backends": [
  { "id": 0, "url": "http://localhost:5000", "healthTimeout": 1000 },
  { "id": 1, "url": "http://localhost:5001", "healthTimeout": 5000 }
]
```

### Per-backend health headers

Some backends require an auth token or API key to respond to health checks:

```json
"backends": [
  {
    "id": 0,
    "url": "http://localhost:5000",
    "healthHeaders": { "X-Health-Token": "secret123" }
  }
]
```

Or set global headers for all backends:

```json
"health": {
  "headers": { "X-Internal": "true" }
}
```

### Custom check function

For full control, provide a `check` function in JS config. Receives the backend object, returns `true` (healthy) or `false` (unhealthy). Can be set globally or per backend.

**Global** — applies to all backends that don't have their own `healthCheck`:

```js
const config = {
  port: 3001,
  backends: [
    { id: 0, url: "http://localhost:5000" },
    { id: 1, url: "http://localhost:5001" }
  ],
  health: {
    interval: 10000,
    check: async (backend) => {
      const res = await fetch(`${backend.url}/health`);
      const data = await res.json();
      return data.status === "ok" && data.dbConnected === true;
    }
  }
};
```

**Per-backend** — override the global function for one specific backend:

```js
const config = {
  port: 3001,
  backends: [
    {
      id: 0,
      url: "http://localhost:5000",
      healthCheck: async (backend) => {
        // This backend needs a DB check
        const res = await fetch(`${backend.url}/health`);
        const data = await res.json();
        return data.status === "ok" && data.dbConnected === true;
      }
    },
    {
      id: 1,
      url: "http://localhost:5001",
      // No healthCheck — falls back to global health.check or built-in algorithm
    }
  ],
  health: { interval: 10000 }
};
```

> Custom check functions are only available when passing config as a JS object. They cannot be expressed in JSON.

---

## Weights

The `weight` field controls how much traffic a backend receives relative to others.

```json
"backends": [
  { "id": 0, "url": "http://localhost:5000", "weight": 3 },
  { "id": 1, "url": "http://localhost:5001", "weight": 1 }
]
```

Backend 0 receives 3x as many requests as backend 1. Useful when servers have different capacity.

Weight works with `round-robin` and `random`. For `least-connections`, traffic naturally flows to the least-busy backend without needing weights.

---

## How It Works

1. An incoming request arrives at the load balancer.
2. If the client has a sticky session cookie pointing to a healthy backend, that backend is used.
3. If no valid sticky cookie exists, a backend is selected using the configured strategy.
4. A cookie is set so future requests from the same client go to the same backend.
5. Health checks run in the background at the configured interval, hitting each backend's `healthPath`.
6. When a backend goes down, it is removed from rotation and the weighted pool is rebuilt.
7. When a backend recovers, it is added back to rotation.
8. If all backends go down, the load balancer returns `503 No healthy backends available`.

---

## Quick Start Demo

### Step 1 — Create two backend servers

```js
// server5000.js
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Hello from Server 5000"));
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.listen(5000, () => console.log("Server 5000 running"));
```

```js
// server5001.js
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Hello from Server 5001"));
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.listen(5001, () => console.log("Server 5001 running"));
```

### Step 2 — Start the backends

```bash
node server5000.js
node server5001.js
```

### Step 3 — Start the load balancer

```bash
node index.js
```

### Step 4 — Open in your browser

```
http://localhost:3001
```

Your session stays on the same backend. Check the `x-backend-id` response header to see which backend handled each request.

---

## Health Endpoint

Check the live status of all backends:

```bash
curl http://localhost:3001/_lb/health
```

Example response:

```json
{
  "timestamp": "2025-12-28T12:00:00.000Z",
  "strategy": "round-robin",
  "total": 2,
  "healthy": 2,
  "unhealthy": 0,
  "backends": [
    {
      "id": 0,
      "url": "http://localhost:5000",
      "healthy": true,
      "weight": 2,
      "requests": 10,
      "activeConnections": 1,
      "lastChecked": "2025-12-28T12:00:00.000Z",
      "healthCheck": {
        "path": "/health",
        "method": "GET",
        "algorithm": "http-status",
        "timeout": 2000,
        "hasCustomHeaders": false,
        "hasCustomFunction": false
      }
    },
    {
      "id": 1,
      "url": "http://localhost:5001",
      "healthy": true,
      "weight": 1,
      "requests": 5,
      "activeConnections": 0,
      "lastChecked": "2025-12-28T12:00:00.000Z",
      "healthCheck": {
        "path": "/ready",
        "method": "HEAD",
        "algorithm": "http-status",
        "timeout": 5000,
        "hasCustomHeaders": true,
        "hasCustomFunction": false
      }
    }
  ]
}
```

---

## Email Alerts

When `email` is present in the config, an alert is sent to each backend's `owner` address when it goes down or comes back online.

- Powered by [Nodemailer](https://nodemailer.com/)
- For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) rather than your account password
- Omit the `email` block entirely to disable alerts with no other changes needed

---

## Use Cases

- Learning how load balancers and routing strategies work
- Local development with multiple backend instances
- Internal tools and prototypes
- Small Node.js deployments that don't need Nginx

---

## Notes

- Backend `id` values must be unique integers.
- Sticky sessions take priority over strategy — a client always returns to their assigned backend if it is still healthy.
- WebSocket proxying is supported out of the box.
- If all backends go down, the load balancer returns `503 No healthy backends available`.
- The `custom check` function is only available when passing config as a JS object — it cannot be expressed in JSON.

---

## License

MIT