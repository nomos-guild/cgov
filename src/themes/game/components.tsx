import type { ThemeComponents } from "../types";

const HeaderBrand = () => (
  <span className="text-2xl font-bold text-white" style={{ fontFamily: "Tw Cen MT, var(--font-heading), var(--font-sans)" }}>
    CGOV
  </span>
);

const components: ThemeComponents = {
  HeaderBrand,
};

export default components;

