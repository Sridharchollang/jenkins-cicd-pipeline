(() => {
  const norm = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = node => {
    if (!node || node.disabled) return false;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };
  const visibleNodes = (root, selector) => [...(root || document).querySelectorAll(selector)].filter(visible);
  const ownText = node => norm(node?.innerText || node?.textContent || "");
  const labelText = node => norm(node?.innerText || node?.textContent || "");

  const getPassengerDialog = () => {
    const candidates = visibleNodes(document, "[role='dialog'], [aria-modal='true'], .modal, .modal-dialog, [class*='modal'], [class*='dialog']")
      .filter(node => ownText(node).includes("addpassenger"));
    return candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return br.width * br.height - ar.width * ar.height;
    })[0] || document;
  };

  const exactLabel = (root, names) => {
    const wanted = names.map(norm);
    return visibleNodes(root, "label, mat-label, legend, span, p, div")
      .filter(node => wanted.includes(labelText(node)))
      .sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
  };

  const rowFor = (label, root) => {
    if (!label) return null;
    let row = label.parentElement;
    for (let depth = 0; row && depth < 6; depth++, row = row.parentElement) {
      const rect = row.getBoundingClientRect();
      const text = ownText(row);
      if (rect.width > 120 && rect.height < 180 && text.length < 220) return row;
    }
    return label.parentElement;
  };

  const inputFor = (root, names) => {
    const label = exactLabel(root, names);
    const row = rowFor(label, root);
    const input = row && visibleNodes(row, "input, textarea").find(node => !names.map(norm).includes(norm(node.value)));
    return { label, row, control: input };
  };

  const interactiveFor = (root, names) => {
    const label = exactLabel(root, names);
    const row = rowFor(label, root);
    if (!row) return { label, row, control: null };

    const controls = visibleNodes(row, "select, button, [role='combobox'], [aria-haspopup='listbox'], [aria-expanded], input, [tabindex], svg, i");
    let control = controls.find(node => {
      const value = norm(node.value || node.getAttribute("aria-label") || node.innerText || node.textContent || "");
      return value === "select" || value === "india" || value === "lower" || value === "male" || value === "female" || value.includes("select");
    });

    if (!control) {
      const descendants = visibleNodes(row, "div, span, button").filter(node => {
        const style = getComputedStyle(node);
        return style.cursor === "pointer" || node.getAttribute("role") === "button";
      });
      control = descendants.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    }

    if (!control) control = row;
    const clickable = control.closest("button, [role='combobox'], [aria-haspopup='listbox'], [aria-expanded], [tabindex]") || control;
    return { label, row, control: clickable };
  };

  const setInput = (control, value) => {
    if (!control || value === undefined || value === null || value === "") return false;
    const proto = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(control, String(value)); else control.value = String(value);
    ["input", "change", "blur"].forEach(type => control.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const optionNodes = () => visibleNodes(document, "[role='option'], [role='menuitem'], [role='listbox'] li, [role='listbox'] div, mat-option, .mat-option, .mat-mdc-option, .mdc-list-item, .cdk-overlay-pane li, .cdk-overlay-pane button, .dropdown-menu li, .dropdown-menu button, li").filter(node => {
    const value = ownText(node);
    return value && ![...node.children].some(child => ownText(child) === value);
  });

  const clickHuman = node => {
    const target = node.closest("[role='option'], [role='menuitem'], mat-option, .mat-option, .mat-mdc-option, .mdc-list-item, li, button") || node;
    target.scrollIntoView?.({ block: "nearest" });
    const r = target.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    target.dispatchEvent(new MouseEvent("mousedown", init));
    target.dispatchEvent(new MouseEvent("mouseup", init));
    target.dispatchEvent(new MouseEvent("click", init));
    target.click();
  };

  const rowHasValue = (row, value) => {
    const wanted = norm(value);
    const text = ownText(row);
    return text.includes(wanted) && !text.endsWith("select");
  };

  const choose = async (field, value) => {
    if (!field?.control || !value) return false;
    const trigger = field.control;
    if (trigger instanceof HTMLSelectElement) {
      const option = [...trigger.options].find(node => norm(node.textContent) === norm(value) || norm(node.value) === norm(value));
      if (!option) return false;
      trigger.value = option.value;
      ["input", "change", "blur"].forEach(type => trigger.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
      return true;
    }

    clickHuman(trigger);
    await wait(180);
    for (let attempt = 0; attempt < 60; attempt++) {
      const option = optionNodes().find(node => ownText(node) === norm(value));
      if (option) {
        clickHuman(option);
        await wait(300);
        if (rowHasValue(field.row, value)) return true;
      }
      await wait(50);
    }

    trigger.focus?.();
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", code: "Home", bubbles: true }));
    for (let i = 0; i < 10; i++) {
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true }));
      await wait(25);
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      await wait(120);
      if (rowHasValue(field.row, value)) return true;
    }
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  };

  const fillPassenger = async passenger => {
    const root = getPassengerDialog();
    const name = inputFor(root, ["full name as per govt. id", "full name"]);
    const age = inputFor(root, ["age"]);
    const gender = interactiveFor(root, ["gender"]);
    const country = interactiveFor(root, ["country"]);
    const preference = interactiveFor(root, ["preferences", "preference"]);

    let filled = 0;
    if (setInput(name.control, passenger.name)) filled++;
    if (setInput(age.control, passenger.age)) filled++;
    const genderOk = await choose(gender, passenger.gender);
    if (genderOk) filled++;
    const countryOk = await choose(country, passenger.country || "India");
    if (countryOk) filled++;
    const preferenceOk = await choose(preference, passenger.preference);
    if (preferenceOk) filled++;
    return { filled, genderOk, preferenceOk };
  };

  const buttons = selector => visibleNodes(document, selector);
  const findButton = value => buttons("button, a, [role='button']").find(node => ownText(node).includes(norm(value)));
  const openPassenger = async () => { const button = findButton("new passenger"); if (!button) return false; clickHuman(button); await wait(400); return true; };
  const addPassenger = async () => { const button = buttons("button, [role='button']").find(node => /^(add|add passenger|save passenger)$/i.test((node.innerText || node.textContent || "").trim())); if (!button) return false; clickHuman(button); await wait(500); return true; };

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
        console.error("IRCTC Passenger Autofill", error);
        sendResponse({ message: "Could not fill the passenger form. Please review manually." });
      }
    })();
    return true;
  });
})();
