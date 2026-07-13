const clamp = (value, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
const asArray = (value) => Array.isArray(value) ? value : [];

export const GAMEPLAY_DIFFICULTY_VERSION = 1;
export const GAMEPLAY_DIFFICULTY = Object.freeze({
  id: "balanced",
  name: "Vida equilibrada",
  description: "Riscos reais, sinais prévios e tempo razoável para reagir.",
  playerIncidenceMultiplier: .82,
  playerMortalityMultiplier: .68,
  criticalGraceDays: 2,
});

export function advanceBalancedRiskState(person, burden = 0, clock = {}) {
  const previous = person?.medical?.gameplayRisk && typeof person.medical.gameplayRisk === "object" ? person.medical.gameplayRisk : {};
  const critical = Number(person?.health || 0) < 24 || burden >= 78 || asArray(person?.medical?.conditions).some((condition) => Number(condition.severity || 0) >= 82);
  const state = {
    version: GAMEPLAY_DIFFICULTY_VERSION,
    criticalDays: critical ? Math.min(30, Number(previous.criticalDays || 0) + 1) : Math.max(0, Number(previous.criticalDays || 0) - 1),
    lastEvaluatedWeek: Number(clock.week || 1),
    lastEvaluatedDay: Number(clock.day || 0),
    burden: Math.round(Number(burden || 0)),
    warned: critical || Number(person?.health || 0) < 38,
  };
  if (person?.medical) person.medical.gameplayRisk = state;
  return state;
}

export function balancedPlayerMortalityChance(baseChance, person, riskState = person?.medical?.gameplayRisk) {
  let chance = Math.max(0, Number(baseChance) || 0) * GAMEPLAY_DIFFICULTY.playerMortalityMultiplier;
  const age = Number(person?.age || 0);
  if (age < 85 && Number(riskState?.criticalDays || 0) < GAMEPLAY_DIFFICULTY.criticalGraceDays) chance = 0;
  if (person?.medical?.admitted) chance *= .55;
  if (asArray(person?.medical?.medications).some((medication) => Number(medication.remaining || 0) > 0)) chance *= .82;
  return Math.min(.025, chance);
}

export function selectBalancedCondition(person, candidates, random = Math.random) {
  const age = Number(person?.age || 0), health = Number(person?.health || 100), stress = Number(person?.mind?.emotional?.stress ?? person?.mind?.state?.stress ?? 35);
  const weighted = asArray(candidates).map((condition) => {
    let weight = 1 + Number(condition.ageRisk || 0) * Math.max(0, age - 25) / 8;
    if (["stroke", "heart_disease"].includes(condition.id) && age < 40) weight *= .04;
    if (["cancer", "kidney_disease"].includes(condition.id) && age < 30) weight *= .12;
    if (condition.id === "burnout") weight *= stress > 65 ? 3 : .35;
    if (["flu", "food_poisoning", "migraine", "appendicitis", "dental_infection"].includes(condition.id)) weight *= 2.2;
    if (health < 45) weight *= 1.25;
    return { condition, weight: Math.max(.01, weight) };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0), roll = Math.max(0, Math.min(.999999, random())) * total;
  let cursor = 0;
  return weighted.find((item) => (cursor += item.weight) >= roll)?.condition || weighted.at(-1)?.condition || null;
}

function riskLevel(score) {
  if (score >= 78) return { id: "critical", label: "Crítico", tone: "danger" };
  if (score >= 55) return { id: "high", label: "Alto", tone: "warning" };
  if (score >= 30) return { id: "attention", label: "Atenção", tone: "attention" };
  return { id: "low", label: "Baixo", tone: "safe" };
}

export function getGameplayRiskProfile(person, simulation = {}) {
  if (!person) return { overall: 0, level: riskLevel(0), warnings: [], protections: [] };
  const conditions = asArray(person.medical?.conditions), burden = conditions.reduce((sum, condition) => sum + Number(condition.severity || 0), 0);
  const untreated = conditions.filter((condition) => !asArray(person.medical?.medications).some((medication) => medication.conditionId === condition.id && medication.remaining > 0)).length;
  const health = clamp(person.health), energy = clamp(person.energy), stress = clamp(person.mind?.emotional?.stress ?? person.mind?.state?.stress ?? 35);
  const healthScore = clamp((100 - health) * .82 + Math.min(45, burden * .34) + untreated * 5 + Math.max(0, Number(person.age || 0) - 60) * .4);
  const mobilityScore = person.currentTrip ? clamp((100 - energy) * .28 + Number(simulation.environment?.current?.accidentRisk || 0) * .45 + Number(simulation.transportSystem?.congestionIndex || 0) * 18) : 0;
  const home = simulation.buildings?.find((building) => building.id === person.homeId), districtCrimes = simulation.urbanEvolution?.districtMetrics?.[home?.districtId]?.crimes || 0;
  const undergroundExposure = asArray(simulation.underground?.enterprises)
    .filter((scheme) => scheme.leaderId === person.id || asArray(scheme.memberIds).includes(person.id) || asArray(scheme.customers).includes(person.id))
    .reduce((highest, scheme) => Math.max(highest, Number(scheme.heat || 0)), 0);
  const safetyScore = clamp(districtCrimes * 8 + (person.justice?.offenses?.length || 0) * 2 + undergroundExposure * .5);
  const exhaustionScore = clamp((100 - energy) * .55 + Math.max(0, stress - 45) * .45 + (person.shift?.hours > 44 ? 12 : 0));
  const overall = Math.round(Math.max(healthScore, exhaustionScore * .78, mobilityScore * .72, safetyScore * .65));
  const warnings = [];
  if (healthScore >= 55) warnings.push({ id: "health", title: "Saúde exige atenção", detail: conditions.length ? "Condições ativas podem piorar sem acompanhamento." : "A reserva geral de saúde está baixa.", response: "Procure uma unidade de saúde e reduza a sobrecarga." });
  if (energy < 24) warnings.push({ id: "energy", title: "Exaustão importante", detail: "Pouca energia aumenta estresse, adoecimento e risco durante deslocamentos.", response: "Descanse e reorganize a rotina." });
  if (stress > 76) warnings.push({ id: "stress", title: "Estresse muito elevado", detail: "A saúde mental e os relacionamentos podem se deteriorar.", response: "Busque descanso, apoio ou atendimento no CAPS." });
  if (mobilityScore >= 50) warnings.push({ id: "mobility", title: "Deslocamento de maior risco", detail: "Clima, cansaço ou congestionamento elevam o risco de acidente.", response: "Considere transporte público, táxi ou adiar a viagem." });
  if (undergroundExposure >= 55) warnings.push({ id: "underground", title: "Exposição clandestina elevada", detail: `Um esquema ligado ao personagem acumula ${Math.round(undergroundExposure)}% de atenção policial.`, response: "Afaste-se da atividade ou reduza sua exposição antes de uma operação." });
  const protections = [];
  if (person.medical?.admitted) protections.push("Internação e monitoramento hospitalar");
  if (asArray(person.medical?.medications).length) protections.push("Tratamento medicamentoso ativo");
  if (health >= 75) protections.push("Boa reserva geral de saúde");
  if (energy >= 55) protections.push("Energia adequada");
  if (person.needs?.social >= 55) protections.push("Rede social protetiva");
  return { difficulty: GAMEPLAY_DIFFICULTY, overall, level: riskLevel(overall), scores: { health: Math.round(healthScore), exhaustion: Math.round(exhaustionScore), mobility: Math.round(mobilityScore), safety: Math.round(safetyScore) }, burden: Math.round(burden), untreated, undergroundExposure: Math.round(undergroundExposure), criticalDays: Number(person.medical?.gameplayRisk?.criticalDays || 0), warnings, protections };
}
