const pageRoutes = {
    inicio: "../visao-geral/index.html",
    convidados: "../convidados/index.html",
    locais: "../locais/index.html",
    tarefas: "../checklist/index.html",
    orcamento: "../orcamento/index.html"
};

let logoutDialog = null;
let logoutTrigger = null;
let logoutInProgress = false;
let restoreLogoutFocus = true;

function navigate(pageId) {
    window.location.href = pageRoutes[pageId];
}

function ensureLogoutDialog() {
    const existingDialog = document.querySelector("#logout-dialog");
    if (existingDialog) {
        logoutDialog = existingDialog;
        return existingDialog;
    }

    document.body.insertAdjacentHTML("beforeend", `
        <dialog class="logout-dialog" id="logout-dialog" aria-labelledby="logout-dialog-title" aria-describedby="logout-dialog-description logout-dialog-help">
            <article>
                <header class="logout-dialog-header">
                    <div>
                        <p class="eyebrow">Sessão atual</p>
                        <h2 id="logout-dialog-title">Sair da conta?</h2>
                    </div>
                    <button class="icon-button" data-logout-action="cancel" type="button" aria-label="Fechar confirmação de saída">×</button>
                </header>
                <div class="logout-dialog-content">
                    <p id="logout-dialog-description">Tem certeza de que deseja sair da sua conta?</p>
                    <p id="logout-dialog-help">Você precisará entrar novamente para acessar o Nosso Casamento.</p>
                </div>
                <footer class="logout-dialog-actions">
                    <button class="button button-ghost" id="cancel-logout" data-logout-action="cancel" type="button">Cancelar</button>
                    <button class="button button-primary" id="confirm-logout" data-logout-action="confirm" type="button">Sair</button>
                </footer>
            </article>
        </dialog>
    `);

    logoutDialog = document.querySelector("#logout-dialog");
    logoutDialog.addEventListener("click", event => {
        const actionButton = event.target.closest?.("[data-logout-action]");
        if (actionButton?.dataset.logoutAction === "cancel") {
            closeLogoutDialog();
            return;
        }
        if (actionButton?.dataset.logoutAction === "confirm") {
            confirmLogout();
            return;
        }
        if (event.target === logoutDialog && !logoutInProgress) closeLogoutDialog();
    });
    logoutDialog.addEventListener("cancel", event => {
        if (logoutInProgress) event.preventDefault();
    });
    logoutDialog.addEventListener("close", resetLogoutDialog);
    return logoutDialog;
}

function setLogoutBusy(busy) {
    logoutInProgress = busy;
    const confirmButton = document.querySelector("#confirm-logout");
    const cancelButtons = document.querySelectorAll("[data-logout-action='cancel']");
    if (confirmButton) {
        confirmButton.disabled = busy;
        confirmButton.textContent = busy ? "Saindo..." : "Sair";
        confirmButton.setAttribute("aria-busy", String(busy));
    }
    cancelButtons.forEach(button => {
        button.disabled = busy;
    });
}

function openLogoutDialog(trigger) {
    if (logoutInProgress) return;
    const dialog = ensureLogoutDialog();
    logoutTrigger = trigger;
    restoreLogoutFocus = true;
    if (!dialog.open) dialog.showModal();
    document.querySelector("#cancel-logout")?.focus();
}

function closeLogoutDialog() {
    if (!logoutDialog?.open || logoutInProgress) return;
    logoutDialog.close();
}

function resetLogoutDialog() {
    setLogoutBusy(false);
    const trigger = logoutTrigger;
    logoutTrigger = null;
    if (restoreLogoutFocus && trigger?.isConnected !== false) trigger?.focus?.();
    restoreLogoutFocus = true;
}

function redirectAfterLogout() {
    if (typeof redirectToLogin === "function") {
        redirectToLogin();
        return;
    }

    window.location.replace(new URL("../login/index.html", window.location.href).href);
}

async function confirmLogout() {
    if (logoutInProgress) return;
    setLogoutBusy(true);

    try {
        const signOut = globalThis.signOutCurrentUser;
        if (typeof signOut !== "function") {
            throw new Error("O serviço de autenticação não foi carregado corretamente.");
        }

        await signOut();
    } catch (error) {
        console.error("[Autenticação] Não foi possível encerrar a sessão atual.", error);
        if (error?.cause) console.error("[Autenticação] Causa original do logout:", error.cause);
        setLogoutBusy(false);
        showToast("Não foi possível sair da conta. Tente novamente.");
        return;
    }

    restoreLogoutFocus = false;
    setLogoutBusy(false);
    if (logoutDialog?.open) logoutDialog.close();
    redirectAfterLogout();
}

async function loadSidebar() {
    const sidebar = document.querySelector("#sidebar-container");
    const response = await fetch("../../components/sidebar.html?v=20260722-logout-1");
    sidebar.innerHTML = await response.text();

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.page === document.body.dataset.page);
        item.addEventListener("click", () => navigate(item.dataset.page));
    });

    const logoutButton = document.querySelector("#open-logout");
    logoutButton?.addEventListener("click", () => openLogoutDialog(logoutButton));
    ensureLogoutDialog();
}

const sidebarLoadPromise = loadSidebar();
