"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function LogoVI() {
  const [load, setLoad] = useState(false);

  return (
    <div className="w-[clamp(20vh,25%,30vh)] h-full flex items-center justify-center">
      <Image
        src="https://www.rockstargames.com/VI/_next/static/media/vi.b9b99ab9.png"
        width={807}
        height={540}
        alt="vi logo"
        loading="eager"
        draggable="false"
        onLoad={() => setLoad(true)}
        className={cn(
          `w-full h-auto`,
          `transition-all ease-out duration-700`,
          `${load ? "blur-0 opacity-100 scale-100" : "blur-lg opacity-0 scale-95"}`
        )}
      />
    </div>
  );
}
