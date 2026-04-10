-- ============================================
-- 006: Critical security fixes
-- ============================================
-- Fixes found via edge-case testing:
-- 1. Users can self-promote to admin by updating profiles.role
-- 2. Users can edit their own wallet balance
-- 3. place_bet does not validate auth.uid() vs p_user_id (spoofing)

-- ============================================
-- FIX 1: Profiles — block role column from user updates
-- Drop the overly permissive policy and replace with one
-- that only allows updating safe columns.
-- ============================================

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- ============================================
-- FIX 2: Wallets — users should NEVER update their own wallet
-- Only the system (SECURITY DEFINER functions) should modify balances.
-- ============================================

DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;
DROP POLICY IF EXISTS "Admin can update wallets" ON wallets;

-- Admin-only update (for manual deposits via admin panel)
CREATE POLICY "Admin can update wallets"
  ON wallets FOR UPDATE
  USING (is_admin());

-- ============================================
-- FIX 3: place_bet — validate auth.uid() matches p_user_id
-- Prevents spoofing where a user places bets on behalf of another.
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
  -- *** SECURITY: Validate caller identity ***
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Nao autorizado: usuario nao corresponde';
  END IF;

  -- Check idempotency
  SELECT id INTO v_existing_bet FROM bets WHERE idempotency_key = p_idempotency_key;
  IF v_existing_bet IS NOT NULL THEN
    SELECT * INTO v_bet FROM bets WHERE id = v_existing_bet;
    RETURN v_bet;
  END IF;

  -- Validate min/max amount
  IF p_amount < 1 THEN
    RAISE EXCEPTION 'Aposta minima e R$ 1,00';
  END IF;

  IF p_amount > 200 THEN
    RAISE EXCEPTION 'Aposta maxima e R$ 200,00';
  END IF;

  -- Verify market is open
  SELECT * INTO v_market FROM markets WHERE id = p_market_id;
  IF v_market.status != 'open' THEN
    RAISE EXCEPTION 'Mercado nao esta aberto para apostas';
  END IF;

  -- Verify user has no existing bet on this market
  IF EXISTS (SELECT 1 FROM bets WHERE user_id = p_user_id AND market_id = p_market_id) THEN
    RAISE EXCEPTION 'Voce ja apostou neste mercado';
  END IF;

  -- Lock wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RAISE EXCEPTION 'Carteira nao encontrada';
  END IF;

  -- Check balance
  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  -- Get option info
  SELECT * INTO v_option FROM market_options WHERE id = p_option_id AND market_id = p_market_id;
  IF v_option IS NULL THEN
    RAISE EXCEPTION 'Opcao invalida';
  END IF;

  -- Calculate odds (pari-mutuel)
  SELECT COALESCE(SUM(total_pool), 0) INTO v_pool_total FROM market_options WHERE market_id = p_market_id;
  v_option_pool := v_option.total_pool;

  -- Add current bet to pools for odds calculation
  v_pool_total := v_pool_total + p_amount;
  v_option_pool := v_option_pool + p_amount;

  IF v_option_pool > 0 THEN
    v_odds := v_pool_total / v_option_pool;
  ELSE
    v_odds := 2.0;
  END IF;

  -- Potential payout with 10% commission
  v_potential_payout := ROUND(p_amount * v_odds * 0.90, 2);

  -- Debit wallet
  UPDATE wallets
    SET balance = balance - p_amount, updated_at = now()
    WHERE id = v_wallet.id;

  -- Insert bet
  INSERT INTO bets (user_id, market_id, option_id, amount, potential_payout, idempotency_key)
  VALUES (p_user_id, p_market_id, p_option_id, p_amount, v_potential_payout, p_idempotency_key)
  RETURNING * INTO v_bet;

  -- Update market option pool
  UPDATE market_options
    SET total_pool = total_pool + p_amount
    WHERE id = p_option_id;

  -- Record transaction
  INSERT INTO transactions (wallet_id, type, amount, balance_after, reference_id, description)
  VALUES (
    v_wallet.id,
    'bet_placed',
    -p_amount,
    v_wallet.balance - p_amount,
    v_bet.id,
    'Aposta: ' || v_option.label
  );

  RETURN v_bet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
