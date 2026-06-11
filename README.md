# Smart Stick Load Balancer

A lightweight sticky-session load balancer for Node.js with health checks, automatic failover, WebSocket support, and optional email alerts.

Designed for developers who want a simple load-balancing solution directly inside the Node.js ecosystem without configuring external tools like Nginx or HAProxy.

---

## Features

* Sticky sessions using cookies
* Automatic backend health checks
* Automatic failover for unhealthy servers
* WebSocket and HTTP support
* Optional email alerts
* Simple configuration
* Pure Node.js solution

---

## Installation

```bash
npm install smart-stick-loadbalancer
```

---

## Project Structure

Create your own configuration file inside your project:

```text
my-project/
├── config.json
└── index.js
```

### config.json

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
  "health": {
    "interval": 10000,
    "timeout": 2000
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

### index.js

```js
const { createStickyProxy } = require("smart-stick-loadbalancer");
const config = require("./config.json");

const lb = createStickyProxy(config);

lb.start();
```

---

## How It Works

1. Incoming requests arrive at the load balancer.
2. A backend server is selected.
3. The selected backend ID is stored in a cookie.
4. Future requests from the same client are routed to the same backend.
5. Health checks continuously monitor backend availability.
6. Unhealthy backends are removed from rotation automatically.

---

## Quick Start Demo

### Backend 1

```js
const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("Hello from Server 5000");
});

app.listen(5000, () => {
  console.log("Server 5000 running");
});
```

### Backend 2

```js
const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("Hello from Server 5001");
});

app.listen(5001, () => {
  console.log("Server 5001 running");
});
```

### Start the Load Balancer

```bash
node index.js
```

Visit:

```text
http://localhost:3001
```

The load balancer will distribute traffic between healthy backends while maintaining sticky sessions.

---

## Health Endpoint

Check backend status:

```bash
curl http://localhost:3001/_lb/health
```

### Response Example

```json
{
  "timestamp": "2025-12-28T12:00:00.000Z",
  "total": 2,
  "healthy": 2,
  "unhealthy": 0,
  "backends": [
    {
      "id": 0,
      "url": "http://localhost:5000",
      "healthy": true,
      "requests": 5
    },
    {
      "id": 1,
      "url": "http://localhost:5001",
      "healthy": true,
      "requests": 3
    }
  ]
}
```

---

## Email Alerts

Optional email notifications can be enabled through the configuration file.

Alerts are sent when:

* A backend server goes down
* A backend server comes back online

Supported through Nodemailer-compatible email services.

---

## Use Cases

* Learning how load balancers work
* Local development environments
* Internal tools
* Small Node.js deployments
* Prototyping multi-server architectures

---

## Notes

* Backend IDs should be unique.
* WebSockets are supported.
* The `weight` field is reserved for future balancing strategies.
* Health checks currently verify whether a backend responds successfully.

---

## License

MIT


## License

MIT
