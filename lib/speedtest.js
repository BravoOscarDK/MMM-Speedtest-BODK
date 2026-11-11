"use strict";
const { execFile } = require("node:child_process");

function validate(config) {
  const c = { updateInterval: 3600000, testTimeout: 120000, historyLength: 24,
    speedtestPath: "speedtest", serverId: "", ...config };
  for (const [key, min, max] of [["updateInterval", 60000, 2147483647],
    ["testTimeout", 1000, 600000], ["historyLength", 1, 168]]) {
    if (!Number.isInteger(c[key]) || c[key] < min || c[key] > max) throw new Error(`Invalid ${key}`);
  }
  if (typeof c.speedtestPath !== "string" || !c.speedtestPath.trim()) throw new Error("Invalid speedtestPath");
  if (c.serverId !== "" && !/^\d+$/.test(String(c.serverId))) throw new Error("Invalid serverId");
  return c;
}

function parseResult(raw) {
  const r = JSON.parse(raw);
  const values = [r.download?.bandwidth, r.upload?.bandwidth, r.ping?.latency];
  if (r.type !== "result" || values.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0) ||
      typeof r.server?.name !== "string") throw new Error("Invalid Speedtest result");
  return { timestamp: Date.now(), download: values[0] * 8 / 1e6,
    upload: values[1] * 8 / 1e6, ping: values[2],
    server: { name: r.server.name, location: String(r.server.location || ""), id: String(r.server.id ?? "") } };
}

function run(config, callback, execute = execFile) {
  const args = ["--format=json", "--progress=no"];
  if (config.serverId !== "") args.push(`--server-id=${config.serverId}`);
  return execute(config.speedtestPath, args, { timeout: config.testTimeout,
    maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout) => {
    if (error) return callback(new Error(error.code === "ENOENT"
      ? "Ookla Speedtest CLI not found; install it or configure speedtestPath."
      : "Speedtest failed or timed out; check connectivity and accept the CLI terms manually."));
    try { callback(null, parseResult(stdout)); } catch (err) { callback(err); }
  });
}

// One test at a time across instances to prevent competing bandwidth measurements.
class Scheduler {
  constructor(send, runner = run) { this.send = send; this.runner = runner; this.sessions = new Map(); this.active = null; }
  configure(id, config) {
    const c = validate(config);
    this.remove(id);
    const s = { id, config: c, history: [], due: Date.now(), timer: null };
    this.sessions.set(id, s); this.pump();
  }
  publish(s, status) { this.send({ id: s.id, status, history: s.history, nextRun: s.due }); }
  pump() {
    if (this.active) return;
    const s = [...this.sessions.values()].find(item => item.due <= Date.now());
    if (!s) return;
    clearTimeout(s.timer);
    this.active = s; this.publish(s, "running");
    s.child = this.runner(s.config, (error, result) => {
      if (this.active !== s) return;
      this.active = null;
      if (this.sessions.get(s.id) === s) {
        if (!error) s.history = [...s.history, result].slice(-s.config.historyLength);
        s.due = Date.now() + s.config.updateInterval;
        this.publish(s, error ? "error" : "ready");
        if (error) console.error(`[MMM-Speedtest-BODK] ${error.message}`);
        s.timer = setTimeout(() => this.pump(), s.config.updateInterval);
      }
      this.pump();
    });
  }
  remove(id) {
    const s = this.sessions.get(id);
    if (!s) return;
    clearTimeout(s.timer); this.sessions.delete(id);
    // Keep the process lock until the cancelled child actually exits.
    if (this.active === s) s.child?.kill();
  }
  stop() { for (const id of this.sessions.keys()) this.remove(id); }
}
module.exports = { validate, parseResult, run, Scheduler };
