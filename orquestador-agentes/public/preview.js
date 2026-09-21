const Preview = (() => {
  const SECTION_KEY = "orq.preview.section";
  const WIDTH_KEY = "orq.preview.width";
  const PROJECT_KEY = "orq.preview.project";
  const modeKey = (dir) => `orq.preview.mode.${dir}`;
  const urlKey = (dir) => `orq.preview.url.${dir}`;

  const POLL_MS = 3000;

  let section = localStorage.getItem(SECTION_KEY) === "android" ? "android" : "web";
  let width = localStorage.getItem(WIDTH_KEY) || "full";
  let project = localStorage.getItem(PROJECT_KEY) || null;
  let mode = "server";
  let servers = [];
  let android = null;
  let androidTimer = null;
  let busy = false;

  const $ = (sel) => document.querySelector(sel);
  const visible = () => Boolean(document.querySelector("#tab-preview.active"));
  const serverFor = (dir) => servers.find((s) => s.path === dir) || null;

  async function api(url, body, method) {
    const res = await fetch(url, {
      method: method || (body ? "POST" : "GET"),
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // ---- Sección y anchos ----
  function setSection(next) {
    section = next === "android" ? "android" : "web";
    localStorage.setItem(SECTION_KEY, section);
    document.querySelectorAll("#prevSections button").forEach((b) => b.classList.toggle("active", b.dataset.section === section));
    $("#prevBar").hidden = section !== "web";
    $("#prevStage").hidden = section !== "web";
    $("#prevAndroid").hidden = section !== "android";
    if (section === "android") loadAndroid();
    renderState();
  }

  function setWidth(next) {
    width = next;
    localStorage.setItem(WIDTH_KEY, width);
    document.querySelectorAll("#prevWidth button").forEach((b) => b.classList.toggle("active", b.dataset.width === width));
    $("#prevStage").dataset.width = width;
  }

  function setMode(next) {
    mode = next === "url" ? "url" : "server";
    if (project) localStorage.setItem(modeKey(project), mode);
    document.querySelectorAll("#prevMode button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    if (mode === "server") startServer();
    else show(localStorage.getItem(urlKey(project)) || "");
  }

  // ---- Proyecto y servidor ----
  let projectList = [];

  async function renderProjects() {
    const sel = $("#prevProject");
    if (!sel) return;
    try {
      projectList = (await api("/api/projects")).filter((p) => p.exists !== false);
    } catch (_) {
      return;
    }
    sel.innerHTML = '<option value="">Elige un proyecto…</option>';
    projectList.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.path;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
    if (project && !projectList.some((p) => p.path === project)) project = null;
    sel.value = project || "";
  }

  async function pickProject(dir) {
    project = dir || null;
    if (project) localStorage.setItem(PROJECT_KEY, project);
    else localStorage.removeItem(PROJECT_KEY);
    mode = project && localStorage.getItem(modeKey(project)) === "url" ? "url" : "server";
    document.querySelectorAll("#prevMode button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    if (!project) return show("");
    if (mode === "url") return show(localStorage.getItem(urlKey(project)) || "");
    startServer();
  }

  async function startServer() {
    if (!project || busy) return;
    const already = serverFor(project);
    if (already) return show(already.url);
    busy = true;
    renderState("levantando el servidor…");
    try {
      const entry = await api("/api/preview", { path: project });
      servers = [...servers.filter((s) => s.path !== entry.path), entry];
      show(entry.url);
    } catch (err) {
      renderState(err.message);
    } finally {
      busy = false;
    }
  }

  async function stopServer(dir) {
    try {
      await api("/api/preview", { path: dir }, "DELETE");
    } catch (_) {
      // ya no estaba: el estado llega igual por SSE
    }
    servers = servers.filter((s) => s.path !== dir);
    if (dir === project) show("");
    renderState();
  }

  // ---- El iframe ----
  const withScheme = (url) => {
    const text = String(url || "").trim();
    if (!text || /^[a-z]+:\/\//i.test(text)) return text;
    return `http://${text}`;
  };

  function show(url) {
    const frame = $("#prevFrame");
    const clean = withScheme(url);
    $("#prevUrl").value = clean;
    $("#prevOverlay").hidden = Boolean(clean);
    if (!clean) {
      frame.removeAttribute("src");
      return renderState();
    }
    frame.src = clean;
    renderState();
  }

  function reload() {
    const url = $("#prevUrl").value.trim();
    if (!url) return;
    const frame = $("#prevFrame");
    // Otro origen: no se puede llamar a location.reload() desde aquí, así que se
    // vuelve a asignar el src con una marca que evita la caché del iframe.
    const bust = new URL(url, location.href);
    bust.searchParams.set("__prev", Date.now());
    frame.src = bust.href;
  }

  function renderState(text) {
    const state = $("#prevState");
    if (!state) return;
    if (text) return (state.textContent = text);
    const count = $("#previewCount");
    if (count) count.textContent = servers.length ? String(servers.length) : "";
    const stop = $("#prevStopBtn");
    const entry = project ? serverFor(project) : null;
    if (stop) stop.hidden = !entry;

    if (section === "android") {
      const devices = android?.devices?.length || 0;
      state.textContent = android && !android.sdk ? "sin SDK de Android" : `${devices} dispositivo${devices === 1 ? "" : "s"}`;
      return;
    }
    state.textContent = entry ? `sirviendo en :${entry.port}` : mode === "url" ? "URL externa" : "";
  }

  async function loadServers() {
    try {
      const data = await api("/api/preview");
      servers = data.servers || [];
      renderState();
    } catch (_) {
      // el servidor puede estar reiniciándose
    }
  }

  async function openInBrowser() {
    const url = $("#prevUrl").value.trim();
    if (!url) return;
    try {
      await api("/api/preview/open", { url });
    } catch (err) {
      alert(err.message);
    }
  }

  // ---- Android ----
  async function loadAndroid() {
    try {
      android = await api("/api/android");
    } catch (_) {
      android = null;
    }
    renderAndroid();
    renderState();
  }

  function renderAndroid() {
    const host = $("#prevAndroid");
    if (!host) return;
    if (!android) return (host.innerHTML = '<div class="prev-empty">No se pudo leer el estado de Android.</div>');
    if (!android.sdk) {
      return (host.innerHTML =
        '<div class="prev-empty"><b>No encuentro el SDK de Android.</b><br />' +
        `Se buscó en ${(android.looked || []).map(escapeHtml).join(", ") || "las rutas de siempre"}.<br />` +
        'Ponlo en <code>android_sdk_root</code> dentro de <code>data/config.json</code> o exporta <code>ANDROID_HOME</code>.</div>');
    }

    const devices = android.devices || [];
    const avds = android.avds || [];
    const running = new Set(devices.map((d) => d.avd).filter(Boolean));

    host.innerHTML =
      '<div class="prev-sec">EN MARCHA</div>' +
      (devices.length
        ? devices.map(deviceRow).join("")
        : '<div class="prev-empty">Ningún dispositivo conectado. Arranca un AVD de abajo o enchufa un móvil con depuración USB.</div>') +
      '<div class="prev-sec">AVDS DEL SDK</div>' +
      (avds.length
        ? avds.map((a) => avdRow(a, running.has(a))).join("")
        : '<div class="prev-empty">No hay ningún AVD creado. Créalo en Android Studio (Device Manager).</div>');

    host.querySelectorAll("[data-avd-start]").forEach((b) =>
      b.addEventListener("click", () => androidWrite("/api/android/start", { avd: b.dataset.avdStart }))
    );
    host.querySelectorAll("[data-avd-cold]").forEach((b) =>
      b.addEventListener("click", () => androidWrite("/api/android/start", { avd: b.dataset.avdCold, coldBoot: true }))
    );
    host.querySelectorAll("[data-stop]").forEach((b) =>
      b.addEventListener("click", () => androidWrite("/api/android/stop", { serial: b.dataset.stop }))
    );
    host.querySelectorAll("[data-mirror]").forEach((b) =>
      b.addEventListener("click", () => androidWrite("/api/android/mirror", { serial: b.dataset.mirror }))
    );
    host.querySelectorAll("[data-install]").forEach((b) => b.addEventListener("click", () => installApk(b.dataset.install)));
    host.querySelectorAll("[data-url]").forEach((b) => b.addEventListener("click", () => openUrlOn(b.dataset.url)));
  }

  function deviceRow(d) {
    const title = d.avd || d.model || d.serial;
    const sub = [d.serial, d.release ? `Android ${d.release}` : "", d.state !== "device" ? d.state : ""].filter(Boolean).join(" · ");
    const ready = d.state === "device";
    return (
      `<div class="prev-row${ready ? "" : " off"}">` +
      `<span class="prev-dot${ready ? " on" : ""}"></span>` +
      `<span class="prev-name">${escapeHtml(title)}<span class="prev-sub">${escapeHtml(sub)}</span></span>` +
      `<span class="prev-acts">` +
      (ready && android.scrcpy ? `<button class="ed-chip" data-mirror="${escapeAttr(d.serial)}">espejo</button>` : "") +
      (ready ? `<button class="ed-chip" data-install="${escapeAttr(d.serial)}">instalar APK</button>` : "") +
      (ready ? `<button class="ed-chip" data-url="${escapeAttr(d.serial)}">abrir URL</button>` : "") +
      (d.emulator ? `<button class="ed-chip danger" data-stop="${escapeAttr(d.serial)}">parar</button>` : "") +
      `</span></div>`
    );
  }

  function avdRow(name, running) {
    return (
      `<div class="prev-row">` +
      `<span class="prev-dot${running ? " on" : ""}"></span>` +
      `<span class="prev-name">${escapeHtml(name)}${running ? '<span class="prev-sub">en marcha</span>' : ""}</span>` +
      `<span class="prev-acts">` +
      (running
        ? ""
        : `<button class="ed-chip" data-avd-start="${escapeAttr(name)}">arrancar</button>` +
          `<button class="ed-chip" data-avd-cold="${escapeAttr(name)}" title="Sin cargar la instantánea guardada">en frío</button>`) +
      `</span></div>`
    );
  }

  async function androidWrite(url, body) {
    if (busy) return;
    busy = true;
    renderState("…");
    try {
      const data = await api(url, body);
      if (data.ok === false) alert(data.output || "No se pudo");
      android = data.android || android;
      renderAndroid();
    } catch (err) {
      alert(err.message);
    } finally {
      busy = false;
      renderState();
      setTimeout(loadAndroid, 1200);
    }
  }

  function installApk(serial) {
    const apk = prompt("Ruta del APK (dentro de un proyecto abierto):");
    if (!apk) return;
    androidWrite("/api/android/install", { serial, apk });
  }

  function openUrlOn(serial) {
    const url = prompt("URL que abrir en el dispositivo:", $("#prevUrl").value.trim() || "http://localhost:3000");
    if (!url) return;
    androidWrite("/api/android/url", { serial, url });
  }

  // El puente entre las dos secciones: el localhost del móvil apunta al servidor
  // del panel por adb reverse, así que la misma preview se ve dentro del emulador.
  async function openInDevice() {
    const url = $("#prevUrl").value.trim();
    if (!url) return;
    if (!android) await loadAndroid();
    const devices = (android?.devices || []).filter((d) => d.state === "device");
    if (!devices.length) return alert("No hay ningún dispositivo en marcha. Arranca un AVD en la sección Android.");
    const serial =
      devices.length === 1
        ? devices[0].serial
        : prompt(`¿En cuál?\n${devices.map((d) => d.serial).join("\n")}`, devices[0].serial);
    if (!serial) return;
    androidWrite("/api/android/url", { serial, url });
  }

  // ---- Entrada y eventos ----
  function wire() {
    document.querySelectorAll("#prevSections button").forEach((b) =>
      b.addEventListener("click", () => setSection(b.dataset.section))
    );
    document.querySelectorAll("#prevWidth button").forEach((b) => b.addEventListener("click", () => setWidth(b.dataset.width)));
    document.querySelectorAll("#prevMode button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
    $("#prevProject").addEventListener("change", (e) => pickProject(e.target.value));
    $("#prevReloadBtn").addEventListener("click", reload);
    $("#prevStopBtn").addEventListener("click", () => project && stopServer(project));
    $("#prevBrowserBtn").addEventListener("click", openInBrowser);
    $("#prevDeviceBtn").addEventListener("click", openInDevice);
    $("#prevUrl").addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const value = e.target.value.trim();
      if (project && mode === "url") localStorage.setItem(urlKey(project), value);
      show(value);
    });

    window.addEventListener("preview:servers", (e) => {
      servers = e.detail || [];
      renderState();
    });
  }

  let wired = false;

  async function open() {
    if (!wired) {
      wire();
      wired = true;
      setWidth(width);
      setSection(section);
    }
    await renderProjects();
    await loadServers();
    if (project && !$("#prevUrl").value) pickProject(project);
    if (section === "android") loadAndroid();
    if (!androidTimer) androidTimer = setInterval(pollAndroid, POLL_MS);
  }

  function pollAndroid() {
    if (!visible() || section !== "android" || document.hidden || busy) return;
    loadAndroid();
  }

  return { open, stopServer, refreshProjects: renderProjects, servers: () => servers };
})();
