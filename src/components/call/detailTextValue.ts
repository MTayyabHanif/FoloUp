import React from "react";

type DetailTextValueProps = {
  className?: string;
  fallback: React.ReactNode;
  value: string | undefined;
};

export const DetailTextValue = ({
  className,
  fallback,
  value,
}: DetailTextValueProps) => {
  if (value === undefined) {
    return React.createElement("div", { className }, fallback);
  }

  return React.createElement("p", { className }, value);
};
