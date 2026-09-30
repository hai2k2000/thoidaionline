"use client";

import type { ChangeEvent, FocusEvent, InputEvent, InputHTMLAttributes, InvalidEvent, KeyboardEvent } from "react";
import {
  TIME_24H_ERROR_MESSAGE,
  TIME_24H_PATTERN,
  formatTime24hInput,
  isValidTime24h,
  time24hCaretPosition,
} from "@/lib/time24h.mjs";

type Time24hInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "pattern" | "maxLength" | "onInvalid" | "onInput" | "onBlur" | "onChange" | "onKeyDown"
> & Pick<InputHTMLAttributes<HTMLInputElement>, "onInvalid" | "onInput" | "onBlur" | "onChange" | "onKeyDown">;

function validate(element: HTMLInputElement) {
  const invalid = element.value.length > 0 && !isValidTime24h(element.value);
  element.setCustomValidity(invalid ? TIME_24H_ERROR_MESSAGE : "");
}

function format(element: HTMLInputElement) {
  const rawValue = element.value;
  const formattedValue = formatTime24hInput(rawValue);
  if (formattedValue === rawValue) return;

  const caret = time24hCaretPosition(rawValue, element.selectionStart);
  element.value = formattedValue;
  element.setSelectionRange(caret, caret);
  queueMicrotask(() => {
    if (document.activeElement === element) element.setSelectionRange(caret, caret);
  });
}

export default function Time24hInput({ onInvalid, onInput, onBlur, onChange, onKeyDown, ...props }: Time24hInputProps) {
  const handleInvalid = (event: InvalidEvent<HTMLInputElement>) => {
    validate(event.currentTarget);
    onInvalid?.(event);
  };
  const handleInput = (event: InputEvent<HTMLInputElement>) => {
    format(event.currentTarget);
    validate(event.currentTarget);
    onInput?.(event);
  };
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    format(event.currentTarget);
    validate(event.currentTarget);
    onChange?.(event);
  };
  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    format(event.currentTarget);
    validate(event.currentTarget);
    onBlur?.(event);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const element = event.currentTarget;
    if (element.selectionStart === element.selectionEnd) {
      const caret = element.selectionStart ?? 0;
      if (event.key === "Backspace" && caret > 0 && element.value[caret - 1] === ":") {
        element.setSelectionRange(Math.max(0, caret - 2), Math.max(0, caret - 1));
      } else if (event.key === "Delete" && element.value[caret] === ":") {
        element.setSelectionRange(Math.min(element.value.length, caret + 1), Math.min(element.value.length, caret + 2));
      }
    }
    onKeyDown?.(event);
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      placeholder={props.placeholder ?? "HH:mm"}
      pattern={TIME_24H_PATTERN}
      maxLength={5}
      title={TIME_24H_ERROR_MESSAGE}
      onInvalid={handleInvalid}
      onInput={handleInput}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
