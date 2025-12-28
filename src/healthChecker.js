const axios = require("axios");

async function checkHealth(server, timeout = 2000) {
  try {
    await axios.get(server.url, { timeout });
    return true;
  } catch {
    return false;
  }
}

function startHealthChecker(servers, config, onDown, onUp) {
  const lastStatus = new Map();
  const interval = config?.interval || 10000;
  const timeout = config?.timeout || 2000;

  setInterval(async () => {
    for (const server of servers) {
      const isUp = await checkHealth(server, timeout);
      const wasUp = lastStatus.get(server.url) ?? true;
      server.healthy = isUp;
      server.lastChecked = new Date().toISOString();

      if (!isUp && wasUp && onDown) onDown(server);
      if (isUp && !wasUp && onUp) onUp(server);

      lastStatus.set(server.url, isUp);
    }
  }, interval);
}

module.exports = { checkHealth, startHealthChecker };
