import { configureStore } from "@reduxjs/toolkit";
import governanceReducer from "./governanceSlice";
import developmentReducer from "./developmentSlice";

export const store = configureStore({
  reducer: {
    governance: governanceReducer,
    development: developmentReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
