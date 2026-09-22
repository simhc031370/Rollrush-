import { MarbleRace } from "./game.js";
import { Renderer, screenToWorld } from "./render.js";
import { MAPS } from "./maps.js";
import { t } from "./i18n.js";
import {
  parseRoster,
  expandMarbles,
  formatRoster,
  shuffle,
  cryptoRandom,
  filterExcluded,
} from "./names.js";
import {
  loadSettings,
  saveSettings,
  loadNames,
  saveNames,
  loadExcluded,
  saveExcluded,
  loadHistory,
  pushHistory,
} from "./storage.js";
import { Recorder, playFanfare } from "./media.js";

const race = new MarbleRace();
const recorder = new Recorder();

const els = {};
let lang = "ko";
let excludeWinners = true;
let autoRecord = false;
let holdFast = false;
let lastTs = 0;
let renderer;
let settingsOpen = true;

function $(id) {
  return document.getElementById(id);
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(lang, node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(lang, node.dataset.i18nPlaceholder));
  });
  document.title = t(lang, "title");
  $("btnLang").textContent = t(lang, "lang");
  renderMaps();
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1400);
}

function currentSettings() {
  return {
    lang,
    dark: document.documentElement.dataset.theme !== "light",
    map: $("sltMap").value,
    winnerMode: race.winnerMode,
    nth: Number($("inNth").value) || 1,
    rangeStart: Number($("inRangeStart").value) || 1,
    rangeEnd: Number($("inRangeEnd").value) || 3,
    skills: $("chkSkills").checked,
    autoRecord: $("chkRecord").checked,
    excludeWinners: $("chkExclude").checked,
    speed: Number($("sltSpeed").value) || 1,
  };
}

function persist() {
  saveSettings(currentSettings());
  saveNames($("inNames").value);
}

function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("chkDark").checked = dark;
  if (renderer) renderer.theme = dark ? "dark" : "light";
}

function renderMaps() {
  const select = $("sltMap");
  const current = select.value || race.map.id;
  select.innerHTML = "";
  MAPS.forEach((map) => {
    const opt = document.createElement("option");
    opt.value = map.id;
    opt.textContent = lang === "en" ? map.titleEn : map.titleKo;
    select.appendChild(opt);
  });
  select.value = current;
  const map = MAPS.find((m) => m.id === select.value) || MAPS[0];
  $("mapHint").textContent = lang === "en" ? map.hintEn : map.hintKo;
}

function rosterFromTextarea() {
  const excluded = loadExcluded();
  const parsed = parseRoster($("inNames").value);
  return filterExcluded(expandMarbles(parsed), excludeWinners ? excluded : []);
}

function syncMarbles() {
  const marbles = rosterFromTextarea();
  race.setMarbles(marbles);
  $("btnStart").disabled = marbles.length === 0;
  $("countBadge").textContent = String(marbles.length);
  renderExcluded();
  renderRanks();
}

function applyWinnerMode(mode, field) {
  const extra = {
    nth: Number($("inNth").value),
    rangeStart: Number($("inRangeStart").value),
    rangeEnd: Number($("inRangeEnd").value),
  };
  const range = race.setWinnerMode(mode, extra);
  if (mode === "range" && field === "start" && range.end < range.start) {
    race.setWinnerMode(mode, { ...extra, rangeEnd: range.start + 1 });
  }
  $("inNth").value = race.nth;
  $("inRangeStart").value = race.rangeStart;
  $("inRangeEnd").value = race.rangeEnd;
  document.querySelectorAll("[data-winner]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.winner === mode);
  });
  $("inNth").classList.toggle("active", mode === "nth");
  $("rangeRow").classList.toggle("hidden", mode !== "range");
  persist();
}

function renderRanks() {
  const box = $("rankList");
  const rows = race.finished.map((marble, i) => {
    const win = race.winners.includes(marble);
    return `<li class="${win ? "winner" : ""}"><span class="rank-n">${i + 1}</span><i style="background:${marble.fill}"></i>${escapeHtml(marble.name)}</li>`;
  });
  const waiting = race.marbles.filter((m) => m.racing || (race.status !== "finished" && !race.finished.includes(m)));
  waiting
    .sort((a, b) => b.y - a.y)
    .forEach((marble) => {
      rows.push(`<li class="pending"><span class="rank-n">–</span><i style="background:${marble.fill}"></i>${escapeHtml(marble.name)}</li>`);
    });
  box.innerHTML = rows.join("") || `<li class="empty">${t(lang, "readyNeed")}</li>`;
}

function renderExcluded() {
  const list = loadExcluded();
  const wrap = $("excludedList");
  if (!list.length) {
    wrap.innerHTML = `<p class="muted">${t(lang, "excluded")} 0</p>`;
    return;
  }
  wrap.innerHTML = list
    .map(
      (name) =>
        `<button class="chip" data-restore="${escapeHtml(name)}">${escapeHtml(name)} ×</button>`,
    )
    .join("");
}

function renderHistory() {
  const list = loadHistory();
  $("historyList").innerHTML = list
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.winners.join(", "))}</strong><span>${new Date(item.at).toLocaleString()}</span></li>`,
    )
    .join("") || `<li class="muted">–</li>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showWinner() {
  const names = race.winners.map((m) => m.name);
  $("winnerNames").textContent = names.join(" · ") || "–";
  $("winnerModal").classList.add("show");
  playFanfare();
  if (excludeWinners && names.length) {
    const excluded = new Set(loadExcluded());
    names.forEach((name) => excluded.add(name));
    saveExcluded([...excluded]);
    const kept = parseRoster($("inNames").value).filter((entry) => !names.includes(entry.name));
    $("inNames").value = formatRoster(kept);
    saveNames($("inNames").value);
  }
  pushHistory({
    winners: names,
    ranks: race.finished.map((m) => m.name),
    map: race.map.id,
    at: Date.now(),
  });
  renderHistory();
  renderExcluded();
  if (autoRecord) recorder.stop();
  $("recBadge").classList.add("hidden");
}

function copyResults() {
  const lines = race.finished.map((m, i) => `${i + 1}. ${m.name}`).join("\n");
  const text = `${t(lang, "winnerTitle")} ${race.winners.map((m) => m.name).join(", ")}\n${lines}`;
  navigator.clipboard?.writeText(text).then(() => toast(t(lang, "copied")));
}

function loop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  race.speed = holdFast ? Number($("sltSpeed").value) * 3 : Number($("sltSpeed").value);
  race.step(dt);
  renderer.draw(race, dt);
  if (race.status === "running") renderRanks();
  requestAnimationFrame(loop);
}

function restoreName(name) {
  const excluded = loadExcluded().filter((item) => item !== name);
  saveExcluded(excluded);
  const roster = parseRoster($("inNames").value);
  roster.push({ name, weight: 1, count: 1 });
  $("inNames").value = formatRoster(roster);
  saveNames($("inNames").value);
  syncMarbles();
  toast(t(lang, "restored"));
}

function bind() {
  $("inNames").addEventListener("input", () => {
    persist();
    if (race.status !== "running") syncMarbles();
  });
  $("inNames").addEventListener("blur", () => {
    $("inNames").value = formatRoster(parseRoster($("inNames").value));
    persist();
    if (race.status !== "running") syncMarbles();
  });
  $("btnShuffle").addEventListener("click", () => {
    const expanded = shuffle(rosterFromTextarea(), cryptoRandom);
    race.setMarbles(expanded);
    $("countBadge").textContent = String(expanded.length);
    toast(t(lang, "shuffle"));
  });
  $("btnStart").addEventListener("click", () => {
    if (race.status === "running") return;
    if (race.status === "finished") syncMarbles();
    if (!race.getCount()) return toast(t(lang, "readyNeed"));
    $("winnerModal").classList.remove("show");
    $("settingsPanel").classList.add("away");
    if (autoRecord && recorder.start($("stage"))) $("recBadge").classList.remove("hidden");
    race.start();
  });
  $("btnShuffleBoard").addEventListener("click", () => $("btnShuffle").click());
  $("btnToggleSettings").addEventListener("click", () => {
    settingsOpen = !settingsOpen;
    $("settingsPanel").classList.toggle("collapsed", !settingsOpen);
  });
  $("sltMap").addEventListener("change", () => {
    race.setMap($("sltMap").value);
    renderMaps();
    syncMarbles();
    persist();
  });
  document.querySelectorAll("[data-winner]").forEach((btn) => {
    btn.addEventListener("click", () => applyWinnerMode(btn.dataset.winner));
  });
  $("inNth").addEventListener("change", () => applyWinnerMode("nth"));
  $("inRangeStart").addEventListener("change", () => applyWinnerMode("range", "start"));
  $("inRangeEnd").addEventListener("change", () => applyWinnerMode("range", "end"));
  $("chkSkills").addEventListener("change", (e) => {
    race.useSkills = e.target.checked;
    persist();
  });
  $("chkRecord").addEventListener("change", (e) => {
    autoRecord = e.target.checked;
    persist();
  });
  $("chkDark").addEventListener("change", (e) => {
    applyTheme(e.target.checked);
    persist();
  });
  $("chkExclude").addEventListener("change", (e) => {
    excludeWinners = e.target.checked;
    persist();
    if (race.status !== "running") syncMarbles();
  });
  $("sltSpeed").addEventListener("change", persist);
  $("btnLang").addEventListener("click", () => {
    lang = lang === "ko" ? "en" : "ko";
    applyI18n();
    persist();
  });
  $("btnFullscreen").addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });
  $("btnHelp").addEventListener("click", () => $("helpModal").classList.add("show"));
  $("closeHelp").addEventListener("click", () => $("helpModal").classList.remove("show"));
  $("closeWinner").addEventListener("click", () => {
    $("winnerModal").classList.remove("show");
    $("settingsPanel").classList.remove("away");
    syncMarbles();
  });
  $("btnCopy").addEventListener("click", copyResults);
  $("btnRestoreAll").addEventListener("click", () => {
    const excluded = loadExcluded();
    const roster = parseRoster($("inNames").value);
    excluded.forEach((name) => roster.push({ name, weight: 1, count: 1 }));
    saveExcluded([]);
    $("inNames").value = formatRoster(roster);
    persist();
    syncMarbles();
  });
  $("excludedList").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-restore]");
    if (btn) restoreName(btn.dataset.restore);
  });

  const canvas = $("stage");
  canvas.addEventListener("pointerdown", (event) => {
    holdFast = true;
    canvas.setPointerCapture(event.pointerId);
    const world = screenToWorld(canvas, race.camera, event.clientX, event.clientY);
    if (event.shiftKey) race.bump(world.x, world.y);
  });
  const releaseFast = () => {
    holdFast = false;
  };
  canvas.addEventListener("pointerup", releaseFast);
  canvas.addEventListener("pointercancel", releaseFast);
  canvas.addEventListener("pointerleave", releaseFast);

  window.addEventListener("keydown", (event) => {
    if (event.target.matches("textarea, input")) return;
    if (event.code === "Space") {
      event.preventDefault();
      $("btnStart").click();
    }
    if (event.key.toLowerCase() === "s") $("btnShuffle").click();
    if (event.key.toLowerCase() === "f") $("btnFullscreen").click();
  });

  race.on("goal", showWinner);
  race.on("rank", (detail) => {
    const rect = $("stage").getBoundingClientRect();
    renderer.burst(rect.width * 0.5, rect.height * 0.72, detail.marble.fill);
    renderRanks();
  });
  race.on("message", toast);
}

function boot() {
  Object.assign(els, {
    names: $("inNames"),
  });
  renderer = new Renderer($("stage"));
  renderer.resize();
  window.addEventListener("resize", () => renderer.resize());

  const saved = loadSettings();
  lang = saved.lang === "en" ? "en" : "ko";
  applyTheme(saved.dark !== false);
  $("chkSkills").checked = saved.skills !== false;
  $("chkRecord").checked = !!saved.autoRecord;
  $("chkExclude").checked = saved.excludeWinners !== false;
  $("sltSpeed").value = String(saved.speed || 1);
  $("inNth").value = saved.nth || 1;
  $("inRangeStart").value = saved.rangeStart || 1;
  $("inRangeEnd").value = saved.rangeEnd || 3;
  race.useSkills = $("chkSkills").checked;
  autoRecord = $("chkRecord").checked;
  excludeWinners = $("chkExclude").checked;

  applyI18n();
  if (saved.map) $("sltMap").value = saved.map;
  renderMaps();
  race.setMap($("sltMap").value);

  const savedNames = loadNames();
  $("inNames").value = savedNames || $("inNames").value;
  applyWinnerMode(saved.winnerMode || "first");
  bind();
  syncMarbles();
  renderHistory();
  requestAnimationFrame(loop);
}

document.addEventListener("DOMContentLoaded", boot);
