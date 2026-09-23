(() => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };

  const dialog = () => document.querySelector(".ui-dialog.add-passenger-dialog") || document.querySelector(".add-passenger-dialog.ui-dialog");
  const dropdown = (formControlName) => dialog()?.querySelector(`p-dropdown[formcontrolname="${formControlName}"]`) || null;

  const setInput = (control, value) => {
    if (!control || value === undefined || value === null || value === "") return false;
    const prototype = control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(control, String(value)); else control.value = String(value);
    ["input", "change", "blur"].forEach(type => control.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const humanClick = element => {
    if (!element) return;
    element.scrollIntoView?.({ block: "nearest" });
    const rect = element.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, composed: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    if (typeof PointerEvent === "function") element.dispatchEvent(new PointerEvent("pointerdown", { ...init, pointerId: 1, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent("mousedown", init));
    if (typeof PointerEvent === "function") element.dispatchEvent(new PointerEvent("pointerup", { ...init, pointerId: 1, pointerType: "mouse" }));
    element.dispatchEvent(new MouseEvent("mouseup", init));
    element.dispatchEvent(new MouseEvent("click", init));
    element.click?.();
  };

  const selectedText = field => normalize(field?.querySelector(".ui-dropdown-label")?.textContent || "");

  const openPanelOptions = () => [...document.querySelectorAll(
    ".ap-dropdown-panel.ui-dropdown-panel li.ui-dropdown-item, " +
    ".ap-dropdown-panel .ui-dropdown-items li, " +
    ".ui-dropdown-panel li[role='option'], " +
    ".ui-dropdown-panel .ui-dropdown-item, " +
    ".ui-dropdown-panel li"
  )].filter(visible);

  const chooseDropdown = async (formControlName, requestedValue) => {
    const field = dropdown(formControlName);
    if (!field || !requestedValue) return false;
    const wanted = normalize(requestedValue);
    const trigger = field.querySelector(".ui-dropdown-trigger, .ui-dropdown-label-container") || field.querySelector(".ui-dropdown");
    if (!trigger) return false;

    const current = selectedText(field);
    if (current === wanted) return true;
    humanClick(trigger);

    for (let attempt = 0; attempt < 50; attempt++) {
      const option = openPanelOptions().find(item => normalize(item.textContent) === wanted);
      if (option) {
        humanClick(option);
        for (let check = 0; check < 20; check++) {
          await wait(50);
          if (selectedText(field) === wanted) return true;
        }
        return false;
      }
      await wait(50);
    }

    field.querySelector("[role='listbox']")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  };

  const fillPassenger = async passenger => {
    const root = dialog();
    if (!root) return { nameOk: false, genderOk: false, preferenceOk: false };

    const name = root.querySelector("input[formcontrolname='passengerName'], p-autocomplete input[role='searchbox']");
    const age = root.querySelector("input[formcontrolname='passengerAge']");
    const genderOk = await chooseDropdown("passengerGender", passenger.gender);
    const countryOk = await chooseDropdown("passengerNationality", passenger.country || "India");
    const preferenceOk = await chooseDropdown("passengerBerthChoice", passenger.preference);
    const nameOk = setInput(name, passenger.name);
    const ageOk = setInput(age, passenger.age);
    return { nameOk, ageOk, genderOk, countryOk, preferenceOk };
  };

  const newPassengerButton = () => [...document.querySelectorAll("button.btn-new-passenger")].find(visible);
  const addButton = () => dialog()?.querySelector("button.ap-add-btn");

  const openPassenger = async () => {
    const button = newPassengerButton();
    if (!button) return false;
    humanClick(button);
    for (let attempt = 0; attempt < 30; attempt++) {
      if (dialog()) return true;
      await wait(50);
    }
    return false;
  };

  const addPassenger = async () => {
    const button = addButton();
    if (!button || !visible(button)) return false;
    humanClick(button);
    await wait(500);
    return !dialog();
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
          if (!result.nameOk || !result.ageOk || !result.genderOk || !result.countryOk || !result.preferenceOk) {
            const missing = [
              !result.nameOk && "Name",
              !result.ageOk && "Age",
              !result.genderOk && "Gender",
              !result.countryOk && "Country",
              !result.preferenceOk && "Preference"
            ].filter(Boolean).join(", ");
            sendResponse({ message: `Passenger ${completed + 1} could not be completed. Check: ${missing}.` });
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
