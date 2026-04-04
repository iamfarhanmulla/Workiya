"use client";

import { useEffect, useState } from "react";

const testimonials = [
  {
    title: "Optimizing workforce productivity through structural clarity.",
    description:
      "Experience the next generation of workforce intelligence with WorKiya's architectural approach to data management.",
    trusted: "Trusted by 2,000+ teams",
    avatars: ["AL", "RK", "JD"]
  },
  {
    title: "Building reliable operations around a single source of workforce truth.",
    description:
      "Unify attendance, approvals, and team structure in one connected experience designed for growing organizations.",
    trusted: "Adopted by fast-scaling teams",
    avatars: ["NS", "PM", "AR"]
  },
  {
    title: "Turning workforce data into confident daily decisions.",
    description:
      "Give managers real-time visibility into performance, staffing, and coordination without adding process overhead.",
    trusted: "Chosen by modern HR leaders",
    avatars: ["MJ", "SK", "TA"]
  }
];

export default function TestimonialSlider() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveIndex((current) => (current + 1) % testimonials.length);
    }, 3500);

    return () => clearInterval(intervalId);
  }, []);

  const activeSlide = testimonials[activeIndex];

  return (
    <>
      <div className="testimonial-slider" aria-live="polite">
        <article className="testimonial-card">
          <div className="trusted-row">
            <div className="avatar-stack" aria-hidden="true">
              {activeSlide.avatars.map((avatar, index) => (
                <span key={`${avatar}-${index}`}>{avatar}</span>
              ))}
            </div>
            <p>{activeSlide.trusted}</p>
          </div>

          <h2>{activeSlide.title}</h2>
          <p>{activeSlide.description}</p>
        </article>
      </div>

      <div className="visual-footer">
        <div className="pager" aria-label="Testimonial slides" role="tablist">
          {testimonials.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              className={index === activeIndex ? "pager-dot active" : "pager-dot"}
              aria-label={`Show testimonial ${index + 1}`}
              aria-selected={index === activeIndex}
              role="tab"
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
        <span>© 2024 WORKIYA INC.</span>
      </div>
    </>
  );
}

