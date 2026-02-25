import spinnerVideo from "@assets/Logo-Spinner-Animation-Feb-25-15-44-11_1772053622751.mp4";

interface LogoSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-16 h-16",
  md: "w-24 h-24",
  lg: "w-32 h-32",
};

export function LogoSpinner({ size = "md", className = "" }: LogoSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`} data-testid="logo-spinner">
      <video
        autoPlay
        loop
        muted
        playsInline
        className={`${sizeMap[size]} object-contain`}
      >
        <source src={spinnerVideo} type="video/mp4" />
      </video>
    </div>
  );
}

export function PageLoader({ title }: { title?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <LogoSpinner size="lg" />
      {title && <p className="text-sm text-muted-foreground animate-pulse">{title}</p>}
    </div>
  );
}
