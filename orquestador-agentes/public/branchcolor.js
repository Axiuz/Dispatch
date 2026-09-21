// Determina el color con el que la tarjeta de Control de código pinta cada rama de Git.
// Las ramas principales (main, master, trunk) siempre llevan el oro de la marca.
// Las demás se asignan mediante un hash del nombre para repartir los colores, y ese
// hash es lo que hace que la misma rama se vea siempre igual.
// El color se devuelve como el nombre de una variable CSS (por ejemplo, "--branch-1").
// También calcula la lista de ramas recientes, pero no la guarda: quien guarda es el panel.
// Puro y sin estado, y por eso vive aparte: se prueba con node --test igual que kanban.js,
// y el mismo archivo vale en el navegador y en Node.

(function (root) {
  const MAIN_BRANCHES = new Set(["main", "master", "trunk"]);
  const BRANCH_VARS = ["--branch-1", "--branch-2", "--branch-3", "--branch-4"];
  const MAIN_VAR = "--branch-main";

  function branchHash(name) {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) >>> 0;
    return h;
  }

  function branchColorVar(name) {
    const n = String(name || "").trim();
    if (!n) return null;
    if (MAIN_BRANCHES.has(n.toLowerCase())) return MAIN_VAR;
    return BRANCH_VARS[branchHash(n) % BRANCH_VARS.length];
  }

  function rememberBranch(list, name, max = 5) {
    const n = String(name || "").trim();
    const kept = (Array.isArray(list) ? list : [])
      .map((b) => String(b || "").trim())
      .filter((b) => b && b !== n);
    return (n ? [n, ...kept] : kept).slice(0, Math.max(0, max));
  }

  const api = { branchColorVar, rememberBranch, branchHash, MAIN_VAR, BRANCH_VARS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BranchColor = api;
})(typeof window !== "undefined" ? window : globalThis);
