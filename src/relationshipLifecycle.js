/**
 * RelationshipLifecycle
 *
 * Motor puro e serializável para relações afetivas. O módulo não conhece a
 * simulação, não altera os objetos recebidos e aceita uma fonte de aleatoriedade
 * injetável para que saltos temporais e testes reproduzam o mesmo resultado.
 */

export const RELATIONSHIP_LIFECYCLE_VERSION = 1;

export const RELATIONSHIP_LIFECYCLE_LIMITS = Object.freeze({
  milestones: 40,
  experiences: 32,
  agreementRevisions: 16,
  boundaries: 12,
  children: 16,
  pregnancies: 4,
});

export const RELATIONSHIP_STAGES = Object.freeze({
  FLIRTING: "paquera",
  CASUAL: "ficante_casual",
  RECURRING: "ficante_recorrente",
  EXCLUSIVE: "ficante_exclusivo",
  DATING: "namoro",
  CIVIL_UNION: "uniao_estavel",
  ENGAGED: "noivado",
  MARRIED: "casamento",
  SEPARATED: "separado",
  DIVORCED: "divorciado",
  WIDOWED: "viuvez",
  ENDED: "encerrado",
});

const STAGE_META = Object.freeze({
  paquera: { label: "Paquera", active: true, committed: false, legal: false },
  ficante_casual: { label: "Ficantes casuais", active: true, committed: false, legal: false },
  ficante_recorrente: { label: "Ficantes recorrentes", active: true, committed: false, legal: false },
  ficante_exclusivo: { label: "Ficantes exclusivos", active: true, committed: true, legal: false },
  namoro: { label: "Namoro", active: true, committed: true, legal: false },
  uniao_estavel: { label: "União estável", active: true, committed: true, legal: true },
  noivado: { label: "Noivado", active: true, committed: true, legal: false },
  casamento: { label: "Casamento", active: true, committed: true, legal: true },
  separado: { label: "Separação", active: false, committed: false, legal: false },
  divorciado: { label: "Divórcio", active: false, committed: false, legal: true },
  viuvez: { label: "Viuvez", active: false, committed: false, legal: true },
  encerrado: { label: "Relação encerrada", active: false, committed: false, legal: false },
});

export const RELATIONSHIP_STAGE_CATALOG = Object.freeze(
  Object.entries(STAGE_META).map(([id, metadata]) => Object.freeze({ id, ...metadata })),
);

const STAGE_ALIASES = Object.freeze({
  flirt: "paquera",
  flirting: "paquera",
  paquera: "paquera",
  ficando: "ficante_casual",
  ficante: "ficante_casual",
  casual: "ficante_casual",
  ficante_casual: "ficante_casual",
  recorrente: "ficante_recorrente",
  ficante_recorrente: "ficante_recorrente",
  exclusivo: "ficante_exclusivo",
  ficante_exclusivo: "ficante_exclusivo",
  romance: "namoro",
  namoro: "namoro",
  dating: "namoro",
  coabitacao: "uniao_estavel",
  coabitando: "uniao_estavel",
  uniao_estavel: "uniao_estavel",
  noivado: "noivado",
  engaged: "noivado",
  casamento: "casamento",
  casado: "casamento",
  casada: "casamento",
  marriage: "casamento",
  separado: "separado",
  separada: "separado",
  separacao: "separado",
  divorciado: "divorciado",
  divorciada: "divorciado",
  divorcio: "divorciado",
  viuvo: "viuvez",
  viuva: "viuvez",
  viuvez: "viuvez",
  encerrado: "encerrado",
  termino: "encerrado",
  ex: "encerrado",
});

const clamp = (value, minimum = 0, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(Number(value)) ? Number(value) : minimum));

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const slug = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const normalizedWeek = (value) => Math.max(0, Math.floor(Number(value) || 0));
const normalizedDay = (value) => clamp(Math.floor(Number(value) || 0), 0, 6);
const uniqueStrings = (values, limit = 24) =>
  [...new Set((Array.isArray(values) ? values : []).filter((value) => value != null).map(String))].slice(0, limit);

const safeRandom = (random) => {
  const value = Number(typeof random === "function" ? random() : 0.5);
  return Number.isFinite(value) ? clamp(value, 0, 0.999999) : 0.5;
};

const normalizeStage = (value) => {
  const key = slug(value);
  return STAGE_ALIASES[key] || (STAGE_META[key] ? key : "paquera");
};

const peoplePair = (people = []) => {
  if (Array.isArray(people)) return [people[0] || {}, people[1] || {}];
  return [people.a || people.personA || people.first || {}, people.b || people.personB || people.second || {}];
};

const personId = (person, fallback) => String(person?.id ?? fallback);
const dimensions = (person) => person?.personality?.dimensions || {};
const scalar = (person, key, fallback = 50) => clamp(person?.personality?.[key] ?? person?.[key] ?? fallback);

const overlapScore = (left = [], right = []) => {
  const a = new Set((left || []).map(slug));
  const b = new Set((right || []).map(slug));
  if (!a.size && !b.size) return 50;
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size || 1;
  return clamp(25 + (intersection / union) * 75);
};

const deriveCompatibility = (a = {}, b = {}) => {
  const ad = dimensions(a);
  const bd = dimensions(b);
  const keys = ["openness", "conscientiousness", "extraversion", "agreeableness", "stability"];
  const similarity = keys.reduce((sum, key) => sum + (100 - Math.abs(clamp(ad[key] ?? 50) - clamp(bd[key] ?? 50))), 0) / keys.length;
  const values = overlapScore(a.personality?.values, b.personality?.values);
  const interests = overlapScore(a.personality?.interests, b.personality?.interests);
  return round(clamp(similarity * 0.55 + values * 0.28 + interests * 0.17));
};

const deriveAttraction = (observer = {}, other = {}) => {
  const observerOpenness = clamp(dimensions(observer).openness ?? 50);
  const appearance = scalar(other, "beauty", scalar(other, "appearance", 52));
  const charisma = scalar(other, "charisma", 50);
  const familiarity = overlapScore(observer.personality?.interests, other.personality?.interests);
  return round(clamp(appearance * 0.38 + charisma * 0.34 + familiarity * 0.18 + observerOpenness * 0.1));
};

const desireForChildren = (person = {}) => {
  if (Number.isFinite(Number(person.familyPlanning?.desire))) return clamp(person.familyPlanning.desire);
  const values = (person.personality?.values || []).map(slug);
  const familyValue = values.some((value) => ["familia", "cuidado", "legado"].includes(value)) ? 18 : 0;
  const autonomyValue = values.some((value) => ["autonomia", "liberdade", "carreira"].includes(value)) ? -8 : 0;
  const agreeableness = clamp(dimensions(person).agreeableness ?? 50);
  return round(clamp(38 + familyValue + autonomyValue + agreeableness * 0.22));
};

const stageDefaults = (stage) => {
  const defaults = {
    paquera: [18, 8, 62, 25],
    ficante_casual: [25, 24, 68, 34],
    ficante_recorrente: [38, 40, 70, 46],
    ficante_exclusivo: [56, 52, 72, 59],
    namoro: [66, 62, 70, 66],
    uniao_estavel: [80, 76, 66, 72],
    noivado: [88, 78, 68, 76],
    casamento: [92, 80, 65, 78],
    separado: [22, 28, 35, 24],
    divorciado: [8, 18, 22, 18],
    viuvez: [72, 68, 50, 35],
    encerrado: [6, 12, 24, 16],
  };
  const [commitment, intimacy, attraction, satisfaction] = defaults[stage] || defaults.paquera;
  return { commitment, intimacy, attraction, satisfaction };
};

const normalizeMetrics = (metrics = {}, fallback = {}, people = []) => {
  const [a, b] = peoplePair(people);
  const compatibility = clamp(metrics.compatibility ?? fallback.compatibility ?? deriveCompatibility(a, b));
  const attraction = clamp(metrics.attraction ?? fallback.attraction ?? ((deriveAttraction(a, b) + deriveAttraction(b, a)) / 2));
  return {
    commitment: round(clamp(metrics.commitment ?? fallback.commitment ?? 20)),
    intimacy: round(clamp(metrics.intimacy ?? fallback.intimacy ?? 15)),
    attraction: round(attraction),
    compatibility: round(compatibility),
    satisfaction: round(clamp(metrics.satisfaction ?? fallback.satisfaction ?? 50)),
    trust: round(clamp(metrics.trust ?? fallback.trust ?? 32)),
    communication: round(clamp(metrics.communication ?? fallback.communication ?? 45)),
    jealousy: round(clamp(metrics.jealousy ?? fallback.jealousy ?? 18)),
    tension: round(clamp(metrics.tension ?? fallback.tension ?? 8)),
    reciprocity: round(clamp(metrics.reciprocity ?? fallback.reciprocity ?? 52)),
    autonomy: round(clamp(metrics.autonomy ?? fallback.autonomy ?? 70)),
    repairCapacity: round(clamp(metrics.repairCapacity ?? fallback.repairCapacity ?? 48)),
  };
};

const normalizePerspective = (raw = {}, metrics = {}, person = {}) => ({
  security: round(clamp(raw.security ?? metrics.trust * 0.62 + metrics.commitment * 0.38)),
  feltHeard: round(clamp(raw.feltHeard ?? metrics.communication)),
  individualSatisfaction: round(clamp(raw.individualSatisfaction ?? metrics.satisfaction)),
  perceivedReciprocity: round(clamp(raw.perceivedReciprocity ?? metrics.reciprocity)),
  autonomy: round(clamp(raw.autonomy ?? metrics.autonomy)),
  jealousy: round(clamp(raw.jealousy ?? metrics.jealousy + (50 - clamp(dimensions(person).stability ?? 50)) * 0.12)),
  futureConfidence: round(clamp(raw.futureConfidence ?? metrics.commitment * 0.5 + metrics.satisfaction * 0.5)),
  lastUpdatedWeek: normalizedWeek(raw.lastUpdatedWeek),
});

const normalizeMilestone = (raw = {}, fallbackWeek = 0) => ({
  id: String(raw.id || `milestone:${slug(raw.kind || raw.type || "momento")}:${normalizedWeek(raw.week ?? fallbackWeek)}:${normalizedDay(raw.day)}`),
  kind: slug(raw.kind || raw.type || "momento") || "momento",
  text: String(raw.text || raw.summary || "Um momento importante marcou a relação."),
  week: normalizedWeek(raw.week ?? fallbackWeek),
  day: normalizedDay(raw.day),
  placeId: raw.placeId == null ? null : String(raw.placeId),
  valence: round(clamp(raw.valence ?? 0, -100, 100)),
  stage: normalizeStage(raw.stage || "paquera"),
});

const normalizeExperience = (raw = {}, context = {}) => ({
  id: String(raw.id || `experience:${slug(raw.kind || "convivencia")}:${normalizedWeek(raw.week ?? context.week)}:${normalizedDay(raw.day ?? context.day)}:${Math.max(0, Math.floor(Number(raw.serial) || 0))}`),
  kind: slug(raw.kind || raw.type || "convivencia") || "convivencia",
  text: String(raw.text || raw.summary || "Compartilharam um momento da rotina."),
  week: normalizedWeek(raw.week ?? context.week),
  day: normalizedDay(raw.day ?? context.day),
  placeId: raw.placeId == null ? null : String(raw.placeId),
  actorIds: uniqueStrings(raw.actorIds || raw.peopleIds, 4),
  tone: ["positive", "negative", "mixed", "support"].includes(raw.tone) ? raw.tone : "mixed",
  valence: round(clamp(raw.valence ?? 0, -100, 100)),
  importance: round(clamp(raw.importance ?? 35)),
});

const defaultAgreements = (stage, week) => ({
  relationshipModel: ["ficante_exclusivo", "namoro", "uniao_estavel", "noivado", "casamento"].includes(stage) ? "monogamico" : "a_definir",
  exclusivity: ["ficante_exclusivo", "namoro", "uniao_estavel", "noivado", "casamento"].includes(stage) ? true : null,
  publicStatus: ["namoro", "uniao_estavel", "noivado", "casamento"].includes(stage) ? "publico" : "discreto",
  cohabitationIntent: ["uniao_estavel", "noivado", "casamento"].includes(stage) ? "sim" : "a_conversar",
  financialArrangement: ["uniao_estavel", "casamento"].includes(stage) ? "parcialmente_compartilhado" : "separado",
  conflictStyle: "conversar_e_reparar",
  privacy: "individual_com_transparencia",
  socialBoundaries: "respeitar_acordos",
  sexualHealth: "dialogo_e_consentimento",
  careCommitment: STAGE_META[stage].committed ? "mutuo" : "em_construcao",
  familyVisibility: ["uniao_estavel", "noivado", "casamento"].includes(stage) ? "integrada" : "gradual",
  lastReviewedWeek: normalizedWeek(week),
  boundaries: [],
  revisions: [],
});

const normalizeAgreements = (raw = {}, stage, week) => {
  const fallback = defaultAgreements(stage, week);
  const model = ["a_definir", "monogamico", "nao_monogamico_consensual"].includes(raw.relationshipModel)
    ? raw.relationshipModel
    : fallback.relationshipModel;
  return {
    ...fallback,
    ...raw,
    relationshipModel: model,
    exclusivity: raw.exclusivity == null ? fallback.exclusivity : Boolean(raw.exclusivity),
    lastReviewedWeek: normalizedWeek(raw.lastReviewedWeek ?? week),
    boundaries: (Array.isArray(raw.boundaries) ? raw.boundaries : []).slice(-RELATIONSHIP_LIFECYCLE_LIMITS.boundaries).map((boundary, index) => ({
      id: String(boundary.id || `boundary:${index}:${slug(boundary.topic)}`),
      topic: slug(boundary.topic || "convivencia") || "convivencia",
      label: String(boundary.label || boundary.text || "Limite de convivência"),
      status: ["agreed", "review", "violated"].includes(boundary.status) ? boundary.status : "agreed",
      agreedWeek: normalizedWeek(boundary.agreedWeek ?? week),
      lastDiscussedWeek: normalizedWeek(boundary.lastDiscussedWeek ?? week),
    })),
    revisions: (Array.isArray(raw.revisions) ? raw.revisions : []).slice(-RELATIONSHIP_LIFECYCLE_LIMITS.agreementRevisions).map((revision) => ({
      week: normalizedWeek(revision.week ?? week),
      topic: slug(revision.topic || "acordos") || "acordos",
      text: String(revision.text || "Revisaram seus acordos de convivência."),
    })),
  };
};

const normalizeFamilyPlanning = (raw = {}, people = [], week = 0) => {
  const [a, b] = peoplePair(people);
  const ids = [personId(a, "a"), personId(b, "b")];
  const rawIntentions = raw.intentions || {};
  const intentions = Object.fromEntries(ids.map((id, index) => {
    const person = index ? b : a;
    const source = rawIntentions[id] || {};
    const desire = round(clamp(source.desire ?? desireForChildren(person)));
    return [id, {
      desire,
      readiness: round(clamp(source.readiness ?? 35)),
      preferredTiming: ["agora", "em_breve", "mais_tarde", "nao_deseja", "indefinido"].includes(source.preferredTiming) ? source.preferredTiming : "indefinido",
      desiredChildren: clamp(Number.isFinite(Number(source.desiredChildren)) ? Math.floor(Number(source.desiredChildren)) : (desire > 55 ? 2 : 1), 0, 8),
    }];
  }));
  const desireGap = Math.abs(intentions[ids[0]].desire - intentions[ids[1]].desire);
  return {
    intentions,
    consensus: ["aligned", "partial", "conflict", "undiscussed"].includes(raw.consensus)
      ? raw.consensus
      : desireGap <= 18 ? "aligned" : desireGap <= 38 ? "partial" : "conflict",
    contraception: ["none", "barrier", "hormonal", "long_term", "fertility_awareness", "unknown"].includes(raw.contraception) ? raw.contraception : "unknown",
    trying: Boolean(raw.trying),
    tryingSinceWeek: raw.tryingSinceWeek == null ? null : normalizedWeek(raw.tryingSinceWeek),
    desiredHouseholdChildren: clamp(Math.floor(Number(raw.desiredHouseholdChildren) || 0), 0, 12),
    childrenIds: uniqueStrings(raw.childrenIds, RELATIONSHIP_LIFECYCLE_LIMITS.children),
    pregnancyIds: uniqueStrings(raw.pregnancyIds, RELATIONSHIP_LIFECYCLE_LIMITS.pregnancies),
    pregnancyLosses: Math.max(0, Math.floor(Number(raw.pregnancyLosses) || 0)),
    parentingLoad: round(clamp(raw.parentingLoad ?? 0)),
    coparentingQuality: round(clamp(raw.coparentingQuality ?? 55)),
    postpartumUntilWeek: raw.postpartumUntilWeek == null ? null : normalizedWeek(raw.postpartumUntilWeek),
    lastDiscussionWeek: raw.lastDiscussionWeek == null ? null : normalizedWeek(raw.lastDiscussionWeek ?? week),
  };
};

const lifecycleId = (ids) => `relationship:${[...ids].sort().join(":")}`;

/** Cria um ciclo afetivo novo a partir das características das duas pessoas. */
export function initializeRelationshipLifecycle(personA = {}, personB = {}, context = {}) {
  const stage = normalizeStage(context.stage || "paquera");
  const week = normalizedWeek(context.week);
  const ids = [personId(personA, "a"), personId(personB, "b")];
  const defaults = stageDefaults(stage);
  const compatibility = deriveCompatibility(personA, personB);
  const attractionA = deriveAttraction(personA, personB);
  const attractionB = deriveAttraction(personB, personA);
  const metrics = normalizeMetrics(context.metrics, {
    ...defaults,
    compatibility,
    attraction: (attractionA + attractionB) / 2,
    trust: defaults.commitment * 0.42 + 22,
    communication: compatibility * 0.58 + 15,
    repairCapacity: compatibility * 0.5 + 18,
  }, [personA, personB]);
  return normalizeRelationshipLifecycle({
    version: RELATIONSHIP_LIFECYCLE_VERSION,
    id: context.id || lifecycleId(ids),
    partnerIds: ids,
    stage,
    status: STAGE_META[stage].active ? "active" : "inactive",
    startedWeek: week,
    stageSinceWeek: week,
    previousStage: null,
    metrics,
    agreements: context.agreements,
    familyPlanning: context.familyPlanning,
    perspectives: {
      [ids[0]]: { individualSatisfaction: defaults.satisfaction, jealousy: 16 + Math.abs(attractionA - attractionB) * 0.12 },
      [ids[1]]: { individualSatisfaction: defaults.satisfaction, jealousy: 16 + Math.abs(attractionA - attractionB) * 0.12 },
    },
    milestones: context.skipInitialMilestone ? [] : [{
      kind: "inicio",
      text: context.initialText || `${personA.name || "Uma pessoa"} e ${personB.name || "outra pessoa"} perceberam interesse mútuo.`,
      week,
      day: context.day,
      valence: 62,
      stage,
    }],
    experiences: [],
    lastEvaluatedWeek: null,
    revision: 0,
  }, [personA, personB], context);
}

/** Normaliza saves antigos e garante que todos os campos permaneçam limitados. */
export function normalizeRelationshipLifecycle(raw = {}, people = [], context = {}) {
  const [a, b] = peoplePair(people);
  const inferredIds = [personId(a, "a"), personId(b, "b")];
  const partnerIds = uniqueStrings(raw.partnerIds || raw.peopleIds || inferredIds, 2);
  while (partnerIds.length < 2) partnerIds.push(inferredIds[partnerIds.length]);
  const effectivePeople = [
    Object.keys(a).length ? a : { id: partnerIds[0] },
    Object.keys(b).length ? b : { id: partnerIds[1] },
  ];
  const stage = normalizeStage(raw.stage || raw.type || context.stage);
  const week = normalizedWeek(context.week ?? raw.stageSinceWeek ?? raw.startedWeek);
  const defaults = stageDefaults(stage);
  const legacyMetrics = {
    trust: raw.trust,
    attraction: raw.attraction ?? (Number(raw.affinity) > 0 ? raw.affinity : undefined),
    satisfaction: raw.satisfaction,
    tension: raw.tension,
    commitment: raw.commitment,
    intimacy: raw.intimacy,
    compatibility: raw.compatibility,
  };
  const metrics = normalizeMetrics(raw.metrics, { ...defaults, ...legacyMetrics }, [a, b]);
  const perspectives = {};
  partnerIds.forEach((id, index) => {
    perspectives[id] = normalizePerspective(raw.perspectives?.[id], metrics, index ? b : a);
  });
  const legalRaw = raw.legal || {};
  const cohabitationRaw = raw.cohabitation || {};
  return {
    version: RELATIONSHIP_LIFECYCLE_VERSION,
    id: String(raw.id || lifecycleId(partnerIds)),
    partnerIds,
    stage,
    status: STAGE_META[stage].active ? "active" : stage,
    startedWeek: normalizedWeek(raw.startedWeek),
    stageSinceWeek: normalizedWeek(raw.stageSinceWeek ?? raw.startedWeek),
    previousStage: raw.previousStage ? normalizeStage(raw.previousStage) : null,
    legal: {
      married: stage === "casamento" || (Boolean(legalRaw.married) && !["divorciado", "viuvez"].includes(stage)),
      marriageWeek: legalRaw.marriageWeek == null ? (stage === "casamento" ? week : null) : normalizedWeek(legalRaw.marriageWeek),
      civilUnion: stage === "uniao_estavel" || Boolean(legalRaw.civilUnion),
      civilUnionWeek: legalRaw.civilUnionWeek == null ? (stage === "uniao_estavel" ? week : null) : normalizedWeek(legalRaw.civilUnionWeek),
      separationWeek: legalRaw.separationWeek == null ? null : normalizedWeek(legalRaw.separationWeek),
      divorceWeek: legalRaw.divorceWeek == null ? (stage === "divorciado" ? week : null) : normalizedWeek(legalRaw.divorceWeek),
      widowedWeek: legalRaw.widowedWeek == null ? (stage === "viuvez" ? week : null) : normalizedWeek(legalRaw.widowedWeek),
    },
    cohabitation: {
      active: ["uniao_estavel", "casamento"].includes(stage) ? cohabitationRaw.active !== false : Boolean(cohabitationRaw.active),
      homeId: cohabitationRaw.homeId == null ? null : String(cohabitationRaw.homeId),
      sinceWeek: cohabitationRaw.sinceWeek == null ? null : normalizedWeek(cohabitationRaw.sinceWeek),
      endedWeek: cohabitationRaw.endedWeek == null ? null : normalizedWeek(cohabitationRaw.endedWeek),
    },
    metrics,
    agreements: normalizeAgreements(raw.agreements, stage, week),
    familyPlanning: normalizeFamilyPlanning(raw.familyPlanning, effectivePeople, week),
    perspectives,
    dynamics: {
      weeklyContact: Math.max(0, Math.floor(Number(raw.dynamics?.weeklyContact) || 0)),
      qualityTime: round(clamp(raw.dynamics?.qualityTime ?? 0)),
      supportBalance: round(clamp(raw.dynamics?.supportBalance ?? 50)),
      unresolvedConflicts: Math.max(0, Math.floor(Number(raw.dynamics?.unresolvedConflicts) || 0)),
      conflictStreak: Math.max(0, Math.floor(Number(raw.dynamics?.conflictStreak) || 0)),
      positiveStreak: Math.max(0, Math.floor(Number(raw.dynamics?.positiveStreak) || 0)),
      distanceWeeks: Math.max(0, Math.floor(Number(raw.dynamics?.distanceWeeks) || 0)),
      lastPositiveWeek: raw.dynamics?.lastPositiveWeek == null ? null : normalizedWeek(raw.dynamics.lastPositiveWeek),
      lastConflictWeek: raw.dynamics?.lastConflictWeek == null ? null : normalizedWeek(raw.dynamics.lastConflictWeek),
    },
    milestones: (Array.isArray(raw.milestones) ? raw.milestones : [])
      .map((milestone) => normalizeMilestone(milestone, week))
      .sort((left, right) => right.week - left.week || right.day - left.day)
      .slice(0, RELATIONSHIP_LIFECYCLE_LIMITS.milestones),
    experiences: (Array.isArray(raw.experiences) ? raw.experiences : [])
      .map((experience) => normalizeExperience(experience, context))
      .sort((left, right) => right.week - left.week || right.day - left.day)
      .slice(0, RELATIONSHIP_LIFECYCLE_LIMITS.experiences),
    lastEvaluatedWeek: raw.lastEvaluatedWeek == null ? null : normalizedWeek(raw.lastEvaluatedWeek),
    revision: Math.max(0, Math.floor(Number(raw.revision) || 0)),
  };
}

const EXPERIENCE_EFFECTS = Object.freeze({
  flerte: { attraction: 5, intimacy: 1, satisfaction: 2, tension: -1 },
  encontro: { intimacy: 4, attraction: 2, satisfaction: 4, communication: 2, trust: 1 },
  tempo_de_qualidade: { intimacy: 4, satisfaction: 5, communication: 2, tension: -3 },
  carinho: { intimacy: 3, satisfaction: 3, trust: 2, tension: -2 },
  intimidade: { intimacy: 5, attraction: 2, satisfaction: 4, trust: 2 },
  vulnerabilidade: { intimacy: 6, trust: 6, communication: 4, satisfaction: 2 },
  apoio_emocional: { trust: 6, satisfaction: 4, reciprocity: 4, repairCapacity: 2, tension: -4 },
  apoio_pratico: { trust: 4, reciprocity: 5, satisfaction: 3, tension: -2 },
  evento_familiar: { commitment: 2, intimacy: 3, satisfaction: 3, trust: 2 },
  celebracao: { intimacy: 3, satisfaction: 5, attraction: 1, tension: -2 },
  tarefa_compartilhada: { reciprocity: 4, satisfaction: 2, trust: 2, communication: 1 },
  cuidado_parental: { commitment: 2, reciprocity: 4, satisfaction: 2, trust: 3 },
  conversa_sobre_futuro: { commitment: 4, communication: 4, trust: 3, satisfaction: 2 },
  terapia_de_casal: { communication: 6, repairCapacity: 7, trust: 3, tension: -6 },
  tentativa_de_reparo: { repairCapacity: 5, trust: 3, communication: 4, tension: -7, satisfaction: 2 },
  reconciliacao: { trust: 5, satisfaction: 6, intimacy: 4, tension: -12, jealousy: -3 },
  desacordo: { communication: -2, satisfaction: -3, tension: 5, trust: -1 },
  discussao: { satisfaction: -6, trust: -4, communication: -4, tension: 10, jealousy: 2 },
  critica_destrutiva: { satisfaction: -6, trust: -5, communication: -5, tension: 9, repairCapacity: -3 },
  estresse_financeiro: { satisfaction: -3, tension: 6, communication: -1 },
  sobrecarga_parental: { satisfaction: -4, intimacy: -2, tension: 7, reciprocity: -3 },
  ciume: { jealousy: 9, trust: -4, satisfaction: -3, tension: 7 },
  negligencia: { intimacy: -5, satisfaction: -7, trust: -5, reciprocity: -5, tension: 6 },
  distancia: { intimacy: -3, satisfaction: -3, attraction: -1, tension: 2 },
  quebra_de_limite: { trust: -10, satisfaction: -8, tension: 12, repairCapacity: -4 },
  traicao: { trust: -24, satisfaction: -20, commitment: -14, intimacy: -12, jealousy: 20, tension: 24 },
  pedido_de_noivado: { commitment: 9, satisfaction: 8, intimacy: 4, trust: 5 },
  mudanca_conjunta: { commitment: 6, intimacy: 5, satisfaction: 3, reciprocity: 3 },
  casamento: { commitment: 8, satisfaction: 8, intimacy: 5, trust: 4 },
  gravidez: { commitment: 4, intimacy: 3, satisfaction: 4, tension: 2 },
  nascimento: { commitment: 5, intimacy: 4, satisfaction: 6, tension: 3 },
  perda_gestacional: { satisfaction: -12, intimacy: 2, tension: 4 },
});

const IMPORTANT_EXPERIENCES = new Set([
  "primeiro_beijo", "pedido_de_noivado", "mudanca_conjunta", "casamento", "separacao", "divorcio",
  "reconciliacao", "gravidez", "nascimento", "adocao", "perda_gestacional", "traicao", "viuvez",
]);

const experienceEffects = (experience) => {
  let kind = slug(experience.kind || experience.type);
  if (kind === "intimidade" && experience.consensual === false) kind = "quebra_de_limite";
  const base = EXPERIENCE_EFFECTS[kind] || {};
  return { kind, effects: { ...base, ...(experience.effects || {}) } };
};

const patchPerspective = (perspective, effects = {}, generalEffects = {}) => ({
  ...perspective,
  security: round(clamp(perspective.security + (effects.security ?? generalEffects.trust ?? 0) * 0.65)),
  feltHeard: round(clamp(perspective.feltHeard + (effects.feltHeard ?? generalEffects.communication ?? 0) * 0.7)),
  individualSatisfaction: round(clamp(perspective.individualSatisfaction + (effects.individualSatisfaction ?? generalEffects.satisfaction ?? 0))),
  perceivedReciprocity: round(clamp(perspective.perceivedReciprocity + (effects.perceivedReciprocity ?? generalEffects.reciprocity ?? 0) * 0.7)),
  autonomy: round(clamp(perspective.autonomy + (effects.autonomy ?? generalEffects.autonomy ?? 0))),
  jealousy: round(clamp(perspective.jealousy + (effects.jealousy ?? generalEffects.jealousy ?? 0))),
  futureConfidence: round(clamp(perspective.futureConfidence + (effects.futureConfidence ?? ((generalEffects.commitment || 0) + (generalEffects.satisfaction || 0)) * 0.4))),
});

const applyAgreementChanges = (agreements, changes, context) => {
  if (!changes || typeof changes !== "object") return agreements;
  const week = normalizedWeek(context.week);
  const revisions = [...agreements.revisions, {
    week,
    topic: slug(changes.topic || "acordos") || "acordos",
    text: String(changes.text || "O casal revisou seus acordos e limites."),
  }].slice(-RELATIONSHIP_LIFECYCLE_LIMITS.agreementRevisions);
  const allowed = ["relationshipModel", "exclusivity", "publicStatus", "cohabitationIntent", "financialArrangement", "conflictStyle", "privacy", "socialBoundaries", "sexualHealth", "careCommitment", "familyVisibility"];
  const patch = Object.fromEntries(allowed.filter((key) => Object.hasOwn(changes, key)).map((key) => [key, changes[key]]));
  return normalizeAgreements({ ...agreements, ...patch, boundaries: changes.boundaries || agreements.boundaries, revisions, lastReviewedWeek: week }, context.stage, week);
};

const applyFamilyPlanningExperience = (familyPlanning, experience, context) => {
  const next = {
    ...familyPlanning,
    intentions: Object.fromEntries(Object.entries(familyPlanning.intentions).map(([id, intention]) => [id, { ...intention }])),
    childrenIds: [...familyPlanning.childrenIds],
    pregnancyIds: [...familyPlanning.pregnancyIds],
  };
  const kind = slug(experience.kind || experience.type);
  if (kind === "planejamento_familiar") {
    Object.entries(experience.intentions || {}).forEach(([id, patch]) => {
      if (next.intentions[id]) next.intentions[id] = { ...next.intentions[id], ...patch, desire: round(clamp(patch.desire ?? next.intentions[id].desire)), readiness: round(clamp(patch.readiness ?? next.intentions[id].readiness)) };
    });
    const intentions = Object.values(next.intentions);
    const gap = intentions.length === 2 ? Math.abs(intentions[0].desire - intentions[1].desire) : 0;
    next.consensus = experience.consensus || (gap <= 18 ? "aligned" : gap <= 38 ? "partial" : "conflict");
    next.lastDiscussionWeek = normalizedWeek(context.week);
  }
  if (kind === "iniciar_tentativas") {
    next.trying = true;
    next.tryingSinceWeek = normalizedWeek(context.week);
    next.contraception = "none";
  }
  if (kind === "pausar_tentativas") next.trying = false;
  if (kind === "gravidez") {
    const pregnancyId = String(experience.pregnancyId || `pregnancy:${normalizedWeek(context.week)}`);
    next.pregnancyIds = uniqueStrings([...next.pregnancyIds, pregnancyId], RELATIONSHIP_LIFECYCLE_LIMITS.pregnancies);
    next.trying = false;
  }
  if (["nascimento", "adocao"].includes(kind)) {
    if (experience.childId != null) next.childrenIds = uniqueStrings([...next.childrenIds, experience.childId], RELATIONSHIP_LIFECYCLE_LIMITS.children);
    if (experience.pregnancyId != null) next.pregnancyIds = next.pregnancyIds.filter((id) => id !== String(experience.pregnancyId));
    else if (kind === "nascimento") next.pregnancyIds = next.pregnancyIds.slice(1);
    next.postpartumUntilWeek = kind === "nascimento" ? normalizedWeek(context.week) + 12 : next.postpartumUntilWeek;
    next.parentingLoad = clamp(next.parentingLoad + 18);
  }
  if (kind === "perda_gestacional") {
    next.pregnancyLosses += 1;
    next.pregnancyIds = experience.pregnancyId == null ? next.pregnancyIds.slice(1) : next.pregnancyIds.filter((id) => id !== String(experience.pregnancyId));
  }
  return next;
};

/** Aplica uma experiência compartilhada sem alterar o ciclo recebido. */
export function applyRelationshipExperience(lifecycle, experience = {}, context = {}) {
  const state = normalizeRelationshipLifecycle(lifecycle, context.people, context);
  const { kind, effects } = experienceEffects(experience);
  const week = normalizedWeek(experience.week ?? context.week);
  const normalized = normalizeExperience({ ...experience, kind, week, serial: state.revision }, context);
  const metrics = Object.fromEntries(Object.entries(state.metrics).map(([key, value]) => [key, round(clamp(value + (Number(effects[key]) || 0)))]));
  const perspectives = {};
  state.partnerIds.forEach((id) => {
    perspectives[id] = {
      ...patchPerspective(state.perspectives[id], experience.perspectiveEffects?.[id], effects),
      lastUpdatedWeek: week,
    };
  });
  const isConflict = ["desacordo", "discussao", "critica_destrutiva", "estresse_financeiro", "sobrecarga_parental", "ciume", "negligencia", "quebra_de_limite", "traicao"].includes(kind);
  const isPositive = normalized.valence > 15 || ["encontro", "tempo_de_qualidade", "carinho", "apoio_emocional", "reconciliacao", "celebracao"].includes(kind);
  const isRepair = ["tentativa_de_reparo", "reconciliacao", "terapia_de_casal"].includes(kind);
  const dynamics = {
    ...state.dynamics,
    weeklyContact: state.dynamics.weeklyContact + 1,
    qualityTime: round(clamp(state.dynamics.qualityTime + (["encontro", "tempo_de_qualidade", "evento_familiar", "celebracao"].includes(kind) ? 10 : 1))),
    unresolvedConflicts: Math.max(0, state.dynamics.unresolvedConflicts + (isConflict ? 1 : 0) - (isRepair ? 1 : 0)),
    lastPositiveWeek: isPositive ? week : state.dynamics.lastPositiveWeek,
    lastConflictWeek: isConflict ? week : state.dynamics.lastConflictWeek,
  };
  const milestone = IMPORTANT_EXPERIENCES.has(kind) || experience.milestone
    ? normalizeMilestone({ ...experience, kind, week, stage: state.stage, valence: normalized.valence }, week)
    : null;
  return {
    ...state,
    metrics,
    perspectives,
    agreements: applyAgreementChanges(state.agreements, experience.agreementChanges, { ...context, week, stage: state.stage }),
    familyPlanning: applyFamilyPlanningExperience(state.familyPlanning, { ...experience, kind }, { ...context, week }),
    dynamics,
    experiences: [normalized, ...state.experiences].slice(0, RELATIONSHIP_LIFECYCLE_LIMITS.experiences),
    milestones: milestone ? [milestone, ...state.milestones].slice(0, RELATIONSHIP_LIFECYCLE_LIMITS.milestones) : state.milestones,
    revision: state.revision + 1,
  };
}

const transitionText = (from, to) => {
  const messages = {
    ficante_casual: "A paquera se transformou em encontros casuais.",
    ficante_recorrente: "Os encontros se tornaram frequentes e ganharam intimidade.",
    ficante_exclusivo: "Conversaram sobre exclusividade e decidiram priorizar a relação.",
    namoro: "Assumiram um namoro e tornaram o vínculo mais público.",
    uniao_estavel: "Passaram a construir uma vida doméstica em união estável.",
    noivado: "Decidiram se casar e celebraram o noivado.",
    casamento: "Formalizaram o casamento diante da família e da comunidade.",
    separado: "Decidiram se separar e reorganizar a vida cotidiana.",
    divorciado: "Concluíram o divórcio e os acordos legais da separação.",
    viuvez: "A morte de uma das pessoas encerrou a convivência e iniciou o luto.",
    encerrado: "A relação afetiva chegou ao fim.",
    paquera: "Retomaram o contato com cautela e curiosidade.",
  };
  return messages[to] || `A relação passou de ${relationshipStageLabel(from).toLowerCase()} para ${relationshipStageLabel(to).toLowerCase()}.`;
};

/** Realiza uma transição explícita e registra suas consequências jurídicas e domésticas. */
export function transitionRelationshipStage(lifecycle, targetStage, context = {}) {
  const state = normalizeRelationshipLifecycle(lifecycle, context.people, context);
  const to = normalizeStage(targetStage);
  if (to === state.stage) return state;
  const week = normalizedWeek(context.week);
  const previousCommitted = state.stage === "separado" ? state.previousStage : state.stage;
  const legal = { ...state.legal };
  const cohabitation = { ...state.cohabitation };
  if (to === "uniao_estavel") {
    legal.civilUnion = true;
    legal.civilUnionWeek ??= week;
    cohabitation.active = true;
    cohabitation.sinceWeek ??= week;
    cohabitation.endedWeek = null;
  }
  if (to === "casamento") {
    legal.married = true;
    legal.marriageWeek ??= week;
    cohabitation.active = context.cohabiting !== false;
    if (cohabitation.active) cohabitation.sinceWeek ??= week;
  }
  if (to === "separado") {
    legal.separationWeek = week;
    cohabitation.active = false;
    cohabitation.endedWeek = week;
  }
  if (to === "divorciado") {
    legal.married = false;
    legal.civilUnion = false;
    legal.divorceWeek = week;
    cohabitation.active = false;
    cohabitation.endedWeek ??= week;
  }
  if (to === "viuvez") {
    legal.married = false;
    legal.civilUnion = false;
    legal.widowedWeek = week;
    cohabitation.active = false;
    cohabitation.endedWeek = week;
  }
  if (to === "encerrado") {
    cohabitation.active = false;
    cohabitation.endedWeek ??= week;
  }
  let agreements = normalizeAgreements(state.agreements, to, week);
  if (["ficante_exclusivo", "namoro"].includes(to) && agreements.relationshipModel === "a_definir") {
    agreements = { ...agreements, relationshipModel: "monogamico", exclusivity: true, publicStatus: to === "namoro" ? "publico" : agreements.publicStatus };
  }
  if (["uniao_estavel", "noivado", "casamento"].includes(to)) {
    agreements = { ...agreements, careCommitment: "mutuo", familyVisibility: "integrada", cohabitationIntent: "sim" };
  }
  const milestone = normalizeMilestone({
    id: `milestone:stage:${to}:${week}:${state.revision}`,
    kind: to,
    text: context.text || transitionText(state.stage, to),
    week,
    day: context.day,
    placeId: context.placeId,
    valence: ["separado", "divorciado", "viuvez", "encerrado"].includes(to) ? -65 : 72,
    stage: to,
  }, week);
  return {
    ...state,
    stage: to,
    status: STAGE_META[to].active ? "active" : to,
    previousStage: to === "separado" ? previousCommitted : state.stage === "separado" ? state.previousStage : state.previousStage,
    stageSinceWeek: week,
    legal,
    cohabitation,
    agreements,
    milestones: [milestone, ...state.milestones].slice(0, RELATIONSHIP_LIFECYCLE_LIMITS.milestones),
    revision: state.revision + 1,
  };
}

const stageDuration = (state, week) => Math.max(0, week - state.stageSinceWeek);
const probability = (score, threshold, span = 100) => clamp((score - threshold) / span, 0, 0.72);

const requestedTransition = (state, context) => {
  if (context.partnerDied) return ["casamento", "uniao_estavel", "noivado"].includes(state.stage) ? "viuvez" : "encerrado";
  if (context.divorceFinalized) return "divorciado";
  if (context.separationRequested) return state.legal.married || ["casamento", "uniao_estavel"].includes(state.stage) ? "separado" : "encerrado";
  if (context.weddingOccurred) return "casamento";
  if (context.engagementAccepted) return "noivado";
  if (context.movedInTogether && ["namoro", "ficante_exclusivo"].includes(state.stage)) return "uniao_estavel";
  if (context.requestedTransition) return normalizeStage(context.requestedTransition);
  return null;
};

const organicTransitionCandidate = (state, week) => {
  const m = state.metrics;
  const d = state.dynamics;
  const duration = stageDuration(state, week);
  const ruptureScore = m.tension * 0.32 + (100 - m.satisfaction) * 0.3 + (100 - m.trust) * 0.18 + m.jealousy * 0.12 + d.unresolvedConflicts * 3 - m.repairCapacity * 0.12;
  if (STAGE_META[state.stage].active && duration >= 2 && ruptureScore > 52) {
    return { to: ["casamento", "uniao_estavel", "noivado"].includes(state.stage) ? "separado" : "encerrado", probability: probability(ruptureScore, 48, 75), reason: "desgaste acumulado" };
  }
  const growth = m.commitment * 0.23 + m.intimacy * 0.17 + m.satisfaction * 0.2 + m.trust * 0.16 + m.communication * 0.1 + m.compatibility * 0.09 + m.reciprocity * 0.05 - m.tension * 0.16;
  const rules = {
    paquera: { to: "ficante_casual", min: 1, threshold: 39 },
    ficante_casual: { to: "ficante_recorrente", min: 2, threshold: 47 },
    ficante_recorrente: { to: "ficante_exclusivo", min: 4, threshold: 56 },
    ficante_exclusivo: { to: "namoro", min: 4, threshold: 61 },
    namoro: { to: state.agreements.cohabitationIntent === "sim" ? "uniao_estavel" : "noivado", min: state.agreements.cohabitationIntent === "sim" ? 24 : 52, threshold: 69 },
    uniao_estavel: { to: "noivado", min: 40, threshold: 75 },
    noivado: { to: "casamento", min: 8, threshold: 72 },
  };
  const rule = rules[state.stage];
  if (rule && duration >= rule.min && growth >= rule.threshold) {
    return { to: rule.to, probability: probability(growth + Math.min(16, duration * 0.18), rule.threshold - 8, 105), reason: "vínculo amadurecido" };
  }
  if (state.stage === "separado") {
    if (duration >= 4 && state.legal.marriageWeek != null && m.satisfaction < 42) {
      return { to: "divorciado", probability: probability(58 - m.satisfaction + duration, 18, 90), reason: "separação consolidada" };
    }
    const repair = m.repairCapacity * 0.32 + m.trust * 0.24 + m.satisfaction * 0.24 + m.communication * 0.2 - m.tension * 0.25;
    if (duration >= 2 && repair > 38) return { to: state.previousStage || "namoro", probability: probability(repair, 32, 110), reason: "reconciliação construída" };
  }
  return null;
};

const weeklyMetrics = (state, people, context, week) => {
  const current = state.experiences.filter((experience) => experience.week === week);
  const positive = current.filter((experience) => experience.valence > 15 || experience.tone === "positive" || experience.tone === "support").length;
  const negative = current.filter((experience) => experience.valence < -15 || experience.tone === "negative").length;
  const contact = Number.isFinite(Number(context.weeklyContact)) ? Math.max(0, Number(context.weeklyContact)) : current.length;
  const quality = Number.isFinite(Number(context.qualityTime)) ? clamp(context.qualityTime) : clamp(state.dynamics.qualityTime);
  const externalPressure = clamp(context.externalStress ?? 0) + clamp(context.financialStress ?? 0) * 0.35 + clamp(context.parentingStress ?? state.familyPlanning.parentingLoad) * 0.28;
  const m = state.metrics;
  const satisfactionTarget = clamp(m.trust * 0.21 + m.intimacy * 0.18 + m.compatibility * 0.17 + m.communication * 0.15 + m.reciprocity * 0.11 + quality * 0.12 + m.autonomy * 0.06 - m.tension * 0.22 - m.jealousy * 0.08 - externalPressure * 0.12);
  const distance = contact === 0 ? state.dynamics.distanceWeeks + 1 : 0;
  const stageCommitment = stageDefaults(state.stage).commitment;
  const metrics = {
    ...m,
    satisfaction: round(clamp(m.satisfaction * 0.78 + satisfactionTarget * 0.22 + positive * 0.6 - negative * 0.9)),
    commitment: round(clamp(m.commitment * 0.88 + (stageCommitment * 0.55 + m.satisfaction * 0.45) * 0.12 - Math.min(2, distance * 0.18))),
    intimacy: round(clamp(m.intimacy + Math.min(2.4, quality * 0.025 + positive * 0.35) - Math.min(2.1, distance * 0.3 + negative * 0.25))),
    attraction: round(clamp(m.attraction - (distance > 6 ? 0.25 : 0) + positive * 0.08)),
    tension: round(clamp(m.tension * (negative ? 0.98 : 0.9) + externalPressure * 0.025 + negative * 0.8 - positive * 0.35)),
    jealousy: round(clamp(m.jealousy * 0.96 - (m.trust > 65 ? 0.35 : 0) + (context.jealousyTrigger ? 4 : 0))),
    communication: round(clamp(m.communication + positive * 0.28 - negative * 0.45 - (distance > 2 ? 0.3 : 0))),
    repairCapacity: round(clamp(m.repairCapacity + (positive && state.dynamics.unresolvedConflicts ? 0.35 : 0) - negative * 0.15)),
  };
  const dynamics = {
    ...state.dynamics,
    weeklyContact: Math.floor(contact),
    qualityTime: round(quality * 0.35),
    conflictStreak: negative ? state.dynamics.conflictStreak + 1 : 0,
    positiveStreak: positive && !negative ? state.dynamics.positiveStreak + 1 : 0,
    distanceWeeks: distance,
  };
  const perspectives = {};
  const [a, b] = peoplePair(people);
  state.partnerIds.forEach((id, index) => {
    const currentPerspective = state.perspectives[id];
    const stress = clamp((index ? b : a)?.mind?.emotional?.stress ?? 30);
    const target = clamp(metrics.satisfaction - stress * 0.08 + metrics.reciprocity * 0.08);
    perspectives[id] = {
      ...currentPerspective,
      security: round(clamp(currentPerspective.security * 0.86 + (metrics.trust * 0.6 + metrics.commitment * 0.4) * 0.14)),
      feltHeard: round(clamp(currentPerspective.feltHeard * 0.84 + metrics.communication * 0.16)),
      individualSatisfaction: round(clamp(currentPerspective.individualSatisfaction * 0.8 + target * 0.2)),
      perceivedReciprocity: round(clamp(currentPerspective.perceivedReciprocity * 0.86 + metrics.reciprocity * 0.14)),
      jealousy: round(clamp(currentPerspective.jealousy * 0.82 + metrics.jealousy * 0.18)),
      futureConfidence: round(clamp(currentPerspective.futureConfidence * 0.82 + (metrics.commitment * 0.48 + metrics.satisfaction * 0.52) * 0.18)),
      lastUpdatedWeek: week,
    };
  });
  return { metrics, dynamics, perspectives };
};

const familyPlanningSignals = (state, context, random, week) => {
  const signals = [];
  const planning = state.familyPlanning;
  const intentions = Object.values(planning.intentions);
  const ready = intentions.length === 2 && intentions.every((intent) => intent.desire >= 48 && intent.readiness >= 42);
  if (planning.consensus === "conflict" && week - (planning.lastDiscussionWeek ?? 0) >= 8) {
    signals.push({ kind: "family_planning_conversation", priority: "high", reason: "intenções parentais divergentes" });
  }
  if (planning.trying && !planning.pregnancyIds.length && STAGE_META[state.stage].committed && ready) {
    const likelihood = clamp(context.conceptionChance ?? 0.18, 0, 0.95);
    signals.push({
      kind: "conception_opportunity",
      eligible: true,
      likelihood: round(likelihood, 3),
      selected: safeRandom(random) < likelihood,
      week,
    });
  }
  if (planning.parentingLoad > 68) signals.push({ kind: "parenting_support_needed", priority: planning.parentingLoad > 84 ? "urgent" : "high", week });
  if (planning.postpartumUntilWeek != null && week <= planning.postpartumUntilWeek) signals.push({ kind: "postpartum_care", priority: "high", untilWeek: planning.postpartumUntilWeek });
  return signals;
};

/**
 * Consolida uma semana e pode avançar/recuar o estágio. O resultado contém o
 * novo estado, a transição (quando houver) e sinais para natalidade/cuidado.
 */
export function evaluateRelationshipWeekly(lifecycle, people = [], context = {}, random = Math.random) {
  let state = normalizeRelationshipLifecycle(lifecycle, people, context);
  const week = normalizedWeek(context.week);
  if (!context.force && state.lastEvaluatedWeek === week) return { relationship: state, transition: null, signals: [] };
  const weekly = weeklyMetrics(state, people, context, week);
  state = { ...state, ...weekly, lastEvaluatedWeek: week, revision: state.revision + 1 };
  let transition = null;
  const requested = requestedTransition(state, context);
  const candidate = requested
    ? { to: requested, probability: 1, reason: "acontecimento confirmado" }
    : organicTransitionCandidate(state, week);
  if (candidate) {
    const roll = requested ? 0 : safeRandom(random);
    if (roll < candidate.probability) {
      const from = state.stage;
      state = transitionRelationshipStage(state, candidate.to, { ...context, people, week });
      transition = { from, to: state.stage, reason: candidate.reason, probability: round(candidate.probability, 3), roll: round(roll, 3), week };
    }
  }
  const signals = familyPlanningSignals(state, context, random, week);
  return { relationship: state, transition, signals };
}

/** Rótulo humano do estágio oficial. */
export function relationshipStageLabel(stageOrLifecycle) {
  const stage = normalizeStage(typeof stageOrLifecycle === "object" ? stageOrLifecycle?.stage : stageOrLifecycle);
  return STAGE_META[stage].label;
}

/** Avaliação curta da saúde do vínculo, sem confundir intensidade com qualidade. */
export function relationshipHealthLabel(lifecycle) {
  const state = normalizeRelationshipLifecycle(lifecycle);
  if (["divorciado", "viuvez", "encerrado"].includes(state.stage)) return "vínculo encerrado";
  if (state.stage === "separado") return state.metrics.tension > 62 ? "separação conflituosa" : "separação em reorganização";
  const m = state.metrics;
  const score = m.satisfaction * 0.27 + m.trust * 0.2 + m.communication * 0.14 + m.reciprocity * 0.11 + m.intimacy * 0.1 + m.autonomy * 0.08 + m.repairCapacity * 0.1 - m.tension * 0.2 - m.jealousy * 0.08;
  if (score >= 72) return "relação muito saudável";
  if (score >= 58) return "relação estável";
  if (score >= 43) return "relação oscilante";
  if (score >= 28) return "relação fragilizada";
  return "relação em crise";
}

/** Resumo pronto para fichas, logs e jornal. */
export function relationshipLifecycleSummary(lifecycle, people = []) {
  const state = normalizeRelationshipLifecycle(lifecycle, people);
  const perspectives = Object.values(state.perspectives);
  const perceptionGap = perspectives.length === 2
    ? Math.abs(perspectives[0].individualSatisfaction - perspectives[1].individualSatisfaction)
    : 0;
  return {
    stage: state.stage,
    stageLabel: relationshipStageLabel(state),
    healthLabel: relationshipHealthLabel(state),
    durationWeeks: stageDuration(state, Math.max(state.lastEvaluatedWeek ?? 0, state.stageSinceWeek)),
    cohabiting: state.cohabitation.active,
    legalBond: state.legal.married ? "casamento" : state.legal.civilUnion ? "união estável" : "nenhum",
    exclusivity: state.agreements.exclusivity,
    relationshipModel: state.agreements.relationshipModel,
    satisfaction: state.metrics.satisfaction,
    commitment: state.metrics.commitment,
    intimacy: state.metrics.intimacy,
    trust: state.metrics.trust,
    tension: state.metrics.tension,
    perceptionGap: round(perceptionGap),
    unresolvedConflicts: state.dynamics.unresolvedConflicts,
    familyPlanning: {
      consensus: state.familyPlanning.consensus,
      trying: state.familyPlanning.trying,
      children: state.familyPlanning.childrenIds.length,
      pregnancies: state.familyPlanning.pregnancyIds.length,
      parentingLoad: state.familyPlanning.parentingLoad,
    },
    latestMilestone: state.milestones[0] || null,
  };
}
