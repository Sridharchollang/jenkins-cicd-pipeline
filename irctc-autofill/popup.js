const emptyPassenger = () => ({ name: "", age: "", gender: "Male", country: "India", preference: "" });
const defaultData = { profiles: [{ id: crypto.randomUUID(), name: "Passenger 1", passenger: emptyPassenger() }], selected: null };
let data;
const current = () => data.profiles.find(profile => profile.id === data.selected) || data.profiles[0];
const status = message => { document.getElementById("status").textContent = message; };
async function load() {
  data = await chrome.storage.local.get(defaultData);
  if (!data.profiles?.length) data.profiles = defaultData.profiles;
  if (!data.selected || !data.profiles.some(profile => profile.id === data.selected)) data.selected = data.profiles[0].id;
  renderProfiles(); renderEditor();
}
function renderProfiles() {
  const select = document.getElementById("profileSelect");
  select.replaceChildren();
  data.profiles.forEach(profile => select.add(new Option(profile.name, profile.id, profile.id === data.selected, profile.id === data.selected)));
}
function renderEditor() {
  const profile = current(); const passenger = profile.passenger || emptyPassenger();
  document.getElementById("profileName").value = profile.name || "";
  document.getElementById("fullName").value = passenger.name || "";
  document.getElementById("age").value = passenger.age || "";
  document.getElementById("gender").value = passenger.gender || "Male";
  document.getElementById("country").value = passenger.country || "India";
  document.getElementById("preference").value = passenger.preference || "";
}
function readEditor() {
  const profile = current();
  profile.name = document.getElementById("profileName").value.trim() || "Passenger";
  profile.passenger = {
    name: document.getElementById("fullName").value.trim(),
    age: document.getElementById("age").value.trim(),
    gender: document.getElementById("gender").value,
    country: document.getElementById("country").value.trim() || "India",
    preference: document.getElementById("preference").value
  };
}
async function save() { readEditor(); await chrome.storage.local.set({ profiles: data.profiles, selected: data.selected }); renderProfiles(); }
async function send(action) {
  await save();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return status("No active tab.");
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action, passenger: current().passenger });
    status(response?.message || "Completed. Review the passenger details.");
  } catch (error) { console.error(error); status("Open the IRCTC passenger page and reload it, then try again."); }
}
document.getElementById("profileSelect").addEventListener("change", async event => { readEditor(); data.selected = event.target.value; await chrome.storage.local.set({ profiles: data.profiles, selected: data.selected }); renderEditor(); });
document.getElementById("saveBtn").addEventListener("click", async () => { await save(); status("Profile saved locally."); });
document.getElementById("newPassengerBtn").addEventListener("click", () => send("fillNewPassenger"));
document.getElementById("existingPassengerBtn").addEventListener("click", () => send("selectExistingPassenger"));
document.getElementById("newBtn").addEventListener("click", async () => { readEditor(); const profile = { id: crypto.randomUUID(), name: `Passenger ${data.profiles.length + 1}`, passenger: emptyPassenger() }; data.profiles.push(profile); data.selected = profile.id; await chrome.storage.local.set({ profiles: data.profiles, selected: data.selected }); renderProfiles(); renderEditor(); status("New profile created."); });
load().catch(error => { console.error(error); status("Could not load local profiles."); });
