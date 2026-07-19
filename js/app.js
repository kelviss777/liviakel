const STORAGE_KEY = "nosso-casamento-v1";

const defaultState = {
    settings: { partnerOne: "", partnerTwo: "", weddingDate: "" },
    guests: [],
    venues: [],
    tasks: [],
    expenses: []
};

let state = loadState();

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return saved ? {
            settings: { ...defaultState.settings },
            guests: Array.isArray(saved.guests) ? saved.guests : [],
            venues: Array.isArray(saved.venues) ? saved.venues : [],
            tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
            expenses: Array.isArray(saved.expenses) ? saved.expenses : []
        } : structuredClone(defaultState);
    } catch {
        return structuredClone(defaultState);
    }
}

function saveState() {
    let saved = {};

    try {
        saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
        saved = {};
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...saved,
        guests: state.guests,
        venues: state.venues,
        tasks: state.tasks,
        expenses: state.expenses
    }));
}

function makeId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
}

function parseLocalDate(value) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatDate(value, fallback = "Sem prazo") {
    const date = parseLocalDate(value);
    return date ? new Intl.DateTimeFormat("pt-BR").format(date) : fallback;
}

function showToast(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function emptyState(message) {
    return `<div class="empty-state"><span>♡</span><p>${message}</p></div>`;
}

document.body.insertAdjacentHTML("beforeend", `
    <dialog id="settings-dialog">
        <form id="settings-form" method="dialog">
            <div class="dialog-header"><div><p class="eyebrow">Personalizar</p><h2>Nosso Casamento</h2></div><button class="icon-button" id="close-settings" type="button" aria-label="Fechar">×</button></div>
            <div class="field"><label for="partner-one">Primeiro nome</label><input id="partner-one" name="partnerOne" placeholder="Ex.: Ana" required></div>
            <div class="field"><label for="partner-two">Segundo nome</label><input id="partner-two" name="partnerTwo" placeholder="Ex.: Lucas" required></div>
            <div class="field"><label for="wedding-date">Data do casamento</label><input id="wedding-date" name="weddingDate" type="date"></div>
            <button class="button button-primary full-width" type="submit">Salvar alterações</button>
        </form>
    </dialog>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
`);

const settingsDialog = document.querySelector("#settings-dialog");

function fillSettingsForm() {
    document.querySelector("#partner-one").value = state.settings.partnerOne;
    document.querySelector("#partner-two").value = state.settings.partnerTwo;
    document.querySelector("#wedding-date").value = state.settings.weddingDate;
}

function redirectToLogin() {
    window.location.replace(new URL("../login/index.html", window.location.href).href);
}

let weddingSettingsError = null;

const weddingSettingsPromise = getCurrentWedding()
    .then(settings => {
        state.settings = settings;
        fillSettingsForm();

        if (typeof renderAll === "function") {
            renderAll();
        }

        return settings;
    })
    .catch(error => {
        weddingSettingsError = error;

        if (error.code === "AUTH_REQUIRED") {
            redirectToLogin();
            return null;
        }

        showToast(error.message);
        return null;
    });

document.querySelector("#open-settings").addEventListener("click", async () => {
    await weddingSettingsPromise;

    if (weddingSettingsError) {
        showToast(weddingSettingsError.message);
        return;
    }

    fillSettingsForm();
    settingsDialog.showModal();
});
document.querySelector("#close-settings").addEventListener("click", () => settingsDialog.close());
settingsDialog.addEventListener("click", event => {
    if (event.target === settingsDialog) settingsDialog.close();
});
document.querySelector("#settings-form").addEventListener("submit", async event => {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector("[type='submit']");
    const data = new FormData(event.currentTarget);
    const settings = {
        partnerOne: data.get("partnerOne").trim(),
        partnerTwo: data.get("partnerTwo").trim(),
        weddingDate: data.get("weddingDate")
    };

    submitButton.disabled = true;

    try {
        state.settings = await updateCurrentWedding(settings);
        fillSettingsForm();
        renderAll();
        settingsDialog.close();
        showToast("Informações atualizadas.");
    } catch (error) {
        if (error.code === "AUTH_REQUIRED") {
            redirectToLogin();
            return;
        }

        showToast(error.message);
    } finally {
        submitButton.disabled = false;
    }
});
