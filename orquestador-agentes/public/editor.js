// ============ Pestaña Editor ============
// Monaco (el editor de VS Code) servido desde node_modules, sin build step: se
// carga con su loader AMD la primera vez que se abre la pestaña, no al arrancar
// el panel, porque son varios megas.
//
// El estado vive aquí dentro y no en app.js: lo único que comparte con el resto
// del panel son las variables CSS del tema y los proyectos de la lista.

const CodeEditor = (() => {
  const $ = (s) => document.querySelector(s);

  const FILE_KINDS = {
    js: { lang: "javascript", icon: "JS", color: "var(--amber)" },
    mjs: { lang: "javascript", icon: "JS", color: "var(--amber)" },
    cjs: { lang: "javascript", icon: "JS", color: "var(--amber)" },
    jsx: { lang: "javascript", icon: "JX", color: "var(--amber)" },
    ts: { lang: "typescript", icon: "TS", color: "var(--violet)" },
    tsx: { lang: "typescript", icon: "TX", color: "var(--violet)" },
    mts: { lang: "typescript", icon: "TS", color: "var(--violet)" },
    cts: { lang: "typescript", icon: "TS", color: "var(--violet)" },
    coffee: { lang: "coffeescript", icon: "CF", color: "var(--amber)" },
    json: { lang: "json", icon: "{}", color: "var(--amber)" },
    jsonc: { lang: "json", icon: "{}", color: "var(--amber)" },
    json5: { lang: "json", icon: "{}", color: "var(--amber)" },
    jsonl: { lang: "json", icon: "{}", color: "var(--amber)" },
    geojson: { lang: "json", icon: "{}", color: "var(--green)" },
    webmanifest: { lang: "json", icon: "{}", color: "var(--muted)" },

    html: { lang: "html", icon: "<>", color: "var(--accent)" },
    htm: { lang: "html", icon: "<>", color: "var(--accent)" },
    xhtml: { lang: "html", icon: "<>", color: "var(--accent)" },
    pug: { lang: "pug", icon: "PG", color: "var(--red)" },
    jade: { lang: "pug", icon: "PG", color: "var(--red)" },
    hbs: { lang: "handlebars", icon: "HB", color: "var(--amber)" },
    handlebars: { lang: "handlebars", icon: "HB", color: "var(--amber)" },
    twig: { lang: "twig", icon: "TW", color: "var(--green)" },
    liquid: { lang: "liquid", icon: "LQ", color: "var(--green)" },
    erb: { lang: "ruby", icon: "ER", color: "var(--red)" },
    cshtml: { lang: "razor", icon: "RZ", color: "var(--violet)" },
    razor: { lang: "razor", icon: "RZ", color: "var(--violet)" },

    css: { lang: "css", icon: "CS", color: "var(--violet)" },
    scss: { lang: "scss", icon: "SC", color: "var(--violet)" },
    sass: { lang: "scss", icon: "SA", color: "var(--violet)" },
    less: { lang: "less", icon: "LE", color: "var(--violet)" },

    xml: { lang: "xml", icon: "<>", color: "var(--muted)" },
    svg: { lang: "xml", icon: "SV", color: "var(--violet)" },
    xsd: { lang: "xml", icon: "XS", color: "var(--muted)" },
    xsl: { lang: "xml", icon: "XL", color: "var(--muted)" },
    plist: { lang: "xml", icon: "PL", color: "var(--muted)" },
    storyboard: { lang: "xml", icon: "SB", color: "var(--muted)" },
    csproj: { lang: "xml", icon: "PJ", color: "var(--green)" },
    gradle: { lang: "xml", icon: "GR", color: "var(--green)" },

    md: { lang: "markdown", icon: "MD", color: "var(--muted)" },
    markdown: { lang: "markdown", icon: "MD", color: "var(--muted)" },
    mdx: { lang: "mdx", icon: "MX", color: "var(--muted)" },
    rst: { lang: "restructuredtext", icon: "RS", color: "var(--muted)" },

    yml: { lang: "yaml", icon: "YM", color: "var(--red)" },
    yaml: { lang: "yaml", icon: "YM", color: "var(--red)" },
    lock: { lang: "yaml", icon: "LK", color: "var(--muted)" },
    toml: { lang: "ini", icon: "TM", color: "var(--red)" },
    ini: { lang: "ini", icon: "IN", color: "var(--muted)" },
    cfg: { lang: "ini", icon: "CF", color: "var(--muted)" },
    conf: { lang: "ini", icon: "CF", color: "var(--muted)" },
    properties: { lang: "ini", icon: "PR", color: "var(--muted)" },
    editorconfig: { lang: "ini", icon: "EC", color: "var(--muted)" },

    py: { lang: "python", icon: "PY", color: "var(--green)" },
    pyw: { lang: "python", icon: "PY", color: "var(--green)" },
    pyi: { lang: "python", icon: "PI", color: "var(--green)" },
    rb: { lang: "ruby", icon: "RB", color: "var(--red)" },
    rake: { lang: "ruby", icon: "RK", color: "var(--red)" },
    gemspec: { lang: "ruby", icon: "GS", color: "var(--red)" },
    php: { lang: "php", icon: "PH", color: "var(--violet)" },
    phtml: { lang: "php", icon: "PH", color: "var(--violet)" },
    pl: { lang: "perl", icon: "PL", color: "var(--violet)" },
    pm: { lang: "perl", icon: "PM", color: "var(--violet)" },
    lua: { lang: "lua", icon: "LU", color: "var(--violet)" },
    r: { lang: "r", icon: "R", color: "var(--green)" },
    rmd: { lang: "r", icon: "RM", color: "var(--green)" },
    jl: { lang: "julia", icon: "JL", color: "var(--violet)" },
    tcl: { lang: "tcl", icon: "TC", color: "var(--muted)" },
    tk: { lang: "tcl", icon: "TK", color: "var(--muted)" },
    ex: { lang: "elixir", icon: "EX", color: "var(--violet)" },
    exs: { lang: "elixir", icon: "EX", color: "var(--violet)" },
    clj: { lang: "clojure", icon: "CJ", color: "var(--green)" },
    cljs: { lang: "clojure", icon: "CJ", color: "var(--green)" },
    cljc: { lang: "clojure", icon: "CJ", color: "var(--green)" },
    edn: { lang: "clojure", icon: "ED", color: "var(--green)" },
    scm: { lang: "scheme", icon: "SM", color: "var(--muted)" },
    ss: { lang: "scheme", icon: "SM", color: "var(--muted)" },

    java: { lang: "java", icon: "JV", color: "var(--red)" },
    kt: { lang: "kotlin", icon: "KT", color: "var(--violet)" },
    kts: { lang: "kotlin", icon: "KT", color: "var(--violet)" },
    scala: { lang: "scala", icon: "SL", color: "var(--red)" },
    sc: { lang: "scala", icon: "SL", color: "var(--red)" },
    sbt: { lang: "scala", icon: "SB", color: "var(--red)" },
    groovy: { lang: "java", icon: "GV", color: "var(--green)" },
    go: { lang: "go", icon: "GO", color: "var(--accent)" },
    rs: { lang: "rust", icon: "RS", color: "var(--accent)" },
    dart: { lang: "dart", icon: "DA", color: "var(--green)" },
    swift: { lang: "swift", icon: "SW", color: "var(--accent)" },
    m: { lang: "objective-c", icon: "OC", color: "var(--accent)" },
    mm: { lang: "objective-c", icon: "OC", color: "var(--accent)" },
    cs: { lang: "csharp", icon: "C#", color: "var(--green)" },
    csx: { lang: "csharp", icon: "C#", color: "var(--green)" },
    fs: { lang: "fsharp", icon: "F#", color: "var(--violet)" },
    fsi: { lang: "fsharp", icon: "F#", color: "var(--violet)" },
    fsx: { lang: "fsharp", icon: "F#", color: "var(--violet)" },
    vb: { lang: "vb", icon: "VB", color: "var(--violet)" },
    bas: { lang: "vb", icon: "BA", color: "var(--violet)" },
    vbs: { lang: "vb", icon: "VB", color: "var(--violet)" },
    pas: { lang: "pascal", icon: "PA", color: "var(--muted)" },
    pp: { lang: "pascal", icon: "PA", color: "var(--muted)" },
    abap: { lang: "abap", icon: "AB", color: "var(--muted)" },
    cls: { lang: "apex", icon: "AX", color: "var(--muted)" },
    trigger: { lang: "apex", icon: "AX", color: "var(--muted)" },

    c: { lang: "c", icon: "C", color: "var(--muted)" },
    h: { lang: "c", icon: "H", color: "var(--muted)" },
    cpp: { lang: "cpp", icon: "C+", color: "var(--muted)" },
    cc: { lang: "cpp", icon: "C+", color: "var(--muted)" },
    cxx: { lang: "cpp", icon: "C+", color: "var(--muted)" },
    hpp: { lang: "cpp", icon: "H+", color: "var(--muted)" },
    hh: { lang: "cpp", icon: "H+", color: "var(--muted)" },
    hxx: { lang: "cpp", icon: "H+", color: "var(--muted)" },
    ino: { lang: "cpp", icon: "AR", color: "var(--green)" },
    s: { lang: "mips", icon: "AS", color: "var(--ghost)" },
    asm: { lang: "mips", icon: "AS", color: "var(--ghost)" },
    v: { lang: "systemverilog", icon: "VL", color: "var(--muted)" },
    vh: { lang: "systemverilog", icon: "VL", color: "var(--muted)" },
    sv: { lang: "systemverilog", icon: "SV", color: "var(--muted)" },
    svh: { lang: "systemverilog", icon: "SV", color: "var(--muted)" },
    wgsl: { lang: "wgsl", icon: "WG", color: "var(--violet)" },
    qs: { lang: "qsharp", icon: "Q#", color: "var(--violet)" },
    sol: { lang: "solidity", icon: "SO", color: "var(--muted)" },

    sh: { lang: "shell", icon: "SH", color: "var(--green)" },
    bash: { lang: "shell", icon: "SH", color: "var(--green)" },
    zsh: { lang: "shell", icon: "ZS", color: "var(--green)" },
    fish: { lang: "shell", icon: "FI", color: "var(--green)" },
    ksh: { lang: "shell", icon: "KS", color: "var(--green)" },
    env: { lang: "shell", icon: "EN", color: "var(--red)" },
    envrc: { lang: "shell", icon: "EN", color: "var(--red)" },
    ps1: { lang: "powershell", icon: "PS", color: "var(--violet)" },
    psm1: { lang: "powershell", icon: "PS", color: "var(--violet)" },
    psd1: { lang: "powershell", icon: "PS", color: "var(--violet)" },
    bat: { lang: "bat", icon: "BT", color: "var(--ghost)" },
    cmd: { lang: "bat", icon: "BT", color: "var(--ghost)" },
    azcli: { lang: "azcli", icon: "AZ", color: "var(--accent)" },

    sql: { lang: "sql", icon: "SQ", color: "var(--accent)" },
    ddl: { lang: "sql", icon: "SQ", color: "var(--accent)" },
    dml: { lang: "sql", icon: "SQ", color: "var(--accent)" },
    mysql: { lang: "mysql", icon: "MY", color: "var(--accent)" },
    pgsql: { lang: "pgsql", icon: "PG", color: "var(--accent)" },
    redshift: { lang: "redshift", icon: "RS", color: "var(--accent)" },
    redis: { lang: "redis", icon: "RE", color: "var(--red)" },
    cyp: { lang: "cypher", icon: "CY", color: "var(--green)" },
    cypher: { lang: "cypher", icon: "CY", color: "var(--green)" },
    sparql: { lang: "sparql", icon: "SP", color: "var(--green)" },
    rq: { lang: "sparql", icon: "SP", color: "var(--green)" },
    dax: { lang: "msdax", icon: "DX", color: "var(--accent)" },
    pq: { lang: "powerquery", icon: "PQ", color: "var(--accent)" },
    ecl: { lang: "ecl", icon: "EC", color: "var(--muted)" },
    st: { lang: "st", icon: "ST", color: "var(--muted)" },

    graphql: { lang: "graphql", icon: "GQ", color: "var(--violet)" },
    gql: { lang: "graphql", icon: "GQ", color: "var(--violet)" },
    prisma: { lang: "graphql", icon: "PR", color: "var(--green)" },
    proto: { lang: "protobuf", icon: "PB", color: "var(--muted)" },
    tsp: { lang: "typespec", icon: "TP", color: "var(--violet)" },

    tf: { lang: "hcl", icon: "TF", color: "var(--violet)" },
    tfvars: { lang: "hcl", icon: "TV", color: "var(--violet)" },
    hcl: { lang: "hcl", icon: "HC", color: "var(--violet)" },
    bicep: { lang: "bicep", icon: "BC", color: "var(--accent)" },
    dockerfile: { lang: "dockerfile", icon: "DK", color: "var(--accent)" },
    csp: { lang: "csp", icon: "CP", color: "var(--muted)" },

    txt: { lang: "plaintext", icon: "TX", color: "var(--muted)" },
    log: { lang: "plaintext", icon: "LG", color: "var(--muted)" },
    csv: { lang: "plaintext", icon: "CV", color: "var(--green)" },
    tsv: { lang: "plaintext", icon: "TV", color: "var(--green)" },
    diff: { lang: "plaintext", icon: "DF", color: "var(--amber)" },
    patch: { lang: "plaintext", icon: "PT", color: "var(--amber)" },
    map: { lang: "plaintext", icon: "MP", color: "var(--ghost)" },
    bak: { lang: "plaintext", icon: "BK", color: "var(--ghost)" },
    tmpl: { lang: "plaintext", icon: "TM", color: "var(--ghost)" },
    makefile: { lang: "plaintext", icon: "MK", color: "var(--muted)" },
    mk: { lang: "plaintext", icon: "MK", color: "var(--muted)" },
    cmake: { lang: "plaintext", icon: "CM", color: "var(--muted)" },
    gitignore: { lang: "ini", icon: "GI", color: "var(--ghost)" },
    gitattributes: { lang: "ini", icon: "GA", color: "var(--ghost)" },
    npmrc: { lang: "ini", icon: "NP", color: "var(--ghost)" },
    nvmrc: { lang: "plaintext", icon: "NV", color: "var(--ghost)" },
    dockerignore: { lang: "ini", icon: "DI", color: "var(--ghost)" },
    eslintignore: { lang: "ini", icon: "ES", color: "var(--ghost)" },
    prettierignore: { lang: "ini", icon: "PY", color: "var(--ghost)" },
  };

  const BY_NAME = {
    dockerfile: "dockerfile",
    containerfile: "dockerfile",
    makefile: "makefile",
    gnumakefile: "makefile",
    "cmakelists.txt": "cmake",
    gemfile: "rb",
    rakefile: "rb",
    podfile: "rb",
    brewfile: "rb",
    procfile: "txt",
    license: "txt",
    "go.sum": "txt",
    "go.mod": "txt",
    "cargo.lock": "toml",
    "pnpm-lock.yaml": "lock",
  };

  const UNKNOWN_KIND = { lang: "plaintext", icon: "\u00b7\u00b7", color: "var(--ghost)" };

  // Normaliza el nombre a la clave de FILE_KINDS: quita los puntos del principio
  // para que .gitignore o .env caigan en su entrada, y BY_NAME resuelve los archivos
  // que no llevan extensión.
  function kindKey(name) {
    const lower = name.toLowerCase();
    if (BY_NAME[lower]) return BY_NAME[lower];
    if (lower.startsWith(".env")) return "env";
    const bare = lower.replace(/^\.+/, "");
    const dot = bare.lastIndexOf(".");
    return dot === -1 ? bare : bare.slice(dot + 1);
  }

  function kindFor(name) {
    return FILE_KINDS[kindKey(name)] || UNKNOWN_KIND;
  }

  // Índice de lenguajes construido una sola vez para evitar recalcularlo al iniciar,
  // usando los registros de Monaco y un mapa curado manualmente (FILE_KINDS) para
  // priorizar extensiones específicas como .prisma, que se abre como GraphQL.
  let langIndex = null;

  // Construye un índice que mapea extensiones y nombres de archivo a ids de lenguaje,
  // con los datos de monaco.languages.getLanguages(). Se guarda para reutilizarlo en
  // lugar de reconstruirlo.
  function buildLangIndex() {
    const index = { byExt: new Map(), byFile: new Map() };
    for (const lang of monaco.languages.getLanguages()) {
      (lang.extensions || []).forEach((e) => index.byExt.set(e.toLowerCase(), lang.id));
      (lang.filenames || []).forEach((f) => index.byFile.set(f.toLowerCase(), lang.id));
    }
    return index;
  }

  // Determina el lenguaje asociado a un nombre de archivo, priorizando reglas manuales
  // (FILE_KINDS) sobre el registro de Monaco, y usando una clave normalizada (kindKey)
  // para evitar problemas con puntos en nombres como .gitignore o .env.
  function langFor(name) {
    const curated = FILE_KINDS[kindKey(name)];
    if (curated) return curated.lang;
    if (!monaco) return UNKNOWN_KIND.lang;
    if (!langIndex) langIndex = buildLangIndex();
    const lower = name.toLowerCase();
    const byFile = langIndex.byFile.get(lower);
    if (byFile) return byFile;
    const dot = lower.lastIndexOf(".");
    const ext = dot > 0 ? lower.slice(dot) : "";
    return (ext && langIndex.byExt.get(ext)) || UNKNOWN_KIND.lang;
  }

  // ---- Familias de icono ----
  // El icono del árbol sale del icon theme si hay uno instalado; si no, de esta
  // familia, y si tampoco, del monograma de FILE_KINDS.
  const FAMILIES = {
    image: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "icns", "svg", "tiff"],
    media: ["mp4", "mov", "webm", "mkv", "avi", "mp3", "wav", "flac", "ogg", "m4a"],
    font: ["woff", "woff2", "ttf", "otf", "eot"],
    archive: ["zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "vsix"],
    lock: ["lock", "pem", "key", "crt", "cer", "p12"],
    git: ["gitignore", "gitattributes", "gitmodules", "gitkeep"],
    docker: ["dockerfile", "dockerignore"],
    env: ["env"],
    db: ["sql", "sqlite", "db", "mysql", "pgsql", "prisma"],
    binary: ["wasm", "bin", "exe", "dylib", "so", "o", "a", "class", "pyc"],
    text: ["txt", "log", "csv", "tsv", "rtf"],
  };

  const FAMILY_BY_KEY = new Map();
  Object.entries(FAMILIES).forEach(([family, keys]) => keys.forEach((k) => FAMILY_BY_KEY.set(k, family)));

  function iconFor(name) {
    const key = kindKey(name);
    const themed = window.EdExtensions?.fileIcon?.(name, key);
    if (themed) return themed;
    const family = FAMILY_BY_KEY.get(key);
    const drawn = family && EdIcons.file(family);
    if (drawn) return drawn;
    return EdIcons.doc(kindFor(name).icon);
  }

  function dirIcon(open) {
    const themed = window.EdExtensions?.folderIcon?.(open);
    return themed || EdIcons.view(open ? "folderOpen" : "folder");
  }

  // ---- Estado ----
  let monaco = null;
  let monacoPromise = null;
  let editor = null;
  let root = null; // carpeta del proyecto abierto
  const dirs = new Map(); // ruta de carpeta -> entradas ya leídas
  const expanded = new Set();
  const files = new Map(); // ruta -> {model, mtimeMs, saved}
  let activePath = null;
  let selectedDir = null;
  let watchTimer = null;
  let cursor = { line: 1, column: 1 };

  // Estado de git por archivo, para las letras del árbol. Sale de /api/git, que
  // ya lo calcula para la tarjeta del carril derecho.
  let gitMarks = new Map(); // ruta absoluta -> {letter, kind, staged}
  let gitDirs = new Map(); // carpeta -> cuántos archivos cambiados cuelgan de ella
  let gitRoot = null;
  let gitState = null; // {repo, root, branch, detached, ahead, behind} de la carpeta abierta
  let gitSig = ""; // firma de rama + archivos cambiados: sin cambios no se repinta

  const DEFAULT_PINNED = ["explorer", "search", "branches", "notes", "extensions"];
  let pinned = readStore("ed.pinned", DEFAULT_PINNED);
  // La barra ya fijada en localStorage no conoce las vistas nuevas: se añaden
  // una vez, para que aparezcan sin tener que fijarlas a mano.
  if (!readStore("ed.pinned.branches", false)) {
    if (!pinned.includes("branches")) pinned = [...pinned, "branches"];
    writeStore("ed.pinned.branches", true);
    writeStore("ed.pinned", pinned);
  }
  let view = readStore("ed.view", "explorer");
  let sideOpen = readStore("ed.side", true);

  const GIT_POLL_MS = 5000;
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const baseName = (p) => p.split("/").pop();
  const dirName = (p) => p.slice(0, p.lastIndexOf("/"));

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // navegación privada o almacenamiento lleno: la preferencia se pierde y ya
    }
  }
  // ---- Carga de Monaco ----
  // El loader AMD se trae de /vendor/monaco, que es min/vs tal cual viene en
  // node_modules. Los workers se arrancan con ese mismo loader desde un blob.
  function workerUrl() {
    const base = `${location.origin}/vendor/monaco`;
    const src = [
      `self.MonacoEnvironment = { baseUrl: "${base}" };`,
      `importScripts("${base}/loader.js");`,
      `require.config({ paths: { vs: "${base}" } });`,
      `require(["vs/editor/editor.worker"], function () {});`,
    ].join("\n");
    return URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
  }

  function loadMonaco() {
    if (monacoPromise) return monacoPromise;
    monacoPromise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "/vendor/monaco/editor/editor.main.css";
      document.head.appendChild(css);

      const script = document.createElement("script");
      script.src = "/vendor/monaco/loader.js";
      script.onerror = () => reject(new Error("No se pudo cargar Monaco desde /vendor/monaco"));
      script.onload = () => {
        window.require.config({ paths: { vs: "/vendor/monaco" } });
        window.MonacoEnvironment = { getWorkerUrl: workerUrl };
        window.require(["vs/editor/editor.main"], () => resolve(window.monaco), reject);
      };
      document.head.appendChild(script);
    });
    return monacoPromise;
  }

  // Convierte un nombre de variable CSS (como --syn-comment) en un color hex
  // quitándole el # inicial: el foreground de una regla de Monaco va sin almohadilla.
  const hex = (name) => cssVar(name).replace("#", "");

  // Lista de reglas de sintaxis para Monaco, cada entrada es [token, css-var, estilo].
  // Los tonos se toman de las variables --syn-* en :root, evitando colores sueltos,
  // y se pasan a hex mediante hex() para compatibilidad con Monaco.
  const SYNTAX_RULES = [
    ["comment", "--syn-comment", "italic"],
    ["string", "--syn-string"],
    ["string.escape", "--syn-regexp"],
    ["regexp", "--syn-regexp"],
    ["number", "--syn-number"],
    ["constant", "--syn-constant"],
    ["keyword", "--syn-keyword"],
    ["keyword.flow", "--syn-control"],
    ["keyword.control", "--syn-control"],
    ["keyword.operator", "--syn-operator"],
    ["type", "--syn-type"],
    ["type.identifier", "--syn-type"],
    ["namespace", "--syn-type"],
    ["entity.name.class", "--syn-type"],
    ["entity.name.function", "--syn-function"],
    ["support.function", "--syn-function"],
    ["function", "--syn-function"],
    ["identifier", "--syn-variable"],
    ["variable", "--syn-variable"],
    ["variable.parameter", "--syn-variable"],
    ["operator", "--syn-operator"],
    ["operators", "--syn-operator"],
    ["delimiter", "--syn-operator"],
    ["tag", "--syn-tag"],
    ["metatag", "--syn-tag"],
    ["attribute.name", "--syn-attr"],
    ["attribute.value", "--syn-string"],
    ["annotation", "--syn-keyword"],
    ["key", "--syn-tag"],
    ["string.key", "--syn-tag"],
    ["string.value", "--syn-string"],
    ["invalid", "--syn-invalid"],
  ];

  const veilOn = () => !!(window.Veil && Veil.enabled());
  // Retorna el fondo del editor: transparente si el velo está activado, de lo contrario usa el
  // valor del CSS --editor-bg. Con el velo puesto el color ya lo pone .ed-host: si lo pintaran los
  // dos, los dos alfas se multiplicarían y el editor quedaría casi opaco.
  const codeBg = () => (veilOn() ? "#00000000" : cssVar("--editor-bg"));

  function defineTheme() {
    monaco.editor.defineTheme("dispatch", {
      base: "vs-dark",
      inherit: true,
      rules: SYNTAX_RULES.map(([token, name, fontStyle]) =>
        fontStyle ? { token, foreground: hex(name), fontStyle } : { token, foreground: hex(name) }
      ),
      colors: {
        "editor.background": codeBg(),
        "editor.foreground": cssVar("--code"),
        "editorGutter.background": codeBg(),
        "editorLineNumber.foreground": cssVar("--ghost"),
        "editorLineNumber.activeForeground": cssVar("--accent"),
        "editorCursor.foreground": cssVar("--accent"),
        "editor.lineHighlightBackground": cssVar("--syn-line"),
        "editor.selectionBackground": cssVar("--syn-selection"),
        "editor.inactiveSelectionBackground": cssVar("--syn-selection-soft"),
        "editor.selectionHighlightBackground": cssVar("--syn-selection-soft"),
        "editor.wordHighlightBackground": cssVar("--syn-selection-soft"),
        "editor.findMatchBackground": cssVar("--syn-find"),
        "editor.findMatchHighlightBackground": cssVar("--syn-selection-soft"),
        "editorBracketMatch.background": cssVar("--syn-selection-soft"),
        "editorBracketMatch.border": cssVar("--border-strong"),
        "editorIndentGuide.background1": cssVar("--syn-guide"),
        "editorIndentGuide.activeBackground1": cssVar("--syn-guide-active"),
        "editorWhitespace.foreground": cssVar("--syn-guide-active"),
        "editorBracketHighlight.foreground1": cssVar("--syn-bracket-1"),
        "editorBracketHighlight.foreground2": cssVar("--syn-bracket-2"),
        "editorBracketHighlight.foreground3": cssVar("--syn-bracket-3"),
        "editorBracketHighlight.foreground4": cssVar("--syn-bracket-4"),
        "editorBracketHighlight.foreground5": cssVar("--syn-bracket-5"),
        "editorBracketHighlight.foreground6": cssVar("--syn-bracket-6"),
        "editorWidget.background": cssVar("--panel"),
        "editorWidget.border": cssVar("--border"),
        "editorSuggestWidget.background": cssVar("--panel"),
        "editorSuggestWidget.selectedBackground": cssVar("--panel-3"),
        "input.background": cssVar("--panel-2"),
        "minimap.background": codeBg(),
        "scrollbarSlider.background": cssVar("--border-strong"),
      },
    });
    monaco.editor.setTheme("dispatch");
  }


  async function ensureEditor() {
    if (editor) return editor;
    monaco = await loadMonaco();
    defineTheme();
    editor = monaco.editor.create($("#edHost"), {
      automaticLayout: true,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      fontSize: 13,
      fontWeight: "450",
      lineHeight: 1.55,
      minimap: { enabled: true, renderCharacters: false },
      scrollBeyondLastLine: false,
      renderWhitespace: "selection",
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      smoothScrolling: true,
      cursorBlinking: "smooth",
      padding: { top: 8 },
      tabSize: 2,
      theme: "dispatch",
    });
    if (vsixTheme) applyTheme(vsixTheme);
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save());
    editor.onDidChangeCursorPosition((e) => {
      cursor = { line: e.position.lineNumber, column: e.position.column };
      updateCursor();
    });
    return editor;
  }

  // Un tema de extensión pisa al de la app mientras esté activo; sin tema
  // vuelve "dispatch", que sale de las variables de :root.
  let vsixTheme = null;

  // Reaplica el tema del editor, primero define el tema "dispatch" y luego aplica el tema de extensión si está activo
  function retheme() {
    if (!monaco) return;
    defineTheme();
    if (vsixTheme) applyTheme(vsixTheme);
  }

  function applyTheme(def) {
    vsixTheme = def;
    if (!monaco) return;
    if (!def) return monaco.editor.setTheme("dispatch");
    monaco.editor.defineTheme("vsix", { base: def.base || "vs-dark", inherit: true, rules: def.rules || [], colors: def.colors || {} });
    monaco.editor.setTheme("vsix");
  }

  // El cursor se mueve con cada tecla: se parchea su hueco en vez de repintar la
  // barra entera, como hace el timeline con el streaming de un run.
  function updateCursor() {
    const slot = document.querySelector(".ed-status-cursor");
    if (slot) slot.textContent = `Ln ${cursor.line}, Col ${cursor.column}`;
    else renderStatus();
  }
  // ---- Vistas del carril ----
  // Cada vista pinta dentro de #edView. La barra de arriba enseña las fijadas y
  // el chevron abre el resto; lo que no está fijado sigue siendo alcanzable.
  const VIEWS = [
    { id: "explorer", label: "Explorador", shortcut: "⇧⌘E", render: renderExplorer },
    { id: "search", label: "Buscar", shortcut: "⇧⌘F", render: renderSearchView },
    { id: "branches", label: "Ramas", shortcut: "⇧⌘B", render: renderBranchesView },
    { id: "notes", label: "Notas", shortcut: "⇧⌘N", render: renderNotesView },
    { id: "extensions", label: "Extensiones", shortcut: "⇧⌘X", render: renderExtensionsView },
    { id: "map", label: "Mapa de código", shortcut: "⇧⌘M", action: () => showTab("mapa") },
  ];

  const viewById = (id) => VIEWS.find((v) => v.id === id) || VIEWS[0];

  const viewBadge = (id) => (id === "notes" && notesPending() ? String(notesPending()) : "");

  // Pinta en la barra las vistas fijadas; el chevron abre el resto. Lo fijado es
  // una preferencia del usuario, así que vive en localStorage y no en el servidor.
  function renderActivity() {
    const host = $("#edActivity");
    const shown = VIEWS.filter((v) => pinned.includes(v.id));
    host.innerHTML =
      shown
        .map(
          (v) =>
            `<button class="ed-act${v.id === view && sideOpen ? " active" : ""}" data-view="${v.id}" ` +
            `title="${escapeAttr(`${v.label}  ${v.shortcut}`)}">${EdIcons.view(v.id)}` +
            (viewBadge(v.id) ? `<span class="ed-act-badge">${viewBadge(v.id)}</span>` : "") +
            `</button>`
        )
        .join("") +
      `<button class="ed-act ed-act-more" id="edMore" title="Más vistas">${EdIcons.view("chevron")}</button>`;

    host.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => pickView(btn.dataset.view));
    });
    $("#edMore").addEventListener("click", (e) => openViewMenu(e.currentTarget));
  }

  // El menú con todas las vistas, su atajo y su pin, montado sobre el mismo menú
  // flotante que usa la tarjeta de Git.
  function openViewMenu(anchor) {
    openGitMenu(
      anchor,
      VIEWS.map((v) => ({
        label: v.label,
        hint: v.shortcut,
        icon: EdIcons.view(v.id),
        checked: v.id === view && !v.action,
        onPick: () => pickView(v.id),
        pin: v.action
          ? null
          : {
              pinned: pinned.includes(v.id),
              icon: EdIcons.view("pin"),
              onPin: () => togglePin(v.id),
            },
      }))
    );
  }

  function togglePin(id) {
    pinned = pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id];
    writeStore("ed.pinned", pinned);
    renderActivity();
  }

  // Un clic en la vista que ya está abierta pliega el carril, como en VS Code.
  function pickView(id) {
    const target = viewById(id);
    if (target.action) return target.action();
    if (id === view && sideOpen) return setSide(false);
    view = id;
    writeStore("ed.view", view);
    setSide(true);
    renderView();
    renderActivity();
  }

  function setSide(open) {
    sideOpen = open;
    writeStore("ed.side", open);
    $("#edBody").classList.toggle("side-closed", !open);
    renderActivity();
    if (editor) requestAnimationFrame(() => editor.layout());
  }

  function renderView() {
    const host = $("#edView");
    host.innerHTML = "";
    host.dataset.view = view;
    viewById(view).render(host);
  }

  function viewHead(title, actions = []) {
    return (
      `<div class="ed-view-head"><span class="ed-view-title">${escapeHtml(title)}</span>` +
      `<span class="ed-view-acts">${actions
        .map(
          (a) =>
            `<button class="ed-view-act" data-act="${a.id}" title="${escapeAttr(a.title)}">${EdIcons.view(a.icon)}</button>`
        )
        .join("")}</span></div>`
    );
  }

  // ---- Vista: explorador ----
  function renderExplorer(host) {
    host.innerHTML =
      viewHead("EXPLORADOR", [
        { id: "newFile", icon: "newFile", title: "Archivo nuevo" },
        { id: "newDir", icon: "newDir", title: "Carpeta nueva" },
        { id: "reload", icon: "reload", title: "Releer la carpeta" },
        { id: "collapse", icon: "collapse", title: "Plegar todo" },
        { id: "more", icon: "ellipsis", title: "Más" },
      ]) +
      '<select id="edProject" class="ed-project"></select>' +
      '<div class="ed-tree" id="edTree"></div>';

    host.querySelector('[data-act="newFile"]').addEventListener("click", () => createEntry("file"));
    host.querySelector('[data-act="newDir"]').addEventListener("click", () => createEntry("dir"));
    host.querySelector('[data-act="reload"]').addEventListener("click", () => setRoot(root, { force: true }));
    host.querySelector('[data-act="collapse"]').addEventListener("click", () => {
      expanded.clear();
      renderTree();
    });
    host.querySelector('[data-act="more"]').addEventListener("click", (e) =>
      openGitMenu(e.currentTarget, [
        { label: "Proyecto nuevo…", icon: EdIcons.view("newDir"), onPick: createProject },
        { label: "Clonar repositorio…", icon: EdIcons.view("download"), onPick: cloneProject },
        { separator: "" },
        { label: "Releer la carpeta", icon: EdIcons.view("reload"), onPick: () => setRoot(root, { force: true }) },
      ])
    );
    host.querySelector("#edProject").addEventListener("change", (e) => setRoot(e.target.value));

    renderProjectPicker();
    renderTree();
  }

  // ---- Vista: buscar ----
  const searchState = { query: "", include: "", case: false, regex: false, word: false };
  let searchData = null;
  let searchBusy = false;
  let searchTimer = null;

  function renderSearchView(host) {
    const toggle = (id, label, title) =>
      `<button class="ed-toggle${searchState[id] ? " on" : ""}" data-opt="${id}" title="${escapeAttr(title)}">${label}</button>`;

    host.innerHTML =
      viewHead("BUSCAR") +
      `<div class="ed-search">
         <div class="ed-search-row">
           <input id="edQ" class="ed-input" type="text" placeholder="Buscar en el proyecto" value="${escapeAttr(searchState.query)}" />
           <span class="ed-toggles">
             ${toggle("case", "Aa", "Distinguir mayúsculas")}
             ${toggle("word", "ab|", "Palabra completa")}
             ${toggle("regex", ".*", "Expresión regular")}
           </span>
         </div>
         <input id="edInclude" class="ed-input small" type="text" placeholder="archivos a incluir: *.js, src/**" value="${escapeAttr(searchState.include)}" />
       </div>
       <div class="ed-results" id="edResults"></div>`;

    const box = host.querySelector("#edQ");
    const inc = host.querySelector("#edInclude");
    box.addEventListener("input", () => {
      searchState.query = box.value;
      queueSearch();
    });
    inc.addEventListener("input", () => {
      searchState.include = inc.value;
      queueSearch();
    });
    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runSearch();
    });
    host.querySelectorAll("[data-opt]").forEach((btn) =>
      btn.addEventListener("click", () => {
        searchState[btn.dataset.opt] = !searchState[btn.dataset.opt];
        btn.classList.toggle("on");
        runSearch();
      })
    );

    renderResults();
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }

  function queueSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 280);
  }

  // Lanza la búsqueda contra el servidor. Quien espera los 280 ms desde la última
  // tecla es queueSearch, para no mandar una petición por pulsación.
  async function runSearch() {
    clearTimeout(searchTimer);
    const q = searchState.query.trim();
    if (!root || !q) {
      searchData = null;
      return renderResults();
    }
    searchBusy = true;
    renderResults();
    const params = new URLSearchParams({ path: root, q });
    if (searchState.case) params.set("case", "1");
    if (searchState.regex) params.set("regex", "1");
    if (searchState.word) params.set("word", "1");
    if (searchState.include.trim()) params.set("include", searchState.include.trim());

    try {
      const res = await fetch(`/api/search?${params}`);
      const data = await res.json();
      searchData = res.ok ? data : { error: data.error || `HTTP ${res.status}` };
    } catch (err) {
      searchData = { error: err.message };
    }
    searchBusy = false;
    // La vista pudo cambiar mientras respondía
    if (view === "search") renderResults();
  }

  function renderResults() {
    const host = $("#edResults");
    if (!host) return;
    if (!root) return (host.innerHTML = '<div class="ed-view-empty">Elige un proyecto primero.</div>');
    if (searchBusy) return (host.innerHTML = '<div class="ed-view-empty">Buscando…</div>');
    if (!searchData) return (host.innerHTML = '<div class="ed-view-empty">Escribe qué buscar.</div>');
    if (searchData.error) return (host.innerHTML = `<div class="ed-view-empty error-text">${escapeHtml(searchData.error)}</div>`);
    if (!searchData.results.length) return (host.innerHTML = '<div class="ed-view-empty">Sin coincidencias.</div>');

    const head =
      `<div class="ed-results-head">${searchData.matches} en ${searchData.files} archivo${searchData.files === 1 ? "" : "s"}` +
      (searchData.truncated ? " · hay más, afina la búsqueda" : "") +
      "</div>";

    host.innerHTML =
      head +
      searchData.results
        .map(
          (file) => `
          <div class="ed-result">
            <div class="ed-result-head">
              <span class="ed-icon" style="color:${kindFor(file.name).color}">${iconFor(file.name)}</span>
              <span class="ed-name">${escapeHtml(file.name)}</span>
              <span class="ed-result-dir">${escapeHtml(file.dir === "." ? "" : file.dir)}</span>
              <span class="ed-result-count">${file.lines.length}</span>
            </div>
            ${file.lines
              .map(
                (hit) => `
              <button class="ed-hit" data-file="${escapeAttr(file.path)}" data-line="${hit.line}" data-col="${hit.start + 1}">
                <span class="ed-hit-line">${hit.line}</span>
                <span class="ed-hit-text">${highlight(hit)}</span>
              </button>`
              )
              .join("")}
          </div>`
        )
        .join("");

    host.querySelectorAll("[data-file]").forEach((btn) =>
      btn.addEventListener("click", () =>
        openFile(btn.dataset.file, { line: Number(btn.dataset.line), column: Number(btn.dataset.col) })
      )
    );
  }

  function highlight(hit) {
    const text = hit.text;
    return (
      escapeHtml(text.slice(0, hit.start)) +
      `<mark>${escapeHtml(text.slice(hit.start, hit.end))}</mark>` +
      escapeHtml(text.slice(hit.end))
    );
  }

  // ---- Vista: notas ----
  // Las mismas notas del dock, contra la carpeta del editor. Se piden aquí y no
  // se comparte el estado con app.js porque las dos vistas pueden mirar
  // carpetas distintas a la vez.
  let edNotes = [];
  let edNotesPath = null;
  let notesEditing = null;

  const notesPending = () => edNotes.filter((n) => !n.done).length;

  function renderNotesView(host) {
    host.innerHTML =
      viewHead("NOTAS") +
      `<form class="ed-note-form" id="edNoteForm">
         <input class="ed-input" id="edNoteBox" type="text" maxlength="4000" placeholder="Nota nueva y Enter" />
       </form>
       <div class="ed-notes" id="edNotes"></div>
       <div class="ed-notes-foot" id="edNotesFoot"></div>`;

    host.querySelector("#edNoteForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const box = host.querySelector("#edNoteBox");
      const text = box.value.trim();
      if (!text || !root) return;
      box.value = "";
      await notesWrite("/api/notes", { text });
    });

    host.querySelector("#edNotesFoot").addEventListener("click", (e) => {
      if (e.target.closest("[data-notes-clear]")) notesWrite("/api/notes", { done: true }, "DELETE");
    });

    renderNotesList();
    loadNotes();
  }

  async function loadNotes() {
    if (!root) {
      edNotes = [];
      edNotesPath = null;
      return renderNotesList();
    }
    edNotesPath = root;
    try {
      const res = await fetch(`/api/notes?path=${encodeURIComponent(root)}`);
      const data = await res.json();
      if (edNotesPath !== root) return;
      edNotes = res.ok ? data.items || [] : [];
    } catch (_) {
      edNotes = [];
    }
    renderNotesList();
  }

  async function notesWrite(url, body, method) {
    if (!root) return;
    try {
      const res = await fetch(url, {
        method: method || "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: root, ...body }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || `HTTP ${res.status}`);
      if (data.path && data.path !== root) return;
      edNotes = data.items || [];
      notesEditing = null;
      renderNotesList();
    } catch (err) {
      alert(err.message);
    }
  }

  function renderNotesList() {
    renderActivity();
    const host = $("#edNotes");
    const foot = $("#edNotesFoot");
    if (!host || !foot) return;
    if (notesEditing) return;

    if (!root) {
      foot.innerHTML = "";
      return (host.innerHTML = '<div class="ed-view-empty">Abre un proyecto para tener notas suyas.</div>');
    }
    if (!edNotes.length) {
      foot.innerHTML = "";
      return (host.innerHTML = '<div class="ed-view-empty">Sin notas en esta carpeta.</div>');
    }

    host.innerHTML = edNotes
      .map(
        (n) => `
        <div class="ed-note${n.done ? " done" : ""}" data-id="${escapeAttr(n.id)}">
          <input type="checkbox" ${n.done ? "checked" : ""} title="${n.done ? "Desmarcar" : "Marcar como hecha"}" />
          <span class="ed-note-text" title="Clic para editar">${escapeHtml(n.text)}</span>
          <button class="ed-note-del" title="Borrar">${EdIcons.view("close")}</button>
        </div>`
      )
      .join("");

    host.querySelectorAll(".ed-note").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector("input").addEventListener("change", (e) =>
        notesWrite("/api/notes/item", { id, done: e.target.checked })
      );
      row.querySelector(".ed-note-text").addEventListener("click", () => startNoteEdit(row, id));
      row.querySelector(".ed-note-del").addEventListener("click", () => notesWrite("/api/notes", { id }, "DELETE"));
    });

    const pending = notesPending();
    const done = edNotes.length - pending;
    foot.innerHTML =
      `<span>${pending} pendiente${pending === 1 ? "" : "s"}</span>` +
      (done
        ? `<button class="ed-chip" data-notes-clear>Limpiar ${done} hecha${done === 1 ? "" : "s"}</button>`
        : "");
  }

  function startNoteEdit(row, id) {
    const note = edNotes.find((n) => n.id === id);
    if (!note || notesEditing) return;
    notesEditing = id;

    const box = document.createElement("textarea");
    box.className = "ed-note-edit";
    box.value = note.text;
    box.rows = Math.min(6, note.text.split("\n").length + 1);
    row.querySelector(".ed-note-text").replaceWith(box);
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);

    const close = (save) => {
      if (notesEditing !== id) return;
      notesEditing = null;
      const text = box.value.trim();
      if (save && text && text !== note.text) notesWrite("/api/notes/item", { id, text });
      else renderNotesList();
    };
    box.addEventListener("blur", () => close(true));
    box.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        close(true);
      }
    });
  }

  // ---- Vista: ramas ----
  // Cambiar de rama aquí mismo o abrir la rama en su propia carpeta (git
  // worktree). Un worktree es un proyecto más de la lista, así que al abrirlo el
  // editor no hace nada especial: cambia de raíz como con cualquier carpeta.
  let branchData = null;
  let worktreeData = null;
  let branchBusy = false;

  function renderBranchesView(host) {
    host.innerHTML =
      viewHead("RAMAS", [
        { id: "newBranch", icon: "plus", title: "Crear una rama nueva" },
        { id: "reload", icon: "reload", title: "Releer las ramas" },
        { id: "more", icon: "ellipsis", title: "Más" },
      ]) + '<div class="ed-branches" id="edBranches"></div>';

    host.querySelector('[data-act="newBranch"]').addEventListener("click", createBranchHere);
    host.querySelector('[data-act="reload"]').addEventListener("click", () => loadBranches({ force: true }));
    host.querySelector('[data-act="more"]').addEventListener("click", (e) =>
      openGitMenu(e.currentTarget, [
        { label: "Crear rama nueva…", icon: EdIcons.view("plus"), onPick: createBranchHere },
        { label: "Limpiar registros de worktrees", icon: EdIcons.view("trash"), onPick: pruneWorktrees },
        { separator: "" },
        { label: "Releer las ramas", icon: EdIcons.view("reload"), onPick: () => loadBranches({ force: true }) },
      ])
    );

    renderBranchList();
    loadBranches();
  }

  async function loadBranches({ force = false } = {}) {
    if (!root) {
      branchData = null;
      worktreeData = null;
      return renderBranchList();
    }
    if (!force && branchData && branchData.for === root) return;
    try {
      const [b, w] = await Promise.all([
        fetch(`/api/git/branches?path=${encodeURIComponent(root)}`).then((r) => r.json()),
        fetch(`/api/git/worktrees?path=${encodeURIComponent(root)}`).then((r) => r.json()),
      ]);
      branchData = { ...b, for: root };
      worktreeData = w;
    } catch (_) {
      branchData = null;
      worktreeData = null;
    }
    renderBranchList();
  }

  const branchVar = (name) => (window.BranchColor ? BranchColor.branchColorVar(name) : null);

  function branchDot(name) {
    const v = branchVar(name);
    return `<span class="ed-branch-dot" style="background: ${v ? `var(${v})` : "var(--ghost)"}"></span>`;
  }

  function trackText(b) {
    const parts = [];
    if (b.ahead) parts.push(`↑${b.ahead}`);
    if (b.behind) parts.push(`↓${b.behind}`);
    if (b.gone) parts.push("sin remota");
    return parts.join(" ");
  }

  // Si una rama ya está en un worktree se ofrece "abrir" en vez de "cambiar": git
  // no deja sacar la misma rama en dos carpetas a la vez. Las carpetas de trabajo
  // solo se listan si hay más de una o si alguna se perdió.
  function renderBranchList() {
    const host = $("#edBranches");
    if (!host) return;
    if (!root) return (host.innerHTML = '<div class="ed-view-empty">Abre un proyecto para ver sus ramas.</div>');
    if (!branchData) return (host.innerHTML = '<div class="ed-view-empty">Leyendo las ramas…</div>');
    if (!branchData.repo) return (host.innerHTML = '<div class="ed-view-empty">Esta carpeta no está en un repositorio Git.</div>');

    const trees = (worktreeData && worktreeData.worktrees) || [];
    // Rama -> carpeta donde está sacada: es lo que decide si una rama se abre o
    // se cambia aquí. git no deja sacar la misma rama en dos worktrees.
    const byBranch = new Map(trees.filter((w) => w.branch).map((w) => [w.branch, w]));
    const current = branchData.current;

    const branchRow = (b) => {
      const tree = byBranch.get(b.name);
      const here = b.name === current;
      const track = trackText(b);
      const acts = here
        ? '<span class="ed-branch-here">aquí</span>'
        : tree
          ? `<button class="ed-chip" data-open="${escapeAttr(tree.path)}">abrir</button>`
          : `<button class="ed-chip" data-switch="${escapeAttr(b.name)}">cambiar</button>` +
            `<button class="ed-chip" data-worktree="${escapeAttr(b.name)}" title="Sacar esta rama en una carpeta nueva">+ carpeta</button>`;
      return (
        `<div class="ed-branch${here ? " here" : ""}">${branchDot(b.name)}` +
        `<span class="ed-branch-name" title="${escapeAttr(b.name)}">${escapeHtml(b.name)}</span>` +
        (track ? `<span class="ed-branch-track">${escapeHtml(track)}</span>` : "") +
        `<span class="ed-branch-acts">${acts}</span></div>`
      );
    };

    const treeRow = (w) => {
      const name = w.path.split("/").pop();
      const label = w.branch || (w.detached ? "HEAD suelto" : "sin rama");
      // La carpeta que se está editando no se ofrece para borrar: primero se abre
      // otra. Y la que ya no está en el disco solo se puede limpiar (prune).
      const acts = [
        w.current
          ? '<span class="ed-branch-here">abierta</span>'
          : w.exists === false
            ? ""
            : `<button class="ed-chip" data-open="${escapeAttr(w.path)}">abrir</button>`,
        w.main || w.current ? "" : `<button class="ed-chip danger" data-remove="${escapeAttr(w.path)}">quitar</button>`,
      ].join("");
      return (
        `<div class="ed-branch${w.current ? " here" : ""}">${branchDot(w.branch || "")}` +
        `<span class="ed-branch-name" title="${escapeAttr(w.path)}">${escapeHtml(name)}` +
        `<span class="ed-branch-sub">${escapeHtml(label)}${w.prunable ? " · perdida" : ""}${w.main ? " · principal" : ""}</span></span>` +
        `<span class="ed-branch-acts">${acts}</span></div>`
      );
    };

    const remotes = (branchData.remote || []).slice(0, 30);

    host.innerHTML =
      '<div class="ed-ext-sec">RAMAS LOCALES</div>' +
      ((branchData.local || []).map(branchRow).join("") || '<div class="ed-view-empty">Todavía no hay ramas.</div>') +
      (trees.length > 1 || trees.some((w) => w.prunable)
        ? '<div class="ed-ext-sec">CARPETAS DE TRABAJO</div>' + trees.map(treeRow).join("")
        : "") +
      (remotes.length
        ? '<div class="ed-ext-sec">REMOTAS</div>' +
          remotes
            .map(
              (b) =>
                `<div class="ed-branch">${branchDot(b.shortName)}` +
                `<span class="ed-branch-name" title="${escapeAttr(b.name)}">${escapeHtml(b.name)}</span>` +
                `<span class="ed-branch-acts">` +
                `<button class="ed-chip" data-track="${escapeAttr(b.name)}">sacar</button>` +
                `<button class="ed-chip" data-track-worktree="${escapeAttr(b.name)}" title="Sacarla en una carpeta nueva">+ carpeta</button>` +
                `</span></div>`
            )
            .join("")
        : "");

    host.querySelectorAll("[data-switch]").forEach((btn) =>
      btn.addEventListener("click", () => switchHere(btn.dataset.switch))
    );
    host.querySelectorAll("[data-worktree]").forEach((btn) =>
      btn.addEventListener("click", () => addWorktree(btn.dataset.worktree))
    );
    host.querySelectorAll("[data-track]").forEach((btn) =>
      btn.addEventListener("click", () => switchHere(btn.dataset.track, { track: true }))
    );
    host.querySelectorAll("[data-track-worktree]").forEach((btn) =>
      btn.addEventListener("click", () => addWorktree(btn.dataset.trackWorktree, { track: true }))
    );
    host.querySelectorAll("[data-open]").forEach((btn) =>
      btn.addEventListener("click", () => openWorktree(btn.dataset.open))
    );
    host.querySelectorAll("[data-remove]").forEach((btn) =>
      btn.addEventListener("click", () => removeWorktree(btn.dataset.remove))
    );
  }

  // Una escritura de git a la vez, y lo que responde el servidor es lo que se
  // enseña: un fallo llega como 200 con {ok:false, summary}.
  async function gitWrite(url, body, method) {
    if (branchBusy || !root) return null;
    branchBusy = true;
    try {
      const res = await fetch(url, {
        method: method || "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: root, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || `HTTP ${res.status}`);
        return null;
      }
      if (!data.ok) {
        alert(data.summary || data.output || "git no pudo hacerlo");
        return null;
      }
      return data;
    } catch (err) {
      alert(err.message);
      return null;
    } finally {
      branchBusy = false;
      loadBranches({ force: true });
    }
  }

  // Cambia a una rama local o remota. Con track, la rama que llega es la remota y
  // el servidor crea la local siguiéndola.
  async function switchHere(branch, { track = false } = {}) {
    const done = await gitWrite("/api/git/checkout", { branch, track });
    if (done) {
      flash(`Rama ${branch}`);
      loadGitMarks({ force: true });
    }
  }

  // Crea una rama y se cambia a ella. Con prompt() porque el panel no tiene
  // diálogos propios.
  function createBranchHere() {
    const name = prompt("Nombre de la rama nueva:");
    if (name === null) return;
    const clean = name.trim();
    if (!clean) return;
    gitWrite("/api/git/checkout", { branch: clean, create: true }).then((data) => {
      if (!data) return;
      flash(`Rama ${clean}`);
      loadGitMarks({ force: true });
    });
  }

  // Saca la rama en una carpeta nueva y se pasa a ella: el servidor ya la dio de
  // alta en Proyectos, así que el editor la abre como cualquier otro proyecto.
  async function addWorktree(branch, { track = false } = {}) {
    const data = await gitWrite("/api/git/worktree", { branch, track });
    if (!data || !data.worktree) return;
    flash(`${branch} en ${data.worktree.name}`);
    await setRoot(data.worktree.path);
  }

  // La carpeta puede no estar todavía en Proyectos (un worktree hecho a mano):
  // se da de alta antes, porque el árbol solo lee dentro de las registradas.
  async function openWorktree(dir) {
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dir }),
      });
    } catch (_) {}
    await setRoot(dir);
  }

  async function removeWorktree(dir) {
    if (!confirm(`Se borra la carpeta ${dir} del disco.\n\nLa rama y sus commits se quedan. ¿Seguir?`)) return;
    const data = await gitWrite("/api/git/worktree", { target: dir }, "DELETE");
    if (data) flash(`Quitada ${dir.split("/").pop()}`);
  }

  function pruneWorktrees() {
    gitWrite("/api/git/worktree/prune", {});
  }

  // ---- Vista: extensiones ----
  // El panel entero vive en extensions.js: aquí solo se le da la caja.
  function renderExtensionsView(host) {
    host.innerHTML = viewHead("EXTENSIONES");
    const box = document.createElement("div");
    box.className = "ed-ext-wrap";
    host.appendChild(box);
    EdExtensions.renderPanel(box);
  }

  // ---- Árbol de archivos ----
  async function loadDir(dir) {
    const res = await fetch(`/api/files/tree?path=${encodeURIComponent(dir)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    dirs.set(dir, data.entries);
    return data.entries;
  }

  function renderTree() {
    const host = $("#edTree");
    if (!host) return;
    host.innerHTML = "";
    if (!root) {
      host.innerHTML = '<div class="ed-tree-empty">Elige un proyecto arriba.</div>';
      return;
    }
    host.appendChild(renderLevel(root, 0));
  }

  function renderLevel(dir, depth) {
    const wrap = document.createElement("div");
    (dirs.get(dir) || []).forEach((entry) => {
      const open = entry.dir && expanded.has(entry.path);
      const marked = entry.dir ? entry.path === selectedDir : entry.path === activePath;
      const row = document.createElement("button");
      row.className = `ed-row ${entry.dir ? "dir" : "file"}${marked ? " active" : ""}`;
      row.style.paddingLeft = `${6 + depth * 11}px`;

      const mark = gitMarkFor(entry);
      const dirty = !entry.dir && files.get(entry.path)?.saved === false;
      row.innerHTML =
        (entry.dir
          ? `<span class="ed-caret${open ? " open" : ""}">${EdIcons.view("caret")}</span>` +
            `<span class="ed-icon dir">${dirIcon(open)}</span>`
          : `<span class="ed-caret"></span><span class="ed-icon" style="color:${kindFor(entry.name).color}">${iconFor(entry.name)}</span>`) +
        `<span class="ed-name">${escapeHtml(entry.name)}</span>` +
        (dirty ? `<span class="ed-dot">${EdIcons.view("dot")}</span>` : "") +
        (mark ? `<span class="ed-git ${mark.cls}">${escapeHtml(mark.letter)}</span>` : "");

      if (mark) row.classList.add(`git-${mark.cls}`);
      row.addEventListener("click", () => (entry.dir ? selectDir(entry.path) : openFile(entry.path)));
      wrap.appendChild(row);

      if (open) wrap.appendChild(renderLevel(entry.path, depth + 1));
    });
    return wrap;
  }

  // Un archivo enseña su letra de git; una carpeta, un punto si algo cambió
  // dentro. Las dos cosas salen del mismo /api/git que usa el carril derecho.
  function gitMarkFor(entry) {
    if (entry.dir) {
      return gitDirs.get(entry.path) ? { letter: "•", cls: "dir-dirty" } : null;
    }
    const hit = gitMarks.get(entry.path);
    if (!hit) return null;
    return { letter: hit.letter, cls: hit.kind || "modified" };
  }

  // El estado de git del árbol sale del mismo /api/git que usa la tarjeta del
  // carril derecho: una sola lectura del repositorio para las dos vistas.
  async function loadGitMarks({ force = false } = {}) {
    if (!root) {
      gitMarks = new Map();
      gitDirs = new Map();
      gitState = null;
      gitSig = "";
      return;
    }
    if (!force && gitRoot === root && gitMarks.size) return;
    try {
      const res = await fetch(`/api/git?path=${encodeURIComponent(root)}`);
      if (!res.ok) return;
      const data = await res.json();
      const before = gitState;
      gitRoot = root;
      gitState = {
        repo: !!data.repo,
        root: data.root || null,
        branch: data.branch || null,
        detached: !!data.detached,
        ahead: data.ahead || 0,
        behind: data.behind || 0,
      };

      const touched = data.files || [];
      // El sondeo pregunta cada pocos segundos: si nada cambió no se toca el DOM,
      // que se llevaría por delante el scroll del árbol.
      const sig = [gitState.branch, gitState.detached, ...touched.map((f) => `${f.path}${f.letter}${f.staged ? 1 : 0}`)].join("|");
      const changed = sig !== gitSig;
      gitSig = sig;

      gitMarks = new Map();
      gitDirs = new Map();
      if (data.repo && data.root) {
        touched.forEach((f) => {
          const abs = `${data.root}/${f.path}`;
          gitMarks.set(abs, f);
          let dir = dirName(abs);
          while (dir && dir.length >= root.length) {
            gitDirs.set(dir, (gitDirs.get(dir) || 0) + 1);
            dir = dirName(dir);
          }
        });
      }

      const switched = before && before.root === gitState.root && before.branch !== gitState.branch;
      if (changed) {
        renderTree();
        renderStatus();
        if (view === "branches") loadBranches({ force: true });
      }
      if (switched) onBranchSwitched(gitState.branch);
    } catch (_) {
      // el servidor puede estar reiniciándose: se reintenta al siguiente evento
    }
  }

  // Cambiar de rama reescribe el disco: el árbol se relee conservando lo que
  // estaba desplegado, los archivos abiertos se recargan y los que no existen en
  // la rama nueva se cierran si no tenían cambios.
  async function onBranchSwitched(branch) {
    flash(`Rama ${branch || "suelta"}: recargando`);
    await refreshOpenDirs();
    await checkExternalChanges({ closeMissing: true });
    renderTabs();
    renderCrumbs();
    renderStatus();
  }

  async function refreshOpenDirs() {
    if (!root) return;
    const open = [root, ...expanded];
    dirs.clear();
    for (const dir of open) {
      try {
        await loadDir(dir);
      } catch (_) {
        expanded.delete(dir);
      }
    }
    renderTree();
  }

  async function toggleDir(dir) {
    if (expanded.has(dir)) expanded.delete(dir);
    else {
      expanded.add(dir);
      if (!dirs.has(dir)) {
        try {
          await loadDir(dir);
        } catch (err) {
          expanded.delete(dir);
          alert(err.message);
        }
      }
    }
    renderTree();
  }

  // La carpeta seleccionada es el padre de lo que se cree después; sin ninguna,
  // la raíz del proyecto.
  function selectDir(dir) {
    selectedDir = dir;
    return toggleDir(dir);
  }

  const targetDir = () => selectedDir || root;

  async function reloadDir(dir) {
    dirs.delete(dir);
    try {
      await loadDir(dir);
    } catch (err) {
      alert(err.message);
    }
    renderTree();
  }

  // Pide el nombre y deja que el servidor decida: responde 409 si ya existe algo
  // con ese nombre, y aquí solo se enseña ese mensaje.
  async function createEntry(kind) {
    const parent = targetDir();
    if (!parent) return alert("Elige un proyecto arriba.");

    const label = kind === "dir" ? "Nombre de la carpeta nueva" : "Nombre del archivo nuevo";
    const name = prompt(`${label}\n\nDentro de ${tildePath(parent)}`);
    if (!name || !name.trim()) return;

    const target = `${parent}/${name.trim()}`;
    const res = await fetch(kind === "dir" ? "/api/files/mkdir" : "/api/files/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: target }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || `HTTP ${res.status}`);

    if (parent !== root) expanded.add(parent);
    await reloadDir(parent);
    if (kind === "dir") {
      selectedDir = data.path;
      renderTree();
    } else {
      await openFile(data.path);
    }
    flash(`Creado ${baseName(data.path)}`);
  }

  // El proyecto nuevo nace fuera de las carpetas ya registradas, así que la
  // carpeta padre se elige con el diálogo nativo y no con el árbol.
  function createProject() {
    requestFolder(async (parent) => {
      if (!parent) return;
      const name = prompt(`Nombre del proyecto nuevo\n\nSe crea dentro de ${tildePath(parent)}`);
      if (!name || !name.trim()) return;
      const git = confirm("¿Inicializar un repositorio Git dentro?");

      const res = await fetch("/api/projects/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent, name: name.trim(), git }),
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || `HTTP ${res.status}`);
      if (data.git && data.git.ok === false) alert(data.git.output);

      if (!projects.some((pr) => pr.path === data.project.path)) projects.unshift(data.project);
      await setRoot(data.project.path, { force: true });
      renderProjectPicker();
      flash(`Proyecto ${data.project.name} listo`);
    });
  }

  function cloneProject() {
    window.cloneRepo(async (project) => {
      if (!projects.some((pr) => pr.path === project.path)) projects.unshift(project);
      await setRoot(project.path, { force: true });
      renderProjectPicker();
      flash(`Clonado ${project.name}`);
    });
  }

  // ---- Archivos abiertos ----
  async function openFile(file, { line = 0, column = 1 } = {}) {
    await ensureEditor();
    if (!files.has(file)) {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(file)}`);
      const data = await res.json();
      if (!res.ok) return alert(data.error || `HTTP ${res.status}`);

      const model = monaco.editor.createModel(data.content, langFor(baseName(file)));
      const entry = { model, mtimeMs: data.mtimeMs, saved: true, state: null };
      model.onDidChangeContent(() => {
        if (entry.saved) {
          entry.saved = false;
          renderTabs();
          renderTree();
          renderStatus();
        }
      });
      files.set(file, entry);
    }

    if (activePath && activePath !== file && files.has(activePath)) {
      files.get(activePath).state = editor.saveViewState();
    }
    activePath = file;
    const entry = files.get(file);
    editor.setModel(entry.model);
    if (line) {
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column });
    } else if (entry.state) {
      editor.restoreViewState(entry.state);
    }
    editor.focus();
    renderTabs();
    renderTree();
    renderCrumbs();
    renderStatus();
    startWatching();
    loadTools();
  }

  function closeFile(file) {
    const entry = files.get(file);
    if (!entry) return;
    if (!entry.saved && !confirm(`"${baseName(file)}" tiene cambios sin guardar. ¿Cerrarlo igual?`)) return;
    entry.model.dispose();
    files.delete(file);
    if (activePath === file) {
      activePath = [...files.keys()][0] || null;
      if (activePath) editor.setModel(files.get(activePath).model);
      else editor.setModel(null);
    }
    renderTabs();
    renderTree();
    renderCrumbs();
    renderStatus();
  }

  function renderTabs() {
    const host = $("#edTabs");
    host.innerHTML = "";
    $("#edEmpty").hidden = files.size > 0;
    $("#edHost").hidden = files.size === 0;
    $("#edCrumbs").hidden = files.size === 0;

    files.forEach((entry, file) => {
      const tab = document.createElement("div");
      tab.className = `ed-tab ${file === activePath ? "active" : ""}${entry.saved ? "" : " dirty"}`;
      tab.title = tildePath(file);
      tab.innerHTML =
        `<span class="ed-tab-icon" style="color:${kindFor(baseName(file)).color}">${iconFor(baseName(file))}</span>` +
        `<span class="ed-tab-name">${escapeHtml(baseName(file))}</span>` +
        `<button class="ed-tab-close" title="Cerrar">${entry.saved ? EdIcons.view("close") : EdIcons.view("dot")}</button>`;
      tab.addEventListener("click", (e) => {
        if (e.target.closest(".ed-tab-close")) closeFile(file);
        else openFile(file);
      });
      host.appendChild(tab);
    });
  }

  // La miga de pan es la ruta dentro del proyecto: cada carpeta la selecciona en
  // el árbol. Los símbolos del archivo no salen porque Monaco no expone su
  // outline por API pública.
  function renderCrumbs() {
    const host = $("#edCrumbs");
    if (!activePath) {
      host.innerHTML = "";
      return;
    }
    const rel = root && activePath.startsWith(`${root}/`) ? activePath.slice(root.length + 1) : baseName(activePath);
    const parts = rel.split("/");
    const name = parts.pop();
    let walk = root;

    host.innerHTML =
      parts
        .map((part) => {
          walk = `${walk}/${part}`;
          return `<button class="ed-crumb" data-dir="${escapeAttr(walk)}">${escapeHtml(part)}</button><span class="ed-crumb-sep">${EdIcons.view("caret")}</span>`;
        })
        .join("") +
      `<span class="ed-crumb file"><span class="ed-crumb-icon" style="color:${kindFor(name).color}">${iconFor(name)}</span>${escapeHtml(name)}</span>`;

    host.querySelectorAll("[data-dir]").forEach((btn) =>
      btn.addEventListener("click", () => {
        expanded.add(btn.dataset.dir);
        if (!dirs.has(btn.dataset.dir)) loadDir(btn.dataset.dir).then(renderTree, () => {});
        selectedDir = btn.dataset.dir;
        pickView("explorer");
        renderTree();
      })
    );
  }

  // ---- Barra de estado ----
  let flashText = "";
  let flashBad = false;
  let gradleInfo = null;
  let gradleFor = null;
  let buildRunning = false;

  // El atajo de la barra: compila la carpeta abierta y la instala en el único
  // dispositivo listo. El log entero se ve en la pestaña Preview; aquí solo se
  // enseña en qué va, porque la barra es una línea.
  async function loadGradle() {
    if (gradleFor === root) return;
    gradleFor = root;
    gradleInfo = null;
    if (!root) return renderStatus();
    const asked = root;
    try {
      const res = await fetch(`/api/android/gradle?path=${encodeURIComponent(asked)}`);
      const data = await res.json();
      if (gradleFor !== asked) return;
      gradleInfo = res.ok && data && data.root ? data : null;
      buildRunning = Boolean(data && data.build && data.build.running);
    } catch (_) {
      gradleInfo = null;
    }
    renderStatus();
  }

  async function buildHere() {
    if (!gradleInfo || buildRunning) return;
    let devices = [];
    try {
      const state = await (await fetch("/api/android")).json();
      devices = (state.devices || []).filter((d) => d.state === "device");
    } catch (_) {}
    const serial = devices.length === 1 ? devices[0].serial : null;
    try {
      const res = await fetch("/api/android/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: root, variant: "debug", install: Boolean(serial), serial: serial || undefined }),
      });
      const data = await res.json();
      if (!res.ok) return flash(data.error || `HTTP ${res.status}`);
      buildRunning = true;
      renderStatus();
      flash(serial ? "Compilando e instalando…" : devices.length > 1 ? "Varios dispositivos: instala en Preview" : "Compilando…");
    } catch (err) {
      flash(err.message);
    }
  }

  window.addEventListener("android:build", (e) => {
    const ev = e.detail || {};
    if (ev.phase === "start") buildRunning = true;
    if (ev.phase === "done") {
      buildRunning = false;
      flash(ev.summary || (ev.ok ? "Compilado" : "Falló la compilación"));
    }
    if (ev.phase === "start" || ev.phase === "done") renderStatus();
  });

  // El diagnóstico es del orquestador, no de la carpeta abierta: a diferencia de
  // "compilar", que necesita gradlew, este botón está siempre.
  let diag = { running: false, done: 0, total: 0, failed: 0, ok: null };

  // Carga el diagnóstico previo: si está en curso, lo adopta; si hay un informe, lo muestra.
  // El diagnóstico pudo lanzarse desde Conexión, y la barra se dibuja después; al adoptar
  // uno en curso el total queda en 0 porque /api/debug no dice qué pasos lleva ese run.
  async function loadDiag() {
    try {
      const res = await fetch("/api/debug");
      if (!res.ok) return;
      const data = await res.json();
      if (data.running) diag = { running: true, done: 0, total: 0, failed: 0, ok: null };
      else if (data.last && data.last.summary) {
        const sum = data.last.summary;
        diag = { running: false, done: 0, total: sum.total, failed: sum.failed, ok: sum.ok };
      }
    } catch (_) {}
    renderStatus();
  }

  // Lanza el diagnóstico completo con body vacío para ejecutar solo los pasos no opcionales:
  // así quedan fuera recompilar la app y reiniciar el servidor, que desde aquí serían una trampa.
  // El total lo fija debug:start, porque el SSE puede llegar antes que la respuesta del POST.
  async function runDiag() {
    if (diag.running) return;
    diag = { running: true, done: 0, total: 0, failed: 0, ok: null };
    renderStatus();
    try {
      const res = await fetch("/api/debug/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) {
        diag.running = false;
        renderStatus();
        return flash(data.error || `HTTP ${res.status}`, true);
      }
      if (!diag.total) diag.total = (data.steps || []).length;
      renderStatus();
    } catch (err) {
      diag.running = false;
      renderStatus();
      flash(err.message, true);
    }
  }

  function diagLabel() {
    if (diag.running) return diag.total ? `diagnóstico ${diag.done}/${diag.total}` : "diagnóstico…";
    if (diag.ok === true) return "diagnóstico ✓";
    if (diag.ok === false) return `diagnóstico ⊗ ${diag.failed}`;
    return "diagnóstico";
  }

  const diagClass = () => (diag.running || diag.ok === null ? "" : diag.ok ? " diag-ok" : " diag-bad");

  // Genera el mensaje de flash del diagnóstico: muestra errores o éxito con detalles.
  // El informe entero se queda en Conexión; aquí solo cabe si salió bien y qué falló.
  function diagFlash(report) {
    if (report.error) return `Diagnóstico: ${report.error}`;
    const sum = report.summary || { total: 0, failed: 0, ok: false };
    if (sum.ok) return `Diagnóstico bien: ${sum.total} comprobaciones`;
    const malas = (report.results || []).filter((r) => r.status === "fail").map((r) => r.label || r.id);
    return malas.length ? `Diagnóstico: falla ${malas.join(", ")}` : `Diagnóstico: ${sum.failed} de ${sum.total} falla`;
  }

  window.addEventListener("debug:start", (e) => {
    const steps = (e.detail && e.detail.steps) || [];
    diag = { running: true, done: 0, total: steps.length, failed: 0, ok: null };
    renderStatus();
  });

  // Solo procesa eventos de paso que no sean 'running' ni 'log', para evitar ruido:
  // cada comprobación emite varios eventos y solo el terminal cuenta como avance.
  window.addEventListener("debug:step", (e) => {
    const ev = e.detail || {};
    if (!diag.running || ev.status === "running" || ev.status === "log") return;
    diag.done++;
    if (ev.status === "fail") diag.failed++;
    renderStatus();
  });

  window.addEventListener("debug:done", (e) => {
    const report = e.detail || {};
    const sum = report.summary;
    diag = { running: false, done: 0, total: sum ? sum.total : 0, failed: sum ? sum.failed : 0, ok: sum ? sum.ok : false };
    renderStatus();
    flash(diagFlash(report), !(sum && sum.ok));
  });

  function renderStatus() {
    const entry = activePath ? files.get(activePath) : null;
    const lang = activePath ? langFor(baseName(activePath)) : "";
    const counts = problems.length
      ? `${problems.filter((p) => p.severity === "error").length} ⊗  ${problems.filter((p) => p.severity !== "error").length} ⚠`
      : "sin problemas";
    const fmt = formatter();
    const host = $("#edStatus");

    const branch = gitState && gitState.repo ? (gitState.detached ? "HEAD suelto" : gitState.branch || "sin rama") : "";
    const track = gitState ? [gitState.ahead ? `↑${gitState.ahead}` : "", gitState.behind ? `↓${gitState.behind}` : ""].filter(Boolean).join(" ") : "";

    host.innerHTML =
      (branch
        ? `<button class="ed-status-item act ed-status-branch" data-branch title="Cambiar de rama">` +
          `${EdIcons.view("git")}<span>${escapeHtml(branch)}</span>${track ? `<span class="ed-status-track">${escapeHtml(track)}</span>` : ""}</button>`
        : "") +
      `<button class="ed-status-item act" data-problems title="Problemas del archivo">${escapeHtml(counts)}</button>` +
      (activePath && linters().length
        ? `<button class="ed-status-item act" data-lint${linting ? " disabled" : ""}>${linting ? "revisando…" : "revisar"}</button>`
        : "") +
      (fmt ? `<button class="ed-status-item act" data-format title="Formatear con ${escapeAttr(fmt.name)}">formatear</button>` : "") +
      (gradleInfo
        ? `<button class="ed-status-item act" data-build${buildRunning ? " disabled" : ""} title="./gradlew assembleDebug e instalar en el emulador">${
            buildRunning ? "compilando…" : "compilar"
          }</button>`
        : "") +
      `<button class="ed-status-item act${diagClass()}" data-diag${diag.running ? " disabled" : ""} ` +
      `title="Comprobaciones del orquestador; el informe entero está en Conexión">${escapeHtml(diagLabel())}</button>` +
      `<span class="push"></span>` +
      `<span class="ed-status-flash${flashBad ? " bad" : ""}">${escapeHtml(flashText)}</span>` +
      (entry && !entry.saved ? '<span class="ed-status-item dirty">sin guardar</span>' : "") +
      `<button class="ed-status-item act" data-save title="Guardar el archivo">Guardar ⌘S</button>` +
      `<span class="ed-status-item ed-status-cursor">Ln ${cursor.line}, Col ${cursor.column}</span>` +
      `<span class="ed-status-item">Espacios: 2</span>` +
      `<span class="ed-status-item">${escapeHtml(lang)}</span>`;

    host.querySelector("[data-branch]")?.addEventListener("click", (e) => openStatusBranchMenu(e.currentTarget));
    host.querySelector("[data-save]").addEventListener("click", () => save());
    host.querySelector("[data-problems]").addEventListener("click", () => setProblemsOpen(!problemsOpen));
    host.querySelector("[data-lint]")?.addEventListener("click", () => runLinters());
    host.querySelector("[data-format]")?.addEventListener("click", () => formatActive());
    host.querySelector("[data-build]")?.addEventListener("click", () => buildHere());
    host.querySelector("[data-diag]")?.addEventListener("click", () => runDiag());
  }

  // El menú rápido de la barra: las ramas recientes y la vista entera. Usa el
  // mismo menú flotante que la tarjeta de Git.
  async function openStatusBranchMenu(anchor) {
    await loadBranches();
    const local = (branchData && branchData.local) || [];
    const items = local.slice(0, 8).map((b) => ({
      label: b.name,
      hint: trackText(b),
      checked: b.current,
      onPick: () => (b.current ? null : switchHere(b.name)),
    }));
    if (items.length) items.push({ separator: "" });
    items.push({ label: "Crear rama nueva…", icon: EdIcons.view("plus"), onPick: createBranchHere });
    items.push({ label: "Ver todas las ramas", icon: EdIcons.view("git"), onPick: () => pickView("branches") });
    openGitMenu(anchor, items);
  }

  // Muestra un mensaje temporal en la barra de estado: dura 2.2s si es éxito, 6s si es error,
  // porque un fallo hay que poder leerlo antes de que desaparezca. El color cambia con flashBad.
  function flash(text, bad = false) {
    flashText = text;
    flashBad = bad;
    renderStatus();
    clearTimeout(flash.timer);
    flash.timer = setTimeout(() => {
      flashText = "";
      flashBad = false;
      renderStatus();
    }, bad ? 6000 : 2200);
  }

  // ---- Herramientas locales y panel de Problemas ----
  // La otra cara de las extensiones: lo que ya está instalado en el Mac. El
  // servidor las ejecuta (tools.js) y aquí solo se pintan sus problemas y se
  // marcan en Monaco.
  let toolList = [];
  let toolsFor = null;
  let problems = [];
  let problemsOpen = readStore("ed.problems", false);
  let linting = false;

  // El catálogo depende del archivo abierto, porque cada herramienta declara a qué
  // archivos se aplica: la clave de la caché lleva carpeta y archivo.
  async function loadTools() {
    if (!root) return;
    const key = `${root}::${activePath || ""}`;
    if (toolsFor === key) return;
    try {
      const params = new URLSearchParams({ path: root });
      if (activePath) params.set("file", activePath);
      const res = await fetch(`/api/tools?${params}`);
      if (!res.ok) return;
      toolList = (await res.json()).tools || [];
      toolsFor = key;
      renderStatus();
    } catch (_) {
      // el servidor puede estar reiniciándose
    }
  }

  const linters = () => toolList.filter((t) => t.kind === "lint" && t.available && (t.matches || t.projectWide));
  const formatter = () => toolList.find((t) => t.kind === "format" && t.available && t.matches);

  async function runLinters() {
    if (!activePath || linting) return;
    const list = linters();
    if (!list.length) return flash("Sin herramientas de revisión para este archivo");

    linting = true;
    renderStatus();
    const found = [];
    for (const tool of list) {
      try {
        const res = await fetch("/api/tools/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tool.id, path: activePath }),
        });
        const data = await res.json();
        if (res.ok && data.problems) found.push(...data.problems.map((p) => ({ ...p, tool: tool.id })));
        else if (data.error) flash(data.error);
      } catch (err) {
        flash(err.message);
      }
    }
    problems = found;
    linting = false;
    markProblems();
    if (found.length) setProblemsOpen(true);
    renderProblems();
    renderStatus();
    flash(found.length ? `${found.length} problema${found.length === 1 ? "" : "s"}` : "Sin problemas");
  }

  // Los problemas del archivo abierto se subrayan dentro de Monaco; los de otros
  // archivos solo salen en la lista, que es donde se puede saltar a ellos.
  function markProblems() {
    if (!monaco) return;
    files.forEach((entry, file) => {
      const mine = problems.filter((p) => p.file === file);
      monaco.editor.setModelMarkers(
        entry.model,
        "tools",
        mine.map((p) => ({
          startLineNumber: p.line,
          startColumn: p.column,
          endLineNumber: p.line,
          endColumn: p.column + 1,
          message: `${p.message}${p.rule ? ` (${p.rule})` : ""}`,
          severity: p.severity === "warning" ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error,
          source: p.tool,
        }))
      );
    });
  }

  function setProblemsOpen(open) {
    problemsOpen = open;
    writeStore("ed.problems", open);
    renderProblems();
    renderStatus();
    if (editor) requestAnimationFrame(() => editor.layout());
  }

  function renderProblems() {
    const host = $("#edProblems");
    host.hidden = !problemsOpen;
    if (!problemsOpen) return;

    const head = `
      <div class="ed-problems-head">
        <span>PROBLEMAS</span>
        <span class="mono muted small">${problems.length}</span>
        <button class="ed-view-act push" data-run title="Revisar de nuevo">${EdIcons.view("reload")}</button>
        <button class="ed-view-act" data-close title="Cerrar">${EdIcons.view("close")}</button>
      </div>`;

    host.innerHTML =
      head +
      (problems.length
        ? `<div class="ed-problems-list">${problems
            .map(
              (p, i) => `
          <button class="ed-problem ${p.severity}" data-problem="${i}">
            <span class="ed-problem-sev">${EdIcons.view("problems")}</span>
            <span class="ed-problem-msg">${escapeHtml(p.message)}</span>
            <span class="ed-problem-where">${escapeHtml(p.rel || baseName(p.file))}:${p.line}</span>
            <span class="ed-problem-rule">${escapeHtml(p.rule || p.tool || "")}</span>
          </button>`
            )
            .join("")}</div>`
        : '<div class="ed-view-empty">Nada que señalar.</div>');

    host.querySelector("[data-run]").addEventListener("click", () => runLinters());
    host.querySelector("[data-close]").addEventListener("click", () => setProblemsOpen(false));
    host.querySelectorAll("[data-problem]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const p = problems[Number(btn.dataset.problem)];
        openFile(p.file, { line: p.line, column: p.column });
      })
    );
  }

  // Formatear devuelve el texto entero: se aplica con pushEditOperations para no
  // perder el cursor ni el historial de deshacer, igual que la recarga externa.
  async function formatActive({ silent = false } = {}) {
    const tool = formatter();
    const entry = activePath && files.get(activePath);
    if (!tool || !entry) return false;

    try {
      const res = await fetch("/api/tools/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tool.id, path: activePath, content: entry.model.getValue() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (!silent) flash(data.error || data.output || "No se pudo formatear");
        return false;
      }
      if (data.content === entry.model.getValue()) return true;
      const model = entry.model;
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: data.content }], () => null);
      model.pushStackElement();
      if (!silent) flash(`Formateado con ${tool.name || tool.id}`);
      return true;
    } catch (err) {
      if (!silent) flash(err.message);
      return false;
    }
  }

  // ---- Guardar ----
  async function save() {
    if (!activePath) return;
    const entry = files.get(activePath);
    if (!entry) return;
    if (entry.saved) return flash("Sin cambios que guardar");
    if (readStore("ed.fmtOnSave", false)) await formatActive({ silent: true });

    const res = await fetch("/api/files/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: activePath, content: entry.model.getValue() }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || `HTTP ${res.status}`);

    entry.saved = true;
    entry.mtimeMs = data.mtimeMs;
    renderTabs();
    renderTree();
    flash(`Guardado ${baseName(activePath)}`);
  }

  // ---- Vigilar cambios de Claude Code ----
  // Si Claude Code toca un archivo abierto y tú no lo has tocado, se recarga
  // solo. Si lo has tocado, no se pisa: se avisa y decides tú.
  function startWatching() {
    if (watchTimer) return;
    watchTimer = setInterval(() => {
      checkExternalChanges();
      pollGit();
    }, 3000);
  }

  // La rama también cambia por fuera del panel (la terminal, Claude Code) y eso
  // no emite ningún evento: la única forma de enterarse es volver a preguntar.
  // Solo mientras el editor está delante, como hace la tarjeta de Git.
  let lastGitPoll = 0;

  function pollGit() {
    if (!root || document.hidden || !document.querySelector("#tab-editor.active")) return;
    if (Date.now() - lastGitPoll < GIT_POLL_MS) return;
    lastGitPoll = Date.now();
    loadGitMarks({ force: true });
  }

  async function checkExternalChanges({ closeMissing = false } = {}) {
    const paths = [...files.keys()];
    if (!paths.length || document.hidden) return;

    try {
      const res = await fetch("/api/files/stat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      if (!res.ok) return;
      for (const row of await res.json()) {
        const entry = files.get(row.path);
        if (!entry) continue;
        if (row.missing) {
          if (!closeMissing) continue;
          if (entry.saved) {
            closeFile(row.path);
            flash(`${baseName(row.path)} no está en esta rama`);
          } else {
            flash(`${baseName(row.path)} no está en esta rama y tienes cambios sin guardar`);
          }
          continue;
        }
        if (row.mtimeMs === entry.mtimeMs) continue;
        if (!entry.saved) {
          flash(`${baseName(row.path)} cambió en disco y tienes cambios sin guardar`);
          entry.mtimeMs = row.mtimeMs;
          continue;
        }
        const read = await fetch(`/api/files/read?path=${encodeURIComponent(row.path)}`);
        if (!read.ok) continue;
        const data = await read.json();
        // setValue movería el cursor al principio: pushEditOperations lo respeta
        const model = entry.model;
        model.pushEditOperations([], [{ range: model.getFullModelRange(), text: data.content }], () => null);
        model.pushStackElement();
        entry.mtimeMs = data.mtimeMs;
        entry.saved = true;
        flash(`${baseName(row.path)} se recargó: ${closeMissing ? "cambió la rama" : "lo cambió Claude Code"}`);
        renderTabs();
      }
    } catch (_) {
      // el servidor puede estar reiniciándose: se reintenta al siguiente tic
    }
  }

  // ---- Proyecto ----
  function renderProjectPicker() {
    const sel = $("#edProject");
    if (!sel) return;
    sel.innerHTML = '<option value="">Elige un proyecto…</option>';
    projects
      .filter((p) => p.exists !== false)
      .forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.path;
        opt.textContent = p.name;
        sel.appendChild(opt);
      });
    sel.value = root || "";
  }

  async function setRoot(dir, { force = false } = {}) {
    if (!dir) {
      root = null;
      selectedDir = null;
      return renderTree();
    }
    if (dir === root && !force) return;
    root = dir;
    selectedDir = dir;
    dirs.clear();
    expanded.clear();
    try {
      await loadDir(root);
    } catch (err) {
      alert(err.message);
      root = null;
    }
    renderTree();
    renderProjectPicker();
    gitState = null;
    gitSig = "";
    branchData = null;
    worktreeData = null;
    loadGitMarks({ force: true });
    loadNotes();
    if (view === "branches") loadBranches({ force: true });
    if (view === "search") runSearch();
    toolsFor = null;
    loadTools();
    loadGradle();
  }

  // ---- Entrada desde el panel ----
  // showTab("editor") llama aquí cada vez que se abre la pestaña.
  async function open() {
    if (!$("#edActivity").children.length) {
      renderActivity();
      renderView();
      setSide(sideOpen);
      renderStatus();
      loadDiag();
    }
    if (!root) {
      const first = projects.find((p) => p.exists !== false);
      if (first) await setRoot(first.path);
      else renderProjectPicker();
    } else {
      renderProjectPicker();
      renderTree();
    }
    if (files.size) await ensureEditor();
    renderTabs();
    renderCrumbs();
    renderProblems();
    loadTools();
    startWatching();
    EdExtensions.init();
  }

  const SHORTCUTS = { e: "explorer", f: "search", b: "branches", n: "notes", x: "extensions", m: "map" };

  window.addEventListener("keydown", (e) => {
    if (!document.querySelector("#tab-editor.active")) return;
    const meta = e.metaKey || e.ctrlKey;
    if (!meta) return;
    const key = e.key.toLowerCase();

    // ⌘S funciona aunque el foco no esté dentro de Monaco
    if (key === "s" && !e.shiftKey) {
      e.preventDefault();
      return save();
    }
    if (e.shiftKey && SHORTCUTS[key]) {
      e.preventDefault();
      pickView(SHORTCUTS[key]);
    }
  });

  // Claude Code y la terminal cambian archivos por fuera del panel: el mismo
  // evento que refresca la tarjeta de Git repinta las letras del árbol.
  window.addEventListener("ed:git-changed", () => loadGitMarks({ force: true }));
  window.addEventListener("ed:notes-changed", (e) => {
    if (root && e.detail && e.detail.path === root) loadNotes();
  });

  const refreshIcons = () => {
    renderTree();
    renderTabs();
    renderCrumbs();
  };

  return {
    open,
    setRoot,
    openFile,
    applyTheme,
    retheme,
    refreshIcons,
    rootPath: () => root,
    refreshGit: () => loadGitMarks({ force: true }),
  };
})();
