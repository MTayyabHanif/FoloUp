import Image from "next/image";

import { cn } from "@/lib/utils";

export interface AvatarOption {
  id: number | string;
  img: string;
}

interface Props {
  avatars: ReadonlyArray<AvatarOption>;
  selectedImage: string;
  onChange: (img: string) => void;
  disabled?: boolean;
}

export function AvatarGrid({
  avatars,
  selectedImage,
  onChange,
  disabled,
}: Props) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {avatars.map((avatar) => {
        const selected = selectedImage === avatar.img;

        return (
          <button
            key={avatar.id}
            type="button"
            aria-label={`Avatar option ${avatar.id}`}
            aria-pressed={selected}
            disabled={disabled}
            className={cn(
              "relative aspect-square overflow-hidden rounded-[20px] border bg-[#fbfdf6] transition-all",
              selected
                ? "border-[#203b14] shadow-[0_0_0_2px_rgba(32,59,20,0.12)]"
                : "border-[#dfe4d4] hover:border-[#203b14]/50",
            )}
            onClick={() => onChange(avatar.img)}
          >
            <Image
              src={avatar.img}
              alt={`Avatar ${avatar.id}`}
              sizes="96px"
              className="object-cover object-center"
              fill
            />
          </button>
        );
      })}
    </div>
  );
}
