/* =============================================================================
   Two behaviours, and deliberately no more: the wordmark cycles through the
   family of editions, and the application form submits.

   Both pages load this file; each behaviour looks for its own element and
   returns quietly when the page does not have one.
   ========================================================================== */

/** Where applications go.
 *
 *  Leave this null and the form composes the application as an email in the
 *  visitor's own mail client — which works the minute the folder is uploaded,
 *  with no server at all. Point it at an endpoint (the INCLT API already has
 *  /api/waitlist) and the same form posts JSON there instead, with no other
 *  change to the page. */
const APPLY_ENDPOINT = null;

/** Fallback address, used when APPLY_ENDPOINT is null. */
const APPLY_EMAIL = "info@buildinclt.com";

/* ── the cycling half of the wordmark ───────────────────────────────────── */

(function cycleWordmark() {
  const el = document.querySelector("[data-cycle]");
  if (!el) return;

  // -THON never moves; only what is bolted to the front of it does.
  const words = ["MEBEL", "MODUL", "PRIN", "REKA", "AGRO", "CODE"];
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) return;

  let i = 0;
  setInterval(() => {
    el.dataset.out = "";                       // fade out
    setTimeout(() => {
      i = (i + 1) % words.length;
      el.textContent = words[i];
      delete el.dataset.out;                   // fade the new word back in
    }, 400);                                   // matches the CSS transition
  }, 2600);
})();

/* ── обратный отсчёт ────────────────────────────────────────────────────── */

(function countdown() {
  const el = document.querySelector("[data-deadline]");
  if (!el) return;

  const target = new Date(el.dataset.deadline);
  if (Number.isNaN(target.getTime())) return;   // дата не разобралась — оставляем запасную строку

  const cell = (n, word) =>
    `<span class="clock__cell"><b>${n}</b><small>${word}</small></span>`;

  // Склонение важнее, чем кажется: «через 21 дней» на главной странице
  // события читается как небрежность ко всему остальному.
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  const tick = () => {
    const left = target - Date.now();
    if (left <= 0) {
      el.innerHTML = '<span class="clock__now">Идёт сейчас</span>';
      return clearInterval(timer);
    }
    const d = Math.floor(left / 86400000);
    const h = Math.floor((left % 86400000) / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    el.innerHTML =
      cell(d, plural(d, "день", "дня", "дней")) +
      cell(h, plural(h, "час", "часа", "часов")) +
      cell(m, plural(m, "минута", "минуты", "минут"));
  };

  tick();
  const timer = setInterval(tick, 30000);
})();

/* ── the application form ───────────────────────────────────────────────── */

(function applicationForm() {
  const form = document.getElementById("apply");
  if (!form) return;

  const status = document.getElementById("status");
  const done = document.getElementById("done");
  const submit = form.querySelector("button[type=submit]");

  const say = (message, isError) => {
    status.textContent = message;
    if (isError) status.dataset.error = "";
    else delete status.dataset.error;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // The browser's own validation is better than anything worth writing here,
    // and it puts the message next to the field that is wrong.
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const application = {
      name: data.get("name")?.trim(),
      email: data.get("email")?.trim(),
      role: data.get("role"),
      city: data.get("city")?.trim(),
      studio: data.get("studio")?.trim(),
      link: data.get("link")?.trim(),
      // Checkbox groups arrive as several entries under one name.
      edition: data.getAll("edition").join(", "),
      mode: data.getAll("mode").join(", "),
      idea: data.get("idea")?.trim(),
      telegram: data.get("telegram")?.trim(),
      page: location.href,
    };

    if (!APPLY_ENDPOINT) {
      // No server yet: hand the application to the visitor's mail client with
      // everything already written out, so nothing is lost in the handover.
      const body = Object.entries(application)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
      const subject = `Application — ${application.name || "NUSATHON"}`;
      location.href =
        `mailto:${APPLY_EMAIL}?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`;
      say("Your mail client is opening with the application filled in — send it to finish.");
      return;
    }

    submit.disabled = true;
    say("Sending…");

    try {
      const response = await fetch(APPLY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(application),
      });
      if (!response.ok) throw new Error(String(response.status));

      form.hidden = true;
      done.hidden = false;
      done.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      submit.disabled = false;
      say(
        `That did not go through. Send it to ${APPLY_EMAIL} instead and we will pick it up there.`,
        true
      );
    }
  });
})();
