import { strFromU8, strToU8, unzlibSync, zlibSync } from "fflate";
import { GAMEPLAY_VERSION, normalizeGameSession } from "./gameplay.js";
import { Simulation } from "./simulation.js";

export const SAVEGAME_SCHEMA_VERSION = 1;
export const SAVEGAME_PAYLOAD_VERSION = 1;
export const SAVEGAME_SLOT_COUNT = 3;
export const SAVEGAME_MODES = Object.freeze(["spectator", "gameplay"]);
export const SAVEGAME_STORAGE_PREFIX = "cidade-viva:save";
export const SAVEGAME_CODEC = "zlib-base64";
export const SAVEGAME_FORMAT = "cidade-viva/savegame";

const SPECIAL_TYPE_KEY = "__cidadeVivaSaveType__";
const CRC32_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC32_TABLE.length; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC32_TABLE[index] = value >>> 0;
}

export class SavegameError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "SavegameError";
    this.code = code;
  }
}

const fail = (code, message, cause) => {
  throw new SavegameError(code, message, { cause });
};

function validateMode(mode) {
  if (!SAVEGAME_MODES.includes(mode)) fail("INVALID_MODE", "Modo de jogo inválido. Use spectator ou gameplay.");
  return mode;
}

function validateSlot(slot) {
  const normalized = Number(slot);
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > SAVEGAME_SLOT_COUNT)
    fail("INVALID_SLOT", `Slot inválido. Escolha um número entre 1 e ${SAVEGAME_SLOT_COUNT}.`);
  return normalized;
}

export function savegameStorageKey(mode, slot) {
  return `${SAVEGAME_STORAGE_PREFIX}:${validateMode(mode)}:${validateSlot(slot)}`;
}

function getStorage() {
  try {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function")
      fail("STORAGE_UNAVAILABLE", "O armazenamento local não está disponível neste navegador.");
    return storage;
  } catch (error) {
    if (error instanceof SavegameError) throw error;
    fail("STORAGE_UNAVAILABLE", "O navegador bloqueou o acesso aos saves locais.", error);
  }
}

function storageRead(storage, key) {
  try {
    return storage.getItem(key);
  } catch (error) {
    fail("STORAGE_READ_FAILED", "Não foi possível ler os saves deste navegador.", error);
  }
}

function storageWrite(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch (error) {
    if (error?.name === "QuotaExceededError" || error?.code === 22 || error?.code === 1014)
      fail("STORAGE_QUOTA_EXCEEDED", "Não há espaço local suficiente para gravar este save. Exclua um slot antigo e tente novamente.", error);
    fail("STORAGE_WRITE_FAILED", "O navegador não permitiu gravar o save local.", error);
  }
}

function storageDelete(storage, key) {
  try {
    storage.removeItem(key);
  } catch (error) {
    fail("STORAGE_DELETE_FAILED", "Não foi possível excluir este save local.", error);
  }
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

function bytesToBase64Fallback(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index], b = bytes[index + 1], c = bytes[index + 2];
    const value = (a << 16) | ((b || 0) << 8) | (c || 0);
    encoded += alphabet[(value >>> 18) & 63] + alphabet[(value >>> 12) & 63];
    encoded += index + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : "=";
    encoded += index + 2 < bytes.length ? alphabet[value & 63] : "=";
  }
  return encoded;
}

function bytesToBase64(bytes) {
  if (typeof globalThis.btoa !== "function") return bytesToBase64Fallback(bytes);
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  return globalThis.btoa(chunks.join(""));
}

function base64ToBytesFallback(encoded) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array((encoded.length / 4) * 3 - padding);
  let cursor = 0;
  for (let index = 0; index < encoded.length; index += 4) {
    const a = alphabet.indexOf(encoded[index]), b = alphabet.indexOf(encoded[index + 1]);
    const c = encoded[index + 2] === "=" ? 0 : alphabet.indexOf(encoded[index + 2]);
    const d = encoded[index + 3] === "=" ? 0 : alphabet.indexOf(encoded[index + 3]);
    const value = (a << 18) | (b << 12) | (c << 6) | d;
    if (cursor < bytes.length) bytes[cursor++] = (value >>> 16) & 0xff;
    if (cursor < bytes.length) bytes[cursor++] = (value >>> 8) & 0xff;
    if (cursor < bytes.length) bytes[cursor++] = value & 0xff;
  }
  return bytes;
}

function base64ToBytes(encoded) {
  if (typeof encoded !== "string" || !encoded.length || encoded.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
    fail("SAVE_CORRUPT", "O conteúdo comprimido deste save é inválido.");
  if (typeof globalThis.atob !== "function") return base64ToBytesFallback(encoded);
  let binary;
  try {
    binary = globalThis.atob(encoded);
  } catch (error) {
    fail("SAVE_CORRUPT", "O conteúdo Base64 deste save está corrompido.", error);
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function savegameReplacer(_key, value) {
  if (typeof value === "number" && !Number.isFinite(value)) {
    const encoded = Number.isNaN(value) ? "NaN" : value === Infinity ? "Infinity" : "-Infinity";
    return { [SPECIAL_TYPE_KEY]: "NonFiniteNumber", value: encoded };
  }
  if (value instanceof Set) return { [SPECIAL_TYPE_KEY]: "Set", values: [...value] };
  if (value instanceof Map) return { [SPECIAL_TYPE_KEY]: "Map", entries: [...value.entries()] };
  return value;
}

function savegameReviver(_key, value) {
  if (!value || typeof value !== "object" || typeof value[SPECIAL_TYPE_KEY] !== "string") return value;
  if (value[SPECIAL_TYPE_KEY] === "Set" && Array.isArray(value.values)) return new Set(value.values);
  if (value[SPECIAL_TYPE_KEY] === "Map" && Array.isArray(value.entries)) return new Map(value.entries);
  if (value[SPECIAL_TYPE_KEY] === "NonFiniteNumber") {
    if (value.value === "NaN") return NaN;
    if (value.value === "Infinity") return Infinity;
    if (value.value === "-Infinity") return -Infinity;
  }
  fail("SAVE_CORRUPT", "O save contém um tipo de dado especial inválido.");
}

function normalizeSession(session, mode) {
  if (!session || typeof session !== "object") fail("INVALID_SESSION", "A sessão de jogo não está disponível para salvar.");
  if (session.version !== GAMEPLAY_VERSION)
    fail("SESSION_VERSION_UNSUPPORTED", `A versão da sessão (${session.version ?? "desconhecida"}) não é compatível com este jogo.`);
  let normalized;
  try {
    normalized = normalizeGameSession(session);
  } catch (error) {
    fail("INVALID_SESSION", "A sessão de jogo está inválida ou incompleta.", error);
  }
  if (normalized.mode !== mode) fail("MODE_MISMATCH", "O modo da sessão não corresponde ao slot escolhido.");
  return normalized;
}

function validateSimulationAndSession(simulation, session, mode) {
  if (!(simulation instanceof Simulation)) fail("INVALID_SIMULATION", "A simulação atual não pode ser salva.");
  if (simulation.gameMode !== mode) fail("MODE_MISMATCH", "O modo da simulação não corresponde ao slot escolhido.");
  if (mode === "gameplay") {
    const player = simulation.people?.find((person) => person?.id === simulation.playerId);
    if (!player || !session.player?.personId || session.player.personId !== simulation.playerId)
      fail("PLAYER_MISMATCH", "O personagem jogável não corresponde à sessão deste save.");
  } else if (simulation.playerId || session.player) {
    fail("PLAYER_MISMATCH", "Um save do modo observador não pode conter personagem controlado.");
  }
}

function validateView(view) {
  if (view === undefined || view === null) return null;
  if (typeof view !== "object" || Array.isArray(view)) fail("INVALID_VIEW", "O estado visual informado para o save é inválido.");
  return view;
}

function parseEnvelope(serialized, expectedMode, expectedSlot, verifyChecksum = true) {
  let envelope;
  try {
    envelope = JSON.parse(serialized);
  } catch (error) {
    fail("SAVE_CORRUPT", "Os metadados deste save estão corrompidos.", error);
  }
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) fail("SAVE_CORRUPT", "Envelope de save inválido.");
  if (envelope.format !== SAVEGAME_FORMAT) fail("SAVE_CORRUPT", "Este arquivo não é um save do Cidade Viva.");
  if (envelope.schemaVersion !== SAVEGAME_SCHEMA_VERSION)
    fail("SAVE_VERSION_UNSUPPORTED", `Este save usa uma versão incompatível (${envelope.schemaVersion ?? "desconhecida"}).`);
  if (envelope.mode !== expectedMode || envelope.slot !== expectedSlot) fail("SAVE_SCOPE_MISMATCH", "O save pertence a outro modo ou slot.");
  if (envelope.codec !== SAVEGAME_CODEC) fail("SAVE_CODEC_UNSUPPORTED", "O formato de compressão deste save não é compatível.");
  if (!envelope.meta || typeof envelope.meta !== "object" || Array.isArray(envelope.meta)) fail("SAVE_CORRUPT", "Metadados legíveis ausentes no save.");
  if (!Number.isFinite(Date.parse(envelope.meta.createdAt)) || !Number.isFinite(Date.parse(envelope.meta.updatedAt)))
    fail("SAVE_CORRUPT", "Datas inválidas nos metadados do save.");
  if (envelope.checksum?.algorithm !== "crc32" || !/^[0-9a-f]{8}$/.test(envelope.checksum?.value || ""))
    fail("SAVE_CORRUPT", "Checksum ausente ou inválido no save.");
  if (typeof envelope.payload !== "string") fail("SAVE_CORRUPT", "Payload ausente no save.");
  let compressed = null;
  if (verifyChecksum) {
    compressed = base64ToBytes(envelope.payload);
    if (crc32(compressed) !== envelope.checksum.value) fail("SAVE_CHECKSUM_MISMATCH", "A integridade deste save não pôde ser confirmada.");
  }
  return { envelope, compressed };
}

function decodePayload(envelope, compressed) {
  let bytes;
  try {
    bytes = unzlibSync(compressed || base64ToBytes(envelope.payload));
  } catch (error) {
    fail("SAVE_DECOMPRESSION_FAILED", "Não foi possível descomprimir este save. O arquivo pode estar corrompido.", error);
  }
  let payload;
  try {
    payload = JSON.parse(strFromU8(bytes), savegameReviver);
  } catch (error) {
    if (error instanceof SavegameError) throw error;
    fail("SAVE_CORRUPT", "O estado interno deste save está corrompido.", error);
  }
  if (!payload || typeof payload !== "object" || payload.version !== SAVEGAME_PAYLOAD_VERSION)
    fail("SAVE_PAYLOAD_VERSION_UNSUPPORTED", `A versão interna deste save (${payload?.version ?? "desconhecida"}) não é compatível.`);
  return payload;
}

function priorCreatedAt(storage, key, mode, slot) {
  const previous = storageRead(storage, key);
  if (!previous) return null;
  try {
    return parseEnvelope(previous, mode, slot, false).envelope.meta.createdAt;
  } catch {
    return null;
  }
}

function cleanReason(reason) {
  const value = String(reason || "manual").trim().slice(0, 80);
  return value || "manual";
}

function metadataFor(simulation, session, mode, previousCreatedAt, reason, sizes) {
  const now = new Date().toISOString();
  const player = mode === "gameplay" ? simulation.people.find((person) => person.id === simulation.playerId) : null;
  return {
    createdAt: previousCreatedAt || now,
    updatedAt: now,
    reason: cleanReason(reason),
    cityName: "Vila Esperança",
    mode,
    week: simulation.week,
    day: simulation.day,
    minute: simulation.minute,
    population: simulation.people.filter((person) => person?.alive !== false).length,
    totalResidents: simulation.people.length,
    playerName: player?.name || session.player?.character?.name || null,
    sessionStatus: session.status,
    speed: simulation.speed,
    uncompressedBytes: sizes.uncompressedBytes,
    compressedBytes: sizes.compressedBytes,
  };
}

export function listSaveSlots(mode) {
  validateMode(mode);
  let storage;
  try {
    storage = getStorage();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Armazenamento local indisponível.";
    return Array.from({ length: SAVEGAME_SLOT_COUNT }, (_, index) => ({
      slot: index + 1,
      mode,
      status: "corrupt",
      occupied: false,
      error: message,
    }));
  }
  return Array.from({ length: SAVEGAME_SLOT_COUNT }, (_, index) => {
    const slot = index + 1, key = savegameStorageKey(mode, slot);
    let serialized;
    try {
      serialized = storageRead(storage, key);
    } catch (error) {
      return { slot, mode, status: "corrupt", occupied: false, error: error.message };
    }
    if (serialized === null) return { slot, mode, status: "empty", occupied: false };
    try {
      const { envelope } = parseEnvelope(serialized, mode, slot, true);
      return { slot, mode, status: "ready", occupied: true, meta: envelope.meta };
    } catch (error) {
      return {
        slot,
        mode,
        status: "corrupt",
        occupied: true,
        error: error instanceof Error ? error.message : "Save corrompido.",
      };
    }
  });
}

export function saveGameSlot({ mode, slot, simulation, session, view = null, reason = "manual" } = {}) {
  mode = validateMode(mode);
  slot = validateSlot(slot);
  const normalizedSession = normalizeSession(session, mode);
  validateSimulationAndSession(simulation, normalizedSession, mode);
  view = validateView(view);

  let serializedPayload;
  try {
    serializedPayload = JSON.stringify({
      version: SAVEGAME_PAYLOAD_VERSION,
      simulation: simulation.toSaveSnapshot(),
      session: normalizedSession,
      view,
    }, savegameReplacer);
  } catch (error) {
    if (error instanceof SavegameError) throw error;
    fail("SAVE_SERIALIZATION_FAILED", "Não foi possível preparar o estado atual para salvar.", error);
  }
  if (!serializedPayload) fail("SAVE_SERIALIZATION_FAILED", "A serialização do save retornou um conteúdo vazio.");

  const uncompressed = strToU8(serializedPayload);
  let compressed;
  try {
    compressed = zlibSync(uncompressed, { level: 6 });
  } catch (error) {
    fail("SAVE_COMPRESSION_FAILED", "Não foi possível comprimir o estado do jogo.", error);
  }

  const storage = getStorage(), key = savegameStorageKey(mode, slot);
  const previousCreatedAt = priorCreatedAt(storage, key, mode, slot);
  const meta = metadataFor(simulation, normalizedSession, mode, previousCreatedAt, reason, {
    uncompressedBytes: uncompressed.length,
    compressedBytes: compressed.length,
  });
  const envelope = {
    format: SAVEGAME_FORMAT,
    schemaVersion: SAVEGAME_SCHEMA_VERSION,
    mode,
    slot,
    codec: SAVEGAME_CODEC,
    meta,
    checksum: { algorithm: "crc32", value: crc32(compressed) },
    payload: bytesToBase64(compressed),
  };
  storageWrite(storage, key, JSON.stringify(envelope));
  return { slot, mode, status: "ready", occupied: true, meta };
}

export function loadGameSlot(mode, slot) {
  mode = validateMode(mode);
  slot = validateSlot(slot);
  const storage = getStorage(), key = savegameStorageKey(mode, slot), serialized = storageRead(storage, key);
  if (serialized === null) fail("SAVE_EMPTY", `O slot ${slot} do modo ${mode === "gameplay" ? "Gameplay" : "Observador"} está vazio.`);
  const { envelope, compressed } = parseEnvelope(serialized, mode, slot, true);
  const payload = decodePayload(envelope, compressed);
  const session = normalizeSession(payload.session, mode);
  if (!payload.simulation || payload.simulation.state?.gameMode !== mode) fail("MODE_MISMATCH", "O estado salvo pertence a outro modo de jogo.");

  let simulation;
  try {
    simulation = Simulation.fromSaveSnapshot(payload.simulation);
  } catch (error) {
    fail("SIMULATION_HYDRATION_FAILED", "Não foi possível reconstruir a cidade deste save.", error);
  }
  validateSimulationAndSession(simulation, session, mode);
  const view = validateView(payload.view);
  return { simulation, session, view, meta: envelope.meta };
}

export function deleteGameSlot(mode, slot) {
  mode = validateMode(mode);
  slot = validateSlot(slot);
  const storage = getStorage(), key = savegameStorageKey(mode, slot);
  const deleted = storageRead(storage, key) !== null;
  storageDelete(storage, key);
  return { mode, slot, deleted };
}
