(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };
  const controls = root => [...(root || document).querySelectorAll("input, select, textarea, [role='combobox'], [aria-haspopup='listbox'], [aria-expanded]")].filter(visible);
  const labelText = element => {
    const values = [];
    if (element.labels) [...element.labels].forEach(label => values.push(label.innerText));
    ["aria-label", "aria-labelledby", "placeholder", "name", "id", "formcontrolname"].forEach(attribute => { const value = element.getAttribute(attribute); if (value) values.push(value); });
    const parent = element.closest("div, label, td, li, section");
    if (parent?.innerText) values.push(parent.innerText.slice(0, 260));
    return normalize(values.join(" "));
  };
  const best = (items, words, used) => {
    let chosen = null; let score = 0;
    for (const item of items) { if (used.has(item)) continue; const current = words.reduce((sum, word) => sum + (labelText(item).includes(normalize(word)) ? 1 : 0), 0); if (current > score) { chosen = item; score = current; } }
    if (chosen) used.add(chosen); return chosen;
  };
  const setInput = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, String(value)); else element.value = String(value);
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };
  const textOf = element => normalize(element?.innerText || element?.textContent || "");
  const exact = (element, value) => textOf(element) === normalize(value) || normalize(element?.getAttribute("value")) === normalize(value);
  const optionSelector = "[role='option'], [role='menuitem'], [role='listbox'] li, [role='listbox'] div, mat-option, .mat-option, .mat-mdc-option, .mdc-list-item, .cdk-overlay-pane li, .cdk-overlay-pane button, .cdk-overlay-pane [class*='option'], .dropdown-menu li, .dropdown-menu button";
  const openOptions = () => [...document.querySelectorAll(optionSelector)].filter(visible).filter(item => textOf(item));
  const clickOption = element => {
    const target = element.closest("[role='option'], [role='menuitem'], mat-option, .mat-option, .mat-mdc-option, .mdc-list-item, li, button") || element;
    target.click();
  };
  const selectNative = (element, value) => {
    const option = [...element.options].find(item => exact(item, value));
    if (!option) return false;
    element.value = option.value;
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };
  const displayText = element => {
    const host = element.closest("mat-form-field, .mat-form-field, .form-group, [class*='select'], [class*='dropdown'], label") || element;
    return normalize(host.innerText || host.textContent || element.getAttribute("aria-label") || "");
  };
  const keyboardIndex = (field, value) => {
    const gender = ["male", "female", "transgender"];
    const preference = ["lower", "middle", "upper", "sidelower", "sideupper"];
    const label = labelText(field);
    const values = label.includes("gender") || label.includes("sex") ? gender : preference;
    return values.indexOf(normalize(value));
  };
  const selectCustom = async (element, value) => {
    if (!element || !value) return false;
    if (element instanceof HTMLSelectElement || element.tagName?.toLowerCase() === "select") return selectNative(element, value);
    const wanted = normalize(value);
    element.focus?.();
    element.click();
    await wait(120);
    for (let attempt = 0; attempt < 20; attempt++) {
      const option = openOptions().filter(item => exact(item, value)).sort((a, b) => {
        const area = node => node.getBoundingClientRect().width * node.getBoundingClientRect().height;
        return area(a) - area(b);
      })[0];
      if (option) {
        clickOption(option);
        await wait(250);
        if (displayText(element).includes(wanted)) return true;
      }
      await wait(50);
    }
    // IRCTC's current dropdowns respond reliably to keyboard selection even
    // when their visible option rows ignore synthetic mouse events.
    element.focus?.();
    const index = keyboardIndex(element, value);
    if (index >= 0) {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", code: "Home", bubbles: true }));
      await wait(30);
      for (let i = 0; i < index; i++) {
        element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true }));
        await wait(30);
      }
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      await wait(300);
      if (displayText(element).includes(wanted)) return true;
    }
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  };
  const fillFields = async passenger => {
    const items = controls(document); const used = new Set();
    const name = best(items, ["full name", "government id", "govt id", "passenger name", "name"], used);
    const age = best(items, ["age", "enter your age"], used);
    const gender = best(items, ["gender", "sex"], used);
    const country = best(items, ["country", "nationality"], used);
    const preference = best(items, ["preference", "berth preference", "seat preference"], used);
    let filled = 0;
    if (setInput(name, passenger.name)) filled++;
    if (setInput(age, passenger.age)) filled++;
    const genderOk = await selectCustom(gender, passenger.gender);
    if (genderOk) filled++;
    if (setInput(country, passenger.country)) filled++;
    const preferenceOk = passenger.preference ? await selectCustom(preference, passenger.preference) : true;
    if (preferenceOk && passenger.preference) filled++;
    return { filled, genderOk, preferenceOk };
  };
  const clickByText = text => [...document.querySelectorAll("button, a, [role='button']")].find(element => visible(element) && textOf(element).includes(normalize(text)));
  const openNewPassenger = async () => { const button = clickByText("new passenger"); if (!button) return false; button.click(); await wait(350); return true; };
  const confirmPassenger = async () => { const button = [...document.querySelectorAll("button, [role='button']")].find(element => visible(element) && /^(add passenger|save passenger|add)$/i.test((element.innerText || element.textContent).trim())); if (!button) return false; button.click(); await wait(450); return true; };
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!["fillPassengers", "selectExistingPassengers"].includes(message.action)) return;
    (async () => {
      try {
        const passengers = Array.isArray(message.passengers) ? message.passengers : [];
        if (message.action === "selectExistingPassengers") { sendResponse({ message: "Existing passenger selection must be completed from the IRCTC list. Review the available passengers manually." }); return; }
        if (!passengers.length) { sendResponse({ message: "Add at least one passenger to the profile." }); return; }
        let total = 0; let completed = 0;
        for (const passenger of passengers) {
          if (!await openNewPassenger()) break;
          const result = await fillFields(passenger);
          total += result.filled;
          if (!result.genderOk || !result.preferenceOk) { sendResponse({ message: `Passenger ${completed + 1} was not added because Gender or Preference was not selected. Please select both fields manually.` }); return; }
          if (!await confirmPassenger()) break;
          completed++; await wait(250);
        }
        sendResponse({ message: completed === passengers.length ? `Added and filled ${completed} passenger(s). Review all details before continuing.` : `Filled ${total} field(s) for ${completed} of ${passengers.length} passenger(s). Complete the remaining passenger manually.` });
      } catch (error) { console.error("IRCTC Passenger Autofill:", error); sendResponse({ message: "Could not fill the passenger form. Please review manually." }); }
    })();
    return true;
  });
})();
