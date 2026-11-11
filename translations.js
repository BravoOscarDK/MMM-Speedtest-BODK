/* global module */
const SpeedtestBodkTexts = {
  en: { download: "Download", upload: "Upload", ping: "Ping", server: "Server", updated: "Last test",
    next: "Next test", waiting: "Waiting for a test…", running: "Testing connection…", error: "Test failed — see server log",
    invalid: "Invalid configuration — see server log", history: "Recent measurements", oldest: "Oldest", newest: "Newest" },
  da: { download: "Download", upload: "Upload", ping: "Ping", server: "Server", updated: "Seneste test",
    next: "Næste test", waiting: "Venter på en måling…", running: "Tester forbindelsen…", error: "Test mislykkedes — se serverlog",
    invalid: "Ugyldig konfiguration — se serverlog", history: "Seneste målinger", oldest: "Ældste", newest: "Nyeste" }
};
if (typeof module !== "undefined") module.exports = SpeedtestBodkTexts;
