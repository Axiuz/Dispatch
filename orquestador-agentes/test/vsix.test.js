const test = require('node:test');
const assert = require('node:assert');

const vsix = require('../vsix');

test('idError - id vacío', () => {
  assert.equal(vsix.idError('', { host: 'open-vsx.org' }), 'Falta el id de la extensión');
});

test('idError - id con barras', () => {
  assert.equal(vsix.idError('publisher/name/path'), 'El id no es válido');
});

test('idError - id con dos puntos seguidos de ruta relativa', () => {
  assert.equal(vsix.idError('publisher::path/to/file'), 'El id no es válido');
});

test('idError - id sin punto separador', () => {
  assert.equal(vsix.idError('publishername'), 'El id va como publicador.nombre');
});

test('idError - id válido', () => {
  assert.equal(vsix.idError('publisher.name'), null);
});

test('idError - id demasiado largo', () => {
  assert.equal(vsix.idError('a'.repeat(121)), 'El id es demasiado largo');
});

test('idError - id con ".."', () => {
  assert.equal(vsix.idError('publisher..name'), 'El id no es válido');
});

test('idError - id con "/"', () => {
  assert.equal(vsix.idError('publisher/name'), 'El id no es válido');
});

test('parseId - id válido', () => {
  const result = vsix.parseId('publisher.name');
  assert.deepEqual(result, { publisher: 'publisher', name: 'name' });
});

test('idError rechaza el id sin punto separador', () => {
  assert.equal(vsix.idError('publishername'), 'El id va como publicador.nombre');
});

test('downloadUrlError - url http', () => {
  assert.equal(vsix.downloadUrlError('http://example.com'), 'La descarga tiene que ir por https');
});

test('downloadUrlError - url de otro dominio', () => {
  assert.equal(vsix.downloadUrlError('https://example.com'), 'La descarga no viene de open-vsx.org');
});

test('downloadUrlError - url de subdominio', () => {
  assert.equal(vsix.downloadUrlError('https://dev.open-vsx.org'), null);
});

test('downloadUrlError - url rota', () => {
  assert.equal(vsix.downloadUrlError('https://open-vsx.org/invalid'), null);
});

test('downloadUrlError - url no válida', () => {
  assert.equal(vsix.downloadUrlError('invalid-url'), 'La URL de descarga no es válida');
});

test('themeToMonaco - scope en lista', () => {
  const theme = { tokenColors: [{ scope: ['comment.line'], settings: { foreground: '#ff0000' } }] };
  const result = vsix.themeToMonaco(theme);
  assert.deepEqual(result.rules, [{ token: 'comment.line', foreground: 'ff0000' }]);
});

test('themeToMonaco - scope en cadena separada por comas', () => {
  const theme = { tokenColors: [{ scope: 'comment.line,editor.lineHighlightBackground', settings: { foreground: '#00ff00' } }] };
  const result = vsix.themeToMonaco(theme);
  assert.deepEqual(result.rules, [
    { token: 'comment.line', foreground: '00ff00' },
    { token: 'editor.lineHighlightBackground', foreground: '00ff00' }
  ]);
});

test('themeToMonaco - color sin almohadilla', () => {
  const theme = { tokenColors: [{ scope: 'comment', settings: { foreground: 'invalid' } }] };
  const result = vsix.themeToMonaco(theme);
  assert.deepEqual(result.rules, []);
});

test('themeToMonaco - fontStyle sin color', () => {
  const theme = { tokenColors: [{ scope: 'comment', settings: { fontStyle: 'bold' } }] };
  const result = vsix.themeToMonaco(theme);
  assert.deepEqual(result.rules, [{ token: 'comment', fontStyle: 'bold' }]);
});

test('themeToMonaco - type light', () => {
  const theme = { tokenColors: [], type: 'light' };
  const result = vsix.themeToMonaco(theme);
  assert.deepEqual(result, { name: 'vsix', base: 'vs', inherit: true, rules: [], colors: {} });
});

test('servableError - ruta absoluta', () => {
  assert.equal(vsix.servableError('/path/to/file.json'), 'Esa ruta no vale');
});

test('servableError - ruta que sale de la extensión', () => {
  assert.equal(vsix.servableError('../../secreto.json'), 'Esa ruta no vale');
  assert.equal(vsix.servableError('/etc/passwd.json'), 'Esa ruta no vale');
});

test('servableError - extension .js', () => {
  assert.equal(vsix.servableError('script.js'), 'Solo se sirven .json, .svg y .png de una extensión');
});

test('servableError - extension .svg', () => {
  assert.equal(vsix.servableError('theme.svg'), null);
});

test('servableError - ruta vacía', () => {
  assert.equal(vsix.servableError('', { host: 'open-vsx.org' }), 'Falta la ruta del archivo');
});

test('servableError - ruta con ".."', () => {
  assert.equal(vsix.servableError('..'), 'Esa ruta no vale');
});
