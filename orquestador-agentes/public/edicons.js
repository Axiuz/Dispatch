// ============ Iconos del editor ============
// Catálogo de iconos SVG en línea: los de las vistas de la barra y los de tipo
// de archivo. Sin dependencias ni fuentes de iconos, y sin peticiones.
// Cuando hay un icon theme instalado manda el suyo; esto es el respaldo.
const EdIcons = (() => {
  const SVG = (body, cls = "") =>
    `<svg class="ed-ico ${cls}" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" ` +
    `stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

  const VIEW = {
    explorer: '<path d="M2.5 3.5h3l1 1.5h7v7h-11z"/><path d="M2.5 6.5h11"/>',
    search: '<circle cx="6.8" cy="6.8" r="4"/><path d="M9.8 9.8 13.5 13.5"/>',
    git: '<circle cx="4.5" cy="4" r="1.8"/><circle cx="4.5" cy="12" r="1.8"/><circle cx="11.5" cy="6" r="1.8"/><path d="M4.5 5.8v4.4M11.5 7.8c0 2.2-2.4 2.4-4.6 2.6"/>',
    notes: '<rect x="3" y="2.5" width="10" height="11" rx="1.2"/><path d="M5.5 6h5M5.5 8.5h5M5.5 11h3"/>',
    map: '<circle cx="4" cy="4.5" r="1.6"/><circle cx="12" cy="7" r="1.6"/><circle cx="5.5" cy="12" r="1.6"/><path d="M5.4 5.3 10.6 6.4M11 8.4 6.7 10.9"/>',
    extensions: '<rect x="2.5" y="2.5" width="5" height="5" rx="1"/><rect x="8.5" y="2.5" width="5" height="5" rx="1"/><rect x="2.5" y="8.5" width="5" height="5" rx="1"/><path d="M11 9v4M9 11h4"/>',
    problems: '<path d="M8 2.6 14 13H2z"/><path d="M8 6.5v3"/><circle cx="8" cy="11.4" r=".45" fill="currentColor" stroke="none"/>',
    terminal: '<rect x="2" y="3" width="12" height="10" rx="1.2"/><path d="M5 6.5 7.5 8.5 5 10.5M9 10.5h3"/>',

    chevron: '<path d="M4 6.5 8 10.5 12 6.5"/>',
    chevronUp: '<path d="M4 9.5 8 5.5 12 9.5"/>',
    caret: '<path d="M6 4 10 8 6 12"/>',
    caretDown: '<path d="M4 6 8 10 12 6"/>',
    pin: '<path d="M9.5 2.2 13.8 6.5l-1.8.7-.6 2.6-3.6-3.6-3.3 4.9 4.9-3.3-3.6-3.6 2.6-.6z"/>',
    close: '<path d="M4 4 12 12M12 4 4 12"/>',
    dot: '<circle cx="8" cy="8" r="3.2" fill="currentColor" stroke="none"/>',
    ellipsis: '<circle cx="4" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r=".9" fill="currentColor" stroke="none"/>',
    check: '<path d="M3.5 8.5 6.5 11.5 12.5 4.5"/>',
    plus: '<path d="M8 3.5v9M3.5 8h9"/>',

    newFile: '<path d="M4 2.5h4.5L11.5 5.5v3"/><path d="M4 2.5v11h4"/><path d="M8.2 2.6v3.2h3.2"/><path d="M12 10v4M10 12h4"/>',
    newDir: '<path d="M2.5 4h3.2l1 1.5H13v5.5H2.5z"/><path d="M11 8.5v4M9 10.5h4"/>',
    reload: '<path d="M13 8a5 5 0 1 1-1.6-3.7"/><path d="M13.3 2.6v2.9h-2.9"/>',
    save: '<path d="M3 3h8l2 2v8H3z"/><path d="M5.5 3v3.5h5V3M5.5 13v-3.5h5V13"/>',
    collapse: '<path d="M5 6.5 8 3.5 11 6.5M5 9.5 8 12.5 11 9.5"/>',
    settings: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1"/>',
    filter: '<path d="M2.5 3.5h11L9.5 8.5v4l-3 1.5v-5.5z"/>',
    trash: '<path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.7 9h4.6l.7-9"/>',
    download: '<path d="M8 2.5v7.5M5 7.5 8 10.5 11 7.5M3 13h10"/>',
    external: '<path d="M9 3h4v4M13 3 7.5 8.5"/><path d="M11.5 9.5V13H3V4.5h3.5"/>',

    folder: '<path d="M2 4h4l1.2 1.6H14V12.5H2z"/>',
    folderOpen: '<path d="M2 4h4l1.2 1.6H13V7H4.2L2.5 12.5H2z"/><path d="M4.2 7H14.5l-1.7 5.5H2.5z"/>',
  };

  // Familias con dibujo propio: lo que no está aquí se pinta como documento con
  // su monograma (doc), que es lo que ya hacía el árbol con FILE_KINDS.
  const DOC = '<path d="M4 2h5l3 3v9H4z"/><path d="M8.8 2.1v3.1h3.1"/>';

  const FILE = {
    image: DOC + '<circle cx="6.6" cy="8.3" r=".9"/><path d="M5 12.5l2.4-2.4 1.5 1.5 1.3-1.3 1.3 1.3"/>',
    media: DOC + '<path d="M6.3 8.3 10 10.4 6.3 12.5z"/>',
    font: DOC + '<path d="M5.8 12.5 8 7.5l2.2 5M6.6 11h2.8"/>',
    lock: DOC + '<rect x="5.8" y="9.3" width="4.4" height="3.4" rx=".7"/><path d="M6.9 9.3V8.4a1.1 1.1 0 0 1 2.2 0v.9"/>',
    archive: DOC + '<path d="M7.2 7.5h1.6M7.2 9h1.6M7.2 10.5h1.6"/><rect x="7" y="11.6" width="2" height="1.6" rx=".4"/>',
    git: DOC + '<circle cx="6.4" cy="8.3" r=".9"/><circle cx="6.4" cy="12" r=".9"/><circle cx="9.8" cy="9.6" r=".9"/><path d="M6.4 9.2v1.9M9.8 10.5c0 1-1.2 1.1-2.5 1.3"/>',
    docker: DOC + '<rect x="5.4" y="10.4" width="1.5" height="1.5"/><rect x="7.2" y="10.4" width="1.5" height="1.5"/><rect x="9" y="10.4" width="1.5" height="1.5"/><rect x="7.2" y="8.7" width="1.5" height="1.5"/>',
    env: DOC + '<path d="M5.5 8.5h5l-2.5 2v2.2"/>',
    db: DOC + '<ellipse cx="8" cy="8.6" rx="2.6" ry="1"/><path d="M5.4 8.6v3c0 .6 1.2 1 2.6 1s2.6-.4 2.6-1v-3"/>',
    binary: DOC + '<path d="M6.2 8v4M5.4 8h1.6M5.4 12h1.6"/><rect x="8.6" y="8" width="2.2" height="4" rx=".8"/>',
    text: DOC + '<path d="M5.6 8.2h4.8M5.6 10h4.8M5.6 11.8h3"/>',
    folder: VIEW.folder,
    folderOpen: VIEW.folderOpen,
  };

  // El monograma de dos letras que ya usaba el árbol, dentro del documento: es
  // el respaldo mientras no haya un icon theme instalado.
  function doc(label = "") {
    const text = String(label).slice(0, 2).toUpperCase();
    return SVG(
      DOC +
        `<text x="8" y="12.4" text-anchor="middle" font-size="5.4" font-family="ui-monospace, monospace" ` +
        `font-weight="600" fill="currentColor" stroke="none">${text}</text>`
    );
  }

  const view = (id) => (VIEW[id] ? SVG(VIEW[id], `ed-ico-${id}`) : SVG(VIEW.dot));
  const file = (family) => (FILE[family] ? SVG(FILE[family], `ed-ico-${family}`) : null);
  const has = (id) => Boolean(VIEW[id]);
  const raw = (id) => VIEW[id] || "";

  return { view, file, doc, has, raw, SVG };
})();
