import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface DualRangeSliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  formatValue?: (value: number) => string;
}

const DualRangeSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  DualRangeSliderProps
// eslint-disable-next-line @typescript-eslint/no-unused-vars
>(({ className, formatValue, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track data-part="track" className="relative h-2 w-full grow overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      <SliderPrimitive.Range data-part="range" className="absolute h-full bg-black dark:bg-[#0bd1a2]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb data-part="thumb" className="block h-5 w-5 rounded-full border-2 border-black bg-white shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-[#0bd1a2] dark:bg-[#0a0a0a] dark:focus-visible:ring-[#0bd1a2]/30" />
    <SliderPrimitive.Thumb data-part="thumb" className="block h-5 w-5 rounded-full border-2 border-black bg-white shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-[#0bd1a2] dark:bg-[#0a0a0a] dark:focus-visible:ring-[#0bd1a2]/30" />
  </SliderPrimitive.Root>
));
DualRangeSlider.displayName = "DualRangeSlider";

export { DualRangeSlider };
export type { DualRangeSliderProps };
