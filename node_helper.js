const NodeHelper = require("node_helper");
const { Scheduler } = require("./lib/speedtest");
module.exports = NodeHelper.create({
  start() { this.scheduler = new Scheduler(payload => this.sendSocketNotification("SPEEDTEST_STATE", payload)); },
  socketNotificationReceived(notification, payload) {
    if (!payload || typeof payload.id !== "string") return;
    if (notification === "SPEEDTEST_STOP") this.scheduler.remove(payload.id);
    if (notification === "SPEEDTEST_CONFIG") {
      try { this.scheduler.configure(payload.id, payload.config); }
      catch (error) {
        this.scheduler.remove(payload.id);
        console.error(`[MMM-Speedtest-BODK] ${error.message}`);
        this.sendSocketNotification("SPEEDTEST_STATE", { id: payload.id, status: "invalid", history: [] });
      }
    }
  },
  stop() { this.scheduler.stop(); }
});
