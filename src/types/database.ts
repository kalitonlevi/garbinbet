export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  pix_key: string | null;
  role: "user" | "admin";
  created_at: string;
};

export type Wallet = {
  id: string;
  user_id: string;
  balance: number;
  updated_at: string;
};

export type Transaction = {
  id: string;
  wallet_id: string;
  type: "deposit" | "withdraw" | "bet_placed" | "bet_won" | "bet_refund";
  amount: number;
  balance_after: number;
  reference_id: string | null;
  description: string | null;
  created_at: string;
};

export type Fighter = {
  id: string;
  name: string;
  nickname: string | null;
  belt: string;
  weight_kg: number | null;
  photo_url: string | null;
  gender: "M" | "F";
  created_at: string;
};

export type Event = {
  id: string;
  name: string;
  date: string | null;
  status: "upcoming" | "live" | "finished";
  created_at: string;
};

export type Fight = {
  id: string;
  event_id: string;
  fighter_a_id: string;
  fighter_b_id: string;
  status: "upcoming" | "open" | "locked" | "finished" | "cancelled";
  winner_id: string | null;
  result_method: string | null;
  fight_order: number | null;
  created_at: string;
  fighter_a?: Fighter;
  fighter_b?: Fighter;
  markets?: Market[];
};

export type Market = {
  id: string;
  fight_id: string;
  type: "winner" | "method" | "has_submission" | "special";
  label: string | null;
  status: "open" | "locked" | "settled" | "voided";
  created_at: string;
  market_options?: MarketOption[];
};

export type MarketOption = {
  id: string;
  market_id: string;
  label: string;
  total_pool: number;
  is_winner: boolean;
  created_at: string;
};

export type Bet = {
  id: string;
  user_id: string;
  market_id: string;
  option_id: string;
  amount: number;
  potential_payout: number | null;
  status: "pending" | "won" | "lost" | "refunded";
  settled_amount: number;
  idempotency_key: string | null;
  created_at: string;
  market_option?: MarketOption;
  market?: Market & { fight?: Fight };
};

export type WithdrawalRequest = {
  id: string;
  user_id: string;
  amount: number;
  pix_key: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  profile?: Profile;
};
