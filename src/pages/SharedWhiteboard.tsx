import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";

interface WhiteboardData {
  title: string;
  image_data: string;
  updated_at: string;
}

const SharedWhiteboard = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<WhiteboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No share token provided.");
      setLoading(false);
      return;
    }

    const fetchBoard = async () => {
      const { data, error: fetchError } = await (supabase.from("whiteboards" as any))
        .select("title, image_data, updated_at")
        .eq("share_token", token)
        .is("deleted_at", null)
        .single();

      if (fetchError || !data) {
        setError("Whiteboard not found or link has expired.");
        setLoading(false);
        return;
      }

      setBoard(data as unknown as WhiteboardData);

      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, 1400, 900);
          ctx.drawImage(img, 0, 0);
          setLoading(false);
        };
        img.src = (data as any).image_data;
      }
    };

    fetchBoard();
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar showAboutLink={true} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {error ? (
          <div className="text-center py-20">
            <p className="text-lg text-muted-foreground">{error}</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground">{board?.title || "Whiteboard"}</h1>
              <span className="text-sm text-muted-foreground">Read-only view</span>
            </div>
            <div className="relative overflow-auto rounded-xl border border-border bg-muted/30 shadow-inner">
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={1400}
                height={900}
                className="block max-w-full h-auto"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SharedWhiteboard;
