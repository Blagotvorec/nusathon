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

  // Всё семейство. -THON приставляется к каждому: HACKA+THON = HACKATHON.
  const words = ["MODUL", "PRIN", "MEBEL", "AGRO", "API", "CODE", "HACKA"];

  const HOLD = 2100;      // сколько слово стоит
  const DEAL = 430;       // шаг вступительной раздачи
  const OUT = 300;        // длительность ухода буквы
  const STAGGER = 26;     // задержка между буквами

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Линейка для замера следующего слова. Живёт в body, а не внутри знака:
  // внутри её текст попадал в содержимое страницы, и знак читался как
  // «CODECODETHON» — и людьми через выделение, и поисковиком.
  const ghost = document.createElement("span");
  ghost.className = "hero__ghost";
  ghost.setAttribute("aria-hidden", "true");
  document.body.appendChild(ghost);

  // Кегль знака задан через clamp с vw и vh, поэтому меняется вместе с окном —
  // линейку приходится подгонять перед каждым замером, а не один раз.
  const matchFont = () => {
    const cs = getComputedStyle(el);
    ghost.style.font = cs.font;
    ghost.style.letterSpacing = cs.letterSpacing;
    ghost.style.textTransform = cs.textTransform;
  };

  const letters = (word, cls) =>
    word
      .split("")
      .map((ch, i) => `<span class="${cls}" style="--i:${i}">${ch}</span>`)
      .join("");

  // Ширину следующего слова надо знать заранее: -THON стоит на месте только
  // потому, что приставка едет к своей новой ширине, а не прыгает в неё.
  const widthOf = (word) => {
    matchFont();
    ghost.textContent = word;
    return ghost.getBoundingClientRect().width;
  };

  let i = 0;
  let busy = false;

  const paint = (word) => {
    el.style.width = widthOf(word) + "px";
    el.insertAdjacentHTML("afterbegin", letters(word, "cyc-in"));
  };

  const swap = (word) => {
    if (busy) return;
    busy = true;

    const old = [...el.querySelectorAll("span")];
    old.forEach((s, n) => {
      s.className = "cyc-out";
      s.style.setProperty("--i", n);
    });

    // Уходящие буквы держат место, пока не закончится последняя из них.
    const gone = OUT + STAGGER * Math.max(0, old.length - 1);
    setTimeout(() => {
      old.forEach((s) => s.remove());
      paint(word);
      busy = false;
    }, still ? 200 : gone);
  };

  // Первый показ: быстрая раздача всех имён подряд. Иначе половину семейства
  // просто не досматривают — на спокойном ходу полный круг идёт двадцать
  // секунд, и Apithon с Hackathon никто никогда не видит.
  const settle = () => {
    let hidden = false;
    document.addEventListener("visibilitychange", () => {
      hidden = document.hidden;                 // в скрытой вкладке не крутим
    });
    let paused = false;
    el.closest(".hero__mark")?.addEventListener("pointerenter", () => (paused = true));
    el.closest(".hero__mark")?.addEventListener("pointerleave", () => (paused = false));

    setInterval(() => {
      if (hidden || paused) return;
      i = (i + 1) % words.length;
      swap(words[i]);
    }, HOLD + OUT);
  };

  el.textContent = "";
  paint(words[0]);

  // Ширина слова зависит от кегля, а кегль — от размеров окна.
  addEventListener("resize", () => {
    const now = [...el.querySelectorAll("span")].map((x) => x.textContent).join("");
    if (now) el.style.width = widthOf(now) + "px";
  }, { passive: true });

  if (still) return settle();

  const deal = setInterval(() => {
    i += 1;
    if (i >= words.length) {
      clearInterval(deal);
      i = words.length - 1;
      setTimeout(settle, HOLD);
      return;
    }
    swap(words[i]);
  }, DEAL);
})();

/* ── расписание тонов ───────────────────────────────────────────────────── */

(function schedule() {
  const root = document.querySelector(".sched[data-from][data-to]");
  if (!root) return;

  const from = Date.parse(root.dataset.from);
  const to = Date.parse(root.dataset.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;

  // Доля окна, которую занимает дата. Всё остальное здесь — арифметика от неё.
  const at = (iso) => ((Date.parse(iso) - from) / (to - from)) * 100;

  root.querySelectorAll(".sched__tick[data-at]").forEach((tick) => {
    tick.style.left = at(tick.dataset.at) + "%";
  });

  // Колонка оси, по которой выравнивается вертикаль «сегодня».
  const lane = root.querySelector(".sched__lane");

  root.querySelectorAll(".trow[data-start]").forEach((row) => {
    const bar = row.querySelector(".trow__bar");
    const when = row.querySelector(".trow__when");
    if (!bar) return;

    const end = at(row.dataset.start);
    // Без даты подготовки полоса всё равно должна быть видимой: рисуем
    // короткий отрезок перед стартом, а не нулевую ширину.
    const begin = row.dataset.prep ? at(row.dataset.prep) : end - 5;
    const left = Math.max(0, Math.min(begin, end));
    const width = Math.max(1.5, end - left);

    bar.style.left = left + "%";
    bar.style.width = width + "%";
    if (when) when.style.left = end + "%";
  });

  const today = root.querySelector(".sched__today");
  const place = () => {
    if (!today || !lane) return;
    const p = at(new Date().toISOString().slice(0, 10));
    if (p < 0 || p > 100) return;
    const box = lane.getBoundingClientRect();
    const base = root.getBoundingClientRect();
    today.style.left = box.left - base.left + (box.width * p) / 100 + "px";
    today.hidden = false;
  };

  place();
  // Ширина колонки зависит от ширины окна, а проценты внутри неё — нет.
  addEventListener("resize", place, { passive: true });
})();

/* ── обратный отсчёт ────────────────────────────────────────────────────── */

(function countdowns() {
  const hosts = document.querySelectorAll("[data-deadline]");
  if (!hosts.length) return;

  // Склонение важнее, чем кажется: «через 21 дней» на странице события
  // читается как небрежность ко всему остальному на ней.
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  const timers = [];

  hosts.forEach((host) => {
    const target = Date.parse(host.dataset.deadline);
    if (!Number.isFinite(target)) return;              // дата не разобралась — остаётся запасная строка

    // На странице события отсчёт и есть сам элемент; в карточке он внутри.
    const box = host.matches(".clock") ? host : host.querySelector(".clock, .card2__clock");
    if (!box) return;
    const card = box.classList.contains("card2__clock");
    const cell = (n, word) =>
      card ? `<span class="card2__cell"><b>${n}</b><small>${word}</small></span>`
           : `<span class="clock__cell"><b>${n}</b><small>${word}</small></span>`;

    const tick = () => {
      const left = target - Date.now();
      if (left <= 0) {
        box.innerHTML = '<span class="clock__now">Идёт сейчас</span>';
        return true;
      }
      const d = Math.floor(left / 86400000);
      const h = Math.floor((left % 86400000) / 3600000);
      const m = Math.floor((left % 3600000) / 60000);
      box.innerHTML =
        cell(d, plural(d, "день", "дня", "дней")) +
        cell(h, plural(h, "час", "часа", "часов")) +
        (card ? "" : cell(m, plural(m, "минута", "минуты", "минут")));
      return false;
    };

    if (!tick()) timers.push(setInterval(() => { if (tick()) timers.forEach(clearInterval); }, 30000));
  });
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
