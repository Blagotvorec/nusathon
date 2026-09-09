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
const APPLY_ENDPOINT = "/api/thon";

/** Fallback address, used when APPLY_ENDPOINT is null. */
const APPLY_EMAIL = "info@buildinclt.com";

/* ── the cycling half of the wordmark ───────────────────────────────────── */

(function cycleWordmark() {
  const el = document.querySelector("[data-cycle]");
  if (!el) return;

  // Всё семейство. -THON приставляется к каждому: HACKA+THON = HACKATHON.
  const words = ["MODUL", "PRINTA", "MEBEL", "AGRO", "API", "HACKA"];

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
    let hidden = document.hidden;               // в скрытой вкладке не крутим
    document.addEventListener("visibilitychange", () => {
      hidden = document.hidden;
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

  const runDeal = () => {
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
  };

  // Вкладка могла открыться в фоне. Тогда раздача пройдёт, пока на неё никто
  // не смотрит, — а это единственный момент, когда видно всё семейство сразу.
  // Ждём, пока на страницу действительно посмотрят.
  if (document.hidden) {
    document.addEventListener(
      "visibilitychange",
      function once() {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", once);
        runDeal();
      }
    );
  } else {
    runDeal();
  }

  // Прямое управление: по знаку можно щёлкнуть и перебрать имена самому.
  el.closest(".hero__mark")?.addEventListener("click", () => {
    i = (i + 1) % words.length;
    swap(words[i]);
  });
  el.closest(".hero__mark")?.style.setProperty("cursor", "pointer");
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

  const UNITS = [
    { div: 86400, mod: null, words: ["день", "дня", "дней"] },
    { div: 3600, mod: 24, words: ["час", "часа", "часов"] },
    { div: 60, mod: 60, words: ["минута", "минуты", "минут"] },
    { div: 1, mod: 60, words: ["секунда", "секунды", "секунд"] },
  ];

  const live = [];

  hosts.forEach((host) => {
    const target = Date.parse(host.dataset.deadline);
    if (!Number.isFinite(target)) return;              // дата не разобралась — остаётся запасная строка

    // На странице события отсчёт и есть сам элемент; в карточке он внутри.
    const box = host.matches(".clock") ? host : host.querySelector(".clock, .card2__clock");
    if (!box) return;
    const cellClass = box.classList.contains("card2__clock") ? "card2__cell" : "clock__cell";

    // Разметка строится один раз, дальше меняются только числа. Перерисовывать
    // её раз в секунду — это мусор, мигание и потерянное выделение текста.
    box.textContent = "";
    const cells = UNITS.map(() => {
      const wrap = document.createElement("span");
      wrap.className = cellClass;
      const value = document.createElement("b");
      const label = document.createElement("small");
      wrap.append(value, label);
      box.append(wrap);
      return { wrap, value, label };
    });

    live.push({ target, box, cells });
  });

  if (!live.length) return;

  const paint = () => {
    for (let i = live.length - 1; i >= 0; i -= 1) {
      const { target, box, cells } = live[i];
      const left = target - Date.now();

      if (left <= 0) {
        box.textContent = "";
        const now = document.createElement("span");
        now.className = "clock__now";
        now.textContent = "Идёт сейчас";
        box.append(now);
        live.splice(i, 1);                             // досчитал — больше не трогаем
        continue;
      }

      const total = Math.floor(left / 1000);
      UNITS.forEach((unit, n) => {
        const v = unit.mod
          ? Math.floor(total / unit.div) % unit.mod
          : Math.floor(total / unit.div);
        const { value, label } = cells[n];
        const text = String(v);
        if (value.textContent !== text) value.textContent = text;
        const word = plural(v, ...unit.words);
        if (label.textContent !== word) label.textContent = word;
      });
    }
    if (!live.length) clearInterval(timer);
  };

  paint();
  const timer = setInterval(paint, 1000);
  // Вкладка в фоне тормозит таймеры, и по возвращении числа отстают.
  // Перерисовываем сразу, как на страницу снова посмотрели.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) paint();
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
    const tg = form.elements.telegram;
    const wa = form.elements.whatsapp;
    // «Обязательно одно из двух» разметкой не выражается: required на обоих
    // потребовал бы оба, а у большинства есть только один мессенджер.
    const noContact = !tg.value.trim() && !wa.value.trim();
    tg.setCustomValidity(noContact ? "Оставьте Telegram или WhatsApp — туда мы и ответим" : "");
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const application = {
      name: data.get("name")?.trim(),
      role: data.get("role"),
      city: data.get("city")?.trim(),
      studio: data.get("studio")?.trim(),
      link: data.get("link")?.trim(),
      // Checkbox groups arrive as several entries under one name.
      edition: data.getAll("edition").join(", "),
      mode: data.getAll("mode").join(", "),
      idea: data.get("idea")?.trim(),
      telegram: data.get("telegram")?.trim(),
      whatsapp: data.get("whatsapp")?.trim(),
      // Тон берётся из адреса, если человек пришёл со страницы события:
      // иначе заявка с Printathon подписывается тем, что он угадает в
      // галочках, и в группе не видно, откуда она.
      thon:
        new URLSearchParams(location.search).get("thon") ||
        data.getAll("edition").join(", ") ||
        "NUSATHON",
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
      openJoin();
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

/* ── окно «вступите в канал» ────────────────────────────────────────────── */

/* Показывается один раз, сразу после успешной отправки. Канал — единственное
   место, где участник потом узнает бриф и результат, поэтому предложение
   стоит там, где интерес максимален, а не строчкой в письме, которого он
   может и не открыть. */
function openJoin() {
  const box = document.getElementById("join");
  if (!box) return;
  // showModal даёт ловушку фокуса, Esc и подложку; show() — ничего из этого.
  if (typeof box.showModal === "function" && !box.open) box.showModal();
  else box.setAttribute("open", "");            // на случай старого браузера
}

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-open-join]")) openJoin();
});

/* ── заявка под конкретный тон ───────────────────────────────────────────── */

/* Форма одна на все тоны, но пришедший со страницы события не должен видеть
   вопросы, ответ на которые уже известен: какой это хакатон и что человек
   собирается делать, если задание там открывается только в день старта.
   Общий текст лежит в разметке и работает без скрипта; здесь он лишь
   уточняется под тон из адреса. */

const THON_VARIANTS = {
  Printathon: {
    title: "Это заявка на <em>Printathon</em>.",
    lede:
      "Встретимся и вместе разберёмся, как проектировать большие модели под " +
      "печать. Порога по портфолио нет, взноса нет — нужен только интерес " +
      "к тому, что печатается крупнее стола.",
    steps: [
      "Заявки читаем сами, отвечаем в течение недели.",
      "Вся информация — в Telegram-канале Printathon, и она же дублируется " +
        "в группе WhatsApp. Доступ к обоим придёт сразу после регистрации.",
      "С командами, чью работу хочется продолжать, работаем дальше — заказы, " +
        "серии и проекты, выросшие отсюда.",
    ],
    hide: ["apply-edition", "apply-idea"],
  },
};

(function tailorApplication() {
  const which = new URLSearchParams(location.search).get("thon");
  const variant = THON_VARIANTS[which];
  if (!variant) return;

  const title = document.getElementById("apply-title");
  const lede = document.getElementById("apply-lede");
  const steps = document.getElementById("apply-steps");

  // Метка на <body>: по ней страница получает облик своего тона.
  document.body.classList.add("is-" + which.toLowerCase());

  if (title) title.innerHTML = variant.title;
  if (lede) lede.textContent = variant.lede;
  if (steps) steps.innerHTML = variant.steps.map((s) => `<li>${s}</li>`).join("");

  for (const id of variant.hide ?? []) {
    const box = document.getElementById(id);
    if (!box) continue;
    box.hidden = true;
    // Обязательное поле, спрятанное вместе с блоком, останавливает отправку
    // сообщением, которое некуда показать: браузер не может навести фокус на
    // невидимый элемент. Требование снимается вместе с самим вопросом.
    box.querySelectorAll("[required]").forEach((el) => (el.required = false));
  }
})();

/* ── пожелание по неоткрытому тону ───────────────────────────────────────── */

/* Чип открытого направления ведёт не на форму заявки, а сюда: тон ещё не
   запущен, и звать участвовать в том, чего нет, — обещание, которое нечем
   выполнить. Вместо этого собираем пожелания; по ним и решается, какой тон
   открывать следующим.

   Уходит тем же маршрутом, что и заявки, но с пометкой типа — в группе они
   должны различаться с первой строки. */

(function wishes() {
  const box = document.getElementById("wish");
  const form = document.getElementById("wish-form");
  if (!box || !form) return;

  const nameOut = document.getElementById("wish-name");
  const cta = document.getElementById("wish-open");
  const status = document.getElementById("wish-status");
  let thon = "";

  document.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-wish]");
    if (!chip) return;
    thon = chip.dataset.wish;
    if (nameOut) nameOut.textContent = thon;
    // Каждое открытие начинается с чистого листа: прошлый ответ и прошлая
    // ошибка к новому тону отношения не имеют.
    form.hidden = true;
    form.reset();
    if (cta) cta.hidden = false;
    if (status) { status.textContent = ""; delete status.dataset.error; }
    if (typeof box.showModal === "function" && !box.open) box.showModal();
  });

  // Опросник раскрывается по нажатию: окно не должно встречать стеной полей
  // того, кто просто ткнул в чип из любопытства.
  cta?.addEventListener("click", () => {
    form.hidden = false;
    cta.hidden = true;
    form.querySelector("input")?.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const tg = form.elements.telegram;
    const wa = form.elements.whatsapp;
    tg.setCustomValidity(
      !tg.value.trim() && !wa.value.trim()
        ? "Оставьте Telegram или WhatsApp — туда мы и ответим"
        : ""
    );
    if (!form.reportValidity()) return;

    const send = form.querySelector("[type=submit]");
    send.disabled = true;
    status.textContent = "Отправляем…";
    delete status.dataset.error;

    const wish = {
      kind: "Пожелание об участии",
      thon,
      name: form.elements.name.value.trim(),
      telegram: tg.value.trim(),
      whatsapp: wa.value.trim(),
      idea: form.elements.idea.value.trim(),
      page: location.href,
    };

    try {
      const res = await fetch(APPLY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wish),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.hidden = true;
      status.textContent = `Записали. Когда ${thon} откроется, напишем вам первым.`;
    } catch {
      send.disabled = false;
      status.textContent = "Не отправилось. Попробуйте ещё раз или напишите на info@buildinclt.com.";
      status.dataset.error = "";
    }
  });
})();
