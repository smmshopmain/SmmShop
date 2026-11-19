"use client";

import { type PointerEvent, useEffect, useRef, useState } from "react";
import { Bot, Sparkles, X } from "lucide-react";
import { AIAssistantWorkspace } from "@/components/ai-assistant-workspace";

type Position = { x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; origin: Position; moved: boolean };

const POSITION_KEY = "smm-ai-assistant-position-v1";
const BUTTON_SIZE = 60;
const EDGE_GAP = 12;

function clampPosition(position: Position): Position {
  return {
    x: Math.max(EDGE_GAP, Math.min(position.x, window.innerWidth - BUTTON_SIZE - EDGE_GAP)),
    y: Math.max(EDGE_GAP, Math.min(position.y, window.innerHeight - BUTTON_SIZE - EDGE_GAP)),
  };
}

export function FloatingAIAssistant({ admin }: { admin: boolean }) {
  const [position, setPosition] = useState<Position | null>(null);
  const [open, setOpen] = useState(false);
  const drag = useRef<DragState | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const defaultPosition = {
        x: window.innerWidth - BUTTON_SIZE - 20,
        y: window.innerHeight - BUTTON_SIZE - 96,
      };
      let restored = defaultPosition;
      try {
        const saved = window.localStorage.getItem(POSITION_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (
            parsed &&
            typeof parsed === "object" &&
            "x" in parsed &&
            "y" in parsed &&
            typeof parsed.x === "number" &&
            typeof parsed.y === "number"
          ) {
            restored = { x: parsed.x, y: parsed.y };
          }
        }
      } catch (error) {
        console.warn("Unable to restore the AI assistant position.", error);
      }
      setPosition(clampPosition(restored));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!position) return;
    try {
      window.localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    } catch (error) {
      console.warn("Unable to save the AI assistant position.", error);
    }
  }, [position]);

  useEffect(() => {
    const keepOnScreen = () => setPosition((current) => current ? clampPosition(current) : current);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", keepOnScreen);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", keepOnScreen);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function moveButton(event: PointerEvent<HTMLButtonElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (!state.moved && Math.hypot(deltaX, deltaY) < 5) return;
    state.moved = true;
    setPosition(clampPosition({ x: state.origin.x + deltaX, y: state.origin.y + deltaY }));
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    if (!state.moved) setOpen((current) => !current);
  }

  if (!position) return null;

  return (
    <>
      <section
        role="dialog"
        aria-label={admin ? "Admin AI assistant" : "AI assistant"}
        aria-hidden={!open}
        className={`${open ? "fixed" : "hidden"} inset-x-3 bottom-[5.5rem] z-[70] h-[min(72dvh,38rem)] sm:inset-x-auto sm:bottom-20 sm:right-5 sm:w-[min(28rem,calc(100vw-2.5rem))]`}
      >
        <AIAssistantWorkspace admin={admin} compact active={open} />
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close AI assistant"
          tabIndex={open ? 0 : -1}
          className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-lg border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
        >
          <X className="size-4" />
        </button>
      </section>
      <button
        ref={button}
        type="button"
        aria-label={open ? "Close AI assistant" : "Open AI assistant; drag or use Shift and arrow keys to move"}
        aria-expanded={open}
        title="AI assistant · drag to move"
        className="fixed z-[80] grid size-[60px] touch-none cursor-grab select-none place-items-center rounded-full border border-white/20 bg-gradient-to-br from-teal-700 via-teal-800 to-slate-950 text-white shadow-[0_12px_35px_rgba(4,47,46,0.38)] transition-transform hover:scale-105 active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-500"
        style={{ left: position.x, top: position.y }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            origin: position,
            moved: false,
          };
        }}
        onPointerMove={moveButton}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onKeyDown={(event) => {
          if (!event.shiftKey || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
          event.preventDefault();
          const movement = event.altKey ? 48 : 16;
          setPosition(clampPosition({
            x: position.x + (event.key === "ArrowLeft" ? -movement : event.key === "ArrowRight" ? movement : 0),
            y: position.y + (event.key === "ArrowUp" ? -movement : event.key === "ArrowDown" ? movement : 0),
          }));
        }}
        onClick={(event) => {
          if (event.detail === 0) setOpen((current) => !current);
        }}
      >
        {open ? <Bot className="size-6" /> : <Sparkles className="size-6 motion-safe:animate-pulse" />}
        <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-emerald-400" aria-hidden="true" />
      </button>
    </>
  );
}
