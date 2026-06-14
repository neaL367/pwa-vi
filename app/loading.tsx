import { cn } from "@/lib/cn";
import { BG_GRADIENT } from "@/lib/constants";

export default function Loading() {
  return (
    <div className={cn("flex min-h-screen flex-col items-center justify-center font-sans", BG_GRADIENT)}>
      <div className="flex flex-col items-center gap-4 font-deco-bold">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
        <p className="text-white/60 text-sm">Loading...</p>
      </div>
    </div>
  );
}
