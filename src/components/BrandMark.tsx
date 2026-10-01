import { siApple, siDell, siMeta, siNetflix, siNvidia, siTesla } from "simple-icons";

/**
 * Company marks, used only to say where a purchase was made. They are
 * contextual identifiers, not partnership or sponsorship badges.
 */
const PATHS: Record<string, string> = {
  apple: siApple.path,
  nvidia: siNvidia.path,
  tesla: siTesla.path,
  meta: siMeta.path,
  dell: siDell.path,
  netflix: siNetflix.path,
};

export function BrandMark({ company, className }: { company: string; className?: string }) {
  const path = PATHS[company];
  if (!path) return null;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
