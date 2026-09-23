(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };

  const fields = root => [...(root || document).querySelectorAll(
    "input, select, textarea, [role='combobox'], [aria-haspopup='listbox'], mat-select"
  )].filter(visible);

  const textFor = element => {
    const values = [];
    if (element.labels) [...element.labels].forEach(label => values.push(label.innerText));
    ["aria-label", "aria-labelledby", "placeholder", "name", "id", "formcontrolname"].forEach(attribute => {
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

  const optionMatches = (element, value) => {
    const wanted = normalize(value);
    const text = normalize(element.innerText || element.textContent);
    const optionValue = normalize(element.getAttribute("value"));
    return text === wanted || optionValue === wanted;
  };

  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  const setNativeSelect = (element, value) => {
    const option = [...element.options].find(item => optionMatches(item, value));
    if (!option) return false;
    element.value = option.value;
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const overlayCandidates = () => {
    const selectors = [
      "[role='option']", "[role='menuitem']", "mat-option", ".mat-option",
      ".mat-mdc-option", ".mdc-list-item", ".cdk-overlay-pane li",
      ".cdk-overlay-pane button", ".cdk-overlay-pane [class*='option']",
      ".dropdown-menu li", ".dropdown-menu button", "[class*='dropdown'] li"
    ];
    return [...new Set(document.querySelectorAll(selectors.join(",")))]
      .filter(visible)
      .filter(element => normalize(element.innerText || element.textContent));
  };

  const clickOption = option => {
    const target = option.closest(
      "[role='option'], [role='menuitem'], mat-option, .mat-option, .mat-mdc-option, " +
      ".mdc-list-item, li, button"
    ) || option;
    const rect = target.getBoundingClientRect();
    const eventOptions = { bubbles: true, cancelable: true, composed: true, view: window,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    target.dispatchEvent(new PointerEvent("pointerdown", { ...eventOptions, pointerId: 1, pointerType: "mouse" }));
    target.dispatchEvent(new MouseEvent("mousedown", eventOptions));
    target.dispatchEvent(new PointerEvent("pointerup", { ...eventOptions, pointerId: 1, pointerType: "mouse" }));
    target.dispatchEvent(new MouseEvent("mouseup", eventOptions));
    target.click();
  };

  const customSelectText = element => normalize(
    element.innerText || element.textContent || element.getAttribute("aria-label") || ""
  );

  const setCustomSelect = async (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    if (element instanceof HTMLSelectElement || element.tagName?.toLowerCase() === "select") {
      return setNativeSelect(element, value);
    }

    element.focus?.();
    element.click();
    let option = null;
    for (let attempt = 0; attempt < 30 && !option; attempt++) {
      const matches = overlayCandidates().filter(item => optionMatches(item, value));
      // Select the smallest matching node. Clicking an overlay/container can
      // reopen the menu instead of committing the value.
      option = matches.sort((a, b) => (a.getBoundingClientRect().width * a.getBoundingClientRect().height) -
        (b.getBoundingClientRect().width * b.getBoundingClientRect().height))[0] || null;
      if (!option) await wait(50);
    }
    if (!option) {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    clickOption(option);
    await wait(250);
    const selected = customSelectText(element);
    if (selected.includes(normalize(value))) return true;

    // Some TTD builds handle the click on the option's parent control.
    const parent = option.parentElement;
    if (parent && parent !== option && optionMatches(parent, value)) {
      clickOption(parent);
      await wait(250);
    }
    return customSelectText(element).includes(normalize(value));
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

  const fillPilgrim = async (root, pilgrim) => {
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
    if (await setCustomSelect(gender, pilgrim.gender)) count++;
    if (await setCustomSelect(proof, pilgrim.idType)) count++;
    if (setValue(number, pilgrim.idNumber)) count++;
    return count;
  };

  const findGroups = expected => {
    const all = fields(document);
    const candidates = [...document.querySelectorAll("fieldset, section, article, li, tr, .row, [class*='pilgrim'], [class*='passenger'], [class*='devotee']")]
      .filter(visible).filter(group => fields(group).length >= 3);
    const unique = [];
    for (const group of candidates) {
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
    (async () => {
      try {
        const pilgrims = Array.isArray(message.profile?.pilgrims) ? message.profile.pilgrims : [];
        const groups = findGroups(pilgrims.length);
        let filled = 0;
        for (const [index, pilgrim] of pilgrims.entries()) filled += await fillPilgrim(groups[index] || document, pilgrim);
        sendResponse({ message: filled ? `Filled ${filled} field(s) for ${pilgrims.length} pilgrim(s). Review all details before continuing.` : "No matching fields found. Check the page and form labels." });
      } catch (error) {
        console.error("TTD Smart Autofill:", error);
        sendResponse({ message: "Could not fill this page. Please review manually." });
      }
    })();
    return true;
  });
})();
