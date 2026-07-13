const clamp = (value, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

export const PLAYER_GOAL_MILESTONES = Object.freeze({
  career: [[20, "Conseguir uma oportunidade"], [45, "Firmar uma rotina profissional"], [70, "Crescer na carreira"], [100, "Construir uma trajetória reconhecida"]],
  education: [[20, "Ingressar em uma instituição"], [45, "Criar ritmo de estudos"], [70, "Consolidar competências"], [100, "Concluir uma formação marcante"]],
  family: [[20, "Fortalecer um vínculo afetivo"], [45, "Assumir um compromisso"], [70, "Construir um lar compartilhado"], [100, "Formar uma rede familiar duradoura"]],
  community: [[20, "Conhecer as demandas da cidade"], [45, "Participar da vida pública"], [70, "Mobilizar a comunidade"], [100, "Deixar um legado coletivo"]],
  entrepreneurship: [[20, "Definir uma oportunidade"], [45, "Reunir capital e experiência"], [70, "Assumir um negócio"], [100, "Consolidar uma empresa local"]],
  wealth: [[20, "Criar uma reserva"], [45, "Organizar renda e crédito"], [70, "Adquirir patrimônio"], [100, "Alcançar segurança financeira"]],
  social: [[20, "Conhecer pessoas"], [45, "Criar amizades de confiança"], [70, "Cultivar uma rede próxima"], [100, "Ter uma vida social memorável"]],
  notability: [[20, "Ser lembrado por uma ação"], [45, "Ganhar relevância local"], [70, "Influenciar a cidade"], [100, "Tornar-se parte da história local"]],
  underground: [[20, "Descobrir o submundo"], [45, "Construir contatos de risco"], [70, "Ganhar influência clandestina"], [100, "Tornar-se uma lenda controversa"]],
});

const romanticWeight = Object.freeze({
  paquera: 12,
  ficante_casual: 20,
  ficante_recorrente: 28,
  ficante_exclusivo: 38,
  namoro: 52,
  uniao_estavel: 72,
  noivado: 82,
  casamento: 92,
});

export function derivePlayerGoalProgress(goalId, person, simulation) {
  if (!person || !simulation) return 0;
  const relationships = simulation.relationshipsOf?.(person) || [];
  const strongLinks = relationships.filter(({ link }) => (link.affinity || 0) >= 45 && (link.trust || 0) >= 35);
  const romantic = relationships.filter(({ link }) => link.lifecycle?.status === "active");
  const family = simulation.familyOf?.(person);
  const ownedHomes = (simulation.buildings || []).filter((building) => building.ownerId === person.id || building.ownerFamilyId === family?.id);
  const ownedBusinesses = (simulation.businesses || []).filter((business) => business.ownerId === person.id || business.ownerFamilyId === family?.id || business.familyId === family?.id);
  const reputation = Number(person.playerState?.reputation || person.notability?.score || 0);
  const criminalHistory = person.justice?.history?.length || 0;

  if (goalId === "career") {
    const employed = Boolean(person.shift && person.workplace && !/desempregado/i.test(person.role || ""));
    return clamp((employed ? 28 : 0) + Math.min(32, (person.playerControl?.workMinutesThisWeek || 0) / 30) + Math.min(24, (person.hourlyWage || 0) * 1.1) + Math.min(16, (person.skills ? Object.values(person.skills).reduce((sum, value) => sum + Number(value || 0), 0) / Math.max(1, Object.keys(person.skills).length) : 0) * .16));
  }
  if (goalId === "education") return clamp((person.education?.enrolled ? 25 : 0) + (person.education?.performance || 0) * .42 + Math.min(25, (person.education?.credits || 0) * 2));
  if (goalId === "family") {
    const stage = romantic.reduce((best, { link }) => Math.max(best, romanticWeight[link.lifecycle?.stage] || 0), 0);
    return clamp(stage + Math.min(18, (person.children?.length || 0) * 10) + (romantic.some(({ link }) => link.lifecycle?.cohabitation?.active) ? 10 : 0));
  }
  if (goalId === "community") {
    const civicRole = /prefeit|vereador|secretári|servidor|assistente social|professor|saúde/i.test(`${person.role || ""} ${person.workplace || ""}`);
    const civicMemories = (person.history || []).filter((item) => /comunidade|municipal|públic|volunt|eleiç|projeto|bairro/i.test(item.text || "")).length;
    return clamp((civicRole ? 35 : 0) + Math.min(45, civicMemories * 7) + Math.max(0, reputation) * .2);
  }
  if (goalId === "entrepreneurship") return clamp(ownedBusinesses.length * 72 + Math.min(28, Math.max(0, person.money || 0) / 1000));
  if (goalId === "wealth") return clamp(Math.log10(Math.max(1, (person.money || 0) + (family?.wealth || 0) + ownedHomes.reduce((sum, home) => sum + (home.value || 0), 0))) * 19 - 38 + ownedHomes.length * 12);
  if (goalId === "social") return clamp(Math.min(52, strongLinks.length * 8) + Math.min(28, relationships.filter(({ link }) => (link.familiarity || 0) >= 30).length * 3) + Math.min(20, romantic.length * 10));
  if (goalId === "notability") return clamp(Math.max(0, reputation) + (person.notability?.famous ? 35 : 0) + Math.min(25, person.notability?.notableActions?.length * 5));
  if (goalId === "underground") {
    const contacts = relationships.filter(({ person: other }) => other.justice?.history?.length || other.underground).length;
    return clamp(criminalHistory * 7 + contacts * 4 + (person.justice?.incarcerated ? 18 : 0));
  }
  return 0;
}

export function nextPlayerGoalMilestone(goalId, progress = 0) {
  const milestones = PLAYER_GOAL_MILESTONES[goalId] || [];
  return milestones.find(([threshold]) => progress < threshold) || milestones.at(-1) || [100, "Objetivo concluído"];
}
