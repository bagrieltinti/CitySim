/**
 * InvestigationDynamics
 *
 * Camada pura e serializável para acompanhamento detalhado de investigações.
 * Converte ocorrências legadas do `justiceSystem` em inquéritos com relógio,
 * cenas, cadeia de custódia, perícias, depoimentos, hipóteses e atos legais.
 *
 * O módulo não altera pessoas, dinheiro, prisão, tribunal ou os objetos de
 * entrada. Prisões, multas e interdições aparecem como pedidos de integração;
 * cabe à Simulation aplicar (ou rejeitar) seus efeitos no mundo.
 */

export const INVESTIGATION_DYNAMICS_VERSION = 1;

export const INVESTIGATION_LIMITS = Object.freeze({
  cases: 600,
  timelinePerCase: 240,
  evidencePerCase: 40,
  custodyPerEvidence: 32,
  statementsPerCase: 48,
  diligencesPerCase: 48,
  warrantsPerCase: 20,
  hypothesesPerCase: 16,
  operations: 160,
  fines: 240,
  recentActions: 240,
  historyDays: 90,
});

export const INVESTIGATION_CASE_STATUSES = Object.freeze({
  REPORTED: "reported",
  SCENE_PROCESSING: "scene_processing",
  INVESTIGATING: "investigating",
  SUSPECT_IDENTIFIED: "suspect_identified",
  LEGAL_REVIEW: "legal_review",
  OPERATION_PLANNED: "operation_planned",
  ELUCIDATED: "elucidated",
  REFERRED_TO_COURT: "referred_to_court",
  ARCHIVED: "archived",
  CLOSED: "closed",
});

export const INVESTIGATION_EVIDENCE_STATUSES = Object.freeze({
  COLLECTED: "collected",
  SEALED: "sealed",
  LAB_QUEUE: "lab_queue",
  IN_ANALYSIS: "in_analysis",
  VALIDATED: "validated",
  INCONCLUSIVE: "inconclusive",
  EXCLUDED: "excluded",
});

const TERMINAL_CASE_STATUSES = new Set([
  INVESTIGATION_CASE_STATUSES.ELUCIDATED,
  INVESTIGATION_CASE_STATUSES.REFERRED_TO_COURT,
  INVESTIGATION_CASE_STATUSES.ARCHIVED,
  INVESTIGATION_CASE_STATUSES.CLOSED,
]);

const OFFENSE_PROFILES = Object.freeze({
  noise: { label: "Perturbação do sossego", severity: "minor", fine: 180, violent: false },
  vandalism: { label: "Vandalismo", severity: "minor", fine: 650, violent: false },
  theft: { label: "Furto", severity: "medium", fine: 900, violent: false },
  fraud: { label: "Fraude", severity: "medium", fine: 2800, violent: false },
  assault: { label: "Agressão", severity: "serious", fine: 1500, violent: true },
  robbery: { label: "Roubo", severity: "serious", fine: 3200, violent: true },
  corruption: { label: "Corrupção", severity: "serious", fine: 8000, violent: false },
  burglary: { label: "Invasão e furto residencial", severity: "medium", fine: 1800, violent: false },
  vehicle_theft: { label: "Roubo de veículo", severity: "serious", fine: 4200, violent: false },
  cybercrime: { label: "Crime cibernético", severity: "medium", fine: 5200, violent: false },
  drug_trafficking: { label: "Tráfico de entorpecentes", severity: "serious", fine: 9000, violent: false },
  arson: { label: "Incêndio criminoso", severity: "serious", fine: 12000, violent: true },
  homicide: { label: "Homicídio", severity: "critical", fine: 20000, violent: true },
  domestic_violence: { label: "Violência doméstica", severity: "serious", fine: 4500, violent: true },
  kidnapping: { label: "Sequestro e cárcere privado", severity: "critical", fine: 18000, violent: true },
  extortion: { label: "Extorsão", severity: "serious", fine: 7500, violent: false },
  money_laundering: { label: "Lavagem de dinheiro", severity: "serious", fine: 15000, violent: false },
  organized_crime: { label: "Organização criminosa", severity: "critical", fine: 22000, violent: true },
  environmental_crime: { label: "Crime ambiental", severity: "medium", fine: 11000, violent: false },
  traffic_crime: { label: "Crime de trânsito", severity: "medium", fine: 2600, violent: true },
});

const EVIDENCE_CATALOG = Object.freeze([
  Object.freeze({ type: "camera_footage", label: "Imagem de câmera", category: "digital", forensic: true, discipline: "análise audiovisual", baseStrength: 16 }),
  Object.freeze({ type: "fingerprints", label: "Impressões digitais", category: "trace", forensic: true, discipline: "papiloscopia", baseStrength: 18 }),
  Object.freeze({ type: "biological_material", label: "Material biológico", category: "biological", forensic: true, discipline: "genética forense", baseStrength: 24 }),
  Object.freeze({ type: "phone_records", label: "Registro telefônico", category: "digital", forensic: true, discipline: "informática forense", baseStrength: 15 }),
  Object.freeze({ type: "seized_object", label: "Objeto apreendido", category: "physical", forensic: true, discipline: "química e vestígios", baseStrength: 14 }),
  Object.freeze({ type: "financial_records", label: "Registros financeiros", category: "documentary", forensic: true, discipline: "contabilidade forense", baseStrength: 20 }),
  Object.freeze({ type: "ballistic_trace", label: "Vestígio balístico", category: "ballistic", forensic: true, discipline: "balística forense", baseStrength: 23 }),
  Object.freeze({ type: "scene_photographs", label: "Registro fotográfico da cena", category: "documentary", forensic: false, discipline: null, baseStrength: 8 }),
  Object.freeze({ type: "property_record", label: "Registro patrimonial", category: "documentary", forensic: false, discipline: null, baseStrength: 10 }),
  Object.freeze({ type: "transaction_record", label: "Registro de transação", category: "documentary", forensic: true, discipline: "contabilidade forense", baseStrength: 17 }),
]);

const OFFENSE_EVIDENCE = Object.freeze({
  homicide: ["biological_material", "fingerprints", "camera_footage", "ballistic_trace", "phone_records", "scene_photographs"],
  assault: ["biological_material", "camera_footage", "scene_photographs", "fingerprints"],
  robbery: ["camera_footage", "fingerprints", "seized_object", "phone_records"],
  burglary: ["fingerprints", "camera_footage", "seized_object", "property_record"],
  vehicle_theft: ["fingerprints", "camera_footage", "property_record", "phone_records"],
  fraud: ["financial_records", "transaction_record", "phone_records"],
  corruption: ["financial_records", "transaction_record", "phone_records"],
  money_laundering: ["financial_records", "transaction_record", "phone_records"],
  cybercrime: ["phone_records", "transaction_record", "financial_records"],
  arson: ["seized_object", "camera_footage", "biological_material", "scene_photographs"],
});

const DAY_NAMES = Object.freeze(["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]);
const clamp = (value, minimum = 0, maximum = 100) => {
  const number = Number(value);
  return Math.max(minimum, Math.min(maximum, Number.isFinite(number) ? number : minimum));
};
const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};
const text = (value) => String(value ?? "").trim();
const lower = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
const firstArray = (...values) => values.find(Array.isArray) ?? [];
const firstFinite = (...values) => {
  for (const value of values) {
    if (value == null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
};
const idOf = (value) => text(value && typeof value === "object" ? value.id ?? value.personId ?? value.caseId : value);
const uniqueIds = (values, limit = Infinity) => [...new Set(asArray(values).map(idOf).filter(Boolean))].slice(0, limit);
const deepClone = (value) => {
  if (Array.isArray(value)) return value.map(deepClone);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, entry]) => typeof entry !== "function" && entry !== undefined).map(([key, entry]) => [key, deepClone(entry)]));
  return value;
};
const stableHash = (value) => {
  let hash = 2166136261;
  for (const character of text(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
};
const randomUnit = (random, key) => {
  if (typeof random !== "function") return stableHash(key);
  const value = Number(random());
  return Number.isFinite(value) ? clamp(value, 0, 0.999999) : stableHash(key);
};
const statusHas = (value, terms) => terms.some((term) => lower(value).includes(term));
const terminal = (caseRecord) => TERMINAL_CASE_STATUSES.has(caseRecord?.status);

const parseHour = (value, fallback = 0) => {
  const match = text(value).match(/(\d{1,2}):(\d{2})/);
  return match ? { hour: clamp(Number(match[1]), 0, 23), minute: clamp(Number(match[2]), 0, 59) } : { hour: fallback, minute: 0 };
};

const makeClock = (snapshot = {}, options = {}, previous = null, incrementHours = 0) => {
  const optionAbsolute = firstFinite(options.absoluteHour);
  const snapshotAbsolute = firstFinite(snapshot.absoluteHour, snapshot.clock?.absoluteHour);
  const explicitAbsolute = optionAbsolute ?? snapshotAbsolute;
  const optionTime = text(options.time) ? parseHour(options.time, null) : { hour: null, minute: null };
  const snapshotTime = text(snapshot.time) ? parseHour(snapshot.time, null) : { hour: null, minute: null };
  const optionWeek = firstFinite(options.week);
  const optionDay = firstFinite(options.day, options.dayOfWeek);
  const optionHour = firstFinite(options.hour, optionTime.hour);
  const optionMinute = firstFinite(options.minute, optionTime.minute);
  const snapshotWeek = firstFinite(snapshot.week);
  const snapshotDay = firstFinite(snapshot.day, snapshot.dayOfWeek);
  const snapshotHour = firstFinite(snapshot.hour, snapshotTime.hour);
  const snapshotMinute = firstFinite(snapshot.minute, snapshotTime.minute);
  const sourceWeek = optionWeek ?? (optionAbsolute != null ? null : snapshotWeek);
  const sourceDay = optionDay ?? (optionAbsolute != null ? null : snapshotDay);
  const sourceHour = optionHour ?? (optionAbsolute != null ? null : snapshotHour);
  const sourceMinute = optionMinute ?? (optionAbsolute != null ? null : snapshotMinute);
  let absoluteHour;
  if (explicitAbsolute != null) absoluteHour = Math.max(0, Math.floor(explicitAbsolute));
  else if (sourceWeek != null) absoluteHour = (Math.max(0, Math.floor(sourceWeek)) * 7 + clamp(Math.floor(sourceDay || 0), 0, 6)) * 24 + clamp(Math.floor(sourceHour || 0), 0, 23);
  else absoluteHour = Math.max(0, Math.floor(Number(previous?.absoluteHour) || 0) + incrementHours);
  const week = sourceWeek == null ? Math.floor(absoluteHour / (7 * 24)) : Math.max(0, Math.floor(sourceWeek));
  const day = sourceDay == null ? Math.floor(absoluteHour / 24) % 7 : clamp(Math.floor(sourceDay), 0, 6);
  const hour = sourceHour == null ? absoluteHour % 24 : clamp(Math.floor(sourceHour), 0, 23);
  const minute = clamp(Math.floor(sourceMinute || 0), 0, 59);
  return {
    week,
    day,
    hour,
    minute,
    absoluteHour,
    label: `Sem. ${week}, ${DAY_NAMES[day]} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
};

const normalizeClock = (clock, fallback = null) => makeClock(clock ?? {}, clock ?? {}, fallback, 0);
const clockAfter = (clock, hours) => makeClock({}, { absoluteHour: clock.absoluteHour + hours });

const normalizedSourceStatus = (source) => {
  const status = lower(source?.status);
  if (statusHas(status, ["encaminhado ao tribunal", "referred", "audiencia marcada"])) return INVESTIGATION_CASE_STATUSES.REFERRED_TO_COURT;
  if (statusHas(status, ["arquivado", "archived", "absolvido", "acquitted"])) return INVESTIGATION_CASE_STATUSES.ARCHIVED;
  if (statusHas(status, ["condenado", "convicted", "closed", "encerrado"])) return INVESTIGATION_CASE_STATUSES.CLOSED;
  if (statusHas(status, ["suspeito identificado", "suspect identified"])) return INVESTIGATION_CASE_STATUSES.SUSPECT_IDENTIFIED;
  if (statusHas(status, ["investig", "preservacao", "preservação"])) return INVESTIGATION_CASE_STATUSES.INVESTIGATING;
  return INVESTIGATION_CASE_STATUSES.REPORTED;
};

const profileFor = (offenseId, source = {}) => {
  const known = OFFENSE_PROFILES[offenseId];
  if (known) return known;
  const severityText = lower(source.severity);
  const severity = statusHas(severityText, ["gravissim", "critical"]) ? "critical" : statusHas(severityText, ["grave", "serious"]) ? "serious" : statusHas(severityText, ["medio", "médio", "medium"]) ? "medium" : "minor";
  return { label: text(source.offenseName ?? source.title ?? offenseId) || "Ocorrência", severity, fine: Math.max(0, Number(source.fine) || 0), violent: Boolean(source.violent) };
};

const priorityFor = (source, profile) => clamp(firstFinite(source.priority, profile.severity === "critical" ? 5 : profile.severity === "serious" ? 4 : profile.severity === "medium" ? 3 : 2) || 2, 1, 5);

const nextId = (state, prefix) => {
  state.serials[prefix] = Math.max(0, Math.floor(Number(state.serials[prefix]) || 0)) + 1;
  return `${prefix}:${state.clock.absoluteHour}:${state.serials[prefix]}`;
};

const reconcileSerials = (state) => {
  const visit = (value, key = null) => {
    if (Array.isArray(value)) { value.forEach((entry) => visit(entry)); return; }
    if (!value || typeof value !== "object") return;
    for (const [childKey, child] of Object.entries(value)) {
      if (childKey === "id" && typeof child === "string") {
        const parts = child.split(":");
        const sequence = Number(parts.at(-1));
        if (parts.length >= 2 && Number.isFinite(sequence)) state.serials[parts[0]] = Math.max(state.serials[parts[0]] || 0, Math.floor(sequence));
      } else if (childKey !== "serials") visit(child, childKey);
    }
  };
  visit(state);
  return state.serials;
};

const timelineEvent = (state, caseRecord, event = {}) => {
  const clock = normalizeClock(event.at ?? state.clock, state.clock);
  const signature = text(event.signature ?? `${event.type}:${clock.absoluteHour}:${event.title}:${event.detail}`);
  if (caseRecord.timeline.some((entry) => entry.signature === signature)) return null;
  const entry = {
    id: event.id ?? nextId(state, "timeline"),
    signature,
    at: clock,
    type: event.type ?? "update",
    title: text(event.title) || "Atualização do inquérito",
    detail: text(event.detail),
    actorIds: uniqueIds(event.actorIds),
    placeId: idOf(event.placeId) || null,
    relatedIds: uniqueIds(event.relatedIds),
    visibility: event.visibility ?? "public_record",
  };
  caseRecord.timeline.unshift(entry);
  caseRecord.timeline = caseRecord.timeline.slice(0, INVESTIGATION_LIMITS.timelinePerCase);
  caseRecord.lastUpdatedAt = clock;
  return entry;
};

const recentAction = (state, caseRecord, action, timeline = null) => {
  const record = {
    id: nextId(state, "action"),
    caseId: caseRecord.id,
    at: deepClone(state.clock),
    action,
    timelineId: timeline?.id ?? null,
  };
  state.recentActions.unshift(record);
  state.recentActions = state.recentActions.slice(0, INVESTIGATION_LIMITS.recentActions);
  return record;
};

const custodyEntry = (state, evidence, entry = {}) => {
  const record = {
    id: nextId(state, "custody"),
    at: deepClone(state.clock),
    action: entry.action ?? "registered",
    from: entry.from ?? null,
    to: entry.to ?? null,
    actorId: idOf(entry.actorId) || null,
    seal: entry.seal ?? evidence.sealId ?? null,
    condition: entry.condition ?? "intact",
    note: text(entry.note),
  };
  evidence.custody.push(record);
  evidence.custody = evidence.custody.slice(-INVESTIGATION_LIMITS.custodyPerEvidence);
  return record;
};

const evidenceDefinition = (type) => EVIDENCE_CATALOG.find((entry) => entry.type === type) ?? EVIDENCE_CATALOG[4];
const inferEvidenceType = (value) => {
  const source = lower(value);
  if (statusHas(source, ["digital", "camera", "câmera", "imagem", "video", "vídeo"])) return "camera_footage";
  if (statusHas(source, ["impress", "digital papilar"])) return "fingerprints";
  if (statusHas(source, ["biologic", "dna", "sangue", "genetic"])) return "biological_material";
  if (statusHas(source, ["telefone", "telefonico", "telefônico", "celular"])) return "phone_records";
  if (statusHas(source, ["finance", "contabil", "contábil"])) return "financial_records";
  if (statusHas(source, ["transacao", "transação", "pagamento"])) return "transaction_record";
  if (statusHas(source, ["balistic", "arma", "projetil", "projétil"])) return "ballistic_trace";
  if (statusHas(source, ["foto", "fotograf"])) return "scene_photographs";
  if (statusHas(source, ["patrimon", "veiculo", "veículo"])) return "property_record";
  return "seized_object";
};

const normalizeEvidence = (raw, caseId, clock, index = 0) => {
  const type = raw?.type && EVIDENCE_CATALOG.some((entry) => entry.type === raw.type) ? raw.type : inferEvidenceType(raw?.label ?? raw?.type);
  const definition = evidenceDefinition(type);
  const legacyStatus = lower(raw?.status);
  const status = Object.values(INVESTIGATION_EVIDENCE_STATUSES).includes(raw?.status) ? raw.status
    : statusHas(legacyStatus, ["valid", "laudo conclu", "completed"]) ? INVESTIGATION_EVIDENCE_STATUSES.VALIDATED
    : statusHas(legacyStatus, ["inconclus", "indetermin"]) ? INVESTIGATION_EVIDENCE_STATUSES.INCONCLUSIVE
      : statusHas(legacyStatus, ["aguardando per", "queue", "fila"]) ? INVESTIGATION_EVIDENCE_STATUSES.LAB_QUEUE
        : statusHas(legacyStatus, ["analise", "análise", "processing"]) ? INVESTIGATION_EVIDENCE_STATUSES.IN_ANALYSIS
          : raw?.sealed === false ? INVESTIGATION_EVIDENCE_STATUSES.COLLECTED : INVESTIGATION_EVIDENCE_STATUSES.SEALED;
  const collectedAt = normalizeClock(raw?.collectedAt ?? clock, clock);
  const forensicRequired = raw?.forensic ?? raw?.forensic?.required ?? definition.forensic;
  const evidence = {
    id: idOf(raw) || `evidence:${caseId}:${index + 1}`,
    type,
    label: text(raw?.label ?? (raw?.type && !EVIDENCE_CATALOG.some((entry) => entry.type === raw.type) ? raw.type : definition.label)) || definition.label,
    category: raw?.category ?? definition.category,
    sourceSceneId: idOf(raw?.sourceSceneId) || null,
    status,
    strength: clamp(firstFinite(raw?.strength, definition.baseStrength) || definition.baseStrength, 0, 40),
    reliability: clamp(firstFinite(raw?.reliability, status === INVESTIGATION_EVIDENCE_STATUSES.VALIDATED ? 78 : 55) || 55),
    collectedAt,
    collectedById: idOf(raw?.collectedById ?? raw?.collectorId) || null,
    sealId: text(raw?.sealId) || `seal:${caseId}:${index + 1}`,
    sealed: raw?.sealed !== false,
    storageLocation: raw?.storageLocation ?? "evidence_room",
    linkedPersonIds: uniqueIds(raw?.linkedPersonIds ?? raw?.personIds),
    custody: asArray(raw?.custody).map((entry, custodyIndex) => ({
      id: idOf(entry) || `custody:${caseId}:${index + 1}:${custodyIndex + 1}`,
      at: normalizeClock(entry?.at ?? collectedAt, collectedAt),
      action: entry?.action ?? "registered",
      from: entry?.from ?? null,
      to: entry?.to ?? null,
      actorId: idOf(entry?.actorId) || null,
      seal: entry?.seal ?? raw?.sealId ?? null,
      condition: entry?.condition ?? "intact",
      note: text(entry?.note),
    })).slice(-INVESTIGATION_LIMITS.custodyPerEvidence),
    forensic: {
      required: Boolean(forensicRequired),
      discipline: raw?.forensic?.discipline ?? definition.discipline,
      status: raw?.forensic?.status ?? (status === INVESTIGATION_EVIDENCE_STATUSES.VALIDATED ? "completed" : forensicRequired ? "pending" : "not_required"),
      requestedAt: raw?.forensic?.requestedAt ? normalizeClock(raw.forensic.requestedAt, clock) : null,
      dueAt: raw?.forensic?.dueAt ? normalizeClock(raw.forensic.dueAt, clock) : null,
      completedAt: raw?.forensic?.completedAt ? normalizeClock(raw.forensic.completedAt, clock) : status === INVESTIGATION_EVIDENCE_STATUSES.VALIDATED ? collectedAt : null,
      analystId: idOf(raw?.forensic?.analystId) || null,
      result: text(raw?.forensic?.result ?? raw?.result) || null,
      confidence: clamp(firstFinite(raw?.forensic?.confidence, raw?.confidence, status === INVESTIGATION_EVIDENCE_STATUSES.VALIDATED ? 75 : 0) || 0),
    },
  };
  if (!evidence.custody.length) {
    evidence.custody.push({ id: `custody:import:${evidence.id}`, at: collectedAt, action: "legacy_import", from: null, to: evidence.storageLocation, actorId: evidence.collectedById, seal: evidence.sealId, condition: "recorded", note: "Registro anterior incorporado ao inquérito digital." });
  }
  return evidence;
};

const normalizeCaseRecord = (raw, fallbackClock) => {
  const openedAt = normalizeClock(raw.openedAt ?? { week: raw.week, day: raw.day, time: raw.time }, fallbackClock);
  const sourceCaseId = idOf(raw.sourceCaseId ?? raw.id);
  const offenseId = text(raw.offenseId ?? (raw.homicide ? "homicide" : "unknown")) || "unknown";
  const profile = profileFor(offenseId, raw);
  const caseId = text(raw.id) || `investigation:${sourceCaseId}`;
  const timeline = asArray(raw.timeline).map((entry, index) => {
    const at = normalizeClock(entry.at ?? { week: entry.week ?? openedAt.week, day: entry.day ?? openedAt.day, time: entry.time ?? raw.time }, openedAt);
    return {
      id: idOf(entry) || `timeline:${caseId}:${index + 1}`,
      signature: text(entry.signature) || `source:${sourceCaseId}:${entry.id ?? index}:${entry.week}:${entry.day}:${entry.text ?? entry.detail}`,
      at,
      type: entry.type ?? "legacy_update",
      title: text(entry.title) || "Registro incorporado",
      detail: text(entry.detail ?? entry.text),
      actorIds: uniqueIds(entry.actorIds),
      placeId: idOf(entry.placeId ?? raw.locationId) || null,
      relatedIds: uniqueIds(entry.relatedIds),
      visibility: entry.visibility ?? "public_record",
    };
  });
  const evidence = asArray(raw.evidence).map((entry, index) => normalizeEvidence(entry, caseId, openedAt, index)).slice(0, INVESTIGATION_LIMITS.evidencePerCase);
  const suspectIds = uniqueIds([raw.suspectId, ...asArray(raw.suspectIds), ...asArray(raw.suspects).map((entry) => entry?.personId ?? entry)]);
  const suspects = suspectIds.map((personId, index) => {
    const existing = asArray(raw.suspects).find((entry) => idOf(entry?.personId ?? entry) === personId);
    return {
      personId,
      status: existing?.status ?? (index === 0 ? "identified" : "person_of_interest"),
      score: clamp(firstFinite(existing?.score, raw.suspectId === personId ? 52 : 30) || 30),
      basis: uniqueIds(existing?.basis),
      notes: asArray(existing?.notes).map(text).filter(Boolean).slice(0, 12),
      alibi: existing?.alibi ? deepClone(existing.alibi) : null,
      rightsNotified: Boolean(existing?.rightsNotified),
      lastInterviewAt: existing?.lastInterviewAt ? normalizeClock(existing.lastInterviewAt, openedAt) : null,
      excludedAt: existing?.excludedAt ? normalizeClock(existing.excludedAt, openedAt) : null,
    };
  });
  return {
    id: caseId,
    sourceCaseId,
    offenseId,
    title: text(raw.title) || `Inquérito: ${profile.label}`,
    severity: raw.severity ?? profile.severity,
    priority: priorityFor(raw, profile),
    homicide: Boolean(raw.homicide || offenseId === "homicide"),
    status: Object.values(INVESTIGATION_CASE_STATUSES).includes(raw.investigationStatus ?? raw.status)
      ? raw.investigationStatus ?? raw.status
      : normalizedSourceStatus(raw),
    sourceStatus: text(raw.sourceStatus ?? raw.status),
    openedAt,
    lastUpdatedAt: normalizeClock(raw.lastUpdatedAt ?? openedAt, openedAt),
    locationId: idOf(raw.locationId) || null,
    districtId: idOf(raw.districtId) || null,
    victimIds: uniqueIds([raw.victimId, ...asArray(raw.victimIds)]),
    deathRecordId: idOf(raw.deathRecordId) || null,
    forensicCaseId: idOf(raw.forensicCaseId) || null,
    leadInvestigatorId: idOf(raw.leadInvestigatorId ?? raw.assignedOfficerId) || null,
    assignedOfficerIds: uniqueIds([raw.assignedOfficerId, ...asArray(raw.assignedOfficerIds)]),
    scenes: asArray(raw.scenes).map((scene, index) => ({
      id: idOf(scene) || `scene:${caseId}:${index + 1}`,
      type: scene.type ?? "primary",
      locationId: idOf(scene.locationId ?? raw.locationId) || null,
      status: scene.status ?? "reported",
      integrity: clamp(firstFinite(scene.integrity, 100) || 100),
      preservedAt: scene.preservedAt ? normalizeClock(scene.preservedAt, openedAt) : null,
      processingStartedAt: scene.processingStartedAt ? normalizeClock(scene.processingStartedAt, openedAt) : null,
      releasedAt: scene.releasedAt ? normalizeClock(scene.releasedAt, openedAt) : null,
      officerIds: uniqueIds(scene.officerIds),
      evidenceIds: uniqueIds(scene.evidenceIds),
      notes: asArray(scene.notes).map(text).filter(Boolean).slice(0, 24),
    })),
    evidence,
    suspects,
    statements: asArray(raw.statements).map((entry, index) => ({
      id: idOf(entry) || `statement:${caseId}:${index + 1}`,
      personId: idOf(entry.personId) || null,
      role: entry.role ?? "witness",
      kind: entry.kind ?? "statement",
      at: normalizeClock(entry.at ?? openedAt, openedAt),
      summary: text(entry.summary),
      consistency: clamp(firstFinite(entry.consistency, 60) || 60),
      reliability: clamp(firstFinite(entry.reliability, 55) || 55),
      mentionsPersonIds: uniqueIds(entry.mentionsPersonIds),
      linkedEvidenceIds: uniqueIds(entry.linkedEvidenceIds),
      counselPresent: Boolean(entry.counselPresent),
      rightsNotified: Boolean(entry.rightsNotified),
    })).slice(0, INVESTIGATION_LIMITS.statementsPerCase),
    warrants: asArray(raw.warrants).map((entry, index) => ({
      id: idOf(entry) || `warrant:${caseId}:${index + 1}`,
      type: entry.type ?? "summons",
      targetPersonId: idOf(entry.targetPersonId ?? entry.personId) || null,
      targetLocationId: idOf(entry.targetLocationId ?? entry.locationId) || null,
      status: entry.status ?? "requested",
      legalBasisScore: clamp(firstFinite(entry.legalBasisScore, 50) || 50),
      requestedAt: normalizeClock(entry.requestedAt ?? openedAt, openedAt),
      authorizedAt: entry.authorizedAt ? normalizeClock(entry.authorizedAt, openedAt) : null,
      executedAt: entry.executedAt ? normalizeClock(entry.executedAt, openedAt) : null,
      denialReason: text(entry.denialReason) || null,
      relatedEvidenceIds: uniqueIds(entry.relatedEvidenceIds),
    })).slice(0, INVESTIGATION_LIMITS.warrantsPerCase),
    diligences: asArray(raw.diligences).map((entry, index) => ({
      id: idOf(entry) || `diligence:${caseId}:${index + 1}`,
      type: entry.type ?? "follow_up",
      label: text(entry.label) || "Diligência investigativa",
      status: entry.status ?? "pending",
      priority: clamp(firstFinite(entry.priority, 3) || 3, 1, 5),
      createdAt: normalizeClock(entry.createdAt ?? openedAt, openedAt),
      scheduledAt: entry.scheduledAt ? normalizeClock(entry.scheduledAt, openedAt) : null,
      completedAt: entry.completedAt ? normalizeClock(entry.completedAt, openedAt) : null,
      assignedOfficerIds: uniqueIds(entry.assignedOfficerIds),
      targetIds: uniqueIds(entry.targetIds),
      result: text(entry.result) || null,
    })).slice(0, INVESTIGATION_LIMITS.diligencesPerCase),
    hypotheses: asArray(raw.hypotheses).map((entry, index) => ({
      id: idOf(entry) || `hypothesis:${caseId}:${index + 1}`,
      label: text(entry.label) || "Hipótese investigativa",
      status: entry.status ?? "active",
      suspectId: idOf(entry.suspectId) || null,
      probability: clamp(firstFinite(entry.probability, 25) || 25),
      supportingEvidenceIds: uniqueIds(entry.supportingEvidenceIds),
      contradictingEvidenceIds: uniqueIds(entry.contradictingEvidenceIds),
      statementIds: uniqueIds(entry.statementIds),
      lastReviewedAt: normalizeClock(entry.lastReviewedAt ?? openedAt, openedAt),
    })).slice(0, INVESTIGATION_LIMITS.hypothesesPerCase),
    operations: asArray(raw.operations).map(deepClone),
    fines: asArray(raw.fines).map(deepClone),
    sourceWitnessCount: Math.max(0, Math.floor(firstFinite(raw.sourceWitnessCount, raw.witnesses) || 0)),
    pendingWitnesses: Math.max(0, Math.floor(firstFinite(raw.pendingWitnesses, raw.witnesses) || 0)),
    progress: {
      scene: clamp(raw.progress?.scene),
      evidence: clamp(raw.progress?.evidence),
      interviews: clamp(raw.progress?.interviews),
      suspect: clamp(raw.progress?.suspect),
      legal: clamp(raw.progress?.legal),
      overall: clamp(firstFinite(raw.progress?.overall, typeof raw.progress === "number" ? raw.progress : null) || 0),
      confidence: clamp(firstFinite(raw.progress?.confidence, raw.evidenceStrength) || 0),
      blockers: asArray(raw.progress?.blockers).map(text).filter(Boolean),
    },
    resolution: raw.resolution ? deepClone(raw.resolution) : null,
    timeline: timeline.slice(0, INVESTIGATION_LIMITS.timelinePerCase),
    tags: [...new Set([...(asArray(raw.tags).map(text).filter(Boolean)), profile.violent ? "violent" : null, raw.homicide || offenseId === "homicide" ? "homicide" : null].filter(Boolean))],
  };
};

/** Estado inicial para save games. */
export function createInvestigationState(options = {}) {
  const clock = makeClock({}, options);
  return {
    version: INVESTIGATION_DYNAMICS_VERSION,
    clock,
    cases: [],
    operations: [],
    fines: [],
    integrationRequests: [],
    recentActions: [],
    dailyHistory: [],
    lab: { capacity: Math.max(1, Math.floor(Number(options.labCapacity) || 3)), activeEvidenceIds: [], processed: 0, inconclusive: 0 },
    metrics: { opened: 0, active: 0, elucidated: 0, archived: 0, homicideActive: 0, homicideElucidated: 0, averageProgress: 0 },
    serials: {},
    revision: 0,
  };
}

/** Normaliza versões incompletas sem reter funções, Set ou referências mutáveis. */
export function normalizeInvestigationState(input, options = {}) {
  const base = input?.version === INVESTIGATION_DYNAMICS_VERSION ? deepClone(input) : createInvestigationState(options);
  const clock = normalizeClock(base.clock ?? options, makeClock({}, options));
  const state = {
    version: INVESTIGATION_DYNAMICS_VERSION,
    clock,
    cases: asArray(base.cases).map((entry) => normalizeCaseRecord(entry, clock)).slice(-INVESTIGATION_LIMITS.cases),
    operations: asArray(base.operations).map(deepClone).slice(0, INVESTIGATION_LIMITS.operations),
    fines: asArray(base.fines).map(deepClone).slice(0, INVESTIGATION_LIMITS.fines),
    integrationRequests: asArray(base.integrationRequests).map(deepClone).slice(0, INVESTIGATION_LIMITS.recentActions),
    recentActions: asArray(base.recentActions).map(deepClone).slice(0, INVESTIGATION_LIMITS.recentActions),
    dailyHistory: asArray(base.dailyHistory).map(deepClone).slice(-INVESTIGATION_LIMITS.historyDays),
    lab: {
      capacity: Math.max(1, Math.floor(Number(base.lab?.capacity ?? options.labCapacity) || 3)),
      activeEvidenceIds: uniqueIds(base.lab?.activeEvidenceIds),
      processed: Math.max(0, Math.floor(Number(base.lab?.processed) || 0)),
      inconclusive: Math.max(0, Math.floor(Number(base.lab?.inconclusive) || 0)),
    },
    metrics: deepClone(base.metrics ?? {}),
    serials: Object.fromEntries(Object.entries(base.serials ?? {}).map(([key, value]) => [key, Math.max(0, Math.floor(Number(value) || 0))])),
    revision: Math.max(0, Math.floor(Number(base.revision) || 0)),
  };
  reconcileSerials(state);
  refreshStateMetrics(state);
  return state;
}

const initialDiligences = (state, caseRecord) => {
  if (!caseRecord.diligences.some((entry) => entry.type === "scene_processing")) caseRecord.diligences.push({ id: nextId(state, "diligence"), type: "scene_processing", label: "Preservar e processar a cena", status: "pending", priority: 5, createdAt: deepClone(caseRecord.openedAt), scheduledAt: null, completedAt: null, assignedOfficerIds: [], targetIds: uniqueIds(caseRecord.locationId), result: null });
  if (!caseRecord.diligences.some((entry) => entry.type === "witness_canvas")) caseRecord.diligences.push({ id: nextId(state, "diligence"), type: "witness_canvas", label: "Localizar e ouvir testemunhas", status: "pending", priority: 4, createdAt: deepClone(caseRecord.openedAt), scheduledAt: null, completedAt: null, assignedOfficerIds: [], targetIds: [], result: null });
  if (!caseRecord.diligences.some((entry) => entry.type === "records_review")) caseRecord.diligences.push({ id: nextId(state, "diligence"), type: "records_review", label: "Cruzar registros disponíveis", status: "pending", priority: 3, createdAt: deepClone(caseRecord.openedAt), scheduledAt: null, completedAt: null, assignedOfficerIds: [], targetIds: [], result: null });
  if (caseRecord.homicide && !caseRecord.diligences.some((entry) => entry.type === "forensic_death_review")) caseRecord.diligences.push({ id: nextId(state, "diligence"), type: "forensic_death_review", label: "Integrar laudo médico-legal", status: caseRecord.forensicCaseId ? "scheduled" : "pending", priority: 5, createdAt: deepClone(caseRecord.openedAt), scheduledAt: caseRecord.forensicCaseId ? deepClone(state.clock) : null, completedAt: null, assignedOfficerIds: [], targetIds: uniqueIds(caseRecord.forensicCaseId), result: null });
};

const ensureInitialScene = (state, caseRecord) => {
  if (caseRecord.scenes.length) return;
  caseRecord.scenes.push({
    id: nextId(state, "scene"),
    type: caseRecord.homicide ? "death_scene" : "primary",
    locationId: caseRecord.locationId,
    status: "reported",
    integrity: 100,
    preservedAt: null,
    processingStartedAt: null,
    releasedAt: null,
    officerIds: [],
    evidenceIds: [],
    notes: [],
  });
};

const ingestLegacyTimeline = (state, target, source) => {
  for (const [index, entry] of asArray(source.timeline).entries()) {
    timelineEvent(state, target, {
      at: { week: entry.week ?? source.week, day: entry.day ?? source.day, time: entry.time ?? source.time },
      type: entry.type ?? "source_update",
      title: entry.title ?? "Atualização da ocorrência",
      detail: entry.detail ?? entry.text,
      placeId: entry.placeId ?? source.locationId,
      actorIds: entry.actorIds,
      signature: `source:${source.id}:${entry.id ?? index}:${entry.week}:${entry.day}:${entry.text}`,
    });
  }
};

const mergeSourceCase = (state, target, source, justice = {}) => {
  target.sourceStatus = text(source.status ?? target.sourceStatus);
  target.priority = priorityFor(source, profileFor(target.offenseId, source));
  target.locationId ||= idOf(source.locationId) || null;
  target.victimIds = uniqueIds([...target.victimIds, source.victimId, ...asArray(source.victimIds)]);
  target.deathRecordId ||= idOf(source.deathRecordId) || null;
  target.forensicCaseId ||= idOf(source.forensicCaseId) || null;
  target.leadInvestigatorId ||= idOf(source.assignedOfficerId) || null;
  target.assignedOfficerIds = uniqueIds([...target.assignedOfficerIds, source.assignedOfficerId]);
  const reportedWitnesses = Math.max(0, Math.floor(Number(source.witnesses) || 0));
  if (reportedWitnesses > target.sourceWitnessCount) target.pendingWitnesses += reportedWitnesses - target.sourceWitnessCount;
  target.sourceWitnessCount = Math.max(target.sourceWitnessCount, reportedWitnesses);
  if (source.suspectId && !target.suspects.some((entry) => entry.personId === idOf(source.suspectId))) target.suspects.push({ personId: idOf(source.suspectId), status: "identified", score: clamp(48 + (Number(source.evidenceStrength) || 0) * 0.5), basis: [], notes: ["Identificação incorporada do registro policial."], alibi: null, rightsNotified: false, lastInterviewAt: null, excludedAt: null });
  for (const [index, rawEvidence] of asArray(source.evidence).entries()) {
    const evidenceId = idOf(rawEvidence) || `source-evidence:${target.id}:${index + 1}`;
    const existing = target.evidence.find((entry) => entry.id === evidenceId);
    if (!existing) target.evidence.push(normalizeEvidence({ ...rawEvidence, id: evidenceId }, target.id, state.clock, target.evidence.length));
    else if (statusHas(rawEvidence.status, ["valid", "laudo conclu"]) && existing.status !== INVESTIGATION_EVIDENCE_STATUSES.VALIDATED) {
      existing.status = INVESTIGATION_EVIDENCE_STATUSES.VALIDATED;
      existing.forensic.status = "completed";
      existing.forensic.completedAt = deepClone(state.clock);
      existing.forensic.result ||= "Resultado incorporado do laboratório do sistema de justiça.";
      custodyEntry(state, existing, { action: "result_imported", from: "justice_evidence_lab", to: "case_file", condition: "recorded" });
    }
  }
  const warrants = firstArray(justice.warrants).filter((entry) => idOf(entry.caseId) === target.sourceCaseId);
  for (const warrant of warrants) {
    if (target.warrants.some((entry) => entry.id === idOf(warrant))) continue;
    const at = makeClock({}, { week: warrant.week ?? state.clock.week, day: warrant.day ?? state.clock.day, time: warrant.time ?? state.clock.label });
    target.warrants.push({ id: idOf(warrant) || nextId(state, "warrant"), type: warrant.type ?? "summons", targetPersonId: idOf(warrant.personId) || null, targetLocationId: idOf(warrant.locationId) || null, status: lower(warrant.status) === "cumprido" ? "executed" : warrant.status ?? "authorized", legalBasisScore: clamp(firstFinite(warrant.legalBasisScore, 70) || 70), requestedAt: at, authorizedAt: at, executedAt: lower(warrant.status) === "cumprido" ? at : null, denialReason: null, relatedEvidenceIds: [] });
  }
  ingestLegacyTimeline(state, target, source);
  const importedStatus = normalizedSourceStatus(source);
  if ([INVESTIGATION_CASE_STATUSES.REFERRED_TO_COURT, INVESTIGATION_CASE_STATUSES.ARCHIVED, INVESTIGATION_CASE_STATUSES.CLOSED].includes(importedStatus)) target.status = importedStatus;
  ensureInitialScene(state, target);
  initialDiligences(state, target);
  refreshCaseProgress(target);
  return target;
};

const upsertSourceCaseInPlace = (state, sourceCase = {}, justice = {}, caseIndex = null) => {
  const sourceId = idOf(sourceCase) || `external:${state.clock.absoluteHour}:${(state.serials.case || 0) + 1}`;
  const existing = caseIndex?.get(sourceId) ?? state.cases.find((entry) => entry.sourceCaseId === sourceId || entry.id === sourceId);
  if (existing) {
    mergeSourceCase(state, existing, { ...sourceCase, id: sourceId }, justice);
    return { caseRecord: existing, created: false };
  }
  const caseRecord = normalizeCaseRecord({ ...sourceCase, id: `investigation:${sourceId}`, sourceCaseId: sourceId }, state.clock);
  ensureInitialScene(state, caseRecord);
  initialDiligences(state, caseRecord);
  mergeSourceCase(state, caseRecord, { ...sourceCase, id: sourceId }, justice);
  const openedEvent = timelineEvent(state, caseRecord, { at: caseRecord.openedAt, type: "case_opened", title: "Inquérito aberto", detail: `Ocorrência de ${profileFor(caseRecord.offenseId, sourceCase).label} incorporada para acompanhamento.`, placeId: caseRecord.locationId, signature: `case-opened:${sourceId}` });
  recentAction(state, caseRecord, "case_opened", openedEvent);
  state.cases.unshift(caseRecord);
  state.cases = state.cases.slice(0, INVESTIGATION_LIMITS.cases);
  caseIndex?.set(sourceId, caseRecord);
  caseIndex?.set(caseRecord.id, caseRecord);
  return { caseRecord, created: true };
};

/** Abre um único inquérito, preservando o estado anterior. */
export function openInvestigationCase(previousState, sourceCase = {}, options = {}) {
  const previousActionIds = new Set(asArray(previousState?.recentActions).map(idOf));
  const state = normalizeInvestigationState(previousState, options);
  state.clock = makeClock(sourceCase, options, state.clock);
  const result = upsertSourceCaseInPlace(state, sourceCase, options.justiceSystem ?? {});
  state.revision++;
  refreshStateMetrics(state);
  const actionIds = state.recentActions.filter((entry) => !previousActionIds.has(entry.id)).map((entry) => entry.id);
  return { state, caseRecord: deepClone(result.caseRecord), created: result.created, journalEvents: buildInvestigationJournalEvents(state, { actionIds, context: options.context ?? options, normalizedState: true }) };
}

/**
 * Importa `openCases`, `closedCases`, mandados e investigações médico-legais.
 * Aceita tanto o justiceSystem diretamente quanto um snapshot da Simulation.
 */
export function ingestJusticeCases(previousState, input = {}, options = {}) {
  const previousActionIds = new Set(asArray(previousState?.recentActions).map(idOf));
  const state = normalizeInvestigationState(previousState, options);
  state.clock = makeClock(input, options, state.clock);
  const justice = input.justiceSystem ?? input.justice ?? input;
  const sources = [...firstArray(justice.openCases), ...firstArray(justice.closedCases)];
  const forensicInvestigations = firstArray(justice.investigations).map((entry) => {
    const relatedHomicide = sources.find((source) => (source.homicide || source.offenseId === "homicide") && idOf(source.victimId) === idOf(entry.victimId));
    const sourceId = entry.caseId ?? relatedHomicide?.id ?? entry.id;
    return {
      ...entry,
      id: sourceId,
      sourceCaseId: sourceId,
      offenseId: entry.offenseId ?? "homicide",
      homicide: true,
      victimId: entry.victimId,
      forensicCaseId: entry.forensicCaseId,
      week: entry.openedWeek ?? entry.week,
      status: entry.status ?? "investigação aberta",
      evidence: asArray(entry.evidence).map((finding, index) => ({ id: `forensic-finding:${entry.id}:${index + 1}`, type: "material biológico", label: text(finding), forensic: true, status: "validada", strength: 15 })),
    };
  });
  const allSources = [...sources, ...forensicInvestigations];
  const createdCaseIds = [];
  const updatedCaseIds = [];
  const caseIndex = new Map(state.cases.flatMap((entry) => [[entry.sourceCaseId, entry], [entry.id, entry]]));
  for (const source of allSources) {
    const sourceId = idOf(source.sourceCaseId ?? source.id);
    if (!sourceId) continue;
    const result = upsertSourceCaseInPlace(state, source, justice, caseIndex);
    (result.created ? createdCaseIds : updatedCaseIds).push(result.caseRecord.id);
  }
  state.revision++;
  refreshStateMetrics(state);
  const actionIds = state.recentActions.filter((entry) => !previousActionIds.has(entry.id)).map((entry) => entry.id);
  return { state, createdCaseIds: uniqueIds(createdCaseIds), updatedCaseIds: uniqueIds(updatedCaseIds), journalEvents: buildInvestigationJournalEvents(state, { actionIds, context: input, normalizedState: true }) };
}

const peopleFrom = (snapshot) => firstArray(snapshot.people, snapshot.residents, snapshot.population?.residents);
const policePersonnel = (snapshot) => peopleFrom(snapshot).filter((person) => person?.alive !== false && !person.lifeCourse?.retirement?.active && !/aposentad/i.test(person.role || "") && !person.justice?.incarcerated && statusHas(person.role ?? person.profession ?? person.job?.title, ["policial", "guarda municipal", "seguranca publica", "segurança pública", "analista de seguranca", "analista de segurança", "detetive", "investigador", "delegad", "perito", "medico-legista", "médico-legista", "tecnico de necropsia", "técnico de necropsia"]));
const forensicPersonnel = (snapshot) => policePersonnel(snapshot).filter((person) => statusHas(person.role ?? person.profession ?? person.job?.title, ["perito", "legista", "forense", "necropsia", "medicina legal"]));

const chooseByKey = (values, key, random) => {
  if (!values.length) return null;
  const index = Math.min(values.length - 1, Math.floor(randomUnit(random, key) * values.length));
  return values[index];
};

const assignInvestigator = (state, caseRecord, snapshot, random) => {
  const officers = policePersonnel(snapshot);
  const current = officers.find((officer) => idOf(officer) === caseRecord.leadInvestigatorId);
  if (current) return false;
  if (caseRecord.leadInvestigatorId) {
    caseRecord.assignedOfficerIds = caseRecord.assignedOfficerIds.filter((id) => id !== caseRecord.leadInvestigatorId);
    caseRecord.leadInvestigatorId = null;
  }
  const workload = new Map(officers.map((officer) => [idOf(officer), 0]));
  state.cases.filter((entry) => !terminal(entry) && entry.id !== caseRecord.id && entry.leadInvestigatorId).forEach((entry) => workload.set(entry.leadInvestigatorId, (workload.get(entry.leadInvestigatorId) || 0) + 1));
  const leastBusy = officers.slice().sort((left, right) => (workload.get(idOf(left)) || 0) - (workload.get(idOf(right)) || 0) || stableHash(`${caseRecord.id}:${idOf(left)}`) - stableHash(`${caseRecord.id}:${idOf(right)}`));
  const minimumLoad = leastBusy.length ? workload.get(idOf(leastBusy[0])) || 0 : 0;
  const pool = leastBusy.filter((officer) => (workload.get(idOf(officer)) || 0) === minimumLoad);
  const officer = chooseByKey(pool, `${caseRecord.id}:lead:${state.clock.absoluteHour}`, random);
  if (!officer) return false;
  caseRecord.leadInvestigatorId = idOf(officer);
  caseRecord.assignedOfficerIds = uniqueIds([...caseRecord.assignedOfficerIds, officer]);
  const event = timelineEvent(state, caseRecord, { type: "assignment", title: "Responsável designado", detail: "Um responsável assumiu a coordenação do inquérito.", actorIds: [officer], signature: `lead:${caseRecord.id}:${idOf(officer)}` });
  recentAction(state, caseRecord, "investigator_assigned", event);
  return true;
};

const processScene = (state, caseRecord) => {
  const scene = caseRecord.scenes.find((entry) => !entry.releasedAt) ?? caseRecord.scenes[0];
  if (!scene) return false;
  const diligence = caseRecord.diligences.find((entry) => entry.type === "scene_processing");
  if (!scene.preservedAt) {
    scene.preservedAt = deepClone(state.clock);
    scene.status = "preserved";
    scene.officerIds = uniqueIds([...scene.officerIds, ...caseRecord.assignedOfficerIds]);
    if (diligence) { diligence.status = "in_progress"; diligence.scheduledAt = deepClone(state.clock); diligence.assignedOfficerIds = uniqueIds(caseRecord.assignedOfficerIds); }
    caseRecord.status = INVESTIGATION_CASE_STATUSES.SCENE_PROCESSING;
    const event = timelineEvent(state, caseRecord, { type: "scene_preserved", title: "Cena preservada", detail: "O local foi isolado e registrado antes da coleta.", actorIds: scene.officerIds, placeId: scene.locationId, relatedIds: [scene.id] });
    recentAction(state, caseRecord, "scene_preserved", event);
    return true;
  }
  if (!scene.processingStartedAt) {
    scene.processingStartedAt = deepClone(state.clock);
    scene.status = "processing";
    const event = timelineEvent(state, caseRecord, { type: "scene_processing", title: "Processamento da cena iniciado", detail: "Equipe iniciou documentação, busca sistemática e seleção de vestígios.", actorIds: scene.officerIds, placeId: scene.locationId, relatedIds: [scene.id] });
    recentAction(state, caseRecord, "scene_processing_started", event);
    return true;
  }
  const sceneEvidence = caseRecord.evidence.filter((entry) => entry.sourceSceneId === scene.id);
  if (sceneEvidence.length >= (caseRecord.homicide ? 3 : 2) && !scene.releasedAt) {
    scene.releasedAt = deepClone(state.clock);
    scene.status = "released";
    if (diligence) { diligence.status = "completed"; diligence.completedAt = deepClone(state.clock); diligence.result = `${sceneEvidence.length} item(ns) documentado(s) e encaminhado(s).`; }
    caseRecord.status = INVESTIGATION_CASE_STATUSES.INVESTIGATING;
    const event = timelineEvent(state, caseRecord, { type: "scene_released", title: "Cena liberada", detail: "O processamento primário foi encerrado com preservação dos vestígios coletados.", actorIds: scene.officerIds, placeId: scene.locationId, relatedIds: [scene.id, ...sceneEvidence.map((entry) => entry.id)] });
    recentAction(state, caseRecord, "scene_released", event);
    return true;
  }
  return false;
};

const collectEvidence = (state, caseRecord, snapshot, random) => {
  if (caseRecord.evidence.length >= INVESTIGATION_LIMITS.evidencePerCase) return false;
  const scene = caseRecord.scenes.find((entry) => entry.processingStartedAt && !entry.releasedAt);
  if (!scene) return false;
  const pool = OFFENSE_EVIDENCE[caseRecord.offenseId] ?? ["camera_footage", "fingerprints", "seized_object", "scene_photographs", "phone_records"];
  const unused = pool.filter((type) => !caseRecord.evidence.some((entry) => entry.type === type));
  if (!unused.length) return false;
  const type = chooseByKey(unused, `${caseRecord.id}:evidence:${caseRecord.evidence.length}`, random);
  const definition = evidenceDefinition(type);
  const collectors = forensicPersonnel(snapshot).length ? forensicPersonnel(snapshot) : policePersonnel(snapshot);
  const collector = chooseByKey(collectors, `${caseRecord.id}:${type}:collector`, random);
  const evidence = normalizeEvidence({
    id: nextId(state, "evidence"),
    type,
    sourceSceneId: scene.id,
    status: definition.forensic ? "aguardando perícia" : "coletada",
    strength: definition.baseStrength + Math.floor(randomUnit(random, `${caseRecord.id}:${type}:strength`) * 5),
    collectedAt: state.clock,
    collectedById: idOf(collector),
    sealed: true,
  }, caseRecord.id, state.clock, caseRecord.evidence.length);
  evidence.status = definition.forensic ? INVESTIGATION_EVIDENCE_STATUSES.LAB_QUEUE : INVESTIGATION_EVIDENCE_STATUSES.VALIDATED;
  evidence.forensic.status = definition.forensic ? "queued" : "not_required";
  evidence.forensic.requestedAt = definition.forensic ? deepClone(state.clock) : null;
  evidence.forensic.completedAt = definition.forensic ? null : deepClone(state.clock);
  evidence.forensic.result = definition.forensic ? null : "Registro técnico incorporado sem necessidade de exame laboratorial.";
  evidence.forensic.confidence = definition.forensic ? 0 : 68;
  evidence.custody = [];
  custodyEntry(state, evidence, { action: "collected", from: `scene:${scene.id}`, to: idOf(collector) || "collecting_team", actorId: collector, condition: "documented" });
  custodyEntry(state, evidence, { action: "sealed", from: idOf(collector) || "collecting_team", to: definition.forensic ? "evidence_lab_queue" : "evidence_room", actorId: collector, seal: evidence.sealId, condition: "intact" });
  caseRecord.evidence.push(evidence);
  scene.evidenceIds = uniqueIds([...scene.evidenceIds, evidence.id]);
  const event = timelineEvent(state, caseRecord, { type: "evidence_collected", title: `${definition.label} coletado`, detail: definition.forensic ? "Vestígio lacrado e encaminhado à fila pericial." : "Item documentado e validado no registro técnico.", actorIds: [collector], placeId: scene.locationId, relatedIds: [evidence.id, scene.id] });
  recentAction(state, caseRecord, "evidence_collected", event);
  return true;
};

const startLabAnalysis = (state, caseRecord, evidence, snapshot, random) => {
  if (state.lab.activeEvidenceIds.length >= state.lab.capacity) return false;
  const analyst = chooseByKey(forensicPersonnel(snapshot), `${evidence.id}:analyst`, random);
  const duration = caseRecord.homicide ? 12 + Math.floor(randomUnit(random, `${evidence.id}:duration`) * 25) : 6 + Math.floor(randomUnit(random, `${evidence.id}:duration`) * 19);
  evidence.status = INVESTIGATION_EVIDENCE_STATUSES.IN_ANALYSIS;
  evidence.forensic.status = "in_analysis";
  evidence.forensic.analystId = idOf(analyst) || null;
  evidence.forensic.dueAt = clockAfter(state.clock, duration);
  state.lab.activeEvidenceIds = uniqueIds([...state.lab.activeEvidenceIds, evidence.id]);
  custodyEntry(state, evidence, { action: "received_by_lab", from: "evidence_lab_queue", to: evidence.forensic.discipline ?? "forensic_lab", actorId: analyst, condition: "seal_intact" });
  const event = timelineEvent(state, caseRecord, { type: "forensic_started", title: `Perícia iniciada: ${evidence.label}`, detail: `Previsão técnica registrada para ${evidence.forensic.dueAt.label}.`, actorIds: [analyst], relatedIds: [evidence.id] });
  recentAction(state, caseRecord, "forensic_analysis_started", event);
  return true;
};

const completeLabAnalysis = (state, caseRecord, evidence, snapshot, random, sourceTruth) => {
  if (evidence.status !== INVESTIGATION_EVIDENCE_STATUSES.IN_ANALYSIS || Number(evidence.forensic.dueAt?.absoluteHour) > state.clock.absoluteHour) return false;
  const integrity = evidence.custody.every((entry) => entry.condition !== "broken" && entry.condition !== "compromised");
  const conclusiveChance = integrity ? 0.82 : 0.34;
  const conclusive = randomUnit(random, `${evidence.id}:conclusion`) < conclusiveChance;
  evidence.status = conclusive ? INVESTIGATION_EVIDENCE_STATUSES.VALIDATED : INVESTIGATION_EVIDENCE_STATUSES.INCONCLUSIVE;
  evidence.forensic.status = conclusive ? "completed" : "inconclusive";
  evidence.forensic.completedAt = deepClone(state.clock);
  evidence.forensic.confidence = conclusive ? round(68 + randomUnit(random, `${evidence.id}:confidence`) * 28) : round(28 + randomUnit(random, `${evidence.id}:confidence`) * 24);
  evidence.reliability = evidence.forensic.confidence;
  evidence.forensic.result = conclusive ? "Vestígio tecnicamente caracterizado; resultado disponível para confronto investigativo." : "A análise não produziu resultado individualizante suficiente.";
  if (conclusive && sourceTruth && ["biological", "trace", "digital", "ballistic"].includes(evidence.category) && randomUnit(random, `${evidence.id}:link`) < 0.72) evidence.linkedPersonIds = uniqueIds([...evidence.linkedPersonIds, sourceTruth]);
  custodyEntry(state, evidence, { action: "analysis_completed", from: evidence.forensic.discipline ?? "forensic_lab", to: "evidence_room", actorId: evidence.forensic.analystId, condition: integrity ? "seal_replaced_and_recorded" : "chain_review_required" });
  state.lab.activeEvidenceIds = state.lab.activeEvidenceIds.filter((id) => id !== evidence.id);
  if (conclusive) state.lab.processed++; else state.lab.inconclusive++;
  const event = timelineEvent(state, caseRecord, { type: "forensic_completed", title: `Laudo concluído: ${evidence.label}`, detail: evidence.forensic.result, actorIds: [evidence.forensic.analystId], relatedIds: [evidence.id] });
  recentAction(state, caseRecord, conclusive ? "forensic_result_validated" : "forensic_result_inconclusive", event);
  return true;
};

const witnessCandidates = (snapshot, caseRecord, excludedIds = []) => {
  const excluded = new Set([...caseRecord.victimIds, ...caseRecord.suspects.map((entry) => entry.personId), ...caseRecord.assignedOfficerIds, ...excludedIds]);
  return peopleFrom(snapshot).filter((person) => person?.alive !== false && idOf(person) && !excluded.has(idOf(person)) && !caseRecord.statements.some((entry) => entry.personId === idOf(person))).sort((a, b) => idOf(a).localeCompare(idOf(b)));
};

const collectStatement = (state, caseRecord, snapshot, random, sourceTruth) => {
  if (caseRecord.pendingWitnesses <= 0 || caseRecord.statements.length >= INVESTIGATION_LIMITS.statementsPerCase) return false;
  const candidates = witnessCandidates(snapshot, caseRecord, sourceTruth ? [sourceTruth] : []);
  const witness = chooseByKey(candidates, `${caseRecord.id}:witness:${caseRecord.statements.length}`, random);
  const personId = idOf(witness) || `anonymous-witness:${caseRecord.id}:${caseRecord.statements.length + 1}`;
  const reliability = round(42 + randomUnit(random, `${caseRecord.id}:${personId}:reliability`) * 48);
  const mentionsTruth = sourceTruth && reliability >= 58 && randomUnit(random, `${caseRecord.id}:${personId}:mention`) < 0.58;
  const statement = {
    id: nextId(state, "statement"),
    personId,
    role: "witness",
    kind: "formal_statement",
    at: deepClone(state.clock),
    summary: mentionsTruth ? "Relato formal contém elemento que direciona a apuração a uma pessoa específica; exige confirmação independente." : "Relato formal descreve circunstâncias observadas sem identificação conclusiva de autoria.",
    consistency: round(48 + randomUnit(random, `${caseRecord.id}:${personId}:consistency`) * 45),
    reliability,
    mentionsPersonIds: mentionsTruth ? [sourceTruth] : [],
    linkedEvidenceIds: [],
    counselPresent: false,
    rightsNotified: false,
  };
  caseRecord.statements.push(statement);
  caseRecord.pendingWitnesses--;
  const diligence = caseRecord.diligences.find((entry) => entry.type === "witness_canvas");
  if (diligence) {
    diligence.status = caseRecord.pendingWitnesses > 0 ? "in_progress" : "completed";
    diligence.scheduledAt ||= deepClone(state.clock);
    if (!caseRecord.pendingWitnesses) { diligence.completedAt = deepClone(state.clock); diligence.result = `${caseRecord.statements.filter((entry) => entry.role === "witness").length} depoimento(s) registrado(s).`; }
  }
  const event = timelineEvent(state, caseRecord, { type: "statement", title: "Depoimento formal registrado", detail: statement.summary, actorIds: [personId, caseRecord.leadInvestigatorId], relatedIds: [statement.id], visibility: "restricted" });
  recentAction(state, caseRecord, "witness_statement_recorded", event);
  return true;
};

const updateSuspectsAndHypotheses = (state, caseRecord) => {
  const links = new Map();
  for (const evidence of caseRecord.evidence.filter((entry) => entry.status === INVESTIGATION_EVIDENCE_STATUSES.VALIDATED)) {
    for (const personId of evidence.linkedPersonIds) {
      const record = links.get(personId) ?? { evidenceIds: [], statementIds: [], strength: 0 };
      record.evidenceIds.push(evidence.id);
      record.strength += evidence.strength * (evidence.reliability / 100);
      links.set(personId, record);
    }
  }
  for (const statement of caseRecord.statements) {
    for (const personId of statement.mentionsPersonIds) {
      const record = links.get(personId) ?? { evidenceIds: [], statementIds: [], strength: 0 };
      record.statementIds.push(statement.id);
      record.strength += 8 * (statement.reliability / 100) * (statement.consistency / 100);
      links.set(personId, record);
    }
  }
  for (const [personId, basis] of links) {
    let suspect = caseRecord.suspects.find((entry) => entry.personId === personId);
    if (!suspect) {
      suspect = { personId, status: "person_of_interest", score: 0, basis: [], notes: [], alibi: null, rightsNotified: false, lastInterviewAt: null, excludedAt: null };
      caseRecord.suspects.push(suspect);
      timelineEvent(state, caseRecord, { type: "investigative_lead", title: "Nova pessoa de interesse", detail: "Convergência inicial de elementos justificou verificação individual, sem conclusão de culpa.", actorIds: [personId], relatedIds: [...basis.evidenceIds, ...basis.statementIds], visibility: "restricted", signature: `person-of-interest:${caseRecord.id}:${personId}` });
    }
    suspect.basis = uniqueIds([...suspect.basis, ...basis.evidenceIds, ...basis.statementIds]);
    suspect.score = round(clamp(20 + basis.strength * 1.65 + basis.evidenceIds.length * 8 + basis.statementIds.length * 4));
    if (suspect.score >= 50) suspect.status = "identified";
    let hypothesis = caseRecord.hypotheses.find((entry) => entry.suspectId === personId);
    if (!hypothesis) {
      hypothesis = { id: nextId(state, "hypothesis"), label: "Hipótese de participação sob verificação", status: "active", suspectId: personId, probability: 20, supportingEvidenceIds: [], contradictingEvidenceIds: [], statementIds: [], lastReviewedAt: deepClone(state.clock) };
      caseRecord.hypotheses.push(hypothesis);
    }
    hypothesis.supportingEvidenceIds = uniqueIds([...hypothesis.supportingEvidenceIds, ...basis.evidenceIds]);
    hypothesis.statementIds = uniqueIds([...hypothesis.statementIds, ...basis.statementIds]);
    hypothesis.probability = round(clamp(suspect.score * 0.82 + Math.min(15, basis.evidenceIds.length * 4) - hypothesis.contradictingEvidenceIds.length * 8));
    hypothesis.lastReviewedAt = deepClone(state.clock);
  }
  if (
    caseRecord.suspects.some((entry) => entry.status === "identified") &&
    [INVESTIGATION_CASE_STATUSES.REPORTED, INVESTIGATION_CASE_STATUSES.SCENE_PROCESSING, INVESTIGATION_CASE_STATUSES.INVESTIGATING, INVESTIGATION_CASE_STATUSES.SUSPECT_IDENTIFIED].includes(caseRecord.status)
  ) caseRecord.status = INVESTIGATION_CASE_STATUSES.SUSPECT_IDENTIFIED;
};

const interviewSuspect = (state, caseRecord, random) => {
  const suspect = caseRecord.suspects.filter((entry) => !entry.excludedAt && entry.status === "identified").sort((a, b) => b.score - a.score)[0];
  if (!suspect || suspect.lastInterviewAt || caseRecord.statements.length >= INVESTIGATION_LIMITS.statementsPerCase) return false;
  const statement = {
    id: nextId(state, "statement"),
    personId: suspect.personId,
    role: "suspect",
    kind: "formal_interview",
    at: deepClone(state.clock),
    summary: "Entrevista formal realizada com ciência de direitos; declarações serão confrontadas com elementos independentes.",
    consistency: round(38 + randomUnit(random, `${caseRecord.id}:${suspect.personId}:interview`) * 56),
    reliability: 50,
    mentionsPersonIds: [],
    linkedEvidenceIds: suspect.basis.filter((id) => caseRecord.evidence.some((entry) => entry.id === id)),
    counselPresent: caseRecord.severity === "critical" || randomUnit(random, `${caseRecord.id}:${suspect.personId}:counsel`) < 0.45,
    rightsNotified: true,
  };
  suspect.lastInterviewAt = deepClone(state.clock);
  suspect.rightsNotified = true;
  caseRecord.statements.push(statement);
  const event = timelineEvent(state, caseRecord, { type: "suspect_interview", title: "Interrogatório/entrevista formal", detail: statement.summary, actorIds: [suspect.personId, caseRecord.leadInvestigatorId], relatedIds: [statement.id], visibility: "restricted" });
  recentAction(state, caseRecord, "suspect_interview_completed", event);
  return true;
};

const legalBasis = (caseRecord, suspect) => {
  const evidence = caseRecord.evidence.filter((entry) => suspect.basis.includes(entry.id) && entry.status === INVESTIGATION_EVIDENCE_STATUSES.VALIDATED);
  const statements = caseRecord.statements.filter((entry) => suspect.basis.includes(entry.id));
  const independentCategories = new Set(evidence.map((entry) => entry.category)).size;
  const strength = evidence.reduce((total, entry) => total + entry.strength * entry.reliability / 100, 0);
  return clamp(strength * 1.25 + independentCategories * 10 + statements.length * 4);
};

const requestWarrant = (state, caseRecord) => {
  const suspect = caseRecord.suspects.filter((entry) => entry.status === "identified" && !entry.excludedAt).sort((a, b) => b.score - a.score)[0];
  if (!suspect || caseRecord.warrants.some((entry) => entry.targetPersonId === suspect.personId && !["denied", "expired"].includes(entry.status))) return false;
  const basis = legalBasis(caseRecord, suspect);
  if (basis < 48) return false;
  const type = caseRecord.severity === "minor" ? "summons" : basis >= 75 && ["serious", "critical"].includes(caseRecord.severity) ? "preventive_arrest" : "search_and_seizure";
  const relatedEvidenceIds = suspect.basis.filter((id) => caseRecord.evidence.some((entry) => entry.id === id));
  const warrant = { id: nextId(state, "warrant"), type, targetPersonId: suspect.personId, targetLocationId: null, status: "requested", legalBasisScore: round(basis), requestedAt: deepClone(state.clock), authorizedAt: null, executedAt: null, denialReason: null, relatedEvidenceIds };
  caseRecord.warrants.push(warrant);
  caseRecord.status = INVESTIGATION_CASE_STATUSES.LEGAL_REVIEW;
  const event = timelineEvent(state, caseRecord, { type: "warrant_requested", title: "Medida judicial requerida", detail: `Pedido de ${type} submetido com fundamentação calculada em ${round(basis)}/100.`, actorIds: [caseRecord.leadInvestigatorId, suspect.personId], relatedIds: [warrant.id, ...relatedEvidenceIds], visibility: "restricted" });
  recentAction(state, caseRecord, "warrant_requested", event);
  return true;
};

const reviewWarrant = (state, caseRecord) => {
  const warrant = caseRecord.warrants.find((entry) => entry.status === "requested" && state.clock.absoluteHour - entry.requestedAt.absoluteHour >= 2);
  if (!warrant) return false;
  const threshold = warrant.type === "preventive_arrest" ? 68 : warrant.type === "search_and_seizure" ? 55 : 42;
  if (warrant.legalBasisScore >= threshold) {
    warrant.status = "authorized";
    warrant.authorizedAt = deepClone(state.clock);
    const event = timelineEvent(state, caseRecord, { type: "warrant_authorized", title: "Medida judicial autorizada", detail: "Autorização registrada; o cumprimento ainda depende de diligência própria.", actorIds: [warrant.targetPersonId], relatedIds: [warrant.id], visibility: "restricted" });
    recentAction(state, caseRecord, "warrant_authorized", event);
  } else {
    warrant.status = "denied";
    warrant.denialReason = "Fundamentação ainda insuficiente para a medida solicitada.";
    const event = timelineEvent(state, caseRecord, { type: "warrant_denied", title: "Medida judicial não autorizada", detail: warrant.denialReason, relatedIds: [warrant.id], visibility: "restricted" });
    recentAction(state, caseRecord, "warrant_denied", event);
  }
  return true;
};

const planOperation = (state, caseRecord) => {
  const warrant = caseRecord.warrants.find((entry) => entry.status === "authorized" && !caseRecord.operations.some((operation) => operation.warrantIds?.includes(entry.id)));
  if (!warrant) return false;
  const operation = {
    id: nextId(state, "operation"),
    caseId: caseRecord.id,
    name: warrant.type === "summons" ? "Diligência de intimação" : warrant.type === "preventive_arrest" ? "Operação de cumprimento de mandado" : "Diligência de busca e apreensão",
    type: warrant.type,
    status: "planned",
    plannedAt: deepClone(state.clock),
    scheduledAt: clockAfter(state.clock, warrant.type === "summons" ? 3 : 6),
    startedAt: null,
    completedAt: null,
    officerIds: uniqueIds(caseRecord.assignedOfficerIds),
    targetPersonIds: uniqueIds(warrant.targetPersonId),
    targetLocationIds: uniqueIds(warrant.targetLocationId),
    warrantIds: [warrant.id],
    outcome: null,
    integrationRequestIds: [],
  };
  caseRecord.operations.push(operation);
  state.operations.unshift(deepClone(operation));
  state.operations = state.operations.slice(0, INVESTIGATION_LIMITS.operations);
  caseRecord.status = INVESTIGATION_CASE_STATUSES.OPERATION_PLANNED;
  const event = timelineEvent(state, caseRecord, { type: "operation_planned", title: operation.name, detail: `Ação programada para ${operation.scheduledAt.label}; nenhum resultado foi presumido.`, actorIds: operation.officerIds, relatedIds: [operation.id, warrant.id], visibility: "restricted" });
  recentAction(state, caseRecord, "police_operation_planned", event);
  return true;
};

const executeOperation = (state, caseRecord, random) => {
  const operation = caseRecord.operations.find((entry) => entry.status === "planned" && Number(entry.scheduledAt?.absoluteHour) <= state.clock.absoluteHour);
  if (!operation) return false;
  operation.status = "completed";
  operation.startedAt = deepClone(state.clock);
  operation.completedAt = deepClone(state.clock);
  const warrant = caseRecord.warrants.find((entry) => operation.warrantIds.includes(entry.id));
  if (warrant) { warrant.status = "executed"; warrant.executedAt = deepClone(state.clock); }
  const located = randomUnit(random, `${operation.id}:located`) < 0.82;
  operation.outcome = located ? "Alvo localizado; cumprimento administrativo registrado, sujeito à aplicação pelo motor principal." : "Diligência concluída sem localização do alvo; nova avaliação necessária.";
  if (located) {
    const request = {
      id: nextId(state, "integration"),
      caseId: caseRecord.id,
      operationId: operation.id,
      at: deepClone(state.clock),
      type: operation.type === "preventive_arrest" ? "apply_pretrial_detention" : operation.type === "summons" ? "record_summons_service" : "record_search_execution",
      targetPersonIds: uniqueIds(operation.targetPersonIds),
      targetLocationIds: uniqueIds(operation.targetLocationIds),
      status: "pending_external_application",
    };
    state.integrationRequests.unshift(request);
    operation.integrationRequestIds.push(request.id);
  }
  const global = state.operations.find((entry) => entry.id === operation.id);
  if (global) Object.assign(global, deepClone(operation));
  const event = timelineEvent(state, caseRecord, { type: "operation_completed", title: "Operação policial concluída", detail: operation.outcome, actorIds: [...operation.officerIds, ...operation.targetPersonIds], relatedIds: [operation.id, ...operation.warrantIds], visibility: "public_record" });
  recentAction(state, caseRecord, "police_operation_completed", event);
  return true;
};

const recommendFine = (state, caseRecord) => {
  if (caseRecord.severity !== "minor" || caseRecord.fines.length || !caseRecord.suspects.some((entry) => entry.status === "identified")) return false;
  const suspect = caseRecord.suspects.filter((entry) => entry.status === "identified").sort((a, b) => b.score - a.score)[0];
  if (legalBasis(caseRecord, suspect) < 45) return false;
  const profile = profileFor(caseRecord.offenseId, caseRecord);
  const fine = { id: nextId(state, "fine"), caseId: caseRecord.id, personId: suspect.personId, offenseId: caseRecord.offenseId, amount: profile.fine, status: "recommended", recommendedAt: deepClone(state.clock), appliedAt: null, paidAt: null };
  caseRecord.fines.push(fine);
  state.fines.unshift(deepClone(fine));
  state.fines = state.fines.slice(0, INVESTIGATION_LIMITS.fines);
  const request = { id: nextId(state, "integration"), caseId: caseRecord.id, fineId: fine.id, at: deepClone(state.clock), type: "review_and_apply_fine", targetPersonIds: [suspect.personId], amount: fine.amount, status: "pending_external_application" };
  state.integrationRequests.unshift(request);
  const event = timelineEvent(state, caseRecord, { type: "fine_recommended", title: "Autuação recomendada", detail: `Multa de R$ ${fine.amount.toLocaleString("pt-BR")} submetida para aplicação externa; nenhum pagamento foi presumido.`, actorIds: [suspect.personId], relatedIds: [fine.id] });
  recentAction(state, caseRecord, "fine_recommended", event);
  return true;
};

const refreshCaseProgress = (caseRecord) => {
  const scenes = caseRecord.scenes;
  const scene = !scenes.length ? 0 : scenes.reduce((total, entry) => total + (entry.releasedAt ? 100 : entry.processingStartedAt ? 62 : entry.preservedAt ? 34 : 5), 0) / scenes.length;
  const validated = caseRecord.evidence.filter((entry) => entry.status === INVESTIGATION_EVIDENCE_STATUSES.VALIDATED);
  const pendingLab = caseRecord.evidence.filter((entry) => [INVESTIGATION_EVIDENCE_STATUSES.LAB_QUEUE, INVESTIGATION_EVIDENCE_STATUSES.IN_ANALYSIS].includes(entry.status));
  const evidence = clamp(validated.reduce((total, entry) => total + 10 + entry.strength * entry.reliability / 500, 0));
  const interviews = clamp(caseRecord.statements.length * 18 + (caseRecord.pendingWitnesses === 0 && caseRecord.statements.length ? 16 : 0));
  const bestSuspect = caseRecord.suspects.filter((entry) => !entry.excludedAt).sort((a, b) => b.score - a.score)[0];
  const suspect = bestSuspect ? bestSuspect.score : 0;
  const warrant = caseRecord.warrants.some((entry) => entry.status === "executed") ? 100 : caseRecord.warrants.some((entry) => entry.status === "authorized") ? 72 : caseRecord.warrants.some((entry) => entry.status === "requested") ? 42 : 0;
  const bestHypothesis = caseRecord.hypotheses.filter((entry) => ["active", "leading_conclusion"].includes(entry.status)).sort((a, b) => b.probability - a.probability)[0];
  const confidence = caseRecord.resolution?.confidence ?? bestHypothesis?.probability ?? Math.min(45, validated.length * 8);
  const overall = clamp(scene * 0.17 + evidence * 0.27 + interviews * 0.16 + suspect * 0.25 + warrant * 0.15);
  const blockers = [];
  if (!caseRecord.leadInvestigatorId) blockers.push("Sem investigador responsável disponível");
  if (scenes.some((entry) => !entry.releasedAt)) blockers.push("Processamento de cena pendente");
  if (pendingLab.length) blockers.push(`${pendingLab.length} perícia(s) pendente(s)`);
  if (!bestSuspect) blockers.push("Autoria ainda não individualizada");
  else if (legalBasis(caseRecord, bestSuspect) < 48) blockers.push("Fundamentação jurídica insuficiente");
  caseRecord.progress = { scene: round(scene), evidence: round(evidence), interviews: round(interviews), suspect: round(suspect), legal: round(warrant), overall: round(overall), confidence: round(confidence), blockers };
  return caseRecord.progress;
};

const evaluateResolution = (state, caseRecord) => {
  if (terminal(caseRecord)) return false;
  const hypothesis = caseRecord.hypotheses.filter((entry) => entry.status === "active" && entry.suspectId).sort((a, b) => b.probability - a.probability)[0];
  if (!hypothesis) return false;
  const evidence = caseRecord.evidence.filter((entry) => hypothesis.supportingEvidenceIds.includes(entry.id) && entry.status === INVESTIGATION_EVIDENCE_STATUSES.VALIDATED);
  const categories = new Set(evidence.map((entry) => entry.category)).size;
  const strength = evidence.reduce((total, entry) => total + entry.strength * entry.reliability / 100, 0);
  const statementSupport = hypothesis.statementIds.length;
  const legalAct = caseRecord.homicide || caseRecord.severity === "critical"
    ? caseRecord.warrants.some((entry) => entry.status === "executed")
    : caseRecord.warrants.some((entry) => ["authorized", "executed"].includes(entry.status));
  const requiredProbability = caseRecord.homicide ? 76 : 68;
  const enough = hypothesis.probability >= requiredProbability && categories >= (caseRecord.homicide ? 2 : 1) && strength >= (caseRecord.homicide ? 34 : 22) && (statementSupport > 0 || evidence.length >= (caseRecord.homicide ? 3 : 2)) && legalAct;
  if (!enough) return false;
  caseRecord.status = INVESTIGATION_CASE_STATUSES.ELUCIDATED;
  caseRecord.resolution = {
    status: "investigative_solution",
    concludedAt: deepClone(state.clock),
    primarySuspectId: hypothesis.suspectId,
    hypothesisId: hypothesis.id,
    confidence: round(hypothesis.probability),
    evidenceIds: evidence.map((entry) => entry.id),
    statementIds: [...hypothesis.statementIds],
    note: "Conclusão exclusivamente investigativa; responsabilidade penal depende do processo judicial.",
  };
  hypothesis.status = "leading_conclusion";
  const request = { id: nextId(state, "integration"), caseId: caseRecord.id, at: deepClone(state.clock), type: "refer_investigation_to_court", targetPersonIds: [hypothesis.suspectId], evidenceIds: evidence.map((entry) => entry.id), status: "pending_external_application" };
  state.integrationRequests.unshift(request);
  const event = timelineEvent(state, caseRecord, { type: "case_elucidated", title: caseRecord.homicide ? "Homicídio elucidado pela investigação" : "Investigação elucidada", detail: caseRecord.resolution.note, actorIds: [hypothesis.suspectId, caseRecord.leadInvestigatorId], relatedIds: [hypothesis.id, ...caseRecord.resolution.evidenceIds] });
  recentAction(state, caseRecord, "investigative_solution_recorded", event);
  return true;
};

const sourceTruthFor = (snapshot, caseRecord) => {
  const justice = snapshot.justiceSystem ?? snapshot.justice ?? {};
  const source = [...firstArray(justice.openCases), ...firstArray(justice.closedCases)].find((entry) => idOf(entry) === caseRecord.sourceCaseId);
  return idOf(source?.perpetratorId) || null;
};

const runCaseWorkUnit = (state, caseRecord, snapshot, options, unit) => {
  if (terminal(caseRecord)) return false;
  const random = options.random;
  const truth = sourceTruthFor(snapshot, caseRecord);
  if (assignInvestigator(state, caseRecord, snapshot, random)) return true;
  const dueEvidence = caseRecord.evidence.find((entry) => entry.status === INVESTIGATION_EVIDENCE_STATUSES.IN_ANALYSIS && Number(entry.forensic.dueAt?.absoluteHour) <= state.clock.absoluteHour);
  if (dueEvidence && completeLabAnalysis(state, caseRecord, dueEvidence, snapshot, random, truth)) { updateSuspectsAndHypotheses(state, caseRecord); return true; }
  if (reviewWarrant(state, caseRecord)) return true;
  if (executeOperation(state, caseRecord, random)) return true;
  const queued = caseRecord.evidence.find((entry) => entry.status === INVESTIGATION_EVIDENCE_STATUSES.LAB_QUEUE);
  if (queued && startLabAnalysis(state, caseRecord, queued, snapshot, random)) return true;
  if (processScene(state, caseRecord)) return true;
  if (collectEvidence(state, caseRecord, snapshot, random)) return true;
  if (collectStatement(state, caseRecord, snapshot, random, truth)) { updateSuspectsAndHypotheses(state, caseRecord); return true; }
  updateSuspectsAndHypotheses(state, caseRecord);
  if (interviewSuspect(state, caseRecord, random)) return true;
  if (recommendFine(state, caseRecord)) return true;
  if (requestWarrant(state, caseRecord)) return true;
  if (planOperation(state, caseRecord)) return true;
  const review = caseRecord.diligences.find((entry) => entry.type === "records_review" && entry.status !== "completed");
  if (review) {
    review.status = "completed";
    review.scheduledAt ||= deepClone(state.clock);
    review.completedAt = deepClone(state.clock);
    review.assignedOfficerIds = uniqueIds(caseRecord.assignedOfficerIds);
    review.result = "Bases disponíveis foram cruzadas; vínculos dependem de confirmação por elementos independentes.";
    const event = timelineEvent(state, caseRecord, { type: "diligence", title: review.label, detail: review.result, actorIds: review.assignedOfficerIds, relatedIds: [review.id] });
    recentAction(state, caseRecord, "records_review_completed", event);
    return true;
  }
  return false;
};

const refreshStateMetrics = (state) => {
  const active = state.cases.filter((entry) => !terminal(entry));
  const concluded = state.cases.filter((entry) => entry.status === INVESTIGATION_CASE_STATUSES.ELUCIDATED);
  state.metrics = {
    opened: state.cases.length,
    active: active.length,
    elucidated: concluded.length,
    archived: state.cases.filter((entry) => entry.status === INVESTIGATION_CASE_STATUSES.ARCHIVED).length,
    homicideActive: active.filter((entry) => entry.homicide).length,
    homicideElucidated: concluded.filter((entry) => entry.homicide).length,
    averageProgress: round(active.length ? active.reduce((total, entry) => total + (Number(entry.progress?.overall) || 0), 0) / active.length : 0),
    labQueued: state.cases.reduce((total, entry) => total + entry.evidence.filter((evidence) => evidence.status === INVESTIGATION_EVIDENCE_STATUSES.LAB_QUEUE).length, 0),
    labActive: state.lab.activeEvidenceIds.length,
    pendingWarrants: state.cases.reduce((total, entry) => total + entry.warrants.filter((warrant) => ["requested", "authorized"].includes(warrant.status)).length, 0),
    pendingIntegrationRequests: state.integrationRequests.filter((entry) => entry.status === "pending_external_application").length,
  };
  return state.metrics;
};

const workCapacity = (snapshot, mode, options) => {
  const personnel = policePersonnel(snapshot).length;
  const patrols = firstFinite(snapshot.justiceSystem?.patrols, snapshot.justice?.patrols, options.patrols, 2) || 2;
  const base = Math.max(2, personnel || patrols * 2);
  return mode === "daily" ? Math.max(4, Math.floor(base * 1.5)) : Math.max(1, Math.floor(base * 0.45));
};

const runInvestigationCycle = (previousState, snapshot, options, mode) => {
  const previousActionIds = new Set(asArray(previousState?.recentActions).map(idOf));
  const ingested = ingestJusticeCases(previousState, snapshot, options);
  const state = ingested.state;
  const increment = mode === "daily" ? 24 : 1;
  state.clock = makeClock(snapshot, options, state.clock, increment);
  const labCapacity = firstFinite(options.labCapacity, snapshot.justiceSystem?.evidenceLab?.capacity, snapshot.justice?.evidenceLab?.capacity);
  if (labCapacity != null) state.lab.capacity = Math.max(1, Math.floor(labCapacity));
  const active = state.cases.filter((entry) => !terminal(entry));
  const eligibleOfficerIds = new Set(policePersonnel(snapshot).map(idOf));
  active
    .filter((entry) => !entry.leadInvestigatorId || !eligibleOfficerIds.has(entry.leadInvestigatorId))
    .sort((a, b) => b.priority - a.priority || a.openedAt.absoluteHour - b.openedAt.absoluteHour)
    .forEach((entry) => assignInvestigator(state, entry, snapshot, options.random));
  active.sort((a, b) => {
    const score = (entry) => entry.priority * 24 + Math.max(0, state.clock.absoluteHour - Number(entry.lastUpdatedAt?.absoluteHour || entry.openedAt.absoluteHour)) / 8;
    return score(b) - score(a) || Number(a.lastUpdatedAt?.absoluteHour || 0) - Number(b.lastUpdatedAt?.absoluteHour || 0) || a.id.localeCompare(b.id);
  });
  let capacity = workCapacity(snapshot, mode, options);
  const maxUnitsPerCase = mode === "daily" ? 4 : 1;
  const workedCaseIds = [];
  for (let roundIndex = 0; roundIndex < maxUnitsPerCase && capacity > 0; roundIndex++) {
    for (const caseRecord of active) {
      if (capacity <= 0) break;
      if (runCaseWorkUnit(state, caseRecord, snapshot, options, roundIndex)) {
        capacity--;
        workedCaseIds.push(caseRecord.id);
      }
      updateSuspectsAndHypotheses(state, caseRecord);
      refreshCaseProgress(caseRecord);
      evaluateResolution(state, caseRecord);
    }
  }
  active.forEach((caseRecord) => { refreshCaseProgress(caseRecord); evaluateResolution(state, caseRecord); });
  if (mode === "daily") {
    state.dailyHistory.push({
      week: state.clock.week,
      day: state.clock.day,
      absoluteHour: state.clock.absoluteHour,
      activeCases: active.length,
      workedCases: new Set(workedCaseIds).size,
      actions: workedCaseIds.length,
      labQueued: state.cases.reduce((total, entry) => total + entry.evidence.filter((evidence) => evidence.status === INVESTIGATION_EVIDENCE_STATUSES.LAB_QUEUE).length, 0),
      labActive: state.lab.activeEvidenceIds.length,
    });
    state.dailyHistory = state.dailyHistory.slice(-INVESTIGATION_LIMITS.historyDays);
  }
  state.integrationRequests = state.integrationRequests.slice(0, INVESTIGATION_LIMITS.recentActions);
  state.revision++;
  refreshStateMetrics(state);
  const actionIds = state.recentActions.filter((entry) => !previousActionIds.has(entry.id)).map((entry) => entry.id);
  return { state, clock: deepClone(state.clock), createdCaseIds: ingested.createdCaseIds, updatedCaseIds: ingested.updatedCaseIds, workedCaseIds: uniqueIds(workedCaseIds), actionsPerformed: workedCaseIds.length, integrationRequests: deepClone(state.integrationRequests.filter((entry) => entry.status === "pending_external_application")), journalEvents: buildInvestigationJournalEvents(state, { actionIds, context: snapshot, normalizedState: true }) };
};

/** Avança uma hora operacional; seguro para o loop visual em tempo acelerado. */
export function runInvestigationHour(previousState, snapshot = {}, options = {}) {
  return runInvestigationCycle(previousState, snapshot, options, "hourly");
}

/** Consolida um dia, com cotas de trabalho e revisão administrativa. */
export function runInvestigationDay(previousState, snapshot = {}, options = {}) {
  return runInvestigationCycle(previousState, snapshot, options, "daily");
}

const lookupIndexes = (context = {}) => {
  const people = firstArray(context.people, context.residents, context.population?.residents);
  const places = firstArray(context.buildings, context.places, context.properties);
  return {
    people: new Map(people.map((entry) => [idOf(entry), entry]).filter(([id]) => id)),
    places: new Map(places.map((entry) => [idOf(entry), entry]).filter(([id]) => id)),
  };
};

const personReference = (id, indexes) => {
  const person = indexes.people.get(id);
  return id ? { id, name: text(person?.name) || id, alive: person?.alive !== false, role: text(person?.role ?? person?.profession) || null } : null;
};
const placeReference = (id, indexes) => {
  const place = indexes.places.get(id);
  return id ? { id, name: text(place?.name) || id, type: text(place?.type ?? place?.category) || null, districtId: idOf(place?.districtId) || null } : null;
};

const JOURNAL_ACTION_CONFIG = Object.freeze({
  case_opened: { type: "investigation_opened", kind: "investigação", title: "Polícia abre novo inquérito", public: true, score: 66 },
  investigator_assigned: { type: "investigator_assigned", kind: "investigação", title: "Inquérito recebe equipe responsável", public: true, score: 34 },
  scene_preserved: { type: "crime_scene_preserved", kind: "perícia", title: "Local de ocorrência é preservado", public: true, score: 52 },
  scene_processing_started: { type: "crime_scene_processing", kind: "perícia", title: "Perícia inicia processamento de local", public: true, score: 42 },
  scene_released: { type: "crime_scene_released", kind: "perícia", title: "Processamento inicial do local é encerrado", public: true, score: 48 },
  evidence_collected: { type: "evidence_collected", kind: "perícia", title: "Investigação registra novo vestígio", public: true, score: 43 },
  forensic_analysis_started: { type: "forensic_analysis_started", kind: "perícia", title: "Vestígio entra em análise pericial", public: true, score: 40 },
  forensic_result_validated: { type: "forensic_report_completed", kind: "perícia", title: "Laudo pericial é incorporado ao inquérito", public: true, score: 62 },
  forensic_result_inconclusive: { type: "forensic_report_inconclusive", kind: "perícia", title: "Perícia termina sem resultado individualizante", public: true, score: 48 },
  witness_statement_recorded: { type: "witness_statement", kind: "depoimento", title: "Polícia registra novo depoimento", public: false, score: 32 },
  suspect_interview_completed: { type: "suspect_interview", kind: "interrogatório", title: "Entrevista formal integra o inquérito", public: false, score: 45 },
  warrant_requested: { type: "warrant_requested", kind: "medida judicial", title: "Polícia solicita medida judicial", public: false, score: 48 },
  warrant_authorized: { type: "warrant_authorized", kind: "medida judicial", title: "Medida judicial é autorizada", public: false, score: 58 },
  warrant_denied: { type: "warrant_denied", kind: "medida judicial", title: "Pedido de medida judicial é negado", public: false, score: 42 },
  police_operation_planned: { type: "police_operation_planned", kind: "operação policial", title: "Polícia prepara diligência operacional", public: false, score: 58 },
  police_operation_completed: { type: "police_operation_completed", kind: "operação policial", title: "Operação policial é concluída", public: true, score: 86 },
  fine_recommended: { type: "fine_recommended", kind: "autuação", title: "Investigação recomenda autuação", public: false, score: 38 },
  records_review_completed: { type: "records_crosscheck", kind: "diligência", title: "Polícia conclui cruzamento de registros", public: false, score: 30 },
  investigative_solution_recorded: { type: "investigation_elucidated", kind: "investigação", title: "Polícia registra conclusão investigativa", public: true, score: 94, exposeSuspect: true },
});

const editorialCauseAndConsequence = (action, caseRecord, profile, timeline) => {
  const facts = [];
  let cause = `O inquérito sobre ${profile.label.toLowerCase()} recebeu uma etapa operacional documentada.`;
  let consequence = "A ficha investigativa e sua linha do tempo foram atualizadas; nenhum efeito externo foi presumido.";
  if (action.action === "case_opened") {
    cause = `Uma ocorrência registrada de ${profile.label.toLowerCase()} foi encaminhada para apuração.`;
    consequence = "Um inquérito acompanhável foi aberto com local, envolvidos conhecidos e atos iniciais registrados.";
  } else if (action.action === "investigator_assigned") {
    cause = "O inquérito estava sem coordenação investigativa registrada.";
    consequence = "Um responsável foi vinculado ao caso; isso não altera a situação jurídica de qualquer envolvido.";
  } else if (action.action === "scene_preserved") {
    cause = "A ocorrência exigia proteção do local antes da coleta técnica.";
    consequence = "O local passou ao estado preservado, com equipe e horário documentados.";
  } else if (action.action === "scene_processing_started") {
    cause = "A preservação do local permitiu iniciar documentação e busca sistemática.";
    consequence = "O processamento técnico foi iniciado; nenhum vestígio futuro foi presumido.";
  } else if (action.action === "scene_released") {
    cause = "As tarefas primárias documentadas para a cena foram concluídas.";
    consequence = "O local foi liberado no registro, mantendo os itens coletados sob cadeia de custódia.";
  } else if (action.action === "evidence_collected") {
    cause = "O processamento da cena identificou um item relevante para exame ou registro.";
    consequence = "O item foi lacrado ou validado e passou a integrar a cadeia de custódia do caso.";
  } else if (action.action === "forensic_analysis_started") {
    cause = "Um vestígio lacrado exigia exame técnico especializado.";
    consequence = "O laboratório registrou recebimento, responsável e prazo estimado; nenhum resultado foi antecipado.";
  } else if (action.action === "forensic_result_validated") {
    cause = "O prazo de análise de um vestígio foi cumprido com cadeia de custódia registrada.";
    consequence = "Um laudo conclusivo foi incorporado à avaliação das hipóteses, sem equivaler sozinho à prova de culpa.";
  } else if (action.action === "forensic_result_inconclusive") {
    cause = "A análise laboratorial chegou ao fim sem capacidade individualizante suficiente.";
    consequence = "O resultado inconclusivo foi preservado na ficha e não recebeu peso de confirmação de autoria.";
  } else if (action.action === "witness_statement_recorded") {
    cause = "Havia testemunha pendente de oitiva no plano de diligências.";
    consequence = "Um depoimento foi formalizado para confronto com outros elementos; seu conteúdo permanece restrito.";
  } else if (action.action === "suspect_interview_completed") {
    cause = "Uma pessoa de interesse precisava ser ouvida formalmente após convergência de elementos.";
    consequence = "A entrevista foi registrada com ciência de direitos e sem presunção de culpa.";
  } else if (action.action === "warrant_requested") {
    cause = "A equipe registrou fundamentação mínima para submeter uma medida à revisão judicial.";
    consequence = "O pedido ficou pendente de decisão e não autorizou cumprimento antecipado.";
  } else if (action.action === "warrant_authorized") {
    cause = "A revisão concluiu que a fundamentação registrada atingiu o limiar da medida solicitada.";
    consequence = "A autorização permite planejar o cumprimento, mas não registra prisão, busca ou apreensão por si só.";
  } else if (action.action === "warrant_denied") {
    cause = "A fundamentação registrada não atingiu o limiar exigido para a medida.";
    consequence = "O pedido foi negado e nenhum cumprimento foi autorizado.";
  } else if (action.action === "police_operation_planned") {
    cause = "Uma medida autorizada aguardava organização operacional.";
    consequence = "A diligência recebeu equipe e horário previstos, sem antecipar seu resultado.";
  } else if (action.action === "police_operation_completed") {
    cause = "Chegou o horário registrado para uma diligência policial previamente planejada.";
    consequence = "A execução foi documentada; prisões, apreensões ou efeitos patrimoniais continuam dependentes do motor principal.";
  } else if (action.action === "fine_recommended") {
    cause = "A apuração de infração leve reuniu base suficiente para recomendação administrativa.";
    consequence = "Uma autuação foi recomendada, sem débito, pagamento ou cobrança automática.";
  } else if (action.action === "records_review_completed") {
    cause = "O plano de investigação previa cruzamento das bases disponíveis.";
    consequence = "A diligência foi encerrada e seus limites foram registrados, sem criar vínculos não confirmados.";
  } else if (action.action === "investigative_solution_recorded") {
    cause = "Vestígios independentes, hipótese principal e medida legal cumprida atingiram os critérios investigativos do caso.";
    consequence = "Uma conclusão investigativa foi registrada para encaminhamento; condenação continua dependente do Judiciário.";
  }
  facts.push(`Caso ${caseRecord.sourceCaseId}: ${profile.label}.`);
  facts.push(`Situação investigativa registrada: ${caseRecord.status}.`);
  if (timeline?.detail) facts.push(timeline.detail);
  return { cause, consequence, facts: [...new Set(facts)] };
};

/**
 * Traduz ações confirmadas em payloads editoriais. Eventos sigilosos continuam
 * disponíveis à integração, mas vêm marcados como `restricted` e sem nomes de
 * testemunhas ou pessoas investigadas, evitando publicação acidental.
 */
export function buildInvestigationJournalEvents(inputState, options = {}) {
  const state = options.normalizedState && inputState?.version === INVESTIGATION_DYNAMICS_VERSION
    ? inputState
    : normalizeInvestigationState(inputState);
  const actionFilter = Array.isArray(options.actionIds) ? new Set(uniqueIds(options.actionIds)) : null;
  const caseFilter = Array.isArray(options.caseIds) ? new Set(uniqueIds(options.caseIds)) : null;
  const since = firstFinite(options.sinceAbsoluteHour);
  const indexes = lookupIndexes(options.context ?? {});
  return state.recentActions.flatMap((action) => {
    if (actionFilter && !actionFilter.has(action.id)) return [];
    if (caseFilter && !caseFilter.has(action.caseId)) return [];
    if (since != null && Number(action.at?.absoluteHour) < since) return [];
    const config = JOURNAL_ACTION_CONFIG[action.action];
    if (!config) return [];
    const caseRecord = state.cases.find((entry) => entry.id === action.caseId);
    if (!caseRecord) return [];
    const timeline = caseRecord.timeline.find((entry) => entry.id === action.timelineId);
    const profile = profileFor(caseRecord.offenseId, caseRecord);
    const editorial = editorialCauseAndConsequence(action, caseRecord, profile, timeline);
    const statement = caseRecord.statements.find((entry) => timeline?.relatedIds?.includes(entry.id));
    const actorIds = uniqueIds([...(timeline?.actorIds ?? []), ...caseRecord.victimIds]);
    const roleFor = (personId) => caseRecord.victimIds.includes(personId) ? "victim"
      : caseRecord.suspects.some((entry) => entry.personId === personId) ? "investigated_person"
        : statement?.personId === personId ? "witness"
          : personId === caseRecord.leadInvestigatorId ? "lead_investigator"
            : caseRecord.assignedOfficerIds.includes(personId) ? "officer"
              : "mentioned_person";
    const people = actorIds.map((personId) => ({ ...personReference(personId, indexes), roleInEvent: roleFor(personId) })).filter((person) => person.id);
    const mayExposeInvestigatedPerson = Boolean(config.exposeSuspect && caseRecord.resolution?.status === "investigative_solution");
    const safePeople = people.filter((person) => (person.roleInEvent !== "investigated_person" || mayExposeInvestigatedPerson) && person.roleInEvent !== "witness");
    const locationId = idOf(timeline?.placeId ?? caseRecord.locationId) || null;
    const publishable = Boolean(config.public && timeline?.visibility !== "restricted");
    const score = Math.min(100, config.score + caseRecord.priority * 4 + (caseRecord.homicide ? 8 : 0));
    const publicTitle = caseRecord.homicide && action.action === "investigative_solution_recorded"
      ? "Polícia registra conclusão investigativa sobre homicídio"
      : config.title;
    return [{
      id: `journal:${action.id}`,
      sourceActionId: action.id,
      sourceTimelineId: timeline?.id ?? null,
      caseId: caseRecord.id,
      sourceCaseId: caseRecord.sourceCaseId,
      at: deepClone(action.at),
      section: "Segurança",
      type: config.type,
      kind: config.kind,
      title: publicTitle,
      summary: publishable ? text(timeline?.detail) || editorial.consequence : "Uma etapa foi registrada sob sigilo investigativo e não deve ser publicada antes de sua liberação.",
      people: safePeople,
      personIds: safePeople.map((person) => person.id),
      protectedPeopleCount: Math.max(0, people.length - safePeople.length),
      location: placeReference(locationId, indexes),
      locationId,
      offense: { id: caseRecord.offenseId, label: profile.label, severity: caseRecord.severity, homicide: caseRecord.homicide },
      cause: editorial.cause,
      confirmedConsequence: editorial.consequence,
      confirmedFacts: editorial.facts,
      relatedIds: uniqueIds([...(timeline?.relatedIds ?? []), caseRecord.deathRecordId, caseRecord.forensicCaseId]),
      publication: {
        status: publishable ? "eligible" : "restricted",
        reason: publishable ? "Etapa registrada como fato publicável; cabe ao jornal aplicar relevância e deduplicação." : "Sigilo protege diligência, testemunha ou pessoa ainda não submetida a conclusão pública.",
        newsworthiness: score,
        dedupeKey: `${caseRecord.id}:${config.type}:${timeline?.relatedIds?.[0] ?? action.at?.absoluteHour}`,
      },
      editorialGuardrails: {
        presumptionOfInnocence: true,
        externalEffectsApplied: false,
        mayInferAdditionalFacts: false,
      },
    }];
  });
}

/** Ficha pronta para UI, sem referências ao estado interno ou culpa presumida. */
export function getInvestigationCaseFile(inputState, caseId, context = {}) {
  const state = normalizeInvestigationState(inputState);
  const caseRecord = state.cases.find((entry) => entry.id === caseId || entry.sourceCaseId === caseId);
  if (!caseRecord) return null;
  const indexes = lookupIndexes(context);
  const profile = profileFor(caseRecord.offenseId, caseRecord);
  return {
    overview: {
      id: caseRecord.id,
      sourceCaseId: caseRecord.sourceCaseId,
      title: caseRecord.title,
      offenseId: caseRecord.offenseId,
      offenseLabel: profile.label,
      severity: caseRecord.severity,
      priority: caseRecord.priority,
      homicide: caseRecord.homicide,
      status: caseRecord.status,
      sourceStatus: caseRecord.sourceStatus,
      openedAt: deepClone(caseRecord.openedAt),
      lastUpdatedAt: deepClone(caseRecord.lastUpdatedAt),
      location: placeReference(caseRecord.locationId, indexes),
      districtId: caseRecord.districtId,
      deathRecordId: caseRecord.deathRecordId,
      forensicCaseId: caseRecord.forensicCaseId,
    },
    progress: deepClone(caseRecord.progress),
    resolution: caseRecord.resolution ? deepClone(caseRecord.resolution) : null,
    people: {
      victims: caseRecord.victimIds.map((id) => personReference(id, indexes)).filter(Boolean),
      leadInvestigator: personReference(caseRecord.leadInvestigatorId, indexes),
      assignedOfficers: caseRecord.assignedOfficerIds.map((id) => personReference(id, indexes)).filter(Boolean),
      suspects: caseRecord.suspects.map((suspect) => ({ ...deepClone(suspect), person: personReference(suspect.personId, indexes), presumption: "Hipótese investigativa; não equivale a condenação." })),
    },
    scenes: caseRecord.scenes.map((scene) => ({ ...deepClone(scene), place: placeReference(scene.locationId, indexes), officers: scene.officerIds.map((id) => personReference(id, indexes)).filter(Boolean) })),
    evidence: caseRecord.evidence.map((evidence) => ({ ...deepClone(evidence), collector: personReference(evidence.collectedById, indexes), analyst: personReference(evidence.forensic.analystId, indexes), linkedPeople: evidence.linkedPersonIds.map((id) => personReference(id, indexes)).filter(Boolean) })),
    statements: caseRecord.statements.map((statement) => ({ ...deepClone(statement), person: personReference(statement.personId, indexes), mentionedPeople: statement.mentionsPersonIds.map((id) => personReference(id, indexes)).filter(Boolean) })),
    warrants: deepClone(caseRecord.warrants),
    diligences: deepClone(caseRecord.diligences),
    operations: deepClone(caseRecord.operations),
    fines: deepClone(caseRecord.fines),
    hypotheses: caseRecord.hypotheses.map((hypothesis) => ({ ...deepClone(hypothesis), suspect: personReference(hypothesis.suspectId, indexes) })),
    timeline: deepClone(caseRecord.timeline).sort((a, b) => b.at.absoluteHour - a.at.absoluteHour || b.at.minute - a.at.minute || b.id.localeCompare(a.id)),
    journalEvents: buildInvestigationJournalEvents(state, { caseIds: [caseRecord.id], context, normalizedState: true }),
    tags: [...caseRecord.tags],
  };
}

/** Resumo para painel da delegacia, mapa e jornal. */
export function summarizeInvestigations(inputState) {
  const state = normalizeInvestigationState(inputState);
  const active = state.cases.filter((entry) => !terminal(entry));
  const priorityCases = active
    .slice()
    .sort((a, b) => b.priority - a.priority || b.progress.overall - a.progress.overall || a.openedAt.absoluteHour - b.openedAt.absoluteHour)
    .slice(0, 8)
    .map((entry) => ({ id: entry.id, sourceCaseId: entry.sourceCaseId, title: entry.title, status: entry.status, priority: entry.priority, homicide: entry.homicide, progress: round(entry.progress.overall), confidence: round(entry.progress.confidence), blockers: entry.progress.blockers.slice(0, 3), lastUpdatedAt: deepClone(entry.lastUpdatedAt) }));
  const statusCounts = Object.fromEntries(Object.values(INVESTIGATION_CASE_STATUSES).map((status) => [status, state.cases.filter((entry) => entry.status === status).length]));
  return {
    clock: deepClone(state.clock),
    totals: deepClone(state.metrics),
    statusCounts,
    lab: deepClone(state.lab),
    activeOperations: state.operations.filter((entry) => ["planned", "in_progress"].includes(entry.status)).length,
    pendingFines: state.fines.filter((entry) => entry.status === "recommended").length,
    pendingIntegrationRequests: state.integrationRequests.filter((entry) => entry.status === "pending_external_application").length,
    priorityCases,
    recentActions: deepClone(state.recentActions.slice(0, 12)),
  };
}
