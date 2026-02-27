import { motion } from "framer-motion";

export function LoadingSpinnerScene() {
  const RAY_COUNT = 12;

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-transparent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="relative flex items-center justify-center w-64 h-64 mb-12">
        {/* Sun Rays */}
        {Array.from({ length: RAY_COUNT }).map((_, i) => {
          const rotation = (i * 360) / RAY_COUNT;
          return (
            <div
              key={i}
              className="absolute inset-0 flex items-start justify-center"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <motion.div
                className="w-2 h-8 rounded-full bg-gradient-to-b from-yellow-400 to-orange-500 shadow-[0_0_15px_rgba(250,204,21,0.5)]"
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

        {/* The Logo (Maple Leaf) */}
        <motion.div
          className="relative z-10 w-32 h-32 flex items-center justify-center rounded-full overflow-hidden bg-transparent shadow-[0_0_30px_rgba(249,115,22,0.4)]"
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <img
            src="/assets/maple_leaf_logo.png"
            alt="Logo"
            className="absolute max-w-none w-[260%] h-[260%] object-cover"
          />
        </motion.div>
      </div>

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
        <motion.span
          className="text-white/60 font-mono text-sm tracking-[0.2em] uppercase"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          Loading
        </motion.span>
      </motion.div>
    </motion.div>
  );
}
