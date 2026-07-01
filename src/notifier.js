const nodemailer = require("nodemailer");

const transporterCache = new WeakMap();

function getTransporter(emailConfig) {
  if (!emailConfig) return null;
  if (transporterCache.has(emailConfig)) return transporterCache.get(emailConfig);

  const transporter = nodemailer.createTransport({
    service: emailConfig.service,
    auth: emailConfig.auth,
  });

  transporterCache.set(emailConfig, transporter);
  return transporter;
}

async function sendDownAlert(server, emailConfig) {
  const transporter = getTransporter(emailConfig);
  if (!transporter || !server.owner) return;
  try {
    await transporter.sendMail({
      from: emailConfig.auth.user,
      to: server.owner,
      subject: "⚠️ Backend Down",
      text: `Your backend at ${server.url} is down.\nTime: ${new Date().toISOString()}`,
    });
  } catch (err) {
    console.error(`[smart-stick-loadbalancer] Failed to send down alert for ${server.url}:`, err.message);
  }
}

async function sendUpAlert(server, emailConfig) {
  const transporter = getTransporter(emailConfig);
  if (!transporter || !server.owner) return;
  try {
    await transporter.sendMail({
      from: emailConfig.auth.user,
      to: server.owner,
      subject: "✅ Backend Recovered",
      text: `Your backend at ${server.url} is back online.\nTime: ${new Date().toISOString()}`,
    });
  } catch (err) {
    console.error(`[smart-stick-loadbalancer] Failed to send up alert for ${server.url}:`, err.message);
  }
}

module.exports = { sendDownAlert, sendUpAlert };