import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Eraser, Check } from "lucide-react";
import SignaturePadLib from "signature_pad";

interface Props {
  onSign: (data: SignatureData) => void;
  signerName?: string;
  initialData?: SignatureData | null;
}

export interface SignatureData {
  imageDataUrl: string;
  method: "drawn" | "typed";
  signerName: string;
  timestamp: string;
}

const CURSIVE_FONTS = [
  "'Dancing Script', cursive",
  "'Great Vibes', cursive",
  "'Satisfy', cursive",
];

export function SignaturePad({ onSign, signerName = "", initialData }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [mode, setMode] = useState<"draw" | "type">(initialData?.method === "typed" ? "type" : "draw");
  const [typedName, setTypedName] = useState(initialData?.signerName || signerName);
  const [selectedFont, setSelectedFont] = useState(0);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (canvasRef.current && !padRef.current) {
      const canvas = canvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);

      padRef.current = new SignaturePadLib(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      });

      padRef.current.addEventListener("endStroke", () => {
        setIsEmpty(padRef.current?.isEmpty() ?? true);
      });
    }

    return () => {
      if (padRef.current) {
        padRef.current.off();
        padRef.current = null;
      }
    };
  }, []);

  const clearDrawn = useCallback(() => {
    padRef.current?.clear();
    setIsEmpty(true);
  }, []);

  const handleConfirm = useCallback(() => {
    let imageDataUrl = "";
    const name = mode === "type" ? typedName : signerName;

    if (mode === "draw" && padRef.current && !padRef.current.isEmpty()) {
      imageDataUrl = padRef.current.toDataURL("image/png");
    } else if (mode === "type" && typedName.trim()) {
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 150;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 600, 150);
        ctx.font = `48px ${CURSIVE_FONTS[selectedFont]}`;
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "middle";
        ctx.fillText(typedName, 20, 75);
        imageDataUrl = canvas.toDataURL("image/png");
      }
    }

    if (!imageDataUrl) return;

    onSign({
      imageDataUrl,
      method: mode === "draw" ? "drawn" : "typed",
      signerName: name || "Unknown",
      timestamp: new Date().toISOString(),
    });
  }, [mode, typedName, signerName, selectedFont, onSign]);

  const canConfirm = mode === "draw" ? !isEmpty : typedName.trim().length > 0;

  return (
    <div className="space-y-3" data-testid="signature-pad-container">
      <link
        href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Satisfy&display=swap"
        rel="stylesheet"
      />

      <Tabs value={mode} onValueChange={(v) => setMode(v as "draw" | "type")}>
        <TabsList className="w-full">
          <TabsTrigger value="draw" className="flex-1" data-testid="tab-draw-signature">
            Draw
          </TabsTrigger>
          <TabsTrigger value="type" className="flex-1" data-testid="tab-type-signature">
            Type
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-3">
          <div className="border rounded-lg bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair"
              style={{ height: 150, touchAction: "none" }}
              data-testid="canvas-signature"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <Button variant="ghost" size="sm" onClick={clearDrawn} data-testid="button-clear-signature">
              <Eraser className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
            <p className="text-xs text-muted-foreground">Draw your signature above</p>
          </div>
        </TabsContent>

        <TabsContent value="type" className="mt-3 space-y-3">
          <div>
            <Label className="text-xs">Full Legal Name</Label>
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Enter your full name"
              data-testid="input-typed-signature"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Signature Style</Label>
            <div className="grid grid-cols-3 gap-2">
              {CURSIVE_FONTS.map((font, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedFont(i)}
                  className={`p-3 border rounded-lg text-center bg-white transition-colors ${
                    selectedFont === i ? "ring-2 ring-primary border-primary" : "hover:bg-muted/50"
                  }`}
                  data-testid={`button-font-${i}`}
                >
                  <span style={{ fontFamily: font, fontSize: 20, color: "#000" }}>
                    {typedName || "Your Name"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
        <p>By signing, you confirm that this electronic signature is legally binding under Canada's Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable provincial electronic commerce legislation.</p>
        <p>Timestamp and signer identity will be recorded for audit purposes.</p>
      </div>

      <Button onClick={handleConfirm} disabled={!canConfirm} className="w-full" data-testid="button-confirm-signature">
        <Check className="h-4 w-4 mr-2" />
        Apply Signature
      </Button>
    </div>
  );
}
