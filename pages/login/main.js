const authCopy = {
    login: {
        title: "Que bom ter vocês aqui",
        description: "Entre com qualquer um dos dois e-mails vinculados ao casamento."
    },
    register: {
        title: "Criem o espaço de vocês",
        description: "Cadastre os dois e-mails que terão acesso às mesmas informações."
    }
};

const authMessage = document.querySelector("#auth-message");

function showAuthMessage(message, type = "info") {
    authMessage.textContent = message;
    authMessage.className = `auth-message show ${type}`;
}

function clearAuthMessage() {
    authMessage.textContent = "";
    authMessage.className = "auth-message";
}

function changeAuthView(view) {
    document.querySelectorAll(".auth-tab").forEach(tab => {
        const active = tab.dataset.view === view;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active);
    });

    document.querySelectorAll(".auth-form").forEach(form => {
        const active = form.id === `${view}-form`;
        form.classList.toggle("active", active);
        form.hidden = !active;
    });

    document.querySelector("#auth-title").textContent = authCopy[view].title;
    document.querySelector("#auth-description").textContent = authCopy[view].description;
    clearAuthMessage();
}

document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => changeAuthView(tab.dataset.view));
});

document.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
        const input = document.querySelector(`#${button.dataset.passwordToggle}`);
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        button.setAttribute("aria-label", showing ? "Mostrar senha" : "Ocultar senha");
        button.textContent = showing ? "◉" : "○";
    });
});

document.querySelector("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    clearAuthMessage();

    const form = event.currentTarget;
    const button = form.querySelector("[type='submit']");
    const data = new FormData(form);
    button.disabled = true;

    try {
        await signInCouple({
            email: data.get("email").trim(),
            password: data.get("password")
        });
        showAuthMessage("Login realizado. Abrindo o espaço de vocês…", "success");
        window.setTimeout(() => {
            window.location.href = "../visao-geral/index.html";
        }, 650);
    } catch (error) {
        showAuthMessage(error.message, "error");
    } finally {
        button.disabled = false;
    }
});

document.querySelector("#register-form").addEventListener("submit", async event => {
    event.preventDefault();
    clearAuthMessage();

    const form = event.currentTarget;
    const button = form.querySelector("[type='submit']");
    const data = new FormData(form);
    const primaryEmail = data.get("primaryEmail").trim().toLowerCase();
    const partnerEmail = data.get("partnerEmail").trim().toLowerCase();

    if (primaryEmail === partnerEmail) {
        showAuthMessage("Use dois e-mails diferentes para vincular o casal.", "error");
        return;
    }

    button.disabled = true;

    try {
        const result = await createCoupleAccount({
            primaryName: data.get("primaryName").trim(),
            partnerName: data.get("partnerName").trim(),
            primaryEmail,
            partnerEmail,
            password: data.get("password")
        });

        showAuthMessage(result.message, "success");
        form.reset();
    } catch (error) {
        showAuthMessage(error.message, "error");
    } finally {
        button.disabled = false;
    }
});

document.querySelector("#forgot-password").addEventListener("click", async () => {
    const email = document.querySelector("#login-email").value.trim();

    if (!email) {
        showAuthMessage("Digite seu e-mail antes de solicitar uma nova senha.", "info");
        document.querySelector("#login-email").focus();
        return;
    }

    try {
        await requestPasswordReset(email);
        showAuthMessage("Enviamos as instruções de recuperação para o seu e-mail.", "success");
    } catch (error) {
        showAuthMessage(error.message, "error");
    }
});
