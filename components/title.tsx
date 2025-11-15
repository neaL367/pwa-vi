import { cn } from "@/lib/utils";

export function Title() {
  return (
    <>
      {" "}
      <h3
        className={cn(
          `block text-[min(8vw,2.5vh)] md:text-[clamp(2.5vh,11vw,3vh)] uppercase`,
          `bg-radial-[circle_at_50%_40vh] from-[#ffd27b] via-[#df3a93] to-[#5c1663] from-0% via-[60vh] to-[100vh]`,
          `text-transparent bg-clip-text isolate wrap-break-word text-nowrap leading-[86%] tracking-[-.04em] md:tracking-[-.0125em]`
        )}
      >
        COMING NOVEMBER 19 2026
      </h3>
    </>
  );
}
