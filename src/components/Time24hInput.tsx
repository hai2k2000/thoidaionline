"use client";

import type { FocusEvent, InputEvent, InputHTMLAttributes, InvalidEvent } from "react";
import { TIME_24H_ERROR_MESSAGE, TIME_24H_PATTERN, isValidTime24h } from "@/lib/time24h.mjs";

type Time24hInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "pattern" | "maxLength" | "onInvalid" | "onInput" | "onBlur"
> & Pick<InputHTMLAttributes<HTMLInputElement>, "onInvalid" | "onInput" | "onBlur">;

function validate(element: HTMLInputElement) {
  const invalid = element.value.length > 0 && !isValidTime24h(element.value);
  element.setCustomValidity(invalid ? TIME_24H_ERROR_MESSAGE : "");
}

export default function Time24hInput({ onInvalid, onInput, onBlur, ...props }: Time24hInputProps) {
  const handleInvalid = (event: InvalidEvent<HTMLInputElement>) => {
    validate(event.currentTarget);
    onInvalid?.(event);
  };
  const handleInput = (event: InputEvent<HTMLInputElement>) => {
    validate(event.currentTarget);
    onInput?.(event);
  };
  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    validate(event.currentTarget);
    onBlur?.(event);
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
      onBlur={handleBlur}
    />
  );
}
