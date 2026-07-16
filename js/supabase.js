/*
 * Preencha estas duas informações depois de criar o projeto no Supabase.
 * A chave publicável pode ficar no navegador. Nunca coloque a secret key
 * ou a antiga service_role neste arquivo.
 */
const SUPABASE_URL = "";
const SUPABASE_PUBLISHABLE_KEY = "";

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
