// Decide qué tarjetas manuales del tablero kanban faltan por recibir a Claude Code.
// Arma el prompt con la semántica de cada columna: en curso (hazla ya), errores (arréglalo),
// revisión (revisa y reporta), por hacer (pregunta antes).
// Incluye notas pendientes al cerrar un plan y el envoltorio de bracketed paste para teclear en terminal.
// Orden de entrega: lo que está en curso va justo después de lo actual; lo de
// por hacer va al final porque solo se propone y se pregunta.
const DELIVERY_ORDER = ["progress", "errors", "review", "todo"];

const COLUMN_TEXT = {
  progress: {
    title: "En curso — hazlas ahora, sin preguntar, una tras otra",
    how: 'Al terminar cada una muévela a revisión: {"column":"review"}.',
  },
  errors: {
    title: "Errores — algo falla: investiga la causa y arréglalo",
    how: 'Cuando quede arreglado muévela a revisión: {"column":"review"}.',
  },
  review: {
    title: "Revisión — revisa lo que se hizo para esa tarea y repórtame",
    how: "No cambies código sin decírmelo antes. Deja la tarjeta donde está: a hecho la muevo yo.",
  },
  todo: {
    title: "Por hacer — propónmelas y pregúntame antes de empezar",
    how: 'No empieces ninguna sin mi respuesta. Si te digo que sí, muévela a en curso: {"column":"progress"}.',
  },
};

// Devuelve las tarjetas pendientes de entrega en el orden definido por DELIVERY_ORDER.
// Una tarjeta está pendiente si no ha sido entregada en su columna actual.
function pendingCards(plan) {
  if (!plan || !Array.isArray(plan.steps)) return [];
  return plan.steps
    .filter((s) => s.manual && DELIVERY_ORDER.includes(s.column) && s.deliveredColumn !== s.column)
    .sort(
      (a, b) =>
        DELIVERY_ORDER.indexOf(a.column) - DELIVERY_ORDER.indexOf(b.column) ||
        (a.sort ?? 0) - (b.sort ?? 0)
    );
}

// Marca todas las tarjetas como entregadas en su columna actual, con la fecha de entrega.
// Si se mueve una tarjeta, se vuelve a entregar en la nueva columna.
function markDelivered(cards, at = new Date().toISOString()) {
  cards.forEach((c) => {
    c.deliveredColumn = c.column;
    c.deliveredAt = at;
  });
}

// Genera un prompt con las tarjetas del tablero, agrupadas por columna y con instrucciones de uso.
// Las descripciones se reducen a una línea para que cada tarjeta ocupe un renglón con su id.
function cardsPrompt(cards, { port = 3131 } = {}) {
  if (!cards.length) return "";
  const sections = DELIVERY_ORDER.map((column) => {
    const group = cards.filter((c) => c.column === column);
    if (!group.length) return null;
    const { title, how } = COLUMN_TEXT[column];
    const items = group.map((c) => `- [${c.id}] ${String(c.description).replace(/\s+/g, " ").trim()}`);
    return `${title}:\n${items.join("\n")}\n${how}`;
  }).filter(Boolean);

  return [
    "Tarjetas que te dejé en el tablero del panel.",
    "",
    sections.join("\n\n"),
    "",
    "Para mover una tarjeta:",
    `  curl -s -X POST http://localhost:${port}/api/plan/step/<id> -H "Content-Type: application/json" -d '{"column":"..."}'`,
    "Si una tarjeta es de varios pasos, sigue el ciclo de siempre: plan y aprobación.",
  ].join("\n");
}

// Genera un prompt con las notas pendientes del proyecto, mostrando solo las no completadas.
// Incluye la orden de preguntar al usuario antes de empezar ninguna.
function notesPrompt(items) {
  const pending = (items || []).filter((n) => !n.done && String(n.text || "").trim());
  if (!pending.length) return "";
  const list = pending.map((n) => `- ${String(n.text).replace(/\s+/g, " ").trim()}`);
  return [
    "Cerraste el plan. Estas son mis notas pendientes en este proyecto:",
    "",
    list.join("\n"),
    "",
    "Enséñamelas y pregúntame si quiero seguir con alguna. No empieces ninguna sin mi respuesta.",
  ].join("\n");
}

// Envuelve el texto en el formato de pegado (bracketed paste) para que Claude lo reciba como múltiples líneas.
// Elimina los caracteres ESC del texto para evitar que se cierre el modo de pegado prematuramente.
function asPaste(text) {
  return `\x1b[200~${String(text).replace(/\x1b/g, "")}\x1b[201~`;
}

module.exports = { DELIVERY_ORDER, pendingCards, markDelivered, cardsPrompt, notesPrompt, asPaste };
