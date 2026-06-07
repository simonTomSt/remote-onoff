const express = require("express");
const pigpio = require("pigpio");
const path = require("path");

const app = express();
const PORT = 3000;
const GPIO_PIN = 17;

const Gpio = pigpio.Gpio;
const relay = new Gpio(GPIO_PIN, { mode: Gpio.OUTPUT, pullUpDown: Gpio.PUD_OFF });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let isOn = false;
relay.digitalWrite(0);

let uptimeStart = null;
let totalUptimeMs = 0;

const logs = [];
const schedulerQueue = [];

function addLog(action) {
  logs.unshift({ action, time: new Date().toISOString() });
  if (logs.length > 200) logs.pop();
}

function setRelay(on) {
  if (on === isOn) return;
  if (on) {
    relay.digitalWrite(1);
    isOn = true;
    uptimeStart = Date.now();
    addLog("ON");
  } else {
    relay.digitalWrite(0);
    if (uptimeStart !== null) {
      totalUptimeMs += Date.now() - uptimeStart;
      uptimeStart = null;
    }
    isOn = false;
    addLog("OFF");
  }
}

// scheduler tick — every second check queue
setInterval(() => {
  const now = Date.now();
  for (let i = schedulerQueue.length - 1; i >= 0; i--) {
    const job = schedulerQueue[i];
    if (now >= job.at) {
      setRelay(job.action === "ON");
      addLog(`SCHEDULER: ${job.action}`);
      schedulerQueue.splice(i, 1);
    }
  }
}, 1000);

app.get("/on", (req, res) => {
  setRelay(true);
  res.json({ status: "ON" });
});

app.get("/off", (req, res) => {
  setRelay(false);
  res.json({ status: "OFF" });
});

app.get("/status", (req, res) => {
  const currentUptime = isOn && uptimeStart !== null ? totalUptimeMs + (Date.now() - uptimeStart) : totalUptimeMs;
  res.json({ status: isOn ? "ON" : "OFF", uptimeMs: currentUptime });
});

app.get("/logs", (req, res) => {
  res.json(logs);
});

app.get("/scheduler", (req, res) => {
  res.json(schedulerQueue);
});

app.post("/scheduler", (req, res) => {
  const { delayMs, action } = req.body;
  if (!delayMs || !["ON", "OFF"].includes(action)) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const job = { id: Date.now(), action, at: Date.now() + delayMs, addedAt: new Date().toISOString() };
  schedulerQueue.push(job);
  schedulerQueue.sort((a, b) => a.at - b.at);
  res.json(job);
});

app.delete("/scheduler/:id", (req, res) => {
  const id = Number(req.params.id);
  const idx = schedulerQueue.findIndex((j) => j.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  schedulerQueue.splice(idx, 1);
  res.json({ ok: true });
});

process.on("SIGINT", () => {
  relay.digitalWrite(0);
  pigpio.terminate();
  process.exit();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Relay app running on http://0.0.0.0:${PORT}`);
});
