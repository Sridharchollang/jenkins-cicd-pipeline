(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = element => { if (!element || element.disabled) return false; const r = element.getBoundingClientRect(); const s = getComputedStyle(element); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
  const controls = root => [...(root || document).querySelectorAll("input, select, textarea, [role='combobox'], [aria-haspopup='listbox']")].filter(visible);
  const labelText = element => { const values = []; if (element.labels) [...element.labels].forEach(label => values.push(label.innerText)); ["aria-label", "placeholder", "name", "id", "formcontrolname"].forEach(a => { if (element.getAttribute(a)) values.push(element.getAttribute(a)); }); const parent = element.closest("div, label, td, li, section"); if (parent?.innerText) values.push(parent.innerText.slice(0, 220)); return normalize(values.join(" ")); };
  const best = (items, words, used) => { let chosen = null, score = 0; for (const item of items) { if (used.has(item)) continue; const text = labelText(item); const n = words.reduce((sum, word) => sum + (text.includes(normalize(word)) ? 1 : 0), 0); if (n > score) { chosen = item; score = n; } } if (chosen) used.add(chosen); return chosen; };
  const setInput = (element, value) => { if (!element || value === undefined || value === null || value === "") return false; const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set; setter ? setter.call(element, String(value)) : element.value = String(value); ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true }))); return true; };
  const optionMatch = (element, value) => { const wanted = normalize(value); return normalize(element.innerText || element.textContent) === wanted || normalize(element.getAttribute("value")) === wanted; };
  const selectValue = async (element, value) => { if (!element || !value) return false; if (element instanceof HTMLSelectElement) { const option = [...element.options].find(item => optionMatch(item, value)); if (!option) return false; element.value = option.value; element.dispatchEvent(new Event("change", { bubbles: true })); return true; } element.click(); for (let i = 0; i < 20; i++) { const options = [...document.querySelectorAll("[role='option'], [role='menuitem'], mat-option, .mat-option, .mat-mdc-option, li, button")].filter(visible); const option = options.find(item => optionMatch(item, value)); if (option) { option.click(); await wait(100); return true; } await wait(50); } return false; };
  const fillFields = async passenger => { const items = controls(document); const used = new Set(); const name = best(items, ["full name", "government id", "govt id", "passenger name", "name"], used); const age = best(items, ["age", "enter your age"], used); const gender = best(items, ["gender", "sex"], used); const country = best(items, ["country", "nationality"], used); const preference = best(items, ["preference", "berth preference", "seat preference"], used); let filled = 0; if (setInput(name, passenger.name)) filled++; if (setInput(age, passenger.age)) filled++; if (await selectValue(gender, passenger.gender)) filled++; if (setInput(country, passenger.country)) filled++; if (await selectValue(preference, passenger.preference)) filled++; return filled; };
  const clickByText = text => [...document.querySelectorAll("button, a, [role='button']")].find(element => visible(element) && normalize(element.innerText || element.textContent).includes(normalize(text)));
  const openNewPassenger = async () => { const button = clickByText("new passenger"); if (!button) return false; button.click(); await wait(300); return true; };
  const confirmPassenger = async () => { const button = [...document.querySelectorAll("button, [role='button']")].find(element => visible(element) && /^(add passenger|save passenger|add)$/i.test((element.innerText || element.textContent).trim())); if (!button) return false; button.click(); await wait(350); return true; };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!["fillPassengers", "selectExistingPassengers"].includes(message.action)) return;
    (async () => {
      try {
        const passengers = Array.isArray(message.passengers) ? message.passengers : [];
        if (message.action === "selectExistingPassengers") { sendResponse({ message: "Existing passenger selection must be completed from the IRCTC list. Review the available passengers manually." }); return; }
        if (!passengers.length) { sendResponse({ message: "Add at least one passenger to the profile." }); return; }
        let total = 0;
        let completed = 0;
        for (const passenger of passengers) {
          // Open the dialog for every passenger after the previous one is saved.
          if (!await openNewPassenger()) break;
          total += await fillFields(passenger);
          if (await confirmPassenger()) completed++;
          else break;
          await wait(200);
        }
        sendResponse({ message: completed === passengers.length ? `Added and filled ${completed} passenger(s). Review all details before continuing.` : `Filled ${total} field(s) for ${completed} of ${passengers.length} passenger(s). Complete the remaining passenger manually.` });
      } catch (error) { console.error("IRCTC Passenger Autofill:", error); sendResponse({ message: "Could not fill the passenger form. Please review manually." }); }
    })();
    return true;
  });
})();
