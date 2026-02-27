import spinnerVideo from "@assets/Logo-Spinner-Animation-Feb-25-15-44-11_1772053622751.mp4";

interface LogoSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-20 h-20",
  md: "w-32 h-32",
  lg: "w-48 h-48",
};

export function LogoSpinner({ size = "md", className = "" }: LogoSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`} data-testid="logo-spinner">
      <video
        autoPlay
        loop
        muted
        playsInline
        className={`${sizeMap[size]} object-contain mix-blend-multiply`}
        style={{ background: "transparent" }}
      >
        <source src={spinnerVideo} type="video/mp4" />
      </video>
    </div>
  );
}

export function PageLoader({ title }: { title?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 bg-background">
      <LogoSpinner size="lg" />
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      {title && <p className="text-sm text-muted-foreground">{title}</p>}
    </div>
  );
}
