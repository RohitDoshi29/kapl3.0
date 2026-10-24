-- ==============================================================================
-- Seed 80 Fake Auction Players & Reset Teams to 0 Players with Full 10,000 Purse
-- NOTE: FOR LOCAL DEVELOPMENT AND SEED TESTING ONLY. DO NOT RUN IN PRODUCTION.
-- ==============================================================================

-- 0. Safety Guard: Do NOT wipe production if user-registered players exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.players WHERE user_id IS NOT NULL LIMIT 1) THEN
    RAISE EXCEPTION 'Safety Stop: Real user registered players detected in database. Aborting seed_80_auction_players to prevent data loss.';
  END IF;
END $$;

-- 1. Clear previous auction bids & reset auction state
DELETE FROM public.auction_bids;

UPDATE public.auction_state
SET current_player_id = NULL, current_bid = 0, highest_bidder_team_id = NULL, bid_history = '[]'::jsonb, status = 'idle', timer_ends_at = NULL, updated_at = now();

-- 2. Empty all team squad rosters and replenish remaining purse to 10,000
UPDATE public.teams
SET players = '[]'::jsonb, player_count = 0, remaining_purse = 10000, updated_at = now();

-- 3. Delete old test players
DELETE FROM public.players;

-- 4. Insert 80 structured auction players (Batters, Bowlers, All-rounders, Keepers)
INSERT INTO public.players (
  id, tournament_id, team_id, name, role, batting_style, bowling_style, base_price, sold_price, auction_status, jersey_number
) VALUES
  ('p-1', 'kapl-3-mens', NULL, 'Player 1', 'batter', 'Right-hand bat', 'None', 200, NULL, 'pending', 1),
  ('p-2', 'kapl-3-mens', NULL, 'Player 2', 'batter', 'Right-hand bat', 'None', 300, NULL, 'pending', 2),
  ('p-3', 'kapl-3-mens', NULL, 'Player 3', 'batter', 'Left-hand bat', 'None', 500, NULL, 'pending', 3),
  ('p-4', 'kapl-3-mens', NULL, 'Player 4', 'batter', 'Right-hand bat', 'Right-arm off break', 100, NULL, 'pending', 4),
  ('p-5', 'kapl-3-mens', NULL, 'Player 5', 'batter', 'Right-hand bat', 'None', 200, NULL, 'pending', 5),
  ('p-6', 'kapl-3-mens', NULL, 'Player 6', 'batter', 'Left-hand bat', 'None', 300, NULL, 'pending', 6),
  ('p-7', 'kapl-3-mens', NULL, 'Player 7', 'batter', 'Right-hand bat', 'None', 500, NULL, 'pending', 7),
  ('p-8', 'kapl-3-mens', NULL, 'Player 8', 'batter', 'Right-hand bat', 'Right-arm off break', 100, NULL, 'pending', 8),
  ('p-9', 'kapl-3-mens', NULL, 'Player 9', 'batter', 'Left-hand bat', 'None', 200, NULL, 'pending', 9),
  ('p-10', 'kapl-3-mens', NULL, 'Player 10', 'batter', 'Right-hand bat', 'None', 300, NULL, 'pending', 10),
  ('p-11', 'kapl-3-mens', NULL, 'Player 11', 'batter', 'Right-hand bat', 'None', 500, NULL, 'pending', 11),
  ('p-12', 'kapl-3-mens', NULL, 'Player 12', 'batter', 'Left-hand bat', 'Right-arm off break', 100, NULL, 'pending', 12),
  ('p-13', 'kapl-3-mens', NULL, 'Player 13', 'batter', 'Right-hand bat', 'None', 200, NULL, 'pending', 13),
  ('p-14', 'kapl-3-mens', NULL, 'Player 14', 'batter', 'Right-hand bat', 'None', 300, NULL, 'pending', 14),
  ('p-15', 'kapl-3-mens', NULL, 'Player 15', 'batter', 'Left-hand bat', 'None', 500, NULL, 'pending', 15),
  ('p-16', 'kapl-3-mens', NULL, 'Player 16', 'batter', 'Right-hand bat', 'Right-arm off break', 100, NULL, 'pending', 16),
  ('p-17', 'kapl-3-mens', NULL, 'Player 17', 'batter', 'Right-hand bat', 'None', 200, NULL, 'pending', 17),
  ('p-18', 'kapl-3-mens', NULL, 'Player 18', 'batter', 'Left-hand bat', 'None', 300, NULL, 'pending', 18),
  ('p-19', 'kapl-3-mens', NULL, 'Player 19', 'batter', 'Right-hand bat', 'None', 500, NULL, 'pending', 19),
  ('p-20', 'kapl-3-mens', NULL, 'Player 20', 'batter', 'Right-hand bat', 'Right-arm off break', 100, NULL, 'pending', 20),
  ('p-21', 'kapl-3-mens', NULL, 'Player 21', 'batter', 'Left-hand bat', 'None', 200, NULL, 'pending', 21),
  ('p-22', 'kapl-3-mens', NULL, 'Player 22', 'batter', 'Right-hand bat', 'None', 300, NULL, 'pending', 22),
  ('p-23', 'kapl-3-mens', NULL, 'Player 23', 'batter', 'Right-hand bat', 'None', 500, NULL, 'pending', 23),
  ('p-24', 'kapl-3-mens', NULL, 'Player 24', 'batter', 'Left-hand bat', 'Right-arm off break', 100, NULL, 'pending', 24),
  ('p-25', 'kapl-3-mens', NULL, 'Player 25', 'batter', 'Right-hand bat', 'None', 200, NULL, 'pending', 25),
  ('p-26', 'kapl-3-mens', NULL, 'Player 26', 'bowler', 'Right-hand bat', 'Right-arm off break', 200, NULL, 'pending', 26),
  ('p-27', 'kapl-3-mens', NULL, 'Player 27', 'bowler', 'Left-hand bat', 'Right-arm leg break', 300, NULL, 'pending', 27),
  ('p-28', 'kapl-3-mens', NULL, 'Player 28', 'bowler', 'Right-hand bat', 'Left-arm fast', 100, NULL, 'pending', 28),
  ('p-29', 'kapl-3-mens', NULL, 'Player 29', 'bowler', 'Right-hand bat', 'Left-arm orthodox', 150, NULL, 'pending', 29),
  ('p-30', 'kapl-3-mens', NULL, 'Player 30', 'bowler', 'Left-hand bat', 'Right-arm fast', 200, NULL, 'pending', 30),
  ('p-31', 'kapl-3-mens', NULL, 'Player 31', 'bowler', 'Right-hand bat', 'Right-arm medium-fast', 300, NULL, 'pending', 31),
  ('p-32', 'kapl-3-mens', NULL, 'Player 32', 'bowler', 'Right-hand bat', 'Right-arm off break', 100, NULL, 'pending', 32),
  ('p-33', 'kapl-3-mens', NULL, 'Player 33', 'bowler', 'Left-hand bat', 'Right-arm leg break', 150, NULL, 'pending', 33),
  ('p-34', 'kapl-3-mens', NULL, 'Player 34', 'bowler', 'Right-hand bat', 'Left-arm fast', 200, NULL, 'pending', 34),
  ('p-35', 'kapl-3-mens', NULL, 'Player 35', 'bowler', 'Right-hand bat', 'Left-arm orthodox', 300, NULL, 'pending', 35),
  ('p-36', 'kapl-3-mens', NULL, 'Player 36', 'bowler', 'Left-hand bat', 'Right-arm fast', 100, NULL, 'pending', 36),
  ('p-37', 'kapl-3-mens', NULL, 'Player 37', 'bowler', 'Right-hand bat', 'Right-arm medium-fast', 150, NULL, 'pending', 37),
  ('p-38', 'kapl-3-mens', NULL, 'Player 38', 'bowler', 'Right-hand bat', 'Right-arm off break', 200, NULL, 'pending', 38),
  ('p-39', 'kapl-3-mens', NULL, 'Player 39', 'bowler', 'Left-hand bat', 'Right-arm leg break', 300, NULL, 'pending', 39),
  ('p-40', 'kapl-3-mens', NULL, 'Player 40', 'bowler', 'Right-hand bat', 'Left-arm fast', 100, NULL, 'pending', 40),
  ('p-41', 'kapl-3-mens', NULL, 'Player 41', 'bowler', 'Right-hand bat', 'Left-arm orthodox', 150, NULL, 'pending', 41),
  ('p-42', 'kapl-3-mens', NULL, 'Player 42', 'bowler', 'Left-hand bat', 'Right-arm fast', 200, NULL, 'pending', 42),
  ('p-43', 'kapl-3-mens', NULL, 'Player 43', 'bowler', 'Right-hand bat', 'Right-arm medium-fast', 300, NULL, 'pending', 43),
  ('p-44', 'kapl-3-mens', NULL, 'Player 44', 'bowler', 'Right-hand bat', 'Right-arm off break', 100, NULL, 'pending', 44),
  ('p-45', 'kapl-3-mens', NULL, 'Player 45', 'bowler', 'Left-hand bat', 'Right-arm leg break', 150, NULL, 'pending', 45),
  ('p-46', 'kapl-3-mens', NULL, 'Player 46', 'bowler', 'Right-hand bat', 'Left-arm fast', 200, NULL, 'pending', 46),
  ('p-47', 'kapl-3-mens', NULL, 'Player 47', 'bowler', 'Right-hand bat', 'Left-arm orthodox', 300, NULL, 'pending', 47),
  ('p-48', 'kapl-3-mens', NULL, 'Player 48', 'bowler', 'Left-hand bat', 'Right-arm fast', 100, NULL, 'pending', 48),
  ('p-49', 'kapl-3-mens', NULL, 'Player 49', 'bowler', 'Right-hand bat', 'Right-arm medium-fast', 150, NULL, 'pending', 49),
  ('p-50', 'kapl-3-mens', NULL, 'Player 50', 'bowler', 'Right-hand bat', 'Right-arm off break', 200, NULL, 'pending', 50),
  ('p-51', 'kapl-3-mens', NULL, 'Player 51', 'all_rounder', 'Left-hand bat', 'Right-arm medium', 500, NULL, 'pending', 51),
  ('p-52', 'kapl-3-mens', NULL, 'Player 52', 'all_rounder', 'Right-hand bat', 'Right-arm fast-medium', 200, NULL, 'pending', 52),
  ('p-53', 'kapl-3-mens', NULL, 'Player 53', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', 300, NULL, 'pending', 53),
  ('p-54', 'kapl-3-mens', NULL, 'Player 54', 'all_rounder', 'Left-hand bat', 'Left-arm spin', 400, NULL, 'pending', 54),
  ('p-55', 'kapl-3-mens', NULL, 'Player 55', 'all_rounder', 'Right-hand bat', 'Right-arm medium', 500, NULL, 'pending', 55),
  ('p-56', 'kapl-3-mens', NULL, 'Player 56', 'all_rounder', 'Right-hand bat', 'Right-arm fast-medium', 200, NULL, 'pending', 56),
  ('p-57', 'kapl-3-mens', NULL, 'Player 57', 'all_rounder', 'Left-hand bat', 'Right-arm off spin', 300, NULL, 'pending', 57),
  ('p-58', 'kapl-3-mens', NULL, 'Player 58', 'all_rounder', 'Right-hand bat', 'Left-arm spin', 400, NULL, 'pending', 58),
  ('p-59', 'kapl-3-mens', NULL, 'Player 59', 'all_rounder', 'Right-hand bat', 'Right-arm medium', 500, NULL, 'pending', 59),
  ('p-60', 'kapl-3-mens', NULL, 'Player 60', 'all_rounder', 'Left-hand bat', 'Right-arm fast-medium', 200, NULL, 'pending', 60),
  ('p-61', 'kapl-3-mens', NULL, 'Player 61', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', 300, NULL, 'pending', 61),
  ('p-62', 'kapl-3-mens', NULL, 'Player 62', 'all_rounder', 'Right-hand bat', 'Left-arm spin', 400, NULL, 'pending', 62),
  ('p-63', 'kapl-3-mens', NULL, 'Player 63', 'all_rounder', 'Left-hand bat', 'Right-arm medium', 500, NULL, 'pending', 63),
  ('p-64', 'kapl-3-mens', NULL, 'Player 64', 'all_rounder', 'Right-hand bat', 'Right-arm fast-medium', 200, NULL, 'pending', 64),
  ('p-65', 'kapl-3-mens', NULL, 'Player 65', 'all_rounder', 'Right-hand bat', 'Right-arm off spin', 300, NULL, 'pending', 65),
  ('p-66', 'kapl-3-mens', NULL, 'Player 66', 'all_rounder', 'Left-hand bat', 'Left-arm spin', 400, NULL, 'pending', 66),
  ('p-67', 'kapl-3-mens', NULL, 'Player 67', 'all_rounder', 'Right-hand bat', 'Right-arm medium', 500, NULL, 'pending', 67),
  ('p-68', 'kapl-3-mens', NULL, 'Player 68', 'all_rounder', 'Right-hand bat', 'Right-arm fast-medium', 200, NULL, 'pending', 68),
  ('p-69', 'kapl-3-mens', NULL, 'Player 69', 'all_rounder', 'Left-hand bat', 'Right-arm off spin', 300, NULL, 'pending', 69),
  ('p-70', 'kapl-3-mens', NULL, 'Player 70', 'all_rounder', 'Right-hand bat', 'Left-arm spin', 400, NULL, 'pending', 70),
  ('p-71', 'kapl-3-mens', NULL, 'Player 71', 'wicket_keeper', 'Right-hand bat', 'None', 300, NULL, 'pending', 71),
  ('p-72', 'kapl-3-mens', NULL, 'Player 72', 'wicket_keeper', 'Left-hand bat', 'None', 100, NULL, 'pending', 72),
  ('p-73', 'kapl-3-mens', NULL, 'Player 73', 'wicket_keeper', 'Right-hand bat', 'None', 200, NULL, 'pending', 73),
  ('p-74', 'kapl-3-mens', NULL, 'Player 74', 'wicket_keeper', 'Right-hand bat', 'None', 250, NULL, 'pending', 74),
  ('p-75', 'kapl-3-mens', NULL, 'Player 75', 'wicket_keeper', 'Left-hand bat', 'None', 300, NULL, 'pending', 75),
  ('p-76', 'kapl-3-mens', NULL, 'Player 76', 'wicket_keeper', 'Right-hand bat', 'None', 100, NULL, 'pending', 76),
  ('p-77', 'kapl-3-mens', NULL, 'Player 77', 'wicket_keeper', 'Right-hand bat', 'None', 200, NULL, 'pending', 77),
  ('p-78', 'kapl-3-mens', NULL, 'Player 78', 'wicket_keeper', 'Left-hand bat', 'None', 250, NULL, 'pending', 78),
  ('p-79', 'kapl-3-mens', NULL, 'Player 79', 'wicket_keeper', 'Right-hand bat', 'None', 300, NULL, 'pending', 79),
  ('p-80', 'kapl-3-mens', NULL, 'Player 80', 'wicket_keeper', 'Right-hand bat', 'None', 100, NULL, 'pending', 80);

-- 5. Set first player in auction spotlight
UPDATE public.auction_state
SET current_player_id = 'p-1', current_bid = 100, status = 'idle', updated_at = now()
WHERE tournament_id = 'kapl-3-mens';
