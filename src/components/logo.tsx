import Image from "next/image";
import Link from "next/link";

export function Logo({
  size = 36,
  linkTo,
}: {
  size?: number;
  linkTo?: string;
}) {
  const content = (
    <div className="flex items-center gap-2">
      <Image
        src="/logo.png"
        alt="GARBINBET"
        width={size}
        height={size}
        className="rounded"
      />
      <span className="font-heading text-2xl tracking-wide">
        <span className="text-[var(--brand-white)]">GARBIN</span>
        <span className="text-[var(--brand-green)]">BET</span>
      </span>
    </div>
  );

  if (linkTo) {
    return <Link href={linkTo}>{content}</Link>;
  }
  return content;
}
