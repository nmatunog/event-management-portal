import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Upload } from "lucide-react";
import { reencodeImageDataUrlAsJpeg } from "../lib/imageCompress";

const SIGNATURE_MAX_SIDE = 520;

/** Capture supplier signature via canvas draw or image upload. */
export default function SignaturePad({ value = "", onChange, disabled = false }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [mode, setMode] = useState("draw");

  const getPoint = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches?.[0]) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const emitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange?.(canvas.toDataURL("image/png"));
  }, [onChange]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onChange?.("");
  }, [onChange]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (value && value.startsWith("data:image/")) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      };
      img.src = value;
    }
  }, [value]);

  useEffect(() => {
    if (mode === "draw") initCanvas();
  }, [mode, initCanvas]);

  const startDraw = (e) => {
    if (disabled || mode !== "draw") return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    const p = getPoint(e, canvas);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const moveDraw = (e) => {
    if (!drawingRef.current || disabled || mode !== "draw") return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = getPoint(e, canvas);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const endDraw = (e) => {
    if (!drawingRef.current) return;
    e?.preventDefault?.();
    drawingRef.current = false;
    emitCanvas();
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result || "");
      const compact = await reencodeImageDataUrlAsJpeg(raw, SIGNATURE_MAX_SIDE, 0.88);
      onChange?.(compact);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode("draw")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase ${
            mode === "draw" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"
          }`}
        >
          <PenLine size={14} aria-hidden />
          Draw
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode("upload")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase ${
            mode === "upload" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"
          }`}
        >
          <Upload size={14} aria-hidden />
          Upload
        </button>
        {mode === "draw" && (
          <button
            type="button"
            disabled={disabled}
            onClick={clearCanvas}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase text-slate-600"
          >
            <Eraser size={14} aria-hidden />
            Clear
          </button>
        )}
      </div>

      {mode === "draw" ? (
        <div className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            width={640}
            height={200}
            className="block w-full h-[140px] sm:h-[200px] cursor-crosshair"
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={moveDraw}
            onTouchEnd={endDraw}
          />
          <p className="px-3 py-2 text-[10px] font-semibold text-slate-400">Sign with finger or mouse in the box above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50">
            <Upload className="text-slate-400" size={28} aria-hidden />
            <span className="text-xs font-black uppercase text-slate-600">Upload signature image (PNG/JPG)</span>
            <input type="file" accept="image/*" className="sr-only" disabled={disabled} onChange={(e) => void handleUpload(e)} />
          </label>
          {value ? (
            <div className="rounded-2xl border bg-white p-4">
              <img src={value} alt="Uploaded signature preview" className="max-h-32 mx-auto object-contain" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
