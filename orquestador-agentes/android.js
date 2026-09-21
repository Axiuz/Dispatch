// Los emuladores de Android desde el panel: lista los AVDs, los arranca y los
// para, ve los dispositivos conectados, instala un APK, abre una URL en el
// dispositivo y hace adb reverse para que el localhost del móvil llegue al
// servidor de vista previa del Mac.
// adb y emulator salen del SDK (ANDROID_HOME o ~/Library/Android/sdk), no del
// PATH, y se llaman siempre con execFile y argumentos fijos, nunca por la shell.
// El emulador se lanza suelto (detached) para que no se lo lleve por delante un
// reinicio del orquestador. Los parseos van en funciones puras, para probarlos.

const { execFile, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ADB_TIMEOUT_MS = 8000;
const BOOT_TIMEOUT_MS = 20000;
const DEVICE_CACHE_MS = 3000;
const MAX_OUTPUT = 200000;
const SCRCPY_PATHS = ["/opt/homebrew/bin/scrcpy", "/usr/local/bin/scrcpy"];

const SERIAL_OK = /^[A-Za-z0-9._:-]{1,64}$/;

function sdkCandidates(env = process.env, configured = "") {
  return [configured, env.ANDROID_HOME, env.ANDROID_SDK_ROOT, path.join(os.homedir(), "Library/Android/sdk")]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
}

function sdkRoot(env = process.env, configured = "") {
  for (const candidate of sdkCandidates(env, configured)) {
    try {
      if (fs.existsSync(path.join(candidate, "platform-tools", "adb"))) return candidate;
    } catch (_) {
      // una ruta ilegible es una ruta que no sirve
    }
  }
  return null;
}

const adbPath = (root) => path.join(root, "platform-tools", "adb");
const emulatorPath = (root) => path.join(root, "emulator", "emulator");

function scrcpyPath(env = process.env) {
  for (const p of SCRCPY_PATHS) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  for (const dir of String(env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, "scrcpy");
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (_) {}
  }
  return null;
}

function parseAvds(stdout) {
  return String(stdout || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.includes(" ") && !line.startsWith("INFO") && !line.startsWith("WARNING"))
    .slice(0, 40);
}

function parseDevices(stdout) {
  const out = [];
  for (const raw of String(stdout || "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("List of devices")) continue;
    const [serial, state, ...rest] = line.split(/\s+/);
    if (!serial || !state) continue;
    const info = rest.join(" ");
    const model = info.match(/model:(\S+)/);
    const device = info.match(/device:(\S+)/);
    out.push({
      serial,
      state,
      model: model ? model[1].replace(/_/g, " ") : null,
      device: device ? device[1] : null,
      emulator: /^emulator-\d+$/.test(serial),
    });
  }
  return out;
}

function serialError(serial) {
  const s = String(serial || "").trim();
  if (!s) return "Falta el dispositivo";
  // Un serial que empiece por guion lo leería adb como una bandera suya
  if (s.startsWith("-")) return "Un dispositivo no puede empezar por '-'";
  if (!SERIAL_OK.test(s)) return "Ese identificador de dispositivo no es válido";
  return null;
}

function avdError(avd) {
  const a = String(avd || "").trim();
  if (!a) return "Falta el AVD";
  if (a.startsWith("-")) return "Un nombre de AVD no puede empezar por '-'";
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(a)) return "Ese nombre de AVD no es válido";
  return null;
}

function emulatorArgs({ avd, coldBoot = false } = {}) {
  const args = ["-avd", String(avd)];
  if (coldBoot) args.push("-no-snapshot-load");
  return args;
}

function run(bin, args, timeout = ADB_TIMEOUT_MS) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, maxBuffer: MAX_OUTPUT, encoding: "utf-8", windowsHide: true }, (err, stdout, stderr) => {
      const output = [stdout, stderr]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join("\n");
      resolve({ ok: !err, stdout: String(stdout || ""), output: output || (err ? err.message : "") });
    });
  });
}

function create({ config = {}, env = process.env } = {}) {
  const root = sdkRoot(env, config.android_sdk_root);
  const scrcpy = scrcpyPath(env);
  let cache = { at: 0, devices: [] };

  const noSdk = () => ({ ok: false, output: "No encuentro el SDK de Android" });
  const adb = (args, timeout) => run(adbPath(root), args, timeout);

  async function listAvds() {
    if (!root) return [];
    const res = await run(emulatorPath(root), ["-list-avds"], ADB_TIMEOUT_MS);
    return res.ok ? parseAvds(res.stdout) : [];
  }

  // De cada emulador se pregunta además qué AVD es y qué versión corre: son dos
  // adb más por dispositivo, así que la lista se cachea unos segundos porque el
  // panel la pide cada tres.
  async function listDevices({ refresh = false } = {}) {
    if (!root) return [];
    if (!refresh && Date.now() - cache.at < DEVICE_CACHE_MS) return cache.devices;

    const res = await adb(["devices", "-l"]);
    const devices = res.ok ? parseDevices(res.stdout) : [];

    await Promise.all(
      devices.map(async (d) => {
        if (d.state !== "device") return;
        const [release, avd] = await Promise.all([
          adb(["-s", d.serial, "shell", "getprop", "ro.build.version.release"]),
          d.emulator ? adb(["-s", d.serial, "emu", "avd", "name"]) : Promise.resolve({ ok: false, stdout: "" }),
        ]);
        d.release = release.ok ? release.stdout.trim() : null;
        d.avd = avd.ok ? avd.stdout.split("\n")[0].trim() : null;
      })
    );

    cache = { at: Date.now(), devices };
    return devices;
  }

  async function state({ refresh = false } = {}) {
    const [avds, devices] = await Promise.all([listAvds(), listDevices({ refresh })]);
    return {
      sdk: root,
      looked: sdkCandidates(env, config.android_sdk_root),
      scrcpy: Boolean(scrcpy),
      avds,
      devices,
    };
  }

  // El emulador se lanza suelto y se le suelta la mano (detached + unref): así no
  // se lo lleva por delante un reinicio del orquestador, que es lo que pasaría si
  // fuera hijo suyo. Lo que diga por stdout no interesa; si no arranca, se ve
  // porque el dispositivo no aparece en la lista.
  function start({ avd, coldBoot = false } = {}) {
    if (!root) return noSdk();
    const bad = avdError(avd);
    if (bad) return { ok: false, output: bad };
    try {
      const child = spawn(emulatorPath(root), emulatorArgs({ avd, coldBoot }), {
        detached: true,
        stdio: "ignore",
        cwd: root,
      });
      child.unref();
      cache = { at: 0, devices: cache.devices };
      return { ok: true, output: `Arrancando ${avd}…` };
    } catch (err) {
      return { ok: false, output: err.message };
    }
  }

  async function stop({ serial } = {}) {
    if (!root) return noSdk();
    const bad = serialError(serial);
    if (bad) return { ok: false, output: bad };
    const res = await adb(["-s", serial, "emu", "kill"]);
    cache = { at: 0, devices: [] };
    return { ok: res.ok, output: res.output || "Apagado" };
  }

  async function install({ serial, apk } = {}) {
    if (!root) return noSdk();
    const bad = serialError(serial);
    if (bad) return { ok: false, output: bad };
    if (!apk || !path.isAbsolute(apk)) return { ok: false, output: "La ruta del APK tiene que ser absoluta" };
    return adb(["-s", serial, "install", "-r", apk], BOOT_TIMEOUT_MS * 6);
  }

  async function openUrl({ serial, url } = {}) {
    if (!root) return noSdk();
    const bad = serialError(serial);
    if (bad) return { ok: false, output: bad };
    const clean = String(url || "").trim();
    if (!/^https?:\/\//.test(clean)) return { ok: false, output: "La URL tiene que empezar por http:// o https://" };
    return adb(["-s", serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", clean]);
  }

  // El localhost del móvil no es el del Mac: adb reverse abre ese puerto dentro
  // del dispositivo y lo manda al nuestro, que es lo que deja ver la preview.
  async function reverse({ serial, port } = {}) {
    if (!root) return noSdk();
    const bad = serialError(serial);
    if (bad) return { ok: false, output: bad };
    const n = Number(port);
    if (!Number.isInteger(n) || n < 1 || n > 65535) return { ok: false, output: "Puerto no válido" };
    return adb(["-s", serial, "reverse", `tcp:${n}`, `tcp:${n}`]);
  }

  function mirror({ serial } = {}) {
    if (!scrcpy) return { ok: false, output: "scrcpy no está instalado. Instálalo con: brew install scrcpy" };
    const bad = serialError(serial);
    if (bad) return { ok: false, output: bad };
    try {
      const child = spawn(scrcpy, ["-s", serial], { detached: true, stdio: "ignore" });
      child.unref();
      return { ok: true, output: "Abriendo el espejo…" };
    } catch (err) {
      return { ok: false, output: err.message };
    }
  }

  return { root, scrcpy, state, listAvds, listDevices, start, stop, install, openUrl, reverse, mirror };
}

module.exports = {
  create,
  sdkRoot,
  sdkCandidates,
  scrcpyPath,
  parseAvds,
  parseDevices,
  serialError,
  avdError,
  emulatorArgs,
};
