/*
 * Preencha estas duas informações depois de criar o projeto no Supabase.
 * A chave publicável pode ficar no navegador. Nunca coloque a secret key
 * ou a antiga service_role neste arquivo.
 */
const SUPABASE_URL = "https://tqxgtddvzmmmgahqsvhu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0-5WGpH1PeoUJ8qndLuUVg_CfmxZWPZ";

let supabaseClient = null;
let supabaseScriptPromise = null;

function isSupabaseConfigured() {
    return Boolean(
        SUPABASE_URL &&
        SUPABASE_PUBLISHABLE_KEY
    );
}

function loadSupabaseScript() {
    if (window.supabase?.createClient) {
        return Promise.resolve();
    }

    if (!supabaseScriptPromise) {
        supabaseScriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://unpkg.com/@supabase/supabase-js@2";
            script.onload = resolve;
            script.onerror = () => reject(new Error("Não foi possível carregar o serviço de autenticação."));
            document.head.appendChild(script);
        });
    }

    return supabaseScriptPromise;
}

async function getSupabaseClient() {
    if (!isSupabaseConfigured()) {
        throw new Error("A tela está pronta, mas o banco ainda não foi configurado. Adicione a URL e a chave publicável do Supabase em js/supabase.js.");
    }

    await loadSupabaseScript();

    if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY
        );
    }

    return supabaseClient;
}

function createSupabaseAppError(message, code, cause = null) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
}

function isSupabasePermissionError(error) {
    const message = String(error?.message || "").toLowerCase();
    return error?.code === "42501" ||
        message.includes("row-level security") ||
        message.includes("permission denied") ||
        message.includes("not authorized");
}

function createVenueSupabaseError(error, fallbackMessage, code) {
    if (isSupabasePermissionError(error)) {
        return createSupabaseAppError(
            "Sua conta não tem permissão para realizar esta operação nos locais do casamento.",
            "VENUE_PERMISSION_DENIED",
            error
        );
    }

    return createSupabaseAppError(fallbackMessage, code, error);
}

const GUEST_MEMBER_TYPES = new Set([
    "family_member",
    "individual_guest",
    "couple_adult",
    "couple_child",
    "godparent_couple",
    "godparent_individual"
]);

function createGuestSupabaseError(error, fallbackMessage, code) {
    if (isSupabasePermissionError(error)) {
        return createSupabaseAppError(
            "Sua conta não tem permissão para realizar esta operação nos convidados do casamento.",
            "GUEST_PERMISSION_DENIED",
            error
        );
    }

    return createSupabaseAppError(fallbackMessage, code, error);
}

function mapGuestGroupRowToLocal(record = {}) {
    return {
        id: String(record.id ?? ""),
        category: String(record.category ?? "individual_group"),
        name: String(record.name ?? ""),
        relationshipGroup: String(record.relationship_group ?? ""),
        notes: String(record.notes ?? ""),
        isClosed: record.is_closed === true,
        isSystem: record.is_system === true,
        systemKey: record.system_key == null ? null : String(record.system_key),
        sortOrder: Number.isFinite(Number(record.sort_order)) && record.sort_order !== null
            ? Number(record.sort_order)
            : null,
        createdAt: String(record.created_at ?? ""),
        updatedAt: String(record.updated_at ?? "")
    };
}

function mapGuestGroupToDatabase(group = {}) {
    const sortOrder = group.sortOrder === null || group.sortOrder === undefined || group.sortOrder === ""
        ? null
        : Number(group.sortOrder);
    return {
        category: String(group.category ?? "").trim(),
        name: String(group.name ?? "").trim(),
        relationship_group: String(group.relationshipGroup ?? "").trim() || null,
        notes: String(group.notes ?? "").trim() || null,
        is_closed: group.isClosed === true,
        is_system: group.isSystem === true,
        system_key: String(group.systemKey ?? "").trim() || null,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : null
    };
}

function mapGuestMemberRow(record = {}) {
    return {
        id: String(record.id ?? ""),
        guestGroupId: String(record.guest_group_id ?? ""),
        name: String(record.name ?? ""),
        notes: String(record.notes ?? ""),
        isChild: record.is_child === true,
        memberType: String(record.member_type ?? ""),
        pairId: record.pair_id == null ? null : String(record.pair_id),
        householdId: record.household_id == null ? null : String(record.household_id),
        sortOrder: Number.isFinite(Number(record.sort_order)) && record.sort_order !== null
            ? Number(record.sort_order)
            : null,
        createdAt: String(record.created_at ?? ""),
        updatedAt: String(record.updated_at ?? "")
    };
}

function guestUuidForDatabase(value, fieldName) {
    const normalized = String(value ?? "").trim();
    if (!normalized) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(normalized)) {
        return normalized;
    }
    throw createSupabaseAppError(
        `O vínculo ${fieldName} precisa ser um UUID válido.`,
        "GUEST_MEMBER_UUID_INVALID"
    );
}

function mapGuestMemberToDatabase(member = {}) {
    const memberType = String(member.memberType ?? "").trim();
    if (!GUEST_MEMBER_TYPES.has(memberType)) {
        throw createSupabaseAppError(
            "O tipo de integrante informado não é suportado.",
            "GUEST_MEMBER_TYPE_INVALID"
        );
    }
    const sortOrder = member.sortOrder === null || member.sortOrder === undefined || member.sortOrder === ""
        ? null
        : Number(member.sortOrder);
    return {
        name: String(member.name ?? "").trim(),
        notes: String(member.notes ?? "").trim() || null,
        is_child: member.isChild === true,
        member_type: memberType,
        pair_id: guestUuidForDatabase(member.pairId, "pair_id"),
        household_id: guestUuidForDatabase(member.householdId, "household_id"),
        sort_order: Number.isFinite(sortOrder) ? sortOrder : null
    };
}

function guestMemberPayloadChanged(current, desired) {
    const currentPayload = mapGuestMemberToDatabase(current);
    const desiredPayload = mapGuestMemberToDatabase(desired);
    return Object.keys(desiredPayload).some(key => currentPayload[key] !== desiredPayload[key]);
}

async function getAuthenticatedUser() {
    const client = await getSupabaseClient();
    const { data, error } = await client.auth.getUser();

    if (error) {
        throw createSupabaseAppError(
            "Não foi possível validar sua sessão. Entre novamente.",
            "AUTH_REQUIRED"
        );
    }

    if (!data.user) {
        throw createSupabaseAppError(
            "Sua sessão terminou. Entre novamente para continuar.",
            "AUTH_REQUIRED"
        );
    }

    return data.user;
}

async function resolveCurrentWeddingContext() {
    const client = await getSupabaseClient();
    const user = await getAuthenticatedUser();
    const { data: memberships, error: membershipError } = await client
        .from("wedding_members")
        .select("wedding_id")
        .eq("user_id", user.id)
        .limit(2);

    if (membershipError) {
        throw createSupabaseAppError(
            "Não foi possível localizar o vínculo do seu casamento. Verifique as permissões de acesso.",
            "MEMBERSHIP_QUERY_FAILED"
        );
    }

    if (!memberships?.length || !memberships[0].wedding_id) {
        throw createSupabaseAppError(
            "Sua conta ainda não está vinculada a um casamento. Conclua o cadastro do casal antes de continuar.",
            "WEDDING_MEMBERSHIP_NOT_FOUND"
        );
    }

    if (memberships.length > 1) {
        throw createSupabaseAppError(
            "Sua conta está vinculada a mais de um casamento. Esta versão aceita apenas um vínculo.",
            "MULTIPLE_WEDDING_MEMBERSHIPS"
        );
    }

    return {
        user,
        weddingId: memberships[0].wedding_id
    };
}

function mapWeddingRecord(record) {
    return {
        partnerOne: record.partner_one ?? "",
        partnerTwo: record.partner_two ?? "",
        weddingDate: record.wedding_date ?? ""
    };
}

async function getCurrentWedding() {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const { data, error } = await client
        .from("weddings")
        .select("partner_one, partner_two, wedding_date")
        .eq("id", weddingId)
        .maybeSingle();

    if (error) {
        throw createSupabaseAppError(
            "Não foi possível carregar as configurações do casamento. Verifique as permissões de acesso.",
            "WEDDING_QUERY_FAILED"
        );
    }

    if (!data) {
        throw createSupabaseAppError(
            "O vínculo da sua conta existe, mas o casamento correspondente não foi encontrado.",
            "WEDDING_NOT_FOUND"
        );
    }

    return mapWeddingRecord(data);
}

async function updateCurrentWedding({ partnerOne, partnerTwo, weddingDate }) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const normalizedSettings = {
        partnerOne: String(partnerOne ?? "").trim(),
        partnerTwo: String(partnerTwo ?? "").trim(),
        weddingDate: String(weddingDate ?? "").trim()
    };

    if (!normalizedSettings.partnerOne || !normalizedSettings.partnerTwo) {
        throw createSupabaseAppError(
            "Preencha os dois nomes antes de salvar.",
            "WEDDING_VALIDATION_FAILED"
        );
    }

    const { data, error } = await client
        .from("weddings")
        .update({
            partner_one: normalizedSettings.partnerOne,
            partner_two: normalizedSettings.partnerTwo,
            wedding_date: normalizedSettings.weddingDate || null
        })
        .eq("id", weddingId)
        .select("partner_one, partner_two, wedding_date")
        .maybeSingle();

    if (error) {
        throw createSupabaseAppError(
            "Não foi possível salvar as informações do casamento. Verifique sua conexão e as permissões de acesso.",
            "WEDDING_UPDATE_FAILED"
        );
    }

    if (!data) {
        throw createSupabaseAppError(
            "O casamento não pôde ser atualizado. Verifique se sua conta ainda possui acesso e se as políticas RLS permitem a alteração.",
            "WEDDING_UPDATE_NOT_ALLOWED"
        );
    }

    return mapWeddingRecord(data);
}

function normalizeVenueDatabaseNumber(value, { integer = false } = {}) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number) || (integer && !Number.isInteger(number))) return null;
    return number;
}

function normalizeVenueDatabaseTime(value) {
    const time = String(value ?? "").trim();
    const match = time.match(/^(\d{2}:\d{2})/);
    return match ? match[1] : "";
}

function normalizeVenueJsonList(value) {
    if (!Array.isArray(value)) return [];

    return value.map(item => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const id = String(item.id ?? "").trim();
        const title = String(item.title ?? "").trim();
        const description = String(item.description ?? "").trim();
        if (!id && !title && !description) return null;
        return { id, title, description };
    }).filter(Boolean);
}

function mapVenueDatabaseRecord(record = {}) {
    const venue = {
        id: String(record.id ?? ""),
        name: String(record.name ?? ""),
        type: String(record.type ?? ""),
        address: String(record.address ?? ""),
        favorite: record.favorite === true,
        description: String(record.description ?? ""),
        rating: normalizeVenueDatabaseNumber(record.rating, { integer: true }),
        budgetValue: normalizeVenueDatabaseNumber(record.budget_value),
        depositValue: normalizeVenueDatabaseNumber(record.deposit_value),
        decorationOption: String(record.decoration_option ?? "unknown"),
        hasBridalRoom: record.has_bridal_room === true,
        capacity: normalizeVenueDatabaseNumber(record.capacity, { integer: true }),
        hasParking: record.has_parking === true,
        spaceAvailability: String(record.space_availability ?? "unknown"),
        startTime: normalizeVenueDatabaseTime(record.start_time),
        endTime: normalizeVenueDatabaseTime(record.end_time),
        availableDate: String(record.available_date ?? ""),
        pros: normalizeVenueJsonList(record.pros),
        cons: normalizeVenueJsonList(record.cons)
    };

    if (Object.hasOwn(record, "created_at")) venue.createdAt = record.created_at;
    if (Object.hasOwn(record, "updated_at")) venue.updatedAt = record.updated_at;
    return venue;
}

function venueNumberForDatabase(value, { integer = false } = {}) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number) || (integer && !Number.isInteger(number))) return null;
    return number;
}

function mapVenueToDatabasePayload(venue = {}) {
    return {
        name: String(venue.name ?? "").trim(),
        type: String(venue.type ?? "").trim(),
        address: String(venue.address ?? "").trim(),
        favorite: venue.favorite === true,
        description: String(venue.description ?? "").trim(),
        rating: venueNumberForDatabase(venue.rating, { integer: true }),
        budget_value: venueNumberForDatabase(venue.budgetValue),
        deposit_value: venueNumberForDatabase(venue.depositValue),
        decoration_option: String(venue.decorationOption ?? "unknown"),
        has_bridal_room: venue.hasBridalRoom === true,
        capacity: venueNumberForDatabase(venue.capacity, { integer: true }),
        has_parking: venue.hasParking === true,
        space_availability: String(venue.spaceAvailability ?? "unknown"),
        start_time: String(venue.startTime ?? "").trim() || null,
        end_time: String(venue.endTime ?? "").trim() || null,
        available_date: String(venue.availableDate ?? "").trim() || null,
        pros: normalizeVenueJsonList(venue.pros),
        cons: normalizeVenueJsonList(venue.cons)
    };
}

async function listCurrentWeddingVenues() {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const { data, error } = await client
        .from("venues")
        .select("*")
        .eq("wedding_id", weddingId)
        .order("favorite", { ascending: false })
        .order("name", { ascending: true });

    if (error) {
        throw createVenueSupabaseError(
            error,
            "Não foi possível carregar os locais. Verifique sua conexão e tente novamente.",
            "VENUE_LIST_FAILED"
        );
    }

    return {
        weddingId,
        venues: Array.isArray(data) ? data.map(mapVenueDatabaseRecord) : []
    };
}

async function createCurrentWeddingVenue(venue) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const payload = mapVenueToDatabasePayload(venue);
    const { data, error } = await client
        .from("venues")
        .insert({ ...payload, wedding_id: weddingId })
        .select("*")
        .maybeSingle();

    if (error) {
        throw createVenueSupabaseError(
            error,
            "Não foi possível adicionar o local. Verifique sua conexão e tente novamente.",
            "VENUE_CREATE_FAILED"
        );
    }

    if (!data) {
        throw createSupabaseAppError(
            "O local não foi criado. Verifique se sua conta ainda possui acesso ao casamento.",
            "VENUE_CREATE_NOT_ALLOWED"
        );
    }

    return mapVenueDatabaseRecord(data);
}

async function updateCurrentWeddingVenue(venueId, venue) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const payload = mapVenueToDatabasePayload(venue);
    const { data, error } = await client
        .from("venues")
        .update(payload)
        .eq("id", venueId)
        .eq("wedding_id", weddingId)
        .select("*")
        .maybeSingle();

    if (error) {
        throw createVenueSupabaseError(
            error,
            "Não foi possível atualizar o local. Verifique sua conexão e tente novamente.",
            "VENUE_UPDATE_FAILED"
        );
    }

    if (!data) {
        throw createSupabaseAppError(
            "O local não foi atualizado. Verifique se ele ainda existe e se sua conta possui acesso.",
            "VENUE_UPDATE_NOT_ALLOWED"
        );
    }

    return mapVenueDatabaseRecord(data);
}

async function updateCurrentWeddingVenueFavorite(venueId, favorite) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const { data, error } = await client
        .from("venues")
        .update({ favorite: favorite === true })
        .eq("id", venueId)
        .eq("wedding_id", weddingId)
        .select("*")
        .maybeSingle();

    if (error) {
        throw createVenueSupabaseError(
            error,
            "Não foi possível atualizar o favorito. Verifique sua conexão e tente novamente.",
            "VENUE_FAVORITE_FAILED"
        );
    }

    if (!data) {
        throw createSupabaseAppError(
            "O favorito não foi atualizado. Verifique se sua conta ainda possui acesso ao local.",
            "VENUE_FAVORITE_NOT_ALLOWED"
        );
    }

    return mapVenueDatabaseRecord(data);
}

async function deleteCurrentWeddingVenue(venueId) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const { data, error } = await client
        .from("venues")
        .delete()
        .eq("id", venueId)
        .eq("wedding_id", weddingId)
        .select("id")
        .maybeSingle();

    if (error) {
        throw createVenueSupabaseError(
            error,
            "Não foi possível excluir o local. Verifique sua conexão e tente novamente.",
            "VENUE_DELETE_FAILED"
        );
    }

    if (!data) {
        throw createSupabaseAppError(
            "O local não foi excluído. Verifique se ele ainda existe e se sua conta possui acesso.",
            "VENUE_DELETE_NOT_ALLOWED"
        );
    }

    return { id: String(data.id) };
}

async function requireCurrentWeddingGuestGroup(client, weddingId, groupId) {
    const { data, error } = await client
        .from("guest_groups")
        .select("id")
        .eq("id", groupId)
        .eq("wedding_id", weddingId)
        .maybeSingle();

    if (error) {
        throw createGuestSupabaseError(
            error,
            "Não foi possível validar o grupo de convidados.",
            "GUEST_GROUP_ACCESS_FAILED"
        );
    }
    if (!data) {
        throw createSupabaseAppError(
            "O grupo não foi encontrado ou sua conta não possui mais acesso.",
            "GUEST_GROUP_NOT_FOUND"
        );
    }
    return String(data.id);
}

async function listGuestMembersWithClient(client, groupIds) {
    if (!groupIds.length) return [];
    const { data, error } = await client
        .from("guest_members")
        .select("*")
        .in("guest_group_id", groupIds)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

    if (error) {
        throw createGuestSupabaseError(
            error,
            "Não foi possível carregar os integrantes dos grupos.",
            "GUEST_MEMBER_LIST_FAILED"
        );
    }
    return Array.isArray(data) ? data.map(mapGuestMemberRow) : [];
}

async function listCurrentWeddingGuestGroups() {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const { data, error } = await client
        .from("guest_groups")
        .select("*")
        .eq("wedding_id", weddingId)
        .order("is_system", { ascending: false })
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

    if (error) {
        throw createGuestSupabaseError(
            error,
            "Não foi possível carregar os convidados. Verifique sua conexão e tente novamente.",
            "GUEST_GROUP_LIST_FAILED"
        );
    }

    const guestGroups = Array.isArray(data) ? data.map(mapGuestGroupRowToLocal) : [];
    const guestMembers = await listGuestMembersWithClient(client, guestGroups.map(group => group.id));
    return { weddingId, guestGroups, guestMembers };
}

async function createCurrentWeddingGuestGroup(group) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const groupPayload = mapGuestGroupToDatabase(group);
    const { data, error } = await client
        .from("guest_groups")
        .insert({ ...groupPayload, wedding_id: weddingId })
        .select("*")
        .maybeSingle();

    if (error) {
        throw createGuestSupabaseError(error, "Não foi possível criar o grupo de convidados.", "GUEST_GROUP_CREATE_FAILED");
    }
    if (!data) {
        throw createSupabaseAppError("O grupo não foi criado. Verifique seu acesso ao casamento.", "GUEST_GROUP_CREATE_NOT_ALLOWED");
    }
    return mapGuestGroupRowToLocal(data);
}

async function updateCurrentWeddingGuestGroup(groupId, group) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const { data, error } = await client
        .from("guest_groups")
        .update(mapGuestGroupToDatabase(group))
        .eq("id", groupId)
        .eq("wedding_id", weddingId)
        .select("*")
        .maybeSingle();

    if (error) {
        throw createGuestSupabaseError(error, "Não foi possível atualizar o grupo.", "GUEST_GROUP_UPDATE_FAILED");
    }
    if (!data) {
        throw createSupabaseAppError("O grupo não foi atualizado. Verifique se ele ainda existe.", "GUEST_GROUP_UPDATE_NOT_ALLOWED");
    }
    return mapGuestGroupRowToLocal(data);
}

async function updateCurrentWeddingGuestGroupClosed(groupId, isClosed) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const { data, error } = await client
        .from("guest_groups")
        .update({ is_closed: isClosed === true })
        .eq("id", groupId)
        .eq("wedding_id", weddingId)
        .select("*")
        .maybeSingle();

    if (error) throw createGuestSupabaseError(error, "Não foi possível atualizar o estado do grupo.", "GUEST_GROUP_CLOSED_FAILED");
    if (!data) throw createSupabaseAppError("O estado do grupo não foi atualizado.", "GUEST_GROUP_CLOSED_NOT_ALLOWED");
    return mapGuestGroupRowToLocal(data);
}

async function updateCurrentWeddingGuestGroupNotes(groupId, notes) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const { data, error } = await client
        .from("guest_groups")
        .update({ notes: String(notes ?? "").trim() || null })
        .eq("id", groupId)
        .eq("wedding_id", weddingId)
        .select("*")
        .maybeSingle();

    if (error) throw createGuestSupabaseError(error, "Não foi possível salvar a observação do grupo.", "GUEST_GROUP_NOTES_FAILED");
    if (!data) throw createSupabaseAppError("A observação do grupo não foi salva.", "GUEST_GROUP_NOTES_NOT_ALLOWED");
    return mapGuestGroupRowToLocal(data);
}

async function deleteCurrentWeddingGuestGroup(groupId) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    const { data, error } = await client
        .from("guest_groups")
        .delete()
        .eq("id", groupId)
        .eq("wedding_id", weddingId)
        .select("id")
        .maybeSingle();

    if (error) throw createGuestSupabaseError(error, "Não foi possível excluir o grupo.", "GUEST_GROUP_DELETE_FAILED");
    if (!data) throw createSupabaseAppError("O grupo não foi excluído. Verifique se ele ainda existe.", "GUEST_GROUP_DELETE_NOT_ALLOWED");
    return { id: String(data.id) };
}

async function createGuestMembers(groupId, members) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    await requireCurrentWeddingGuestGroup(client, weddingId, groupId);
    const rows = (Array.isArray(members) ? members : []).map(member => ({
        ...mapGuestMemberToDatabase(member),
        guest_group_id: groupId
    }));
    if (!rows.length) return [];

    const { data, error } = await client.from("guest_members").insert(rows).select("*");
    if (error) throw createGuestSupabaseError(error, "Não foi possível adicionar os integrantes.", "GUEST_MEMBER_CREATE_FAILED");
    return Array.isArray(data) ? data.map(mapGuestMemberRow) : [];
}

async function updateGuestMember(groupId, memberId, member) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    await requireCurrentWeddingGuestGroup(client, weddingId, groupId);
    const { data, error } = await client
        .from("guest_members")
        .update(mapGuestMemberToDatabase(member))
        .eq("id", memberId)
        .eq("guest_group_id", groupId)
        .select("*")
        .maybeSingle();

    if (error) throw createGuestSupabaseError(error, "Não foi possível atualizar o integrante.", "GUEST_MEMBER_UPDATE_FAILED");
    if (!data) throw createSupabaseAppError("O integrante não foi atualizado.", "GUEST_MEMBER_UPDATE_NOT_ALLOWED");
    return mapGuestMemberRow(data);
}

async function deleteGuestMember(groupId, memberId) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    await requireCurrentWeddingGuestGroup(client, weddingId, groupId);
    const { data, error } = await client
        .from("guest_members")
        .delete()
        .eq("id", memberId)
        .eq("guest_group_id", groupId)
        .select("id")
        .maybeSingle();

    if (error) throw createGuestSupabaseError(error, "Não foi possível excluir o integrante.", "GUEST_MEMBER_DELETE_FAILED");
    if (!data) throw createSupabaseAppError("O integrante não foi excluído.", "GUEST_MEMBER_DELETE_NOT_ALLOWED");
    return { id: String(data.id) };
}

async function replaceOrSyncGuestGroupMembers(groupId, desiredMembers, currentMembers = null) {
    const client = await getSupabaseClient();
    const { weddingId } = await resolveCurrentWeddingContext();
    await requireCurrentWeddingGuestGroup(client, weddingId, groupId);
    const existing = Array.isArray(currentMembers)
        ? currentMembers
        : await listGuestMembersWithClient(client, [groupId]);
    const existingById = new Map(existing.map(member => [member.id, member]));
    const desired = Array.isArray(desiredMembers) ? desiredMembers : [];
    const retainedIds = new Set();
    const newMembers = [];

    for (const member of desired) {
        const memberId = String(member?.id ?? "");
        if (!memberId || !existingById.has(memberId)) {
            newMembers.push(member);
            continue;
        }
        retainedIds.add(memberId);
        if (!guestMemberPayloadChanged(existingById.get(memberId), member)) continue;
        const { data, error } = await client
            .from("guest_members")
            .update(mapGuestMemberToDatabase(member))
            .eq("id", memberId)
            .eq("guest_group_id", groupId)
            .select("id")
            .maybeSingle();
        if (error) throw createGuestSupabaseError(error, "Não foi possível sincronizar os integrantes.", "GUEST_MEMBER_SYNC_UPDATE_FAILED");
        if (!data) {
            retainedIds.delete(memberId);
            newMembers.push({ ...member, id: null });
        }
    }

    if (newMembers.length) {
        const rows = newMembers.map(member => ({ ...mapGuestMemberToDatabase(member), guest_group_id: groupId }));
        const { error } = await client.from("guest_members").insert(rows);
        if (error) throw createGuestSupabaseError(error, "Não foi possível sincronizar os novos integrantes.", "GUEST_MEMBER_SYNC_INSERT_FAILED");
    }

    const removedIds = existing.filter(member => !retainedIds.has(member.id)).map(member => member.id);
    if (removedIds.length) {
        const { error } = await client
            .from("guest_members")
            .delete()
            .eq("guest_group_id", groupId)
            .in("id", removedIds);
        if (error) throw createGuestSupabaseError(error, "Não foi possível remover os integrantes excluídos.", "GUEST_MEMBER_SYNC_DELETE_FAILED");
    }

    return listGuestMembersWithClient(client, [groupId]);
}

Object.assign(globalThis, {
    listCurrentWeddingVenues,
    createCurrentWeddingVenue,
    updateCurrentWeddingVenue,
    updateCurrentWeddingVenueFavorite,
    deleteCurrentWeddingVenue,
    mapGuestGroupRowToLocal,
    mapGuestGroupToDatabase,
    mapGuestMemberRow,
    mapGuestMemberToDatabase,
    listCurrentWeddingGuestGroups,
    createCurrentWeddingGuestGroup,
    updateCurrentWeddingGuestGroup,
    updateCurrentWeddingGuestGroupClosed,
    updateCurrentWeddingGuestGroupNotes,
    deleteCurrentWeddingGuestGroup,
    createGuestMembers,
    updateGuestMember,
    deleteGuestMember,
    replaceOrSyncGuestGroupMembers,
    signOutCurrentUser
});

async function signOutCurrentUser() {
    const client = await getSupabaseClient();
    const { error } = await client.auth.signOut({ scope: "local" });

    if (error) {
        throw createSupabaseAppError(
            "Não foi possível sair da conta. Tente novamente.",
            "SIGN_OUT_FAILED",
            error
        );
    }
}

async function signInCouple({ email, password }) {
    const client = await getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        throw new Error("Não foi possível entrar. Confira o e-mail e a senha.");
    }

    return data;
}

async function createCoupleAccount({
    primaryName,
    partnerName,
    primaryEmail,
    partnerEmail,
    password
}) {
    const client = await getSupabaseClient();
    const { data, error } = await client.auth.signUp({
        email: primaryEmail,
        password,
        options: {
            data: {
                primary_name: primaryName,
                partner_name: partnerName,
                partner_email: partnerEmail,
                account_type: "couple"
            },
            emailRedirectTo: new URL(
                "../login/index.html",
                window.location.href
            ).href
        }
    });

    if (error) {
        throw new Error(error.message);
    }

    /*
     * A criação do casamento, o vínculo do usuário principal e o envio
     * seguro do convite ao segundo e-mail devem ser feitos no banco por
     * trigger/RPC ou Edge Function. Uma secret key nunca deve ser usada
     * diretamente no navegador para convidar o companheiro.
     */
    return {
        data,
        message: "Cadastro iniciado. Confirme o e-mail principal para continuar. O convite do companheiro será ativado junto com a estrutura do banco."
    };
}

async function requestPasswordReset(email) {
    const client = await getSupabaseClient();
    const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("../login/index.html", window.location.href).href
    });

    if (error) {
        throw new Error("Não foi possível enviar a recuperação de senha.");
    }
}
