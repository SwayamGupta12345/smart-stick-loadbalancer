const nodemailer = require("nodemailer");

function createTransport(emailConfig) {
  if (!emailConfig) return null;
  return nodemailer.createTransport({
    service: emailConfig.service,
    auth: emailConfig.auth,
  });
}

function sendDownAlert(server, emailConfig) {
  const transporter = createTransport(emailConfig);
  if (!transporter) return;
  transporter.sendMail({
    from: emailConfig.auth.user,
    to: server.owner,
    subject: "⚠️ Backend Down",
    text: `Your backend at ${server.url} is down.`,
  });
}

function sendUpAlert(server, emailConfig) {
  const transporter = createTransport(emailConfig);
  if (!transporter) return;
  transporter.sendMail({
    from: emailConfig.auth.user,
    to: server.owner,
    subject: "✅ Backend Recovered",
    text: `Your backend at ${server.url} is back online.`,
  });
}

module.exports = { sendDownAlert, sendUpAlert };
