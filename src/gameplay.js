import {
  feminineFirstNames,
  firstNameForIdentity,
  lastNames,
  masculineFirstNames,
  neutralFirstNames,
  traits as traitCatalog,
} from "./data.js";
import { eyeColors, hairColors, identities, orientations, pronounsForIdentity, skinTones } from "./lifecycle.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const unique = (values = []) => [...new Set(values.filter(Boolean))];
const cleanText = (value, max = 80) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const clockOf = (clock = {}) => ({
  week: Math.max(1, Math.floor(Number(clock.week) || 1)),
  day: clamp(Math.floor(Number(clock.day) || 0), 0, 6),
  minute: clamp(Math.floor(Number(clock.minute) || 0), 0, 1439),
});
const serializable = (value) => {
  try {
    if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") return false;
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
};
const plainRecord = (value) => value == null || (typeof value === "object" && !Array.isArray(value));
const catalogById = (catalog, id) => catalog.find((entry) => entry.id === id) || null;
const pick = (items, rng = Math.random) => items[Math.floor(clamp(rng(), 0, .999999) * items.length)];
const slug = (value) => cleanText(value, 50).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "player";
const createAppearance = (rng = Math.random) => ({
  eyes: pick(eyeColors, rng),
  hair: pick(hairColors, rng),
  skin: pick(skinTones, rng),
  height: Math.round(154 + rng() * 38),
  beauty: Math.round(25 + rng() * 70),
  charisma: Math.round(25 + rng() * 70),
});

export const GAMEPLAY_VERSION = 1;
export const GAME_MODES = Object.freeze({ SPECTATOR: "spectator", GAMEPLAY: "gameplay" });

export const gameModeCatalog = Object.freeze([
  {
    id: GAME_MODES.SPECTATOR,
    name: "Modo Espectador",
    description: "A cidade toma suas próprias decisões enquanto o usuário observa e investiga seus sistemas.",
    directControl: false,
    paceMultiplier: 1,
    recommendedPreset: "96x",
  },
  {
    id: GAME_MODES.GAMEPLAY,
    name: "Modo Gameplay",
    description: "O jogador vive como um cidadão, toma decisões e convive com as consequências da simulação.",
    directControl: true,
    paceMultiplier: .72,
    recommendedPreset: "24x",
  },
]);

export const characterOriginCatalog = Object.freeze([
  { id: "city_native", name: "Nascido na cidade", description: "Começa com vínculos familiares e conhecimento local.", minAge: 6, maxAge: 90, startingMoney: 2400, housing: "family", socialContacts: 5, reputation: 8, tags: ["local", "família"] },
  { id: "newcomer", name: "Recém-chegado", description: "Chega por conta própria e começa provisoriamente em hotel ou pousada.", minAge: 18, maxAge: 70, startingMoney: 5200, housing: "temporary", socialContacts: 0, reputation: 0, tags: ["imigração", "hotel"] },
  { id: "student", name: "Estudante independente", description: "Veio estudar e precisa conciliar formação, renda e moradia.", minAge: 16, maxAge: 35, startingMoney: 1900, housing: "shared_rent", socialContacts: 2, reputation: 2, tags: ["educação", "aluguel"] },
  { id: "job_seeker", name: "Em busca de oportunidades", description: "Começa sem emprego fixo e pode escolher livremente uma carreira.", minAge: 18, maxAge: 67, startingMoney: 3100, housing: "rent", socialContacts: 1, reputation: 1, tags: ["trabalho", "mobilidade"] },
  { id: "family_heir", name: "Herdeiro de uma família local", description: "Possui patrimônio inicial, mas também responsabilidades familiares.", minAge: 18, maxAge: 75, startingMoney: 14500, housing: "owned", socialContacts: 7, reputation: 12, tags: ["patrimônio", "família"] },
  { id: "second_chance", name: "Recomeço", description: "Busca reconstruir a vida com poucos recursos e reputação frágil.", minAge: 18, maxAge: 70, startingMoney: 850, housing: "temporary", socialContacts: 1, reputation: -8, tags: ["recomeço", "vulnerabilidade"] },
]);

export const playerGoalCatalog = Object.freeze([
  { id: "career", name: "Construir uma carreira", description: "Conseguir emprego, desenvolver competências e crescer profissionalmente.", metric: "career", target: 100 },
  { id: "education", name: "Estudar e se formar", description: "Frequentar aulas, concluir cursos e ampliar oportunidades.", metric: "education", target: 100 },
  { id: "family", name: "Construir uma família", description: "Criar vínculos duradouros, compartilhar uma casa e cuidar dos seus.", metric: "family", target: 100 },
  { id: "community", name: "Fazer diferença na cidade", description: "Participar da comunidade, da política e de iniciativas coletivas.", metric: "community", target: 100 },
  { id: "entrepreneurship", name: "Abrir um negócio", description: "Poupar, empreender, contratar pessoas e consolidar um estabelecimento.", metric: "business", target: 100 },
  { id: "wealth", name: "Conquistar patrimônio", description: "Acumular reservas, veículos e propriedades de maneira sustentável.", metric: "wealth", target: 100 },
  { id: "social", name: "Ter uma vida social marcante", description: "Criar amizades, romances e memórias pela cidade.", metric: "social", target: 100 },
  { id: "notability", name: "Tornar-se uma figura conhecida", description: "Ganhar relevância pública por ações, talentos ou controvérsias.", metric: "notability", target: 100 },
  { id: "underground", name: "Viver à margem", description: "Explorar oportunidades ilegais assumindo seus riscos sociais e penais.", metric: "underground", target: 100 },
]);

export const playerActionCatalog = Object.freeze([
  { id: "go_to", name: "Ir até um local", category: "navigation", targetKinds: ["building", "business", "place"], durationMinutes: 20, movementRequired: true, interruptible: true },
  { id: "go_home", name: "Ir para casa", category: "navigation", targetKinds: [], durationMinutes: 20, movementRequired: true, interruptible: true },
  { id: "talk", name: "Conversar", category: "social", targetKinds: ["person"], durationMinutes: 20, movementRequired: true, interruptible: true, allowedWhileIncarcerated: true },
  { id: "socialize", name: "Passar tempo junto", category: "social", targetKinds: ["person", "place", "business"], durationMinutes: 60, movementRequired: true, interruptible: true },
  { id: "interact_place", name: "Interagir com o local", category: "interaction", targetKinds: ["building", "business", "place"], durationMinutes: 15, movementRequired: true, interruptible: true },
  { id: "shop", name: "Comprar produto", category: "commerce", targetKinds: ["business"], durationMinutes: 25, movementRequired: true, interruptible: true, usesMoney: true },
  { id: "eat", name: "Fazer uma refeição", category: "needs", targetKinds: ["business", "home"], durationMinutes: 35, movementRequired: true, interruptible: true, usesMoney: true, allowedWhileIncarcerated: true },
  { id: "hygiene", name: "Cuidar da higiene", category: "needs", targetKinds: ["home"], durationMinutes: 30, movementRequired: false, interruptible: true },
  { id: "rest", name: "Descansar", category: "needs", targetKinds: ["home", "place"], durationMinutes: 60, movementRequired: false, interruptible: true, allowedWhileIncarcerated: true },
  { id: "work", name: "Trabalhar", category: "career", targetKinds: ["business", "building"], durationMinutes: 120, movementRequired: true, interruptible: true, minAge: 14 },
  { id: "apply_job", name: "Candidatar-se a uma vaga", category: "career", targetKinds: ["business"], durationMinutes: 45, movementRequired: true, interruptible: true, minAge: 14 },
  { id: "study", name: "Estudar", category: "education", targetKinds: ["building", "place"], durationMinutes: 90, movementRequired: true, interruptible: true },
  { id: "enroll", name: "Solicitar matrícula", category: "education", targetKinds: ["building"], durationMinutes: 45, movementRequired: true, interruptible: true },
  { id: "seek_healthcare", name: "Procurar atendimento", category: "health", targetKinds: ["building", "business"], durationMinutes: 45, movementRequired: true, interruptible: false, allowedWhileIncarcerated: true },
  { id: "use_transport", name: "Usar transporte", category: "navigation", targetKinds: ["place", "building", "vehicle"], durationMinutes: 20, movementRequired: true, interruptible: true },
  { id: "manage_property", name: "Gerenciar propriedade", category: "property", targetKinds: ["building"], durationMinutes: 30, movementRequired: false, interruptible: true, minAge: 18 },
  { id: "manage_business", name: "Gerenciar negócio", category: "business", targetKinds: ["business"], durationMinutes: 45, movementRequired: false, interruptible: true, minAge: 18 },
  { id: "civic_action", name: "Participar da vida pública", category: "civic", targetKinds: ["building", "place", "person"], durationMinutes: 60, movementRequired: true, interruptible: true, minAge: 16 },
  { id: "underground_action", name: "Realizar atividade clandestina", category: "underground", targetKinds: ["business", "building", "person", "place"], durationMinutes: 45, movementRequired: true, interruptible: false, minAge: 18, illegal: true },
  { id: "wait", name: "Esperar", category: "time", targetKinds: [], durationMinutes: 15, movementRequired: false, interruptible: true, allowedWhileIncarcerated: true },
]);

// Short aliases are useful for consumers that do not need the longer domain names.
export const originCatalog = characterOriginCatalog;
export const goalCatalog = playerGoalCatalog;
export const actionCatalog = playerActionCatalog;

export function normalizeGameMode(mode) {
  return mode === GAME_MODES.GAMEPLAY ? GAME_MODES.GAMEPLAY : GAME_MODES.SPECTATOR;
}

export function gameModeDefinition(mode) {
  return catalogById(gameModeCatalog, normalizeGameMode(mode));
}

export function originsForAge(age) {
  const years = Math.floor(Number(age) || 0);
  return characterOriginCatalog.filter((origin) => years >= origin.minAge && years <= origin.maxAge);
}

export function namePoolForIdentity(identity) {
  if (identity === "mulher") return feminineFirstNames;
  if (identity === "homem") return masculineFirstNames;
  return neutralFirstNames;
}

export function isNameCoherentWithIdentity(firstName, identity) {
  return namePoolForIdentity(identity).some((name) => name.localeCompare(cleanText(firstName), "pt-BR", { sensitivity: "base" }) === 0);
}

export function createCharacterDraft(options = {}, rng = Math.random) {
  options = options && typeof options === "object" ? options : {};
  const identity = identities.includes(options.identity) ? options.identity : pick(identities, rng);
  const firstName = cleanText(options.firstName || firstNameForIdentity(identity, rng), 32);
  const family = cleanText(options.family || options.lastName || pick(lastNames, rng), 40);
  const age = clamp(Math.floor(Number(options.age) || 22), 6, 90);
  const availableOrigins = originsForAge(age);
  const originId = catalogById(availableOrigins, options.originId)?.id || availableOrigins[0]?.id || "city_native";
  const selectedTraits = unique(options.traits?.length ? options.traits : [pick(traitCatalog, rng), pick(traitCatalog, rng)]).slice(0, 4);
  const goalIds = unique(options.goalIds?.length ? options.goalIds : ["career", "social"]).slice(0, 3);
  return {
    firstName,
    family,
    age,
    identity,
    pronouns: pronounsForIdentity(identity),
    orientation: orientations.includes(options.orientation) ? options.orientation : pick(orientations, rng),
    traits: selectedTraits,
    originId,
    goalIds,
    professionPreference: cleanText(options.professionPreference, 60),
    biography: cleanText(options.biography, 360),
    appearance: options.appearance && serializable(options.appearance) ? { ...options.appearance } : createAppearance(rng),
  };
}

export function validateCharacterDraft(draft = {}, options = {}) {
  draft = draft && typeof draft === "object" ? draft : {};
  options = options && typeof options === "object" ? options : {};
  const errors = [], warnings = [];
  const firstName = cleanText(draft.firstName, 32), family = cleanText(draft.family || draft.lastName, 40);
  const age = Math.floor(Number(draft.age));
  const add = (collection, code, field, message) => collection.push({ code, field, message });
  if (!/^[\p{L}][\p{L}' -]{1,31}$/u.test(firstName)) add(errors, "invalid_first_name", "firstName", "Informe um primeiro nome válido.");
  if (!/^[\p{L}][\p{L}' -]{1,39}$/u.test(family)) add(errors, "invalid_family_name", "family", "Informe um sobrenome válido.");
  if (!identities.includes(draft.identity)) add(errors, "invalid_identity", "identity", "Selecione uma identidade disponível.");
  if (!Number.isFinite(age) || age < 6 || age > 90) add(errors, "invalid_age", "age", "A idade inicial deve estar entre 6 e 90 anos.");
  if (draft.orientation && !orientations.includes(draft.orientation)) add(errors, "invalid_orientation", "orientation", "Selecione uma orientação disponível.");
  const origin = catalogById(characterOriginCatalog, draft.originId);
  if (!origin) add(errors, "invalid_origin", "originId", "Selecione uma origem disponível.");
  else if (age < origin.minAge || age > origin.maxAge) add(errors, "origin_age_mismatch", "originId", `Essa origem aceita idades entre ${origin.minAge} e ${origin.maxAge} anos.`);
  const selectedTraits = unique(Array.isArray(draft.traits) ? draft.traits : []);
  if (!selectedTraits.length || selectedTraits.length > 4 || selectedTraits.some((trait) => !traitCatalog.includes(trait))) add(errors, "invalid_traits", "traits", "Escolha de uma a quatro características disponíveis.");
  const selectedGoals = unique(Array.isArray(draft.goalIds) ? draft.goalIds : []);
  if (!selectedGoals.length || selectedGoals.length > 3 || selectedGoals.some((id) => !catalogById(playerGoalCatalog, id))) add(errors, "invalid_goals", "goalIds", "Escolha de um a três objetivos disponíveis.");
  if (identities.includes(draft.identity) && firstName && !isNameCoherentWithIdentity(firstName, draft.identity)) {
    add(options.strictNameIdentity ? errors : warnings, "name_identity_mismatch", "firstName", "O nome não pertence ao catálogo da identidade selecionada.");
  }
  if (age < 18 && draft.originId !== "city_native" && draft.originId !== "student") add(errors, "minor_requires_supported_origin", "originId", "Menores precisam começar com família local ou vínculo estudantil.");
  if (!serializable(draft.appearance)) add(errors, "appearance_not_serializable", "appearance", "A aparência contém dados incompatíveis com salvamento.");
  return { valid: errors.length === 0, errors, warnings };
}

export function createPlayerCharacter(draft = {}, options = {}) {
  options = options && typeof options === "object" ? options : {};
  const normalized = createCharacterDraft(draft, options.rng || Math.random);
  const validation = validateCharacterDraft(normalized, options);
  if (!validation.valid) return { ok: false, character: null, ...validation };
  const origin = catalogById(characterOriginCatalog, normalized.originId);
  const character = {
    version: GAMEPLAY_VERSION,
    id: cleanText(options.id, 80) || `player-character:${slug(`${normalized.firstName}-${normalized.family}`)}`,
    name: `${normalized.firstName} ${normalized.family}`,
    ...normalized,
    startingConditions: {
      money: origin.startingMoney,
      housing: origin.housing,
      socialContacts: origin.socialContacts,
      reputation: origin.reputation,
    },
    goals: normalized.goalIds.map((id) => ({ id, progress: 0, status: "active", milestones: [] })),
    createdAt: clockOf(options.clock),
  };
  return { ok: true, character, ...validation };
}

export function createSimulationPersonPatch(character, context = {}) {
  if (!character?.name) throw new TypeError("Um personagem válido é necessário.");
  const origin = catalogById(characterOriginCatalog, character.originId) || characterOriginCatalog[0];
  const minor = Number(character.age) < 18;
  const student = minor || character.originId === "student";
  return {
    ...(context.personId ? { id: context.personId } : {}),
    name: character.name,
    firstName: character.firstName,
    family: character.family,
    age: character.age,
    identity: character.identity,
    pronouns: { ...character.pronouns },
    orientation: character.orientation,
    traits: [...character.traits],
    genetics: { ...character.appearance },
    role: student ? "Estudante" : "Desempregado(a)",
    workplace: student ? cleanText(context.institutionName, 80) || "A definir" : "—",
    wage: 0,
    money: Number(context.startingMoney ?? character.startingConditions?.money ?? origin.startingMoney),
    homeId: context.homeId || null,
    housing: context.housing || character.startingConditions?.housing || origin.housing,
    playerCharacterId: character.id,
    controlledByPlayer: true,
    decisionMode: "player",
    playerControl: { autonomyFallback: true, obeyRoutineWhenIdle: true, directCommandPriority: 100 },
    origin: { id: origin.id, tags: [...origin.tags] },
    personalGoals: character.goals.map((goal) => ({ ...goal, milestones: [...goal.milestones] })),
  };
}

export function createGameSession(options = {}) {
  options = options && typeof options === "object" ? options : {};
  const mode = normalizeGameMode(options.mode), definition = gameModeDefinition(mode), clock = clockOf(options.clock);
  return {
    version: GAMEPLAY_VERSION,
    id: cleanText(options.id, 80) || `game:${mode}:${options.seed ?? "local"}`,
    seed: options.seed ?? null,
    mode,
    status: "setup",
    createdAt: clock,
    updatedAt: clock,
    settings: {
      paceMultiplier: definition.paceMultiplier,
      recommendedPreset: definition.recommendedPreset,
      routineFallback: options.routineFallback !== false,
      pauseOnCriticalPlayerEvent: options.pauseOnCriticalPlayerEvent !== false,
      maxQueuedCommands: clamp(options.maxQueuedCommands || 12, 1, 50),
    },
    player: null,
    commandQueue: [],
    activeCommand: null,
    commandHistory: [],
    playerEvents: [],
    revision: 0,
  };
}

export function createNewGame(options = {}) {
  options = options && typeof options === "object" ? options : {};
  let state = createGameSession(options), character = null;
  if (state.mode === GAME_MODES.GAMEPLAY && options.characterDraft) {
    const created = createPlayerCharacter(options.characterDraft, { rng: options.rng, id: options.characterId, clock: options.clock, strictNameIdentity: options.strictNameIdentity });
    if (!created.ok) return { ok: false, reason: "invalid_character", state, errors: created.errors, warnings: created.warnings };
    character = created.character;
    state = attachPlayerCharacter(state, character, { personId: options.personId, clock: options.clock }).state;
  } else if (state.mode === GAME_MODES.SPECTATOR) {
    state = { ...state, status: "ready" };
  }
  if (options.autostart && (state.mode === GAME_MODES.SPECTATOR || character)) state = startGameSession(state, options.clock).state;
  return { ok: true, state, character, requiresCharacter: state.mode === GAME_MODES.GAMEPLAY && !character };
}

export function normalizeGameSession(value = {}) {
  const base = value?.version === GAMEPLAY_VERSION ? value : createGameSession(value);
  const definition = gameModeDefinition(base.mode);
  return {
    ...base,
    version: GAMEPLAY_VERSION,
    mode: definition.id,
    status: ["setup", "ready", "running", "paused", "ended"].includes(base.status) ? base.status : "setup",
    createdAt: clockOf(base.createdAt),
    updatedAt: clockOf(base.updatedAt),
    settings: { ...createGameSession({ mode: definition.id }).settings, ...base.settings },
    player: base.player ? {
      ...base.player,
      character: base.player.character ? { ...base.player.character } : null,
      personId: base.player.personId || null,
    } : null,
    commandQueue: (base.commandQueue || []).map((command) => ({ ...command, target: command.target ? { ...command.target } : null, payload: command.payload ? { ...command.payload } : {} })),
    activeCommand: base.activeCommand ? { ...base.activeCommand, target: base.activeCommand.target ? { ...base.activeCommand.target } : null, payload: base.activeCommand.payload ? { ...base.activeCommand.payload } : {} } : null,
    commandHistory: (base.commandHistory || []).slice(-120).map((command) => ({ ...command })),
    playerEvents: (base.playerEvents || []).slice(-120).map((event) => ({ ...event })),
    revision: Math.max(0, Math.floor(Number(base.revision) || 0)),
  };
}

export function attachPlayerCharacter(previousState, character, options = {}) {
  const state = normalizeGameSession(previousState);
  if (state.mode !== GAME_MODES.GAMEPLAY) return { ok: false, reason: "spectator_has_no_player", state };
  const validation = validateCharacterDraft(character, options);
  if (!validation.valid) return { ok: false, reason: "invalid_character", state, ...validation };
  const clock = clockOf(options.clock || state.updatedAt);
  return {
    ok: true,
    state: {
      ...state,
      status: "ready",
      player: { character: { ...character }, personId: options.personId || null, attachedAt: clock },
      updatedAt: clock,
      revision: state.revision + 1,
    },
  };
}

export function bindPlayerPerson(previousState, personId, clock) {
  const state = normalizeGameSession(previousState);
  if (state.mode !== GAME_MODES.GAMEPLAY || !state.player?.character || !cleanText(personId, 100)) return { ok: false, reason: "player_not_ready", state };
  const updatedAt = clockOf(clock || state.updatedAt);
  return { ok: true, state: { ...state, player: { ...state.player, personId: cleanText(personId, 100) }, updatedAt, revision: state.revision + 1 } };
}

export function startGameSession(previousState, clock) {
  const state = normalizeGameSession(previousState);
  if (state.mode === GAME_MODES.GAMEPLAY && !state.player?.character) return { ok: false, reason: "character_required", state };
  const updatedAt = clockOf(clock || state.updatedAt);
  return { ok: true, state: { ...state, status: "running", updatedAt, revision: state.revision + 1 } };
}

export function setGameSessionPaused(previousState, paused = true, clock) {
  const state = normalizeGameSession(previousState), updatedAt = clockOf(clock || state.updatedAt);
  if (state.status === "ended" || state.status === "setup") return { ok: false, reason: "session_not_started", state };
  return { ok: true, state: { ...state, status: paused ? "paused" : "running", updatedAt, revision: state.revision + 1 } };
}

function worldHasTarget(world, target) {
  if (!target?.id || !world) return true;
  const groups = target.kind === "person" ? [world.people] : target.kind === "business" ? [world.businesses] : target.kind === "vehicle" ? [world.vehicles] : [world.buildings, world.businesses, world.places];
  const provided = groups.filter(Array.isArray);
  return !provided.length || provided.some((items) => items.some((item) => item?.id === target.id));
}

export function validatePlayerCommand(previousState, input = {}, world = {}) {
  input = input && typeof input === "object" ? input : {};
  world = world && typeof world === "object" ? world : {};
  const state = normalizeGameSession(previousState), errors = [], action = catalogById(playerActionCatalog, input.actionId);
  const fail = (code, message) => errors.push({ code, message });
  if (state.mode !== GAME_MODES.GAMEPLAY) fail("not_gameplay_mode", "Comandos diretos existem apenas no Modo Gameplay.");
  if (!state.player?.character || !state.player?.personId) fail("player_not_bound", "O personagem ainda não foi inserido na simulação.");
  if (!["running", "paused"].includes(state.status)) fail("session_not_active", "Inicie a sessão antes de escolher uma ação.");
  if (!action) fail("unknown_action", "A ação escolhida não existe.");
  const target = input.target?.id ? { kind: cleanText(input.target.kind, 30), id: cleanText(input.target.id, 100), label: cleanText(input.target.label, 100) } : null;
  if (action?.targetKinds.length && (!target || !action.targetKinds.includes(target.kind))) fail("invalid_target", "Escolha um alvo compatível com a ação.");
  if (target && !worldHasTarget(world, target)) fail("target_not_found", "O alvo não existe mais na cidade.");
  const person = world.playerPerson || (Array.isArray(world.people) ? world.people.find((entry) => entry.id === state.player?.personId) : null);
  if (person?.alive === false) fail("player_dead", "O personagem não pode iniciar novas ações após morrer.");
  if (person?.justice?.incarcerated && action && !action.allowedWhileIncarcerated) fail("player_incarcerated", "Essa ação não está disponível durante a prisão.");
  if (action?.minAge && Number(person?.age ?? state.player?.character?.age) < action.minAge) fail("minimum_age", `Essa ação exige idade mínima de ${action.minAge} anos.`);
  const cost = Math.max(0, Number(input.cost) || 0);
  if (action?.usesMoney && person && Number(person.money) < cost) fail("insufficient_money", "O personagem não possui dinheiro suficiente.");
  if (!plainRecord(input.payload) || !serializable(input.payload || {})) fail("payload_not_serializable", "Os detalhes da ação precisam ser um objeto compatível com salvamento.");
  if (state.commandQueue.length >= state.settings.maxQueuedCommands) fail("queue_full", "A fila de decisões está cheia.");
  return { valid: errors.length === 0, errors, action, target, cost };
}

export function enqueuePlayerCommand(previousState, input = {}, world = {}, options = {}) {
  input = input && typeof input === "object" ? input : {};
  options = options && typeof options === "object" ? options : {};
  const state = normalizeGameSession(previousState), validation = validatePlayerCommand(state, input, world);
  if (!validation.valid) return { ok: false, reason: validation.errors[0]?.code, errors: validation.errors, state };
  const clock = clockOf(options.clock || world.clock || state.updatedAt), sequence = state.revision + 1;
  const command = {
    id: cleanText(input.id, 100) || `player-command:${state.id}:${sequence}`,
    actionId: validation.action.id,
    category: validation.action.category,
    personId: state.player.personId,
    target: validation.target,
    payload: input.payload && serializable(input.payload) ? { ...input.payload } : {},
    cost: validation.cost,
    priority: clamp(input.priority ?? 70, 0, 100),
    status: "queued",
    createdAt: clock,
    sequence,
    estimatedDurationMinutes: Math.max(1, Number(input.durationMinutes) || validation.action.durationMinutes),
    interruptible: validation.action.interruptible,
  };
  let queue = state.commandQueue;
  if (options.replaceNavigation !== false && command.category === "navigation") {
    queue = queue.filter((queued) => queued.category !== "navigation");
  }
  queue = [...queue, command].sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
  return { ok: true, command, state: { ...state, commandQueue: queue, updatedAt: clock, revision: sequence } };
}

export function beginNextPlayerCommand(previousState, options = {}) {
  const state = normalizeGameSession(previousState);
  if (state.activeCommand) return { ok: false, reason: "command_already_active", command: state.activeCommand, state };
  const next = state.commandQueue[0];
  if (!next) return { ok: false, reason: "queue_empty", state };
  const clock = clockOf(options.clock || state.updatedAt), command = { ...next, status: "active", startedAt: clock };
  return { ok: true, command, state: { ...state, activeCommand: command, commandQueue: state.commandQueue.slice(1), updatedAt: clock, revision: state.revision + 1 } };
}

export function resolvePlayerCommand(previousState, commandId, result = {}, options = {}) {
  const state = normalizeGameSession(previousState), active = state.activeCommand;
  if (!active || active.id !== commandId) return { ok: false, reason: "active_command_not_found", state };
  const status = result.ok === false ? "failed" : "completed", clock = clockOf(options.clock || state.updatedAt);
  const command = { ...active, status, finishedAt: clock, outcome: serializable(result.outcome) ? result.outcome ?? null : null, reason: cleanText(result.reason, 120) || null };
  return { ok: true, command, state: { ...state, activeCommand: null, commandHistory: [...state.commandHistory, command].slice(-120), updatedAt: clock, revision: state.revision + 1 } };
}

export function cancelPlayerCommand(previousState, commandId, reason = "cancelled_by_player", options = {}) {
  const state = normalizeGameSession(previousState), queued = state.commandQueue.find((command) => command.id === commandId), active = state.activeCommand?.id === commandId ? state.activeCommand : null, command = active || queued;
  if (!command) return { ok: false, reason: "command_not_found", state };
  if (active && !active.interruptible && !options.force) return { ok: false, reason: "command_not_interruptible", state };
  const clock = clockOf(options.clock || state.updatedAt), cancelled = { ...command, status: "cancelled", finishedAt: clock, reason: cleanText(reason, 120) };
  return { ok: true, command: cancelled, state: { ...state, activeCommand: active ? null : state.activeCommand, commandQueue: state.commandQueue.filter((entry) => entry.id !== commandId), commandHistory: [...state.commandHistory, cancelled].slice(-120), updatedAt: clock, revision: state.revision + 1 } };
}

export function clearQueuedPlayerCommands(previousState, reason = "queue_cleared", options = {}) {
  const state = normalizeGameSession(previousState), clock = clockOf(options.clock || state.updatedAt);
  const cancelled = state.commandQueue.map((command) => ({ ...command, status: "cancelled", finishedAt: clock, reason }));
  return { ok: true, cancelled, state: { ...state, commandQueue: [], commandHistory: [...state.commandHistory, ...cancelled].slice(-120), updatedAt: clock, revision: state.revision + 1 } };
}

export function recordPlayerEvent(previousState, event = {}, options = {}) {
  event = event && typeof event === "object" ? event : {};
  const state = normalizeGameSession(previousState), clock = clockOf(options.clock || state.updatedAt);
  const entry = { id: cleanText(event.id, 100) || `player-event:${state.id}:${state.revision + 1}`, kind: cleanText(event.kind, 40) || "life", title: cleanText(event.title, 100), text: cleanText(event.text, 360), importance: clamp(event.importance ?? 50, 0, 100), clock, relatedIds: unique(event.relatedIds || []).slice(0, 12) };
  return { event: entry, state: { ...state, playerEvents: [...state.playerEvents, entry].slice(-120), updatedAt: clock, revision: state.revision + 1 } };
}

export function updatePlayerGoal(previousState, goalId, delta, milestone, options = {}) {
  const state = normalizeGameSession(previousState);
  if (!state.player?.character) return { ok: false, reason: "character_required", state };
  const goalDefinition = catalogById(playerGoalCatalog, goalId), goal = state.player.character.goals?.find((entry) => entry.id === goalId);
  if (!goalDefinition || !goal) return { ok: false, reason: "goal_not_found", state };
  const progress = clamp(goal.progress + Number(delta || 0), 0, goalDefinition.target), clock = clockOf(options.clock || state.updatedAt);
  const updatedGoal = { ...goal, progress, status: progress >= goalDefinition.target ? "completed" : "active", milestones: milestone ? [...(goal.milestones || []), { text: cleanText(milestone, 160), clock }].slice(-30) : [...(goal.milestones || [])] };
  const character = { ...state.player.character, goals: state.player.character.goals.map((entry) => entry.id === goalId ? updatedGoal : entry) };
  return { ok: true, goal: updatedGoal, state: { ...state, player: { ...state.player, character }, updatedAt: clock, revision: state.revision + 1 } };
}

export function getSessionPaceMultiplier(session) {
  const state = normalizeGameSession(session);
  return clamp(state.settings.paceMultiplier ?? gameModeDefinition(state.mode).paceMultiplier, .1, 2);
}

export function gameplayDirective(session) {
  const state = normalizeGameSession(session);
  return {
    mode: state.mode,
    directControl: state.mode === GAME_MODES.GAMEPLAY,
    playerPersonId: state.player?.personId || null,
    paceMultiplier: getSessionPaceMultiplier(state),
    activeCommand: state.activeCommand ? { ...state.activeCommand } : null,
    nextCommand: state.commandQueue[0] ? { ...state.commandQueue[0] } : null,
    routineFallback: state.settings.routineFallback,
  };
}

export function summarizeGameSession(session) {
  const state = normalizeGameSession(session);
  return {
    id: state.id,
    mode: state.mode,
    status: state.status,
    playerName: state.player?.character?.name || null,
    playerPersonId: state.player?.personId || null,
    queuedCommands: state.commandQueue.length,
    activeActionId: state.activeCommand?.actionId || null,
    completedCommands: state.commandHistory.filter((command) => command.status === "completed").length,
    failedCommands: state.commandHistory.filter((command) => command.status === "failed").length,
    importantEvents: state.playerEvents.filter((event) => event.importance >= 75).length,
    paceMultiplier: getSessionPaceMultiplier(state),
  };
}

export function serializeGameSession(session) {
  return JSON.stringify(normalizeGameSession(session));
}

export function deserializeGameSession(serialized) {
  const value = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  if (!value || typeof value !== "object") throw new TypeError("Save de sessão inválido.");
  return normalizeGameSession(value);
}

export function tryDeserializeGameSession(serialized) {
  try {
    return { ok: true, state: deserializeGameSession(serialized), error: null };
  } catch (error) {
    return { ok: false, state: null, error: cleanText(error?.message || error, 180) };
  }
}
