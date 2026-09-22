const Preview = (() => {
  const SECTION_KEY = "orq.preview.section";
  const WIDTH_KEY = "orq.preview.width";
  const PROJECT_KEY = "orq.preview.project";
  const modeKey = (dir) => `orq.preview.mode.${dir}`;
  const urlKey = (dir) => `orq.preview.url.${dir}`;

  const POLL_MS = 3000;
  const MAX_LOG_CHARS = 400000;

  let section = localStorage.getItem(SECTION_KEY) === "android" ? "android" : "web";
  let width = localStorage.getItem(WIDTH_KEY) || "full";
  let project = localStorage.getItem(PROJECT_KEY) || null;
  let mode = "server";
  let servers = [];
  let android = null;
  let androidTimer = null;
  let gradleInfo = null;
  let build = null;
  let buildModule = null;
  let buildSerial = null;
  let devInfo = null;
  let dev = null;
  let devScript = null;
  let busy = false;

  const MODES = ["server", "url", "dev"];
  const storedMode = (dir) => {
    const saved = dir ? localStorage.getItem(modeKey(dir)) : "";
    return MODES.includes(saved) ? saved : "server";
  };

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
    // La barra ya no se oculta entera en Android: el selector de proyecto vive
    // dentro de ella y sin él no hay forma de elegir qué compilar con Gradle.
    // Lo que se esconde ahí son los controles de web, por CSS (.prev-web-only).
    const bar = $("#prevBar");
    bar.hidden = false;
    bar.dataset.section = section;
    $("#prevStage").hidden = section !== "web";
    $("#prevAndroid").hidden = section !== "android";
    if (section === "android") {
      loadAndroid();
      loadGradle();
    } else if (project) {
      // El modo se relee de localStorage y no de `mode`: la variable puede seguir
      // con el valor por defecto y guardarlo pisaría la elección del usuario.
      setMode(storedMode(project));
    }
    renderState();
  }

  function setWidth(next) {
    width = next;
    localStorage.setItem(WIDTH_KEY, width);
    document.querySelectorAll("#prevWidth button").forEach((b) => b.classList.toggle("active", b.dataset.width === width));
    $("#prevStage").dataset.width = width;
  }

  function setMode(next) {
    mode = MODES.includes(next) ? next : "server";
    if (project) localStorage.setItem(modeKey(project), mode);
    document.querySelectorAll("#prevMode button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    const host = $("#prevDev");
    if (host) host.hidden = mode !== "dev";
    if (mode === "server") return startServer();
    if (mode === "url") return show(localStorage.getItem(urlKey(project)) || "");
    loadDev();
    show(dev && dev.running && dev.url ? dev.url : "");
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
    mode = project ? storedMode(project) : "server";
    dev = null;
    devInfo = null;
    devScript = null;
    resetDevLog();
    loadGradle();
    if (mode === "dev") loadDev();
    document.querySelectorAll("#prevMode button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    if (!project) return show("");
    // En Android no se levanta el servidor de vista previa: no hay iframe que
    // llenar y sería un puerto abierto para nada.
    const host = $("#prevDev");
    if (host) host.hidden = mode !== "dev";
    if (section === "android") return;
    if (mode === "url") return show(localStorage.getItem(urlKey(project)) || "");
    if (mode === "dev") return show("");
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
    if (mode === "dev") {
      state.textContent = dev && dev.running ? (dev.url ? `script en ${dev.url}` : "script en marcha") : "script parado";
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

  // ---- Script del proyecto ----
  async function loadDev() {
    if (!project) {
      devInfo = null;
      dev = null;
      return renderDev();
    }
    try {
      const data = await api(`/api/dev?path=${encodeURIComponent(project)}`);
      devInfo = data && data.root ? data : null;
      adoptDev(devInfo ? data.state : null);
    } catch (_) {
      devInfo = null;
      dev = null;
    }
    renderDev();
  }

  function adoptDev(state) {
    dev = state || null;
    devShell();
    if (!dev) return;
    if (dev.script) devScript = dev.script;
    const log = $("#prevDevLog");
    if (log && dev.log && !log.textContent) {
      log.hidden = false;
      log.textContent = dev.log.length > MAX_LOG_CHARS ? dev.log.slice(-MAX_LOG_CHARS) : dev.log;
      log.scrollTop = log.scrollHeight;
    }
  }

  function devShell() {
    const host = $("#prevDev");
    if (!host) return null;
    if (!host.querySelector(".prev-dev-head")) {
      host.innerHTML = '<div class="prev-dev-head"></div><pre class="prev-log" id="prevDevLog" hidden></pre>';
    }
    return host;
  }

  function resetDevLog() {
    const log = $("#prevDevLog");
    if (!log) return;
    log.textContent = "";
    log.hidden = true;
  }

  function renderDev() {
    const host = devShell();
    if (!host) return;
    const head = host.querySelector(".prev-dev-head");
    if (document.activeElement && document.activeElement.tagName === "SELECT" && head.contains(document.activeElement)) return;

    if (!project) {
      head.innerHTML = '<div class="prev-empty">Elige un proyecto arriba para lanzar su script.</div>';
      return renderState();
    }
    if (!devInfo) {
      head.innerHTML =
        '<div class="prev-empty">Esta carpeta no tiene <code>package.json</code>: no hay ningún script que lanzar.</div>';
      return renderState();
    }
    const scripts = devInfo.scripts || [];
    if (!scripts.length) {
      head.innerHTML = '<div class="prev-empty">El <code>package.json</code> de esta carpeta no declara ningún script.</div>';
      return renderState();
    }
    if (!devScript || !scripts.some((s) => s.name === devScript)) devScript = devInfo.defaultScript || scripts[0].name;

    const running = Boolean(dev && dev.running);
    const chosen = running ? dev.script : devScript;
    const command = (scripts.find((s) => s.name === chosen) || {}).command || "";

    head.innerHTML =
      '<div class="prev-row">' +
      `<span class="prev-dot${running ? " on" : ""}"></span>` +
      `<span class="prev-name">${escapeHtml(`${devInfo.pm} run ${chosen}`)}` +
      `<span class="prev-sub">${escapeHtml(command || devInfo.root)}</span></span>` +
      '<span class="prev-acts">' +
      (running
        ? ""
        : `<select class="ed-chip" data-dev-script>${scripts
            .map(
              (sc) =>
                `<option value="${escapeAttr(sc.name)}"${sc.name === chosen ? " selected" : ""}>${escapeHtml(sc.name)}</option>`
            )
            .join("")}</select>`) +
      (running
        ? '<button class="ed-chip danger" data-dev-stop>parar</button>'
        : '<button class="ed-chip" data-dev-start>arrancar</button>') +
      (dev && dev.url ? '<button class="ed-chip" data-dev-open>ver</button>' : "") +
      "</span></div>" +
      devStatus();

    head.querySelector("[data-dev-script]")?.addEventListener("change", (e) => {
      devScript = e.target.value || null;
      renderDev();
    });
    head.querySelector("[data-dev-start]")?.addEventListener("click", startDev);
    head.querySelector("[data-dev-stop]")?.addEventListener("click", stopDev);
    head.querySelector("[data-dev-open]")?.addEventListener("click", () => show(dev.url));
    renderState();
  }

  function devStatus() {
    if (!dev) return "";
    if (dev.running && dev.url) return `<div class="prev-note"><span>En marcha en ${escapeHtml(dev.url)}</span></div>`;
    if (dev.running) return '<div class="prev-note"><span>En marcha. Esperando a que imprima una URL…</span></div>';
    const why = dev.error
      ? dev.error
      : dev.exitCode === 0
      ? "El script terminó"
      : `El script terminó con código ${dev.exitCode === null || dev.exitCode === undefined ? "?" : dev.exitCode}`;
    return `<div class="prev-note${dev.exitCode === 0 ? "" : " bad"}"><span>${escapeHtml(why)}</span></div>`;
  }

  async function startDev() {
    if (!project || busy) return;
    const script = devScript;
    if (!script) return;
    busy = true;
    resetDevLog();
    try {
      const data = await api("/api/dev", { path: project, script });
      adoptDev(data.state);
    } catch (err) {
      alert(err.message);
    } finally {
      busy = false;
      renderDev();
    }
  }

  async function stopDev() {
    if (!project || busy) return;
    busy = true;
    try {
      await api("/api/dev", { path: project }, "DELETE");
    } catch (err) {
      alert(err.message);
    } finally {
      busy = false;
      renderDev();
    }
  }

  function onDevEvent(ev) {
    if (!ev || !devInfo || ev.path !== devInfo.root) return;
    if (ev.phase === "log") {
      const log = $("#prevDevLog");
      if (!log) return;
      const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
      log.hidden = false;
      const text = log.textContent + (ev.lines || "");
      log.textContent = text.length > MAX_LOG_CHARS ? text.slice(-MAX_LOG_CHARS) : text;
      if (atBottom) log.scrollTop = log.scrollHeight;
      return;
    }
    if (ev.phase === "stopping") return;
    dev = { ...(dev || {}), ...ev };
    if (ev.phase === "url" && ev.url) {
      if (project) localStorage.setItem(urlKey(project), ev.url);
      if (mode === "dev") show(ev.url);
    }
    renderDev();
  }

  // ---- Compilar con Gradle ----
  const readyDevices = () => (android?.devices || []).filter((d) => d.state === "device");
  const buildRunning = () => Boolean(build && build.running);

  async function loadGradle() {
    if (!project) {
      gradleInfo = null;
      return renderBuild();
    }
    try {
      const data = await api(`/api/android/gradle?path=${encodeURIComponent(project)}`);
      gradleInfo = data && data.root ? data : null;
      if (data && data.build) adoptBuild(data.build);
    } catch (_) {
      gradleInfo = null;
    }
    renderBuild();
  }

  function adoptBuild(state) {
    build = state;
    if (state && state.log) {
      const log = $("#prevBuildLog");
      if (log && !log.textContent) {
        log.hidden = false;
        log.textContent = state.log;
        log.scrollTop = log.scrollHeight;
      }
    }
  }

  function buildShell() {
    const host = $("#prevBuild");
    if (!host) return null;
    if (!host.querySelector(".prev-build-head")) {
      host.innerHTML =
        '<div class="prev-sec">COMPILACIÓN</div>' +
        '<div class="prev-build-head"></div>' +
        '<pre class="prev-log" id="prevBuildLog" hidden></pre>';
    }
    return host;
  }

  function renderBuild() {
    const host = buildShell();
    if (!host) return;
    const head = host.querySelector(".prev-build-head");
    // El sondeo de dispositivos repinta esto cada tres segundos: con un menú
    // desplegado se perdería la elección a medio hacer.
    if (document.activeElement && document.activeElement.tagName === "SELECT" && head.contains(document.activeElement)) return;

    if (!project) {
      head.innerHTML = '<div class="prev-empty">Elige un proyecto arriba para compilarlo.</div>';
      return;
    }
    if (!gradleInfo) {
      head.innerHTML = '<div class="prev-empty">Esta carpeta no tiene <code>gradlew</code>: no hay nada que compilar con Gradle.</div>';
      return;
    }
    if (!gradleInfo.java) {
      head.innerHTML =
        '<div class="prev-empty"><b>No encuentro un JDK.</b><br />Instala Android Studio o exporta <code>JAVA_HOME</code>.</div>';
      return;
    }

    const modules = gradleInfo.modules || [];
    if (buildModule && !modules.includes(buildModule)) buildModule = null;
    const devices = readyDevices();
    if (buildSerial && !devices.some((d) => d.serial === buildSerial)) buildSerial = null;
    const serial = buildSerial || (devices[0] && devices[0].serial) || null;
    const running = buildRunning();
    const task = taskLabel();

    head.innerHTML =
      '<div class="prev-row">' +
      `<span class="prev-dot${running ? " on" : ""}"></span>` +
      `<span class="prev-name">${escapeHtml(task)}<span class="prev-sub">${escapeHtml(gradleInfo.root)}</span></span>` +
      '<span class="prev-acts">' +
      (modules.length > 1
        ? `<select class="ed-chip" data-module>${modules
            .map((m) => `<option value="${escapeAttr(m)}"${m === buildModule ? " selected" : ""}>${escapeHtml(m)}</option>`)
            .join("")}</select>`
        : "") +
      (devices.length > 1
        ? `<select class="ed-chip" data-serial>${devices
            .map(
              (d) =>
                `<option value="${escapeAttr(d.serial)}"${d.serial === serial ? " selected" : ""}>${escapeHtml(
                  d.avd || d.model || d.serial
                )}</option>`
            )
            .join("")}</select>`
        : "") +
      (running
        ? '<button class="ed-chip danger" data-build-cancel>cancelar</button>'
        : '<button class="ed-chip" data-build>compilar</button>' +
          (serial
            ? '<button class="ed-chip" data-build-install>compilar e instalar</button>'
            : '<button class="ed-chip" disabled title="Arranca un AVD para instalar">compilar e instalar</button>')) +
      '</span></div>' +
      buildStatus();

    head.querySelector("[data-module]")?.addEventListener("change", (e) => {
      buildModule = e.target.value || null;
      renderBuild();
    });
    head.querySelector("[data-serial]")?.addEventListener("change", (e) => {
      buildSerial = e.target.value || null;
    });
    head.querySelector("[data-build]")?.addEventListener("click", () => startBuild(false));
    head.querySelector("[data-build-install]")?.addEventListener("click", () => startBuild(true));
    head.querySelector("[data-build-cancel]")?.addEventListener("click", cancelBuild);
    head.querySelector("[data-apk-install]")?.addEventListener("click", (e) => installBuilt(e.target.dataset.apkInstall));
  }

  // Lo que se enseña es exactamente lo que se manda: sin módulo elegido va la
  // tarea de la raíz, que compila todos los del settings.gradle.
  function taskLabel() {
    return buildModule ? `${buildModule}:assembleDebug` : "assembleDebug";
  }

  function buildStatus() {
    if (!build) return "";
    if (build.running) return '<div class="prev-note">Compilando…</div>';
    const serial = buildSerial || (readyDevices()[0] || {}).serial;
    const apk = build.apk
      ? `<span class="prev-apk">${escapeHtml(build.apk.split("/").pop())}</span>` +
        (serial ? `<button class="ed-chip" data-apk-install="${escapeAttr(build.apk)}">instalar</button>` : "")
      : "";
    return (
      `<div class="prev-note${build.ok === false ? " bad" : ""}">` +
      `<span>${escapeHtml(build.summary || (build.ok ? "Compilado" : "Falló"))}</span>${apk}</div>`
    );
  }

  async function startBuild(install) {
    if (buildRunning()) return;
    const serial = buildSerial || (readyDevices()[0] || {}).serial || null;
    if (install && !serial) return alert("No hay ningún dispositivo listo.");
    const log = $("#prevBuildLog");
    if (log) {
      log.hidden = false;
      log.textContent = "";
    }
    try {
      const data = await api("/api/android/build", {
        path: project,
        module: buildModule || undefined,
        variant: "debug",
        install: Boolean(install),
        serial: install ? serial : undefined,
      });
      build = { id: data.id, running: true, task: data.task, root: data.root, ok: null, apk: null, summary: null };
      renderBuild();
    } catch (err) {
      alert(err.message);
    }
  }

  async function cancelBuild() {
    try {
      await api("/api/android/build", {}, "DELETE");
    } catch (err) {
      alert(err.message);
    }
  }

  function installBuilt(apk) {
    const serial = buildSerial || (readyDevices()[0] || {}).serial;
    if (!serial) return alert("No hay ningún dispositivo listo.");
    androidWrite("/api/android/install", { serial, apk });
  }

  // El log llega por SSE en ráfagas: se añade al <pre> y se baja el scroll solo
  // si el usuario ya estaba abajo, para no arrastrarlo mientras lee.
  function onBuildEvent(ev) {
    if (!ev) return;
    const log = $("#prevBuildLog");
    if (ev.phase === "start") {
      build = { id: ev.id, running: true, task: ev.task, root: ev.root, ok: null, apk: null, summary: null };
      if (log) {
        log.hidden = false;
        log.textContent = "";
      }
      return renderBuild();
    }
    if (ev.phase === "log") {
      if (!log) return;
      const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
      log.hidden = false;
      const text = log.textContent + (ev.lines || "");
      log.textContent = text.length > MAX_LOG_CHARS ? text.slice(-MAX_LOG_CHARS) : text;
      if (atBottom) log.scrollTop = log.scrollHeight;
      return;
    }
    if (ev.phase === "built") {
      build = { ...(build || {}), id: ev.id, running: true, ok: ev.ok, apk: ev.apk, summary: ev.summary };
      return renderBuild();
    }
    if (ev.phase === "done") {
      build = { ...(build || {}), id: ev.id, running: false, ok: ev.ok, apk: ev.apk, summary: ev.summary, pkg: ev.pkg };
      renderBuild();
      loadAndroid();
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
    const host = $("#prevDevices");
    if (!host) return;
    renderBuild();
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

    window.addEventListener("android:build", (e) => onBuildEvent(e.detail));
    window.addEventListener("dev:update", (e) => onDevEvent(e.detail));
    window.addEventListener("dev:log", (e) => onDevEvent(e.detail));
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
    if (section === "android") {
      loadAndroid();
      loadGradle();
    } else if (mode === "dev") {
      loadDev();
    }
    if (!androidTimer) androidTimer = setInterval(pollAndroid, POLL_MS);
  }

  function pollAndroid() {
    if (!visible() || section !== "android" || document.hidden || busy) return;
    loadAndroid();
  }

  return { open, stopServer, refreshProjects: renderProjects, servers: () => servers };
})();
