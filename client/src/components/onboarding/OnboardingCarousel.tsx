import React, { useState } from "react";
import styles from "./OnboardingCarousel.module.css";

interface Slide {
  title: string;
  description: string;
  icon: string;
  color: string;
}

const slides: Slide[] = [
  {
    title: "Welcome to RealtyFlow",
    description: "Create stunning videos from text, images, and existing video content with AI-powered generation.",
    icon: "🎬",
    color: "#003399",
  },
  {
    title: "Text-to-Video",
    description: "Transform your ideas into professional videos. Just describe what you want to see, and our AI will create it for you.",
    icon: "✍️",
    color: "#1976D2",
  },
  {
    title: "Video Editor",
    description: "Edit, refine, and polish your generated videos with our intuitive editor. Add effects, trim, and customize to perfection.",
    icon: "🎨",
    color: "#42A5F5",
  },
  {
    title: "Team Collaboration",
    description: "Work together seamlessly. Share boards with team members, comment on projects, and collaborate in real-time.",
    icon: "👥",
    color: "#64B5F6",
  },
  {
    title: "Flexible Credits",
    description: "Pay only for what you use. Purchase credits and enjoy transparent pricing with no hidden fees.",
    icon: "💳",
    color: "#81C784",
  },
];

interface OnboardingCarouselProps {
  onComplete: () => void;
}

export function OnboardingCarousel({ onComplete }: OnboardingCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const slide = slides[currentSlide];
  const progress = ((currentSlide + 1) / slides.length) * 100;

  return (
    <div className={styles.overlay}>
      <div className={styles.carousel}>
        {/* Close button */}
        <button className={styles.skipBtn} onClick={onComplete}>
          Skip
        </button>

        {/* Main content */}
        <div className={styles.content}>
          <div
            className={styles.iconContainer}
            style={{ backgroundColor: slide.color }}
          >
            <div className={styles.icon}>{slide.icon}</div>
          </div>

          <h1 className={styles.title}>{slide.title}</h1>
          <p className={styles.description}>{slide.description}</p>

          {/* Progress dots */}
          <div className={styles.dots}>
            {slides.map((_, idx) => (
              <div
                key={idx}
                className={`${styles.dot} ${
                  idx === currentSlide ? styles.active : ""
                }`}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Navigation buttons */}
        <div className={styles.buttons}>
          <button
            className={styles.prevBtn}
            onClick={handlePrev}
            disabled={currentSlide === 0}
          >
            ← Back
          </button>

          <span className={styles.counter}>
            {currentSlide + 1} / {slides.length}
          </span>

          <button className={styles.nextBtn} onClick={handleNext}>
            {currentSlide === slides.length - 1 ? "Get Started" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
