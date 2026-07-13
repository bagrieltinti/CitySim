/**
 * Índice de parentesco da Cidade Viva.
 *
 * A direção das consultas é sempre `pessoa -> parente`: por exemplo,
 * `relationBetween(filho, mãe)` retorna "mãe" e
 * `relationBetween(mãe, filho)` retorna "filho".
 *
 * O módulo não altera os cidadãos recebidos. Quando nascimentos, uniões ou
 * separações mudarem os dados, chame `rebuild` para reconstruir o índice.
 */

const DEFAULT_PARTNER_TYPES = [
  "casamento",
  "conjuge",
  "cônjuge",
  "uniao",
  "união",
  "uniao estavel",
  "união estável",
  "parceria",
  "parceiro",
  "companheiro",
  "coabitacao",
  "coabitação",
  "uniao_estavel",
  "noivado",
];

const DEFAULT_OPTIONS = {
  inferParentsFromChildren: true,
  inferPartnersFromRelationships: true,
  includeFormerPartners: false,
  maxLineageDepth: 100,
  genderResolver: null,
  partnerRelationshipTypes: DEFAULT_PARTNER_TYPES,
};

const toArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
const idOf = (reference) =>
  reference && typeof reference === "object" ? reference.id : reference;
const normalized = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const compareIds = (a, b) => String(a).localeCompare(String(b), "pt-BR");
const addToSetMap = (map, key, value) => {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
};
const intersection = (a = new Set(), b = new Set()) =>
  [...a].filter((value) => b.has(value));
const equalSets = (a = new Set(), b = new Set()) =>
  a.size === b.size && [...a].every((value) => b.has(value));
const isLiving = (person) => person?.alive !== false;

/** Retorna `masculine`, `feminine` ou `neutral`. */
export function grammaticalGender(person) {
  const value = normalized(
    person?.identity ?? person?.gender ?? person?.genero ?? person?.sexo ?? person?.sex,
  );
  if (/mulher|feminin|female|woman/.test(value)) return "feminine";
  if (/homem|masculin|^male$|^man$/.test(value)) return "masculine";
  return "neutral";
}

const roleLabel = (person, masculine, feminine, neutral = `${masculine}/${feminine}`) => {
  const gender = grammaticalGender(person);
  if (gender === "masculine") return masculine;
  if (gender === "feminine") return feminine;
  return neutral;
};

const ordinal = (number) => `${number}º`;
const generationDistanceText = (removed) => {
  if (!removed) return "";
  return `, ${removed} ${removed === 1 ? "geração distante" : "gerações distantes"}`;
};

const parentLabel = (person) => roleLabel(person, "pai", "mãe", "genitor");
const childLabel = (person) => roleLabel(person, "filho", "filha", "descendente direto");
const siblingLabel = (person, half = false) =>
  half
    ? roleLabel(person, "meio-irmão", "meia-irmã", "meio-irmão/irmã")
    : roleLabel(person, "irmão", "irmã", "irmão/irmã");
const grandparentLabel = (person, depth) => {
  if (depth === 2) return roleLabel(person, "avô", "avó", "avô/avó");
  if (depth === 3) return roleLabel(person, "bisavô", "bisavó", "bisavô/bisavó");
  if (depth === 4) return roleLabel(person, "trisavô", "trisavó", "trisavô/trisavó");
  if (depth === 5) return roleLabel(person, "tetravô", "tetravó", "tetravô/tetravó");
  return `ancestral de ${ordinal(depth)} geração`;
};
const grandchildLabel = (person, depth) => {
  if (depth === 2) return roleLabel(person, "neto", "neta", "neto(a)");
  if (depth === 3) return roleLabel(person, "bisneto", "bisneta", "bisneto(a)");
  if (depth === 4) return roleLabel(person, "trineto", "trineta", "trineto(a)");
  if (depth === 5) return roleLabel(person, "tetraneto", "tetraneta", "tetraneto(a)");
  return `descendente de ${ordinal(depth)} geração`;
};
const uncleLabel = (person, great = 0) => {
  const base = roleLabel(person, "tio", "tia", "tio/tia");
  if (!great) return base;
  if (great === 1) return `${base}-avô`;
  return `${base}-avô de ${ordinal(great)} nível`;
};
const nephewLabel = (person, great = 0) => {
  const base = roleLabel(person, "sobrinho", "sobrinha", "sobrinho(a)");
  if (!great) return base;
  if (great === 1) return `${base}-neto`;
  return `${base}-neto de ${ordinal(great)} nível`;
};
const cousinLabel = (person, degree, removed) => {
  const base = roleLabel(person, "primo", "prima", "primo(a)");
  return `${base} de ${ordinal(degree)} grau${generationDistanceText(removed)}`;
};

const descriptor = (kind, label, priority, extra = {}) => ({
  kind,
  label,
  priority,
  distance: extra.distance ?? null,
  degree: extra.degree ?? null,
  removed: extra.removed ?? 0,
  byAffinity: Boolean(extra.byAffinity),
  consanguineous: extra.consanguineous ?? !extra.byAffinity,
  ...extra,
});

const relationshipIsActive = (link, includeFormerPartners) => {
  if (includeFormerPartners) return true;
  if (link?.active === false || link?.endedWeek != null || link?.endedAt != null) return false;
  const status = normalized(link?.status);
  return !/terminad|encerrad|separad|divorciad|rompid|falecid/.test(status);
};

/**
 * Índice imutável por revisão. Ele mantém Map/Set para consultas rápidas e
 * caches de ancestralidade/descendência, sem escrever nos objetos da simulação.
 */
export class KinshipIndex {
  constructor(people = [], relationships = [], options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.options.partnerRelationshipTypes = new Set(
      toArray(this.options.partnerRelationshipTypes).map(normalized),
    );
    this.version = 0;
    this.rebuild(people, relationships);
  }

  rebuild(people = this.people ?? [], relationships = this.relationships ?? []) {
    this.people = Array.isArray(people) ? people : [];
    this.relationships = Array.isArray(relationships) ? relationships : [];
    this.byId = new Map();
    this.parents = new Map();
    this.children = new Map();
    this.partners = new Map();
    this.partnerKinds = new Map();
    this.households = new Map();
    this.registeredFamilies = new Map();
    this._ancestorCache = new Map();
    this._descendantCache = new Map();
    this._selfParentIds = new Set();
    this.issues = {
      invalidPeople: [],
      duplicateIds: [],
      unknownParentRefs: [],
      unknownChildRefs: [],
      unknownPartnerRefs: [],
      unknownRelationshipRefs: [],
      selfParenting: [],
      selfPartnerships: [],
      asymmetricPartners: [],
      implausibleParentAges: [],
    };

    this.people.forEach((person, index) => {
      if (!person || person.id == null) {
        this.issues.invalidPeople.push({ index, person });
        return;
      }
      if (this.byId.has(person.id)) {
        this.issues.duplicateIds.push(person.id);
        return;
      }
      this.byId.set(person.id, person);
      this.parents.set(person.id, new Set());
      this.children.set(person.id, new Set());
      this.partners.set(person.id, new Set());
      if (person.homeId != null) addToSetMap(this.households, person.homeId, person.id);
      if (person.familyId != null) addToSetMap(this.registeredFamilies, person.familyId, person.id);
    });

    this.byId.forEach((person, childId) => {
      toArray(person.parents).forEach((parentId) =>
        this._addParent(parentId, childId, "parents"),
      );
    });

    if (this.options.inferParentsFromChildren) {
      this.byId.forEach((person, parentId) => {
        toArray(person.children).forEach((childId) =>
          this._addParent(parentId, childId, "children"),
        );
      });
    }

    this.byId.forEach((person, personId) => {
      const partnerId = idOf(person.partnerId);
      if (partnerId == null) return;
      const relationship = this.relationships.find((link) => {
        const a = idOf(link?.a ?? link?.personAId ?? link?.fromId);
        const b = idOf(link?.b ?? link?.personBId ?? link?.toId);
        return (a === personId && b === partnerId) || (a === partnerId && b === personId);
      });
      const type = normalized(relationship?.type ?? relationship?.kind);
      const stage = normalized(relationship?.lifecycle?.stage ?? relationship?.relationship?.stage);
      const cohabiting = Boolean(relationship?.lifecycle?.cohabitation?.active ?? relationship?.cohabiting);
      const sharedChild = toArray(person.children).some((childId) => toArray(this.byId.get(partnerId)?.children).includes(childId));
      const structural = cohabiting || sharedChild || this.options.partnerRelationshipTypes.has(type) || this.options.partnerRelationshipTypes.has(stage);
      if (!structural) return;
      this._addPartner(personId, partnerId, "partnerId");
      const declaredBack = idOf(this.byId.get(partnerId)?.partnerId);
      if (this.byId.has(partnerId) && declaredBack !== personId) {
        this.issues.asymmetricPartners.push({ personId, partnerId, declaredBack });
      }
    });

    if (this.options.inferPartnersFromRelationships) {
      this.relationships.forEach((link, index) => {
        const a = idOf(link?.a ?? link?.personAId ?? link?.fromId);
        const b = idOf(link?.b ?? link?.personBId ?? link?.toId);
        const type = normalized(link?.type ?? link?.kind);
        if (!this.options.partnerRelationshipTypes.has(type)) return;
        if (!relationshipIsActive(link, this.options.includeFormerPartners)) return;
        if (!this.byId.has(a) || !this.byId.has(b)) {
          this.issues.unknownRelationshipRefs.push({ index, a, b, type });
          return;
        }
        this._addPartner(a, b, type || "relacionamento");
      });
    }

    this._checkParentAges();
    this.version += 1;
    return this;
  }

  _addParent(parentReference, childReference, source) {
    const parentId = idOf(parentReference);
    const childId = idOf(childReference);
    if (parentId == null || !this.byId.has(parentId)) {
      this.issues.unknownParentRefs.push({ parentId, childId, source });
      return;
    }
    if (childId == null || !this.byId.has(childId)) {
      this.issues.unknownChildRefs.push({ parentId, childId, source });
      return;
    }
    if (parentId === childId) {
      this._selfParentIds.add(parentId);
      this.issues.selfParenting.push({ personId: parentId, source });
      return;
    }
    this.parents.get(childId).add(parentId);
    this.children.get(parentId).add(childId);
  }

  _addPartner(aReference, bReference, source) {
    const a = idOf(aReference);
    const b = idOf(bReference);
    if (!this.byId.has(a) || !this.byId.has(b)) {
      this.issues.unknownPartnerRefs.push({ personId: a, partnerId: b, source });
      return;
    }
    if (a === b) {
      this.issues.selfPartnerships.push({ personId: a, source });
      return;
    }
    this.partners.get(a).add(b);
    this.partners.get(b).add(a);
    this._addPartnerKind(a, b, source);
    this._addPartnerKind(b, a, source);
  }

  _addPartnerKind(a, b, kind) {
    if (!this.partnerKinds.has(a)) this.partnerKinds.set(a, new Map());
    const byPartner = this.partnerKinds.get(a);
    if (!byPartner.has(b)) byPartner.set(b, new Set());
    byPartner.get(b).add(kind);
  }

  _checkParentAges() {
    this.parents.forEach((parentIds, childId) => {
      const child = this.byId.get(childId);
      parentIds.forEach((parentId) => {
        const parent = this.byId.get(parentId);
        if (
          Number.isFinite(parent?.age) &&
          Number.isFinite(child?.age) &&
          parent.age < child.age + 12
        ) {
          this.issues.implausibleParentAges.push({
            parentId,
            childId,
            ageDifference: parent.age - child.age,
          });
        }
      });
    });
  }

  has(reference) {
    return this.byId.has(idOf(reference));
  }

  get(reference) {
    return this.byId.get(idOf(reference)) ?? null;
  }

  _peopleFromIds(ids, { livingOnly = false } = {}) {
    return [...(ids ?? [])]
      .map((id) => this.byId.get(id))
      .filter((person) => person && (!livingOnly || isLiving(person)));
  }

  parentsOf(reference, options = {}) {
    return this._peopleFromIds(this.parents.get(idOf(reference)), options);
  }

  childrenOf(reference, options = {}) {
    return this._peopleFromIds(this.children.get(idOf(reference)), options);
  }

  partnersOf(reference, options = {}) {
    return this._peopleFromIds(this.partners.get(idOf(reference)), options);
  }

  _siblingData(aReference, bReference) {
    const a = idOf(aReference);
    const b = idOf(bReference);
    if (a == null || b == null || a === b) return null;
    const parentsA = this.parents.get(a) ?? new Set();
    const parentsB = this.parents.get(b) ?? new Set();
    const sharedParentIds = intersection(parentsA, parentsB);
    if (!sharedParentIds.length) return null;
    const completeMatch = equalSets(parentsA, parentsB);
    return {
      sharedParentIds,
      half: !completeMatch,
      certainty: parentsA.size >= 2 && parentsB.size >= 2 ? "confirmado" : "dados parciais",
    };
  }

  siblingsOf(reference, { includeHalf = true, livingOnly = false } = {}) {
    const personId = idOf(reference);
    if (!this.byId.has(personId)) return [];
    const candidates = new Set();
    (this.parents.get(personId) ?? []).forEach((parentId) =>
      (this.children.get(parentId) ?? []).forEach((childId) => candidates.add(childId)),
    );
    candidates.delete(personId);
    return [...candidates]
      .map((siblingId) => {
        const data = this._siblingData(personId, siblingId);
        return { person: this.byId.get(siblingId), ...data };
      })
      .filter(({ person, half }) =>
        person && (!livingOnly || isLiving(person)) && (includeHalf || !half),
      )
      .sort((a, b) => Number(a.half) - Number(b.half) || compareIds(a.person.id, b.person.id));
  }

  _lineage(reference, direction) {
    const personId = idOf(reference);
    const cache = direction === "up" ? this._ancestorCache : this._descendantCache;
    if (cache.has(personId)) return cache.get(personId);
    const result = new Map();
    if (!this.byId.has(personId)) return result;
    const source = direction === "up" ? this.parents : this.children;
    const visited = new Map([[personId, 0]]);
    const queue = [{ id: personId, depth: 0, path: [personId] }];
    const maximum = Math.max(1, Number(this.options.maxLineageDepth) || 100);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (current.depth >= maximum) continue;
      (source.get(current.id) ?? []).forEach((nextId) => {
        const depth = current.depth + 1;
        if ((visited.get(nextId) ?? Infinity) <= depth) return;
        visited.set(nextId, depth);
        const path = [...current.path, nextId];
        if (nextId !== personId) result.set(nextId, { depth, path });
        queue.push({ id: nextId, depth, path });
      });
    }
    cache.set(personId, result);
    return result;
  }

  ancestorsOf(
    reference,
    { maxDepth = Infinity, includeSelf = false, livingOnly = false } = {},
  ) {
    const personId = idOf(reference);
    const entries = [...this._lineage(personId, "up")]
      .filter(([, data]) => data.depth <= maxDepth)
      .map(([id, data]) => ({ person: this.byId.get(id), ...data }))
      .filter(({ person }) => person && (!livingOnly || isLiving(person)))
      .sort((a, b) => a.depth - b.depth || compareIds(a.person.id, b.person.id));
    if (includeSelf && this.byId.has(personId)) {
      const person = this.byId.get(personId);
      if (!livingOnly || isLiving(person)) entries.unshift({ person, depth: 0, path: [personId] });
    }
    return entries;
  }

  descendantsOf(
    reference,
    { maxDepth = Infinity, includeSelf = false, livingOnly = false } = {},
  ) {
    const personId = idOf(reference);
    const entries = [...this._lineage(personId, "down")]
      .filter(([, data]) => data.depth <= maxDepth)
      .map(([id, data]) => ({ person: this.byId.get(id), ...data }))
      .filter(({ person }) => person && (!livingOnly || isLiving(person)))
      .sort((a, b) => a.depth - b.depth || compareIds(a.person.id, b.person.id));
    if (includeSelf && this.byId.has(personId)) {
      const person = this.byId.get(personId);
      if (!livingOnly || isLiving(person)) entries.unshift({ person, depth: 0, path: [personId] });
    }
    return entries;
  }

  _nearestCommonAncestor(aReference, bReference) {
    const a = idOf(aReference);
    const b = idOf(bReference);
    const ancestryA = this._lineage(a, "up");
    const ancestryB = this._lineage(b, "up");
    return [...ancestryA]
      .filter(([ancestorId]) => ancestryB.has(ancestorId))
      .map(([ancestorId, fromA]) => ({
        ancestorId,
        fromA,
        fromB: ancestryB.get(ancestorId),
      }))
      .sort(
        (x, y) =>
          x.fromA.depth + x.fromB.depth - (y.fromA.depth + y.fromB.depth) ||
          Math.max(x.fromA.depth, x.fromB.depth) - Math.max(y.fromA.depth, y.fromB.depth) ||
          compareIds(x.ancestorId, y.ancestorId),
      )[0] ?? null;
  }

  _partnerLabel(subjectId, relative) {
    const kinds = [...(this.partnerKinds.get(subjectId)?.get(relative.id) ?? [])].map(normalized);
    if (kinds.some((kind) => kind === "casamento" || kind.includes("conjuge"))) {
      return roleLabel(relative, "marido", "esposa", "cônjuge");
    }
    return roleLabel(relative, "companheiro", "companheira", "parceiro(a)");
  }

  /**
   * Lista todas as descrições válidas de como `relative` se relaciona a
   * `person`. Uma pessoa pode, excepcionalmente, ocupar mais de um papel.
   */
  relationsBetween(personReference, relativeReference, options = {}) {
    const personId = idOf(personReference);
    const relativeId = idOf(relativeReference);
    const person = this.byId.get(personId);
    const relative = this.byId.get(relativeId);
    if (!person || !relative) return [];
    if (personId === relativeId) {
      return [descriptor("self", "a própria pessoa", 0, { distance: 0, consanguineous: false })];
    }

    const found = [];
    const add = (relation) => found.push(relation);
    const relativeIsParent = this.parents.get(personId)?.has(relativeId);
    const relativeIsChild = this.children.get(personId)?.has(relativeId);
    if (relativeIsParent) {
      add(descriptor("parent", parentLabel(relative), 10, { distance: 1, generation: -1 }));
    }
    if (relativeIsChild) {
      add(descriptor("child", childLabel(relative), 10, { distance: 1, generation: 1 }));
    }
    if (this.partners.get(personId)?.has(relativeId)) {
      add(
        descriptor("partner", this._partnerLabel(personId, relative), 12, {
          distance: 1,
          byAffinity: true,
          consanguineous: false,
          relationshipTypes: [...(this.partnerKinds.get(personId)?.get(relativeId) ?? [])],
        }),
      );
    }

    const sibling = this._siblingData(personId, relativeId);
    if (sibling) {
      add(
        descriptor(sibling.half ? "half-sibling" : "sibling", siblingLabel(relative, sibling.half), 20, {
          distance: 2,
          sharedParentIds: sibling.sharedParentIds,
          certainty: sibling.certainty,
        }),
      );
    }

    const ancestor = this._lineage(personId, "up").get(relativeId);
    if (ancestor?.depth >= 2) {
      add(
        descriptor("ancestor", grandparentLabel(relative, ancestor.depth), 25 + ancestor.depth, {
          distance: ancestor.depth,
          degree: ancestor.depth,
          generation: -ancestor.depth,
          path: ancestor.path,
        }),
      );
    }
    const descendant = this._lineage(personId, "down").get(relativeId);
    if (descendant?.depth >= 2) {
      add(
        descriptor("descendant", grandchildLabel(relative, descendant.depth), 25 + descendant.depth, {
          distance: descendant.depth,
          degree: descendant.depth,
          generation: descendant.depth,
          path: descendant.path,
        }),
      );
    }

    if (!relativeIsParent && !relativeIsChild && !sibling && !ancestor && !descendant) {
      const common = this._nearestCommonAncestor(personId, relativeId);
      if (common) {
        const fromPerson = common.fromA.depth;
        const fromRelative = common.fromB.depth;
        if (fromRelative === 1 && fromPerson >= 2) {
          const great = Math.max(0, fromPerson - 2);
          add(
            descriptor("uncle-aunt", uncleLabel(relative, great), 38 + great, {
              distance: fromPerson + fromRelative,
              degree: great + 1,
              commonAncestorIds: [common.ancestorId],
              half: this._siblingData(
                [...(this.parents.get(personId) ?? [])][0],
                relativeId,
              )?.half ?? false,
            }),
          );
        } else if (fromPerson === 1 && fromRelative >= 2) {
          const great = Math.max(0, fromRelative - 2);
          add(
            descriptor("nephew-niece", nephewLabel(relative, great), 38 + great, {
              distance: fromPerson + fromRelative,
              degree: great + 1,
              commonAncestorIds: [common.ancestorId],
            }),
          );
        } else if (fromPerson >= 2 && fromRelative >= 2) {
          const degree = Math.min(fromPerson, fromRelative) - 1;
          const removed = Math.abs(fromPerson - fromRelative);
          add(
            descriptor("cousin", cousinLabel(relative, degree, removed), 50 + degree + removed, {
              distance: fromPerson + fromRelative,
              degree,
              removed,
              commonAncestorIds: [common.ancestorId],
              generations: { person: fromPerson, relative: fromRelative },
            }),
          );
        }
      }
    }

    if (options.includeAffinity !== false) {
      const parents = this.parents.get(personId) ?? new Set();
      const children = this.children.get(personId) ?? new Set();
      const partnerIds = this.partners.get(personId) ?? new Set();

      const isStepParent = [...parents].some(
        (parentId) => this.partners.get(parentId)?.has(relativeId) && !parents.has(relativeId),
      );
      if (isStepParent) {
        add(
          descriptor(
            "step-parent",
            roleLabel(relative, "padrasto", "madrasta", "genitor por afinidade"),
            31,
            { distance: 2, byAffinity: true, consanguineous: false },
          ),
        );
      }

      const isStepChild = [...partnerIds].some(
        (partnerId) =>
          this.children.get(partnerId)?.has(relativeId) && !children.has(relativeId),
      );
      if (isStepChild) {
        add(
          descriptor(
            "step-child",
            roleLabel(relative, "enteado", "enteada", "descendente por afinidade"),
            31,
            { distance: 2, byAffinity: true, consanguineous: false },
          ),
        );
      }

      const isParentInLaw = [...partnerIds].some((partnerId) =>
        this.parents.get(partnerId)?.has(relativeId),
      );
      if (isParentInLaw) {
        add(
          descriptor(
            "parent-in-law",
            roleLabel(relative, "sogro", "sogra", "sogro/sogra"),
            42,
            { distance: 2, byAffinity: true, consanguineous: false },
          ),
        );
      }

      const isChildInLaw = [...children].some((childId) =>
        this.partners.get(childId)?.has(relativeId),
      );
      if (isChildInLaw) {
        add(
          descriptor(
            "child-in-law",
            roleLabel(relative, "genro", "nora", "cônjuge de descendente"),
            42,
            { distance: 2, byAffinity: true, consanguineous: false },
          ),
        );
      }

      const siblingIds = new Set(this.siblingsOf(personId).map(({ person: item }) => item.id));
      const siblingOfPartner = [...partnerIds].some((partnerId) =>
        this._siblingData(partnerId, relativeId),
      );
      const partnerOfSibling = [...siblingIds].some((siblingId) =>
        this.partners.get(siblingId)?.has(relativeId),
      );
      if (siblingOfPartner || partnerOfSibling) {
        add(
          descriptor(
            "sibling-in-law",
            roleLabel(relative, "cunhado", "cunhada", "cunhado(a)"),
            44,
            { distance: 2, byAffinity: true, consanguineous: false },
          ),
        );
      }
    }

    const unique = new Map();
    found.forEach((relation) => {
      const key = `${relation.kind}:${relation.degree ?? ""}:${relation.removed ?? ""}`;
      if (!unique.has(key) || unique.get(key).priority > relation.priority) unique.set(key, relation);
    });
    return [...unique.values()].sort(
      (a, b) => a.priority - b.priority || (a.distance ?? Infinity) - (b.distance ?? Infinity),
    );
  }

  relationBetween(personReference, relativeReference, options = {}) {
    return this.relationsBetween(personReference, relativeReference, options)[0] ?? null;
  }

  relationshipBetween(personReference, relativeReference, options = {}) {
    return this.relationBetween(personReference, relativeReference, options);
  }

  _neighbors(
    reference,
    { includeAffinity = false, includeRegisteredFamily = false, includeHousehold = false } = {},
  ) {
    const personId = idOf(reference);
    const neighbors = new Map();
    const add = (id, kind, byAffinity = false) => {
      if (id === personId || !this.byId.has(id)) return;
      const previous = neighbors.get(id);
      if (!previous || (previous.byAffinity && !byAffinity)) neighbors.set(id, { id, kind, byAffinity });
    };
    (this.parents.get(personId) ?? []).forEach((id) => add(id, "parent"));
    (this.children.get(personId) ?? []).forEach((id) => add(id, "child"));
    if (includeAffinity) {
      (this.partners.get(personId) ?? []).forEach((id) => add(id, "partner", true));
    }
    const person = this.byId.get(personId);
    if (includeRegisteredFamily && person?.familyId != null) {
      (this.registeredFamilies.get(person.familyId) ?? []).forEach((id) =>
        add(id, "registered-family", true),
      );
    }
    if (includeHousehold && person?.homeId != null) {
      (this.households.get(person.homeId) ?? []).forEach((id) => add(id, "household", true));
    }
    return [...neighbors.values()];
  }

  kinshipPath(personReference, relativeReference, options = {}) {
    const personId = idOf(personReference);
    const relativeId = idOf(relativeReference);
    if (!this.byId.has(personId) || !this.byId.has(relativeId)) return null;
    if (personId === relativeId) {
      return { distance: 0, personIds: [personId], people: [this.byId.get(personId)], edges: [], viaAffinity: false };
    }
    const visited = new Set([personId]);
    const queue = [{ id: personId, personIds: [personId], edges: [] }];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      for (const edge of this._neighbors(current.id, options)) {
        if (visited.has(edge.id)) continue;
        const personIds = [...current.personIds, edge.id];
        const edges = [...current.edges, { from: current.id, to: edge.id, kind: edge.kind, byAffinity: edge.byAffinity }];
        if (edge.id === relativeId) {
          return {
            distance: edges.length,
            personIds,
            people: personIds.map((id) => this.byId.get(id)),
            edges,
            viaAffinity: edges.some((item) => item.byAffinity),
          };
        }
        visited.add(edge.id);
        queue.push({ id: edge.id, personIds, edges });
      }
    }
    return null;
  }

  genealogicalDistance(personReference, relativeReference, options = {}) {
    return this.kinshipPath(personReference, relativeReference, {
      ...options,
      includeAffinity: options.includeAffinity ?? false,
    })?.distance ?? Infinity;
  }

  householdOf(reference, { includeSelf = true, livingOnly = false } = {}) {
    const person = this.get(reference);
    if (!person || person.homeId == null) return [];
    return this._peopleFromIds(this.households.get(person.homeId), { livingOnly }).filter(
      (member) => includeSelf || member.id !== person.id,
    );
  }

  registeredFamilyOf(reference, { includeSelf = true, livingOnly = false } = {}) {
    const person = this.get(reference);
    if (!person || person.familyId == null) return [];
    return this._peopleFromIds(this.registeredFamilies.get(person.familyId), { livingOnly }).filter(
      (member) => includeSelf || member.id !== person.id,
    );
  }

  householdGroups({ livingOnly = false, minSize = 1 } = {}) {
    return [...this.households]
      .map(([homeId, ids]) => {
        const members = this._peopleFromIds(ids, { livingOnly });
        return {
          homeId,
          memberIds: members.map(({ id }) => id),
          members,
          registeredFamilyIds: [...new Set(members.map(({ familyId }) => familyId).filter((id) => id != null))],
        };
      })
      .filter(({ members }) => members.length >= minSize)
      .sort((a, b) => b.members.length - a.members.length || compareIds(a.homeId, b.homeId));
  }

  familyNetworkOf(
    reference,
    {
      includeSelf = true,
      includePartners = true,
      includeRegisteredFamily = false,
      includeHousehold = false,
      livingOnly = false,
      maxDistance = Infinity,
    } = {},
  ) {
    const personId = idOf(reference);
    if (!this.byId.has(personId)) return [];
    const visited = new Set([personId]);
    const queue = [{ id: personId, distance: 0, personIds: [personId], viaAffinity: false }];
    const result = [];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      const person = this.byId.get(current.id);
      if (
        (includeSelf || current.id !== personId) &&
        (!livingOnly || isLiving(person))
      ) {
        result.push({
          person,
          distance: current.distance,
          path: current.personIds,
          viaAffinity: current.viaAffinity,
          relation: current.id === personId ? null : this.relationBetween(personId, current.id),
        });
      }
      if (current.distance >= maxDistance) continue;
      const neighbors = this._neighbors(current.id, {
        includeAffinity: includePartners,
        includeRegisteredFamily,
        includeHousehold,
      });
      neighbors.forEach((edge) => {
        if (visited.has(edge.id)) return;
        visited.add(edge.id);
        queue.push({
          id: edge.id,
          distance: current.distance + 1,
          personIds: [...current.personIds, edge.id],
          viaAffinity: current.viaAffinity || edge.byAffinity,
        });
      });
    }
    return result.sort(
      (a, b) => a.distance - b.distance || compareIds(a.person.id, b.person.id),
    );
  }

  relativesOf(reference, options = {}) {
    const personId = idOf(reference);
    const network = this.familyNetworkOf(personId, { ...options, includeSelf: false });
    return network
      .map((entry) => ({
        ...entry,
        relation:
          entry.relation ??
          descriptor(
            entry.viaAffinity ? "extended-affinity" : "extended-family",
            entry.viaAffinity ? "parente por afinidade" : "parente da família extensa",
            90,
            {
              distance: entry.distance,
              byAffinity: entry.viaAffinity,
              consanguineous: !entry.viaAffinity,
            },
          ),
      }))
      .sort(
        (a, b) =>
          a.relation.priority - b.relation.priority ||
          a.distance - b.distance ||
          compareIds(a.person.id, b.person.id),
      );
  }

  extendedFamilyGroupOf(reference, options = {}) {
    const network = this.familyNetworkOf(reference, { ...options, includeSelf: true });
    return this._summarizeGroup(network.map(({ person }) => person), options.groupId ?? null);
  }

  extendedFamilyGroups(
    {
      includePartners = true,
      includeRegisteredFamily = false,
      includeHousehold = false,
      livingOnly = false,
      minSize = 1,
    } = {},
  ) {
    const visited = new Set();
    const groups = [];
    this.byId.forEach((person, personId) => {
      if (visited.has(personId) || (livingOnly && !isLiving(person))) return;
      const members = [];
      const queue = [personId];
      visited.add(personId);
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const currentId = queue[cursor];
        const current = this.byId.get(currentId);
        if (!livingOnly || isLiving(current)) members.push(current);
        this._neighbors(currentId, {
          includeAffinity: includePartners,
          includeRegisteredFamily,
          includeHousehold,
        }).forEach(({ id }) => {
          if (visited.has(id) || (livingOnly && !isLiving(this.byId.get(id)))) return;
          visited.add(id);
          queue.push(id);
        });
      }
      if (members.length >= minSize) {
        groups.push(this._summarizeGroup(members, `família-extensa-${groups.length + 1}`));
      }
    });
    return groups.sort(
      (a, b) => b.members.length - a.members.length || compareIds(a.id, b.id),
    );
  }

  _summarizeGroup(members, id) {
    const memberIds = new Set(members.map((person) => person.id));
    const rootIds = members
      .filter((person) =>
        [...(this.parents.get(person.id) ?? [])].every((parentId) => !memberIds.has(parentId)),
      )
      .map(({ id: personId }) => personId);
    const generationSpan = members.reduce((maximum, person) => {
      const depths = this.ancestorsOf(person.id)
        .filter(({ person: ancestor }) => memberIds.has(ancestor.id))
        .map(({ depth }) => depth);
      return Math.max(maximum, ...depths, 0);
    }, 0);
    return {
      id,
      memberIds: [...memberIds],
      members,
      livingCount: members.filter(isLiving).length,
      deceasedCount: members.filter((person) => !isLiving(person)).length,
      rootIds,
      householdIds: [...new Set(members.map(({ homeId }) => homeId).filter((value) => value != null))],
      registeredFamilyIds: [...new Set(members.map(({ familyId }) => familyId).filter((value) => value != null))],
      surnames: [...new Set(members.map((person) => person.family).filter(Boolean))],
      generationSpan,
    };
  }

  contextBetween(personReference, otherReference) {
    const person = this.get(personReference);
    const other = this.get(otherReference);
    if (!person || !other) return null;
    return {
      sameHousehold: person.homeId != null && person.homeId === other.homeId,
      sameRegisteredFamily: person.familyId != null && person.familyId === other.familyId,
      kinship: this.relationBetween(person.id, other.id),
      genealogicalDistance: this.genealogicalDistance(person.id, other.id),
    };
  }

  detectCycles() {
    let index = 0;
    const stack = [];
    const onStack = new Set();
    const indices = new Map();
    const lowLinks = new Map();
    const components = [];

    const visit = (personId) => {
      indices.set(personId, index);
      lowLinks.set(personId, index);
      index += 1;
      stack.push(personId);
      onStack.add(personId);

      (this.children.get(personId) ?? []).forEach((childId) => {
        if (!indices.has(childId)) {
          visit(childId);
          lowLinks.set(personId, Math.min(lowLinks.get(personId), lowLinks.get(childId)));
        } else if (onStack.has(childId)) {
          lowLinks.set(personId, Math.min(lowLinks.get(personId), indices.get(childId)));
        }
      });

      if (lowLinks.get(personId) === indices.get(personId)) {
        const component = [];
        let current;
        do {
          current = stack.pop();
          onStack.delete(current);
          component.push(current);
        } while (current !== personId);
        if (component.length > 1) components.push(component.sort(compareIds));
      }
    };

    this.byId.forEach((_, personId) => {
      if (!indices.has(personId)) visit(personId);
    });

    const selfCycles = [...this._selfParentIds].map((personId) => [personId]);
    return [...selfCycles, ...components].map((personIds) => ({
      type: "genealogical-cycle",
      personIds,
      people: personIds.map((personId) => this.byId.get(personId)).filter(Boolean),
      path: this._cyclePath(personIds),
    }));
  }

  _cyclePath(component) {
    if (component.length === 1) return [component[0], component[0]];
    const allowed = new Set(component);
    const visiting = new Set();
    const visited = new Set();
    const path = [];
    let cycle = null;
    const search = (id) => {
      visiting.add(id);
      visited.add(id);
      path.push(id);
      for (const childId of this.children.get(id) ?? []) {
        if (!allowed.has(childId)) continue;
        if (visiting.has(childId)) {
          const start = path.indexOf(childId);
          cycle = [...path.slice(start), childId];
          return true;
        }
        if (!visited.has(childId) && search(childId)) return true;
      }
      path.pop();
      visiting.delete(id);
      return false;
    };
    for (const id of component) {
      if (!visited.has(id) && search(id)) break;
    }
    return cycle ?? [...component, component[0]];
  }

  validationReport() {
    const cycles = this.detectCycles();
    const issueCount = Object.values(this.issues).reduce((sum, items) => sum + items.length, 0);
    return {
      valid: issueCount === 0 && cycles.length === 0,
      issueCount: issueCount + cycles.length,
      people: this.byId.size,
      parentChildEdges: [...this.parents.values()].reduce((sum, ids) => sum + ids.size, 0),
      partnerEdges: [...this.partners.values()].reduce((sum, ids) => sum + ids.size, 0) / 2,
      households: this.households.size,
      registeredFamilies: this.registeredFamilies.size,
      cycles,
      ...this.issues,
    };
  }
}

export function buildKinshipIndex(people, relationships = [], options = {}) {
  return new KinshipIndex(people, relationships, options);
}

export const createKinshipIndex = buildKinshipIndex;

/** Atalho útil em testes e ferramentas que não precisam manter o índice. */
export function describeKinship(
  people,
  personReference,
  relativeReference,
  relationships = [],
  options = {},
) {
  return buildKinshipIndex(people, relationships, options).relationBetween(
    personReference,
    relativeReference,
    options,
  );
}
