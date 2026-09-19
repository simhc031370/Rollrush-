const KEYS = {
  names: "cmd_names",
  settings: "cmd_settings",
  excluded: "cmd_excluded",
  history: "cmd_history",
};

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.settings) || "{}");
  } catch {
    return {};
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function loadNames() {
  return localStorage.getItem(KEYS.names) || "";
}

export function saveNames(value) {
  localStorage.setItem(KEYS.names, value);
}

export function loadExcluded() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.excluded) || "[]");
  } catch {
    return [];
  }
}

export function saveExcluded(list) {
  localStorage.setItem(KEYS.excluded, JSON.stringify(list));
}

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.history) || "[]");
  } catch {
    return [];
  }
}

export function pushHistory(entry) {
  const history = [entry, ...loadHistory()].slice(0, 12);
  localStorage.setItem(KEYS.history, JSON.stringify(history));
  return history;
}
