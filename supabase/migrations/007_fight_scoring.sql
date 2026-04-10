-- ============================================
-- 007: Fight scoring (Jiu-Jitsu IBJJF style)
-- ============================================
-- Sistema de contagem de pontos das lutas seguindo as regras da IBJJF:
--   Quedas (takedown)        -> 2 pontos
--   Raspagem (sweep)         -> 2 pontos
--   Joelho na barriga (KoB)  -> 2 pontos
--   Passagem de guarda       -> 3 pontos
--   Montada                  -> 4 pontos
--   Pegada de costas         -> 4 pontos
--   Vantagem                 -> 1 vantagem (desempate)
--   Punição                  -> 1 punição
-- Submissão / DQ encerram a luta e devem ser finalizadas via /admin/settle.

CREATE TABLE fight_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fight_id uuid NOT NULL REFERENCES fights ON DELETE CASCADE,
  fighter_id uuid NOT NULL REFERENCES fighters ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  advantages integer NOT NULL DEFAULT 0 CHECK (advantages >= 0),
  penalties integer NOT NULL DEFAULT 0 CHECK (penalties >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fight_id, fighter_id)
);

CREATE TABLE fight_score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fight_id uuid NOT NULL REFERENCES fights ON DELETE CASCADE,
  fighter_id uuid NOT NULL REFERENCES fighters ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'takedown',
    'sweep',
    'knee_on_belly',
    'guard_pass',
    'mount',
    'back_control',
    'advantage',
    'penalty'
  )),
  points_delta integer NOT NULL DEFAULT 0,
  advantages_delta integer NOT NULL DEFAULT 0,
  penalties_delta integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fight_scores_fight ON fight_scores(fight_id);
CREATE INDEX idx_fight_score_events_fight ON fight_score_events(fight_id);
CREATE INDEX idx_fight_score_events_created_at ON fight_score_events(fight_id, created_at DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE fight_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fight_score_events ENABLE ROW LEVEL SECURITY;

-- Placar é público (qualquer usuário pode visualizar a contagem ao vivo)
CREATE POLICY "Anyone can view fight scores"
  ON fight_scores FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert fight scores"
  ON fight_scores FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin can update fight scores"
  ON fight_scores FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admin can delete fight scores"
  ON fight_scores FOR DELETE
  USING (is_admin());

-- Histórico de eventos: leitura pública, escrita só admin
CREATE POLICY "Anyone can view fight score events"
  ON fight_score_events FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert fight score events"
  ON fight_score_events FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin can delete fight score events"
  ON fight_score_events FOR DELETE
  USING (is_admin());

-- ============================================
-- RPC: register_score_event
-- Aplica um evento de pontuação atomicamente (atualiza placar + grava histórico).
-- ============================================
CREATE OR REPLACE FUNCTION register_score_event(
  p_fight_id uuid,
  p_fighter_id uuid,
  p_action text
)
RETURNS fight_scores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points_delta integer := 0;
  v_adv_delta integer := 0;
  v_pen_delta integer := 0;
  v_score fight_scores;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Validar que o lutador pertence à luta
  IF NOT EXISTS (
    SELECT 1 FROM fights
    WHERE id = p_fight_id
      AND (fighter_a_id = p_fighter_id OR fighter_b_id = p_fighter_id)
  ) THEN
    RAISE EXCEPTION 'fighter does not belong to fight';
  END IF;

  CASE p_action
    WHEN 'takedown'      THEN v_points_delta := 2;
    WHEN 'sweep'         THEN v_points_delta := 2;
    WHEN 'knee_on_belly' THEN v_points_delta := 2;
    WHEN 'guard_pass'    THEN v_points_delta := 3;
    WHEN 'mount'         THEN v_points_delta := 4;
    WHEN 'back_control'  THEN v_points_delta := 4;
    WHEN 'advantage'     THEN v_adv_delta := 1;
    WHEN 'penalty'       THEN v_pen_delta := 1;
    ELSE RAISE EXCEPTION 'invalid action: %', p_action;
  END CASE;

  INSERT INTO fight_score_events (
    fight_id, fighter_id, action, points_delta, advantages_delta, penalties_delta, created_by
  ) VALUES (
    p_fight_id, p_fighter_id, p_action, v_points_delta, v_adv_delta, v_pen_delta, auth.uid()
  );

  INSERT INTO fight_scores (fight_id, fighter_id, points, advantages, penalties)
  VALUES (p_fight_id, p_fighter_id, v_points_delta, v_adv_delta, v_pen_delta)
  ON CONFLICT (fight_id, fighter_id) DO UPDATE
    SET points = fight_scores.points + EXCLUDED.points,
        advantages = fight_scores.advantages + EXCLUDED.advantages,
        penalties = fight_scores.penalties + EXCLUDED.penalties,
        updated_at = now()
  RETURNING * INTO v_score;

  RETURN v_score;
END;
$$;

-- ============================================
-- RPC: undo_last_score_event
-- Remove o último evento de pontuação da luta e reverte o placar.
-- ============================================
CREATE OR REPLACE FUNCTION undo_last_score_event(p_fight_id uuid)
RETURNS fight_scores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event fight_score_events;
  v_score fight_scores;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_event
  FROM fight_score_events
  WHERE fight_id = p_fight_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_event.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE fight_scores
  SET points = GREATEST(points - v_event.points_delta, 0),
      advantages = GREATEST(advantages - v_event.advantages_delta, 0),
      penalties = GREATEST(penalties - v_event.penalties_delta, 0),
      updated_at = now()
  WHERE fight_id = v_event.fight_id AND fighter_id = v_event.fighter_id
  RETURNING * INTO v_score;

  DELETE FROM fight_score_events WHERE id = v_event.id;

  RETURN v_score;
END;
$$;

-- ============================================
-- RPC: reset_fight_scores
-- Zera o placar e o histórico de uma luta (uso administrativo).
-- ============================================
CREATE OR REPLACE FUNCTION reset_fight_scores(p_fight_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM fight_score_events WHERE fight_id = p_fight_id;
  DELETE FROM fight_scores WHERE fight_id = p_fight_id;
END;
$$;

GRANT EXECUTE ON FUNCTION register_score_event(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION undo_last_score_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_fight_scores(uuid) TO authenticated;
