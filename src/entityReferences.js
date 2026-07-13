const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isLinkableText = (node) => {
  const parent = node?.parentElement;
  if (!parent || !node.nodeValue?.trim()) return false;
  return !parent.closest("button, a, input, textarea, select, option, script, style, [data-entity-reference]");
};

export function createEntityReferenceLinker({ getSimulation, onPerson, onPlace } = {}) {
  const connected = new WeakSet();
  let signature = "", matcher = null, entities = new Map();

  function refreshIndex() {
    const simulation = getSimulation?.();
    if (!simulation) return false;
    const nextSignature = `${simulation.people?.length || 0}:${simulation.buildings?.length || 0}:${simulation.businesses?.length || 0}`;
    if (nextSignature === signature && matcher) return true;
    signature = nextSignature;
    entities = new Map();
    (simulation.people || []).forEach((person) => {
      if (person?.name?.length >= 4) entities.set(person.name, { kind: "person", id: person.id });
    });
    (simulation.buildings || []).forEach((building) => {
      if (building?.name?.length >= 4) entities.set(building.name, { kind: "place", id: building.id });
    });
    (simulation.businesses || []).forEach((business) => {
      const building = simulation.buildings?.find((item) => item.id === business.buildingId);
      if (business?.name?.length >= 4 && building) entities.set(business.name, { kind: "place", id: building.id });
    });
    const names = [...entities.keys()].sort((left, right) => right.length - left.length);
    matcher = names.length ? new RegExp(`(${names.map(escapeRegExp).join("|")})`, "gu") : null;
    return Boolean(matcher);
  }

  function enhanceTextNode(node) {
    if (!isLinkableText(node) || !refreshIndex()) return;
    const source = node.nodeValue, matches = [...source.matchAll(matcher)];
    if (!matches.length) return;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    matches.forEach((match) => {
      const start = match.index, label = match[0], entity = entities.get(label);
      if (!entity) return;
      if (start > cursor) fragment.append(document.createTextNode(source.slice(cursor, start)));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "entity-reference";
      button.dataset.entityReference = entity.kind;
      button.dataset.entityId = entity.id;
      button.title = entity.kind === "person" ? `Abrir ficha e localizar ${label}` : `Abrir e localizar ${label}`;
      button.textContent = label;
      fragment.append(button);
      cursor = start + label.length;
    });
    if (cursor < source.length) fragment.append(document.createTextNode(source.slice(cursor)));
    node.replaceWith(fragment);
  }

  function enhance(root) {
    if (!root || !refreshIndex()) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(enhanceTextNode);
  }

  function connect(root) {
    if (!root || connected.has(root)) return;
    connected.add(root);
    root.addEventListener("click", (event) => {
      const reference = event.target.closest("[data-entity-reference]");
      if (!reference || !root.contains(reference)) return;
      const simulation = getSimulation?.();
      if (reference.dataset.entityReference === "person") {
        const person = simulation?.people?.find((item) => item.id === reference.dataset.entityId);
        if (person) onPerson?.(person);
      } else {
        const place = simulation?.buildings?.find((item) => item.id === reference.dataset.entityId);
        if (place) onPlace?.(place);
      }
    });
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) enhanceTextNode(node);
        else if (node.nodeType === Node.ELEMENT_NODE && !node.matches("[data-entity-reference]")) enhance(node);
      }));
    });
    observer.observe(root, { childList: true, subtree: true });
    enhance(root);
  }

  return { connect, enhance, invalidate: () => { signature = ""; matcher = null; } };
}
