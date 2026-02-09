import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";

interface GameDropdownOption {
  value: string;
  label: string;
}

interface GameDropdownProps {
  value: string;
  onValueChange: (value: string) => void;
  options: GameDropdownOption[];
  placeholder?: string;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

export function GameDropdown({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className,
  onOpenChange,
}: GameDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find((opt) => opt.value === value);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    onOpenChange?.(isOpen);
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          className={`game-nav-btn-sm flex items-center justify-between ${className || ""}`}
          aria-expanded={open}
        >
          <span className={`truncate ${!selectedOption ? "text-white/50" : ""}`}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="game-select-content z-50 min-w-[var(--radix-popover-trigger-width)]"
          sideOffset={4}
          align="start"
        >
          {options.map((option) => (
            <button
              key={option.value}
              className="dropdown-item w-full text-left"
              data-state={value === option.value ? "checked" : "unchecked"}
              onClick={() => onValueChange(option.value)}
            >
              {option.label}
              <span className="game-switch-indicator" />
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

