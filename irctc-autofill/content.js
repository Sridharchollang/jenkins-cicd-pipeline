(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };
  const all = (root, selector = "*") => [...(root || document).querySelectorAll(selector)].filter(visible);
  const text = element => normalize(element?.innerText || element?.textContent || "");
  const exactText = (element, value) => text(element) === normalize(value);

  const modal = () => {
    const candidates = all(document, "[role='dialog'], .modal, .modal-dialog, .cdk-overlay-pane, [class*='dialog'], [class*='modal']");
    return candidates.sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)
      .find(element => text(element).includes("addpassenger")) || document;
  };

  const inputSetter = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, String(value)); else element.value = String(value);
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const labelWords = element => {
    const values = [];
    if (element.labels) [...element.labels].forEach(label => values.push(label.innerText));
    ["aria-label", "placeholder", "name", "id", "formcontrolname"].forEach(attribute => {
      const value = element.getAttribute?.(attribute);
      if (value) values.push(value);
    });
    const parent = element.closest("div, label, td, li, section, mat-form-field");
    if (parent?.innerText) values.push(parent.innerText.slice(0, 260));
    return normalize(values.join(" "));
  };

  const findTextNode = (root, value) => all(root, "*").find(element => exactText(element, value) && element.children.length === 0);

  const findInput = (root, words) => {
    let best = null; let score = 0;
    for (const element of all(root, "input, textarea")) {
      const label = labelWords(element);
      const current = words.reduce((n, word) => n + (label.includes(normalize(word)) ? 1 : 0), 0);
      if (current > score) { best = element; score = current; }
    }
    return best;
  };

  const findSelect = (root, words) => {
    const controls = all(root, "select, [role='combobox'], [aria-haspopup='listbox'], [aria-expanded], mat-select");
    let best = null; let score = 0;
    for (const element of controls) {
      const label = labelWords(element);
      const current = words.reduce((n, word) => n + (label.includes(normalize(word)) ? 1 : 0), 0);
      if (current > score) { best = { trigger: element, box: element }; score = current; }
    }
    if (best) return best;

    const label = findTextNode(root, words[0]);
    if (!label) return null;
    let parent = label.parentElement;
    for (let depth = 0; parent && depth < 6; depth++, parent = parent.parentElement) {
      const trigger = parent.querySelector("select, [role='combobox'], [aria-haspopup='listbox'], [aria-expanded], button") || parent;
      if (trigger && visible(trigger)) return { trigger, box: parent };
    }
    return null;
  };

  const optionCandidates = () => {
    const selectors = "[role='option'], [role='menuitem'], mat-option, .mat-option, .mat-mdc-option, .mdc-list-item, li, button, option, [class*='option']";
    const nodes = all(document, selectors);
    return nodes.filter(node => {
      const value = text(node);
      return value && ![...node.children].some(child => text(child) === value);
    });
  };

  const clickReal = element => {
    const rect = element.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    if (typeof PointerEvent === "function") element.dispatchEvent(new PointerEvent("pointerdown", { ...init, pointerId: 1, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent("mousedown", init));
    if (typeof PointerEvent === "function") element.dispatchEvent(new PointerEvent("pointerup", { ...init, pointerId: 1, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent("mouseup", init));
    element.dispatchEvent(new MouseEvent("click", init));
    element.click();
  };

  const selectValue = async (field, wanted) => {
    if (!field || !wanted) return false;
    const trigger = field.trigger;
    if (trigger instanceof HTMLSelectElement) {
      const option = [...trigger.options].find(option => text(option) === normalize(wanted) || normalize(option.value) === normalize(wanted));
      if (!option) return false;
      trigger.value = option.value;
      ["input", "change", "blur"].forEach(type => trigger.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
      return true;
    }

    const before = text(field.box);
    clickReal(trigger);
    await wait(150);
    let option;
    for (let attempt = 0; attempt < 50; attempt++) {
      option = optionCandidates().find(candidate => text(candidate) === normalize(wanted));
      if (option) break;
      await wait(40);
    }
    if (!option) {
      trigger.focus?.();
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", code: "Home", bubbles: true }));
      for (let i = 0; i < 10; i++) {
        trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true }));
        await wait(20);
        if (optionCandidates().some(candidate => text(candidate) === normalize(wanted))) break;
      }
      option = optionCandidates().find(candidate => text(candidate) === normalize(wanted));
    }
    if (!option) {
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }
    clickReal(option.closest("[role='option'], [role='menuitem'], mat-option, .mat-option, .mat-mdc-option, li, button") || option);
    await wait(300);
    const after = text(field.box);
    return after.includes(normalize(wanted)) && after !== before;
  };

  const fill = async passenger => {
    const root = modal();
    const name = findInput(root, ["full name", "passenger name", "government id", "govt id", "name"]);
    const age = findInput(root, ["age"]);
    const gender = findSelect(root, ["gender", "sex"]);
    const country = findSelect(root, ["country", "nationality"]);
    const preference = findSelect(root, ["preferences", "preference", "berth"]);
    let count = 0;
    if (inputSetter(name, passenger.name)) count++;
    if (inputSetter(age, passenger.age)) count++;
    const genderOk = await selectValue(gender, passenger.gender);
    if (genderOk) count++;
    if (country && (country.trigger instanceof HTMLSelectElement ? await selectValue(country, passenger.country) : inputSetter(country.trigger, passenger.country))) count++;
    const preferenceOk = passenger.preference ? await selectValue(preference, passenger.preference) : true;
    if (preferenceOk && passenger.preference) count++;
    return { count, genderOk, preferenceOk };
  };

  const buttonByText = value => all(document, "button, a, [role='button']").find(element => text(element).includes(normalize(value)));
  const openPassenger = async () => { const button = buttonByText("new passenger"); if (!button) return false; clickReal(button); await wait(400); return true; };
  const addPassenger = async () => { const button = all(document, "button, [role='button']").find(element => /^(add|add passenger|save passenger)$/i.test((element.innerText || "").trim())); if (!button) return false; clickReal(button); await wait(500); return true; };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!["fillPassengers", "selectExistingPassengers"].includes(message.action)) return;
    (async () => {
      try {
        if (message.action === "selectExistingPassengers") { sendResponse({ message: "Select existing passengers manually from the IRCTC list." }); return; }
        const passengers = Array.isArray(message.passengers) ? message.passengers : [];
        if (!passengers.length) { sendResponse({ message: "Add at least one passenger to the profile." }); return; }
        let completed = 0;
        for (const passenger of passengers) {
          if (!await openPassenger()) break;
          const result = await fill(passenger);
          if (!result.genderOk || !result.preferenceOk) {
            sendResponse({ message: `Passenger ${completed + 1} was not added because Gender or Preference was not selected. Please select both fields manually.` });
            return;
          }
          if (!await addPassenger()) break;
          completed++;
        }
        sendResponse({ message: completed === passengers.length ? `Added and filled ${completed} passenger(s). Review all details before continuing.` : `Filled ${completed} of ${passengers.length} passenger(s).` });
      } catch (error) {
        console.error("IRCTC Passenger Autofill:", error);
        sendResponse({ message: "Could not fill the passenger form. Please review manually." });
      }
    })();
    return true;
  });
})();
