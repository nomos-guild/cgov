export const VOTE_COLORS_LIGHT = {
  yes: "#0B8C30",
  no: "#8C200B",
  abstain: "#000000",
  pending: "#94A3B8",
};

export const VOTE_COLORS_DARK = {
  yes: "#0B8C30",
  no: "#8C200B",
  abstain: "#ffffff",
  pending: "#94A3B8",
};

export const VOTE_COLORS_NEURAL = {
  yes: "#000000",
  no: "#aaaaaa",
  abstain: "#dddddd",
  pending: "#cccccc",
};

export type VoteColorSet = typeof VOTE_COLORS_LIGHT;

export type TimelinePoint = {
  label: string;
  timestamp: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  yesPower: number;
  noPower: number;
  abstainPower: number;
};
