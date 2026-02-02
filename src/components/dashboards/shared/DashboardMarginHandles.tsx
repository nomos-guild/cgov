import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useDashboard } from "./DashboardProvider";
import { PAGE_MARGIN_CONSTRAINTS } from "@/types/dashboard";

interface DashboardMarginHandlesProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function DashboardMarginHandles({ containerRef }: DashboardMarginHandlesProps) {
  const { config, updatePageMargins } = useDashboard();
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;
  const isGame = activeTheme.id === "game";

  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [isHoveringLeft, setIsHoveringLeft] = useState(false);
  const [isHoveringRight, setIsHoveringRight] = useState(false);
  const [containerBounds, setContainerBounds] = useState({ top: 0, height: 0 });

  const dragStartX = useRef(0);
  const dragStartMargin = useRef(0);

  // Track container bounds for positioning the lines
  useEffect(() => {
    const updateBounds = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerBounds({
          top: rect.top + window.scrollY,
          height: rect.height,
        });
      }
    };

    updateBounds();
    window.addEventListener("resize", updateBounds);
    window.addEventListener("scroll", updateBounds);

    // Also observe container size changes
    const resizeObserver = new ResizeObserver(updateBounds);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateBounds);
      window.removeEventListener("scroll", updateBounds);
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  // Get the maximum margin from constraints
  const getMaxMargin = useCallback(() => {
    return PAGE_MARGIN_CONSTRAINTS.max;
  }, []);

  // Handle left margin drag
  const handleLeftMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeft(true);
    dragStartX.current = e.clientX;
    dragStartMargin.current = config.pageMargins.left;
  }, [config.pageMargins.left]);

  // Handle right margin drag
  const handleRightMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
    dragStartX.current = e.clientX;
    dragStartMargin.current = config.pageMargins.right;
  }, [config.pageMargins.right]);

  // Mouse move and up handlers
  useEffect(() => {
    if (!isDraggingLeft && !isDraggingRight) return;

    const handleMouseMove = (e: MouseEvent) => {
      const maxMargin = getMaxMargin();
      const minMargin = PAGE_MARGIN_CONSTRAINTS.min;

      if (isDraggingLeft) {
        // Dragging left handle: moving right increases margin, moving left decreases
        const delta = e.clientX - dragStartX.current;
        const newMargin = Math.max(minMargin, Math.min(maxMargin, dragStartMargin.current + delta));
        updatePageMargins({ left: newMargin });
      }

      if (isDraggingRight) {
        // Dragging right handle: moving left increases margin, moving right decreases
        const delta = dragStartX.current - e.clientX;
        const newMargin = Math.max(minMargin, Math.min(maxMargin, dragStartMargin.current + delta));
        updatePageMargins({ right: newMargin });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Add cursor style to body while dragging
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDraggingLeft, isDraggingRight, getMaxMargin, updatePageMargins]);

  const showLeft = isHoveringLeft || isDraggingLeft;
  const showRight = isHoveringRight || isDraggingRight;

  // Get handle color based on theme - very subtle when not hovered
  const handleColor = isGame ? "#00ff66" : isDark ? "#0bd1a2" : "#000000";
  const handleColorMuted = isGame ? "rgba(0, 255, 102, 0.06)" : isDark ? "rgba(11, 209, 162, 0.06)" : "rgba(0, 0, 0, 0.04)";

  // Don't render if container bounds aren't set yet
  if (containerBounds.height === 0) return null;

  return (
    <>
      {/* Left margin handle */}
      <div
        data-margin-handle
        className={cn(
          "absolute z-40 flex items-center justify-center transition-colors duration-200",
          showLeft ? "cursor-ew-resize" : "cursor-ew-resize"
        )}
        style={{
          left: config.pageMargins.left,
          top: containerBounds.top,
          height: containerBounds.height,
          width: "20px",
          transform: "translateX(-50%)",
        }}
        onMouseEnter={() => setIsHoveringLeft(true)}
        onMouseLeave={() => setIsHoveringLeft(false)}
        onMouseDown={handleLeftMouseDown}
      >
        {/* Vertical line */}
        <div
          className="h-full w-[1px] transition-all duration-200"
          style={{
            backgroundColor: showLeft ? handleColor : handleColorMuted,
            width: showLeft ? "2px" : "1px",
          }}
        />
        {/* Drag handle indicator - only show on hover */}
        {showLeft && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-16 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: handleColor,
            }}
          >
            <div className="flex gap-[2px]">
              <div className={cn("w-[2px] h-6 rounded-full", isGame || isDark ? "bg-black/50" : "bg-white/70")} />
              <div className={cn("w-[2px] h-6 rounded-full", isGame || isDark ? "bg-black/50" : "bg-white/70")} />
            </div>
          </div>
        )}
        {/* Margin value tooltip */}
        {showLeft && (
          <div
            className={cn(
              "absolute top-4 left-6 px-2 py-1 text-xs font-mono rounded whitespace-nowrap",
              isGame
                ? "bg-black border border-[#00ff66] text-[#00ff66]"
                : isDark
                  ? "bg-[#1a1a2e] border border-[#0bd1a2] text-[#0bd1a2]"
                  : "bg-white border border-gray-300 text-gray-700 shadow-sm"
            )}
          >
            {config.pageMargins.left}px
          </div>
        )}
      </div>

      {/* Right margin handle */}
      <div
        data-margin-handle
        className={cn(
          "absolute z-40 flex items-center justify-center transition-colors duration-200",
          showRight ? "cursor-ew-resize" : "cursor-ew-resize"
        )}
        style={{
          right: config.pageMargins.right,
          top: containerBounds.top,
          height: containerBounds.height,
          width: "20px",
          transform: "translateX(50%)",
        }}
        onMouseEnter={() => setIsHoveringRight(true)}
        onMouseLeave={() => setIsHoveringRight(false)}
        onMouseDown={handleRightMouseDown}
      >
        {/* Vertical line */}
        <div
          className="h-full w-[1px] transition-all duration-200"
          style={{
            backgroundColor: showRight ? handleColor : handleColorMuted,
            width: showRight ? "2px" : "1px",
          }}
        />
        {/* Drag handle indicator - only show on hover */}
        {showRight && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-16 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: handleColor,
            }}
          >
            <div className="flex gap-[2px]">
              <div className={cn("w-[2px] h-6 rounded-full", isGame || isDark ? "bg-black/50" : "bg-white/70")} />
              <div className={cn("w-[2px] h-6 rounded-full", isGame || isDark ? "bg-black/50" : "bg-white/70")} />
            </div>
          </div>
        )}
        {/* Margin value tooltip */}
        {showRight && (
          <div
            className={cn(
              "absolute top-4 right-6 px-2 py-1 text-xs font-mono rounded whitespace-nowrap",
              isGame
                ? "bg-black border border-[#00ff66] text-[#00ff66]"
                : isDark
                  ? "bg-[#1a1a2e] border border-[#0bd1a2] text-[#0bd1a2]"
                  : "bg-white border border-gray-300 text-gray-700 shadow-sm"
            )}
          >
            {config.pageMargins.right}px
          </div>
        )}
      </div>
    </>
  );
}
