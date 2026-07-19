# Rumo ao Sim — Backend

API REST NestJS para o sistema de organização compartilhada de casamentos. O back-end valida o token do Supabase Auth, descobre o casamento do usuário em `wedding_members` e consulta o Supabase com a identidade autenticada, mantendo o RLS ativo.

## Requisitos e instalação

- Node.js 20 ou superior
- npm
- Projeto Supabase com as tabelas e políticas RLS configuradas

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run start:dev
```

Configure no `.env`:

```env
PORT=3000
NODE_ENV=development
FRONTEND_URLS=http://127.0.0.1:5500,https://kelviss777.github.io
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

`SUPABASE_SECRET_KEY` é opcional e exclusiva do servidor. Nunca publique `.env`, secret key, service role, tokens ou senhas.

## Endereços

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- Health: `http://localhost:3000/api/v1/health`

O front-end deve enviar:

```http
Authorization: Bearer ACCESS_TOKEN
```

## Endpoints

- `GET /api/v1/health`
- `GET /api/v1/auth/me`
- `GET|PATCH /api/v1/weddings/current`
- `GET|POST|PATCH|DELETE /api/v1/guests`
- `PATCH /api/v1/guests/:id/status`
- `GET|POST|PATCH|DELETE /api/v1/venues`
- `PATCH /api/v1/venues/:id/favorite`
- `GET|POST|PATCH|DELETE /api/v1/tasks`
- `PATCH /api/v1/tasks/:id/status`
- `GET|POST|PATCH|DELETE /api/v1/expenses`
- `PATCH /api/v1/expenses/:id/payment-status`
- `GET /api/v1/dashboard`
- `GET|POST|DELETE /api/v1/invitations`

As rotas privadas não aceitam `wedding_id`; ele é obtido no servidor.

## Qualidade

```powershell
npm run build
npm run lint
npm run test
npm run test:e2e
```

Os testes usam mocks e ambiente fictício. Não acessam nem alteram o banco remoto.

## Docker

```powershell
docker build -t rumo-ao-sim-api .
docker run --env-file .env -p 3000:3000 rumo-ao-sim-api
```

## Suposições do schema

- `weddings`: `id`, `partner_one`, `partner_two`, `wedding_date`
- `wedding_members`: `wedding_id`, `user_id`, `role`
- `guests`: `id`, `wedding_id`, `name`, `guest_group`, `status`
- `venues`: `id`, `wedding_id`, `name`, `type`, `address`, `favorite`
- `tasks`: `id`, `wedding_id`, `name`, `category`, `due_date`, `done`
- `expenses`: `id`, `wedding_id`, `name`, `category`, `value`, `paid`
- `wedding_invitations`: `id`, `wedding_id`, `email`, `status`, `invited_by`, `created_at`

Confirme especialmente `wedding_invitations` antes de habilitar os convites em produção. Nenhuma migration, alteração de RLS ou comando destrutivo é executado por este projeto.
