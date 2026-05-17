import type { JSX, ParentProps } from "solid-js";
import { splitProps } from "solid-js";

type Width = "narrow" | "default" | "wide" | "full";

interface ContainerProps extends JSX.HTMLAttributes<HTMLDivElement> {
  width?: Width;
}

const widthClass: Record<Width, string> = {
  narrow: "max-w-2xl",
  default: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-none",
};

export function Container(props: ParentProps<ContainerProps>) {
  const [local, rest] = splitProps(props, ["width", "class", "children"]);
  return (
    <div
      {...rest}
      class={`mx-auto px-6 sm:px-8 w-full ${widthClass[local.width ?? "default"]} ${local.class ?? ""}`}
    >
      {local.children}
    </div>
  );
}
