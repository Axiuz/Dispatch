// ============ Panel de Extensiones ============
// Busca en Open VSX, instala, activa o quita una extensión, y aplica su tema de
// color y sus iconos de archivo al editor. De un .vsix solo se usa lo
// declarativo: nada de su código se ejecuta, porque no hay extension host.
const EdExtensions = (() => {
  const $ = (s) => document.querySelector(s);

  let state = { extensions: [], theme: null, iconTheme: null };
  let icons = null;
  let iconsFor = null;
  let query = "";
  let found = null;
  let busy = null;
  let searchTimer = null;
  let loaded = false;

  const fileUrl = (id, rel) => `/api/extensions/file?id=${encodeURIComponent(id)}&p=${encodeURIComponent(rel)}`;
  const img = (src) => `<img src="${src}" alt="" loading="lazy" />`;

  async function api(url, body, method) {
    const res = await fetch(url, {
      method: method || (body ? "POST" : "GET"),
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function init() {
    if (loaded) return state;
    loaded = true;
    await refresh({ silent: true });
    return state;
  }

  async function refresh({ silent = false } = {}) {
    try {
      state = await api("/api/extensions");
    } catch (_) {
      return;
    }
    await Promise.all([loadIcons(), applyTheme()]);
    if (!silent) render();
    CodeEditor.refreshIcons?.();
  }

  // ---- Iconos de archivo ----
  async function loadIcons() {
    const active = state.iconTheme;
    if (!active) {
      icons = null;
      iconsFor = null;
      return;
    }
    if (iconsFor === `${active.id}::${active.key}`) return;
    try {
      const data = await api(`/api/extensions/icons?id=${encodeURIComponent(active.id)}&key=${encodeURIComponent(active.key || "")}`);
      icons = { id: active.id, ...data.icons };
      iconsFor = `${active.id}::${active.key}`;
    } catch (_) {
      icons = null;
      iconsFor = null;
    }
  }

  // Igual que VS Code: primero el nombre entero, después las extensiones de más
  // larga a más corta ("component.spec.ts" antes que "ts"), y si nada casa, el
  // icono genérico del tema.
  function fileIcon(name) {
    if (!icons) return null;
    const lower = String(name).toLowerCase();
    const byName = icons.byName[lower];
    if (byName) return img(fileUrl(icons.id, byName));

    const parts = lower.split(".");
    for (let i = 1; i < parts.length; i++) {
      const ext = parts.slice(i).join(".");
      if (icons.byExt[ext]) return img(fileUrl(icons.id, icons.byExt[ext]));
    }
    return icons.file ? img(fileUrl(icons.id, icons.file)) : null;
  }

  function folderIcon(open) {
    if (!icons) return null;
    const rel = open ? icons.folderExpanded : icons.folder;
    return rel ? img(fileUrl(icons.id, rel)) : null;
  }

  // ---- Tema de color ----
  async function applyTheme() {
    const active = state.theme;
    if (!active) return CodeEditor.applyTheme?.(null);
    try {
      const data = await api(`/api/extensions/theme?id=${encodeURIComponent(active.id)}&key=${encodeURIComponent(active.key || "")}`);
      CodeEditor.applyTheme?.(data.theme);
    } catch (_) {
      CodeEditor.applyTheme?.(null);
    }
  }

  // ---- Acciones ----
  async function run(key, fn) {
    busy = key;
    render();
    try {
      await fn();
    } catch (err) {
      alert(err.message);
    }
    busy = null;
    await refresh();
  }

  const install = (id) => run(`install:${id}`, () => api("/api/extensions/install", { id }));
  const remove = (id) =>
    confirm(`¿Quitar ${id}?`) ? run(`del:${id}`, () => api("/api/extensions", { id }, "DELETE")) : null;
  const toggle = (id, enabled) => run(`toggle:${id}`, () => api("/api/extensions/toggle", { id, enabled }));
  const useTheme = (id, key) => run("theme", () => api("/api/extensions/toggle", { theme: id ? { id, key } : null }));
  const useIcons = (id, key) => run("icons", () => api("/api/extensions/toggle", { iconTheme: id ? { id, key } : null }));

  async function search() {
    clearTimeout(searchTimer);
    const q = query.trim();
    if (!q) {
      found = null;
      return render();
    }
    try {
      const data = await api(`/api/extensions/search?q=${encodeURIComponent(q)}`);
      found = data.extensions;
    } catch (err) {
      found = { error: err.message };
    }
    render();
  }

  // ---- Panel ----
  function render() {
    const host = $("#edExtList");
    if (!host) return;

    const active = (t) => (t ? `${t.id}::${t.key || ""}` : "");
    const themeKey = active(state.theme);
    const iconKey = active(state.iconTheme);

    const card = (ext) => {
      const picks = [
        ...ext.themes.map((t) => ({ kind: "theme", key: t.key, label: t.label })),
        ...ext.iconThemes.map((t) => ({ kind: "icons", key: t.key, label: t.label })),
      ];
      return `
      <div class="ed-ext${ext.enabled ? "" : " off"}">
        <div class="ed-ext-head">
          <span class="ed-ext-icon">${ext.icon ? img(fileUrl(ext.id, ext.icon)) : escapeHtml((ext.displayName || "?").slice(0, 2).toUpperCase())}</span>
          <span class="ed-ext-name">${escapeHtml(ext.displayName || ext.id)}</span>
          <span class="ed-ext-ver">${escapeHtml(ext.version || "")}</span>
        </div>
        <div class="ed-ext-desc">${escapeHtml(ext.description || "")}</div>
        <div class="ed-ext-pub">${escapeHtml(ext.publisher || "")}${ext.usable ? "" : " · nada que aprovechar aquí"}</div>
        <div class="ed-ext-acts">
          ${picks
            .map((p) => {
              const on = (p.kind === "theme" ? themeKey : iconKey) === `${ext.id}::${p.key}`;
              return `<button class="ed-chip${on ? " on" : ""}" data-use="${p.kind}" data-id="${escapeAttr(ext.id)}" data-key="${escapeAttr(p.key)}">${p.kind === "theme" ? "tema" : "iconos"}: ${escapeHtml(p.label)}${on ? " ✓" : ""}</button>`;
            })
            .join("")}
          <button class="ed-chip" data-toggle="${escapeAttr(ext.id)}" data-enabled="${ext.enabled ? "0" : "1"}">${ext.enabled ? "desactivar" : "activar"}</button>
          <button class="ed-chip danger" data-del="${escapeAttr(ext.id)}">quitar</button>
        </div>
      </div>`;
    };

    const result = (ext) => `
      <div class="ed-ext">
        <div class="ed-ext-head">
          <span class="ed-ext-icon">${escapeHtml((ext.displayName || "?").slice(0, 2).toUpperCase())}</span>
          <span class="ed-ext-name">${escapeHtml(ext.displayName)}</span>
          <span class="ed-ext-ver">${escapeHtml(ext.version || "")}</span>
        </div>
        <div class="ed-ext-desc">${escapeHtml(ext.description)}</div>
        <div class="ed-ext-pub">${escapeHtml(ext.publisher)} · ${Intl.NumberFormat("es").format(ext.downloads)} descargas</div>
        <div class="ed-ext-acts">
          ${
            ext.installed
              ? '<span class="ed-chip on">instalada</span>'
              : `<button class="ed-chip" data-install="${escapeAttr(ext.id)}"${busy === `install:${ext.id}` ? " disabled" : ""}>${busy === `install:${ext.id}` ? "instalando…" : "instalar"}</button>`
          }
        </div>
      </div>`;

    const installed = state.extensions || [];
    host.innerHTML =
      (found
        ? found.error
          ? `<div class="ed-view-empty error-text">${escapeHtml(found.error)}</div>`
          : `<div class="ed-ext-sec">EN OPEN VSX (${found.length})</div>` +
            (found.length ? found.map(result).join("") : '<div class="ed-view-empty">Sin resultados.</div>')
        : "") +
      `<div class="ed-ext-sec">INSTALADAS (${installed.length})</div>` +
      (installed.length
        ? installed.map(card).join("")
        : '<div class="ed-view-empty">Ninguna todavía. Busca arriba: de un .vsix se usan su tema, sus iconos y sus snippets.</div>');

    host.querySelectorAll("[data-install]").forEach((b) => b.addEventListener("click", () => install(b.dataset.install)));
    host.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => remove(b.dataset.del)));
    host.querySelectorAll("[data-toggle]").forEach((b) =>
      b.addEventListener("click", () => toggle(b.dataset.toggle, b.dataset.enabled === "1"))
    );
    host.querySelectorAll("[data-use]").forEach((b) =>
      b.addEventListener("click", () => {
        const on = b.classList.contains("on");
        const apply = b.dataset.use === "theme" ? useTheme : useIcons;
        apply(on ? null : b.dataset.id, b.dataset.key);
      })
    );
  }

  function renderPanel(host) {
    host.innerHTML =
      `<div class="ed-search">
         <input id="edExtQ" class="ed-input" type="text" placeholder="Buscar en Open VSX" value="${escapeAttr(query)}" />
       </div>
       <div class="ed-ext-list" id="edExtList"></div>`;

    const box = host.querySelector("#edExtQ");
    box.addEventListener("input", () => {
      query = box.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(search, 350);
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter") search();
    });

    render();
    init().then(render);
  }

  return { init, refresh, renderPanel, fileIcon, folderIcon, applyTheme };
})();
