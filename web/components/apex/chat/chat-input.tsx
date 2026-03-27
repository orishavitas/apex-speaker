"use client";

import { useRef, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSubmit, isLoading, placeholder }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) onSubmit();
    }
  }

  return (
    <div className="flex gap-2 items-end border border-zinc-800 rounded-lg bg-zinc-900 p-2 focus-within:border-zinc-600 transition-colors">
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Ask the Project Manager…"}
        rows={1}
        className="flex-1 min-h-[36px] max-h-48 resize-none bg-transparent border-0 shadow-none focus-visible:ring-0 text-sm text-zinc-100 placeholder:text-zinc-600 py-1.5"
        disabled={isLoading}
      />
      <Button
        onClick={onSubmit}
        disabled={!value.trim() || isLoading}
        size="sm"
        className="shrink-0 h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono disabled:opacity-40"
      >
        {isLoading ? "…" : "Send"}
      </Button>
    </div>
  );
}
