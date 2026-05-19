import React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[20px] bg-[color:rgba(224,229,213,0.62)]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
