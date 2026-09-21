// Tests de los parseos y las validaciones de android.js. Se ejecutan con:
//   node --test test/android.test.js
// Las cadenas son salida literal de `adb devices -l` y de `emulator -list-avds`,
// que a veces mete sus avisos por delante de la lista.

const test = require("node:test");
const assert = require("node:assert/strict");

const { parseAvds, parseDevices, serialError, avdError, emulatorArgs } = require("../android");

test("parseAvds con salida vacía devuelve arreglo vacío", () => {
  assert.deepEqual(parseAvds(""), []);
});

test("parseAvds con salida con líneas vacías y sin datos devuelve arreglo vacío", () => {
  assert.deepEqual(parseAvds("  \n\n   \n  "), []);
});

test("parseAvds con líneas que no son válidas (INFO, WARNING, con espacios) devuelve solo líneas válidas", () => {
  assert.deepEqual(parseAvds("INFO test\n  \nWARNING error\nvalid\n"), ["valid"]);
});

test("parseAvds con líneas válidas y sin espacios devuelve arreglo con esas líneas", () => {
  assert.deepEqual(parseAvds("valid\nanother\nthird"), ["valid", "another", "third"]);
});

test("parseAvds con líneas que no cumplen el filtro (con espacios o INFO) se excluyen", () => {
  assert.deepEqual(parseAvds("INFO test\n  \nvalid\nWARNING error"), ["valid"]);
});

test("parseDevices con salida vacía devuelve arreglo vacío", () => {
  assert.deepEqual(parseDevices(""), []);
});

test("la cabecera 'List of devices' no es un dispositivo", () => {
  assert.deepEqual(parseDevices("List of devices attached\nemulator-5554 device\n"), [
    { serial: "emulator-5554", state: "device", model: null, device: null, emulator: true },
  ]);
});

test("parseDevices con línea con serial, estado y sin modelo o dispositivo devuelve objeto con null", () => {
  assert.deepEqual(parseDevices("1234abcd device"), [
    { serial: "1234abcd", state: "device", model: null, device: null, emulator: false }
  ]);
});

test("parseDevices con dispositivo unauthorized sin modelo devuelve objeto con model: null", () => {
  assert.deepEqual(parseDevices("1234abcd unauthorized"), [
    { serial: "1234abcd", state: "unauthorized", model: null, device: null, emulator: false }
  ]);
});

test("parseDevices con modelo con guion bajo se convierte en espacio", () => {
  assert.deepEqual(parseDevices("emulator-5554 device model:device_with_underscore device:emu64a"), [
    { serial: "emulator-5554", state: "device", model: "device with underscore", device: "emu64a", emulator: true }
  ]);
});

test("parseDevices con serial que empieza por 'emulator-' identifica como emulator: true", () => {
  assert.deepEqual(parseDevices("emulator-5554 device model:sdk_gphone64_arm64 device:emu64a"), [
    { serial: "emulator-5554", state: "device", model: "sdk gphone64 arm64", device: "emu64a", emulator: true }
  ]);
});

test("serialError con serial vacío devuelve error de falta", () => {
  assert.equal(serialError(""), "Falta el dispositivo");
});

test("serialError con espacios devuelve error de falta", () => {
  assert.equal(serialError("  "), "Falta el dispositivo");
});

test("serialError con serial que empieza por guion devuelve error de inicio", () => {
  assert.equal(serialError("-1234"), "Un dispositivo no puede empezar por '-'");
});

test("serialError con serial válido devuelve null", () => {
  assert.equal(serialError("1234abcd"), null);
});

test("avdError con nombre de AVD vacío devuelve error de falta", () => {
  assert.equal(avdError(""), "Falta el AVD");
});

test("avdError con nombre que empieza por guion devuelve error de inicio", () => {
  assert.equal(avdError("-pixel"), "Un nombre de AVD no puede empezar por '-'");
});

test("avdError con nombre válido devuelve null", () => {
  assert.equal(avdError("Pixel_7"), null);
});

test("avdError con nombre largo (más de 64 caracteres) devuelve error de longitud", () => {
  assert.equal(avdError("a".repeat(65)), "Ese nombre de AVD no es válido");
});

test("avdError con nombre con caracteres no permitidos (como @) devuelve error de formato", () => {
  assert.equal(avdError("Pixel@7"), "Ese nombre de AVD no es válido");
});

test("emulatorArgs con avd válido y coldBoot=false devuelve ['-avd', 'avdName']", () => {
  assert.deepEqual(emulatorArgs({ avd: "Pixel_7" }), ["-avd", "Pixel_7"]);
});

test("emulatorArgs con avd válido y coldBoot=true añade -no-snapshot-load", () => {
  assert.deepEqual(emulatorArgs({ avd: "Pixel_7", coldBoot: true }), ["-avd", "Pixel_7", "-no-snapshot-load"]);
});

// emulatorArgs no valida: de eso se encarga avdError antes de llamarla
test("emulatorArgs no filtra un nombre raro, solo lo coloca", () => {
  assert.deepEqual(emulatorArgs({ avd: "-invalid" }), ["-avd", "-invalid"]);
});

test("la salida real de adb devices -l sale entera", () => {
  const salida = [
    "List of devices attached",
    "emulator-5554\tdevice product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1",
    "1234abcd\tunauthorized",
    "",
  ].join("\n");
  assert.deepEqual(parseDevices(salida), [
    { serial: "emulator-5554", state: "device", model: "sdk gphone64 arm64", device: "emu64a", emulator: true },
    { serial: "1234abcd", state: "unauthorized", model: null, device: null, emulator: false },
  ]);
});
