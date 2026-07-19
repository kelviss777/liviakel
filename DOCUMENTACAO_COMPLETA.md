# Documentação completa — Rumo ao Sim / LiviaKel

## 1. Resumo executivo

O projeto é um sistema de organização de casamento dividido em duas partes:

- **Front-end estático:** HTML, CSS e JavaScript puro, publicado pelo GitHub Pages.
- **Back-end:** API REST NestJS em `backend/`, preparada para autenticação e dados do Supabase.

No estado atual, o front-end ainda armazena convidados, locais, tarefas, despesas e configurações no `localStorage`. A tela de login utiliza o Supabase Auth diretamente, mas as páginas internas ainda não consomem a API NestJS.

### Diagnóstico do erro 404

O merge não removeu o sistema. Os arquivos estão publicados e a tela de login funciona nesta URL:

```text
https://kelviss777.github.io/liviakel/pages/login/
```

Entretanto, a URL principal retorna 404:

```text
https://kelviss777.github.io/liviakel/
```

A causa é objetiva: **não existe um `index.html` na raiz da fonte publicada**.

O conteúdo da raiz atualmente é:

```text
assets/
backend/
components/
images/
js/
pages/
```

O GitHub Pages procura `index.html`, `index.md` ou `README.md` no nível superior da fonte de publicação. Como nenhum desses arquivos existe na raiz do repositório, a URL principal retorna 404.

O ajuste aplicado foi criar um `index.html` na raiz redirecionando para:

```text
pages/login/index.html
```

O redirecionamento já foi validado localmente: a raiz e a página de login responderam HTTP 200. Para entrar em produção, o novo `index.html` ainda precisa ser commitado e publicado na branch usada pelo GitHub Pages.

## 2. Estado do Git após o merge

Repositório:

```text
https://github.com/kelviss777/liviakel.git
```

Branches encontradas no remoto:

```text
main                f8d6de1
feat/visao-geral    4a442f7
```

O commit remoto da `main` é:

```text
f8d6de1 Merge pull request #2 from kelviss777/feat/visao-geral
```

O merge incluiu a pasta `backend/`. A árvore do commit remoto também não possui `index.html` na raiz.

A branch local ativa durante este diagnóstico era:

```text
feat/visao-geral
```

A referência local chamada `main` estava desatualizada, mas `origin/main` foi consultada sem alterar os arquivos de trabalho.

## 3. Estrutura geral

```text
liviakel/
├── assets/
│   └── global.css
├── backend/
│   ├── src/
│   ├── test/
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
├── components/
│   ├── sidebar.html
│   ├── sidebar.css
│   └── sidebar.js
├── images/
├── js/
│   ├── app.js
│   └── supabase.js
└── pages/
    ├── checklist/
    ├── convidados/
    ├── locais/
    ├── login/
    ├── orcamento/
    └── visao-geral/
```

Cada página possui seu próprio `index.html`, `style.css` e `main.js`.

## 4. Rotas do front-end

| Área | Arquivo | URL publicada |
|---|---|---|
| Login | `pages/login/index.html` | `/liviakel/pages/login/` |
| Visão geral | `pages/visao-geral/index.html` | `/liviakel/pages/visao-geral/` |
| Convidados | `pages/convidados/index.html` | `/liviakel/pages/convidados/` |
| Locais | `pages/locais/index.html` | `/liviakel/pages/locais/` |
| Checklist | `pages/checklist/index.html` | `/liviakel/pages/checklist/` |
| Orçamento | `pages/orcamento/index.html` | `/liviakel/pages/orcamento/` |

Os caminhos usados nos arquivos HTML são relativos. Por exemplo:

```html
<link rel="stylesheet" href="../../assets/global.css">
<script src="../../js/app.js" defer></script>
```

Esses caminhos funcionam quando a página é aberta dentro de `pages/NOME-DA-PAGINA/`.

## 5. Componentes compartilhados

### `assets/global.css`

Contém o visual global:

- cores;
- tipografia;
- botões;
- campos;
- diálogos;
- estrutura de conteúdo;
- listas;
- mensagens vazias;
- responsividade comum.

### `components/sidebar.html`

Define a navegação lateral com os itens:

- visão geral;
- convidados;
- locais;
- checklist;
- orçamento.

### `components/sidebar.js`

Possui o mapa de navegação:

```javascript
const pageRoutes = {
    inicio: "../visao-geral/index.html",
    convidados: "../convidados/index.html",
    locais: "../locais/index.html",
    tarefas: "../checklist/index.html",
    orcamento: "../orcamento/index.html"
};
```

O arquivo:

1. baixa `components/sidebar.html` com `fetch`;
2. insere o HTML no elemento `#sidebar-container`;
3. identifica a página atual por `document.body.dataset.page`;
4. marca o item ativo;
5. registra os cliques de navegação.

Por usar `fetch`, o projeto deve ser aberto por um servidor HTTP. Abrir o HTML diretamente com `file://` pode impedir o carregamento da sidebar.

## 6. Estado e persistência do front-end

O arquivo `js/app.js` gerencia o estado compartilhado das páginas internas.

Chave do navegador:

```text
nosso-casamento-v1
```

Formato:

```json
{
  "settings": {
    "partnerOne": "",
    "partnerTwo": "",
    "weddingDate": ""
  },
  "guests": [],
  "venues": [],
  "tasks": [],
  "expenses": []
}
```

Funções principais:

| Função | Responsabilidade |
|---|---|
| `loadState()` | Lê o JSON do `localStorage` e aplica valores padrão. |
| `saveState()` | Persiste o estado atual. |
| `makeId()` | Gera o identificador local de um registro. |
| `escapeHtml()` | Escapa valores antes de inseri-los no HTML. |
| `formatCurrency()` | Formata valores em real brasileiro. |
| `parseLocalDate()` | Converte `AAAA-MM-DD` em data local. |
| `formatDate()` | Formata a data para português brasileiro. |
| `showToast()` | Exibe uma mensagem temporária. |
| `emptyState()` | Gera o conteúdo para listas vazias. |

O mesmo arquivo injeta o diálogo “Editar casamento” em todas as páginas internas.

### Consequência importante

Os dados funcionais ainda ficam somente no navegador usado. Eles não são sincronizados entre o casal, apesar de o back-end já estar preparado para isso.

## 7. Tela de login e Supabase Auth

### `pages/login/index.html`

Contém duas abas:

- entrar;
- criar conta.

O cadastro solicita:

- nome principal;
- nome do companheiro ou companheira;
- e-mail principal;
- e-mail do companheiro ou companheira;
- senha.

### `pages/login/main.js`

Responsabilidades:

- alternar login e cadastro;
- mostrar ou esconder senha;
- validar que os dois e-mails são diferentes;
- enviar login;
- iniciar cadastro;
- solicitar recuperação de senha;
- redirecionar para `pages/visao-geral/index.html` após login.

### `js/supabase.js`

Carrega `@supabase/supabase-js` pelo CDN e cria o cliente público.

Operações:

| Função | Supabase |
|---|---|
| `signInCouple()` | `auth.signInWithPassword()` |
| `createCoupleAccount()` | `auth.signUp()` |
| `requestPasswordReset()` | `auth.resetPasswordForEmail()` |

A chave presente no navegador é uma chave publicável. A secret key e a antiga service role não devem ser inseridas nesse arquivo.

### Limitação atual do cadastro do casal

O cadastro cria somente o usuário principal no Supabase Auth. O vínculo completo com:

- `weddings`;
- `wedding_members`;
- `wedding_invitations`;
- segundo e-mail;

depende da integração do front-end com o back-end e da confirmação do schema remoto.

## 8. Páginas funcionais

### Visão geral

Arquivos:

```text
pages/visao-geral/
```

Exibe:

- nomes do casal;
- data;
- contagem regressiva;
- total de convidados;
- confirmados;
- progresso de tarefas;
- orçamento;
- próximas quatro tarefas pendentes.

Os cálculos são feitos localmente a partir do objeto `state`.

### Convidados

Permite:

- cadastrar;
- pesquisar por nome;
- filtrar por status;
- alternar entre `pending`, `confirmed` e `declined`;
- excluir.

Grupos:

- Família;
- Amigos;
- Trabalho;
- Outros.

### Locais

Permite:

- cadastrar nome, tipo e endereço;
- favoritar;
- ordenar favoritos antes dos demais;
- excluir;
- abrir o endereço no Google Maps.

O link é gerado com:

```text
https://www.google.com/maps/search/?api=1&query=ENDEREÇO
```

### Checklist

Permite:

- cadastrar tarefa;
- escolher categoria e prazo;
- filtrar todas, pendentes ou concluídas;
- concluir ou reabrir;
- excluir.

### Orçamento

Permite:

- cadastrar gasto;
- escolher categoria;
- informar valor;
- marcar como pago ou pendente;
- excluir;
- calcular previsto, pago e restante.

## 9. Back-end NestJS

O back-end está em:

```text
backend/
```

Ele não é executado pelo GitHub Pages. O GitHub Pages hospeda somente arquivos estáticos; a API precisa ser implantada em um serviço compatível com Node.js ou container Docker.

### Inicialização

Arquivo:

```text
backend/src/main.ts
```

Configura:

- prefixo `/api/v1`;
- CORS por variável de ambiente;
- `ValidationPipe`;
- rejeição de campos inesperados;
- transformação de DTOs;
- Helmet;
- filtro global de exceções;
- interceptor de logs;
- Swagger em `/docs`;
- porta por variável de ambiente.

### Módulo principal

`backend/src/app.module.ts` registra:

- configurações;
- rate limit;
- Supabase;
- logging;
- health;
- auth;
- members;
- weddings;
- guests;
- venues;
- tasks;
- expenses;
- dashboard;
- invitations.

## 10. Arquitetura interna do back-end

O fluxo padrão é:

```text
requisição
  → AuthGuard
  → Controller
  → Service
  → WeddingContextService
  → Repository
  → Supabase com Bearer Token
```

### Controller

- recebe HTTP;
- aplica DTOs;
- valida UUIDs;
- chama o service;
- não consulta o banco diretamente.

### Service

- contém regras de negócio;
- obtém o casamento atual;
- verifica owner quando necessário;
- chama o repository.

### Repository

- executa SELECT, INSERT, UPDATE e DELETE;
- adiciona ou filtra `wedding_id`;
- utiliza o cliente Supabase autenticado.

### DTO

- valida os dados com `class-validator`;
- transforma valores com `class-transformer`;
- documenta os campos no Swagger.

## 11. Autenticação e contexto do casamento

### `SupabaseAuthGuard`

1. lê `Authorization`;
2. exige `Bearer TOKEN`;
3. valida o token com `supabase.auth.getUser(token)`;
4. adiciona usuário e token validados à requisição;
5. retorna 401 para token ausente, inválido ou expirado.

### `WeddingContextService`

1. recebe o `user_id` autenticado;
2. consulta `wedding_members`;
3. encontra o único `wedding_id`;
4. guarda o contexto na requisição;
5. impede que o navegador escolha livremente outro casamento.

Se o usuário não tiver vínculo, a API retorna uma mensagem informando que ele ainda não está associado a um casamento.

## 12. Clientes Supabase do back-end

| Cliente | Arquivo | Uso |
|---|---|---|
| Público | `supabase.service.ts` | Validação de autenticação. |
| Usuário | `supabase-user-client.factory.ts` | Consultas usando Bearer Token e RLS. |
| Administrativo | `supabase-admin.service.ts` | Convites, somente com secret key no servidor. |

## 13. Endpoints da API

Base:

```text
http://localhost:3000/api/v1
```

### Público

| Método | Rota |
|---|---|
| GET | `/health` |

### Privados

| Método | Rota | Função |
|---|---|---|
| GET | `/auth/me` | Usuário autenticado. |
| GET | `/weddings/current` | Casamento atual. |
| PATCH | `/weddings/current` | Atualiza nomes e data. |
| GET | `/guests` | Lista convidados. |
| POST | `/guests` | Cria convidado. |
| PATCH | `/guests/:id` | Atualiza convidado. |
| PATCH | `/guests/:id/status` | Atualiza confirmação. |
| DELETE | `/guests/:id` | Exclui convidado. |
| GET | `/venues` | Lista locais. |
| POST | `/venues` | Cria local. |
| PATCH | `/venues/:id` | Atualiza local. |
| PATCH | `/venues/:id/favorite` | Altera favorito. |
| DELETE | `/venues/:id` | Exclui local. |
| GET | `/tasks` | Lista tarefas. |
| POST | `/tasks` | Cria tarefa. |
| PATCH | `/tasks/:id` | Atualiza tarefa. |
| PATCH | `/tasks/:id/status` | Conclui ou reabre. |
| DELETE | `/tasks/:id` | Exclui tarefa. |
| GET | `/expenses` | Lista despesas. |
| POST | `/expenses` | Cria despesa. |
| PATCH | `/expenses/:id` | Atualiza despesa. |
| PATCH | `/expenses/:id/payment-status` | Altera pagamento. |
| DELETE | `/expenses/:id` | Exclui despesa. |
| GET | `/dashboard` | Retorna resumo consolidado. |
| GET | `/invitations` | Lista convites. |
| POST | `/invitations` | Cria convite como owner. |
| DELETE | `/invitations/:id` | Exclui convite como owner. |

## 14. Variáveis do back-end

Arquivo de exemplo:

```text
backend/.env.example
```

Variáveis:

```env
PORT=3000
NODE_ENV=development
FRONTEND_URLS=http://127.0.0.1:5500
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

`SUPABASE_SECRET_KEY` é opcional e nunca deve ser publicada.

## 15. Como executar localmente

### Front-end

Use um servidor estático. Exemplo com a extensão Live Server do VS Code:

```text
pages/login/index.html
```

Ou sirva a raiz `liviakel/` e acesse:

```text
http://127.0.0.1:5500/pages/login/
```

### Back-end

```powershell
cd backend
Copy-Item .env.example .env
# preencher o .env
npm install
npm run start:dev
```

Endereços:

```text
API:      http://localhost:3000/api/v1
Health:   http://localhost:3000/api/v1/health
Swagger:  http://localhost:3000/docs
```

## 16. Testes e qualidade

```powershell
npm run build
npm run lint
npm run test
npm run test:e2e
```

Coberturas existentes:

- inicialização da aplicação;
- endpoint de health;
- AuthGuard sem token;
- AuthGuard com header incorreto;
- DTO de despesa válido;
- rejeição de valor negativo;
- garantia de que o service usa o `wedding_id` resolvido no servidor.

## 17. Banco esperado

Tabelas:

```text
weddings
wedding_members
wedding_invitations
guests
venues
tasks
expenses
```

Relacionamento:

```text
weddings
├── wedding_members
├── wedding_invitations
├── guests
├── venues
├── tasks
└── expenses
```

O schema de `wedding_invitations` precisa ser confirmado antes de habilitar convites em produção.

## 18. O que está integrado e o que ainda não está

### Já funciona

- páginas estáticas;
- navegação;
- formulários locais;
- persistência em `localStorage`;
- login, cadastro principal e recuperação por Supabase Auth;
- API NestJS local;
- proteção Bearer;
- Swagger;
- testes;
- health check.

### Ainda falta integrar

- criar o casamento no cadastro;
- vincular o usuário principal em `wedding_members`;
- convidar e vincular o segundo e-mail;
- trocar o `localStorage` por chamadas à API;
- configurar a URL pública do back-end;
- implantar o back-end;
- configurar `FRONTEND_URLS` para produção;
- confirmar RLS e schema de convites;
- adicionar a entrada do site na raiz para eliminar o 404.

## 19. GitHub Pages e o back-end

O GitHub Pages pode publicar:

- HTML;
- CSS;
- JavaScript;
- imagens e outros arquivos estáticos.

Ele não inicia:

- NestJS;
- Node.js;
- Docker;
- processos de servidor.

Portanto:

```text
GitHub Pages → front-end
Outro serviço Node/Docker → back-end
Supabase → autenticação e banco
```

A presença da pasta `backend/` no repositório não faz a API entrar em execução no GitHub Pages.

## 20. Correção aplicada para o 404

Já foi criado `index.html` na raiz do repositório, com redirecionamento para `pages/login/index.html`.

Passos restantes:

1. Commitar a correção na branch de desenvolvimento.
2. Abrir e revisar o pull request.
3. Fazer merge na branch usada pelo GitHub Pages.
4. Conferir em **Settings → Pages** se a fonte é a raiz de `main`.
5. Aguardar a publicação.
6. Testar:

```text
https://kelviss777.github.io/liviakel/
```

O GitHub informa que o arquivo de entrada precisa estar no nível superior da fonte publicada:

```text
https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
```

## 21. Checklist de diagnóstico

| Verificação | Resultado |
|---|---|
| Merge existe em `origin/main` | Sim |
| Front-end existe após o merge | Sim |
| Login está publicado | Sim, HTTP 200 |
| URL raiz funciona | Não, HTTP 404 |
| `index.html` existe na raiz | Sim, criado e validado localmente |
| Workflow personalizado de Pages existe | Não encontrado |
| `docs/` configurado no repositório | Não existe |
| Back-end pode rodar no GitHub Pages | Não |
| Front-end já consome o back-end | Não |

## 22. Conclusão

O sistema não desapareceu no merge. O erro 404 acontece somente na raiz porque não existe um arquivo de entrada no nível publicado pelo GitHub Pages.

A aplicação está acessível diretamente pelas URLs dentro de `pages/`, especialmente:

```text
https://kelviss777.github.io/liviakel/pages/login/
```

Depois de publicar o novo `index.html` na fonte correta, a URL principal abrirá e redirecionará para a tela de login.
