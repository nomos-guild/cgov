import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { GovernanceAction, GovernanceActionDetail, GovernanceActionType, VoteType } from "@/types/governance";

interface GovernanceState {
  actions: GovernanceAction[];
  selectedAction: GovernanceActionDetail | null;
  filters: {
    type: GovernanceActionType;
    searchQuery: string;
    voteFilter: VoteType;
  };
}

const initialState: GovernanceState = {
  actions: [],
  selectedAction: null,
  filters: {
    type: "All",
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
    setTypeFilter: (state, action: PayloadAction<GovernanceActionType>) => {
      state.filters.type = action.payload;
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
  setTypeFilter,
  setSearchQuery,
  setVoteFilter,
  resetFilters,
} = governanceSlice.actions;

export default governanceSlice.reducer;
