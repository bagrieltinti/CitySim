const clamp = (value, minimum = 0, maximum = 100) =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(Number(value)) ? Number(value) : minimum));

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const stageIn = (context, stages) => stages.includes(context.stage);
const activeRomance = (context) => Boolean(context.isRomantic && context.lifecycle?.status === "active");
const metric = (context, name, fallback = 0) => clamp(context.metrics?.[name] ?? fallback);

const romanceCandidateReason = (context) => {
  if (context.actor.age < 18 || context.target.age < 18) return "Interações românticas exigem duas pessoas adultas.";
  if (context.isFamily) return "Este vínculo familiar não admite interação romântica.";
  if (!context.romanceAllowed) return context.romanceBlockedReason || "Não existe compatibilidade romântica recíproca.";
  if (!context.canBeginRomance && !context.isRomantic) return "Um compromisso afetivo existente impede essa aproximação.";
  return null;
};

const romanticVisibility = (context) =>
  Boolean(context.isRomantic || (context.actor.age >= 18 && context.target.age >= 18 && !context.isFamily));

const familyVisibility = (context) => Boolean(context.isFamily);
const COMMITTED_STAGES = Object.freeze(["namoro", "uniao_estavel", "noivado", "casamento"]);
const familyPlanningVisibility = (context) => activeRomance(context) && stageIn(context, COMMITTED_STAGES);
const familyPlanning = (context) => context.lifecycle?.familyPlanning || null;

const planningReadiness = (person, current = {}) => {
  const age = Number(person?.age) || 0;
  const ageReadiness = age >= 22 && age <= 40 ? 24 : age >= 18 && age <= 48 ? 13 : 5;
  const stability = person?.personality?.dimensions?.stability ?? 50;
  const stress = person?.mind?.emotional?.stress ?? person?.mind?.state?.stress ?? 35;
  return round(clamp(Math.max(current.readiness || 0, (person?.health ?? 50) * 0.42 + ageReadiness + stability * 0.14 - Math.max(0, stress - 40) * 0.15)));
};

const planningConversation = (context) => {
  const planning = familyPlanning(context) || { intentions: {} };
  const intentions = Object.fromEntries([context.actor, context.target].map((person) => {
    const current = planning.intentions?.[person.id] || {};
    return [person.id, {
      ...current,
      desire: clamp(current.desire ?? 40),
      readiness: planningReadiness(person, current),
      desiredChildren: clamp(Math.floor(Number(current.desiredChildren) || 0), 0, 8),
      preferredTiming: current.preferredTiming || "indefinido",
    }];
  }));
  const values = Object.values(intentions), gap = Math.abs((values[0]?.desire || 0) - (values[1]?.desire || 0));
  return { intentions, consensus: gap <= 18 ? "aligned" : gap <= 38 ? "partial" : "conflict" };
};

const tryingForChildReason = (context) => {
  if (!familyPlanningVisibility(context)) return "Esta decisão exige namoro ou um compromisso mais consolidado.";
  const planning = familyPlanning(context);
  if (!planning) return "O planejamento familiar ainda não foi iniciado.";
  if (planning.trying) return "Vocês já estão tentando ter um filho.";
  if (planning.pregnancyIds?.length || context.actor.reproductive?.pregnancyId || context.target.reproductive?.pregnancyId) return "Já existe uma gestação em andamento neste vínculo.";
  if (planning.lastDiscussionWeek == null) return "Conversem primeiro sobre filhos, limites e o momento de vida de cada pessoa.";
  if (planning.consensus !== "aligned") return "Ainda não existe consenso suficiente sobre ter filhos.";
  const intentions = [planning.intentions?.[context.actor.id], planning.intentions?.[context.target.id]];
  if (intentions.some((intention) => !intention || intention.desire < 48)) return "Uma das pessoas não deseja iniciar tentativas neste momento.";
  if (intentions.some((intention) => intention.readiness < 42)) return "A prontidão emocional ou material ainda é insuficiente.";
  const carrier = [context.actor, context.target].find((person) => person.age >= 18 && person.age <= 48 && person.reproductive?.canGestate && !person.reproductive?.pregnancyId && (person.reproductive?.fertility ?? 0) > 0);
  if (!carrier) return "Não há possibilidade reprodutiva para iniciar uma gestação neste momento.";
  return null;
};

const EFFECTS = Object.freeze({
  talk: {
    link: { affinity: 2, trust: 1, respect: 0.5, tension: -0.5, reciprocity: 0.5 },
    actorView: { affection: 1.5, trust: 1 }, targetView: { affection: 1.2, trust: 0.8 },
    actor: { social: 7, happiness: 0.5 }, target: { social: 5, happiness: 0.3 },
  },
  compliment: {
    link: { affinity: 3.5, trust: 0.8, respect: 1.5, tension: -0.8 },
    actorView: { affection: 1.5 }, targetView: { affection: 4, trust: 1, attraction: 0.8 },
    actor: { social: 5, happiness: 0.5 }, target: { social: 5, happiness: 1.5 },
  },
  support: {
    link: { affinity: 3, trust: 5, respect: 2, tension: -3, reciprocity: 3 },
    actorView: { affection: 2, trust: 3 }, targetView: { affection: 4, trust: 6 },
    actor: { social: 5, happiness: 1, stress: -2 }, target: { social: 7, happiness: 2, stress: -6 },
  },
  argue: {
    link: { affinity: -6, trust: -4, respect: -2, tension: 11, reciprocity: -2 },
    actorView: { affection: -5, trust: -3, resentment: 7 }, targetView: { affection: -7, trust: -5, resentment: 10 },
    actor: { social: -3, happiness: -2, stress: 5 }, target: { social: -2, happiness: -3, stress: 7 },
  },
  familyChat: {
    link: { affinity: 3, trust: 2.5, respect: 1, tension: -1.5, reciprocity: 1 },
    actorView: { affection: 2.5, trust: 2 }, targetView: { affection: 2.5, trust: 2 },
    actor: { social: 8, happiness: 1, stress: -1 }, target: { social: 8, happiness: 1, stress: -1 },
  },
  familyMeal: {
    link: { affinity: 4, trust: 3, respect: 1, tension: -3, reciprocity: 2 },
    actorView: { affection: 3, trust: 2 }, targetView: { affection: 3, trust: 2 },
    actor: { social: 10, happiness: 2, energy: 1, stress: -2 }, target: { social: 10, happiness: 2, energy: 1, stress: -2 },
  },
  familyCare: {
    link: { affinity: 4, trust: 6, respect: 3, tension: -4, reciprocity: 5 },
    actorView: { affection: 3, trust: 3 }, targetView: { affection: 5, trust: 7 },
    actor: { social: 5, happiness: 1, energy: -2, stress: -1 }, target: { social: 7, happiness: 3, energy: 2, stress: -7 },
  },
  flirt: {
    link: { affinity: 4, trust: 1, respect: 1, tension: -1, reciprocity: 1 },
    actorView: { affection: 2, attraction: 6 }, targetView: { affection: 3, attraction: 10, trust: 1 },
    actor: { social: 7, happiness: 2, stress: -1 }, target: { social: 6, happiness: 2, stress: -1 },
  },
  kiss: {
    link: { affinity: 5, trust: 2, respect: 1, tension: -2, reciprocity: 2 },
    actorView: { affection: 4, attraction: 7, trust: 1 }, targetView: { affection: 5, attraction: 8, trust: 2 },
    actor: { social: 7, happiness: 4, stress: -2 }, target: { social: 7, happiness: 4, stress: -2 },
  },
  date: {
    link: { affinity: 5, trust: 3, respect: 1, tension: -3, reciprocity: 3 },
    actorView: { affection: 5, attraction: 3, trust: 2 }, targetView: { affection: 5, attraction: 3, trust: 2 },
    actor: { social: 12, happiness: 4, energy: -2, stress: -3 }, target: { social: 12, happiness: 4, energy: -2, stress: -3 },
  },
  affection: {
    link: { affinity: 4, trust: 3, respect: 1, tension: -3, reciprocity: 2 },
    actorView: { affection: 4, attraction: 2, trust: 2 }, targetView: { affection: 5, attraction: 2, trust: 3 },
    actor: { social: 7, happiness: 3, stress: -2 }, target: { social: 7, happiness: 3, stress: -2 },
  },
  repair: {
    link: { affinity: 5, trust: 5, respect: 4, tension: -10, reciprocity: 3 },
    actorView: { affection: 3, trust: 5, resentment: -6 }, targetView: { affection: 4, trust: 6, resentment: -8 },
    actor: { social: 4, happiness: 2, stress: -5 }, target: { social: 4, happiness: 2, stress: -6 },
  },
  commitment: {
    link: { affinity: 5, trust: 5, respect: 3, tension: -2, reciprocity: 4 },
    actorView: { affection: 5, trust: 5 }, targetView: { affection: 6, trust: 6 },
    actor: { social: 6, happiness: 5, stress: -2 }, target: { social: 6, happiness: 5, stress: -2 },
  },
  future: {
    link: { affinity: 3, trust: 4, respect: 3, tension: -2, reciprocity: 3 },
    actorView: { affection: 3, trust: 4 }, targetView: { affection: 3, trust: 4 },
    actor: { social: 5, happiness: 2, stress: -2 }, target: { social: 5, happiness: 2, stress: -2 },
  },
  breakup: {
    link: { affinity: -8, trust: -7, respect: -2, tension: 15, reciprocity: -5 },
    actorView: { affection: -10, trust: -5, resentment: 8 }, targetView: { affection: -14, trust: -9, resentment: 16 },
    actor: { social: -5, happiness: -8, stress: 10 }, target: { social: -7, happiness: -12, stress: 16 },
  },
  rejected: {
    link: { affinity: -1.5, trust: -0.5, respect: 0, tension: 2, reciprocity: -1 },
    actorView: { affection: -1, resentment: 2 }, targetView: { affection: -1.5, resentment: 1 },
    actor: { social: -1, happiness: -2, stress: 2 }, target: { social: 0, happiness: -0.5, stress: 1 },
  },
});

const ACTION_DEFINITIONS = [
  {
    id: "talk", name: "Conversar", category: "social", durationMinutes: 20, cooldownMinutes: 35,
    description: "Conversar sobre a rotina e conhecer melhor a outra pessoa.", baseAcceptance: 0.9,
    experienceKind: "conversa", tone: "positive", valence: 28, importance: 24, effects: EFFECTS.talk,
    acceptedText: ({ target }) => `Você conversou com ${target.firstName}; a troca ajudou vocês a se conhecerem melhor.`,
    rejectedText: ({ target }) => `${target.firstName} não estava disponível para conversar agora.`,
  },
  {
    id: "compliment", name: "Elogiar", category: "social", durationMinutes: 15, cooldownMinutes: 120,
    description: "Fazer um elogio sincero e observar como ele é recebido.", baseAcceptance: 0.72,
    experienceKind: "carinho", tone: "positive", valence: 45, importance: 32, effects: EFFECTS.compliment,
    weights: { affinity: 0.12, trust: 0.08, tension: -0.12, compatibility: 0.08 },
    acceptedText: ({ target }) => `${target.firstName} recebeu o elogio com satisfação.`,
    rejectedText: ({ target }) => `${target.firstName} pareceu desconfortável e preferiu mudar de assunto.`,
  },
  {
    id: "support", name: "Oferecer apoio", category: "social", durationMinutes: 35, cooldownMinutes: 240,
    description: "Escutar com atenção e oferecer apoio emocional ou prático.", baseAcceptance: 0.66,
    experienceKind: "apoio_emocional", tone: "support", valence: 62, importance: 54, effects: EFFECTS.support,
    weights: { affinity: 0.08, trust: 0.2, tension: -0.15, compatibility: 0.05, agreeableness: 0.08 },
    acceptedText: ({ target }) => `${target.firstName} aceitou seu apoio e se sentiu acolhido(a).`,
    rejectedText: ({ target }) => `${target.firstName} agradeceu, mas preferiu lidar com isso em seu próprio tempo.`,
  },
  {
    id: "argue", name: "Discutir", category: "conflict", durationMinutes: 25, cooldownMinutes: 180,
    description: "Confrontar diretamente um incômodo, com risco de aprofundar o conflito.", unilateral: true,
    experienceKind: "discussao", tone: "negative", valence: -62, importance: 58, effects: EFFECTS.argue,
    acceptedText: ({ target }) => `Você e ${target.firstName} tiveram uma discussão tensa.`,
  },
  {
    id: "family_chat", name: "Colocar a família em dia", category: "family", durationMinutes: 35, cooldownMinutes: 180,
    description: "Conversar sobre notícias, lembranças e necessidades da família.", visible: familyVisibility,
    eligibility: (context) => context.isFamily ? null : "Esta ação é exclusiva de vínculos familiares.",
    baseAcceptance: 0.9, experienceKind: "evento_familiar", tone: "positive", valence: 48, importance: 42, effects: EFFECTS.familyChat,
    acceptedText: ({ target }) => `Você e ${target.firstName} colocaram as notícias da família em dia.`,
    rejectedText: ({ target }) => `${target.firstName} pediu para retomar a conversa familiar em outro momento.`,
  },
  {
    id: "family_meal", name: "Compartilhar refeição", category: "family", durationMinutes: 60, cooldownMinutes: 360,
    description: "Reunir-se à mesa para fortalecer a convivência familiar.", visible: familyVisibility,
    eligibility: (context) => !context.isFamily ? "Esta ação é exclusiva de vínculos familiares." : !context.atHome ? "A refeição familiar precisa acontecer na casa de uma das pessoas." : !context.mealTime ? "Este não é um horário adequado para uma refeição em família." : null,
    baseAcceptance: 0.88, experienceKind: "evento_familiar", tone: "positive", valence: 62, importance: 50, effects: EFFECTS.familyMeal,
    acceptedText: ({ target }) => `Você e ${target.firstName} compartilharam uma refeição e um momento de proximidade.`,
    rejectedText: ({ target }) => `${target.firstName} não conseguiu participar da refeição agora.`,
  },
  {
    id: "family_care", name: "Cuidar e ajudar", category: "family", durationMinutes: 50, cooldownMinutes: 360,
    description: "Assumir uma tarefa de cuidado ou oferecer ajuda concreta.", visible: familyVisibility,
    eligibility: (context) => context.isFamily ? null : "Esta ação é exclusiva de vínculos familiares.",
    baseAcceptance: 0.82, experienceKind: "apoio_pratico", tone: "support", valence: 68, importance: 58, effects: EFFECTS.familyCare,
    weights: { affinity: 0.05, trust: 0.2, tension: -0.12, agreeableness: 0.08 },
    acceptedText: ({ target }) => `${target.firstName} aceitou sua ajuda; o cuidado fortaleceu o vínculo familiar.`,
    rejectedText: ({ target }) => `${target.firstName} agradeceu a intenção, mas não quis receber ajuda agora.`,
  },
  {
    id: "flirt", name: "Flertar", category: "romance", durationMinutes: 20, cooldownMinutes: 120,
    description: "Demonstrar interesse afetivo e descobrir se existe reciprocidade.", visible: romanticVisibility,
    eligibility: (context) => romanceCandidateReason(context) || (activeRomance(context) && !stageIn(context, ["paquera", "ficante_casual", "ficante_recorrente"]) ? "O vínculo já pede uma demonstração afetiva mais direta." : null),
    baseAcceptance: 0.3, experienceKind: "flerte", tone: "positive", valence: 62, importance: 52, effects: EFFECTS.flirt,
    startsRomance: true,
    weights: { affinity: 0.08, trust: 0.05, tension: -0.16, compatibility: 0.18, attraction: 0.28, openness: 0.08 },
    acceptedText: ({ target }) => `${target.firstName} correspondeu ao flerte; surgiu uma atração recíproca.`,
    rejectedText: ({ target }) => `${target.firstName} não correspondeu ao flerte e sinalizou que prefere manter outro tipo de vínculo.`,
  },
  {
    id: "first_kiss", name: "Tentar o primeiro beijo", category: "romance", durationMinutes: 20, cooldownMinutes: 360,
    description: "Dar um passo íntimo que depende de confiança e reciprocidade claras.", visible: romanticVisibility,
    eligibility: (context) => romanceCandidateReason(context) || (!activeRomance(context) ? "É preciso existir uma aproximação romântica recíproca." : !stageIn(context, ["paquera", "ficante_casual", "ficante_recorrente"]) ? "O primeiro beijo já pertence a uma etapa anterior do vínculo." : metric(context, "attraction") < 38 || metric(context, "intimacy") < 20 ? "A atração e a intimidade ainda não são suficientes." : null),
    baseAcceptance: 0.22, experienceKind: "primeiro_beijo", tone: "positive", valence: 82, importance: 78, effects: EFFECTS.kiss,
    milestone: true, weights: { affinity: 0.08, trust: 0.14, tension: -0.2, compatibility: 0.08, attraction: 0.34, intimacy: 0.18 },
    acceptedText: ({ target }) => `Você e ${target.firstName} compartilharam o primeiro beijo com consentimento e reciprocidade.`,
    rejectedText: ({ target }) => `${target.firstName} não quis avançar para um beijo; o limite foi respeitado.`,
  },
  {
    id: "date", name: "Ter um encontro", category: "romance", durationMinutes: 90, cooldownMinutes: 480,
    description: "Reservar tempo de qualidade para aprofundar a conexão.", visible: romanticVisibility,
    eligibility: (context) => romanceCandidateReason(context) || (!activeRomance(context) ? "É preciso existir uma aproximação romântica recíproca." : null),
    baseAcceptance: 0.52, experienceKind: "encontro", tone: "positive", valence: 72, importance: 62, effects: EFFECTS.date,
    weights: { affinity: 0.12, trust: 0.12, tension: -0.16, compatibility: 0.1, attraction: 0.14, satisfaction: 0.1 },
    acceptedText: ({ target }) => `Você e ${target.firstName} tiveram um encontro e criaram uma lembrança afetiva.`,
    rejectedText: ({ target }) => `${target.firstName} não aceitou o encontro neste momento.`,
  },
  {
    id: "affection", name: "Demonstrar carinho", category: "romance", durationMinutes: 25, cooldownMinutes: 150,
    description: "Expressar carinho de maneira compatível com a intimidade do vínculo.", visible: romanticVisibility,
    eligibility: (context) => romanceCandidateReason(context) || (!activeRomance(context) ? "É preciso existir um vínculo romântico ativo." : metric(context, "intimacy") < 24 ? "A intimidade ainda não sustenta essa demonstração de carinho." : null),
    baseAcceptance: 0.68, experienceKind: "carinho", tone: "positive", valence: 65, importance: 46, effects: EFFECTS.affection,
    weights: { affinity: 0.1, trust: 0.14, tension: -0.18, attraction: 0.1, intimacy: 0.16, satisfaction: 0.1 },
    acceptedText: ({ target }) => `${target.firstName} correspondeu ao carinho e se sentiu mais próximo(a) de você.`,
    rejectedText: ({ target }) => `${target.firstName} pediu mais espaço; você respeitou esse limite.`,
  },
  {
    id: "repair", name: "Tentar reparar o vínculo", category: "relationship", durationMinutes: 50, cooldownMinutes: 360,
    description: "Reconhecer danos, escutar e buscar uma reparação concreta.", visible: (context) => Boolean(context.link && (context.isRomantic || context.isFamily || metric(context, "tension") >= 18)),
    eligibility: (context) => !context.link ? "Ainda não existe um vínculo a reparar." : metric(context, "tension") < 12 && !(context.lifecycle?.dynamics?.unresolvedConflicts > 0) ? "Não há um conflito relevante que exija reparação." : null,
    baseAcceptance: 0.46, experienceKind: "tentativa_de_reparo", tone: "support", valence: 54, importance: 66, effects: EFFECTS.repair,
    weights: { affinity: 0.08, trust: 0.22, tension: -0.1, compatibility: 0.08, repairCapacity: 0.22, agreeableness: 0.1 },
    acceptedText: ({ target }) => `${target.firstName} aceitou conversar; vocês reconheceram danos e iniciaram uma reparação.`,
    rejectedText: ({ target }) => `${target.firstName} ainda não se sentiu pronto(a) para reparar o vínculo.`,
  },
  {
    id: "define_exclusive", name: "Conversar sobre exclusividade", category: "commitment", durationMinutes: 55, cooldownMinutes: 720,
    description: "Negociar limites e assumir uma aproximação exclusiva.", visible: romanticVisibility,
    eligibility: (context) => romanceCandidateReason(context) || (!activeRomance(context) ? "É preciso existir uma aproximação romântica." : !stageIn(context, ["paquera", "ficante_casual", "ficante_recorrente"]) ? "A exclusividade já foi definida ou não corresponde à etapa atual." : metric(context, "trust") < 38 || metric(context, "commitment") < 30 ? "Confiança e compromisso ainda são insuficientes." : null),
    baseAcceptance: 0.32, experienceKind: "conversa_sobre_futuro", tone: "support", valence: 70, importance: 76, effects: EFFECTS.commitment,
    transitionTo: "ficante_exclusivo", transitionReason: "exclusividade escolhida em comum acordo",
    weights: { affinity: 0.08, trust: 0.24, tension: -0.18, compatibility: 0.08, commitment: 0.28, satisfaction: 0.12 },
    acceptedText: ({ target }) => `${target.firstName} aceitou construir uma relação exclusiva com você.`,
    rejectedText: ({ target }) => `${target.firstName} não quis assumir exclusividade neste momento.`,
  },
  {
    id: "define_dating", name: "Pedir em namoro", category: "commitment", durationMinutes: 60, cooldownMinutes: 960,
    description: "Propor um namoro público e comprometido.", visible: romanticVisibility,
    eligibility: (context) => romanceCandidateReason(context) || (!activeRomance(context) ? "É preciso existir uma aproximação romântica." : !stageIn(context, ["paquera", "ficante_casual", "ficante_recorrente", "ficante_exclusivo"]) ? "O vínculo já passou da etapa de definir namoro." : metric(context, "trust") < 48 || metric(context, "commitment") < 42 || metric(context, "satisfaction") < 45 ? "O vínculo ainda precisa de mais confiança, compromisso e satisfação." : null),
    baseAcceptance: 0.3, experienceKind: "conversa_sobre_futuro", tone: "support", valence: 78, importance: 82, effects: EFFECTS.commitment,
    transitionTo: "namoro", transitionReason: "namoro assumido por decisão recíproca", milestone: true,
    weights: { affinity: 0.08, trust: 0.24, tension: -0.2, compatibility: 0.08, commitment: 0.3, satisfaction: 0.18 },
    acceptedText: ({ target }) => `${target.firstName} aceitou seu pedido; vocês assumiram um namoro.`,
    rejectedText: ({ target }) => `${target.firstName} gosta da conexão, mas não quis assumir um namoro agora.`,
  },
  {
    id: "future_talk", name: "Conversar sobre o futuro", category: "commitment", durationMinutes: 60, cooldownMinutes: 720,
    description: "Alinhar expectativas de moradia, carreira, finanças e família.", visible: romanticVisibility,
    eligibility: (context) => romanceCandidateReason(context) || (!activeRomance(context) || !stageIn(context, ["ficante_exclusivo", "namoro", "uniao_estavel", "noivado", "casamento"]) ? "Esta conversa exige um vínculo comprometido." : null),
    baseAcceptance: 0.72, experienceKind: "conversa_sobre_futuro", tone: "support", valence: 58, importance: 62, effects: EFFECTS.future,
    weights: { affinity: 0.05, trust: 0.2, tension: -0.15, communication: 0.18, commitment: 0.14 },
    acceptedText: ({ target }) => `Você e ${target.firstName} alinharam expectativas e planos para o futuro.`,
    rejectedText: ({ target }) => `${target.firstName} evitou definir planos e pediu mais tempo.`,
  },
  {
    id: "discuss_children", name: "Conversar sobre ter filhos", category: "family", durationMinutes: 70, cooldownMinutes: 720,
    description: "Abrir uma conversa franca sobre desejo, momento de vida, limites e formas de parentalidade.", visible: familyPlanningVisibility,
    eligibility: (context) => !familyPlanningVisibility(context) ? "Esta conversa exige namoro ou um compromisso mais consolidado." : null,
    baseAcceptance: 0.78, experienceKind: "planejamento_familiar", tone: "support", valence: 54, importance: 68, effects: EFFECTS.future,
    lifecycleExperience: planningConversation,
    weights: { affinity: 0.05, trust: 0.2, tension: -0.16, communication: 0.22, commitment: 0.1, agreeableness: 0.08 },
    acceptedText: ({ target }) => `Você e ${target.firstName} conversaram com franqueza sobre filhos e registraram seus desejos e limites.`,
    rejectedText: ({ target }) => `${target.firstName} ainda não se sentiu pronto(a) para conversar sobre filhos.`,
  },
  {
    id: "try_for_child", name: "Propor tentar ter um filho", category: "family", durationMinutes: 65, cooldownMinutes: 1440,
    description: "Propor tentativas de concepção após uma conversa clara e consentimento recíproco.", visible: familyPlanningVisibility,
    eligibility: tryingForChildReason,
    baseAcceptance: 0.46, experienceKind: "iniciar_tentativas", tone: "support", valence: 68, importance: 82, effects: EFFECTS.commitment,
    milestone: true, weights: { affinity: 0.04, trust: 0.24, tension: -0.22, communication: 0.2, commitment: 0.28, satisfaction: 0.14, agreeableness: 0.08 },
    acceptedText: ({ target }) => `${target.firstName} consentiu; vocês decidiram iniciar tentativas de concepção.`,
    rejectedText: ({ target }) => `${target.firstName} não consentiu em iniciar tentativas agora; a decisão foi respeitada.`,
  },
  {
    id: "pause_trying", name: "Propor pausar as tentativas", category: "family", durationMinutes: 50, cooldownMinutes: 720,
    description: "Reavaliar o momento do casal e propor uma pausa nas tentativas de concepção.", visible: familyPlanningVisibility,
    eligibility: (context) => !familyPlanningVisibility(context) ? "Esta decisão exige um vínculo comprometido." : !familyPlanning(context)?.trying ? "Vocês não estão tentando ter um filho no momento." : null,
    baseAcceptance: 0.82, experienceKind: "pausar_tentativas", tone: "support", valence: 32, importance: 64, effects: EFFECTS.future,
    weights: { affinity: 0.04, trust: 0.2, tension: -0.14, communication: 0.24, repairCapacity: 0.12, agreeableness: 0.08 },
    acceptedText: ({ target }) => `${target.firstName} concordou em pausar as tentativas e rever a decisão mais adiante.`,
    rejectedText: ({ target }) => `${target.firstName} não concordou com a pausa e pediu uma conversa mais profunda.`,
  },
  {
    id: "move_in", name: "Propor morar junto", category: "commitment", durationMinutes: 70, cooldownMinutes: 1440,
    description: "Propor a formação de um lar compartilhado e reorganizar os domicílios.", visible: romanticVisibility,
    eligibility: (context) => romanceCandidateReason(context) || (!activeRomance(context) || !stageIn(context, ["ficante_exclusivo", "namoro"]) ? "Morar junto exige namoro ou exclusividade ativa." : context.sameHousehold ? "Vocês já compartilham o mesmo domicílio." : metric(context, "commitment") < 60 || metric(context, "trust") < 55 || metric(context, "satisfaction") < 50 ? "O vínculo ainda não oferece segurança suficiente para compartilhar um lar." : null),
    baseAcceptance: 0.28, experienceKind: "mudanca_conjunta", tone: "support", valence: 76, importance: 88, effects: EFFECTS.commitment,
    transitionTo: "uniao_estavel", transitionReason: "decisão conjunta de compartilhar um lar", milestone: true,
    weights: { affinity: 0.04, trust: 0.22, tension: -0.22, communication: 0.14, commitment: 0.32, satisfaction: 0.18 },
    acceptedText: ({ target }) => `${target.firstName} aceitou formar um lar com você.`,
    rejectedText: ({ target }) => `${target.firstName} preferiu manter casas separadas por enquanto.`,
  },
  {
    id: "propose", name: "Pedir em noivado", category: "commitment", durationMinutes: 75, cooldownMinutes: 2880,
    description: "Propor casamento e iniciar uma nova etapa pública do vínculo.", visible: romanticVisibility,
    eligibility: (context) => romanceCandidateReason(context) || (!activeRomance(context) || !stageIn(context, ["namoro", "uniao_estavel"]) ? "O noivado exige namoro ou união estável." : metric(context, "commitment") < 74 || metric(context, "trust") < 66 || metric(context, "satisfaction") < 62 || metric(context, "tension") > 48 ? "O relacionamento ainda não está pronto para um noivado." : null),
    baseAcceptance: 0.25, experienceKind: "pedido_de_noivado", tone: "positive", valence: 90, importance: 96, effects: EFFECTS.commitment,
    transitionTo: "noivado", transitionReason: "pedido de noivado aceito", milestone: true,
    weights: { affinity: 0.04, trust: 0.24, tension: -0.26, communication: 0.12, commitment: 0.36, satisfaction: 0.24 },
    acceptedText: ({ target }) => `${target.firstName} aceitou seu pedido de noivado.`,
    rejectedText: ({ target }) => `${target.firstName} não aceitou o noivado e pediu que vocês conversem sobre expectativas.`,
  },
  {
    id: "marry", name: "Celebrar casamento", category: "commitment", durationMinutes: 180, cooldownMinutes: 10080,
    description: "Formalizar o casamento e integrar o vínculo à vida familiar e comunitária.", visible: romanticVisibility,
    eligibility: (context) => romanceCandidateReason(context) || (!activeRomance(context) || context.stage !== "noivado" ? "O casamento exige um noivado ativo." : metric(context, "commitment") < 78 || metric(context, "trust") < 68 || metric(context, "satisfaction") < 62 || metric(context, "tension") > 45 ? "O vínculo ainda precisa de compromisso, confiança e estabilidade para o casamento." : null),
    baseAcceptance: 0.44, experienceKind: "casamento", tone: "positive", valence: 94, importance: 100, effects: EFFECTS.commitment,
    transitionTo: "casamento", transitionReason: "casamento celebrado por decisão recíproca", milestone: true,
    weights: { affinity: 0.04, trust: 0.24, tension: -0.28, communication: 0.14, commitment: 0.38, satisfaction: 0.26 },
    acceptedText: ({ target }) => `Você e ${target.firstName} celebraram o casamento e assumiram publicamente essa nova etapa.`,
    rejectedText: ({ target }) => `${target.firstName} pediu para adiar o casamento e conversar melhor sobre a decisão.`,
  },
  {
    id: "breakup", name: "Terminar relacionamento", category: "conflict", durationMinutes: 60, cooldownMinutes: 0,
    description: "Encerrar unilateralmente o vínculo e iniciar suas consequências afetivas e domésticas.", visible: romanticVisibility,
    eligibility: (context) => !activeRomance(context) ? "Não existe um relacionamento ativo para terminar." : null,
    unilateral: true, experienceKind: "separacao", tone: "negative", valence: -88, importance: 94, effects: EFFECTS.breakup,
    transitionTo: (context) => context.lifecycle?.legal?.married || context.lifecycle?.legal?.civilUnion || stageIn(context, ["casamento", "uniao_estavel"]) ? "separado" : "encerrado",
    transitionReason: "término decidido pelo jogador", milestone: true,
    acceptedText: ({ target }) => `Você encerrou o relacionamento com ${target.firstName}; ambos precisarão reorganizar a vida.`,
  },
  {
    id: "reconcile", name: "Propor reconciliação", category: "relationship", durationMinutes: 70, cooldownMinutes: 1440,
    description: "Retomar o diálogo e propor uma reconstrução consciente do vínculo.", visible: romanticVisibility,
    eligibility: (context) => !context.isRomantic || !stageIn(context, ["separado", "encerrado"]) ? "A reconciliação exige um vínculo romântico encerrado ou separado." : metric(context, "repairCapacity") < 30 || metric(context, "trust") < 24 ? "Ainda falta confiança ou capacidade de reparação para uma reconciliação." : null,
    baseAcceptance: 0.18, experienceKind: "reconciliacao", tone: "support", valence: 76, importance: 90, effects: EFFECTS.repair,
    transitionTo: (context) => context.lifecycle?.previousStage && !["separado", "divorciado", "viuvez", "encerrado"].includes(context.lifecycle.previousStage) ? context.lifecycle.previousStage : "namoro",
    transitionReason: "reconciliação escolhida após diálogo e reparação", milestone: true,
    weights: { affinity: 0.12, trust: 0.28, tension: -0.26, communication: 0.18, repairCapacity: 0.34, satisfaction: 0.12 },
    acceptedText: ({ target }) => `${target.firstName} aceitou reconstruir o vínculo com você.`,
    rejectedText: ({ target }) => `${target.firstName} não quis retomar o relacionamento neste momento.`,
  },
];

const ACTION_ALIASES = Object.freeze({
  conversation: "talk", converse: "talk", socialize: "talk",
  praise: "compliment", help: "support", emotional_support: "support",
  discuss: "argue", family: "family_chat", family_support: "family_care",
  romantic_date: "date", encontro: "date", carinho: "affection",
  apologize: "repair", apology: "repair", exclusivity: "define_exclusive",
  define_relationship: "define_dating", dating: "define_dating",
  future_planning: "future_talk", cohabit: "move_in", engagement: "propose",
  wedding: "marry", marriage: "marry", discuss_family: "discuss_children",
  family_planning: "discuss_children", start_trying: "try_for_child", stop_trying: "pause_trying",
  end_relationship: "breakup", separate: "breakup", reconciliation: "reconcile",
});

export const RELATIONSHIP_ACTIONS_VERSION = 1;
export const relationshipActionCatalog = Object.freeze(ACTION_DEFINITIONS.map((definition) => Object.freeze({
  id: definition.id,
  name: definition.name,
  description: definition.description,
  category: definition.category,
  durationMinutes: definition.durationMinutes,
  cooldownMinutes: definition.cooldownMinutes,
})));

export function normalizeRelationshipActionId(value) {
  const id = String(value || "talk").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return ACTION_ALIASES[id] || id;
}

const definitionFor = (value) => ACTION_DEFINITIONS.find((definition) => definition.id === normalizeRelationshipActionId(value)) || null;

const cooldownRemaining = (definition, context) => {
  if (!definition.cooldownMinutes || !context.link) return 0;
  const latest = (context.link.relationshipActionHistory || []).find((entry) => entry.kind === definition.id);
  if (!Number.isFinite(latest?.absoluteMinute)) return 0;
  return Math.max(0, definition.cooldownMinutes - (context.absoluteMinute - latest.absoluteMinute));
};

const availabilityReason = (definition, context) => {
  if (!context.actor?.alive || !context.target?.alive) return "Uma das pessoas não está disponível.";
  if (context.actor.id === context.target.id) return "Escolha outra pessoa.";
  if (!context.samePlace) return "As duas pessoas precisam estar no mesmo local.";
  if (context.actorBusy) return "Conclua a ação atual antes de iniciar outra interação.";
  if (definition.requiresAttention && context.targetBusy) return `${context.target.firstName} está ocupado(a) demais para esta conversa.`;
  const contextual = definition.eligibility?.(context);
  if (contextual) return contextual;
  const remaining = cooldownRemaining(definition, context);
  if (remaining > 0) return `Espere cerca de ${Math.ceil(remaining)} minuto(s) antes de repetir esta interação.`;
  return null;
};

const acceptanceChance = (definition, context) => {
  if (definition.unilateral) return 1;
  const weights = {
    affinity: 0.08, trust: 0.1, tension: -0.12, compatibility: 0.06,
    attraction: 0, intimacy: 0, commitment: 0, satisfaction: 0,
    communication: 0, repairCapacity: 0, agreeableness: 0, openness: 0,
    ...(definition.weights || {}),
  };
  const dimensions = context.target.personality?.dimensions || {};
  let score = (definition.baseAcceptance ?? 0.65) * 100;
  score += ((context.link?.affinity ?? 8) - 35) * weights.affinity;
  score += ((context.link?.trust ?? 8) - 35) * weights.trust;
  score += (context.link?.tension ?? 0) * weights.tension;
  score += ((context.compatibility ?? 50) - 50) * weights.compatibility;
  score += ((context.targetView?.attraction ?? metric(context, "attraction", 20)) - 35) * weights.attraction;
  score += (metric(context, "intimacy", 20) - 40) * weights.intimacy;
  score += (metric(context, "commitment", 20) - 45) * weights.commitment;
  score += (metric(context, "satisfaction", 50) - 50) * weights.satisfaction;
  score += (metric(context, "communication", 45) - 45) * weights.communication;
  score += (metric(context, "repairCapacity", 45) - 45) * weights.repairCapacity;
  score += ((dimensions.agreeableness ?? 50) - 50) * weights.agreeableness;
  score += ((dimensions.openness ?? 50) - 50) * weights.openness;
  score += ((context.target.happiness ?? 50) - 50) * 0.06;
  score += ((context.target.needs?.social ?? 50) < 35 ? 4 : 0);
  score -= Math.max(0, 35 - (context.target.energy ?? 50)) * 0.18;
  score -= Math.max(0, (context.target.mind?.emotional?.stress ?? 35) - 55) * 0.16;
  if (context.targetBusy) score -= 14;
  return round(clamp(score, definition.minAcceptance ?? 4, definition.maxAcceptance ?? 98) / 100, 3);
};

const publicAction = (definition, context) => {
  const reason = availabilityReason(definition, context);
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    category: definition.category,
    durationMinutes: definition.durationMinutes,
    cooldownMinutes: definition.cooldownMinutes,
    available: !reason,
    reason,
    acceptanceChance: reason ? 0 : acceptanceChance(definition, context),
  };
};

export function listRelationshipActions(context = {}) {
  if (!context.actor || !context.target) return [];
  return ACTION_DEFINITIONS
    .filter((definition) => definition.visible ? definition.visible(context) : true)
    .map((definition) => publicAction(definition, context));
}

export function relationshipActionById(value, context = {}) {
  const definition = definitionFor(value);
  return definition ? publicAction(definition, context) : null;
}

export function resolveRelationshipAction(value, context = {}, random = Math.random) {
  const definition = definitionFor(value);
  if (!definition) return { ok: false, reason: "Interação desconhecida." };
  const reason = availabilityReason(definition, context);
  if (reason) return { ok: false, reason, action: publicAction(definition, context) };
  const chance = acceptanceChance(definition, context);
  const roll = clamp(typeof random === "function" ? random() : 0.5, 0, 0.999999);
  const accepted = definition.unilateral || roll < chance;
  const textFactory = accepted ? definition.acceptedText : definition.rejectedText;
  const text = textFactory?.(context) || (accepted
    ? `${context.target.firstName} aceitou a interação.`
    : `${context.target.firstName} não aceitou a interação.`);
  const effects = accepted ? definition.effects : (definition.rejectionEffects || EFFECTS.rejected);
  const transitionTo = accepted
    ? (typeof definition.transitionTo === "function" ? definition.transitionTo(context) : definition.transitionTo || null)
    : null;
  const tone = accepted ? definition.tone : "negative";
  const valence = accepted ? definition.valence : Math.min(-18, -(Math.abs(definition.valence || 30) * 0.45));
  const lifecycleKind = accepted
    ? definition.experienceKind
    : context.isRomantic ? "desacordo" : null;
  const lifecyclePatch = accepted && definition.lifecycleExperience
    ? (typeof definition.lifecycleExperience === "function" ? definition.lifecycleExperience(context) : definition.lifecycleExperience)
    : null;
  return {
    ok: true,
    accepted,
    reciprocal: Boolean(accepted && definition.startsRomance),
    chance,
    roll: round(roll, 3),
    action: publicAction(definition, context),
    message: text,
    effects: {
      link: { ...(effects.link || {}) },
      actorView: { ...(effects.actorView || {}) },
      targetView: { ...(effects.targetView || {}) },
      actor: { ...(effects.actor || {}) },
      target: { ...(effects.target || {}) },
    },
    interaction: {
      id: `player-${definition.id}-${accepted ? "accepted" : "declined"}`,
      tone,
      text,
      effects: { ...(effects.link || {}) },
      memory: {
        emotion: accepted ? (tone === "negative" ? "tensão" : tone === "support" ? "acolhimento" : "proximidade") : "constrangimento",
        valence,
        salience: accepted ? definition.importance : Math.max(32, Math.round((definition.importance || 40) * 0.7)),
      },
      notable: Boolean(definition.milestone || Math.abs(valence) >= 70),
      compatibility: Math.round(context.compatibility ?? 50),
    },
    lifecycleExperience: lifecycleKind ? {
      kind: lifecycleKind,
      text,
      tone,
      valence,
      importance: accepted ? definition.importance : Math.max(34, Math.round((definition.importance || 40) * 0.72)),
      milestone: Boolean(accepted && definition.milestone),
      ...(lifecyclePatch || {}),
    } : null,
    startRomance: Boolean(accepted && definition.startsRomance && !context.isRomantic),
    transition: transitionTo ? {
      from: context.stage,
      to: transitionTo,
      reason: definition.transitionReason || "decisão explícita do jogador",
    } : null,
  };
}
