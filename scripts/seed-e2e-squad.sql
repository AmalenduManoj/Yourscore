-- Usage: psql "$DATABASE_URL" -v team1=25 -v team2=26 -v owner=31 -f scripts/seed-e2e-squad.sql

WITH ins AS (
  INSERT INTO users (email, password_hash, created_at)
  SELECT
    'e2e_seed_' || s || '_' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint || '@test.local',
    (SELECT password_hash FROM users ORDER BY id LIMIT 1),
    now()
  FROM generate_series(1, 22) AS s
  RETURNING id
),
numbered AS (
  SELECT id AS user_id, row_number() OVER (ORDER BY id) AS rn FROM ins
),
new_players AS (
  INSERT INTO players (name, is_active, dob, user_id, role, profile_picture_url, bio, matches_played)
  SELECT
    'Seed Player ' || rn,
    true,
    2000,
    user_id,
    CASE WHEN rn % 3 = 0 THEN 'bowler' ELSE 'batsman' END,
    '',
    '',
    0
  FROM numbered
  RETURNING id AS player_id, user_id
),
mapped AS (
  SELECT np.player_id, n.rn
  FROM new_players np
  JOIN numbered n ON n.user_id = np.user_id
),
team1_ins AS (
  INSERT INTO team_player_registry (team_id, player_id, user_id)
  SELECT :'team1'::bigint, player_id, :'owner'::bigint FROM mapped WHERE rn <= 11
  ON CONFLICT (team_id, player_id) DO NOTHING
  RETURNING 1
),
team2_ins AS (
  INSERT INTO team_player_registry (team_id, player_id, user_id)
  SELECT :'team2'::bigint, player_id, :'owner'::bigint FROM mapped WHERE rn > 11
  ON CONFLICT (team_id, player_id) DO NOTHING
  RETURNING 1
)
SELECT
  (SELECT COUNT(*) FROM team_player_registry WHERE team_id = :'team1'::bigint) AS team1_squad,
  (SELECT COUNT(*) FROM team_player_registry WHERE team_id = :'team2'::bigint) AS team2_squad;
