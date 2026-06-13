-- ============================================
-- GARBINBET — Copa Edition
-- Plataforma de apostas no placar dos jogos do Brasil na Copa
-- Schema consolidado (motor pari-mutuel domínio-neutro reaproveitado do MVP de JJ)
-- ============================================

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  pix_key text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'withdraw', 'bet_placed', 'bet_won', 'bet_refund')),
  amount numeric(12,2) NOT NULL,
  balance_after numeric(12,2) NOT NULL,
  reference_id uuid,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- "fighters" reaproveitada como SELEÇÕES (Brasil, Croácia, ...).
-- name = país; nickname = apelido opcional ("Canarinho"); photo_url = bandeira/escudo.
CREATE TABLE fighters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nickname text,
  photo_url text,
  fifa_code text,                       -- código FIFA de 3 letras (BRA, CRO, ...) p/ bandeira
  created_at timestamptz NOT NULL DEFAULT now()
);

-- "events" = a Copa / a fase (ex: "Copa do Mundo 2026 — Fase de Grupos").
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'finished')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- "fights" reaproveitada como JOGOS (Brasil x Adversário).
-- fighter_a = mandante (em geral o Brasil); fighter_b = adversário.
-- winner_id NULL após finished => empate. home_score/away_score = placar final.
CREATE TABLE fights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events ON DELETE CASCADE,
  fighter_a_id uuid NOT NULL REFERENCES fighters ON DELETE CASCADE,
  fighter_b_id uuid NOT NULL REFERENCES fighters ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'open', 'locked', 'finished', 'cancelled')),
  winner_id uuid REFERENCES fighters,
  home_score integer CHECK (home_score >= 0),
  away_score integer CHECK (away_score >= 0),
  kickoff_at timestamptz,
  fight_order integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Mercados de aposta de um jogo.
--   result      = Resultado (1X2): Brasil vence / Empate / Adversário vence
--   exact_score = Placar exato: "Brasil 2x0", "1x1", ...
--   special     = mercado custom com label livre (ex: "Total de gols")
CREATE TABLE markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fight_id uuid NOT NULL REFERENCES fights ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('result', 'exact_score', 'special')),
  label text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'settled', 'voided')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid NOT NULL REFERENCES markets ON DELETE CASCADE,
  label text NOT NULL,
  total_pool numeric(12,2) NOT NULL DEFAULT 0,
  is_winner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bets (
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

CREATE TABLE withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 1),
  pix_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_market ON bets(market_id);
CREATE INDEX idx_fights_event ON fights(event_id);
CREATE INDEX idx_markets_fight ON markets(fight_id);
CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);
CREATE INDEX idx_withdrawal_requests_user ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);

-- ============================================
-- ROW LEVEL SECURITY
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
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles (role column protected from self-promotion)
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR is_admin());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- wallets (only SECURITY DEFINER funcs + admin can mutate balances)
CREATE POLICY "Users can view own wallet"
  ON wallets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin can update wallets"
  ON wallets FOR UPDATE
  USING (is_admin());

-- transactions
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));

-- fighters / events / fights / markets / market_options (public read, admin write)
CREATE POLICY "Anyone can view fighters" ON fighters FOR SELECT USING (true);
CREATE POLICY "Admin can insert fighters" ON fighters FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update fighters" ON fighters FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete fighters" ON fighters FOR DELETE USING (is_admin());

CREATE POLICY "Anyone can view events" ON events FOR SELECT USING (true);
CREATE POLICY "Admin can insert events" ON events FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update events" ON events FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete events" ON events FOR DELETE USING (is_admin());

CREATE POLICY "Anyone can view fights" ON fights FOR SELECT USING (true);
CREATE POLICY "Admin can insert fights" ON fights FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update fights" ON fights FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete fights" ON fights FOR DELETE USING (is_admin());

CREATE POLICY "Anyone can view markets" ON markets FOR SELECT USING (true);
CREATE POLICY "Admin can insert markets" ON markets FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update markets" ON markets FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete markets" ON markets FOR DELETE USING (is_admin());

CREATE POLICY "Anyone can view market options" ON market_options FOR SELECT USING (true);
CREATE POLICY "Admin can insert market options" ON market_options FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update market options" ON market_options FOR UPDATE USING (is_admin());

-- bets
CREATE POLICY "Users can view own bets"
  ON bets FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert own bets"
  ON bets FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- withdrawal_requests
CREATE POLICY "Users can view own withdrawal requests"
  ON withdrawal_requests FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert own withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can update withdrawal requests"
  ON withdrawal_requests FOR UPDATE
  USING (is_admin());

-- ============================================
-- AUTH TRIGGER: auto-create profile + wallet
-- ============================================

-- IMPORTANTE: SET search_path = public — o trigger roda no contexto do GoTrue
-- (schema auth), sem public no search_path; sem isso falha com "relation
-- profiles does not exist". Tabelas também são schema-qualified por segurança.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Apostador'));

  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- FUNCTIONS — motor pari-mutuel (domínio-neutro)
-- ============================================

-- place_bet — valida identidade, min R$1 / max R$200, 1 aposta/mercado, debita carteira
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
  -- SECURITY: caller identity
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Nao autorizado: usuario nao corresponde';
  END IF;

  -- Idempotency
  SELECT id INTO v_existing_bet FROM bets WHERE idempotency_key = p_idempotency_key;
  IF v_existing_bet IS NOT NULL THEN
    SELECT * INTO v_bet FROM bets WHERE id = v_existing_bet;
    RETURN v_bet;
  END IF;

  -- Min/max
  IF p_amount < 1 THEN
    RAISE EXCEPTION 'Aposta minima e R$ 1,00';
  END IF;
  IF p_amount > 200 THEN
    RAISE EXCEPTION 'Aposta maxima e R$ 200,00';
  END IF;

  -- Market open
  SELECT * INTO v_market FROM markets WHERE id = p_market_id;
  IF v_market.status != 'open' THEN
    RAISE EXCEPTION 'Mercado nao esta aberto para apostas';
  END IF;

  -- One bet per user per market
  IF EXISTS (SELECT 1 FROM bets WHERE user_id = p_user_id AND market_id = p_market_id) THEN
    RAISE EXCEPTION 'Voce ja apostou neste mercado';
  END IF;

  -- Lock wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Carteira nao encontrada';
  END IF;

  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  -- Option
  SELECT * INTO v_option FROM market_options WHERE id = p_option_id AND market_id = p_market_id;
  IF v_option IS NULL THEN
    RAISE EXCEPTION 'Opcao invalida';
  END IF;

  -- Pari-mutuel odds
  SELECT COALESCE(SUM(total_pool), 0) INTO v_pool_total FROM market_options WHERE market_id = p_market_id;
  v_option_pool := v_option.total_pool;
  v_pool_total := v_pool_total + p_amount;
  v_option_pool := v_option_pool + p_amount;

  IF v_option_pool > 0 THEN
    v_odds := v_pool_total / v_option_pool;
  ELSE
    v_odds := 2.0;
  END IF;

  -- 10% commission
  v_potential_payout := ROUND(p_amount * v_odds * 0.90, 2);

  UPDATE wallets
    SET balance = balance - p_amount, updated_at = now()
    WHERE id = v_wallet.id;

  INSERT INTO bets (user_id, market_id, option_id, amount, potential_payout, idempotency_key)
  VALUES (p_user_id, p_market_id, p_option_id, p_amount, v_potential_payout, p_idempotency_key)
  RETURNING * INTO v_bet;

  UPDATE market_options
    SET total_pool = total_pool + p_amount
    WHERE id = p_option_id;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (
    v_wallet.id, 'bet_placed', -p_amount, v_wallet.balance - p_amount, v_bet.id,
    'Aposta: ' || v_option.label
  );

  RETURN v_bet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- settle_market — paga vencedores (rateio pari-mutuel com 10% de comissão)
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

  SELECT COALESCE(SUM(total_pool), 0) INTO v_pool_total
    FROM market_options WHERE market_id = p_market_id;

  SELECT total_pool INTO v_winning_pool
    FROM market_options WHERE id = p_winning_option_id;

  v_pool_to_distribute := v_pool_total * 0.90;

  FOR v_bet IN
    SELECT b.*, w.id AS wallet_id
    FROM bets b
    JOIN wallets w ON w.user_id = b.user_id
    WHERE b.market_id = p_market_id AND b.option_id = p_winning_option_id AND b.status = 'pending'
  LOOP
    IF v_winning_pool > 0 THEN
      v_payout := ROUND((v_bet.amount / v_winning_pool) * v_pool_to_distribute, 2);
    ELSE
      v_payout := 0;
    END IF;

    UPDATE bets SET status = 'won', settled_amount = v_payout WHERE id = v_bet.id;

    UPDATE wallets SET balance = balance + v_payout, updated_at = now()
      WHERE id = v_bet.wallet_id;

    INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
    VALUES (
      v_bet.wallet_id, 'bet_won', v_payout,
      (SELECT balance FROM wallets WHERE id = v_bet.wallet_id),
      v_bet.id, 'Ganhou aposta'
    );
  END LOOP;

  UPDATE bets SET status = 'lost'
    WHERE market_id = p_market_id AND option_id != p_winning_option_id AND status = 'pending';

  UPDATE markets SET status = 'settled' WHERE id = p_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- void_market — reembolsa todos (jogo cancelado / mercado anulado)
CREATE OR REPLACE FUNCTION void_market(p_market_id uuid)
RETURNS void AS $$
DECLARE
  v_bet RECORD;
BEGIN
  FOR v_bet IN
    SELECT b.*, w.id AS wallet_id
    FROM bets b
    JOIN wallets w ON w.user_id = b.user_id
    WHERE b.market_id = p_market_id AND b.status = 'pending'
  LOOP
    UPDATE bets SET status = 'refunded' WHERE id = v_bet.id;

    UPDATE wallets SET balance = balance + v_bet.amount, updated_at = now()
      WHERE id = v_bet.wallet_id;

    INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
    VALUES (
      v_bet.wallet_id, 'bet_refund', v_bet.amount,
      (SELECT balance FROM wallets WHERE id = v_bet.wallet_id),
      v_bet.id, 'Aposta reembolsada'
    );
  END LOOP;

  UPDATE markets SET status = 'voided' WHERE id = p_market_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- approve_withdrawal / reject_withdrawal
CREATE OR REPLACE FUNCTION approve_withdrawal(p_request_id uuid)
RETURNS void AS $$
DECLARE
  v_request withdrawal_requests;
  v_wallet wallets;
  v_new_balance numeric;
BEGIN
  SELECT * INTO v_request FROM withdrawal_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Solicitacao nao encontrada';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Solicitacao ja foi processada';
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_request.user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Carteira nao encontrada';
  END IF;

  IF v_wallet.balance < v_request.amount THEN
    RAISE EXCEPTION 'Saldo insuficiente do usuario';
  END IF;

  v_new_balance := v_wallet.balance - v_request.amount;
  UPDATE wallets SET balance = v_new_balance, updated_at = now()
    WHERE id = v_wallet.id;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (
    v_wallet.id, 'withdraw', -v_request.amount, v_new_balance, v_request.id,
    'Saque aprovado - PIX: ' || v_request.pix_key
  );

  UPDATE withdrawal_requests
    SET status = 'approved', processed_at = now()
    WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_withdrawal(p_request_id uuid, p_note text DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_request withdrawal_requests;
BEGIN
  SELECT * INTO v_request FROM withdrawal_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Solicitacao nao encontrada';
  END IF;
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Solicitacao ja foi processada';
  END IF;

  UPDATE withdrawal_requests
    SET status = 'rejected', admin_note = p_note, processed_at = now()
    WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANTS — roles anon/authenticated precisam de GRANT a nível de tabela
-- (o acesso real continua gateado pelas policies de RLS acima).
-- No Supabase cloud isso é default; no local precisa ser explícito.
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- ============================================
-- STORAGE: bucket público p/ bandeiras/escudos das seleções
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('fighters', 'fighters', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view team photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fighters');

CREATE POLICY "Admin can upload team photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'fighters'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update team photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'fighters'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can delete team photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'fighters'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
