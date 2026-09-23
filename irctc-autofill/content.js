(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };
  const visibleNodes = (root, selector) => [...(root || document).querySelectorAll(selector)].filter(visible);
  const ownText = element => normalize(element?.innerText || element?.textContent || "");
  const exact = (element, value) => ownText(element) === normalize(value);

  const getModal = () => {
    const candidates = visibleNodes(document, "[role='dialog'], .modal, .modal-dialog, [class*='modal'], [class*='dialog']");
    return candidates
      .filter(node => ownText(node).includes("addpassenger"))
      .sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0] || document;
  };

  const controlSelector = "input, textarea, select, button, [role='combobox'], [aria-haspopup='listbox'], [aria-expanded], mat-select";

  // Find the control in the same compact row as the visible label. This avoids
  // the previous bug where the whole modal text made every field score equally
  // and the Country value was written into the Name field.
  const controlForLabel = (root, labels) => {
    const wanted = labels.map(normalize);
    const labelNodes = visibleNodes(root, "label, span, div, p, mat-label").filter(node => {
      const value = ownText(node);
      return value && wanted.includes(value);
    });
    for (const label of labelNodes) {
      let parent = label.parentElement;
      for (let depth = 0; parent && depth < 5; depth++, parent = parent.parentElement) {
        const controls = visibleNodes(parent, controlSelector).filter(control => !control.contains(label) && control !== label);
        if (controls.length) return { control: controls[0], row: parent };
      }
    }
    return null;
  };

  const setInput = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, String(value)); else element.value = String(value);
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const optionText = element => normalize(element?.innerText || element?.textContent || element?.getAttribute("aria-label") || element?.getAttribute("value") || "");
  const optionMatches = (element, value) => {
    const wanted = normalize(value);
    return optionText(element) === wanted || normalize(element?.getAttribute("value") || "") === wanted;
  };

  const openOptions = () => {
    const nodes = visibleNodes(document, "[role='option'], [role='menuitem'], [role='listbox'] li, [role='listbox'] div, mat-option, .mat-option, .mat-mdc-option, .mdc-list-item, .cdk-overlay-pane li, .cdk-overlay-pane button, .dropdown-menu li, .dropdown-menu button, [class*='option']");
    return nodes.filter(node => {
      const value = optionText(node);
      return value && ![...node.children].some(child => optionText(child) === value);
    });
  };

  const clickReal = element => {
    const target = element.closest("[role='option'], [role='menuitem'], mat-option, .mat-option, .mat-mdc-option, .mdc-list-item, li, button") || element;
    target.scrollIntoView?.({ block: "nearest" });
    const rect = target.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    if (typeof PointerEvent === "function") target.dispatchEvent(new PointerEvent("pointerdown", { ...init, pointerId: 1, pointerType: "mouse" }));
    target.dispatchEvent(new MouseEvent("mousedown", init));
    if (typeof PointerEvent === "function") target.dispatchEvent(new PointerEvent("pointerup", { ...init, pointerId: 1, pointerType: "mouse" }));
    target.dispatchEvent(new MouseEvent("mouseup", init));
    target.dispatchEvent(new MouseEvent("click", init));
    target.click();
  };

  const rowValue = row => normalize(row?.innerText || row?.textContent || "");

  const selectValue = async (field, value) => {
    if (!field || !value) return false;
    const trigger = field.control;
    if (trigger instanceof HTMLSelectElement) {
      const option = [...trigger.options].find(item => optionMatches(item, value));
      if (!option) return false;
      trigger.value = option.value;
      ["input", "change", "blur"].forEach(type => trigger.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
      return true;
    }

    const wanted = normalize(value);
    clickReal(trigger);
    await wait(150);
    for (let attempt = 0; attempt < 50; attempt++) {
      const option = openOptions().find(item => optionMatches(item, value));
      if (option) {
        clickReal(option);
        await wait(300);
        if (rowValue(field.row).includes(wanted) && !rowValue(field.row).includes("select")) return true;
      }
      await wait(50);
    }

    trigger.focus?.();
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", code: "Home", bubbles: true }));
    for (let i = 0; i < 8; i++) {
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true }));
      await wait(30);
      const option = openOptions().find(item => optionMatches(item, value));
      if (option) {
        clickReal(option);
        await wait(250);
        if (rowValue(field.row).includes(wanted) && !rowValue(field.row).includes("select")) return true;
      }
    }
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  };

  const fillPassenger = async passenger => {
    const root = getModal();
    const nameField = controlForLabel(root, ["full name as per govt. id", "full name"]);
    const ageField = controlForLabel(root, ["age"]);
    const genderField = controlForLabel(root, ["gender"]);
    const countryField = controlForLabel(root, ["country"]);
    const preferenceField = controlForLabel(root, ["preferences", "preference"]);

    let filled = 0;
    if (nameField?.control && setInput(nameField.control, passenger.name)) filled++;
    if (ageField?.control && setInput(ageField.control, passenger.age)) filled++;
    const genderOk = await selectValue(genderField, passenger.gender);
    if (genderOk) filled++;
    const countryOk = await selectValue(countryField, passenger.country || "India");
    if (countryOk) filled++;
    const preferenceOk = passenger.preference ? await selectValue(preferenceField, passenger.preference) : true;
    if (preferenceOk && passenger.preference) filled++;
    return { filled, genderOk, preferenceOk };
  };

  const buttons = selector => visibleNodes(document, selector);
  const byText = (selector, value) => buttons(selector).find(element => ownText(element).includes(normalize(value)));
  const openPassenger = async () => { const button = byText("button, a, [role='button']", "new passenger"); if (!button) return false; clickReal(button); await wait(400); return true; };
  const addPassenger = async () => { const button = buttons("button, [role='button']").find(element => /^(add|add passenger|save passenger)$/i.test((element.innerText || element.textContent || "").trim())); if (!button) return false; clickReal(button); await wait(500); return true; };

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
          const result = await fillPassenger(passenger);
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
