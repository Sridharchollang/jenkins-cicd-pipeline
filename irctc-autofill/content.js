(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  };

  const text = element => normalize(element?.innerText || element?.textContent || "");
  const nodes = (root, selector) => [...(root || document).querySelectorAll(selector)].filter(visible);
  const waitFor = async (test, attempts = 40, delay = 50) => {
    for (let index = 0; index < attempts; index++) {
      const result = test();
      if (result) return result;
      await wait(delay);
    }
    return null;
  };

  const dialog = () => {
    const candidates = nodes(document, "[role='dialog'], [aria-modal='true'], .modal, .modal-dialog, [class*='modal'], [class*='dialog']")
      .filter(element => text(element).includes("addpassenger"));
    return candidates.sort((a, b) => {
      const first = a.getBoundingClientRect();
      const second = b.getBoundingClientRect();
      return second.width * second.height - first.width * first.height;
    })[0] || document;
  };

  const labelNode = (root, labels) => {
    const wanted = labels.map(normalize);
    return nodes(root, "label, mat-label, legend, span, p, div")
      .filter(element => wanted.includes(text(element)))
      .sort((a, b) => {
        const first = a.getBoundingClientRect();
        const second = b.getBoundingClientRect();
        return first.width * first.height - second.width * second.height;
      })[0] || null;
  };

  const fieldRow = (label, root) => {
    if (!label) return null;
    let current = label.parentElement;
    for (let depth = 0; current && depth < 7; depth++, current = current.parentElement) {
      const rect = current.getBoundingClientRect();
      const controls = current.querySelectorAll("input, textarea, select, button, [role='combobox'], [aria-haspopup='listbox'], [aria-expanded], [tabindex]");
      if (rect.width > 120 && rect.height < 180 && controls.length) return current;
    }
    return label.parentElement;
  };

  const inputField = (root, labels) => {
    const label = labelNode(root, labels);
    const row = fieldRow(label, root);
    const control = row && nodes(row, "input, textarea").find(element => !element.readOnly);
    return { label, row, control };
  };

  const dropdownField = (root, labels) => {
    const label = labelNode(root, labels);
    const row = fieldRow(label, root);
    if (!row) return { label, row, control: null };

    const controls = nodes(row, "select, button, [role='combobox'], [aria-haspopup='listbox'], [aria-expanded], [tabindex]");
    const control = controls.find(element => element !== label) || row;
    return { label, row, control };
  };

  const setInput = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, String(value));
    else element.value = String(value);
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const dispatchClick = element => {
    if (!element) return;
    element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    const rect = element.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };
    if (typeof PointerEvent === "function") {
      element.dispatchEvent(new PointerEvent("pointerdown", { ...init, pointerId: 1, pointerType: "mouse" }));
    }
    element.dispatchEvent(new MouseEvent("mousedown", init));
    if (typeof PointerEvent === "function") {
      element.dispatchEvent(new PointerEvent("pointerup", { ...init, pointerId: 1, pointerType: "mouse" }));
    }
    element.dispatchEvent(new MouseEvent("mouseup", init));
    element.dispatchEvent(new MouseEvent("click", init));
    element.click?.();
  };

  const optionCandidates = () => {
    // IRCTC has used several implementations: Angular Material, ng-select,
    // Bootstrap-like lists, and plain div option rows. Include all of them.
    const selector = [
      "[role='option']", "[role='menuitem']", "[role='listbox'] li", "[role='listbox'] div",
      "mat-option", ".mat-option", ".mat-mdc-option", ".mdc-list-item", ".ng-option",
      ".ng-option-label", ".dropdown-item", ".select-option", ".option", ".menu-item",
      ".cdk-overlay-pane li", ".cdk-overlay-pane button", ".dropdown-menu li", ".dropdown-menu button",
      "li[tabindex]", "li", "button"
    ].join(",");
    const specific = nodes(document, selector);
    const generic = nodes(document, "div, span").filter(element => {
      const value = text(element);
      const className = String(element.className || "").toLowerCase();
      return value && /(option|dropdown|menu|select|list|item)/.test(className);
    });
    return [...new Set([...specific, ...generic])].filter(element => {
      const value = text(element);
      return value && ![...element.children].some(child => text(child) === value);
    });
  };

  const optionFor = value => {
    const wanted = normalize(value);
    return optionCandidates().find(option => {
      const optionValue = normalize(option.getAttribute("value") || option.getAttribute("data-value") || option.getAttribute("aria-label") || "");
      return text(option) === wanted || optionValue === wanted;
    });
  };

  const rowValue = row => normalize(row?.innerText || row?.textContent || "");

  const chooseDropdown = async (field, value) => {
    if (!field?.control || !value) return false;
    const wanted = normalize(value);
    const control = field.control;

    if (control instanceof HTMLSelectElement) {
      const option = [...control.options].find(item => text(item) === wanted || normalize(item.value) === wanted);
      if (!option) return false;
      control.value = option.value;
      ["input", "change", "blur"].forEach(type => control.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
      return true;
    }

    dispatchClick(control);
    await wait(180);

    const option = await waitFor(() => optionFor(value), 50, 50);
    if (option) {
      dispatchClick(option.closest("[role='option'], [role='menuitem'], mat-option, .mat-option, .mat-mdc-option, .mdc-list-item, .ng-option, .dropdown-item, li, button") || option);
      await wait(300);
      if (rowValue(field.row).includes(wanted) && !rowValue(field.row).includes("select")) return true;
    }

    // Keyboard fallback for controls that ignore synthetic mouse events.
    control.focus?.();
    control.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", code: "Home", bubbles: true }));
    for (let index = 0; index < 10; index++) {
      control.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", bubbles: true }));
      await wait(30);
      const currentOption = optionFor(value);
      if (currentOption) {
        control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
        await wait(250);
        if (rowValue(field.row).includes(wanted) && !rowValue(field.row).includes("select")) return true;
      }
    }

    control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    return false;
  };

  const fillPassenger = async passenger => {
    const root = dialog();
    const name = inputField(root, ["full name as per govt. id", "full name"]);
    const age = inputField(root, ["age"]);
    const gender = dropdownField(root, ["gender"]);
    const country = dropdownField(root, ["country"]);
    const preference = dropdownField(root, ["preferences", "preference"]);

    let filled = 0;
    if (setInput(name.control, passenger.name)) filled++;
    if (setInput(age.control, passenger.age)) filled++;
    const genderOk = await chooseDropdown(gender, passenger.gender);
    if (genderOk) filled++;
    const countryOk = await chooseDropdown(country, passenger.country || "India");
    if (countryOk) filled++;
    const preferenceOk = await chooseDropdown(preference, passenger.preference);
    if (preferenceOk) filled++;
    return { filled, genderOk, preferenceOk };
  };

  const button = value => nodes(document, "button, a, [role='button']").find(element => text(element).includes(normalize(value)));
  const openPassenger = async () => { const target = button("new passenger"); if (!target) return false; dispatchClick(target); await wait(450); return true; };
  const addPassenger = async () => {
    const target = nodes(document, "button, [role='button']").find(element => /^(add|add passenger|save passenger)$/i.test((element.innerText || element.textContent || "").trim()));
    if (!target) return false;
    dispatchClick(target);
    await wait(500);
    return true;
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!["fillPassengers", "selectExistingPassengers"].includes(message.action)) return;
    (async () => {
      try {
        if (message.action === "selectExistingPassengers") {
          sendResponse({ message: "Select existing passengers manually from the IRCTC list." });
          return;
        }
        const passengers = Array.isArray(message.passengers) ? message.passengers : [];
        if (!passengers.length) {
          sendResponse({ message: "Add at least one passenger to the profile." });
          return;
        }
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
