// Tests de las partes puras del servidor de vista previa. Se ejecutan con:
//   node --test test/preview.test.js
// Lo que se prueba aquí es lo que decide qué se sirve y qué no: los archivos
// ocultos, la inyección del script de recarga y qué URLs se dejan abrir fuera.

const test = require("node:test");
const assert = require("node:assert/strict");

const { hiddenSegment, liveKind, injectReload, directoryListing, localUrlError, LIVE_SNIPPET } = require("../preview");

test("hiddenSegment con ruta vacía", () => {
  assert.ok(!hiddenSegment(""));
});

test("hiddenSegment con .env", () => {
  assert.ok(hiddenSegment(".env"));
});

test("hiddenSegment con node_modules por el medio", () => {
  assert.ok(hiddenSegment("dir/node_modules/file.js"));
});

test("hiddenSegment con ruta normal", () => {
  assert.ok(!hiddenSegment("public/index.html"));
});

test("liveKind con .CSS en mayúsculas", () => {
  assert.equal(liveKind(".CSS"), "css");
});

test("injectReload con </body>", () => {
  assert.equal(injectReload("<html><body>hola</body></html>", "<S>"), "<html><body>hola<S></body></html>");
});

test("injectReload sin </body> lo deja al final", () => {
  assert.equal(injectReload("<h1>hola</h1>", "<S>"), "<h1>hola</h1><S>");
});

test("injectReload con dos </body> usa el último", () => {
  assert.equal(injectReload("<body>a</body>b</body>", "<S>"), "<body>a</body>b<S></body>");
});

test("injectReload con cadena vacía", () => {
  const result = injectReload("");
  assert.ok(result.includes(LIVE_SNIPPET));
});

test("directoryListing con lista vacía", () => {
  assert.equal(directoryListing("", []), "<!doctype html><meta charset=\"utf-8\"><title>/</title><style>body{font:14px ui-monospace,monospace;margin:32px;background:#111;color:#ddd}a{color:#e8b339;text-decoration:none}a:hover{text-decoration:underline}li{margin:3px 0}</style><h1>/</h1><ul><li>(vacío)</li></ul>");
});

test("directoryListing con carpetas y archivos", () => {
  const entries = [
    { name: "file.txt", dir: false },
    { name: "folder/", dir: true },
    { name: "config.json", dir: false }
  ];
  const result = directoryListing("root", entries);
  assert.ok(result.includes("file.txt"));
  assert.ok(result.includes("folder/"));
  assert.ok(result.includes("config.json"));
});

test("directoryListing escapa < y & del nombre", () => {
  const result = directoryListing("", [{ name: "archivo<&.txt", dir: false }]);
  assert.ok(result.includes("archivo&lt;&amp;.txt"));
  assert.ok(!result.includes("archivo<&.txt"));
});

test("localUrlError con http://localhost:3000", () => {
  assert.equal(localUrlError("http://localhost:3000"), null);
});

test("localUrlError con http://127.0.0.1:5173/x", () => {
  assert.equal(localUrlError("http://127.0.0.1:5173/x"), null);
});

test("localUrlError con URL de fuera", () => {
  assert.equal(localUrlError("https://example.com"), "Solo se abren direcciones de esta máquina");
});

test("localUrlError con file:///etc/passwd", () => {
  assert.equal(localUrlError("file:///etc/passwd"), "Solo se abren URLs http o https");
});

test("localUrlError con texto que no es URL", () => {
  assert.equal(localUrlError("hola"), "No parece una URL");
});
