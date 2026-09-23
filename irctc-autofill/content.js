(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };

  const fields = root => [...(root || document).querySelectorAll(
    "input, select, textarea, [role='combobox'], [aria-haspopup='listbox'], [aria-expanded], mat-select"
  )].filter(visible);

  const textFor = element => {
    const values = [];
    if (element.labels) [...element.labels].forEach(label => values.push(label.innerText));
    ["aria-label", "aria-labelledby", "placeholder", "name", "id", "formcontrolname"].forEach(attribute => {
      const value = element.getAttribute(attribute);
      if (value) values.push(value);
    });
    const parent = element.closest("div, td, li, tr, section, label");
    if (parent?.innerText) values.push(parent.innerText.slice(0, 250));
    return normalize(values.join(" "));
  };

  const nativeSetter = (element, value) => {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : null;
    const setter = prototype && Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, String(value));
    else element.value = String(value);
  };

  const setInput = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    nativeSetter(element, value);
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const optionMatches = (element, value) => {
    const wanted = normalize(value);
    const text = normalize(element?.textContent || "");
    const optionValue = normalize(element?.getAttribute("value") || "");
    return text === wanted || optionValue === wanted;
  };

  const setNativeSelect = (element, value) => {
    const option = [...element.options].find(item => optionMatches(item, value));
    if (!option) return false;
    element.value = option.value;
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const overlayCandidates = () => {
    const roots = [...document.querySelectorAll(
      "[role='listbox'], [role='menu'], mat-option, .mat-option, .mat-mdc-option, .cdk-overlay-pane, .cdk-overlay-container, .dropdown-menu, [class*='dropdown']"
    )].filter(visible);
    const candidates = roots.flatMap(root => [...root.querySelectorAll(
      "[role='option'], [role='menuitem'], mat-option, li, button, option, .mat-option, .mat-mdc-option, .mdc-list-item, div, span"
    )]);
    return [...new Set(candidates)].filter(visible).filter(element => {
      return ![...element.children].some(child => normalize(child.textContent) === normalize(element.textContent));
    });
  };

  const setCustomSelect = async (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    if (element instanceof HTMLSelectElement || element.tagName?.toLowerCase() === "select") return setNativeSelect(element, value);

    element.focus?.();
    element.click();
    let option = null;
    for (let attempt = 0; attempt < 40 && !option; attempt++) {
      option = overlayCandidates().find(item => optionMatches(item, value));
      if (!option) await wait(50);
    }
    if (!option) {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await wait(100);
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await wait(150);
      option = overlayCandidates().find(item => optionMatches(item, value));
    }
    if (!option) {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    const target = option.closest("[role='option'], [role='menuitem'], mat-option, .mat-option, .mat-mdc-option, .mdc-list-item, li, button") || option;
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    target.click();
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
    await wait(150);
    return true;
  };

  const best = (available, keywords, used) => {
    let selected = null;
    let score = 0;
    for (const element of available) {
      if (used.has(element)) continue;
      const label = textFor(element);
      const current = keywords.reduce((total, keyword) => total + (label.includes(normalize(keyword)) ? 1 : 0), 0);
      if (current > score) { selected = element; score = current; }
    }
    if (selected) used.add(selected);
    return selected;
  };

  const fillFields = async passenger => {
    const available = fields(document);
    const used = new Set();
    const name = best(available, ["full name", "government id", "govt id", "passenger name", "name"], used);
    const age = best(available, ["age", "enter your age", "years"], used);
    const gender = best(available, ["gender", "sex"], used);
    const country = best(available, ["country", "nationality"], used);
    const preference = best(available, ["preference", "berth preference", "seat preference"], used);
    let filled = 0;
    let genderOk = false;
    let preferenceOk = false;
    if (setInput(name, passenger.name)) filled++;
    if (setInput(age, passenger.age)) filled++;
    if (gender) genderOk = await setCustomSelect(gender, passenger.gender);
    if (genderOk) filled++;
    if (country && setInput(country, passenger.country)) filled++;
    if (preference && passenger.preference) preferenceOk = await setCustomSelect(preference, passenger.preference);
    if (preferenceOk && passenger.preference) filled++;
    return { filled, genderOk, preferenceOk };
  };

  const clickByText = text => [...document.querySelectorAll("button, a, [role='button']")]
    .find(element => visible(element) && normalize(element.innerText || element.textContent || "").includes(normalize(text)));

  const openNewPassenger = async () => {
    const button = clickByText("new passenger");
    if (!button) return false;
    button.click();
    await wait(350);
    return true;
  };

  const confirmPassenger = async () => {
    const button = [...document.querySelectorAll("button, [role='button']")]
      .find(element => visible(element) && /^(add passenger|save passenger|add)$/i.test((element.innerText || element.textContent || "").trim()));
    if (!button) return false;
    button.click();
    await wait(450);
    return true;
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!["fillPassengers", "selectExistingPassengers"].includes(message.action)) return;
    (async () => {
      try {
        const passengers = Array.isArray(message.passengers) ? message.passengers : [];
        if (message.action === "selectExistingPassengers") {
          sendResponse({ message: "Existing passenger selection must be completed from the IRCTC list. Review the available passengers manually." });
          return;
        }
        if (!passengers.length) {
          sendResponse({ message: "Add at least one passenger to the profile." });
          return;
        }
        let total = 0;
        let completed = 0;
        for (const passenger of passengers) {
          if (!await openNewPassenger()) break;
          const result = await fillFields(passenger);
          total += result.filled;
          if (!result.genderOk || !result.preferenceOk) {
            sendResponse({ message: `Passenger ${completed + 1} was not added because Gender or Preference was not selected. Please select both fields manually.` });
            return;
          }
          if (!await confirmPassenger()) break;
          completed++;
          await wait(250);
        }
        sendResponse({ message: completed === passengers.length
          ? `Added and filled ${completed} passenger(s). Review all details before continuing.`
          : `Filled ${total} field(s) for ${completed} of ${passengers.length} passenger(s). Complete the remaining passenger manually.` });
      } catch (error) {
        console.error("IRCTC Passenger Autofill:", error);
        sendResponse({ message: "Could not fill the passenger form. Please review manually." });
      }
    })();
    return true;
  });
})();
