(() => {
  const header = document.getElementById("header");
  const hero = document.querySelector(".hero");
  const menuToggle = document.getElementById("menuToggle");
  const nav = document.getElementById("nav");
  const form = document.getElementById("bookingForm");
  const formSuccess = document.getElementById("formSuccess");
  const glow = document.querySelector(".cursor-glow");
  const experience = document.querySelector(".experience");

  // Header scroll state
  const onScroll = () => {
    header?.classList.toggle("scrolled", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Hero ken burns ready
  requestAnimationFrame(() => hero?.classList.add("is-ready"));

  // Mobile menu
  menuToggle?.addEventListener("click", () => {
    const open = nav?.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(Boolean(open)));
    document.body.style.overflow = open ? "hidden" : "";
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuToggle?.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    });
  });

  // Soft cursor glow on fine pointers
  if (window.matchMedia("(pointer: fine)").matches && glow) {
    document.body.classList.add("has-pointer");
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let gx = mx;
    let gy = my;

    window.addEventListener(
      "pointermove",
      (e) => {
        mx = e.clientX;
        my = e.clientY;
      },
      { passive: true }
    );

    const tick = () => {
      gx += (mx - gx) * 0.12;
      gy += (my - gy) * 0.12;
      glow.style.left = `${gx}px`;
      glow.style.top = `${gy}px`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Scroll reveal
  const revealEls = document.querySelectorAll(
    ".fleet-intro, .car-card, .adv-copy, .adv-item, .process-head, .step, .booking-side, .booking-form, .exp-content"
  );
  revealEls.forEach((el) => el.classList.add("fade-up"));

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );

  revealEls.forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 80}ms`;
    io.observe(el);
  });

  if (experience) {
    const expIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) experience.classList.add("in-view");
        });
      },
      { threshold: 0.25 }
    );
    expIo.observe(experience);
  }

  // Parallax on hero image
  const heroImg = document.getElementById("heroImg");
  if (heroImg && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.addEventListener(
      "scroll",
      () => {
        const y = window.scrollY;
        if (y < window.innerHeight) {
          heroImg.style.transform = `scale(1) translateY(${y * 0.18}px)`;
        }
      },
      { passive: true }
    );
  }

  // Form
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    if (!name || !phone) return;

    form.reset();
    if (formSuccess) {
      formSuccess.hidden = false;
      formSuccess.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  // Prefill date min = today
  const today = new Date().toISOString().split("T")[0];
  form?.querySelectorAll('input[type="date"]').forEach((input) => {
    input.setAttribute("min", today);
  });
})();
