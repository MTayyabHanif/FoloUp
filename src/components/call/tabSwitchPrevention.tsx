import { type MutableRefObject, useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Tab-switch detection hook.
 *
 * Optional `isSuppressionActive` ref lets the caller temporarily suppress
 * the increment + warning dialog — used by the proctoring flow during the
 * getDisplayMedia screen-share picker (which fires its own
 * `visibilitychange → hidden` and would otherwise trigger a false-positive
 * tab switch). The caller flips the ref to `true` before invoking the
 * picker and clears it inside `setTimeout(...,0)` from the picker's
 * then/catch, so the cleared value outlives the picker-close visibility
 * event. See openspec add-interview-proctoring-camera-screen design.md §3.
 */
const useTabSwitchPrevention = (
  isSuppressionActive?: MutableRefObject<boolean>,
) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isSuppressionActive?.current) {
          return;
        }
        setIsDialogOpen(true);
        setTabSwitchCount((prev) => prev + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSuppressionActive]);

  const handleUnderstand = () => {
    setIsDialogOpen(false);
  };

  return { isDialogOpen, tabSwitchCount, handleUnderstand };
};

interface TabSwitchWarningProps {
  open: boolean;
  onUnderstand: () => void;
  count: number;
}

function TabSwitchWarning({
  open,
  onUnderstand,
  count,
}: TabSwitchWarningProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="border-[#c5ccb6] bg-[#fbfdf6] text-[#0a1d08]">
        <AlertDialogHeader className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#e0e5d5] bg-[#d7e8b5]/45 text-[#203b14]">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="space-y-2 text-center">
            <AlertDialogTitle className="text-2xl font-semibold tracking-[-0.04em] text-[#0a1d08]">
              Stay on this interview tab
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-6 text-[#31200b]/78">
              Switching tabs or apps is recorded for interview integrity. If
              you need to recover from a connectivity issue, return here and
              continue from the same session.
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        <div className="rounded-[20px] border border-[#e0e5d5] bg-white/75 p-4 text-sm leading-6 text-[#31200b]/80">
          <div className="flex items-center gap-2 font-medium text-[#203b14]">
            <AlertTriangle className="h-4 w-4" />
            Focus signal
          </div>
          <p className="mt-2">
            Tab switches recorded in this session: <strong>{count}</strong>
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction
            className="w-full rounded-full border border-[#4a3212] bg-[#4a3212] text-[#fbfdf6] hover:bg-[#31200b]"
            onClick={onUnderstand}
          >
            I understand
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { TabSwitchWarning, useTabSwitchPrevention };
