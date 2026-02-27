import { motion } from 'framer-motion';

export function LoadingSpinnerScene() {
  const RAY_COUNT = 12;

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-transparent"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="relative flex items-center justify-center" style={{ width: '20vw', height: '20vw', maxWidth: '256px', maxHeight: '256px', marginBottom: '3vh' }}>
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
                  opacity: [1, 0.5, 1]
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

        {/* The Logo (Solid CSS Circle + White Maple Leaf) */}
        <motion.div
          className="relative z-10 flex items-center justify-center rounded-full bg-[#f48221] shadow-[0_0_20px_rgba(244,130,33,0.6)]"
          style={{ width: '16vw', height: '16vw', maxWidth: '128px', maxHeight: '128px' }}
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <svg 
            viewBox="0 0 512 512" 
            className="text-white"
            style={{ width: '8vw', height: '8vw', maxWidth: '64px', maxHeight: '64px' }}
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M383.8 351.7c2.5-2.5 105.2-92.4 105.2-92.4l-17.5-7.5c-10-4.9-7.4-11.5-5-17.4 2.4-7.6 20.1-67.3 20.1-67.3s-47.7 10-57.7 12.5c-7.5 2.4-10-2.5-12.5-7.5s-15-32.4-15-32.4-52.6 59.9-55.1 62.3c-10 7.5-20.1 0-17.6-10 0-10 27.6-129.6 27.6-129.6s-30.1 17.4-40.1 22.4c-7.5 5-12.6 5-17.6-5C293.5 72.3 255.9 0 255.9 0s-37.5 72.3-42.5 79.8c-5 10-10 10-17.6 5-10-5-40.1-22.4-40.1-22.4S183.3 182 183.3 192c2.5 10-7.5 17.5-17.6 10-2.5-2.5-55.1-62.3-55.1-62.3S98.1 167 95.6 172s-5 9.9-12.5 7.5C73 177 25.4 167 25.4 167s17.6 59.7 20.1 67.3c2.4 6 5 12.5-5 17.4L23 259.3s102.6 89.9 105.2 92.4c5.1 5 10 7.5 5.1 22.5-5.1 15-10.1 35.1-10.1 35.1s95.2-20.1 105.3-22.6c8.7-.9 18.3 2.5 18.3 12.5S241 512 241 512h30s-5.8-102.7-5.8-112.8 9.5-13.4 18.4-12.5c10 2.5 105.2 22.6 105.2 22.6s-5-20.1-10-35.1 0-17.5 5-22.5z"/>
          </svg>
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
