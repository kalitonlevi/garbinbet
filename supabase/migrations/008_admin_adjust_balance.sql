-- ============================================
-- 008: admin_adjust_balance — depósito/saque manual do admin
-- ============================================
-- O painel admin gravava em wallets + transactions DIRETO pelo cliente.
-- A tabela transactions não tem policy de INSERT (só SELECT), então o
-- RLS bloqueava ("new row violates row-level security policy"). Além
-- disso o caminho antigo confundia wallet.id com user.id. Esta função
-- SECURITY DEFINER faz o ajuste atômico, por user_id, furando o RLS.

CREATE OR REPLACE FUNCTION admin_adjust_balance(
  p_user_id uuid,
  p_amount numeric,
  p_type text
) RETURNS jsonb AS $$
DECLARE
  v_wallet wallets;
  v_new_balance numeric;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  IF p_type NOT IN ('deposit', 'withdraw') THEN
    RAISE EXCEPTION 'Tipo inválido';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Carteira não encontrada';
  END IF;

  IF p_type = 'withdraw' AND v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  v_new_balance := CASE
    WHEN p_type = 'deposit' THEN v_wallet.balance + p_amount
    ELSE v_wallet.balance - p_amount
  END;

  UPDATE wallets SET balance = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO transactions (wallet_id, type, amount, balance_after, description)
  VALUES (
    v_wallet.id,
    p_type,
    CASE WHEN p_type = 'deposit' THEN p_amount ELSE -p_amount END,
    v_new_balance,
    CASE WHEN p_type = 'deposit' THEN 'Depósito via admin' ELSE 'Saque via admin' END
  );

  RETURN jsonb_build_object('new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_adjust_balance(uuid, numeric, text) TO authenticated;
