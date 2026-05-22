import type { ReactNode } from "react";

interface Props {
  title: string;
  description: string;
  children: ReactNode;
}

export function Fieldset({ title, description, children }: Props) {
  return (
    <section className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-5 md:p-6">
      <div className="mb-5 space-y-2">
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#0a1d08]">
          {title}
        </h3>
        <p className="text-sm leading-6 text-[#42513d]">{description}</p>
      </div>
      {children}
    </section>
  );
}
