# GARBINBET

Plataforma de apostas para campeonato interno de Jiu-Jitsu — exclusivo para faixas brancas.

MVP para ~20-30 usuarios de uma academia, com sistema pari-mutuel de apostas, gerenciamento de eventos/lutas e carteira digital.

## Stack

- **Next.js 15** (App Router, TypeScript)
- **Supabase** (Auth, Database, Realtime, Storage)
- **Tailwind CSS** + **shadcn/ui** (tema dark customizado)
- **Sonner** (toast notifications)
- **Lucide React** (icones)
- **Zod** (validacao)
- Deploy target: **Vercel**

## Como rodar local

### Pre-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- npm

### 1. Clone e instale

```bash
git clone <repo-url>
cd garbinbet
npm install
```

### 2. Configure o Supabase

1. Crie um projeto no [Supabase Dashboard](https://app.supabase.com)
2. Va em **Settings > API** e copie:
   - Project URL
   - anon public key
3. Crie o arquivo `.env.local`:

```bash
cp .env.local.example .env.local
```

4. Preencha com suas credenciais:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Execute as migrations

No **SQL Editor** do Supabase Dashboard, execute os seguintes arquivos na ordem:

1. `supabase/migrations/001_initial_schema.sql` — Tabelas, RLS, funcoes
2. `supabase/seed.sql` — Dados de exemplo (12 lutadores, 1 evento, 6 lutas)

### 4. Configure o Storage (opcional, para fotos)

1. No Supabase Dashboard, va em **Storage**
2. Crie um bucket chamado `fighters`
3. Marque como **Public**
4. Adicione policy de upload para usuarios autenticados

### 5. Configure Realtime

1. No Supabase Dashboard, va em **Database > Replication**
2. Habilite Realtime para a tabela `market_options`

### 6. Rode o projeto

```bash
npm run dev
```

Acesse `http://localhost:3000`

## Deploy no Vercel

1. Faca push do codigo para o GitHub
2. No [Vercel](https://vercel.com), importe o repositorio
3. Adicione as variaveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

## Como criar o Admin

1. Acesse o app e crie uma conta com email `admin@garbinbet.com`
2. No SQL Editor do Supabase, execute:

```sql
UPDATE profiles SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@garbinbet.com');
```

3. Recarregue o app — o botao "Admin" aparecera no header

## Fluxo operacional no dia do evento

### Antes do evento

1. **Admin > Eventos**: Crie o evento com nome e data
2. **Admin > Lutadores**: Cadastre todos os lutadores (nome, apelido, peso, foto)
3. **Admin > Lutas**: Crie as lutas vinculadas ao evento (3 mercados sao criados automaticamente)
4. **Admin > Eventos**: Mude o status do evento para "Ao Vivo"
5. **Admin > Usuarios**: Deposite saldo para os usuarios que enviaram PIX

### Durante o evento

6. **Admin > Lutas**: Clique **"Abrir Apostas"** na luta que vai comecar
7. Usuarios fazem suas apostas pelo app
8. Quando a luta comecar, clique **"Travar Apostas"** para fechar o mercado

### Apos cada luta

9. **Admin > Apurar Resultados**: Selecione os vencedores de cada mercado
10. Clique **"Liquidar Luta"** — pagamentos sao feitos automaticamente
11. Se houver problema, use **"Cancelar Luta"** para reembolsar todos

### Apos o evento

12. **Admin > Eventos**: Mude o status para "Finalizado"
13. **Admin > Usuarios**: Processe os saques solicitados

## Sistema de apostas (Pari-mutuel)

- **Odds dinamicas**: calculadas em tempo real baseadas no pool de apostas
- **Formula**: `odds = pool_total / option_pool`
- **Comissao**: 10% retido em cada mercado
- **Retorno**: `valor_apostado x odds x 0.90`
- **Minimo**: R$ 1,00 | **Maximo**: R$ 200,00
- Apenas 1 aposta por usuario por mercado
- Pode apostar em mercados diferentes da mesma luta

## Estrutura do projeto

```
src/
  app/
    (auth)/login/       # Login/registro
    (main)/             # Area do apostador (mobile-first 480px)
      fights/           # Home com cards de lutas
      fights/[id]/      # Detalhe da luta + mercados
      my-bets/          # Minhas apostas (ativas/encerradas)
      wallet/           # Carteira + deposito/saque
      profile/          # Perfil do usuario
    admin/              # Painel administrativo
      events/           # CRUD de eventos
      fighters/         # CRUD de lutadores + upload foto
      fights/           # Gerenciar lutas + abrir/travar apostas
      settle/           # Apurar resultados
      users/            # Gerenciar usuarios + depositos/saques
  components/
    ui/                 # shadcn components
    bet-slip.tsx        # Drawer de apostas
    bottom-nav.tsx      # Nav inferior mobile
    logo.tsx            # Componente da logo
    skeletons.tsx       # Loading skeletons
  types/
    database.ts         # Tipos TypeScript do schema
  lib/
    supabase/           # Clients (browser, server, middleware)
```

## Nao incluido nesta versao

- PIX automatico (tudo manual via admin)
- Push notifications
- Chat/comentarios
- Gamificacao/rankings
- Multiplos eventos simultaneos
