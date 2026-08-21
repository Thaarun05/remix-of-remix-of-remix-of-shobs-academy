import { cn } from "@/lib/utils";

interface KineticHeadlineProps {
  text: string;
  className?: string;
  /** Words rendered in the accent gradient, matched case-insensitively. */
  highlight?: string[];
  as?: "h1" | "h2";
}

/** Reveals a headline word by word with a soft rotate-and-rise. */
export const KineticHeadline = ({
  text,
  className,
  highlight = [],
  as: Tag = "h1",
}: KineticHeadlineProps) => {
  const words = text.split(" ");
  const lowered = highlight.map((w) => w.toLowerCase());

  return (
    <Tag className={cn("font-display", className)}>
      {words.map((word, i) => {
        const clean = word.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
        const isAccent = lowered.includes(clean);
        return (
          <span
            key={`${word}-${i}`}
            className={cn("kinetic-word mr-[0.28em]", isAccent && "text-gradient")}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {word}
          </span>
        );
      })}
    </Tag>
  );
};
