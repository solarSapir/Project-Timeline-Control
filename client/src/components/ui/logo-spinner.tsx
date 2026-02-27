import { motion } from "framer-motion";

const RAY_COUNT = 12;

const sizeConfig = {
  sm: { container: "w-24 h-24", logo: "w-12 h-12", leaf: 28, rayW: "w-1", rayH: "h-4" },
  md: { container: "w-40 h-40", logo: "w-20 h-20", leaf: 44, rayW: "w-1.5", rayH: "h-6" },
  lg: { container: "w-64 h-64", logo: "w-32 h-32", leaf: 72, rayW: "w-2", rayH: "h-8" },
};

function MapleLeaf({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 4 L34 16 L42 10 L38 20 L50 18 L40 26 L52 30 L40 32 L46 42 L36 36 L36 52 L32 44 L28 52 L28 36 L18 42 L24 32 L12 30 L24 26 L14 18 L26 20 L22 10 L30 16 Z" />
      <rect x="30" y="48" width="4" height="12" rx="1" />
    </svg>
  );
}

interface LogoSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LogoSpinner({ size = "md", className = "" }: LogoSpinnerProps) {
  const cfg = sizeConfig[size];

  return (
    <motion.div
      className={`relative flex items-center justify-center ${cfg.container} ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="logo-spinner"
    >
      {Array.from({ length: RAY_COUNT }).map((_, i) => {
        const rotation = (i * 360) / RAY_COUNT;
        return (
          <div
            key={i}
            className="absolute inset-0 flex items-start justify-center"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <motion.div
              className={`${cfg.rayW} ${cfg.rayH} rounded-full bg-gradient-to-b from-yellow-400 to-orange-500 shadow-[0_0_15px_rgba(250,204,21,0.5)]`}
              animate={{
                y: [-15, 5, -15],
                scaleY: [1, 0.7, 1],
                opacity: [1, 0.5, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.1,
              }}
            />
          </div>
        );
      })}

      <motion.div
        className={`relative z-10 ${cfg.logo} flex items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.4)]`}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <MapleLeaf size={cfg.leaf} />
      </motion.div>
    </motion.div>
  );
}

export function PageLoader({ title }: { title?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-background">
      <LogoSpinner size="lg" />
      <motion.div
        className="flex flex-col items-center space-y-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      >
        <div className="flex space-x-1">
          <motion.div
            className="w-2 h-2 rounded-full bg-orange-500"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="w-2 h-2 rounded-full bg-yellow-400"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
          />
          <motion.div
            className="w-2 h-2 rounded-full bg-orange-400"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
          />
        </div>
        {title && (
          <motion.span
            className="text-muted-foreground font-mono text-sm tracking-[0.2em] uppercase"
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {title}
          </motion.span>
        )}
      </motion.div>
    </div>
  );
}
