/**
 * Projeções somente leitura da administração municipal.
 *
 * O módulo reúne Politics, LocalGovernment e a posição física das pessoas sem
 * depender da UI e sem alterar a Simulation recebida.
 */

export const MUNICIPAL_PROFILES_VERSION = 1;

export const MUNICIPAL_PROFILE_LIMITS = Object.freeze({
  internalOffices: 16,
  secretaries: 32,
  civilServants: 180,
  councilors: 32,
  all: 260,
  visitors: 80,
  legislation: 24,
  sessions: 16,
  decisions: 20,
  publicWorks: 24,
});

const asArray = (value) => (Array.isArray(value) ? value : []);
const text = (value, fallback = "") => String(value ?? fallback).trim();
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const limited = (value, limit) => asArray(value).slice(0, Math.max(0, limit));
const normalized = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const cityHallBuilding = (sim) => {
  const indexed = sim?.buildingNameIndex?.get?.("Prefeitura");
  return indexed
    || asArray(sim?.buildings).find((building) => normalized(building.name) === "prefeitura")
    || asArray(sim?.buildings).find((building) => building.type === "civic" && /prefeit/.test(normalized(building.name)))
    || null;
};

const buildingById = (sim, id) => sim?.buildingIndex?.get?.(id) || asArray(sim?.buildings).find((building) => building.id === id) || null;

const addressSnapshot = (address) => address ? {
  streetId: address.streetId || null,
  street: address.street || null,
  number: address.number ?? null,
  district: address.district || null,
  postalCode: address.postalCode || null,
  accessSurface: address.accessSurface || null,
} : null;

const isOnDuty = (person, sim) => {
  const shift = person?.shift;
  if (!shift || !asArray(shift.days).includes(finite(sim?.day))) return false;
  const hour = finite(sim?.minute) / 60;
  const start = finite(shift.start);
  const end = finite(shift.end);
  return end < start ? hour >= start || hour < end : hour >= start && hour < end;
};

function locationSnapshot(sim, person, cityHall, workplaceBuildingId) {
  if (!person) return {
    buildingId: null,
    name: "Localização indisponível",
    districtId: null,
    address: null,
    x: null,
    y: null,
    inTransit: false,
    destinationBuildingId: null,
    destinationName: null,
  };
  const current = buildingById(sim, person.locationId);
  const destinationId = person.currentTrip?.destinationId || person.destinationId || person.currentAction?.destinationId || null;
  const destination = buildingById(sim, destinationId);
  return {
    buildingId: current?.id || person.locationId || null,
    name: current?.name || (person.currentTrip ? "Em deslocamento" : "Localização indisponível"),
    districtId: current?.districtId || null,
    address: addressSnapshot(current?.address),
    x: Number.isFinite(Number(person.x)) ? Number(person.x) : current ? finite(current.x) + finite(current.w) / 2 : null,
    y: Number.isFinite(Number(person.y)) ? Number(person.y) : current ? finite(current.y) + finite(current.h) / 2 : null,
    inTransit: Boolean(person.currentTrip),
    destinationBuildingId: destination?.id || destinationId,
    destinationName: destination?.name || null,
    workplaceBuildingId: workplaceBuildingId || cityHall?.id || null,
  };
}

function presenceSnapshot(sim, person, location, cityHall, workplaceBuildingId) {
  const atCityHall = Boolean(person && cityHall && !person.currentTrip && person.locationId === cityHall.id);
  const atWorkplace = Boolean(person && workplaceBuildingId && !person.currentTrip && person.locationId === workplaceBuildingId);
  const status = !person
    ? "vacant"
    : person.alive === false
      ? "unavailable"
      : person.currentTrip
        ? "in_transit"
        : atCityHall
          ? "at_city_hall"
          : atWorkplace
            ? "at_workplace"
            : person.locationId
              ? "elsewhere"
              : "unknown";
  return {
    status,
    atCityHall,
    atWorkplace,
    onDuty: Boolean(person?.alive !== false && isOnDuty(person, sim)),
    currentAction: person?.currentAction?.text || person?.activity || null,
    currentSpaceId: person?.currentAction?.spaceId || null,
    currentSpaceName: person?.currentAction?.spaceName || null,
    canLocate: Boolean(person && Number.isFinite(location.x) && Number.isFinite(location.y)),
  };
}

const politicsState = (sim) => sim?.politics?.state || sim?.governance?.politics || {};

function politicalOfficeFallback(sim, kind) {
  const politics = politicsState(sim);
  const holder = kind === "mayor" ? politics.officeHolders?.mayor : politics.officeHolders?.deputyMayor;
  if (!holder) return null;
  return {
    id: `office-${kind}-${holder.personId || "vacant"}`,
    kind,
    title: kind === "mayor" ? "Prefeito(a)" : "Vice-prefeito(a)",
    branch: "executive",
    appointment: "elected",
    personId: holder.personId || null,
    personName: holder.name,
    partyId: holder.partyId || null,
    mandateId: asArray(politics.mandates).find((mandate) => mandate.status === "active")?.id || null,
    sinceWeek: holder.sinceWeek,
    endWeek: holder.endWeek,
    status: holder.personId ? "active" : "vacant",
    acting: Boolean(holder.acting),
    responsibilities: kind === "mayor" ? ["dirigir o Executivo", "sancionar leis", "executar o orçamento"] : ["substituir o prefeito", "coordenar projetos intersetoriais"],
  };
}

function politicalCouncilFallback(sim) {
  const politics = politicsState(sim);
  return asArray(politics.council?.members).map((member) => ({
    id: `office-councilor-${member.personId || member.candidateId}`,
    kind: "councilor",
    title: "Vereador(a)",
    branch: "legislative",
    appointment: "elected",
    personId: member.personId || null,
    personName: member.name,
    partyId: member.partyId || null,
    sinceWeek: member.mandateStart,
    endWeek: member.mandateEnd,
    status: member.personId ? "active" : "vacant",
    sourceCandidateId: member.candidateId,
    responsibilities: ["legislar", "fiscalizar o Executivo", "representar a população"],
  }));
}

function buildProfile({ sim, office, category, organ, department = null, assignment = null, cityHall, parties }) {
  if (!office && !assignment) return null;
  const personId = office?.personId || assignment?.personId || null;
  const person = asArray(sim?.people).find((candidate) => candidate.id === personId) || null;
  const workplaceBuildingId = assignment?.workplaceBuildingId || cityHall?.id || null;
  const localizacao = locationSnapshot(sim, person, cityHall, workplaceBuildingId);
  const presenca = presenceSnapshot(sim, person, localizacao, cityHall, workplaceBuildingId);
  const partyId = office?.partyId || null;
  const party = parties.get(partyId);
  const cargo = office?.title || assignment?.role || person?.role || "Servidor(a) municipal";
  return {
    id: office?.id || assignment?.officeId || `municipal-${department?.id || "general"}-${personId || cargo}`,
    personId,
    name: person?.name || office?.personName || "Cargo vago",
    firstName: person?.firstName || null,
    alive: person ? person.alive !== false : null,
    cargo,
    orgao: organ,
    category,
    branch: office?.branch || (category === "councilor" ? "legislative" : "administrative"),
    departmentId: department?.id || office?.departmentId || assignment?.departmentId || null,
    departmentName: department?.name || null,
    appointment: office?.appointment || (category === "civil_servant" ? "civil_service" : assignment?.contract || null),
    mandateId: office?.mandateId || sim?.localGovernment?.calendar?.mandateId || null,
    sinceWeek: office?.sinceWeek ?? null,
    endWeek: office?.endWeek ?? null,
    status: personId ? office?.status || "active" : "vacant",
    acting: Boolean(office?.acting),
    salaryPerWeek: finite(office?.salaryPerWeek ?? assignment?.salaryPerWeek),
    responsibilities: limited(office?.responsibilities || (department?.mission ? [department.mission] : []), 8),
    party: party ? { id: party.id, name: party.name, acronym: party.acronym, color: party.color } : null,
    workplace: {
      buildingId: workplaceBuildingId,
      name: assignment?.workplace || (category === "councilor" ? "Câmara Municipal" : cityHall?.name || "Prefeitura"),
      spaceId: assignment?.spaceId || null,
      organ,
    },
    localizacao,
    presenca,
  };
}

export function getMunicipalRoster(sim) {
  const local = sim?.localGovernment || {};
  const politics = politicsState(sim);
  const parties = new Map(asArray(politics.parties).map((party) => [party.id, party]));
  const cityHall = cityHallBuilding(sim);
  const assignments = asArray(local.workforce?.assignments);
  const assignmentByPerson = new Map(assignments.map((assignment) => [assignment.personId, assignment]));
  const departments = asArray(local.departments);
  const departmentById = new Map(departments.map((department) => [department.id, department]));
  const executive = local.executive || {};
  const mayorOffice = executive.mayor || politicalOfficeFallback(sim, "mayor");
  const deputyOffice = executive.deputyMayor || politicalOfficeFallback(sim, "deputy_mayor");
  const mayor = buildProfile({ sim, office: mayorOffice, category: "mayor", organ: "Gabinete do Prefeito", assignment: assignmentByPerson.get(mayorOffice?.personId), cityHall, parties });
  const deputyMayor = buildProfile({ sim, office: deputyOffice, category: "deputy_mayor", organ: "Gabinete do Vice-prefeito", assignment: assignmentByPerson.get(deputyOffice?.personId), cityHall, parties });
  const internalOffices = limited(executive.internalOffices, MUNICIPAL_PROFILE_LIMITS.internalOffices).map((office) => buildProfile({
    sim, office, category: "internal_office", organ: "Gabinete e órgãos de controle", assignment: assignmentByPerson.get(office.personId), cityHall, parties,
  })).filter(Boolean);
  const secretaries = limited(executive.secretaries, MUNICIPAL_PROFILE_LIMITS.secretaries).map((office) => {
    const department = departmentById.get(office.departmentId);
    return buildProfile({ sim, office, category: "secretary", organ: department?.name || office.title, department, assignment: assignmentByPerson.get(office.personId), cityHall, parties });
  }).filter(Boolean);
  const councilOffices = asArray(local.legislature?.councilors).length ? local.legislature.councilors : politicalCouncilFallback(sim);
  const councilors = limited(councilOffices, MUNICIPAL_PROFILE_LIMITS.councilors).map((office) => buildProfile({
    sim, office, category: "councilor", organ: "Câmara Municipal", assignment: assignmentByPerson.get(office.personId), cityHall, parties,
  })).filter(Boolean);
  const officePeople = new Set([mayor, deputyMayor, ...internalOffices, ...secretaries, ...councilors].map((profile) => profile?.personId).filter(Boolean));
  const civilServants = [];
  for (const department of departments) {
    for (const personId of asArray(department.servantIds)) {
      if (civilServants.length >= MUNICIPAL_PROFILE_LIMITS.civilServants || officePeople.has(personId)) continue;
      const assignment = assignmentByPerson.get(personId) || { personId, departmentId: department.id, role: "Servidor(a) municipal", workplace: department.name };
      const profile = buildProfile({ sim, assignment, category: "civil_servant", organ: department.name, department, cityHall, parties });
      if (profile) civilServants.push(profile);
    }
  }
  const all = [mayor, deputyMayor, ...internalOffices, ...secretaries, ...civilServants, ...councilors].filter(Boolean).slice(0, MUNICIPAL_PROFILE_LIMITS.all);
  const departmentProfiles = departments.slice(0, 32).map((department) => ({
    id: department.id,
    name: department.name,
    shortName: department.shortName,
    mission: department.mission,
    secretary: secretaries.find((profile) => profile.departmentId === department.id) || null,
    civilServants: civilServants.filter((profile) => profile.departmentId === department.id),
    authorizedPosts: finite(department.authorizedPosts),
    filledPosts: asArray(department.servantIds).length,
    vacancies: finite(department.vacancies),
    performance: finite(department.performance),
    serviceLevel: finite(department.serviceLevel),
    workload: finite(department.workload),
    backlog: finite(department.backlog),
  }));
  return {
    version: MUNICIPAL_PROFILES_VERSION,
    week: finite(sim?.week, finite(local.calendar?.week, 1)),
    day: finite(sim?.day),
    minute: finite(sim?.minute),
    mandateId: local.calendar?.mandateId || asArray(politics.mandates).find((mandate) => mandate.status === "active")?.id || null,
    cityHallBuildingId: cityHall?.id || null,
    mayor,
    deputyMayor,
    internalOffices,
    secretaries,
    civilServants,
    councilors,
    departments: departmentProfiles,
    all,
    totals: {
      positions: all.length,
      occupied: all.filter((profile) => profile.personId).length,
      vacant: all.filter((profile) => !profile.personId).length + finite(local.workforce?.vacancies),
      presentAtCityHall: all.filter((profile) => profile.presenca.atCityHall).length,
      inTransit: all.filter((profile) => profile.presenca.status === "in_transit").length,
      onDuty: all.filter((profile) => profile.presenca.onDuty).length,
      weeklyPayroll: finite(local.workforce?.weeklyPayroll),
    },
  };
}

const lawSnapshot = (law) => ({
  id: law.id,
  proposalId: law.proposalId || null,
  title: law.title || law.name,
  status: law.status,
  stage: law.stage,
  departmentId: law.departmentId || null,
  enactedWeek: law.enactedWeek ?? law.sanctionedWeek ?? null,
  implementationProgress: finite(law.implementation?.progress),
});

const proposalSnapshot = (proposal) => ({
  id: proposal.id,
  title: proposal.title || proposal.name,
  summary: proposal.summary || null,
  status: proposal.status,
  stage: proposal.stage,
  sponsorId: proposal.sponsorId || null,
  departmentId: proposal.departmentId || proposal.area || null,
  createdWeek: proposal.createdWeek ?? null,
  updatedWeek: proposal.updatedWeek ?? null,
  publicSupport: finite(proposal.publicSupport),
});

export function getCityHallSnapshot(sim) {
  const roster = getMunicipalRoster(sim);
  const local = sim?.localGovernment || {};
  const politics = politicsState(sim);
  const cityHall = cityHallBuilding(sim);
  const rosterPeople = new Set(roster.all.map((profile) => profile.personId).filter(Boolean));
  const peopleAtCityHall = cityHall ? asArray(sim?.people).filter((person) => person.alive !== false && !person.currentTrip && person.locationId === cityHall.id) : [];
  const activeMandate = asArray(politics.mandates).find((mandate) => mandate.status === "active") || null;
  return {
    version: MUNICIPAL_PROFILES_VERSION,
    generatedAt: { week: roster.week, day: roster.day, minute: roster.minute },
    cityHall: cityHall ? {
      id: cityHall.id,
      name: cityHall.name,
      type: cityHall.type,
      x: finite(cityHall.x),
      y: finite(cityHall.y),
      width: finite(cityHall.w),
      height: finite(cityHall.h),
      capacity: finite(cityHall.capacity),
      occupied: finite(cityHall.occupied),
      districtId: cityHall.districtId || null,
      address: addressSnapshot(cityHall.address),
    } : null,
    mandate: {
      id: roster.mandateId,
      term: finite(politics.calendar?.term),
      phase: local.calendar?.phase || politics.phase || "government",
      startWeek: local.calendar?.mandateStartWeek ?? activeMandate?.startWeek ?? null,
      endWeek: local.calendar?.mandateEndWeek ?? activeMandate?.endWeek ?? null,
      nextElectionWeek: local.calendar?.nextElectionWeek ?? politics.calendar?.nextElectionWeek ?? null,
      transition: Boolean(local.calendar?.transition),
      approval: finite(politics.approval?.overall, finite(sim?.governance?.approval)),
      coalitionPartyIds: limited(local.legislature?.coalitionPartyIds || politics.council?.coalition, 16),
      oppositionPartyIds: limited(local.legislature?.oppositionPartyIds || politics.council?.opposition, 16),
    },
    roster,
    presence: {
      municipalProfiles: roster.all.filter((profile) => profile.presenca.atCityHall),
      visitors: peopleAtCityHall.filter((person) => !rosterPeople.has(person.id)).slice(0, MUNICIPAL_PROFILE_LIMITS.visitors).map((person) => ({
        personId: person.id,
        name: person.name,
        role: person.role,
        currentAction: person.currentAction?.text || person.activity || null,
        x: Number.isFinite(Number(person.x)) ? Number(person.x) : null,
        y: Number.isFinite(Number(person.y)) ? Number(person.y) : null,
      })),
      totalAtCityHall: peopleAtCityHall.length,
      municipalCount: peopleAtCityHall.filter((person) => rosterPeople.has(person.id)).length,
    },
    administration: {
      authorizedPositions: finite(local.workforce?.authorizedPositions),
      filledPositions: finite(local.workforce?.filledPositions, roster.totals.occupied),
      vacancies: finite(local.workforce?.vacancies),
      weeklyPayroll: finite(local.workforce?.weeklyPayroll),
      hires: finite(local.workforce?.hires),
      departures: finite(local.workforce?.departures),
      indicators: {
        administrativeCapacity: finite(local.indicators?.administrativeCapacity),
        legislativeProductivity: finite(local.indicators?.legislativeProductivity),
        transparency: finite(local.indicators?.transparency),
        fiscalPressure: finite(local.indicators?.fiscalPressure),
        servicePressure: finite(local.indicators?.servicePressure),
      },
    },
    legislation: {
      proposals: limited(local.proposals, MUNICIPAL_PROFILE_LIMITS.legislation).map(proposalSnapshot),
      laws: limited(local.laws, MUNICIPAL_PROFILE_LIMITS.legislation).map(lawSnapshot),
      sessions: limited(local.sessions, MUNICIPAL_PROFILE_LIMITS.sessions).map((session) => ({
        id: session.id,
        title: session.title,
        status: session.status,
        week: session.week,
        attendeeIds: limited(session.attendeeIds, 40),
        agendaCount: asArray(session.agenda).length,
        voteCount: asArray(session.votes).length,
      })),
    },
    decisions: limited(local.decisions, MUNICIPAL_PROFILE_LIMITS.decisions).map((decision) => ({
      id: decision.id,
      title: decision.title,
      summary: decision.summary,
      status: decision.status,
      week: decision.week,
      authorityPersonId: decision.authorityPersonId || null,
    })),
    publicWorks: limited(local.publicWorks, MUNICIPAL_PROFILE_LIMITS.publicWorks).map((work) => ({
      id: work.id,
      name: work.name,
      type: work.type,
      status: work.status,
      stage: work.stage,
      progress: finite(work.progress),
      districtId: work.districtId || null,
      streetId: work.streetId || null,
      budget: finite(work.budget),
      spent: finite(work.spent),
      expectedWeeks: finite(work.expectedWeeks),
    })),
  };
}

export const municipalProfilesApi = Object.freeze({
  getMunicipalRoster,
  getCityHallSnapshot,
});
