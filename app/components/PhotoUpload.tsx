"use client";

import { useRef, useState } from "react";

// Pet photo picker. Downscales the selected image to a ~512px JPEG data URL and
// stores it in a hidden input, so it submits with the surrounding form (works
// for both new and existing pets, no server upload endpoint required).
async function fileToDataUrl(file: File, max = 512): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function PhotoUpload({
  name,
  defaultValue,
  size = "md",
}: {
  name: string;
  defaultValue?: string | null;
  size?: "md" | "lg";
}) {
  const [value, setValue] = useState<string>(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const box = size === "lg" ? "w-24 h-24" : "w-16 h-16";

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      setValue(await fileToDataUrl(file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <input type="hidden" name={name} value={value} />
      <div
        className={`${box} rounded-lg bg-slate-100 ring-1 ring-slate-200 overflow-hidden flex items-center justify-center shrink-0`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Pet preview" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] text-slate-400 text-center px-1">No photo</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs font-medium text-slate-700 border border-slate-300 rounded-md px-2.5 py-1 hover:bg-slate-50 w-fit"
        >
          {busy ? "Processing…" : value ? "Change photo" : "Upload photo"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="text-xs text-slate-400 hover:text-red-600 w-fit"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
