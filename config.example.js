// Add this entry to the modules array in MagicMirror/config/config.js.
{
  module: "MMM-Speedtest-BODK",
  position: "top_right",
  header: "Internet speed",
  config: {
    language: "en",
    updateInterval: 60 * 60 * 1000,
    historyLength: 24,
    showValues: true,
    showGraph: true,
    showPing: true,
    showServer: true,
    showLastUpdate: true,
    showNextTest: true,
    serverId: "",
    speedtestPath: "speedtest",
    testTimeout: 120000,
    width: "360px",
    animationSpeed: 300
  }
}
