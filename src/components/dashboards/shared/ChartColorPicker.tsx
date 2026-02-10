import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Convert HSV to RGB
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

// Convert RGB to HSV
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }

  return [h, s, v];
}

// Parse hex color to RGBA
function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: result[4] ? parseInt(result[4], 16) / 255 : 1,
    };
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

// Convert RGBA to hex (with alpha)
function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  if (a < 1) {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(Math.round(a * 255))}`;
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface ChartColorPickerProps {
  isOpen: boolean;
  position: { x: number; y: number };
  currentColor: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
  label?: string;
}

export function ChartColorPicker({
  isOpen,
  position,
  currentColor,
  onColorSelect,
  onClose,
  label,
}: ChartColorPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Parse initial color
  const initialRgba = hexToRgba(currentColor);
  const initialHsv = rgbToHsv(initialRgba.r, initialRgba.g, initialRgba.b);

  const [hue, setHue] = useState(initialHsv[0]);
  const [saturation, setSaturation] = useState(initialHsv[1]);
  const [value, setValue] = useState(initialHsv[2]);
  const [opacity, setOpacity] = useState(initialRgba.a);
  const [isDraggingWheel, setIsDraggingWheel] = useState(false);
  const [hexInput, setHexInput] = useState(currentColor);

  // Update internal state when currentColor changes
  useEffect(() => {
    const rgba = hexToRgba(currentColor);
    const hsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
    setHue(hsv[0]);
    setSaturation(hsv[1]);
    setValue(hsv[2]);
    setOpacity(rgba.a);
    setHexInput(currentColor);
  }, [currentColor]);

  // Compute current RGB
  const rgb = hsvToRgb(hue, saturation, value);

  // Notify parent of color changes
  const notifyColorChange = useCallback((h: number, s: number, v: number, a: number) => {
    const newRgb = hsvToRgb(h, s, v);
    const newHex = rgbaToHex(newRgb[0], newRgb[1], newRgb[2], a);
    onColorSelect(newHex);
    setHexInput(newHex);
  }, [onColorSelect]);

  // Adjust position to keep picker in viewport
  useEffect(() => {
    if (isOpen && pickerRef.current) {
      const rect = pickerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = position.x;
      let newY = position.y;

      if (position.x + rect.width > viewportWidth - 20) {
        newX = viewportWidth - rect.width - 20;
      }
      if (newX < 20) newX = 20;

      if (position.y + rect.height > viewportHeight - 20) {
        newY = position.y - rect.height - 10;
      }
      if (newY < 20) newY = 20;

      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [isOpen, position]);

  // Close on click outside or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Handle color wheel interaction
  const handleWheelInteraction = useCallback((clientX: number, clientY: number) => {
    if (!wheelRef.current) return;

    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate hue from angle (0-360)
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = (angle + 360) % 360;

    // Calculate saturation from distance (0-1)
    const sat = Math.min(distance / radius, 1);

    setHue(angle);
    setSaturation(sat);
    notifyColorChange(angle, sat, value, opacity);
  }, [value, opacity, notifyColorChange]);

  // Mouse handlers for wheel
  const handleWheelMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingWheel(true);
    handleWheelInteraction(e.clientX, e.clientY);
  }, [handleWheelInteraction]);

  useEffect(() => {
    if (!isDraggingWheel) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleWheelInteraction(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      setIsDraggingWheel(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingWheel, handleWheelInteraction]);

  // Handle brightness/value slider
  const handleValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setValue(newValue);
    notifyColorChange(hue, saturation, newValue, opacity);
  }, [hue, saturation, opacity, notifyColorChange]);

  // Handle opacity slider
  const handleOpacityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseFloat(e.target.value);
    setOpacity(newOpacity);
    notifyColorChange(hue, saturation, value, newOpacity);
  }, [hue, saturation, value, notifyColorChange]);

  // Handle hex input
  const handleHexInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);

    // Validate and apply hex color
    if (/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(val)) {
      const rgba = hexToRgba(val);
      const hsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
      setHue(hsv[0]);
      setSaturation(hsv[1]);
      setValue(hsv[2]);
      setOpacity(rgba.a);
      onColorSelect(val);
    }
  }, [onColorSelect]);

  if (!isOpen) return null;

  // Calculate selector position on wheel
  const selectorX = Math.cos((hue * Math.PI) / 180) * saturation * 90 + 90;
  const selectorY = Math.sin((hue * Math.PI) / 180) * saturation * 90 + 90;

  const pickerContent = (
    <div
      ref={pickerRef}
      className={cn(
        "fixed z-[9999] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4",
        "animate-in fade-in-0 zoom-in-95 duration-150"
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        width: 260,
      }}
    >
      {label && (
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-3 truncate">
          {label}
        </div>
      )}

      {/* Color Wheel */}
      <div className="flex justify-center mb-4">
        <div
          ref={wheelRef}
          className="relative w-[180px] h-[180px] rounded-full cursor-crosshair select-none"
          style={{
            background: `
              linear-gradient(rgba(0,0,0,${1 - value}), rgba(0,0,0,${1 - value})),
              radial-gradient(circle, white 0%, transparent 70%),
              conic-gradient(from 90deg,
                hsl(0, 100%, 50%),
                hsl(60, 100%, 50%),
                hsl(120, 100%, 50%),
                hsl(180, 100%, 50%),
                hsl(240, 100%, 50%),
                hsl(300, 100%, 50%),
                hsl(360, 100%, 50%)
              )
            `,
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.15)",
          }}
          onMouseDown={handleWheelMouseDown}
        >
          {/* Selector dot */}
          <div
            className="absolute w-5 h-5 rounded-full border-2 border-white shadow-md pointer-events-none"
            style={{
              left: selectorX - 10,
              top: selectorY - 10,
              backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
              boxShadow: "0 0 0 1px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3)",
            }}
          />
        </div>
      </div>

      {/* Brightness Slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Brightness</label>
          <span className="text-xs text-gray-500 dark:text-gray-400">{Math.round(value * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={handleValueChange}
          className="w-full h-3 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right,
              rgb(0,0,0),
              rgb(${hsvToRgb(hue, saturation, 1).join(",")})
            )`,
          }}
        />
      </div>

      {/* Opacity Slider */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">Opacity</label>
          <span className="text-xs text-gray-500 dark:text-gray-400">{Math.round(opacity * 100)}%</span>
        </div>
        <div
          className="relative h-3 rounded-lg overflow-hidden"
          style={{
            background: `
              linear-gradient(to right,
                transparent,
                rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})
              ),
              repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px
            `,
          }}
        >
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={handleOpacityChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {/* Custom thumb indicator */}
          <div
            className="absolute top-0 bottom-0 w-3 rounded-full border-2 border-white shadow-md pointer-events-none"
            style={{
              left: `calc(${opacity * 100}% - 6px)`,
              backgroundColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`,
              boxShadow: "0 0 0 1px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.2)",
            }}
          />
        </div>
      </div>

      {/* Color Preview & Hex Input */}
      <div className="flex items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div
          className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 flex-shrink-0"
          style={{
            backgroundColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})`,
            backgroundImage: opacity < 1
              ? "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px"
              : "none",
            backgroundBlendMode: "multiply",
          }}
        >
          <div
            className="w-full h-full rounded-lg"
            style={{ backgroundColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${opacity})` }}
          />
        </div>
        <input
          type="text"
          value={hexInput}
          onChange={handleHexInputChange}
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent font-mono"
          placeholder="#ffffff"
        />
      </div>

      {/* Reset button */}
      <button
        onClick={() => {
          onColorSelect("__reset__");
          onClose();
        }}
        className="w-full mt-3 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        Reset to default
      </button>
    </div>
  );

  return createPortal(pickerContent, document.body);
}

// Hook for managing color picker state
export interface ColorPickerState {
  isOpen: boolean;
  position: { x: number; y: number };
  elementKey: string;
  currentColor: string;
  label?: string;
}

export function useColorPicker() {
  const [state, setState] = useState<ColorPickerState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    elementKey: "",
    currentColor: "#ffffff",
    label: undefined,
  });

  const openPicker = useCallback(
    (
      elementKey: string,
      currentColor: string,
      position: { x: number; y: number },
      label?: string
    ) => {
      setState({
        isOpen: true,
        position,
        elementKey,
        currentColor,
        label,
      });
    },
    []
  );

  const closePicker = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    state,
    openPicker,
    closePicker,
  };
}
