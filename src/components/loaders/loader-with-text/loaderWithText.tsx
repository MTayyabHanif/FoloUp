import { SpinnerProgress } from "@/components/ui/progress";

function LoaderWithText() {
  return (
    <div className="relative flex flex-col items-center justify-center h-screen">
      <SpinnerProgress
        size="xl"
        className="w-36 h-36 text-brand-bold"
        label="Loading"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-center text-lg font-medium">Loading</span>
      </div>
    </div>
  );
}

export default LoaderWithText;
