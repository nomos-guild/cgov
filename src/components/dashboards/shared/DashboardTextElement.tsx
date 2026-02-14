import { useRef, useCallback, useState, useEffect } from "react";
import { GripVertical, X, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import type { TextElement } from "@/types/dashboard";
import { TEXT_ELEMENT_CONSTRAINTS } from "@/types/dashboard";

interface DashboardTextElementProps {
  element: TextElement;
  isActive?: boolean;
  isSelected?: boolean;
  onActivate: (e?: React.MouseEvent) => void;
  onDrag: (deltaX: number, deltaY: number) => void;
  onResize: (deltaWidth: number, deltaHeight: number, direction: string) => void;
  onTextChange: (text: string) => void;
  onFontSizeChange: (fontSize: number) => void;
  onRemove: () => void;
}

export function DashboardTextElement({
  element,
  isActive,
  isSelected,
  onActivate,
  onDrag,
  onResize,
  onTextChange,
  onFontSizeChange,
  onRemove,
}: DashboardTextElementProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeTheme } = useTheme();
  const isDark = activeTheme.isDark;
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [localText, setLocalText] = useState(element.text);

  // Sync local text with element text
  useEffect(() => {
    setLocalText(element.text);
  }, [element.text]);

  // Focus input when newly created (empty text)
  useEffect(() => {
    if (element.text === "" && inputRef.current) {
      setIsEditing(true);
      inputRef.current.focus();
    }
  }, [element.text]);

  // Handle drag
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      onActivate();

      const startX = e.clientX;
      const startY = e.clientY;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        onDrag(deltaX, deltaY);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onDrag, onActivate]
  );

  // Handle resize
  const handleResizeStart = useCallback(
    (direction: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      onActivate();

      const startX = e.clientX;
      const startY = e.clientY;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        onResize(deltaX, deltaY, direction);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize, onActivate]
  );

  const handleClick = useCallback((e: React.MouseEvent) => {
    onActivate(e);
  }, [onActivate]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    onTextChange(localText);
  }, [localText, onTextChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        setIsEditing(false);
        onTextChange(localText);
      }
      if (e.key === "Escape") {
        setIsEditing(false);
        setLocalText(element.text);
      }
    },
    [localText, element.text, onTextChange]
  );

  const handleDecreaseFontSize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const newSize = Math.max(
        TEXT_ELEMENT_CONSTRAINTS.minFontSize,
        (element.fontSize || TEXT_ELEMENT_CONSTRAINTS.defaultFontSize) - TEXT_ELEMENT_CONSTRAINTS.fontSizeStep
      );
      onFontSizeChange(newSize);
    },
    [element.fontSize, onFontSizeChange]
  );

  const handleIncreaseFontSize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const newSize = Math.min(
        TEXT_ELEMENT_CONSTRAINTS.maxFontSize,
        (element.fontSize || TEXT_ELEMENT_CONSTRAINTS.defaultFontSize) + TEXT_ELEMENT_CONSTRAINTS.fontSizeStep
      );
      onFontSizeChange(newSize);
    },
    [element.fontSize, onFontSizeChange]
  );

  const fontSize = element.fontSize || TEXT_ELEMENT_CONSTRAINTS.defaultFontSize;

  return (
    <div
      ref={elementRef}
      className="absolute group rounded-lg"
      style={{
        width: `${element.width}px`,
        height: `${element.height}px`,
        transform: `translate(${element.x}px, ${element.y}px)`,
        willChange: isDragging || isResizing ? "transform" : "auto",
        zIndex: isActive ? 50 : isSelected ? 10 : 1,
        transition: isDragging || isResizing ? "none" : "box-shadow 0.2s",
        ...(isSelected && {
          animation: "selection-glow 1.5s ease-in-out infinite",
          boxShadow: isDark
            ? "0 0 8px rgba(11, 209, 162, 0.6), 0 0 16px rgba(11, 209, 162, 0.4), 0 0 24px rgba(11, 209, 162, 0.2)"
            : "0 0 8px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 0, 0, 0.35), 0 0 24px rgba(0, 0, 0, 0.2)",
        }),
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      data-text-element
    >
      {/* Container with border on hover */}
      <div
        className={cn(
          "h-full w-full rounded-lg border transition-colors flex items-center px-3",
          isDark
            ? "border-transparent group-hover:border-[#0bd1a2]/30 bg-transparent"
            : "border-transparent group-hover:border-gray-300 bg-transparent",
          isEditing && (isDark ? "border-[#0bd1a2]/50" : "border-gray-400")
        )}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Enter title..."
            style={{ fontSize: `${fontSize}px` }}
            className={cn(
              "w-full bg-transparent outline-none font-semibold",
              isDark
                ? "text-[#0bd1a2] placeholder-[#0bd1a2]/40"
                : "text-gray-900 placeholder-gray-400"
            )}
          />
        ) : (
          <span
            style={{ fontSize: `${fontSize}px` }}
            className={cn(
              "font-semibold truncate",
              isDark ? "text-[#0bd1a2]" : "text-gray-900",
              !localText && (isDark ? "text-[#0bd1a2]/40" : "text-gray-400")
            )}
          >
            {localText || "Double-click to edit..."}
          </span>
        )}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={handleDragStart}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 left-1 z-20 p-1 rounded cursor-grab active:cursor-grabbing transition-opacity opacity-0 group-hover:opacity-100",
          isDark
            ? "bg-black/70 hover:bg-black/90 text-[#0bd1a2]"
            : "bg-white/90 hover:bg-white text-gray-600 shadow-sm"
        )}
        aria-label="Drag to move"
      >
        <GripVertical className="h-3 w-3" />
      </div>

      {/* Font size controls */}
      <div
        className={cn(
          "absolute -top-7 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-1 py-0.5 rounded transition-opacity opacity-0 group-hover:opacity-100",
          isDark ? "bg-black/80" : "bg-white/95 shadow-sm"
        )}
      >
        <button
          onClick={handleDecreaseFontSize}
          disabled={fontSize <= TEXT_ELEMENT_CONSTRAINTS.minFontSize}
          className={cn(
            "p-0.5 rounded transition-colors",
            isDark
              ? "text-[#0bd1a2] hover:bg-[#0bd1a2]/20 disabled:text-[#0bd1a2]/30"
              : "text-gray-600 hover:bg-gray-200 disabled:text-gray-300"
          )}
          aria-label="Decrease font size"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span
          className={cn(
            "text-xs min-w-[24px] text-center",
            isDark ? "text-[#0bd1a2]" : "text-gray-600"
          )}
        >
          {fontSize}
        </span>
        <button
          onClick={handleIncreaseFontSize}
          disabled={fontSize >= TEXT_ELEMENT_CONSTRAINTS.maxFontSize}
          className={cn(
            "p-0.5 rounded transition-colors",
            isDark
              ? "text-[#0bd1a2] hover:bg-[#0bd1a2]/20 disabled:text-[#0bd1a2]/30"
              : "text-gray-600 hover:bg-gray-200 disabled:text-gray-300"
          )}
          aria-label="Increase font size"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 right-1 z-20 p-1 rounded transition-opacity opacity-0 group-hover:opacity-100",
          isDark
            ? "bg-black/70 hover:bg-red-500/80 text-[#0bd1a2] hover:text-white"
            : "bg-white/90 hover:bg-red-500 text-gray-600 hover:text-white shadow-sm"
        )}
        aria-label="Remove title"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Resize handle - East (right) */}
      <div
        onMouseDown={handleResizeStart("e")}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-8 cursor-ew-resize z-30 opacity-0 group-hover:opacity-100 transition-opacity rounded",
          isDark ? "hover:bg-[#0bd1a2]/50" : "hover:bg-blue-500/50"
        )}
      />

      {/* Resize handle - West (left) */}
      <div
        onMouseDown={handleResizeStart("w")}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-8 cursor-ew-resize z-30 opacity-0 group-hover:opacity-100 transition-opacity rounded",
          isDark ? "hover:bg-[#0bd1a2]/50" : "hover:bg-blue-500/50"
        )}
      />
    </div>
  );
}
