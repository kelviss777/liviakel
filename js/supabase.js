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

function createSupabaseAppError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
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
