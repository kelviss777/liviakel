const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const supabaseSource = fs.readFileSync(path.join(projectRoot, "js", "supabase.js"), "utf8");

function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function createVenueClient({
    user = { id: "user-123" },
    weddingId = "wedding-456",
    rows = [],
    errors = {},
    emptyResults = {}
} = {}) {
    const calls = [];

    function venueBuilder() {
        const query = {
            operation: "list",
            payload: null,
            filters: [],
            orders: [],
            selectColumns: null
        };

        const builder = {
            select(columns) {
                query.selectColumns = columns;
                return this;
            },
            insert(payload) {
                query.operation = "insert";
                query.payload = clone(payload);
                return this;
            },
            update(payload) {
                query.operation = "update";
                query.payload = clone(payload);
                return this;
            },
            delete() {
                query.operation = "delete";
                return this;
            },
            eq(column, value) {
                query.filters.push({ column, value });
                return this;
            },
            order(column, options) {
                query.orders.push({ column, options: clone(options) });
                return this;
            },
            async maybeSingle() {
                calls.push(clone(query));
                const error = errors[query.operation] || null;
                if (error) return { data: null, error };
                if (emptyResults[query.operation]) return { data: null, error: null };

                const idFilter = query.filters.find(filter => filter.column === "id")?.value;
                if (query.operation === "insert") {
                    return {
                        data: {
                            id: "11111111-1111-4111-8111-111111111111",
                            ...clone(query.payload),
                            created_at: "2026-07-21T12:00:00Z"
                        },
                        error: null
                    };
                }
                if (query.operation === "update") {
                    const current = rows.find(row => row.id === idFilter) || {};
                    return { data: { ...clone(current), ...clone(query.payload), id: idFilter }, error: null };
                }
                if (query.operation === "delete") {
                    return { data: { id: idFilter }, error: null };
                }
                return { data: null, error: null };
            },
            then(resolve, reject) {
                calls.push(clone(query));
                const response = errors.list
                    ? { data: null, error: errors.list }
                    : { data: clone(rows), error: null };
                return Promise.resolve(response).then(resolve, reject);
            }
        };

        return builder;
    }

    return {
        calls,
        auth: {
            async getUser() {
                return { data: { user }, error: user ? null : { message: "missing session" } };
            }
        },
        from(table) {
            if (table === "wedding_members") {
                return {
                    select() { return this; },
                    eq(column, value) {
                        calls.push({ operation: "membership", column, value });
                        return this;
                    },
                    async limit() {
                        return { data: [{ wedding_id: weddingId }], error: null };
                    }
                };
            }
            if (table === "venues") return venueBuilder();
            throw new Error(`Tabela inesperada: ${table}`);
        }
    };
}

function loadSupabaseFunctions(client) {
    const context = vm.createContext({
        console,
        URL,
        Object,
        Number,
        String,
        Boolean,
        window: { supabase: { createClient: () => client } },
        document: { createElement: () => ({}), head: { appendChild() {} } }
    });
    vm.runInContext(supabaseSource, context);
    return context;
}

function evaluate(context, expression) {
    return vm.runInContext(expression, context);
}

test("converte snake_case do banco para o modelo completo da interface", () => {
    const context = loadSupabaseFunctions(createVenueClient());
    const mapped = evaluate(context, `mapVenueDatabaseRecord({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Villa Jardim', type: 'Buffet', address: 'Rua 1', favorite: true,
        description: null, rating: 5, budget_value: '12000.50', deposit_value: null,
        decoration_option: null, has_bridal_room: null, capacity: '180',
        has_parking: true, space_availability: null,
        start_time: '19:00:00', end_time: '03:30:00', available_date: null,
        pros: [{ id: 'p1', title: 'Equipe', description: 'Boa' }],
        cons: 'texto inválido', created_at: '2026-07-21T12:00:00Z'
    })`);

    assert.deepEqual(JSON.parse(JSON.stringify(mapped)), {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Villa Jardim",
        type: "Buffet",
        address: "Rua 1",
        favorite: true,
        description: "",
        rating: 5,
        budgetValue: 12000.5,
        depositValue: null,
        decorationOption: "unknown",
        hasBridalRoom: false,
        capacity: 180,
        hasParking: true,
        spaceAvailability: "unknown",
        startTime: "19:00",
        endTime: "03:30",
        availableDate: "",
        pros: [{ id: "p1", title: "Equipe", description: "Boa" }],
        cons: [],
        createdAt: "2026-07-21T12:00:00Z"
    });
});

test("converte camelCase para payload seguro sem campos técnicos", () => {
    const context = loadSupabaseFunctions(createVenueClient());
    const payload = evaluate(context, `mapVenueToDatabasePayload({
        id: 'id-local', weddingId: 'casamento-forjado', createdAt: 'ontem',
        name: '  Villa Jardim  ', type: ' Buffet ', address: ' Rua 1 ', favorite: false,
        description: '  Amplo  ', rating: null, budgetValue: NaN, depositValue: '',
        decorationOption: 'included', hasBridalRoom: true, capacity: null,
        hasParking: false, spaceAvailability: 'ceremony_and_reception',
        startTime: '', endTime: '', availableDate: '', remainingValue: 999,
        pros: [{ id: 'p1', title: ' Equipe ', description: ' Boa ' }], cons: null
    })`);

    assert.deepEqual(JSON.parse(JSON.stringify(payload)), {
        name: "Villa Jardim",
        type: "Buffet",
        address: "Rua 1",
        favorite: false,
        description: "Amplo",
        rating: null,
        budget_value: null,
        deposit_value: null,
        decoration_option: "included",
        has_bridal_room: true,
        capacity: null,
        has_parking: false,
        space_availability: "ceremony_and_reception",
        start_time: null,
        end_time: null,
        available_date: null,
        pros: [{ id: "p1", title: "Equipe", description: "Boa" }],
        cons: []
    });
    assert.equal(Object.hasOwn(payload, "id"), false);
    assert.equal(Object.hasOwn(payload, "wedding_id"), false);
    assert.equal(Object.hasOwn(payload, "remainingValue"), false);
});

test("lista locais autenticados com filtro de casamento e ordenação", async () => {
    const row = {
        id: "one", wedding_id: "wedding-456", name: "A", type: "Igreja",
        address: "Rua", favorite: true, pros: [], cons: []
    };
    const client = createVenueClient({ rows: [row] });
    const context = loadSupabaseFunctions(client);

    const result = await context.listCurrentWeddingVenues();
    assert.equal(result.weddingId, "wedding-456");
    assert.equal(result.venues[0].id, "one");

    const listCall = client.calls.find(call => call.operation === "list");
    assert.deepEqual(listCall.filters, [{ column: "wedding_id", value: "wedding-456" }]);
    assert.deepEqual(listCall.orders.map(order => [order.column, order.options.ascending]), [
        ["favorite", false], ["name", true]
    ]);
});

test("cadastra com wedding_id autenticado e usa o UUID retornado", async () => {
    const client = createVenueClient();
    const context = loadSupabaseFunctions(client);
    const created = await context.createCurrentWeddingVenue({
        id: "id-local-ignorado", name: "Villa", type: "Buffet", address: "Rua",
        favorite: false, pros: [], cons: []
    });

    const insertCall = client.calls.find(call => call.operation === "insert");
    assert.equal(insertCall.payload.wedding_id, "wedding-456");
    assert.equal(Object.hasOwn(insertCall.payload, "id"), false);
    assert.equal(created.id, "11111111-1111-4111-8111-111111111111");
});

test("atualiza por id e wedding_id sem alterar campos técnicos", async () => {
    const client = createVenueClient({ rows: [{ id: "venue-1", wedding_id: "wedding-456" }] });
    const context = loadSupabaseFunctions(client);
    await context.updateCurrentWeddingVenue("venue-1", {
        id: "outro", wedding_id: "forjado", created_at: "não alterar",
        name: "Atualizado", type: "Buffet", address: "Rua", pros: [], cons: []
    });

    const updateCall = client.calls.find(call => call.operation === "update");
    assert.deepEqual(updateCall.filters, [
        { column: "id", value: "venue-1" },
        { column: "wedding_id", value: "wedding-456" }
    ]);
    assert.equal(Object.hasOwn(updateCall.payload, "id"), false);
    assert.equal(Object.hasOwn(updateCall.payload, "wedding_id"), false);
    assert.equal(Object.hasOwn(updateCall.payload, "created_at"), false);
});

test("favorito atualiza somente a coluna favorite com ambos os filtros", async () => {
    const client = createVenueClient({ rows: [{ id: "venue-1", name: "A", pros: [], cons: [] }] });
    const context = loadSupabaseFunctions(client);
    await context.updateCurrentWeddingVenueFavorite("venue-1", true);

    const updateCall = client.calls.find(call => call.operation === "update");
    assert.deepEqual(updateCall.payload, { favorite: true });
    assert.deepEqual(updateCall.filters, [
        { column: "id", value: "venue-1" },
        { column: "wedding_id", value: "wedding-456" }
    ]);
});

test("exclusão usa simultaneamente id e wedding_id", async () => {
    const client = createVenueClient();
    const context = loadSupabaseFunctions(client);
    const deleted = await context.deleteCurrentWeddingVenue("venue-1");

    const deleteCall = client.calls.find(call => call.operation === "delete");
    assert.deepEqual(deleteCall.filters, [
        { column: "id", value: "venue-1" },
        { column: "wedding_id", value: "wedding-456" }
    ]);
    assert.deepEqual(JSON.parse(JSON.stringify(deleted)), { id: "venue-1" });
});

test("traduz erro de RLS sem tentar contornar a permissão", async () => {
    const client = createVenueClient({
        errors: { update: { code: "42501", message: "new row violates row-level security policy" } }
    });
    const context = loadSupabaseFunctions(client);

    await assert.rejects(
        context.updateCurrentWeddingVenueFavorite("venue-1", true),
        error => error.code === "VENUE_PERMISSION_DENIED" && /permissão/.test(error.message)
    );
    assert.equal(client.calls.filter(call => call.operation === "update").length, 1);
});

test("não executa operação de venues sem usuário autenticado", async () => {
    const client = createVenueClient({ user: null });
    const context = loadSupabaseFunctions(client);

    await assert.rejects(
        context.listCurrentWeddingVenues(),
        error => error.code === "AUTH_REQUIRED"
    );
    assert.equal(client.calls.some(call => call.operation === "list"), false);
});

