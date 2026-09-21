const test = require("node:test");
const assert = require("node:assert");
const search = require("../search");

test("queryError rechaza la consulta vacía y la larguísima", () => {
  assert.equal(search.queryError(""), "Escribe qué buscar");
  assert.equal(search.queryError("   "), "Escribe qué buscar");
  assert.equal(search.queryError(null), "Escribe qué buscar");
  assert.equal(search.queryError("a".repeat(401)), "La búsqueda es demasiado larga");
  assert.equal(search.queryError("renderGit"), null);
});

test("buildMatcher escapa lo que el usuario escribió, salvo en modo regex", () => {
  const literal = search.buildMatcher("a.b");
  assert.ok(literal.test("a.b"));
  literal.lastIndex = 0;
  assert.equal(literal.test("axb"), false);

  const regex = search.buildMatcher("a.b", { regex: true });
  assert.ok(regex.test("axb"));
});

test("buildMatcher respeta mayúsculas solo si se le pide", () => {
  assert.ok(search.buildMatcher("hola").test("HOLA"));
  assert.equal(search.buildMatcher("hola", { caseSensitive: true }).test("HOLA"), false);
});

test("buildMatcher con palabra completa no casa dentro de otra palabra", () => {
  const whole = search.buildMatcher("run", { word: true });
  assert.ok(whole.test("run()"));
  whole.lastIndex = 0;
  assert.equal(whole.test("running"), false);
});

test("globToRegExp entiende *, **, ? y las llaves", () => {
  assert.ok(search.globToRegExp("*.js").test("app.js"));
  assert.equal(search.globToRegExp("*.js").test("src/app.js"), false);
  assert.ok(search.globToRegExp("src/**/*.js").test("src/a/b/app.js"));
  assert.ok(search.globToRegExp("*.{js,css}").test("styles.css"));
  assert.ok(search.globToRegExp("a?c.js").test("abc.js"));
  assert.equal(search.globToRegExp("a?c.js").test("ac.js"), false);
});

test("makeFilter sin globs deja pasar todo y con varios compara también el nombre", () => {
  assert.ok(search.makeFilter("")("cualquier/cosa.bin"));
  const filter = search.makeFilter("*.js, src/**");
  assert.ok(filter("public/app.js"));
  assert.ok(filter("src/interno/nota.md"));
  assert.equal(filter("docs/lee.md"), false);
});

test("trimLine deja la línea corta como está", () => {
  assert.deepEqual(search.trimLine("hola mundo", 0, 4), { text: "hola mundo", start: 0, end: 4 });
});

test("trimLine recorta por la derecha si el acierto está al principio", () => {
  const cut = search.trimLine("a".repeat(500), 100, 200);
  assert.equal(cut.text, "a".repeat(400) + "…");
  assert.equal(cut.start, 100);
  assert.equal(cut.end, 200);
});

test("trimLine deja contexto por delante si el acierto está al final", () => {
  const cut = search.trimLine("a".repeat(900), 800, 810);
  assert.equal(cut.text, "…" + "a".repeat(220));
  assert.equal(cut.start, 121);
  assert.equal(cut.end, 131);
});

test("searchText devuelve una entrada por línea, no una por coincidencia", () => {
  const text = "buscando buscando aquí\nsin nada\notra buscando más";
  const hits = search.searchText(text, search.buildMatcher("buscando"));
  assert.deepEqual(hits, [
    { line: 1, text: "buscando buscando aquí", start: 0, end: 8 },
    { line: 3, text: "otra buscando más", start: 5, end: 13 },
  ]);
});

test("searchText corta en el tope por archivo", () => {
  const text = Array.from({ length: 10 }, () => "hit").join("\n");
  assert.equal(search.searchText(text, search.buildMatcher("hit"), { perFile: 3 }).length, 3);
});

test("searchText no devuelve nada cuando no hay coincidencias", () => {
  assert.deepEqual(search.searchText("nada que ver", search.buildMatcher("sí")), []);
});

test("searchText cuenta un carácter cuando el patrón casa el vacío", () => {
  const hits = search.searchText("   ", search.buildMatcher("a*", { regex: true }));
  assert.deepEqual(hits, [{ line: 1, text: "   ", start: 0, end: 1 }]);
});

test("searchText ignora el retorno de carro de los archivos con CRLF", () => {
  const hits = search.searchText("const a = 1;\r\n", search.buildMatcher("1;"));
  assert.deepEqual(hits, [{ line: 1, text: "const a = 1;", start: 10, end: 12 }]);
});
