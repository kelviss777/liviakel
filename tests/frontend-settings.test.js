const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const supabaseSource = fs.readFileSync(
    path.join(projectRoot, "js", "supabase.js"),
    "utf8"
);
const appSource = fs.readFileSync(
    path.join(projectRoot, "js", "app.js"),
    "utf8"
);

function loadSupabaseFunctions(client) {
    const context = vm.createContext({
        console,
        URL,
        window: {
            supabase: {
                createClient: () => client
            }
        },
        document: {
            createElement: () => ({}),
            head: { appendChild() {} }
        }
    });

    vm.runInContext(supabaseSource, context);
    return context;
}

function createClient({
    user = { id: "user-123" },
    memberships = [{ wedding_id: "wedding-456" }],
    wedding = {
        partner_one: "Ana",
        partner_two: "Lucas",
        wedding_date: "2027-05-22"
    },
    updatedWedding = {
        partner_one: "Bia",
        partner_two: "Caio",
        wedding_date: null
    }
} = {}) {
    const calls = [];

    return {
        calls,
        auth: {
            async getUser() {
                calls.push({ operation: "getUser" });
                return { data: { user }, error: null };
            }
        },
        from(table) {
            calls.push({ operation: "from", table });

            if (table === "wedding_members") {
                return {
                    select(columns) {
                        calls.push({ operation: "membership.select", columns });
                        return this;
                    },
                    eq(column, value) {
                        calls.push({
                            operation: "membership.eq",
                            column,
                            value
                        });
                        return this;
                    },
                    async limit(value) {
                        calls.push({ operation: "membership.limit", value });
                        return { data: memberships, error: null };
                    }
                };
            }

            if (table === "weddings") {
                return {
                    select(columns) {
                        calls.push({ operation: "wedding.select", columns });
                        return this;
                    },
                    update(payload) {
                        calls.push({ operation: "wedding.update", payload });
                        return this;
                    },
                    eq(column, value) {
                        calls.push({ operation: "wedding.eq", column, value });
                        return this;
                    },
                    async maybeSingle() {
                        const isUpdate = calls.some(
                            call => call.operation === "wedding.update"
                        );
                        return {
                            data: isUpdate ? updatedWedding : wedding,
                            error: null
                        };
                    }
                };
            }

            throw new Error(`Tabela inesperada: ${table}`);
        }
    };
}

test("lê o casamento usando o usuário autenticado e o vínculo real", async () => {
    const client = createClient();
    const context = loadSupabaseFunctions(client);

    const result = await context.getCurrentWedding();

    assert.deepEqual(
        JSON.parse(JSON.stringify(result)),
        {
            partnerOne: "Ana",
            partnerTwo: "Lucas",
            weddingDate: "2027-05-22"
        }
    );
    assert.ok(client.calls.some(
        call =>
            call.operation === "membership.eq" &&
            call.column === "user_id" &&
            call.value === "user-123"
    ));
    assert.ok(client.calls.some(
        call =>
            call.operation === "wedding.eq" &&
            call.column === "id" &&
            call.value === "wedding-456"
    ));
});

test("atualiza somente os três campos e converte data vazia para null", async () => {
    const client = createClient();
    const context = loadSupabaseFunctions(client);

    const result = await context.updateCurrentWedding({
        partnerOne: "  Bia ",
        partnerTwo: " Caio  ",
        weddingDate: ""
    });

    const updateCall = client.calls.find(
        call => call.operation === "wedding.update"
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(updateCall.payload)),
        {
            partner_one: "Bia",
            partner_two: "Caio",
            wedding_date: null
        }
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(result)),
        {
            partnerOne: "Bia",
            partnerTwo: "Caio",
            weddingDate: ""
        }
    );
});

test("não consulta ou escolhe casamento sem vínculo", async () => {
    const client = createClient({ memberships: [] });
    const context = loadSupabaseFunctions(client);

    await assert.rejects(
        context.getCurrentWedding(),
        error => error.code === "WEDDING_MEMBERSHIP_NOT_FOUND"
    );
    assert.equal(
        client.calls.some(
            call =>
                call.operation === "from" &&
                call.table === "weddings"
        ),
        false
    );
});

test("informa quando o vínculo aponta para um casamento inexistente", async () => {
    const client = createClient({ wedding: null });
    const context = loadSupabaseFunctions(client);

    await assert.rejects(
        context.getCurrentWedding(),
        error => error.code === "WEDDING_NOT_FOUND"
    );
});

test("não confirma uma atualização que retornou zero linhas", async () => {
    const client = createClient({ updatedWedding: null });
    const context = loadSupabaseFunctions(client);

    await assert.rejects(
        context.updateCurrentWedding({
            partnerOne: "Bia",
            partnerTwo: "Caio",
            weddingDate: "2027-08-10"
        }),
        error => error.code === "WEDDING_UPDATE_NOT_ALLOWED"
    );
});

test("mantém locais apenas para migração e não os recria no saveState", () => {
    const originalStoredState = {
        settings: {
            partnerOne: "Valor antigo",
            partnerTwo: "do localStorage",
            weddingDate: "2020-01-01"
        },
        guests: [{ id: "guest-1" }],
        venues: [{ id: "venue-1" }],
        tasks: [{ id: "task-1" }],
        expenses: [{ id: "expense-1" }]
    };
    let storedValue = JSON.stringify(originalStoredState);
    const localStorage = {
        getItem() {
            return storedValue;
        },
        setItem(key, value) {
            assert.equal(key, "nosso-casamento-v1");
            storedValue = value;
        }
    };
    const context = vm.createContext({
        localStorage,
        structuredClone,
        Intl,
        Date,
        Math
    });
    const stateModuleSource = appSource.slice(
        0,
        appSource.indexOf("document.body.insertAdjacentHTML")
    );

    vm.runInContext(stateModuleSource, context);
    const loadedState = vm.runInContext("structuredClone(state)", context);
    assert.deepEqual(loadedState.settings, {
        partnerOne: "",
        partnerTwo: "",
        weddingDate: ""
    });
    assert.deepEqual(loadedState.guests, [{ id: "guest-1" }]);
    assert.deepEqual(loadedState.venues, []);
    assert.deepEqual(
        vm.runInContext("loadLegacyVenues()", context),
        [{ id: "venue-1" }]
    );
    assert.deepEqual(loadedState.tasks, [{ id: "task-1" }]);
    assert.deepEqual(loadedState.expenses, [{ id: "expense-1" }]);

    vm.runInContext(`
        state.settings = {
            partnerOne: "Valor do Supabase",
            partnerTwo: "não deve ser salvo",
            weddingDate: "2027-05-22"
        };
        state.guests.push({ id: "guest-2" });
        saveState();
    `, context);

    const persistedState = JSON.parse(storedValue);
    assert.deepEqual(persistedState.settings, originalStoredState.settings);
    assert.deepEqual(
        persistedState.guests,
        [{ id: "guest-1" }, { id: "guest-2" }]
    );
    assert.deepEqual(persistedState.venues, [{ id: "venue-1" }]);
    assert.deepEqual(persistedState.tasks, [{ id: "task-1" }]);
    assert.deepEqual(persistedState.expenses, [{ id: "expense-1" }]);

    vm.runInContext("removeLegacyVenues(); saveState()", context);
    const stateAfterMigration = JSON.parse(storedValue);
    assert.equal(Object.hasOwn(stateAfterMigration, "venues"), false);
    assert.deepEqual(stateAfterMigration.guests, [{ id: "guest-1" }, { id: "guest-2" }]);
    assert.deepEqual(stateAfterMigration.tasks, [{ id: "task-1" }]);
    assert.deepEqual(stateAfterMigration.expenses, [{ id: "expense-1" }]);
});

test("todas as páginas internas carregam Supabase antes do app", () => {
    const internalPages = [
        "checklist",
        "convidados",
        "locais",
        "orcamento",
        "visao-geral"
    ];

    for (const page of internalPages) {
        const html = fs.readFileSync(
            path.join(projectRoot, "pages", page, "index.html"),
            "utf8"
        );
        const supabasePosition = html.search(
            /<script src="\.\.\/\.\.\/js\/supabase\.js(?:\?[^\"]+)?" defer><\/script>/
        );
        const appPosition = html.search(
            /<script src="\.\.\/\.\.\/js\/app\.js(?:\?[^\"]+)?" defer><\/script>/
        );

        assert.ok(supabasePosition >= 0, `${page} não carrega supabase.js`);
        assert.ok(appPosition > supabasePosition, `${page} carrega scripts fora de ordem`);
    }
});
