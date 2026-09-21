const test = require("node:test");
const assert = require("node:assert/strict");

const { branchColorVar, rememberBranch, BRANCH_VARS } = require("../public/branchcolor");

test("main, master y trunk devuelven --branch-main", () => {
  assert.equal(branchColorVar("main"), "--branch-main");
  assert.equal(branchColorVar("MASTER"), "--branch-main");
  assert.equal(branchColorVar("Trunk"), "--branch-main");
  assert.equal(branchColorVar("  main  "), "--branch-main");
});

test("una rama cualquiera devuelve siempre la misma variable", () => {
  assert.equal(branchColorVar("feature/abc"), branchColorVar("feature/abc"));
});

test("la variable siempre es una de las cuatro de BRANCH_VARS", () => {
  ["feature/xyz", "dev", "hotfix/1", "release", "saul/pruebas"].forEach((name) => {
    assert.ok(BRANCH_VARS.includes(branchColorVar(name)), name);
  });
});

test("ramas distintas no se reparten todas el mismo color", () => {
  const names = ["dev", "feature/login", "hotfix/1", "release/2", "pruebas", "docs"];
  const used = new Set(names.map(branchColorVar));
  assert.ok(used.size > 1);
});

test("una rama vacía, null o undefined no tiene color", () => {
  assert.equal(branchColorVar(""), null);
  assert.equal(branchColorVar("   "), null);
  assert.equal(branchColorVar(null), null);
  assert.equal(branchColorVar(undefined), null);
});

test("rememberBranch pone la rama nueva la primera", () => {
  assert.deepEqual(rememberBranch(["a", "b"], "c"), ["c", "a", "b"]);
});

test("una rama que ya estaba sube al frente y no se duplica", () => {
  assert.deepEqual(rememberBranch(["a", "c"], "c"), ["c", "a"]);
});

test("la lista se recorta al tope, que por defecto es cinco", () => {
  assert.deepEqual(rememberBranch(["a", "b", "c", "d", "e", "f"], "g", 3), ["g", "a", "b"]);
  assert.deepEqual(rememberBranch(["a", "b", "c", "d", "e", "f"], "g"), ["g", "a", "b", "c", "d"]);
});

test("una lista ausente o con entradas vacías no rompe nada", () => {
  assert.deepEqual(rememberBranch(null, "a"), ["a"]);
  assert.deepEqual(rememberBranch(["", "a", "b"], "c"), ["c", "a", "b"]);
  assert.deepEqual(rememberBranch(["a", "b"], ""), ["a", "b"]);
});
