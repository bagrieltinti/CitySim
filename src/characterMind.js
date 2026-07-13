/**
 * CharacterMind
 *
 * Camada psicológica pura e serializável. Nenhuma função deste módulo altera
 * o cidadão ou o estado recebido; isso permite usar a mesma lógica no modo
 * detalhado, em saltos temporais e em testes preditivos.
 */

export const CHARACTER_MIND_VERSION = 1;
export const CHARACTER_MIND_LIMITS = Object.freeze({
  memories: 48,
  coreMemories: 16,
  activeGoals: 4,
  archivedGoals: 8,
  eventBatch: 12,
});

const MOTIVATION_LABELS = Object.freeze({
  connection: "Pertencimento e vínculos",
  family: "Família e continuidade",
  achievement: "Realização profissional",
  security: "Segurança e estabilidade",
  autonomy: "Autonomia",
  mastery: "Aprendizado e domínio",
  novelty: "Descoberta e novidade",
  care: "Cuidado com os outros",
  recognition: "Reconhecimento",
  wellbeing: "Saúde e bem-estar",
  identity: "Identidade e expressão",
  legacy: "Legado",
});

const GOAL_LABELS = Object.freeze({
  education: "Avançar nos estudos",
  employment: "Conquistar um trabalho estável",
  career_growth: "Crescer profissionalmente",
  financial_security: "Construir segurança financeira",
  health_recovery: "Recuperar a saúde",
  wellbeing: "Cuidar do próprio bem-estar",
  belonging: "Fortalecer vínculos próximos",
  relationship: "Construir uma relação afetiva",
  family_care: "Estar presente para a família",
  independence: "Conquistar mais independência",
  personal_growth: "Desenvolver uma habilidade importante",
  community: "Contribuir com a comunidade",
  reputation: "Deixar uma marca na cidade",
  legacy: "Transmitir experiência e construir um legado",
});

const CORE_TAGS = new Set([
  "nascimento",
  "morte",
  "luto",
  "casamento",
  "divorcio",
  "prisao",
  "trauma",
  "formatura",
  "adocao",
]);

const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));

const round = (value, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const textKey = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stringHash = (value) => {
  let hash = 2166136261;
  const text = String(value ?? "cidadão");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const stableUnit = (seed, salt = "") => stringHash(`${seed}:${salt}`) / 4294967295;

const normalizedScore = (value, fallback = 50) => clamp(value ?? fallback);

const dimensionsOf = (person = {}) => {
  const source = person.personality?.dimensions || {};
  return {
    openness: normalizedScore(source.openness),
    conscientiousness: normalizedScore(source.conscientiousness),
    extraversion: normalizedScore(source.extraversion),
    agreeableness: normalizedScore(source.agreeableness),
    stability: normalizedScore(source.stability),
  };
};

const traitKeysOf = (person = {}) => (person.traits || []).map(textKey);
const valueKeysOf = (person = {}) => (person.personality?.values || []).map(textKey);
const interestKeysOf = (person = {}) => (person.personality?.interests || []).map(textKey);
const hasKey = (keys, expected) => keys.some((key) => key === expected || key.includes(expected));

const absoluteDayOf = (context = {}) => {
  if (Number.isFinite(context.absoluteDay)) return Math.max(0, Math.floor(context.absoluteDay));
  const week = Math.max(0, Math.floor(Number(context.week) || 0));
  const day = clamp(Math.floor(Number(context.day) || 0), 0, 6);
  return week * 7 + day;
};

const dayKeyOf = (context = {}) =>
  String(context.dayKey ?? `${Math.floor(Number(context.week) || 0)}:${Math.floor(Number(context.day) || 0)}`);

const lifeStage = (ageValue) => {
  const age = Math.max(0, Number(ageValue) || 0);
  if (age < 6) return "early_childhood";
  if (age < 13) return "childhood";
  if (age < 18) return "adolescence";
  if (age < 30) return "young_adulthood";
  if (age < 50) return "adulthood";
  if (age < 65) return "maturity";
  return "later_life";
};

const historySignals = (person = {}) => {
  const history = (person.history || []).slice(-16).map((entry) => textKey(entry?.text ?? entry));
  const contains = (...terms) => history.some((line) => terms.some((term) => line.includes(term)));
  return {
    grief: contains("faleceu", "falecimento", "luto", "viuvo"),
    displacement: contains("mudou se", "despejo", "abrigo"),
    careerChange: contains("contratado", "demitido", "desempregado", "promovido"),
    familyMilestone: contains("nasceu", "casou", "adocao", "tutela"),
    justice: contains("preso", "condenado", "crime", "vitima"),
    achievement: contains("formou", "premio", "destaque", "adquiriu", "fundou"),
  };
};

/** Deriva desejos duradouros e urgências atuais sem gravar estado. */
export function deriveMotivations(person = {}, previousMind = null, context = {}) {
  const d = dimensionsOf(person);
  const traits = traitKeysOf(person);
  const values = valueKeysOf(person);
  const signals = historySignals(person);
  const age = Math.max(0, Number(person.age) || 0);
  const stage = lifeStage(age);
  const needs = person.needs || {};
  const socialNeed = normalizedScore(needs.social, 65);
  const comfort = normalizedScore(needs.comfort, 70);
  const health = normalizedScore(person.health, 75);
  const energy = normalizedScore(person.energy, 70);
  const money = Number(person.money) || 0;
  const empathy = normalizedScore(person.personality?.empathy);
  const workEthic = normalizedScore(person.personality?.workEthic);
  const risk = normalizedScore(person.personality?.riskTolerance);
  const dependents = (person.children || []).length;
  const hasPartner = Boolean(person.partnerId);
  const incarcerated = Boolean(person.justice?.incarcerated);
  const unemployed = age >= 18 && /desempreg/i.test(String(person.role || ""));

  const valued = (key) => (hasKey(values, key) ? 18 : 0);
  const trait = (key) => (hasKey(traits, key) ? 12 : 0);
  const baseline = {
    connection: 30 + d.extraversion * 0.35 + d.agreeableness * 0.2 + valued("comunidade") + trait("soci"),
    family: 28 + d.agreeableness * 0.24 + empathy * 0.18 + valued("familia") + valued("tradicao") + Math.min(16, dependents * 4),
    achievement: 24 + d.conscientiousness * 0.3 + workEthic * 0.23 + valued("sucesso") + trait("ambicioso") + trait("metodico"),
    security: 28 + d.stability * 0.24 + d.conscientiousness * 0.18 + valued("seguranca") + trait("pratico"),
    autonomy: 25 + d.openness * 0.14 + risk * 0.18 + valued("independencia") + valued("liberdade"),
    mastery: 24 + d.openness * 0.3 + d.conscientiousness * 0.14 + valued("conhecimento") + trait("curioso") + trait("criativo"),
    novelty: 18 + d.openness * 0.34 + risk * 0.23 + trait("impulsivo") + trait("curioso"),
    care: 24 + empathy * 0.34 + d.agreeableness * 0.22 + valued("solidariedade") + valued("comunidade") + trait("gentil"),
    recognition: 18 + d.extraversion * 0.21 + workEthic * 0.16 + valued("sucesso") + trait("ambicioso"),
    wellbeing: 32 + d.stability * 0.15 + valued("seguranca"),
    identity: 22 + d.openness * 0.28 + valued("liberdade") + valued("independencia") + trait("criativo"),
    legacy: 12 + empathy * 0.15 + d.conscientiousness * 0.15 + valued("familia") + valued("comunidade"),
  };

  if (stage === "early_childhood" || stage === "childhood") {
    baseline.connection += 18;
    baseline.family += 18;
    baseline.mastery += 14;
    baseline.security += 12;
    baseline.achievement -= 14;
    baseline.legacy -= 10;
  } else if (stage === "adolescence") {
    baseline.identity += 25;
    baseline.connection += 13;
    baseline.autonomy += 14;
    baseline.mastery += 10;
  } else if (stage === "young_adulthood") {
    baseline.autonomy += 15;
    baseline.connection += 8;
    baseline.achievement += 10;
    baseline.identity += 8;
  } else if (stage === "maturity") {
    baseline.security += 8;
    baseline.family += 7;
    baseline.legacy += 12;
  } else if (stage === "later_life") {
    baseline.legacy += 30;
    baseline.family += 13;
    baseline.wellbeing += 16;
    baseline.achievement -= 8;
    baseline.novelty -= 5;
  }

  const urgency = {
    connection: clamp(100 - socialNeed + (signals.grief ? 18 : 0)),
    family: clamp((signals.grief || signals.familyMilestone ? 72 : 34) + (dependents ? 10 : 0)),
    achievement: clamp((unemployed ? 90 : 40) + (signals.careerChange ? 16 : 0)),
    security: clamp((money < 500 ? 92 : money < 2500 ? 66 : 32) + (signals.displacement || incarcerated ? 18 : 0)),
    autonomy: clamp((incarcerated ? 100 : person.housing === "family" && age >= 18 ? 66 : 35)),
    mastery: clamp(person.education?.enrolled ? 76 : stage === "adolescence" ? 65 : 38),
    novelty: clamp(100 - (previousMind?.patterns?.noveltyDays || 0) * 5, 25, 80),
    care: clamp(dependents ? 64 : signals.grief ? 62 : 36),
    recognition: clamp(50 - normalizedScore(person.notability?.score, 0) * 0.25 + (signals.achievement ? 14 : 0)),
    wellbeing: clamp((100 - health) * 0.8 + (100 - energy) * 0.35 + 22),
    identity: clamp(stage === "adolescence" ? 84 : stage === "young_adulthood" ? 62 : 34),
    legacy: clamp(stage === "later_life" ? 75 : stage === "maturity" ? 54 : 24),
  };

  const scored = Object.keys(MOTIVATION_LABELS).map((id) => ({
    id,
    label: MOTIVATION_LABELS[id],
    baseline: round(clamp(baseline[id], 5, 100)),
    urgency: round(clamp(urgency[id], 0, 100)),
    score: round(clamp(baseline[id] * 0.74 + urgency[id] * 0.26, 5, 100)),
  }));
  const total = scored.reduce((sum, item) => sum + item.score, 0) || 1;
  return scored
    .map((item) => ({ ...item, weight: round((item.score / total) * 100, 2) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

const deriveSocialPreferences = (person = {}) => {
  const d = dimensionsOf(person);
  const traits = traitKeysOf(person);
  const interests = (person.personality?.interests || []).filter(Boolean).slice(0, 4);
  const sociable = hasKey(traits, "soci");
  const reserved = hasKey(traits, "reservado");
  const sociability = clamp(d.extraversion + (sociable ? 15 : 0) - (reserved ? 18 : 0));
  const intimacyNeed = clamp(d.agreeableness * 0.55 + (100 - d.extraversion) * 0.18 + normalizedScore(person.personality?.empathy) * 0.27);
  const preferredTraits = [];
  if (d.agreeableness > 58) preferredTraits.push("gentil", "leal");
  if (d.openness > 60) preferredTraits.push("curioso", "criativo");
  if (d.conscientiousness > 62) preferredTraits.push("metódico", "prático");
  if (d.extraversion > 65) preferredTraits.push("sociável");
  const frictionTraits = [];
  if (d.stability < 42 || d.conscientiousness > 65) frictionTraits.push("impulsivo");
  if (d.extraversion > 72) frictionTraits.push("reservado");
  if (d.extraversion < 30) frictionTraits.push("sociável");
  return {
    sociability: round(sociability),
    preferredGroupSize: sociability >= 72 ? [4, 10] : sociability >= 45 ? [2, 6] : [1, 3],
    contactFrequency: sociability >= 70 ? "quase diária" : sociability >= 42 ? "algumas vezes por semana" : "semanal e seletiva",
    intimacyNeed: round(intimacyNeed),
    noveltyTolerance: round(clamp(d.openness * 0.65 + normalizedScore(person.personality?.riskTolerance) * 0.35)),
    trustPace: d.agreeableness > 68 && d.stability > 52 ? "rápido" : d.agreeableness < 38 ? "lento" : "gradual",
    conflictStyle: d.agreeableness > 68 ? "conciliador" : d.stability < 38 ? "reativo" : d.conscientiousness > 65 ? "negociador" : "direto",
    communicationStyle: reserved ? "reservado" : d.extraversion > 68 ? "expressivo" : d.agreeableness > 62 ? "acolhedor" : "objetivo",
    boundaries: intimacyNeed > 70 ? "busca confiança profunda" : sociability < 38 ? "preserva bastante espaço pessoal" : "equilibra proximidade e autonomia",
    preferredTraits: [...new Set(preferredTraits)].slice(0, 4),
    frictionTraits: [...new Set(frictionTraits)].slice(0, 3),
    preferredActivities: interests.length ? interests : sociability > 60 ? ["encontros sociais"] : ["atividades tranquilas"],
  };
};

const copingProfile = (person = {}) => {
  const d = dimensionsOf(person);
  const traits = traitKeysOf(person);
  const primary = d.extraversion > 65
    ? "buscar apoio social"
    : d.conscientiousness > 65
      ? "planejar e resolver"
      : d.openness > 65
        ? "criar e ressignificar"
        : d.stability > 60
          ? "aceitar e reorganizar"
          : hasKey(traits, "impulsivo")
            ? "agir imediatamente"
            : "recolher-se";
  const secondary = normalizedScore(person.personality?.empathy) > 62 ? "cuidar de alguém próximo" : d.openness > 55 ? "mudar de ambiente" : "manter a rotina";
  return {
    primary,
    secondary,
    effectiveness: round(clamp(d.stability * 0.48 + d.conscientiousness * 0.24 + normalizedScore(person.personality?.lifeSatisfaction, 60) * 0.28)),
  };
};

const profileSignature = (person = {}) => {
  const d = dimensionsOf(person);
  return [
    lifeStage(person.age),
    ...Object.values(d).map((value) => Math.round(value / 5) * 5),
    ...traitKeysOf(person).sort(),
    ...valueKeysOf(person).sort(),
  ].join("|");
};

const goalMetric = (type, person = {}) => {
  const social = normalizedScore(person.needs?.social, 60);
  const satisfaction = normalizedScore(person.personality?.lifeSatisfaction, person.happiness ?? 60);
  const wage = Math.max(0, Number(person.wage) || 0);
  const money = Math.max(0, Number(person.money) || 0);
  const educationProgress = person.education?.progress ?? person.education?.attendance ?? (person.education?.enrolled ? 35 : 0);
  switch (type) {
    case "education": return clamp(educationProgress);
    case "employment": return /desempreg/i.test(String(person.role || "")) ? 8 : wage > 0 ? 100 : 35;
    case "career_growth": return clamp(wage / 40 + normalizedScore(person.personality?.workEthic) * 0.35);
    case "financial_security": return clamp(Math.log10(money + 1) * 24);
    case "health_recovery": return normalizedScore(person.health, 70);
    case "wellbeing": return round((normalizedScore(person.health, 70) + normalizedScore(person.energy, 70) + normalizedScore(person.happiness, 60)) / 3);
    case "belonging": return round(social * 0.65 + clamp((person.friends || 0) * 8) * 0.35);
    case "relationship": return person.partnerId ? 100 : clamp(social * 0.6 + (person.friends || 0) * 4);
    case "family_care": return round(social * 0.45 + (person.children?.length || person.parents?.length ? 45 : 20));
    case "independence": return clamp((person.housing === "family" ? 20 : 65) + (person.mobility?.vehicleIds?.length ? 20 : 0) + Math.log10(money + 1) * 5);
    case "community": return clamp((person.notability?.score || 0) * 0.45 + social * 0.4);
    case "reputation": return clamp(person.notability?.score || 0);
    case "legacy": return clamp((person.notability?.legacy || 0) * 0.65 + (person.children?.length || 0) * 10 + satisfaction * 0.25);
    case "personal_growth": return satisfaction;
    default: return satisfaction;
  }
};

const motivationScore = (motivations, id) => motivations.find((entry) => entry.id === id)?.score || 0;

const goalCandidates = (person, motivations) => {
  const age = Math.max(0, Number(person.age) || 0);
  const candidates = [];
  const add = (type, motivationId, need, reason) => candidates.push({ type, motivationId, need: clamp(need), reason });
  const social = normalizedScore(person.needs?.social, 65);
  const health = normalizedScore(person.health, 75);
  const money = Number(person.money) || 0;
  const unemployed = age >= 18 && /desempreg/i.test(String(person.role || ""));

  if (health < 65) add("health_recovery", "wellbeing", 105 - health, "A saúde exige atenção agora.");
  if (person.education?.enrolled || (age >= 6 && age < 18)) add("education", "mastery", 82, "Os estudos estruturam esta fase da vida.");
  if (unemployed) add("employment", "achievement", 94, "Ter renda e função social tornou-se urgente.");
  if (age >= 18 && money < 3500) add("financial_security", "security", money < 500 ? 94 : 68, "Busca reduzir a vulnerabilidade financeira.");
  if (social < 48) add("belonging", "connection", 96 - social, "Sente falta de vínculos e convivência.");
  if (age >= 18 && !unemployed) add("career_growth", "achievement", motivationScore(motivations, "achievement"), "Quer transformar esforço em progresso.");
  if (age >= 18 && !person.partnerId && motivationScore(motivations, "connection") > 52) add("relationship", "connection", motivationScore(motivations, "connection"), "Deseja construir intimidade e companhia.");
  if ((person.children || []).length || (person.parents || []).length) add("family_care", "family", motivationScore(motivations, "family"), "A família ocupa lugar central em suas escolhas.");
  if (age >= 18 && person.housing === "family") add("independence", "autonomy", motivationScore(motivations, "autonomy") + 8, "Procura ampliar seu espaço de decisão.");
  add("personal_growth", "mastery", motivationScore(motivations, "mastery"), "Quer cultivar competência e sentido pessoal.");
  if (motivationScore(motivations, "care") > 58) add("community", "care", motivationScore(motivations, "care"), "Deseja ser útil para além do círculo doméstico.");
  if (motivationScore(motivations, "recognition") > 58) add("reputation", "recognition", motivationScore(motivations, "recognition"), "Quer que seu trabalho seja reconhecido.");
  if (age >= 55) add("legacy", "legacy", motivationScore(motivations, "legacy") + 12, "Pensa no que permanecerá depois de si.");
  if (health >= 65) add("wellbeing", "wellbeing", motivationScore(motivations, "wellbeing"), "Busca sustentar uma vida equilibrada.");

  return candidates.sort((a, b) => b.need - a.need || a.type.localeCompare(b.type));
};

const makeGoal = (person, template, serial, context = {}) => {
  const week = Math.max(0, Math.floor(Number(context.week) || 0));
  const metric = goalMetric(template.type, person);
  const horizon = ["health_recovery", "employment", "belonging"].includes(template.type) ? 13 : ["legacy", "career_growth", "financial_security"].includes(template.type) ? 104 : 52;
  return {
    id: `goal:${String(person.id || "person")}:${template.type}:${serial}`,
    type: template.type,
    title: GOAL_LABELS[template.type] || template.type,
    motivationId: template.motivationId,
    reason: template.reason,
    priority: round(template.need),
    progress: round(clamp(metric * 0.35, 0, 92)),
    status: "active",
    createdWeek: week,
    targetWeek: week + horizon,
    lastProgressWeek: week,
    lastMetric: round(metric),
    milestones: [],
  };
};

const initialGoals = (person, motivations, context = {}) => {
  const count = Math.max(2, Math.min(CHARACTER_MIND_LIMITS.activeGoals, Number(context.initialGoalCount) || 3));
  return goalCandidates(person, motivations)
    .filter((candidate, index, array) => array.findIndex((other) => other.type === candidate.type) === index)
    .slice(0, count)
    .map((template, index) => makeGoal(person, template, index, context));
};

const normalizeEmotion = (emotional = {}, person = {}) => {
  const happiness = normalizedScore(person.happiness, 60);
  const valence = clamp(emotional.valence ?? happiness * 2 - 100, -100, 100);
  const stress = clamp(emotional.stress ?? Math.max(0, 55 - dimensionsOf(person).stability * 0.35));
  const arousal = clamp(emotional.arousal ?? 35 + stress * 0.25);
  return {
    valence: round(valence),
    arousal: round(arousal),
    stress: round(stress),
    resilience: round(clamp(emotional.resilience ?? dimensionsOf(person).stability * 0.55 + normalizedScore(person.personality?.lifeSatisfaction, 60) * 0.25 + 10)),
    dominant: String(emotional.dominant || emotionLabel(valence, arousal, stress)),
    trend: String(emotional.trend || "estável"),
    regulation: String(emotional.regulation || "regulada"),
    updatedWeek: Math.max(0, Math.floor(Number(emotional.updatedWeek) || 0)),
    updatedDay: clamp(Math.floor(Number(emotional.updatedDay) || 0), 0, 6),
  };
};

const emotionLabel = (valence, arousal, stress) => {
  if (stress >= 82 && valence < -35) return arousal >= 65 ? "angústia" : "esgotamento";
  if (stress >= 68) return valence < -20 ? "tensão" : "sobrecarga";
  if (valence <= -60) return arousal >= 55 ? "irritação" : "tristeza";
  if (valence <= -25) return arousal >= 60 ? "inquietação" : "melancolia";
  if (valence >= 65) return arousal >= 60 ? "entusiasmo" : "alegria serena";
  if (valence >= 25) return arousal >= 65 ? "animação" : "contentamento";
  return arousal < 35 ? "calma" : "neutralidade atenta";
};

const normalizeMemory = (memory = {}, fallbackDay = 0) => ({
  id: String(memory.id || `memory:legacy:${stringHash(JSON.stringify(memory))}`),
  kind: String(memory.kind || memory.category || "cotidiano"),
  summary: String(memory.summary || memory.text || "Lembrança sem descrição"),
  week: Math.max(0, Math.floor(Number(memory.week) || 0)),
  day: clamp(Math.floor(Number(memory.day) || 0), 0, 6),
  absoluteDay: Math.max(0, Math.floor(Number(memory.absoluteDay) || fallbackDay)),
  valence: round(clamp(memory.valence ?? 0, -100, 100)),
  salience: round(clamp(memory.salience ?? 35)),
  strength: round(clamp(memory.strength ?? memory.salience ?? 35)),
  accessibility: round(clamp(memory.accessibility ?? memory.strength ?? memory.salience ?? 35)),
  core: Boolean(memory.core),
  occurrenceCount: Math.max(1, Math.floor(Number(memory.occurrenceCount) || 1)),
  actorIds: [...new Set((memory.actorIds || memory.peopleIds || []).filter(Boolean).map(String))].slice(0, 8),
  placeId: memory.placeId == null ? null : String(memory.placeId),
  goalId: memory.goalId == null ? null : String(memory.goalId),
  tags: [...new Set((memory.tags || []).filter(Boolean).map((tag) => textKey(tag)))].slice(0, 8),
  lastRecalledDay: Math.max(0, Math.floor(Number(memory.lastRecalledDay) || memory.absoluteDay || fallbackDay)),
  lastDecayDay: Math.max(0, Math.floor(Number(memory.lastDecayDay) || memory.absoluteDay || fallbackDay)),
});

const normalizeGoal = (goal = {}, person = {}, index = 0, context = {}) => {
  const type = String(goal.type || "personal_growth");
  const week = Math.max(0, Math.floor(Number(context.week) || 0));
  return {
    id: String(goal.id || `goal:${String(person.id || "person")}:${type}:${index}`),
    type,
    title: String(goal.title || GOAL_LABELS[type] || type),
    motivationId: String(goal.motivationId || "wellbeing"),
    reason: String(goal.reason || "Este objetivo expressa uma prioridade pessoal."),
    priority: round(clamp(goal.priority ?? 50)),
    progress: round(clamp(goal.progress ?? 0)),
    status: ["active", "completed", "abandoned", "blocked"].includes(goal.status) ? goal.status : "active",
    createdWeek: Math.max(0, Math.floor(Number(goal.createdWeek) || week)),
    targetWeek: Math.max(0, Math.floor(Number(goal.targetWeek) || week + 52)),
    lastProgressWeek: Math.max(0, Math.floor(Number(goal.lastProgressWeek) || week)),
    lastMetric: round(clamp(goal.lastMetric ?? goalMetric(type, person))),
    milestones: (goal.milestones || []).filter(Boolean).slice(-6).map((milestone) => ({
      week: Math.max(0, Math.floor(Number(milestone.week) || week)),
      progress: round(clamp(milestone.progress ?? 0)),
      text: String(milestone.text || "Progresso significativo"),
    })),
  };
};

/** Cria o estado mental inicial de forma determinística para o mesmo cidadão. */
export function initializeCharacterMind(person = {}, context = {}) {
  const motivations = deriveMotivations(person, null, context);
  const seed = person.id || person.name || "cidadão";
  const initialValence = clamp((normalizedScore(person.happiness, 60) * 2 - 100) + (stableUnit(seed, "mood") - 0.5) * 12, -100, 100);
  const initialStress = clamp(42 - dimensionsOf(person).stability * 0.28 + (stableUnit(seed, "stress") - 0.5) * 10);
  const goals = initialGoals(person, motivations, context);
  return {
    version: CHARACTER_MIND_VERSION,
    profileSignature: profileSignature(person),
    lifeStage: lifeStage(person.age),
    motivations,
    emotional: normalizeEmotion({ valence: initialValence, stress: initialStress }, person),
    goals,
    memories: [],
    socialPreferences: deriveSocialPreferences(person),
    coping: copingProfile(person),
    patterns: {
      positiveDays: 0,
      difficultDays: 0,
      socialDays: 0,
      productiveDays: 0,
      noveltyDays: 0,
      consecutiveStressDays: 0,
    },
    lastDailyKey: null,
    lastWeeklyWeek: null,
    memorySerial: 0,
    goalSerial: goals.length,
    revision: 0,
  };
}

/** Repara saves antigos ou incompletos e sempre devolve uma cópia válida. */
export function normalizeCharacterMind(mind, person = {}, context = {}) {
  if (!mind || typeof mind !== "object") return initializeCharacterMind(person, context);
  if (
    context.trusted === true &&
    mind.version === CHARACTER_MIND_VERSION &&
    mind.profileSignature === profileSignature(person) &&
    mind.emotional &&
    Array.isArray(mind.motivations) &&
    Array.isArray(mind.goals) &&
    mind.goals.length <= CHARACTER_MIND_LIMITS.activeGoals + CHARACTER_MIND_LIMITS.archivedGoals &&
    Array.isArray(mind.memories) &&
    mind.memories.length <= CHARACTER_MIND_LIMITS.memories &&
    mind.socialPreferences &&
    mind.coping &&
    mind.patterns
  ) return mind;
  const fallbackDay = absoluteDayOf(context);
  const hasPersonProfile = Boolean(person && Object.keys(person).length);
  const signature = hasPersonProfile ? profileSignature(person) : String(mind.profileSignature || "unknown");
  const profileChanged = hasPersonProfile && mind.profileSignature !== signature;
  const motivations = profileChanged
    ? deriveMotivations(person, mind, context)
    : Array.isArray(mind.motivations) && mind.motivations.length
      ? mind.motivations.map((item, index) => ({
          id: String(item.id || "wellbeing"),
          label: String(item.label || MOTIVATION_LABELS[item.id] || item.id || "Bem-estar"),
          baseline: round(clamp(item.baseline ?? 50)),
          urgency: round(clamp(item.urgency ?? 40)),
          score: round(clamp(item.score ?? 50)),
          weight: round(clamp(item.weight ?? 0, 0, 100), 2),
          rank: Math.max(1, Math.floor(Number(item.rank) || index + 1)),
        })).sort((a, b) => b.score - a.score)
      : deriveMotivations(person, mind, context);
  const normalizedMemories = (mind.memories || [])
    .map((memory) => normalizeMemory(memory, fallbackDay))
    .sort((a, b) => b.absoluteDay - a.absoluteDay || b.salience - a.salience)
    .slice(0, CHARACTER_MIND_LIMITS.memories);
  const memories = trimMemories(normalizedMemories, fallbackDay);
  const normalizedGoals = (Array.isArray(mind.goals) && mind.goals.length ? mind.goals : initialGoals(person, motivations, context))
    .map((goal, index) => normalizeGoal(goal, person, index, context))
    .slice(0, CHARACTER_MIND_LIMITS.activeGoals + CHARACTER_MIND_LIMITS.archivedGoals);
  const goals = [
    ...normalizedGoals.filter((goal) => goal.status === "active").sort((a, b) => b.priority - a.priority).slice(0, CHARACTER_MIND_LIMITS.activeGoals),
    ...normalizedGoals.filter((goal) => goal.status !== "active").sort((a, b) => b.lastProgressWeek - a.lastProgressWeek).slice(0, CHARACTER_MIND_LIMITS.archivedGoals),
  ];
  const inferredMemorySerial = memories.reduce((highest, memory) => {
    const suffix = Number(memory.id.split(":").at(-1));
    return Number.isFinite(suffix) ? Math.max(highest, suffix + 1) : highest;
  }, memories.length);
  const patterns = mind.patterns || {};
  const hasCompleteSocialPreferences = mind.socialPreferences &&
    Number.isFinite(Number(mind.socialPreferences.sociability)) &&
    Array.isArray(mind.socialPreferences.preferredGroupSize) &&
    Array.isArray(mind.socialPreferences.preferredTraits) &&
    Array.isArray(mind.socialPreferences.preferredActivities);
  const socialPreferences = profileChanged || !hasCompleteSocialPreferences
    ? deriveSocialPreferences(person)
    : {
        ...mind.socialPreferences,
        preferredGroupSize: [...mind.socialPreferences.preferredGroupSize].slice(0, 2),
        preferredTraits: [...mind.socialPreferences.preferredTraits].slice(0, 4),
        frictionTraits: [...(mind.socialPreferences.frictionTraits || [])].slice(0, 3),
        preferredActivities: [...mind.socialPreferences.preferredActivities].slice(0, 4),
      };
  const coping = profileChanged || !mind.coping?.primary
    ? copingProfile(person)
    : { ...mind.coping, effectiveness: round(clamp(mind.coping.effectiveness ?? 50)) };
  return {
    version: CHARACTER_MIND_VERSION,
    profileSignature: signature,
    lifeStage: hasPersonProfile ? lifeStage(person.age) : String(mind.lifeStage || "adulthood"),
    motivations,
    emotional: normalizeEmotion(mind.emotional, person),
    goals,
    memories,
    socialPreferences,
    coping,
    patterns: {
      positiveDays: Math.max(0, Math.floor(Number(patterns.positiveDays) || 0)),
      difficultDays: Math.max(0, Math.floor(Number(patterns.difficultDays) || 0)),
      socialDays: Math.max(0, Math.floor(Number(patterns.socialDays) || 0)),
      productiveDays: Math.max(0, Math.floor(Number(patterns.productiveDays) || 0)),
      noveltyDays: Math.max(0, Math.floor(Number(patterns.noveltyDays) || 0)),
      consecutiveStressDays: Math.max(0, Math.floor(Number(patterns.consecutiveStressDays) || 0)),
    },
    lastDailyKey: mind.lastDailyKey == null ? null : String(mind.lastDailyKey),
    lastWeeklyWeek: mind.lastWeeklyWeek == null ? null : Math.max(0, Math.floor(Number(mind.lastWeeklyWeek) || 0)),
    memorySerial: Math.max(inferredMemorySerial, Math.floor(Number(mind.memorySerial) || 0)),
    goalSerial: Math.max(goals.length, Math.floor(Number(mind.goalSerial) || 0)),
    revision: Math.max(0, Math.floor(Number(mind.revision) || 0)),
  };
}

const episodeSalience = (episode = {}) => {
  if (Number.isFinite(Number(episode.salience))) return clamp(episode.salience);
  let valence = Number(episode.valence) || 0;
  if (Math.abs(valence) <= 1) valence *= 100;
  const importance = clamp(episode.importance ?? 45);
  const stress = clamp(episode.stressImpact ?? episode.stress ?? 0);
  const novelty = clamp(episode.novelty ?? 45);
  const directness = episode.direct === false ? 15 : 75;
  const relationship = clamp(episode.relationshipImportance ?? 0);
  const goalRelevance = episode.goalId ? 75 : clamp(episode.goalRelevance ?? 0);
  return clamp(importance * 0.31 + Math.abs(valence) * 0.21 + stress * 0.17 + novelty * 0.1 + directness * 0.08 + relationship * 0.07 + goalRelevance * 0.06);
};

const memoryFingerprint = (memory) => {
  const summary = textKey(memory.summary).split(" ").slice(0, 10).join(" ");
  return `${textKey(memory.kind)}|${summary}|${[...memory.actorIds].sort().join(",")}|${memory.placeId || ""}`;
};

const trimMemories = (memories, nowDay) => {
  const retention = (memory) => {
    const age = Math.max(0, nowDay - memory.absoluteDay);
    return memory.strength * 0.42 + memory.salience * 0.35 + memory.accessibility * 0.18 - Math.min(30, age * 0.035) + (memory.core ? 45 : 0);
  };
  const core = memories.filter((memory) => memory.core).sort((a, b) => retention(b) - retention(a)).slice(0, CHARACTER_MIND_LIMITS.coreMemories);
  const remaining = memories
    .filter((memory) => !memory.core)
    .sort((a, b) => retention(b) - retention(a))
    .slice(0, CHARACTER_MIND_LIMITS.memories - core.length);
  return [...core, ...remaining].sort((a, b) => b.absoluteDay - a.absoluteDay || b.salience - a.salience);
};

/** Registra ou reforça uma lembrança; episódios repetidos não criam spam. */
export function recordMemory(mind, episode = {}, context = {}) {
  const state = normalizeCharacterMind(mind, context.person || {}, context);
  const nowDay = absoluteDayOf({ ...context, ...episode });
  let valence = Number(episode.valence) || 0;
  if (Math.abs(valence) <= 1 && valence !== 0) valence *= 100;
  const tags = [...new Set((episode.tags || []).map(textKey).filter(Boolean))];
  const salience = episodeSalience({ ...episode, valence });
  const core = Boolean(episode.core) || salience >= 84 || tags.some((tag) => CORE_TAGS.has(tag));
  const memory = normalizeMemory({
    id: `memory:${String(context.person?.id || "person")}:${state.memorySerial}`,
    kind: episode.kind || episode.category || "cotidiano",
    summary: episode.summary || episode.text || "Algo significativo aconteceu.",
    week: episode.week ?? context.week,
    day: episode.day ?? context.day,
    absoluteDay: nowDay,
    valence,
    salience,
    strength: clamp(salience * 0.85 + (core ? 15 : 0)),
    accessibility: clamp(salience + 8),
    core,
    actorIds: episode.actorIds || episode.peopleIds || [],
    placeId: episode.placeId ?? null,
    goalId: episode.goalId ?? null,
    tags,
    lastRecalledDay: nowDay,
    lastDecayDay: nowDay,
  }, nowDay);
  const fingerprint = memoryFingerprint(memory);
  const duplicateIndex = state.memories.findIndex((candidate) =>
    memoryFingerprint(candidate) === fingerprint && Math.abs(nowDay - candidate.absoluteDay) <= (Number(episode.mergeWindowDays) || 14));
  let memories;
  let serial = state.memorySerial;
  if (duplicateIndex >= 0) {
    memories = state.memories.map((candidate, index) => index !== duplicateIndex ? candidate : {
      ...candidate,
      week: memory.week,
      day: memory.day,
      absoluteDay: nowDay,
      valence: round((candidate.valence * candidate.occurrenceCount + memory.valence) / (candidate.occurrenceCount + 1)),
      salience: round(Math.max(candidate.salience, memory.salience)),
      strength: round(clamp(candidate.strength + memory.salience * 0.18)),
      accessibility: round(clamp(Math.max(candidate.accessibility, memory.salience) + 8)),
      core: candidate.core || memory.core,
      occurrenceCount: candidate.occurrenceCount + 1,
      tags: [...new Set([...candidate.tags, ...memory.tags])].slice(0, 8),
      lastRecalledDay: nowDay,
      lastDecayDay: nowDay,
    });
  } else {
    memories = [memory, ...state.memories];
    serial += 1;
  }
  return {
    ...state,
    memories: trimMemories(memories, nowDay),
    memorySerial: serial,
    revision: state.revision + 1,
  };
}

const decayMemories = (memories, nowDay, person) => {
  const stability = dimensionsOf(person).stability;
  return memories
    .map((memory) => {
      const elapsed = Math.max(0, nowDay - memory.lastDecayDay);
      if (!elapsed) return { ...memory };
      const rate = (memory.core ? 0.04 : 0.16) * (1.1 - stability / 250);
      const floor = memory.core ? 32 : 0;
      return {
        ...memory,
        accessibility: round(Math.max(floor, memory.accessibility - elapsed * rate)),
        strength: round(Math.max(floor, memory.strength - elapsed * rate * 0.28)),
        lastDecayDay: nowDay,
      };
    })
    .filter((memory) => memory.core || memory.accessibility >= 5 || nowDay - memory.absoluteDay < 35);
};

const eventImpacts = (events = []) => {
  let valence = 0;
  let stress = 0;
  let arousal = 0;
  let weight = 0;
  events.slice(0, CHARACTER_MIND_LIMITS.eventBatch).forEach((event) => {
    let eventValence = Number(event.valence) || 0;
    if (Math.abs(eventValence) <= 1 && eventValence !== 0) eventValence *= 100;
    const importance = clamp(event.importance ?? 40) / 100;
    valence += eventValence * (0.35 + importance);
    stress += clamp(event.stressImpact ?? event.stress ?? 0) * (0.3 + importance);
    arousal += clamp(event.arousal ?? Math.abs(eventValence) * 0.6) * (0.25 + importance);
    weight += 0.35 + importance;
  });
  return weight ? { valence: valence / weight, stress: stress / weight, arousal: arousal / weight } : { valence: 0, stress: 0, arousal: 0 };
};

const dailyStressTarget = (person, state, impacts, context) => {
  const needs = person.needs || {};
  const deprivation = [needs.hunger, needs.social, needs.hygiene, needs.comfort]
    .map((value) => 100 - normalizedScore(value, 70))
    .reduce((sum, value) => sum + value, 0) / 4;
  const medicalBurden = (person.medical?.activeConditions || person.medical?.conditions || []).length * 7;
  const grief = (person.bereavement?.active || []).length * 11;
  const justice = person.justice?.incarcerated ? 24 : person.justice?.wanted ? 16 : 0;
  const finance = Number(person.money) < 0 ? 22 : Number(person.money) < 400 ? 12 : 0;
  const work = person.shift?.hours > 44 ? (person.shift.hours - 44) * 1.1 : 0;
  const lowEnergy = Math.max(0, 45 - normalizedScore(person.energy, 70)) * 0.65;
  const lowHealth = Math.max(0, 55 - normalizedScore(person.health, 75)) * 0.55;
  const support = normalizedScore(needs.social, 65) * 0.12 + normalizedScore(needs.comfort, 70) * 0.06;
  const resilience = state.emotional.resilience * 0.18 + state.coping.effectiveness * 0.12;
  return clamp(18 + deprivation * 0.38 + medicalBurden + grief + justice + finance + work + lowEnergy + lowHealth + impacts.stress * 0.45 + (Number(context.externalStress) || 0) - support - resilience);
};

const dailyValenceTarget = (person, state, impacts, stress) => {
  const needs = person.needs || {};
  const needAverage = [needs.hunger, needs.social, needs.hygiene, needs.comfort]
    .map((value) => normalizedScore(value, 70))
    .reduce((sum, value) => sum + value, 0) / 4;
  return clamp(
    (normalizedScore(person.happiness, 60) * 2 - 100) * 0.52 +
      (needAverage * 2 - 100) * 0.18 +
      (normalizedScore(person.health, 75) * 2 - 100) * 0.12 +
      impacts.valence * 0.35 -
      stress * 0.22,
    -100,
    100,
  );
};

/** Atualização idempotente por dia. Eventos relevantes viram memórias. */
export function updateCharacterMindDaily(mind, person = {}, context = {}) {
  let state = normalizeCharacterMind(mind, person, context);
  const key = dayKeyOf(context);
  if (!context.force && state.lastDailyKey === key) return state;
  if (person.alive === false) return { ...state, lastDailyKey: key };
  const events = Array.isArray(context.events) ? context.events.slice(0, CHARACTER_MIND_LIMITS.eventBatch) : [];
  events.forEach((event) => {
    if (event.remember === false) return;
    if (episodeSalience(event) < (Number(event.memoryThreshold) || 34)) return;
    state = recordMemory(state, event, { ...context, person });
  });
  const impacts = eventImpacts(events);
  const stressTarget = dailyStressTarget(person, state, impacts, context);
  const old = state.emotional;
  const stress = clamp(old.stress * 0.68 + stressTarget * 0.32);
  const valenceTarget = dailyValenceTarget(person, state, impacts, stress);
  const valence = clamp(old.valence * 0.62 + valenceTarget * 0.38, -100, 100);
  const arousalTarget = clamp(25 + stress * 0.44 + impacts.arousal * 0.35 + (100 - normalizedScore(person.energy, 70)) * 0.16);
  const arousal = clamp(old.arousal * 0.64 + arousalTarget * 0.36);
  const trendDelta = valence - old.valence;
  const actionCategory = textKey(context.actionCategory ?? person.currentAction?.category ?? person.activity);
  const socialDay = events.some((event) => ["social", "familia", "relacionamento"].includes(textKey(event.kind || event.category))) || actionCategory.includes("social");
  const productiveDay = ["work", "trabalho", "study", "estudo"].some((keyPart) => actionCategory.includes(keyPart));
  const noveltyDay = events.some((event) => clamp(event.novelty ?? 0) >= 65);
  const nowDay = absoluteDayOf(context);
  const memories = trimMemories(decayMemories(state.memories, nowDay, person), nowDay);
  const patterns = {
    positiveDays: state.patterns.positiveDays + (valence >= 25 ? 1 : 0),
    difficultDays: state.patterns.difficultDays + (valence <= -30 || stress >= 70 ? 1 : 0),
    socialDays: state.patterns.socialDays + (socialDay ? 1 : 0),
    productiveDays: state.patterns.productiveDays + (productiveDay ? 1 : 0),
    noveltyDays: state.patterns.noveltyDays + (noveltyDay ? 1 : 0),
    consecutiveStressDays: stress >= 70 ? state.patterns.consecutiveStressDays + 1 : 0,
  };
  return {
    ...state,
    emotional: {
      ...old,
      valence: round(valence),
      stress: round(stress),
      arousal: round(arousal),
      dominant: emotionLabel(valence, arousal, stress),
      trend: trendDelta > 4 ? "melhorando" : trendDelta < -4 ? "piorando" : "estável",
      regulation: stress >= 82 ? "no limite" : stress >= 65 ? "sobrecarregada" : state.coping.effectiveness >= 62 ? "bem regulada" : "oscilante",
      updatedWeek: Math.max(0, Math.floor(Number(context.week) || 0)),
      updatedDay: clamp(Math.floor(Number(context.day) || 0), 0, 6),
    },
    memories,
    patterns,
    lastDailyKey: key,
    revision: state.revision + 1,
  };
}

const milestoneText = (goal, progress) => {
  if (progress >= 100) return `${goal.title} foi alcançado.`;
  if (progress >= 75) return `${goal.title} entrou na reta final.`;
  if (progress >= 50) return `${goal.title} chegou à metade do caminho.`;
  if (progress >= 25) return `${goal.title} ganhou forma concreta.`;
  return `Deu os primeiros passos em: ${goal.title.toLowerCase()}.`;
};

const updateGoals = (state, person, context) => {
  const week = Math.max(0, Math.floor(Number(context.week) || 0));
  const explicitDeltas = context.goalDeltas || {};
  const completed = [];
  let goals = state.goals.map((goal) => {
    if (goal.status !== "active") return { ...goal };
    const metric = goalMetric(goal.type, person);
    const metricDelta = metric - goal.lastMetric;
    const explicit = Number(explicitDeltas[goal.id] ?? explicitDeltas[goal.type]) || 0;
    const aligned = (context.achievements || []).filter((achievement) =>
      achievement.goalId === goal.id || achievement.type === goal.type || achievement.motivationId === goal.motivationId).length;
    const stalledPenalty = week > goal.targetWeek && goal.progress < 65 ? -1.5 : 0;
    const delta = metricDelta * 0.42 + explicit + aligned * 4 + 0.35 + stalledPenalty;
    const progress = clamp(goal.progress + delta);
    const crossed = [25, 50, 75, 100].find((threshold) => goal.progress < threshold && progress >= threshold);
    const milestones = crossed
      ? [...goal.milestones, { week, progress: crossed, text: milestoneText(goal, crossed) }].slice(-6)
      : [...goal.milestones];
    const status = progress >= 100 ? "completed" : week > goal.targetWeek + 26 && progress < 35 ? "blocked" : "active";
    const currentDrive = motivationScore(state.motivations, goal.motivationId);
    const next = {
      ...goal,
      priority: round(clamp(goal.priority * 0.72 + currentDrive * 0.28)),
      progress: round(progress),
      status,
      lastProgressWeek: delta > 0.2 ? week : goal.lastProgressWeek,
      lastMetric: round(metric),
      milestones,
    };
    if (status === "completed") completed.push(next);
    return next;
  });

  const activeTypes = new Set(goals.filter((goal) => goal.status === "active").map((goal) => goal.type));
  const slots = CHARACTER_MIND_LIMITS.activeGoals - activeTypes.size;
  let serial = state.goalSerial;
  if (slots > 0) {
    const candidates = goalCandidates(person, state.motivations)
      .filter((candidate) => !activeTypes.has(candidate.type))
      .filter((candidate) => !goals.some((goal) => goal.type === candidate.type && goal.status === "completed" && week - goal.lastProgressWeek < 52))
      .slice(0, slots);
    const additions = candidates.map((candidate) => makeGoal(person, candidate, serial++, context));
    goals = [...goals, ...additions];
  }
  const active = goals.filter((goal) => goal.status === "active").sort((a, b) => b.priority - a.priority).slice(0, CHARACTER_MIND_LIMITS.activeGoals);
  const archive = goals.filter((goal) => goal.status !== "active").sort((a, b) => b.lastProgressWeek - a.lastProgressWeek).slice(0, CHARACTER_MIND_LIMITS.archivedGoals);
  return { goals: [...active, ...archive], goalSerial: serial, completed };
};

/** Consolida experiência, reavalia prioridades e progride objetivos uma vez por semana. */
export function updateCharacterMindWeekly(mind, person = {}, context = {}) {
  let state = normalizeCharacterMind(mind, person, context);
  const week = Math.max(0, Math.floor(Number(context.week) || 0));
  if (!context.force && state.lastWeeklyWeek === week) return state;
  if (person.alive === false) return { ...state, lastWeeklyWeek: week };
  const motivations = deriveMotivations(person, state, context);
  state = { ...state, motivations };
  const result = updateGoals(state, person, context);
  state = { ...state, goals: result.goals, goalSerial: result.goalSerial };
  result.completed.forEach((goal) => {
    state = recordMemory(state, {
      kind: "conquista",
      summary: goal.milestones.at(-1)?.text || `${goal.title} foi alcançado.`,
      week,
      day: context.day ?? 0,
      valence: 82,
      importance: 78,
      novelty: 72,
      goalId: goal.id,
      tags: ["conquista", goal.type],
    }, { ...context, person });
  });
  const satisfaction = normalizedScore(person.personality?.lifeSatisfaction, person.happiness ?? 60);
  const resilienceTarget = clamp(dimensionsOf(person).stability * 0.48 + state.coping.effectiveness * 0.25 + satisfaction * 0.17 + (state.patterns.positiveDays > state.patterns.difficultDays ? 8 : 0));
  return {
    ...state,
    motivations,
    emotional: {
      ...state.emotional,
      resilience: round(state.emotional.resilience * 0.8 + resilienceTarget * 0.2),
    },
    lastWeeklyWeek: week,
    revision: state.revision + 1,
  };
}

/** Recupera lembranças por acessibilidade e correspondência de pistas. */
export function recallMemories(mind, cues = {}, limit = 5) {
  if (!mind || !Array.isArray(mind.memories)) return [];
  const actorIds = new Set((cues.actorIds || cues.peopleIds || []).map(String));
  const tags = new Set((cues.tags || []).map(textKey));
  const kind = textKey(cues.kind || "");
  const placeId = cues.placeId == null ? null : String(cues.placeId);
  const emotionalCongruence = Number(cues.valence);
  const scored = mind.memories.map((raw) => {
    const memory = normalizeMemory(raw);
    let cueScore = memory.accessibility * 0.42 + memory.salience * 0.28 + memory.strength * 0.2 + (memory.core ? 12 : 0);
    if (actorIds.size && memory.actorIds.some((id) => actorIds.has(id))) cueScore += 26;
    if (tags.size && memory.tags.some((tag) => tags.has(tag))) cueScore += 18;
    if (kind && textKey(memory.kind) === kind) cueScore += 14;
    if (placeId && memory.placeId === placeId) cueScore += 12;
    if (Number.isFinite(emotionalCongruence) && Math.sign(emotionalCongruence) === Math.sign(memory.valence)) cueScore += 8;
    return { memory, cueScore };
  });
  return scored
    .sort((a, b) => b.cueScore - a.cueScore || b.memory.absoluteDay - a.memory.absoluteDay)
    .slice(0, clamp(Math.floor(Number(limit) || 5), 1, 20))
    .map(({ memory, cueScore }) => ({ ...memory, recallScore: round(cueScore) }));
}

/**
 * Afinidade psicológica provável (0–100), sem substituir a relação vivida.
 * `otherMind` é opcional: quando ausente, suas preferências são derivadas.
 */
export function scoreSocialFit(mind, otherPerson = {}, otherMind = null, context = {}) {
  const preferences = mind?.socialPreferences || {};
  const otherPreferences = otherMind?.socialPreferences || deriveSocialPreferences(otherPerson);
  const otherTraits = traitKeysOf(otherPerson);
  const ownInterests = new Set((preferences.preferredActivities || []).map(textKey));
  const otherInterests = interestKeysOf(otherPerson);
  const interestMatches = otherInterests.filter((interest) => ownInterests.has(interest)).length;
  const desired = (preferences.preferredTraits || []).map(textKey);
  const friction = (preferences.frictionTraits || []).map(textKey);
  const traitBonus = desired.filter((trait) => hasKey(otherTraits, trait)).length * 7;
  const traitPenalty = friction.filter((trait) => hasKey(otherTraits, trait)).length * 9;
  const sociabilityGap = Math.abs(normalizedScore(preferences.sociability) - normalizedScore(otherPreferences.sociability));
  const intimacyGap = Math.abs(normalizedScore(preferences.intimacyNeed) - normalizedScore(otherPreferences.intimacyNeed));
  const familiarity = clamp(context.familiarity ?? context.affinity ?? 40);
  const trust = clamp(context.trust ?? familiarity);
  const situational = Number(context.situationalBonus) || 0;
  return round(clamp(58 - sociabilityGap * 0.16 - intimacyGap * 0.1 + interestMatches * 8 + traitBonus - traitPenalty + familiarity * 0.14 + trust * 0.1 + situational));
}
