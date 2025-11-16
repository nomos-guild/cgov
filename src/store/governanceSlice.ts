import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type {
  GovernanceAction,
  GovernanceActionDetail,
  ProposalType,
  ProposalStatus,
  VoteType,
} from "@/types/governance";
import { PROPOSAL_TYPES } from "@/types/governance";

const STATUS_OPTIONS: ProposalStatus[] = ["Active", "Ratified", "Expired", "Not approved"];

interface GovernanceState {
  actions: GovernanceAction[];
  selectedAction: GovernanceActionDetail | null;
  filters: {
    selectedTypes: ProposalType[];
    selectedStatuses: ProposalStatus[];
    searchQuery: string;
    voteFilter: VoteType;
  };
}

const initialState: GovernanceState = {
  actions: [],
  selectedAction: null,
  filters: {
    selectedTypes: PROPOSAL_TYPES,
    selectedStatuses: STATUS_OPTIONS,
    searchQuery: "",
    voteFilter: "All",
  },
};

const governanceSlice = createSlice({
  name: "governance",
  initialState,
  reducers: {
    setActions: (state, action: PayloadAction<GovernanceAction[]>) => {
      state.actions = action.payload;
    },
    setSelectedAction: (state, action: PayloadAction<GovernanceActionDetail | null>) => {
      state.selectedAction = action.payload;
    },
    setSelectedTypes: (state, action: PayloadAction<ProposalType[]>) => {
      state.filters.selectedTypes = Array.from(new Set(action.payload));
    },
    setSelectedStatuses: (state, action: PayloadAction<ProposalStatus[]>) => {
      state.filters.selectedStatuses = Array.from(new Set(action.payload));
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.filters.searchQuery = action.payload;
    },
    setVoteFilter: (state, action: PayloadAction<VoteType>) => {
      state.filters.voteFilter = action.payload;
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
  },
});

export const {
  setActions,
  setSelectedAction,
  setSelectedTypes,
  setSelectedStatuses,
  setSearchQuery,
  setVoteFilter,
  resetFilters,
} = governanceSlice.actions;

export { STATUS_OPTIONS };

export default governanceSlice.reducer;
