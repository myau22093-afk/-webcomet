document.querySelectorAll("img[data-fallback]").forEach((img) => {
  img.addEventListener("error", () => {
    if (img.src !== img.dataset.fallback) {
      img.src = img.dataset.fallback;
    }
  });
});

const header = document.getElementById("header");
const burger = document.getElementById("burger");
const nav = document.getElementById("nav");
const form = document.getElementById("booking-form");
const success = document.getElementById("form-success");
const hero = document.querySelector(".hero");

requestAnimationFrame(() => {
  document.body.classList.add("is-ready");
});

burger.addEventListener("click", () => {
  const open = header.classList.toggle("is-open");
  burger.setAttribute("aria-expanded", String(open));
});

nav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    header.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  });
});

document.querySelectorAll(".heart").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("is-on");
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  form.hidden = true;
  success.hidden = false;
});

const reveals = document.querySelectorAll(".reveal");
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
);
reveals.forEach((el) => io.observe(el));

let mouseX = 0;
let scrollY = 0;
let ticking = false;

function paintHero() {
  if (!hero) return;
  hero.style.setProperty("--word-y", `${scrollY * 0.22}px`);
  hero.style.setProperty("--model-x", `${mouseX * 18}px`);
  hero.style.setProperty("--model-y", `${scrollY * 0.42}px`);
  ticking = false;
}

window.addEventListener(
  "scroll",
  () => {
    scrollY = window.scrollY;
    header.classList.toggle("is-scrolled", scrollY > 12);
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(paintHero);
    }
  },
  { passive: true }
);

window.addEventListener(
  "mousemove",
  (event) => {
    mouseX = event.clientX / window.innerWidth - 0.5;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(paintHero);
    }
  },
  { passive: true }
);
