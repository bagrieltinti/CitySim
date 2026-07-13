const clamp = (value, minimum = 0, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));

const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const shared = (left = [], right = []) => left.filter((value) => right.includes(value));
const mindStress = (person) => person.mind?.emotional?.stress ?? person.mind?.state?.stress ?? 35;

const traitFriction = (a, b) => {
  const pairs = [
    ["impulsivo", "metódico"],
    ["sociável", "reservado"],
    ["paciente", "impulsivo"],
  ];
  return pairs.reduce(
    (total, [first, second]) =>
      total +
      (a.traits?.includes(first) && b.traits?.includes(second) ? 1 : 0) +
      (b.traits?.includes(first) && a.traits?.includes(second) ? 1 : 0),
    0,
  );
};

export function ensureRelationshipDepth(link) {
  if (!link) return null;
  link.trust = clamp(link.trust ?? 20);
  link.affinity = clamp(link.affinity ?? 0, -100, 100);
  link.respect = clamp(link.respect ?? Math.max(12, link.trust * 0.72));
  link.tension = clamp(link.tension ?? Math.max(0, -link.affinity * 0.45));
  link.familiarity = clamp(link.familiarity ?? Math.min(100, (link.interactions || 0) * 3 + 10));
  link.reciprocity = clamp(link.reciprocity ?? 50);
  link.supportCount ||= 0;
  link.conflictCount ||= 0;
  link.favorBalance ||= 0;
  link.sharedExperiences ||= [];
  link.sharedMemoryIds ||= [];
  link.contextCounts ||= {};
  link.views ||= {};
  link.history ||= [];
  return link;
}

export function socialCompatibility(a, b, link = null) {
  const ad = a.personality?.dimensions || {};
  const bd = b.personality?.dimensions || {};
  const dimensionSimilarity =
    1 -
    average(
      ["openness", "conscientiousness", "extraversion", "agreeableness", "stability"].map(
        (dimension) => Math.abs((ad[dimension] ?? 50) - (bd[dimension] ?? 50)) / 100,
      ),
    );
  const commonInterests = shared(a.personality?.interests, b.personality?.interests).length;
  const commonValues = shared(a.personality?.values, b.personality?.values).length;
  const emotionalLoad = (mindStress(a) + mindStress(b)) / 200;
  const rememberedEpisodes = (a.mind?.memories || [])
    .filter((memory) => memory.actorIds?.includes(b.id) || memory.peopleIds?.includes(b.id))
    .slice(0, 4);
  const rememberedTone = rememberedEpisodes.length
    ? rememberedEpisodes.reduce((sum, memory) => sum + ((memory.valence || 0) / 100) * ((memory.salience || 30) / 100), 0) / rememberedEpisodes.length
    : 0;
  const established = link ? (ensureRelationshipDepth(link).trust - link.tension) / 160 : 0;
  return clamp(
    dimensionSimilarity * 58 +
      commonInterests * 9 +
      commonValues * 11 +
      established * 30 +
      rememberedTone * 18 -
      traitFriction(a, b) * 12 -
      emotionalLoad * 12,
    -100,
    100,
  );
}

export function buildSocialContext(
  a,
  b,
  {
    building = null,
    business = null,
    hour = 12,
    day = 0,
    isFamily = false,
    isCoworker = false,
    isClassmate = false,
    romanceAllowed = false,
    isRomantic = false,
    isCohabiting = false,
    sharedChildren = 0,
    relationshipStage = null,
  } = {},
) {
  const tags = new Set(["generic"]);
  if (isFamily) tags.add("family");
  if (isCoworker) tags.add("work");
  if (isClassmate) tags.add("school");
  if (building?.id === a.homeId || building?.id === b.homeId) tags.add("home");
  if (building?.type === "park") tags.add("park");
  if (building?.type === "health") tags.add("health");
  if (building?.type === "school") tags.add("school");
  if (business) tags.add("commerce");
  if (business?.nightlife || hour >= 21) tags.add("nightlife");
  if (hour >= 11 && hour <= 14) tags.add("meal");
  if (day >= 5) tags.add("weekend");
  if (isRomantic) tags.add("romantic");
  if (isCohabiting) tags.add("cohabiting");
  if (sharedChildren > 0) tags.add("parenting");
  return {
    tags,
    building,
    business,
    hour,
    day,
    isFamily,
    isCoworker,
    isClassmate,
    romanceAllowed,
    isRomantic,
    isCohabiting,
    sharedChildren,
    relationshipStage,
  };
}

const templates = [
  {
    id: "first-contact",
    tone: "positive",
    when: ({ link }) => !link || (link.interactions || 0) < 2,
    weight: 11,
    text: "se apresentaram e descobriram afinidades",
    effects: { affinity: 4, trust: 2, respect: 2, tension: -1, happiness: 0.6, social: 5 },
    memory: { emotion: "curiosidade", valence: 0.45, salience: 38 },
  },
  {
    id: "shared-interest",
    tone: "positive",
    when: ({ a, b }) => shared(a.personality?.interests, b.personality?.interests).length > 0,
    weight: 10,
    text: ({ a, b }) => `conversaram com entusiasmo sobre ${shared(a.personality?.interests, b.personality?.interests)[0]}`,
    effects: { affinity: 3.5, trust: 1.5, respect: 1, tension: -1.5, happiness: 1, social: 6 },
    memory: { emotion: "entusiasmo", valence: 0.6, salience: 34 },
  },
  {
    id: "family-meal",
    tone: "positive",
    tags: ["family", "meal"],
    weight: 13,
    text: "compartilharam a refeição e atualizaram a vida da família",
    effects: { affinity: 2.4, trust: 2.5, respect: 1, tension: -2, happiness: 1, social: 7 },
    memory: { emotion: "acolhimento", valence: 0.65, salience: 42 },
  },
  {
    id: "family-care",
    tone: "support",
    tags: ["family"],
    when: ({ a, b }) => a.health < 62 || b.health < 62 || a.energy < 30 || b.energy < 30,
    weight: 15,
    text: "ofereceram cuidado e ajuda prática um ao outro",
    effects: { affinity: 3, trust: 5, respect: 2, tension: -3, happiness: 1.2, social: 5, stress: -4 },
    memory: { emotion: "gratidão", valence: 0.78, salience: 62 },
    notable: 0.12,
    goal: "care",
  },
  {
    id: "family-story",
    tone: "positive",
    tags: ["family", "home"],
    weight: 7,
    text: "relembraram histórias e pessoas importantes da família",
    effects: { affinity: 2, trust: 2, respect: 2.5, tension: -1, happiness: 1, social: 5 },
    memory: { emotion: "nostalgia", valence: 0.5, salience: 51 },
  },
  {
    id: "work-collaboration",
    tone: "positive",
    tags: ["work"],
    weight: 13,
    text: "resolveram juntos uma dificuldade do trabalho",
    effects: { affinity: 1.7, trust: 3.2, respect: 3, tension: -1, happiness: 0.4, social: 3, stress: -2 },
    memory: { emotion: "confiança", valence: 0.55, salience: 41 },
    goal: "career",
  },
  {
    id: "mentoring",
    tone: "support",
    tags: ["work"],
    when: ({ a, b }) => Math.abs(a.age - b.age) >= 8 || Math.abs((a.personality?.workEthic || 50) - (b.personality?.workEthic || 50)) >= 24,
    weight: 7,
    text: "trocaram experiência e orientação profissional",
    effects: { affinity: 2, trust: 3.5, respect: 5, tension: -1, happiness: 0.8, social: 3 },
    memory: { emotion: "inspiração", valence: 0.68, salience: 56 },
    notable: 0.08,
    goal: "career",
  },
  {
    id: "study-together",
    tone: "positive",
    tags: ["school"],
    weight: 12,
    text: "estudaram juntos e compararam o que aprenderam",
    effects: { affinity: 2.2, trust: 2, respect: 2, tension: -1, happiness: 0.5, social: 4 },
    memory: { emotion: "concentração", valence: 0.4, salience: 35 },
    goal: "education",
  },
  {
    id: "customer-kindness",
    tone: "positive",
    tags: ["commerce"],
    weight: 5,
    text: "tiveram um atendimento atencioso e uma conversa breve",
    effects: { affinity: 1.2, trust: 1, respect: 1.5, tension: -0.5, happiness: 0.3, social: 2 },
    memory: { emotion: "simpatia", valence: 0.35, salience: 22 },
  },
  {
    id: "walk-and-talk",
    tone: "positive",
    tags: ["park"],
    weight: 11,
    text: "caminharam e conversaram sem pressa",
    effects: { affinity: 2.5, trust: 2, respect: 1, tension: -2, happiness: 1.2, social: 6, stress: -3 },
    memory: { emotion: "tranquilidade", valence: 0.62, salience: 37 },
  },
  {
    id: "nightlife-celebration",
    tone: "positive",
    tags: ["nightlife"],
    weight: 10,
    text: "brindaram, dançaram e celebraram a noite",
    effects: { affinity: 3, trust: 1, respect: 0, tension: -1, happiness: 2, social: 8, stress: -2, energy: -2 },
    memory: { emotion: "euforia", valence: 0.7, salience: 45 },
  },
  {
    id: "couple-check-in",
    tone: "support",
    tags: ["romantic"],
    weight: 12,
    text: "conversaram com sinceridade sobre como cada um estava se sentindo na relação",
    effects: { affinity: 2.2, trust: 3.8, respect: 2.4, tension: -4, reciprocity: 2, happiness: 1, social: 5, stress: -2.5 },
    memory: { emotion: "acolhimento", valence: 0.62, salience: 48 },
    goal: "belonging",
  },
  {
    id: "romantic-date",
    tone: "positive",
    tags: ["romantic", "commerce"],
    weight: 10,
    text: "reservaram um tempo a dois e criaram uma lembrança afetiva",
    effects: { affinity: 4.2, trust: 1.8, respect: 1, tension: -3, happiness: 2.2, social: 7, stress: -2 },
    memory: { emotion: "carinho", valence: 0.78, salience: 57 },
    notable: 0.06,
    goal: "belonging",
  },
  {
    id: "future-planning",
    tone: "support",
    tags: ["romantic"],
    when: ({ link }) => ensureRelationshipDepth(link)?.trust > 56,
    weight: 6,
    text: "conversaram sobre planos de moradia, trabalho e futuro em comum",
    effects: { affinity: 2.8, trust: 3.2, respect: 2.4, tension: -1.5, reciprocity: 2, happiness: 1, social: 4 },
    memory: { emotion: "esperança", valence: 0.66, salience: 61 },
    notable: 0.08,
    goal: "security",
  },
  {
    id: "household-coordination",
    tone: "mixed",
    tags: ["romantic", "cohabiting"],
    weight: 10,
    text: "dividiram tarefas, despesas e responsabilidades do lar",
    effects: { affinity: 0.8, trust: 1.5, respect: 2, tension: -1, reciprocity: 4, happiness: 0.2, social: 2, stress: -1 },
    memory: { emotion: "cooperação", valence: 0.35, salience: 34 },
    goal: "security",
  },
  {
    id: "parenting-teamwork",
    tone: "support",
    tags: ["romantic", "parenting"],
    weight: 12,
    text: "alinharam os cuidados, a rotina e as necessidades dos filhos",
    effects: { affinity: 2, trust: 3, respect: 3.5, tension: -2, reciprocity: 3, happiness: 0.8, social: 4, stress: -2 },
    memory: { emotion: "parceria", valence: 0.58, salience: 52 },
    goal: "care",
  },
  {
    id: "boundaries-conversation",
    tone: "support",
    tags: ["romantic"],
    when: ({ link }) => ensureRelationshipDepth(link)?.tension > 22 || (link?.views && Object.values(link.views).some((view) => (view.resentment || 0) > 28)),
    weight: 8,
    text: "negociaram limites, expectativas e espaço individual",
    effects: { affinity: 1, trust: 2.5, respect: 3.5, tension: -5, reciprocity: 2, happiness: 0.2, social: 3, stress: -1.5 },
    memory: { emotion: "clareza", valence: 0.34, salience: 55 },
  },
  {
    id: "jealousy-friction",
    tone: "negative",
    tags: ["romantic"],
    when: ({ link }) => ensureRelationshipDepth(link)?.tension > 34 || (link?.views && Object.values(link.views).some((view) => (view.resentment || 0) > 38)),
    weight: 5,
    text: "discutiram por ciúme, insegurança e expectativas não correspondidas",
    effects: { affinity: -4, trust: -4.5, respect: -1.5, tension: 8, reciprocity: -2, happiness: -1.8, social: -1, stress: 4 },
    memory: { emotion: "insegurança", valence: -0.68, salience: 66 },
    notable: 0.16,
  },
  {
    id: "couple-repair",
    tone: "support",
    tags: ["romantic"],
    when: ({ link, a, b }) => ensureRelationshipDepth(link)?.tension > 38 && (a.personality?.dimensions?.agreeableness || 50) + (b.personality?.dimensions?.agreeableness || 50) > 94,
    weight: 7,
    text: "retomaram uma discussão com calma, reconheceram erros e fizeram reparos",
    effects: { affinity: 4.5, trust: 4.2, respect: 4, tension: -11, reciprocity: 3, happiness: 1, social: 4, stress: -3.5 },
    memory: { emotion: "alívio", valence: 0.65, salience: 72 },
    notable: 0.18,
  },
  {
    id: "flirt",
    tone: "positive",
    tags: ["nightlife"],
    when: ({ a, b, context, link, compatibility }) =>
      context.romanceAllowed && a.age >= 18 && b.age >= 18 && !a.partnerId && !b.partnerId &&
      !["família", "casamento", "noivado", "romance", "namoro", "ficante", "união estável"].includes(link?.type) && compatibility > 42,
    weight: 5,
    text: "flertaram e perceberam uma atração mútua",
    effects: { affinity: 7, trust: 1.5, respect: 1, tension: -1, happiness: 2, social: 6 },
    memory: { emotion: "encantamento", valence: 0.82, salience: 70 },
    notable: 0.08,
    goal: "belonging",
  },
  {
    id: "emotional-support",
    tone: "support",
    when: ({ a, b, link }) =>
      mindStress(a) > 62 || mindStress(b) > 62 ||
      a.bereavement?.active?.length || b.bereavement?.active?.length ||
      ensureRelationshipDepth(link)?.trust > 64,
    weight: 8,
    text: "falaram de uma preocupação e encontraram apoio",
    effects: { affinity: 3, trust: 5.5, respect: 2, tension: -3, happiness: 1, social: 6, stress: -6 },
    memory: { emotion: "alívio", valence: 0.7, salience: 64 },
    notable: 0.12,
    goal: "belonging",
  },
  {
    id: "ask-favor",
    tone: "support",
    when: ({ link }) => ensureRelationshipDepth(link)?.trust > 42,
    weight: 5,
    text: "combinaram uma ajuda para os próximos dias",
    effects: { affinity: 1.5, trust: 2.5, respect: 1, tension: 0, reciprocity: 3, happiness: 0.3, social: 3 },
    memory: { emotion: "esperança", valence: 0.45, salience: 48 },
    notable: 0.05,
    goal: "security",
  },
  {
    id: "confide",
    tone: "support",
    when: ({ link }) => ensureRelationshipDepth(link)?.trust > 72,
    weight: 4,
    text: "compartilharam algo íntimo que não costumam contar",
    effects: { affinity: 3.5, trust: 4.5, respect: 1, tension: -2, happiness: 1, social: 5 },
    memory: { emotion: "vulnerabilidade", valence: 0.52, salience: 72 },
  },
  {
    id: "gossip",
    tone: "mixed",
    when: ({ a, b }) => (a.personality?.dimensions?.extraversion || 50) > 54 || (b.personality?.dimensions?.extraversion || 50) > 54,
    weight: 4,
    text: "trocaram notícias e comentários sobre outros moradores",
    effects: { affinity: 1.2, trust: 0.6, respect: -0.4, tension: 0.5, happiness: 0.5, social: 5 },
    memory: { emotion: "curiosidade", valence: 0.08, salience: 32 },
    rumor: true,
  },
  {
    id: "reconciliation",
    tone: "support",
    when: ({ link, a, b }) =>
      link && (link.type === "conflito" || ensureRelationshipDepth(link).tension > 38) &&
      (a.personality?.dimensions?.agreeableness || 50) + (b.personality?.dimensions?.agreeableness || 50) > 92,
    weight: 9,
    text: "reconheceram erros e tentaram se reconciliar",
    effects: { affinity: 6, trust: 4, respect: 4, tension: -12, happiness: 1.5, social: 4, stress: -3 },
    memory: { emotion: "alívio", valence: 0.74, salience: 75 },
    notable: 0.25,
  },
  {
    id: "disagreement",
    tone: "negative",
    when: ({ a, b, link, compatibility }) =>
      compatibility < 18 || ensureRelationshipDepth(link)?.tension > 48 ||
      mindStress(a) + mindStress(b) > 138,
    weight: 9,
    text: "discordaram e a conversa terminou com desconforto",
    effects: { affinity: -4.5, trust: -2.5, respect: -2, tension: 7, happiness: -1.5, social: -1, stress: 3 },
    memory: { emotion: "irritação", valence: -0.64, salience: 58 },
    notable: 0.12,
  },
  {
    id: "public-argument",
    tone: "negative",
    tags: ["nightlife"],
    when: ({ a, b, link, compatibility }) =>
      compatibility < 5 || ensureRelationshipDepth(link)?.tension > 68 ||
      a.traits?.includes("impulsivo") || b.traits?.includes("impulsivo"),
    weight: 3,
    text: "tiveram uma discussão pública e se afastaram",
    effects: { affinity: -8, trust: -5, respect: -4, tension: 12, happiness: -3, social: -2, stress: 7 },
    memory: { emotion: "raiva", valence: -0.88, salience: 82 },
    notable: 0.55,
  },
  {
    id: "ordinary-conversation",
    tone: "positive",
    weight: 12,
    text: "conversaram sobre a rotina e fizeram companhia um ao outro",
    effects: { affinity: 1.8, trust: 1.2, respect: 0.6, tension: -0.8, happiness: 0.5, social: 4 },
    memory: { emotion: "proximidade", valence: 0.35, salience: 24 },
  },
];

function templateEligible(template, payload) {
  if (template.tags?.some((tag) => !payload.context.tags.has(tag))) return false;
  return template.when ? Boolean(template.when(payload)) : true;
}

export function chooseSocialInteraction(a, b, link, context, random = Math.random) {
  ensureRelationshipDepth(link);
  const compatibility = socialCompatibility(a, b, link);
  const payload = { a, b, link, context, compatibility };
  const eligible = templates
    .filter((template) => templateEligible(template, payload))
    .map((template) => {
      let weight = template.weight;
      if (template.tone === "negative") weight *= clamp((35 - compatibility) / 24, 0.15, 2.4);
      if (template.tone === "positive") weight *= clamp((compatibility + 65) / 85, 0.35, 1.8);
      if (template.tone === "support") weight *= clamp(((link?.trust || 20) + 35) / 75, 0.45, 1.7);
      return { template, weight };
    });
  const total = eligible.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random() * Math.max(1, total);
  const selected = eligible.find((entry) => ((cursor -= entry.weight) <= 0))?.template || templates.at(-1);
  return {
    id: selected.id,
    tone: selected.tone,
    text: typeof selected.text === "function" ? selected.text(payload) : selected.text,
    effects: { ...selected.effects },
    memory: { ...selected.memory },
    notable: random() < (selected.notable || 0),
    rumor: Boolean(selected.rumor),
    goal: selected.goal || null,
    compatibility: Math.round(compatibility),
  };
}

export function applyInteractionEffects(a, b, link, interaction, stamp = {}) {
  ensureRelationshipDepth(link);
  const effects = interaction.effects || {};
  link.affinity = clamp(link.affinity + (effects.affinity || 0), -100, 100);
  link.trust = clamp(link.trust + (effects.trust || 0));
  link.respect = clamp(link.respect + (effects.respect || 0));
  link.tension = clamp(link.tension + (effects.tension || 0));
  link.reciprocity = clamp(link.reciprocity + (effects.reciprocity || 0));
  link.familiarity = clamp(link.familiarity + 1.5 + Math.abs(effects.affinity || 0) * 0.2);
  link.interactions = (link.interactions || 0) + 1;
  link.lastEvent = interaction.text;
  link.lastInteractionWeek = stamp.week;
  link.lastInteractionDay = stamp.day;
  if (interaction.tone === "negative") link.conflictCount++;
  if (interaction.tone === "support") link.supportCount++;
  link.sharedExperiences.unshift({
    week: stamp.week,
    day: stamp.day,
    time: stamp.time,
    placeId: stamp.placeId || null,
    kind: interaction.id,
    tone: interaction.tone,
    text: interaction.text,
  });
  link.sharedExperiences = link.sharedExperiences.slice(0, 18);
  link.history.unshift({ week: stamp.week, text: interaction.text });
  link.history = link.history.slice(0, 28);
  [a, b].forEach((person) => {
    person.happiness = clamp(person.happiness + (effects.happiness || 0));
    person.energy = clamp(person.energy + (effects.energy || 0));
    if (person.needs) person.needs.social = clamp(person.needs.social + (effects.social || 0));
    if (person.mind?.emotional) {
      person.mind = {
        ...person.mind,
        emotional: {
          ...person.mind.emotional,
          stress: clamp(person.mind.emotional.stress + (effects.stress || 0)),
        },
        revision: (person.mind.revision || 0) + 1,
      };
    } else if (person.mind?.state) person.mind.state.stress = clamp(person.mind.state.stress + (effects.stress || 0));
  });
  if (!["família", "casamento", "noivado", "romance", "namoro", "ficante", "união estável", "viuvez"].includes(link.type)) {
    if (link.affinity < -32 || link.tension > 72) link.type = "conflito";
    else if (link.type === "conflito" && link.affinity > 8 && link.tension < 34) link.type = "amizade";
    else if (["conhecido", "colega", "vizinhança"].includes(link.type) && link.affinity > 35 && link.trust > 28) link.type = "amizade";
  }
  return link;
}

export function decayRelationship(link, currentWeek) {
  ensureRelationshipDepth(link);
  const weeks = Math.max(0, currentWeek - (link.lastInteractionWeek || currentWeek));
  link.tension = clamp(link.tension - (link.type === "conflito" ? 1.2 : 2));
  if (weeks >= 3 && !["família", "casamento", "noivado", "romance", "namoro", "ficante", "união estável"].includes(link.type)) {
    link.familiarity = clamp(link.familiarity - Math.min(3, weeks * 0.35));
    link.affinity = clamp(link.affinity - (link.affinity > 0 ? Math.min(1.2, weeks * 0.12) : 0), -100, 100);
  }
  return link;
}

export function relationshipDepthLabel(link) {
  ensureRelationshipDepth(link);
  if (link.type === "conflito") return link.tension > 70 ? "hostilidade aberta" : "relação tensa";
  if (link.trust > 78 && link.affinity > 72) return "vínculo íntimo";
  if (link.trust > 58 && link.affinity > 50) return "laço forte";
  if (link.familiarity > 58) return "convivência frequente";
  if (link.familiarity > 25) return "conhecidos";
  return "contato recente";
}

export const socialInteractionCatalog = templates.map(({ when, text, ...template }) => ({
  ...template,
  text: typeof text === "string" ? text : null,
}));
