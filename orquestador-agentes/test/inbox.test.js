const test = require("node:test");
const assert = require("node:assert/strict");
const { pendingCards, markDelivered, cardsPrompt, notesPrompt, asPaste } = require("../inbox");

const card = (id, column, extra = {}) => ({ id, description: `Tarea ${id}`, column, manual: true, ...extra });

test("pendingCards ignora las de Claude, las hechas y las ya entregadas en su columna", () => {
  const plan = {
    steps: [
      card("a", "todo", { manual: false }),
      card("b", "done"),
      card("c", "review", { deliveredColumn: "review" }),
      card("d", "todo"),
    ],
  };
  assert.deepEqual(pendingCards(plan).map((c) => c.id), ["d"]);
});

test("pendingCards vuelve a entregar una tarjeta que cambió de columna", () => {
  const plan = { steps: [card("a", "errors", { deliveredColumn: "todo" })] };
  assert.deepEqual(pendingCards(plan).map((c) => c.id), ["a"]);
});

test("pendingCards ordena progress, errors, review, todo y luego por sort", () => {
  const plan = {
    steps: [
      card("t", "todo", { sort: 1 }),
      card("r", "review", { sort: 1 }),
      card("p2", "progress", { sort: 2 }),
      card("e", "errors", { sort: 1 }),
      card("p1", "progress", { sort: 1 }),
    ],
  };
  assert.deepEqual(pendingCards(plan).map((c) => c.id), ["p1", "p2", "e", "r", "t"]);
});

test("pendingCards devuelve [] sin plan o sin pasos", () => {
  assert.deepEqual(pendingCards(null), []);
  assert.deepEqual(pendingCards({}), []);
  assert.deepEqual(pendingCards({ steps: [] }), []);
});

test("markDelivered apunta la columna y la fecha", () => {
  const cards = [card("a", "todo"), card("b", "progress", { deliveredColumn: "todo" })];
  markDelivered(cards, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(
    cards.map((c) => [c.deliveredColumn, c.deliveredAt]),
    [
      ["todo", "2026-01-01T00:00:00.000Z"],
      ["progress", "2026-01-01T00:00:00.000Z"],
    ]
  );
  assert.deepEqual(pendingCards({ steps: cards }), []);
});

test("cardsPrompt vacío sin tarjetas", () => {
  assert.equal(cardsPrompt([]), "");
});

test("cardsPrompt lleva ids, descripciones en una línea y solo las secciones presentes", () => {
  const text = cardsPrompt([card("card-1", "progress", { description: "Arregla\n  el login" }), card("card-2", "todo")], {
    port: 4000,
  });
  assert.match(text, /- \[card-1\] Arregla el login/);
  assert.match(text, /- \[card-2\] Tarea card-2/);
  assert.match(text, /^En curso/m);
  assert.match(text, /^Por hacer/m);
  assert.doesNotMatch(text, /^Revisión/m);
  assert.doesNotMatch(text, /^Errores/m);
  assert.match(text, /http:\/\/localhost:4000\/api\/plan\/step\/<id>/);
  assert.ok(text.indexOf("En curso") < text.indexOf("Por hacer"));
});

test("notesPrompt solo lista las pendientes con texto", () => {
  assert.equal(notesPrompt(undefined), "");
  assert.equal(notesPrompt([{ text: "hecha", done: true }, { text: "   ", done: false }]), "");
  const text = notesPrompt([
    { text: "probar\nnotas", done: false },
    { text: "ya está", done: true },
  ]);
  assert.match(text, /- probar notas/);
  assert.doesNotMatch(text, /ya está/);
});

test("asPaste envuelve en bracketed paste y quita los ESC del texto", () => {
  assert.equal(asPaste("hola\x1b[201~mundo"), "\x1b[200~hola[201~mundo\x1b[201~");
});
