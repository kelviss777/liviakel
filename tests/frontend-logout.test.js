const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const supabaseSource = fs.readFileSync(path.join(projectRoot, "js", "supabase.js"), "utf8");
const appSource = fs.readFileSync(path.join(projectRoot, "js", "app.js"), "utf8");
const sidebarSource = fs.readFileSync(path.join(projectRoot, "components", "sidebar.js"), "utf8");
const sidebarHtml = fs.readFileSync(path.join(projectRoot, "components", "sidebar.html"), "utf8");
const sidebarCss = fs.readFileSync(path.join(projectRoot, "components", "sidebar.css"), "utf8");

function loadSupabaseForLogout(client) {
    const context = vm.createContext({
        console,
        URL,
        Object,
        window: { supabase: { createClient: () => client } },
        document: { createElement: () => ({}), head: { appendChild() {} } }
    });
    vm.runInContext(supabaseSource, context);
    return context;
}

class FakeClassList {
    constructor() {
        this.values = new Set();
    }

    toggle(value, force) {
        if (force) this.values.add(value);
        else this.values.delete(value);
    }
}

class FakeElement {
    constructor({ id = "", dataset = {} } = {}) {
        this.id = id;
        this.dataset = { ...dataset };
        this.listeners = {};
        this.attributes = new Map();
        this.classList = new FakeClassList();
        this.innerHTML = "";
        this.textContent = "";
        this.disabled = false;
        this.open = false;
        this.focused = false;
        this.isConnected = true;
    }

    addEventListener(type, listener) {
        this.listeners[type] ||= [];
        this.listeners[type].push(listener);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    focus() {
        this.focused = true;
    }

    showModal() {
        this.open = true;
    }

    close() {
        if (!this.open) return;
        this.open = false;
        for (const listener of this.listeners.close || []) listener({ target: this });
    }

    closest(selector) {
        if (selector === "[data-logout-action]" && this.dataset.logoutAction) return this;
        return null;
    }
}

function createSidebarHarness({ signOut } = {}) {
    const elements = new Map();
    const sidebar = new FakeElement({ id: "sidebar-container" });
    const logoutButton = new FakeElement({ id: "open-logout" });
    const cancelButton = new FakeElement({ id: "cancel-logout", dataset: { logoutAction: "cancel" } });
    const closeButton = new FakeElement({ dataset: { logoutAction: "cancel" } });
    const confirmButton = new FakeElement({ id: "confirm-logout", dataset: { logoutAction: "confirm" } });
    const navItems = ["inicio", "convidados", "locais", "tarefas", "orcamento"].map(page =>
        new FakeElement({ dataset: { page } })
    );
    elements.set("#sidebar-container", sidebar);
    elements.set("#open-logout", logoutButton);

    const body = new FakeElement();
    body.dataset = { page: "locais" };
    let dialogInsertions = 0;
    let dialog = null;
    body.insertAdjacentHTML = () => {
        dialogInsertions += 1;
        dialog = new FakeElement({ id: "logout-dialog" });
        elements.set("#logout-dialog", dialog);
        elements.set("#cancel-logout", cancelButton);
        elements.set("#confirm-logout", confirmButton);
    };

    const document = {
        body,
        querySelector(selector) {
            return elements.get(selector) || null;
        },
        querySelectorAll(selector) {
            if (selector === ".nav-item") return navItems;
            if (selector === "[data-logout-action='cancel']") return [closeButton, cancelButton];
            return [];
        }
    };

    const toastMessages = [];
    const consoleErrors = [];
    let redirectCount = 0;
    let signOutCount = 0;
    const context = vm.createContext({
        URL,
        document,
        window: { location: { href: "https://example.test/projeto/pages/locais/index.html" } },
        fetch: async url => ({
            async text() {
                assert.equal(url, "../../components/sidebar.html?v=20260722-logout-1");
                return sidebarHtml;
            }
        }),
        console: {
            ...console,
            error(...args) {
                consoleErrors.push(args);
            }
        },
        async signOutCurrentUser() {
            signOutCount += 1;
            if (signOut) return signOut();
        },
        redirectToLogin() {
            redirectCount += 1;
        },
        showToast(message) {
            toastMessages.push(message);
        }
    });

    vm.runInContext(sidebarSource, context);
    return {
        context,
        sidebar,
        logoutButton,
        cancelButton,
        closeButton,
        confirmButton,
        toastMessages,
        consoleErrors,
        get dialog() { return dialog; },
        getDialogInsertions: () => dialogInsertions,
        getRedirectCount: () => redirectCount,
        getSignOutCount: () => signOutCount,
        initializationPromise: vm.runInContext("sidebarLoadPromise", context)
    };
}

test("signOutCurrentUser encerra somente a sessão local", async () => {
    const calls = [];
    const client = {
        auth: {
            async signOut(options) {
                calls.push(options);
                return { error: null };
            }
        }
    };
    const context = loadSupabaseForLogout(client);

    await context.signOutCurrentUser();

    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ scope: "local" }]);
    assert.doesNotMatch(supabaseSource, /localStorage\.clear|sessionStorage\.clear|deleteUser|scope:\s*["']global/);
});

test("erro do Supabase é traduzido sem redirecionar ou apagar dados", async () => {
    const technicalError = { message: "network error" };
    const context = loadSupabaseForLogout({
        auth: { async signOut() { return { error: technicalError }; } }
    });

    await assert.rejects(
        context.signOutCurrentUser(),
        error => error.code === "SIGN_OUT_FAILED" && error.cause === technicalError
    );
});

test("sidebar compartilhada cria um único diálogo e abre com foco em Cancelar", async () => {
    const harness = createSidebarHarness();
    await harness.initializationPromise;

    assert.match(harness.sidebar.innerHTML, />Sair</);
    assert.equal(harness.logoutButton.listeners.click.length, 1);
    assert.equal(harness.getDialogInsertions(), 1);
    vm.runInContext("ensureLogoutDialog()", harness.context);
    assert.equal(harness.getDialogInsertions(), 1);

    harness.logoutButton.listeners.click[0]();
    assert.equal(harness.dialog.open, true);
    assert.equal(harness.cancelButton.focused, true);
});

test("Cancelar, Esc e clique fora não encerram a sessão e devolvem o foco", async () => {
    const harness = createSidebarHarness();
    await harness.initializationPromise;

    harness.logoutButton.listeners.click[0]();
    harness.dialog.listeners.click[0]({ target: harness.cancelButton });
    assert.equal(harness.dialog.open, false);
    assert.equal(harness.getSignOutCount(), 0);
    assert.equal(harness.logoutButton.focused, true);

    harness.logoutButton.focused = false;
    harness.logoutButton.listeners.click[0]();
    let escapePrevented = false;
    harness.dialog.listeners.cancel[0]({ preventDefault() { escapePrevented = true; } });
    assert.equal(escapePrevented, false);
    harness.dialog.close();
    assert.equal(harness.logoutButton.focused, true);

    harness.logoutButton.focused = false;
    harness.logoutButton.listeners.click[0]();
    harness.dialog.listeners.click[0]({ target: harness.dialog });
    assert.equal(harness.dialog.open, false);
    assert.equal(harness.logoutButton.focused, true);
    assert.equal(harness.getSignOutCount(), 0);
});

test("confirmar bloqueia duplo clique, aguarda logout e redireciona uma vez", async () => {
    let releaseLogout;
    const pendingLogout = new Promise(resolve => {
        releaseLogout = resolve;
    });
    const harness = createSidebarHarness({ signOut: () => pendingLogout });
    await harness.initializationPromise;
    harness.logoutButton.listeners.click[0]();

    const firstConfirmation = vm.runInContext("confirmLogout()", harness.context);
    const secondConfirmation = vm.runInContext("confirmLogout()", harness.context);
    assert.equal(harness.getSignOutCount(), 1);
    assert.equal(harness.confirmButton.disabled, true);
    assert.equal(harness.cancelButton.disabled, true);
    assert.equal(harness.confirmButton.textContent, "Saindo...");

    releaseLogout();
    await Promise.all([firstConfirmation, secondConfirmation]);
    assert.equal(harness.getSignOutCount(), 1);
    assert.equal(harness.getRedirectCount(), 1);
    assert.equal(harness.dialog.open, false);
});

test("falha mantém diálogo aberto, restaura controles e mostra erro", async () => {
    const harness = createSidebarHarness({
        signOut: async () => {
            throw new Error("falha técnica");
        }
    });
    await harness.initializationPromise;
    harness.logoutButton.listeners.click[0]();

    await vm.runInContext("confirmLogout()", harness.context);

    assert.equal(harness.dialog.open, true);
    assert.equal(harness.confirmButton.disabled, false);
    assert.equal(harness.cancelButton.disabled, false);
    assert.equal(harness.confirmButton.textContent, "Sair");
    assert.equal(harness.getRedirectCount(), 0);
    assert.match(harness.toastMessages.at(-1), /Não foi possível sair/);
    assert.equal(harness.consoleErrors.length, 1);
});

test("botão e diálogo têm conteúdo acessível e regras desktop/mobile", () => {
    assert.match(sidebarHtml, /<button[^>]+id="open-logout"[^>]+type="button"/);
    assert.match(sidebarHtml, /<span>Sair<\/span>/);
    assert.match(sidebarSource, /Sair da conta\?/);
    assert.match(sidebarSource, /Tem certeza de que deseja sair da sua conta\?/);
    assert.match(sidebarSource, /Você precisará entrar novamente para acessar o Nosso Casamento\./);
    assert.doesNotMatch(sidebarSource, /window\.confirm/);
    assert.match(sidebarCss, /\.sidebar-actions \{ margin-top: auto/);
    assert.match(sidebarCss, /@media \(max-width: 900px\)/);
    assert.match(sidebarCss, /\.main-nav \{ flex: 5 1 0/);
    assert.match(sidebarCss, /\.sidebar-actions \{ flex: 1 1 0/);
});

test("as cinco páginas internas carregam a mesma sidebar versionada", () => {
    const pages = ["visao-geral", "convidados", "locais", "checklist", "orcamento"];
    for (const page of pages) {
        const html = fs.readFileSync(path.join(projectRoot, "pages", page, "index.html"), "utf8");
        assert.match(html, /components\/sidebar\.css\?v=20260722-logout-1/);
        assert.match(html, /js\/supabase\.js\?v=20260722-logout-1/);
        assert.match(html, /components\/sidebar\.js\?v=20260722-logout-1/);
        assert.match(html, /id="sidebar-container"/);
    }
});

test("redirecionamento relativo preserva o subdiretório local ou do GitHub Pages", () => {
    assert.match(appSource, /new URL\("\.\.\/login\/index\.html", window\.location\.href\)/);
    assert.equal(
        new URL("../login/index.html", "http://127.0.0.1:8765/pages/locais/index.html").href,
        "http://127.0.0.1:8765/pages/login/index.html"
    );
    assert.equal(
        new URL("../login/index.html", "https://example.github.io/nosso-casamento/pages/checklist/index.html").href,
        "https://example.github.io/nosso-casamento/pages/login/index.html"
    );
});
