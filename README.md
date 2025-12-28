# Smart Stick Load Balancer

A lightweight **sticky-session load balancer** for Node.js. It distributes requests to multiple backends, supports sticky sessions via cookies, performs health checks, and can optionally send email alerts.

---

## Features

- Sticky sessions via cookies
- Health checks with automatic failover
- Optional email alerts
- WebSocket and HTTP support
- Minimal setup

---

## Installation

```bash
npm install smart-stick-loadbalancer
```

---

## Example Configuration (`config.json`)

```json
{
  "port": 3001,
  "backends": [
    {
      "id": 0,
      "url": "http://localhost:5000",
      "owner": "example@example.com",
      "weight": 1
    },
    {
      "id": 1,
      "url": "http://localhost:5001",
      "owner": "example@example.com",
      "weight": 1
    }
  ],
  "health": { "interval": 10000, "timeout": 2000 },
  "email": {
    "service": "gmail",
    "auth": { "user": "<your-email@gmail.com>", "pass": "<your-app-password>" }
  }
}
```

---

## Usage

```js
const { createStickyProxy } = require("smart-stick-loadbalancer");
const config = require("./config.json");

const lb = createStickyProxy(config);
lb.start(); // starts the load balancer
```

- Requests to `http://localhost:3001` will be forwarded to the backends.
- Sticky sessions are automatically managed using cookies.
- Health checks run periodically and remove unhealthy backends from rotation.

---

## Quick Start Demo

Create two simple backend servers:

// server5000.js
```
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Hello from 5000'));
app.listen(5000, () => console.log('Server 5000 running'));
```

// server5001.js
```
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Hello from 5001'));
app.listen(5001, () => console.log('Server 5001 running'));
```

Start the load balancer:

```
node index.js
```

Open in browser: http://localhost:3001
Requests should alternate between the two backends (sticky sessions maintained per client).

Check health status:

```
curl http://localhost:3001/_lb/health
```

## Health Endpoint

```http
GET /_lb/health
```

Response example:

```json
{
  "timestamp": "2025-12-28T12:00:00.000Z",
  "total": 2,
  "healthy": 2,
  "unhealthy": 0,
  "backends": [
    { "id": 0, "url": "http://localhost:5000", "healthy": true, "requests": 5 },
    { "id": 1, "url": "http://localhost:5001", "healthy": true, "requests": 3 }
  ]
}
```

---

## Email Alerts

- Alerts are sent when a backend goes down or comes back up.
- Requires valid Gmail credentials (or any supported email service).

---

## License

MIT
