/* =============================================================================
   Пасхалка на часах Printhon.

   Задание открывается в день старта — значит сказать заранее нельзя, а
   намекнуть можно. Тому, кто задержится на отсчёте, соты печатаются прямо
   за цифрами, ячейка за ячейкой, как их кладёт сопло. Шесть — правильные
   шестиугольники. Седьмая, в середине, — нет.

   Это и есть весь текст пасхалки: улей не обязан повторять форму соты.
   Строка внизу лишь проговаривает то, что уже нарисовано.

   Соты лежат в обёртке ВОКРУГ часов, а не внутри: отсчёт перерисовывает
   себе innerHTML целиком каждые полминуты и снёс бы всё, что положили внутрь.
   ========================================================================== */

(function hive() {
  const clock = document.querySelector(".clock[data-egg]");
  if (!clock) return;

  const NS = "http://www.w3.org/2000/svg";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Плоскоугольная ячейка: радиус описанной окружности R, соседи — на
  // расстоянии R*√3 через каждые 60°, начиная с 30°.
  const R = 26;
  const D = R * Math.sqrt(3);
  const hexPoints = (cx, cy) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 180) * (60 * k);
      return `${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`;
    }).join(" ");

  let wrap = null, svg = null, line = null, hideTimer = 0;

  function build() {
    wrap = document.createElement("div");
    wrap.className = "hive-wrap";
    clock.parentNode.insertBefore(wrap, clock);
    wrap.append(clock);

    svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "hive");
    svg.setAttribute("viewBox", "-72 -72 144 144");
    svg.setAttribute("aria-hidden", "true");

    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (30 + 60 * k);
      const cell = document.createElementNS(NS, "polygon");
      cell.setAttribute("points", hexPoints(D * Math.cos(a), D * Math.sin(a)));
      cell.style.setProperty("--i", k);
      svg.append(cell);
    }

    // Седьмая. Треугольник Рёло — постоянной ширины, как шестиугольник, и при
    // этом ни разу не он. Прочерчивается последней, чтобы её заметили.
    const odd = document.createElementNS(NS, "path");
    odd.setAttribute("class", "hive__odd");
    odd.setAttribute(
      "d",
      "M 0 -24 A 41.57 41.57 0 0 1 20.78 12 A 41.57 41.57 0 0 1 -20.78 12 A 41.57 41.57 0 0 1 0 -24 Z"
    );
    odd.style.setProperty("--i", 6);
    svg.append(odd);

    line = document.createElement("p");
    line.className = "hive__line";
    line.textContent = clock.dataset.egg;

    wrap.append(svg, line);
  }

  let open = false;
  function reveal() {
    if (open) return;
    open = true;
    if (!wrap) build();
    // Не через requestAnimationFrame: во вкладке, которую не смотрят, кадры не
    // выдаются вовсе, и пасхалка, найденная в фоне, так и не открылась бы.
    // Достаточно принудительной перекомпоновки, чтобы у перехода было начало.
    void svg.getBoundingClientRect();
    svg.classList.add("on");
    line.classList.add("on");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, reduced ? 9000 : 12000);
  }
  function hide() {
    if (!open) return;
    open = false;
    svg.classList.remove("on");
    line.classList.remove("on");
  }

  // Два пути к одному и тому же. Кто просто смотрит на отсчёт — досмотрится;
  // кто трогает — дотрогается. Ни то ни другое не выглядит кнопкой.
  let stare = 0;
  clock.addEventListener("pointerenter", () => { stare = setTimeout(reveal, 3000); });
  clock.addEventListener("pointerleave", () => clearTimeout(stare));

  let taps = 0, tapTimer = 0;
  clock.addEventListener("click", () => {
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => (taps = 0), 1200);
    if (taps >= 3) { taps = 0; reveal(); }
  });
})();
