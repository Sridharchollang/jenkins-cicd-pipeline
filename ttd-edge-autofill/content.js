(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };

  const fields = root => [...(root || document).querySelectorAll("input, select, textarea")].filter(visible);

  const textFor = element => {
    const values = [];
    if (element.labels) [...element.labels].forEach(label => values.push(label.innerText));
    ["aria-label", "placeholder", "name", "id", "formcontrolname"].forEach(attribute => {
      const value = element.getAttribute(attribute);
      if (value) values.push(value);
    });
    const parent = element.closest("div, td, li, tr, section");
    if (parent?.innerText) values.push(parent.innerText.slice(0, 240));
    return normalize(values.join(" "));
  };

  const nativeSetter = (element, value) => {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, String(value));
    else element.value = String(value);
  };

  const setValue = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    nativeSetter(element, value);
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const setSelect = (element, value) => {
    if (!(element instanceof HTMLSelectElement)) return setValue(element, value);
    const wanted = normalize(value);
    const option = [...element.options].find(item => {
      const text = normalize(item.textContent);
      const optionValue = normalize(item.value);
      return text === wanted || optionValue === wanted || text.includes(wanted) || optionValue.includes(wanted);
    });
    return option ? setValue(element, option.value) : false;
  };

  const best = (available, keywords, used) => {
    let selected = null;
    let score = 0;
    for (const element of available) {
      if (used.has(element)) continue;
      const label = textFor(element);
      const current = keywords.reduce((total, keyword) => total + (label.includes(normalize(keyword)) ? 1 : 0), 0);
      if (current > score) {
        selected = element;
        score = current;
      }
    }
    if (selected) used.add(selected);
    return selected;
  };

  const fillPilgrim = (root, pilgrim) => {
    const available = fields(root);
    const used = new Set();
    let count = 0;
    const name = best(available, ["pilgrim name", "devotee name", "full name", "name"], used);
    const age = best(available, ["age", "years"], used);
    const gender = best(available, ["gender", "sex"], used);
    const proof = best(available, ["photo id proof", "id proof", "proof type", "document type", "identity proof"], used);
    const number = best(available, ["photo id number", "id number", "proof id number", "document number", "identity number"], used);
    if (setValue(name, pilgrim.name)) count++;
    if (setValue(age, pilgrim.age)) count++;
    if (setSelect(gender, pilgrim.gender)) count++;
    if (setSelect(proof, pilgrim.idType)) count++;
    if (setValue(number, pilgrim.idNumber)) count++;
    return count;
  };

  const findGroups = expected => {
    const all = fields(document);
    const candidates = [...document.querySelectorAll("fieldset, section, article, li, tr, .row, [class*='pilgrim'], [class*='passenger'], [class*='devotee']")]
      .filter(visible)
      .filter(group => fields(group).length >= 3);
    const unique = [];
    for (const group of candidates) {
      const groupFields = fields(group);
      if (!unique.some(existing => existing.contains(group))) unique.push(group);
      if (unique.length >= expected) break;
    }
    if (unique.length >= expected) return unique;
    const chunkSize = Math.max(1, Math.floor(all.length / expected));
    return Array.from({ length: expected }, (_, index) => {
      const selected = all.slice(index * chunkSize, index === expected - 1 ? all.length : (index + 1) * chunkSize);
      return { querySelectorAll: () => selected };
    });
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "fill") return;
    try {
      const pilgrims = Array.isArray(message.profile?.pilgrims) ? message.profile.pilgrims : [];
      const groups = findGroups(pilgrims.length);
      let filled = 0;
      pilgrims.forEach((pilgrim, index) => { filled += fillPilgrim(groups[index] || document, pilgrim); });
      sendResponse({ message: filled ? `Filled ${filled} field(s) for ${pilgrims.length} pilgrim(s). Review all details before continuing.` : "No matching fields found. Check the page and form labels." });
    } catch (error) {
      console.error("TTD Smart Autofill:", error);
      sendResponse({ message: "Could not fill this page. Please review manually." });
    }
    return true;
  });
})();
