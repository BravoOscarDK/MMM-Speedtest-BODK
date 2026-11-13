const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const { validate, parseResult, run, Scheduler } = require("../lib/speedtest");
const fixture = () => JSON.stringify({ type: "result", download: { bandwidth: 12500000 }, upload: { bandwidth: 2500000 }, ping: { latency: 8.2 }, server: { id: 123, name: "Example server", location: "Example city" } });
test("converts bytes per second to Mbit/s and retains server without IP data", () => {
  const r = parseResult(fixture()); assert.equal(r.download, 100); assert.equal(r.upload, 20);
  assert.equal(r.ping, 8.2); assert.equal(r.server.name, "Example server");
  assert.throws(() => parseResult('{}')); assert.throws(() => parseResult(fixture().replace('12500000', '-1')));
});
test("validates configuration before spawning", () => {
  assert.equal(validate({}).updateInterval, 3600000);
  for (const c of [{ updateInterval: 0 }, { historyLength: 0 }, { serverId: "1;echo" }, { testTimeout: 0 }, { speedtestPath: "" }]) assert.throws(() => validate(c));
});
test("runs without shell or automatic license acceptance", () => {
  run(validate({ serverId: "123" }), (err, r) => { assert.ifError(err); assert.equal(r.download, 100); },
    (file, args, opts, callback) => {
      assert.equal(file, "speedtest"); assert.deepEqual(args, ["--format=json", "--progress=no", "--server-id=123"]);
      assert.equal(opts.timeout, 120000); callback(null, fixture());
    });
});
test("serializes instances, limits history and cancels children", () => {
  const events = [], pending = [];
  let kills = 0;
  const scheduler = new Scheduler(p => events.push(p), (c, cb) => { pending.push(cb); return { kill() { kills++; } }; });
  try {
    scheduler.configure("a", { historyLength: 1 }); scheduler.configure("b", {});
    assert.equal(pending.length, 1);
    pending.shift()(null, parseResult(fixture())); assert.equal(pending.length, 1);
    assert.equal(events.find(e => e.id === "a" && e.status === "ready").history.length, 1);
    scheduler.remove("b"); assert.equal(kills, 1);
    pending.shift()(new Error("Cancelled")); assert.equal(scheduler.active, null);
  } finally { scheduler.stop(); }
});
test("retains only the configured number of successful measurements", () => {
  let done;
  const s = new Scheduler(() => {}, (config, callback) => { done = callback; return { kill() {} }; });
  try {
    s.configure("a", { historyLength: 2 });
    for (let i = 0; i < 4; i++) {
      done(null, { ...parseResult(fixture()), ping: i });
      if (i < 3) { s.sessions.get("a").due = 0; s.pump(); }
    }
    assert.deepEqual(s.sessions.get("a").history.map(r => r.ping), [2, 3]);
  } finally { s.stop(); }
});

function frontend() {
  let definition;
  class Element {
    constructor() { this.children = []; this.style = {}; this.attributes = {}; }
    append(...items) { this.children.push(...items); }
    setAttribute(k, v) { this.attributes[k] = v; }
  }
  const context = vm.createContext({ Module: { register(name, value) { definition = value; } }, document: { createElement: () => new Element() } });
  vm.runInContext(fs.readFileSync(require.resolve("../translations"), "utf8"), context);
  vm.runInContext(fs.readFileSync(require.resolve("../MMM-Speedtest-BODK.js"), "utf8"), context);
  definition.config = { ...definition.defaults }; definition.start(); return definition;
}
test("English defaults, regional Danish and language/key fallback", () => {
  const m = frontend(); assert.equal(m.config.language, "en"); assert.equal(m.t("waiting"), "Waiting for a test…");
  m.config.language = "da-DK"; assert.equal(m.t("updated"), "Seneste test");
  m.config.language = "xx"; assert.equal(m.t("updated"), "Last test"); assert.equal(m.t("unknown"), "unknown");
});
test("renders numbers/charts independently and filters instance notifications", () => {
  const m = frontend(); m.identifier = "a"; m.updateDom = () => {};
  m.socketNotificationReceived("SPEEDTEST_STATE", { id: "b", status: "ready", history: [] }); assert.equal(m.state.status, "waiting");
  m.state = { status: "ready", history: [parseResult(fixture())] };
  const charts = root => root.children.filter(e => e.className?.startsWith("speedtest-chart"));
  assert.equal(charts(m.getDom()).length, 1);
  m.config.showGraph = false; assert.equal(charts(m.getDom()).length, 0);
  m.config.showGraph = true; m.config.showValues = false;
  const root = m.getDom(); assert.equal(charts(root).length, 1);
  assert.ok(!root.children.some(e => e.className === "speedtest-row bright speedtest-download"));
});

test("combines download and upload by measurement on a shared scale", () => {
  const m = frontend();
  const first = parseResult(fixture());
  m.state = { status: "ready", history: [first, { ...first, download: 50, upload: 200 }] };
  const root = m.getDom(), chart = root.children.find(e => e.className === "speedtest-chart");
  assert.equal(chart.children.length, 2);
  assert.deepEqual(chart.children.map(slot => slot.children.map(bar => bar.style.height)), [["50%", "10%"], ["25%", "100%"]]);
  assert.equal(chart.children[0].children[0].className, "speedtest-bar speedtest-download");
  assert.equal(chart.children[0].children[1].className, "speedtest-bar speedtest-upload");
  assert.match(chart.attributes["aria-label"], /Download:.*Upload:/);
  assert.match(chart.children[0].title, /Download:.*Upload:.*Example server/);
  m.config.language = "da-DK";
  assert.match(m.getDom().children.find(e => e.className === "speedtest-chart").children[0].title, /100,0 Mbit\/s/);
  m.state.history = [{ ...first, download: 0, upload: 0 }];
  assert.ok(m.getDom().children.find(e => e.className === "speedtest-chart").children[0].children.every(bar => bar.style.height === "0%"));
});
