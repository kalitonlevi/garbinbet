-- ============================================
-- 010: Fix mines_house_status PnL for lost games
-- ============================================
-- O cashout_amount em jogos perdidos guarda o valor da última
-- revelação segura antes da mina (resto do loop em reveal_tile), NÃO
-- o valor que o jogador recebeu (que foi zero). A versão anterior de
-- mines_house_status subtraía isso do bet_amount, inflando
-- artificialmente o prejuízo da casa. Correção: considerar
-- bet_amount puro para lost, bet_amount - cashout_amount para won.

CREATE OR REPLACE FUNCTION mines_house_status() RETURNS jsonb AS $$
DECLARE
  v_total_wallets numeric;
  v_reserve numeric;
  v_reserve_pct constant numeric := 0.30;
  v_max_payout constant numeric := 100.00;
  v_active_games integer;
  v_24h_house_pnl numeric;
BEGIN
  SELECT coalesce(sum(balance), 0) INTO v_total_wallets FROM wallets;
  v_reserve := v_total_wallets * v_reserve_pct;

  SELECT count(*) INTO v_active_games
  FROM mines_games WHERE status = 'active';

  SELECT coalesce(sum(
    CASE
      WHEN status = 'won' THEN bet_amount - cashout_amount
      WHEN status = 'lost' THEN bet_amount
      ELSE 0
    END
  ), 0) INTO v_24h_house_pnl
  FROM mines_games
  WHERE status IN ('won', 'lost')
    AND ended_at > now() - interval '24 hours';

  RETURN jsonb_build_object(
    'total_wallets', v_total_wallets,
    'reserve', v_reserve,
    'reserve_pct', v_reserve_pct,
    'max_payout', v_max_payout,
    'accepting_bets', v_reserve >= v_max_payout,
    'active_games', v_active_games,
    'house_pnl_24h', v_24h_house_pnl
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
