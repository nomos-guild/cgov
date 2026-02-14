import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  DevelopmentState,
  DevelopmentOverview,
  DevelopmentActivity,
  DevelopmentRepos,
  DevelopmentContributors,
  DevelopmentHealth,
  DevelopmentStars,
  DevelopmentLanguages,
  NetworkGraphData,
  DevelopmentRecent,
  DevelopmentRange,
} from "@/types/development";

const initialState: DevelopmentState = {
  loading: {
    overview: false,
    activity: false,
    repos: false,
    contributors: false,
    health: false,
    stars: false,
    languages: false,
    network: false,
    recent: false,
  },
  errors: {},
  overview: null,
  activity: null,
  repos: null,
  contributors: null,
  health: null,
  stars: null,
  languages: null,
  network: null,
  recent: null,
  selectedRange: "30d",
  compareEnabled: true,
};

const developmentSlice = createSlice({
  name: "development",
  initialState,
  reducers: {
    setOverview(state, action: PayloadAction<DevelopmentOverview>) {
      state.overview = action.payload;
    },
    setActivity(state, action: PayloadAction<DevelopmentActivity>) {
      state.activity = action.payload;
    },
    setRepos(state, action: PayloadAction<DevelopmentRepos>) {
      state.repos = action.payload;
    },
    setContributors(state, action: PayloadAction<DevelopmentContributors>) {
      state.contributors = action.payload;
    },
    setHealth(state, action: PayloadAction<DevelopmentHealth>) {
      state.health = action.payload;
    },
    setStars(state, action: PayloadAction<DevelopmentStars>) {
      state.stars = action.payload;
    },
    setLanguages(state, action: PayloadAction<DevelopmentLanguages>) {
      state.languages = action.payload;
    },
    setNetwork(state, action: PayloadAction<NetworkGraphData>) {
      state.network = action.payload;
    },
    setRecent(state, action: PayloadAction<DevelopmentRecent>) {
      state.recent = action.payload;
    },
    setSelectedRange(state, action: PayloadAction<DevelopmentRange>) {
      state.selectedRange = action.payload;
    },
    setCompareEnabled(state, action: PayloadAction<boolean>) {
      state.compareEnabled = action.payload;
    },
    setLoading(state, action: PayloadAction<{ key: keyof DevelopmentState["loading"]; value: boolean }>) {
      state.loading[action.payload.key] = action.payload.value;
    },
    setError(state, action: PayloadAction<{ key: string; value: string | null }>) {
      state.errors[action.payload.key] = action.payload.value;
    },
  },
});

export const {
  setOverview,
  setActivity,
  setRepos,
  setContributors,
  setHealth,
  setStars,
  setLanguages,
  setNetwork,
  setRecent,
  setSelectedRange,
  setCompareEnabled,
  setLoading,
  setError,
} = developmentSlice.actions;

export default developmentSlice.reducer;
