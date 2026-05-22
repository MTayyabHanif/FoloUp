import { Slider } from "@/components/ui/slider";

interface Props {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

export function TraitSlider({
  label,
  description,
  value,
  onChange,
  disabled,
}: Props) {
  return (
    <div className="rounded-[20px] border border-[#e0e5d5] bg-[#f8fbf0] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#0a1d08]">{label}</p>
          <p className="text-xs leading-5 text-[#5e6958]">{description}</p>
        </div>
        <div className="rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1 text-sm text-[#203b14]">
          {value}
        </div>
      </div>
      <Slider
        className="mt-4"
        value={[value]}
        min={1}
        max={10}
        step={1}
        disabled={disabled}
        onValueChange={(arr) => onChange(arr[0] ?? value)}
      />
    </div>
  );
}
