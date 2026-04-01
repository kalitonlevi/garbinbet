-- ============================================
-- GARBINBET - SETUP COMPLETO
-- Cole este arquivo INTEIRO no SQL Editor do Supabase e clique RUN
-- Ele cria: tabelas, indexes, RLS, functions, triggers e seed data
-- ============================================

-- ============================================
-- 1. TABELAS
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  pix_key text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'withdraw', 'bet_placed', 'bet_won', 'bet_refund')),
  amount numeric(12,2) NOT NULL,
  balance_after numeric(12,2) NOT NULL,
  reference_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fighters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nickname text,
  belt text NOT NULL DEFAULT 'branca' CHECK (belt = 'branca'),
  weight_kg numeric(5,1),
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'finished')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events ON DELETE CASCADE,
  fighter_a_id uuid NOT NULL REFERENCES fighters ON DELETE CASCADE,
  fighter_b_id uuid NOT NULL REFERENCES fighters ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'open', 'locked', 'finished', 'cancelled')),
  winner_id uuid REFERENCES fighters,
  result_method text CHECK (result_method IN ('submission', 'points', 'dq', 'draw', 'wo')),
  fight_order integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fight_id uuid NOT NULL REFERENCES fights ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('winner', 'method', 'has_submission')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'settled', 'voided')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES markets ON DELETE CASCADE,
  label text NOT NULL,
  total_pool numeric(12,2) NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES markets ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES market_options ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  potential_payout numeric(12,2),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'refunded')),
  settled_amount numeric(12,2) NOT NULL DEFAULT 0,
  idempotency_key uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_market ON bets(market_id);
CREATE INDEX IF NOT EXISTS idx_fights_event ON fights(event_id);
CREATE INDEX IF NOT EXISTS idx_markets_fight ON markets(fight_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);

-- ============================================
-- 3. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fighters ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fights ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- wallets
CREATE POLICY "Users can view own wallet" ON wallets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own wallet" ON wallets FOR UPDATE USING (user_id = auth.uid());

-- transactions
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));

-- fighters (public read, admin write)
CREATE POLICY "Anyone can view fighters" ON fighters FOR SELECT USING (true);
CREATE POLICY "Admin can insert fighters" ON fighters FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update fighters" ON fighters FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete fighters" ON fighters FOR DELETE USING (is_admin());

-- events
CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);
CREATE POLICY "Admin can insert events" ON events FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update events" ON events FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete events" ON events FOR DELETE USING (is_admin());

-- fights
CREATE POLICY "Anyone can view fights" ON fights FOR SELECT USING (true);
CREATE POLICY "Admin can insert fights" ON fights FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update fights" ON fights FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete fights" ON fights FOR DELETE USING (is_admin());

-- markets
CREATE POLICY "Anyone can view markets" ON markets FOR SELECT USING (true);
CREATE POLICY "Admin can insert markets" ON markets FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update markets" ON markets FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete markets" ON markets FOR DELETE USING (is_admin());

-- market_options
CREATE POLICY "Anyone can view market options" ON market_options FOR SELECT USING (true);
CREATE POLICY "Admin can insert market options" ON market_options FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update market options" ON market_options FOR UPDATE USING (is_admin());

-- bets
CREATE POLICY "Users can view own bets" ON bets FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Users can insert own bets" ON bets FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4. AUTH TRIGGER (auto-create profile + wallet)
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'));

  INSERT INTO wallets (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 5. FUNCTIONS (place_bet, settle_market, void_market)
-- ============================================

CREATE OR REPLACE FUNCTION place_bet(
  p_user_id uuid,
  p_market_id uuid,
  p_option_id uuid,
  p_amount numeric,
  p_idempotency_key uuid
)
RETURNS bets AS $$
DECLARE
  v_market markets;
  v_wallet wallets;
  v_option market_options;
  v_pool_total numeric;
  v_option_pool numeric;
  v_odds numeric;
  v_potential_payout numeric;
  v_bet bets;
  v_existing_bet uuid;
BEGIN
  SELECT id INTO v_existing_bet FROM bets WHERE idempotency_key = p_idempotency_key;
  IF v_existing_bet IS NOT NULL THEN
    SELECT * INTO v_bet FROM bets WHERE id = v_existing_bet;
    RETURN v_bet;
  END IF;

  SELECT * INTO v_market FROM markets WHERE id = p_market_id;
  IF v_market.status != 'open' THEN
    RAISE EXCEPTION 'Mercado nao esta aberto para apostas';
  END IF;

  IF EXISTS (SELECT 1 FROM bets WHERE user_id = p_user_id AND market_id = p_market_id) THEN
    RAISE EXCEPTION 'Voce ja apostou neste mercado';
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Carteira nao encontrada';
  END IF;

  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  SELECT * INTO v_option FROM market_options WHERE id = p_option_id AND market_id = p_market_id;
  IF v_option IS NULL THEN
    RAISE EXCEPTION 'Opcao invalida';
  END IF;

  SELECT COALESCE(SUM(total_pool), 0) INTO v_pool_total FROM market_options WHERE market_id = p_market_id;
  v_option_pool := v_option.total_pool;
  v_pool_total := v_pool_total + p_amount;
  v_option_pool := v_option_pool + p_amount;

  IF v_option_pool > 0 THEN
    v_odds := v_pool_total / v_option_pool;
  ELSE
    v_odds := 2.0;
  END IF;

  v_potential_payout := ROUND(p_amount * v_odds * 0.90, 2);

  UPDATE wallets SET balance = balance - p_amount, updated_at = now() WHERE id = v_wallet.id;

  INSERT INTO bets (user_id, market_id, option_id, amount, potential_payout, idempotency_key)
  VALUES (p_user_id, p_market_id, p_option_id, p_amount, v_potential_payout, p_idempotency_key)
  RETURNING * INTO v_bet;

  UPDATE market_options SET total_pool = total_pool + p_amount WHERE id = p_option_id;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (v_wallet.id, 'bet_placed', -p_amount, v_wallet.balance - p_amount, v_bet.id, 'Aposta: ' || v_option.label);

  RETURN v_bet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION settle_market(
  p_market_id uuid,
  p_winning_option_id uuid
)
RETURNS void AS $$
DECLARE
  v_pool_total numeric;
  v_winning_pool numeric;
  v_pool_to_distribute numeric;
  v_bet RECORD;
  v_payout numeric;
BEGIN
  UPDATE market_options SET is_winner = true WHERE id = p_winning_option_id;

  SELECT COALESCE(SUM(total_pool), 0) INTO v_pool_total FROM market_options WHERE market_id = p_market_id;
  SELECT total_pool INTO v_winning_pool FROM market_options WHERE id = p_winning_option_id;

  v_pool_to_distribute := v_pool_total * 0.90;

  FOR v_bet IN
    SELECT b.*, w.id AS wallet_id
    FROM bets b JOIN wallets w ON w.user_id = b.user_id
    WHERE b.market_id = p_market_id AND b.option_id = p_winning_option_id AND b.status = 'pending'
  LOOP
    IF v_winning_pool > 0 THEN
      v_payout := ROUND((v_bet.amount / v_winning_pool) * v_pool_to_distribute, 2);
    ELSE
      v_payout := 0;
    END IF;

    UPDATE bets SET status = 'won', settled_amount = v_payout WHERE id = v_bet.id;
    UPDATE wallets SET balance = balance + v_payout, updated_at = now() WHERE id = v_bet.wallet_id;

    INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
    VALUES (v_bet.wallet_id, 'bet_won', v_payout, (SELECT balance FROM wallets WHERE id = v_bet.wallet_id), v_bet.id, 'Ganhou aposta');
  END LOOP;

  UPDATE bets SET status = 'lost' WHERE market_id = p_market_id AND option_id != p_winning_option_id AND status = 'pending';
  UPDATE markets SET status = 'settled' WHERE id = p_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION void_market(p_market_id uuid)
RETURNS void AS $$
DECLARE
  v_bet RECORD;
BEGIN
  FOR v_bet IN
    SELECT b.*, w.id AS wallet_id
    FROM bets b JOIN wallets w ON w.user_id = b.user_id
    WHERE b.market_id = p_market_id AND b.status = 'pending'
  LOOP
    UPDATE bets SET status = 'refunded' WHERE id = v_bet.id;
    UPDATE wallets SET balance = balance + v_bet.amount, updated_at = now() WHERE id = v_bet.wallet_id;

    INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
    VALUES (v_bet.wallet_id, 'bet_refund', v_bet.amount, (SELECT balance FROM wallets WHERE id = v_bet.wallet_id), v_bet.id, 'Aposta reembolsada');
  END LOOP;

  UPDATE markets SET status = 'voided' WHERE id = p_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. SEED DATA
-- ============================================

-- Evento
INSERT INTO events (id, name, date, status) VALUES
  ('e1000000-0000-4000-a000-000000000001', 'Copa Garbin de Faixa Branca I', (CURRENT_DATE + INTERVAL '14 days')::date, 'upcoming');

-- 12 Lutadores
INSERT INTO fighters (id, name, nickname, weight_kg) VALUES
  ('f1000000-0000-4000-a000-000000000001', 'Lucas Moreira', 'Triangulo', 70.0),
  ('f1000000-0000-4000-a000-000000000002', 'Gabriel Santos', 'Berimbolo', 68.0),
  ('f1000000-0000-4000-a000-000000000003', 'Pedro Oliveira', 'Guilhotina', 75.0),
  ('f1000000-0000-4000-a000-000000000004', 'Rafael Silva', 'Kimura', 73.0),
  ('f1000000-0000-4000-a000-000000000005', 'Matheus Costa', 'Raspao', 80.0),
  ('f1000000-0000-4000-a000-000000000006', 'Bruno Almeida', 'Passador', 82.0),
  ('f1000000-0000-4000-a000-000000000007', 'Thiago Ferreira', 'Queda', 65.0),
  ('f1000000-0000-4000-a000-000000000008', 'Diego Souza', 'Montada', 67.0),
  ('f1000000-0000-4000-a000-000000000009', 'Felipe Lima', 'Guarda', 77.0),
  ('f1000000-0000-4000-a000-000000000010', 'Andre Pereira', 'Joelhada', 78.0),
  ('f1000000-0000-4000-a000-000000000011', 'Vinicius Ribeiro', 'Armlock', 72.0),
  ('f1000000-0000-4000-a000-000000000012', 'Gustavo Martins', 'Ezequiel', 69.0);

-- 6 Lutas
INSERT INTO fights (id, event_id, fighter_a_id, fighter_b_id, fight_order, status) VALUES
  ('aa100000-0000-4000-a000-000000000001', 'e1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000002', 1, 'upcoming'),
  ('aa100000-0000-4000-a000-000000000002', 'e1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000003', 'f1000000-0000-4000-a000-000000000004', 2, 'upcoming'),
  ('aa100000-0000-4000-a000-000000000003', 'e1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000005', 'f1000000-0000-4000-a000-000000000006', 3, 'upcoming'),
  ('aa100000-0000-4000-a000-000000000004', 'e1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000007', 'f1000000-0000-4000-a000-000000000008', 4, 'upcoming'),
  ('aa100000-0000-4000-a000-000000000005', 'e1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000009', 'f1000000-0000-4000-a000-000000000010', 5, 'upcoming'),
  ('aa100000-0000-4000-a000-000000000006', 'e1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000011', 'f1000000-0000-4000-a000-000000000012', 6, 'upcoming');

-- 18 Markets (3 por luta) + Options
-- Luta 1
INSERT INTO markets (id, fight_id, type) VALUES
  ('bb100000-0000-4000-a001-000000000001', 'aa100000-0000-4000-a000-000000000001', 'winner'),
  ('bb100000-0000-4000-a001-000000000002', 'aa100000-0000-4000-a000-000000000001', 'method'),
  ('bb100000-0000-4000-a001-000000000003', 'aa100000-0000-4000-a000-000000000001', 'has_submission');
INSERT INTO market_options (market_id, label) VALUES
  ('bb100000-0000-4000-a001-000000000001', 'Lucas "Triangulo" Moreira'),
  ('bb100000-0000-4000-a001-000000000001', 'Gabriel "Berimbolo" Santos'),
  ('bb100000-0000-4000-a001-000000000002', 'Finalizacao'),
  ('bb100000-0000-4000-a001-000000000002', 'Pontos/Decisao'),
  ('bb100000-0000-4000-a001-000000000002', 'DQ/Outro'),
  ('bb100000-0000-4000-a001-000000000003', 'Sim'),
  ('bb100000-0000-4000-a001-000000000003', 'Nao');

-- Luta 2
INSERT INTO markets (id, fight_id, type) VALUES
  ('bb100000-0000-4000-a002-000000000001', 'aa100000-0000-4000-a000-000000000002', 'winner'),
  ('bb100000-0000-4000-a002-000000000002', 'aa100000-0000-4000-a000-000000000002', 'method'),
  ('bb100000-0000-4000-a002-000000000003', 'aa100000-0000-4000-a000-000000000002', 'has_submission');
INSERT INTO market_options (market_id, label) VALUES
  ('bb100000-0000-4000-a002-000000000001', 'Pedro "Guilhotina" Oliveira'),
  ('bb100000-0000-4000-a002-000000000001', 'Rafael "Kimura" Silva'),
  ('bb100000-0000-4000-a002-000000000002', 'Finalizacao'),
  ('bb100000-0000-4000-a002-000000000002', 'Pontos/Decisao'),
  ('bb100000-0000-4000-a002-000000000002', 'DQ/Outro'),
  ('bb100000-0000-4000-a002-000000000003', 'Sim'),
  ('bb100000-0000-4000-a002-000000000003', 'Nao');

-- Luta 3
INSERT INTO markets (id, fight_id, type) VALUES
  ('bb100000-0000-4000-a003-000000000001', 'aa100000-0000-4000-a000-000000000003', 'winner'),
  ('bb100000-0000-4000-a003-000000000002', 'aa100000-0000-4000-a000-000000000003', 'method'),
  ('bb100000-0000-4000-a003-000000000003', 'aa100000-0000-4000-a000-000000000003', 'has_submission');
INSERT INTO market_options (market_id, label) VALUES
  ('bb100000-0000-4000-a003-000000000001', 'Matheus "Raspao" Costa'),
  ('bb100000-0000-4000-a003-000000000001', 'Bruno "Passador" Almeida'),
  ('bb100000-0000-4000-a003-000000000002', 'Finalizacao'),
  ('bb100000-0000-4000-a003-000000000002', 'Pontos/Decisao'),
  ('bb100000-0000-4000-a003-000000000002', 'DQ/Outro'),
  ('bb100000-0000-4000-a003-000000000003', 'Sim'),
  ('bb100000-0000-4000-a003-000000000003', 'Nao');

-- Luta 4
INSERT INTO markets (id, fight_id, type) VALUES
  ('bb100000-0000-4000-a004-000000000001', 'aa100000-0000-4000-a000-000000000004', 'winner'),
  ('bb100000-0000-4000-a004-000000000002', 'aa100000-0000-4000-a000-000000000004', 'method'),
  ('bb100000-0000-4000-a004-000000000003', 'aa100000-0000-4000-a000-000000000004', 'has_submission');
INSERT INTO market_options (market_id, label) VALUES
  ('bb100000-0000-4000-a004-000000000001', 'Thiago "Queda" Ferreira'),
  ('bb100000-0000-4000-a004-000000000001', 'Diego "Montada" Souza'),
  ('bb100000-0000-4000-a004-000000000002', 'Finalizacao'),
  ('bb100000-0000-4000-a004-000000000002', 'Pontos/Decisao'),
  ('bb100000-0000-4000-a004-000000000002', 'DQ/Outro'),
  ('bb100000-0000-4000-a004-000000000003', 'Sim'),
  ('bb100000-0000-4000-a004-000000000003', 'Nao');

-- Luta 5
INSERT INTO markets (id, fight_id, type) VALUES
  ('bb100000-0000-4000-a005-000000000001', 'aa100000-0000-4000-a000-000000000005', 'winner'),
  ('bb100000-0000-4000-a005-000000000002', 'aa100000-0000-4000-a000-000000000005', 'method'),
  ('bb100000-0000-4000-a005-000000000003', 'aa100000-0000-4000-a000-000000000005', 'has_submission');
INSERT INTO market_options (market_id, label) VALUES
  ('bb100000-0000-4000-a005-000000000001', 'Felipe "Guarda" Lima'),
  ('bb100000-0000-4000-a005-000000000001', 'Andre "Joelhada" Pereira'),
  ('bb100000-0000-4000-a005-000000000002', 'Finalizacao'),
  ('bb100000-0000-4000-a005-000000000002', 'Pontos/Decisao'),
  ('bb100000-0000-4000-a005-000000000002', 'DQ/Outro'),
  ('bb100000-0000-4000-a005-000000000003', 'Sim'),
  ('bb100000-0000-4000-a005-000000000003', 'Nao');

-- Luta 6
INSERT INTO markets (id, fight_id, type) VALUES
  ('bb100000-0000-4000-a006-000000000001', 'aa100000-0000-4000-a000-000000000006', 'winner'),
  ('bb100000-0000-4000-a006-000000000002', 'aa100000-0000-4000-a000-000000000006', 'method'),
  ('bb100000-0000-4000-a006-000000000003', 'aa100000-0000-4000-a000-000000000006', 'has_submission');
INSERT INTO market_options (market_id, label) VALUES
  ('bb100000-0000-4000-a006-000000000001', 'Vinicius "Armlock" Ribeiro'),
  ('bb100000-0000-4000-a006-000000000001', 'Gustavo "Ezequiel" Martins'),
  ('bb100000-0000-4000-a006-000000000002', 'Finalizacao'),
  ('bb100000-0000-4000-a006-000000000002', 'Pontos/Decisao'),
  ('bb100000-0000-4000-a006-000000000002', 'DQ/Outro'),
  ('bb100000-0000-4000-a006-000000000003', 'Sim'),
  ('bb100000-0000-4000-a006-000000000003', 'Nao');

-- ============================================
-- PRONTO! Agora:
-- 1. Crie uma conta no app com seu email
-- 2. Volte aqui e rode:
--    UPDATE profiles SET role = 'admin' WHERE id = (
--      SELECT id FROM auth.users WHERE email = 'SEU_EMAIL_AQUI'
--    );
-- ============================================
