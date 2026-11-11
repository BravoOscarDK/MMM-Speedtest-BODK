/* global Module, SpeedtestBodkTexts */
Module.register("MMM-Speedtest-BODK", {
  defaults: {
    language: "en", updateInterval: 3600000, testTimeout: 120000,
    speedtestPath: "speedtest", serverId: "", historyLength: 24,
    showValues: true, showGraph: true, showPing: true, showServer: true,
    showLastUpdate: true, showNextTest: true, width: "360px", animationSpeed: 300
  },
  getStyles() { return ["MMM-Speedtest-BODK.css"]; },
  getScripts() { return ["translations.js"]; },
  start() { this.state = { status: "waiting", history: [] }; },
  notificationReceived(name) { if (name === "DOM_OBJECTS_CREATED") this.configure(); },
  configure() {
    const { updateInterval, testTimeout, speedtestPath, serverId, historyLength } = this.config;
    this.sendSocketNotification("SPEEDTEST_CONFIG", { id: this.identifier,
      config: { updateInterval, testTimeout, speedtestPath, serverId, historyLength } });
  },
  suspend() { this.sendSocketNotification("SPEEDTEST_STOP", { id: this.identifier }); },
  resume() { this.configure(); },
  socketNotificationReceived(name, payload) {
    if (name !== "SPEEDTEST_STATE" || payload.id !== this.identifier) return;
    this.state = payload; this.updateDom(this.config.animationSpeed);
  },
  locale() { return String(this.config.language || "en").toLowerCase().split(/[-_]/)[0] === "da" ? "da" : "en"; },
  t(key) { return SpeedtestBodkTexts[this.locale()][key] ?? SpeedtestBodkTexts.en[key] ?? key; },
  number(value) { return value.toLocaleString(this.locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }); },
  date(value) { return new Date(value).toLocaleString(this.locale(), { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); },
  getDom() {
    const root = document.createElement("div"); root.className = "speedtest-bodk"; root.style.width = this.config.width;
    const add = (label, value, className = "") => {
      const row = document.createElement("div"); row.className = `speedtest-row ${className}`;
      const a = document.createElement("span"), b = document.createElement("span");
      a.textContent = label; b.textContent = value; row.append(a, b); root.append(row); return row;
    };
    const history = this.state.history, last = history.at(-1);
    if (this.state.status !== "ready") add("", this.t(this.state.status), "dimmed small");
    if (!last) return root;
    if (this.config.showValues) for (const key of ["download", "upload"]) add(this.t(key), `${this.number(last[key])} Mbit/s`, `bright speedtest-${key}`);
    if (this.config.showPing) add(this.t("ping"), `${this.number(last.ping)} ms`);
    if (this.config.showServer) add(this.t("server"), [last.server.name, last.server.location].filter(Boolean).join(" · "), "small");
    if (this.config.showGraph) {
      add(this.t("history"), String(history.length), "small dimmed");
      for (const key of ["download", "upload"]) {
        const max = Math.max(1, ...history.map(item => item[key]));
        add(this.t(key), `0–${this.number(max)} Mbit/s`, "small");
        const chart = document.createElement("div"); chart.className = `speedtest-chart speedtest-${key}`;
        chart.setAttribute("role", "img"); chart.setAttribute("aria-label", `${this.t(key)}: ${history.map(item => this.number(item[key])).join(", ")} Mbit/s`);
        for (const item of history) {
          const slot = document.createElement("div"); slot.className = "speedtest-slot";
          const bar = document.createElement("div"); bar.className = "speedtest-bar"; bar.style.height = `${item[key] / max * 100}%`;
          slot.title = `${this.date(item.timestamp)} · ${this.number(item[key])} Mbit/s · ${item.server.name}`;
          slot.append(bar); chart.append(slot);
        }
        root.append(chart);
      }
      add(this.t("oldest"), this.t("newest"), "small dimmed");
    }
    if (this.config.showLastUpdate) add(this.t("updated"), this.date(last.timestamp), "small dimmed");
    if (this.config.showNextTest && this.state.status !== "running" && this.state.nextRun) add(this.t("next"), this.date(this.state.nextRun), "small dimmed");
    return root;
  }
});
