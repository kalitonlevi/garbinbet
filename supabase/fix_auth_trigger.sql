-- ============================================
-- FIX: Recriar trigger de auth + policy de INSERT em profiles
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================

-- 1. Recriar a function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'));

  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Recriar o trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Adicionar policy de INSERT em profiles (caso falte)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Enable insert for auth trigger'
  ) THEN
    CREATE POLICY "Enable insert for auth trigger" ON profiles
      FOR INSERT WITH CHECK (true);
  END IF;
END
$$;

-- 4. Adicionar policy de INSERT em wallets (caso falte)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wallets' AND policyname = 'Enable insert for auth trigger'
  ) THEN
    CREATE POLICY "Enable insert for auth trigger" ON wallets
      FOR INSERT WITH CHECK (true);
  END IF;
END
$$;

-- 5. Adicionar policy de INSERT em transactions para admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Admin can insert transactions'
  ) THEN
    CREATE POLICY "Admin can insert transactions" ON transactions
      FOR INSERT WITH CHECK (is_admin());
  END IF;
END
$$;

-- 6. Adicionar policy de UPDATE em wallets para admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wallets' AND policyname = 'Admin can update wallets'
  ) THEN
    CREATE POLICY "Admin can update wallets" ON wallets
      FOR UPDATE USING (is_admin());
  END IF;
END
$$;

-- 7. Adicionar policy de SELECT em wallets para admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wallets' AND policyname = 'Admin can view all wallets'
  ) THEN
    CREATE POLICY "Admin can view all wallets" ON wallets
      FOR SELECT USING (is_admin());
  END IF;
END
$$;

-- 8. Adicionar policy de UPDATE em profiles para admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admin can update all profiles'
  ) THEN
    CREATE POLICY "Admin can update all profiles" ON profiles
      FOR UPDATE USING (is_admin());
  END IF;
END
$$;

-- 9. Limpar usuarios orfaos que podem ter ficado do signup que falhou
DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM profiles);

-- PRONTO! Tente criar a conta novamente no app.
