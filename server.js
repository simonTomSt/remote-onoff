const express = require("express");
const { Gpio } = require("onoff");
const path = require("path");

const app = express();
const PORT = 3000;

// active LOW — HIGH = wyłączony
const relay = new Gpio(17, "out", undefined, { activeLow: true });
relay.writeSync(0); // upewnij się że wyłączony przy starcie

app.use(express.static(path.join(__dirname, "public")));

app.get("/on", (req, res) => {
  relay.writeSync(1);
  res.json({ status: "ON" });
});

app.get("/off", (req, res) => {
  relay.writeSync(0);
  res.json({ status: "OFF" });
});

app.get("/status", (req, res) => {
  res.json({ status: relay.readSync() === 1 ? "ON" : "OFF" });
});

process.on("SIGINT", () => {
  relay.unexport();
  process.exit();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Relay app running on http://0.0.0.0:${PORT}`);
});
