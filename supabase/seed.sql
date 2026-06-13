-- ============================================
-- GARBINBET — Copa Edition — Seed
-- Jogos REAIS do Brasil na Copa 2026 (Grupo C: Marrocos, Haiti, Escócia)
-- Brasil sempre como mandante (fighter_a) para os mercados ficarem Brasil-cêntricos.
-- ============================================

-- Evento (Grupo C) — ao vivo
INSERT INTO events (id, name, date, status) VALUES
  ('e1000000-0000-4000-a000-000000000001', 'Copa do Mundo 2026 — Grupo C', DATE '2026-06-13', 'live');

-- Seleções. photo_url = bandeira via flagcdn (gb-sct = Escócia).
INSERT INTO fighters (id, name, nickname, fifa_code, photo_url) VALUES
  ('f1000000-0000-4000-a000-000000000001', 'Brasil',   'Canarinho',         'BRA', 'https://flagcdn.com/w160/br.png'),
  ('f1000000-0000-4000-a000-000000000002', 'Marrocos', 'Leões do Atlas',    'MAR', 'https://flagcdn.com/w160/ma.png'),
  ('f1000000-0000-4000-a000-000000000003', 'Haiti',    'Les Grenadiers',    'HAI', 'https://flagcdn.com/w160/ht.png'),
  ('f1000000-0000-4000-a000-000000000004', 'Escócia',  'Tartan Army',       'SCO', 'https://flagcdn.com/w160/gb-sct.png');

-- Jogos do Brasil (kickoff em horário do leste dos EUA, ET = -04 EDT)
INSERT INTO fights (id, event_id, fighter_a_id, fighter_b_id, fight_order, kickoff_at, status) VALUES
  ('aa100000-0000-4000-a000-000000000001', 'e1000000-0000-4000-a000-000000000001',
     'f1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000002',
     1, TIMESTAMPTZ '2026-06-13 18:00:00-04', 'open'),     -- Brasil x Marrocos (MetLife, NJ)
  ('aa100000-0000-4000-a000-000000000002', 'e1000000-0000-4000-a000-000000000001',
     'f1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000003',
     2, TIMESTAMPTZ '2026-06-19 20:30:00-04', 'upcoming'), -- Brasil x Haiti (Lincoln Financial, Filadélfia)
  ('aa100000-0000-4000-a000-000000000003', 'e1000000-0000-4000-a000-000000000001',
     'f1000000-0000-4000-a000-000000000001', 'f1000000-0000-4000-a000-000000000004',
     3, TIMESTAMPTZ '2026-06-24 18:00:00-04', 'upcoming'); -- Brasil x Escócia (Hard Rock, Miami)

-- ============================================
-- Mercados de cada jogo (9 mercados por jogo)
-- Jogo 1 (Marrocos): mercados 'open'. Jogos 2 e 3: 'locked' até o admin abrir.
-- ============================================
DO $$
DECLARE
  g record;
  mid uuid;
  st text;
BEGIN
  FOR g IN
    SELECT * FROM (VALUES
      ('aa100000-0000-4000-a000-000000000001'::uuid, 'Marrocos', 'open'),
      ('aa100000-0000-4000-a000-000000000002'::uuid, 'Haiti',    'locked'),
      ('aa100000-0000-4000-a000-000000000003'::uuid, 'Escócia',  'locked')
    ) AS t(fight_id, opp, status)
  LOOP
    st := g.status;

    -- 1) Resultado (1X2)
    INSERT INTO markets (fight_id, type, status) VALUES (g.fight_id, 'result', st) RETURNING id INTO mid;
    INSERT INTO market_options (market_id, label) VALUES
      (mid, 'Vitória do Brasil'), (mid, 'Empate'), (mid, 'Vitória: ' || g.opp);

    -- 2) Placar Exato
    INSERT INTO markets (fight_id, type, status) VALUES (g.fight_id, 'exact_score', st) RETURNING id INTO mid;
    INSERT INTO market_options (market_id, label) VALUES
      (mid, 'Brasil 1x0'), (mid, 'Brasil 2x0'), (mid, 'Brasil 2x1'),
      (mid, 'Brasil 3x0'), (mid, 'Empate 1x1'), (mid, g.opp || ' vence'), (mid, 'Outro placar');

    -- 3) Ambas as seleções marcam?
    INSERT INTO markets (fight_id, type, label, status) VALUES (g.fight_id, 'special', 'Ambas as seleções marcam?', st) RETURNING id INTO mid;
    INSERT INTO market_options (market_id, label) VALUES (mid, 'Sim'), (mid, 'Não');

    -- 4) Total de gols na partida
    INSERT INTO markets (fight_id, type, label, status) VALUES (g.fight_id, 'special', 'Total de gols na partida', st) RETURNING id INTO mid;
    INSERT INTO market_options (market_id, label) VALUES (mid, 'Mais de 2.5 gols'), (mid, 'Menos de 2.5 gols');

    -- 5) Quantos gols o Brasil marca?
    INSERT INTO markets (fight_id, type, label, status) VALUES (g.fight_id, 'special', 'Quantos gols o Brasil marca?', st) RETURNING id INTO mid;
    INSERT INTO market_options (market_id, label) VALUES
      (mid, 'Nenhum'), (mid, '1 gol'), (mid, '2 gols'), (mid, '3 ou mais');

    -- 6) Quem marca o primeiro gol?
    INSERT INTO markets (fight_id, type, label, status) VALUES (g.fight_id, 'special', 'Quem marca o primeiro gol?', st) RETURNING id INTO mid;
    INSERT INTO market_options (market_id, label) VALUES
      (mid, 'Brasil'), (mid, g.opp), (mid, 'Não sai gol');

    -- 7) Resultado do 1º tempo
    INSERT INTO markets (fight_id, type, label, status) VALUES (g.fight_id, 'special', 'Resultado do 1º tempo', st) RETURNING id INTO mid;
    INSERT INTO market_options (market_id, label) VALUES
      (mid, 'Brasil na frente'), (mid, 'Empate'), (mid, g.opp || ' na frente');

    -- 8) Vai ter pênalti na partida?
    INSERT INTO markets (fight_id, type, label, status) VALUES (g.fight_id, 'special', 'Vai ter pênalti na partida?', st) RETURNING id INTO mid;
    INSERT INTO market_options (market_id, label) VALUES (mid, 'Sim'), (mid, 'Não');

    -- 9) Vai ter cartão vermelho?
    INSERT INTO markets (fight_id, type, label, status) VALUES (g.fight_id, 'special', 'Vai ter cartão vermelho?', st) RETURNING id INTO mid;
    INSERT INTO market_options (market_id, label) VALUES (mid, 'Sim'), (mid, 'Não');

  END LOOP;
END $$;
