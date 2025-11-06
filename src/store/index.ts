import { configureStore } from "@reduxjs/toolkit";
import governanceReducer from "./governanceSlice";

export const store = configureStore({
  reducer: {
    governance: governanceReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
