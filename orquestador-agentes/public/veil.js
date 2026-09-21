// Módulo que aplica un fondo translúcido al panel de una app de macOS usando WKWebView.
// El desenfoque lo pone la ventana con el vibrancy de macOS; aquí se calcula cuánto lo tapa
// cada superficie. Los niveles se guardan en localStorage y cada cambio emite un evento.
(function () {
  const KEY_ON = "veil.on";
  const KEY_LEVELS = "veil.levels";
  const KEY_LEGACY = "veil.level";
  const MIN = 0;
  const MAX = 1;

  const GROUPS = [
    {
      id: "bg",
      label: "Fondo",
      def: 0.3,
      surfaces: [
        ["--bg", "#0a0a0a", 1],
        ["--sunken", "#0d0d0d", 1.12],
        ["--rail", "#111111", 1.08],
      ],
    },
    {
      id: "panel",
      label: "Paneles",
      def: 0.55,
      surfaces: [
        ["--panel", "#171717", 1],
        ["--panel-active", "#1f1f1f", 1.02],
        ["--panel-2", "#222222", 1.05],
        ["--panel-3", "#2e2e2e", 1.1],
      ],
    },
    {
      id: "code",
      label: "Código",
      def: 0.3,
      surfaces: [["--editor-bg", "#0d0d0d", 1]],
    },
  ];

  const root = document.documentElement;
  const supported = (navigator.userAgent || "").includes("SingularityApp");

  function readStore(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      return;
    }
  }

  function clampLevel(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(MAX, Math.max(MIN, value));
  }

  function alphaHex(alpha) {
    return Math.round(Math.min(1, Math.max(0, alpha)) * 255)
      .toString(16)
      .padStart(2, "0");
  }

  function defaultLevels() {
    const out = {};
    GROUPS.forEach((g) => (out[g.id] = g.def));
    return out;
  }

  // El slider único de antes se reparte entre los tres: el fondo y el código heredan
  // su valor y los paneles el que ya tenían de hecho, que era el nivel por su factor 1.3.
  function migrated() {
    const legacy = parseFloat(readStore(KEY_LEGACY));
    if (!Number.isFinite(legacy)) return null;
    return {
      bg: clampLevel(legacy, GROUPS[0].def),
      panel: clampLevel(legacy * 1.3, GROUPS[1].def),
      code: clampLevel(legacy, GROUPS[2].def),
    };
  }

  // Lee los niveles guardados en el almacenamiento local, aplicando migración si es necesario y
  // clamping los valores entre el mínimo y máximo definidos por grupo
  function readLevels() {
    const base = defaultLevels();
    let stored = null;
    try {
      stored = JSON.parse(readStore(KEY_LEVELS) || "null");
    } catch {
      stored = null;
    }
    if (!stored || typeof stored !== "object") stored = migrated();
    if (!stored || typeof stored !== "object") return base;
    GROUPS.forEach((g) => {
      base[g.id] = clampLevel(parseFloat(stored[g.id]), g.def);
    });
    return base;
  }

  let on = supported && readStore(KEY_ON) !== "0";
  let levels = readLevels();

  // El alfa entra en las mismas variables de :root y no en una paleta aparte: Monaco solo
  // acepta hex en su tema y xterm lee esas mismas variables.
  function apply() {
    if (!supported || !on) {
      root.removeAttribute("data-veil");
      GROUPS.forEach((g) => g.surfaces.forEach(([name]) => root.style.removeProperty(name)));
      return;
    }
    root.setAttribute("data-veil", "");
    GROUPS.forEach((g) =>
      g.surfaces.forEach(([name, base, factor]) => {
        root.style.setProperty(name, base + alphaHex(levels[g.id] * factor));
      })
    );
  }

  window.Veil = {
    MIN,
    MAX,
    supported,
    groups: GROUPS.map(({ id, label, def }) => ({ id, label, def })),
    enabled: () => supported && on,
    levels: () => ({ ...levels }),
    level: (id) => levels[id],
    set(next) {
      if (typeof next.on === "boolean") {
        on = next.on;
        writeStore(KEY_ON, on ? "1" : "0");
      }
      if (next.levels && typeof next.levels === "object") {
        GROUPS.forEach((g) => {
          if (next.levels[g.id] === undefined) return;
          levels[g.id] = clampLevel(parseFloat(next.levels[g.id]), g.def);
        });
        writeStore(KEY_LEVELS, JSON.stringify(levels));
      }
      apply();
      document.dispatchEvent(new CustomEvent("veil:change"));
    },
  };

  apply();
})();
