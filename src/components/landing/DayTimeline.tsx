"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { Coffee, Droplets, Eye, Moon, NotebookPen, Sunrise, Target, Trophy } from "lucide-react";

const DAY = [
  { time: "6:45 am", icon: Sunrise, color: "var(--cyan)", title: "Wake up and log your sleep", detail: "Slept 7h 10m. Felt rested, so you rate it 4 of 5." },
  { time: "7:30 am", icon: Target, color: "var(--violet)", title: "Plan today's top 3", detail: "React course, 30 pages of reading, a 5 km walk." },
  { time: "9:00 am", icon: Target, color: "var(--violet)", title: "Lock in for 50 minutes", detail: "Coding, React hooks. Rain sounds on, notifications muted." },
  { time: "9:50 am", icon: Coffee, color: "var(--rose)", title: "Break reminder", detail: "A soft chime and a breathing guide. Stand up and stretch." },
  { time: "11:15 am", icon: Droplets, color: "var(--water)", title: "Drink water", detail: "Glass 4 of 8. The water ring on your dashboard ticks up." },
  { time: "3:30 pm", icon: Eye, color: "var(--amber)", title: "Rest your eyes", detail: "Look 20 feet away for 20 seconds. A small countdown helps." },
  { time: "9:30 pm", icon: NotebookPen, color: "var(--mint)", title: "Reflect on the day", detail: "What went well, what to change, and tomorrow's plan." },
  { time: "10:30 pm", icon: Trophy, color: "var(--violet)", title: "Your day locks in", detail: "Score 92. The lock snaps shut and your streak grows to 13." },
  { time: "11:00 pm", icon: Moon, color: "var(--cyan)", title: "Wind down", detail: "Sleep reminder. Phones down, tomorrow starts tonight." },
];

export default function DayTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  return (
    <section id="day" className="scroll-mt-24 px-4 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">A day with LockIn</h2>
            <p className="mt-5 max-w-sm text-lg leading-relaxed text-muted">
              You log as you go, LockIn reminds you when it matters, and at night you see exactly how your day went.
            </p>
          </div>

          <div ref={ref} className="relative pl-10">
            {/* the line fills as you scroll through the day */}
            <div className="absolute bottom-3 left-[15px] top-3 w-[2px] rounded-full bg-line" />
            <motion.div
              className="absolute left-[15px] top-3 w-[2px] origin-top rounded-full"
              style={{ scaleY: fill, height: "calc(100% - 24px)", background: "linear-gradient(var(--cyan), var(--violet), var(--amber))" }}
            />
            <ol className="space-y-9">
              {DAY.map((d) => (
                <motion.li
                  key={d.time + d.title}
                  initial={{ opacity: 0.25 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ margin: "-35% 0px -45% 0px" }}
                  transition={{ duration: 0.4 }}
                  className="relative"
                >
                  <span
                    className="absolute -left-10 top-0.5 grid h-8 w-8 place-items-center rounded-full border border-line bg-bg"
                    style={{ color: d.color }}
                  >
                    <d.icon size={15} />
                  </span>
                  <p className="text-sm tabular-nums text-muted">{d.time}</p>
                  <p className="mt-1 font-display text-xl font-semibold">{d.title}</p>
                  <p className="mt-1 max-w-lg text-muted">{d.detail}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
