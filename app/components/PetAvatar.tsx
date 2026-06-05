// Pet avatar — shows the uploaded photo, or a clean monogram fallback.
// Replaces the old species emojis with a professional, consistent treatment.

const SIZES = {
  sm: "w-9 h-9 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-20 h-20 text-xl",
  xl: "w-28 h-28 text-3xl",
} as const;

export default function PetAvatar({
  name,
  photoUrl,
  size = "md",
  className = "",
}: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const dim = SIZES[size];
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={`${dim} rounded-full object-cover bg-slate-100 ring-1 ring-slate-200 shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full bg-slate-100 ring-1 ring-slate-200 text-slate-500 font-semibold flex items-center justify-center shrink-0 ${className}`}
      aria-hidden
    >
      {initial}
    </div>
  );
}
