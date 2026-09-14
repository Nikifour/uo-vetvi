/**
 * Окно графа: холст со сценарием.
 *
 * Узлы — карточки на холсте, стрелки — кривые между ними. Холст двигается
 * перетаскиванием пустого места и приближается колесом; карточка таскается
 * за собой и запоминает место в странице журнала.
 *
 * Рисуется это не на canvas, а обычным HTML поверх SVG: стрелки — пути,
 * карточки — div-ы. Так текст остаётся текстом (его можно выделить, он
 * переносится сам), а щелчки и перетаскивания достаются браузеру, а не
 * самодельному попаданию по пикселям.
 */

import {
  MODULE_ID, ВИДЫ, свести, узел, ребро, метка,
  добавитьУзел, правитьУзел, удалитьУзел, назначитьНачало,
  связать, правитьРебро, удалитьРебро,
  завестиМетку, удалитьМетку, переключитьМетку,
  отметить, снятьОтметку, начатьЗаново, какОтмечен, КАК, заметкаУзла,
  группа, завестиГруппу, правитьГруппу, удалитьГруппу, ЦВЕТА,
  партия, ходыПартий, обеспечитьПартию,
  завестиПартию, правитьПартию, удалитьПартию, размножитьПартию, перейтиКПартии,
} from "./svod.mjs";
import { достижимое, итоги, разбор, слои, открыта, решена, наборМеток, фронт } from "./pravila.mjs";
import { Т } from "./yazyk.mjs";

const { ApplicationV2, DialogV2 } = foundry.applications.api;
const экранировать = s => foundry.utils.escapeHTML(String(s ?? ""));

const ШИРИНА_УЗЛА = 190;
const ВЫСОТА_УЗЛА = 76;

/* ─────────────────────────── рисование стрелок ─────────────────────────── */

/** Кривая от правого края одной карточки к левому краю другой. */
function путь(из, в) {
  const x1 = из.x + ШИРИНА_УЗЛА, y1 = из.y + ВЫСОТА_УЗЛА / 2;
  const x2 = в.x, y2 = в.y + ВЫСОТА_УЗЛА / 2;

  // Если цель левее — обводим снизу, иначе стрелка прошла бы сквозь карточку.
  if (x2 < x1 + 30) {
    const низ = Math.max(y1, y2) + ВЫСОТА_УЗЛА;
    return `M ${x1} ${y1} C ${x1 + 80} ${низ}, ${x2 - 80} ${низ}, ${x2} ${y2}`;
  }
  const шаг = Math.max(40, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + шаг} ${y1}, ${x2 - шаг} ${y2}, ${x2} ${y2}`;
}

/** Середина кривой — там висит подпись. */
const серединка = (из, в) => ({
  x: (из.x + ШИРИНА_УЗЛА + в.x) / 2,
  y: (из.y + в.y) / 2 + ВЫСОТА_УЗЛА / 2,
});

/* ─────────────────────────── окно ─────────────────────────── */

export class ОкноГрафа extends ApplicationV2 {
  constructor(options = {}) {
    super(options);
    this.журнал = options.журнал;
    this.вид = { x: 0, y: 0, м: 1 };
    this.выбран = null;                  // { тип: "узел"|"ребро", id }
    this.связьОт = null;                 // узел, от которого тянут стрелку
    this.развёрнуто = new Set();         // какие складки панели раскрыты
  }

  static DEFAULT_OPTIONS = {
    classes: ["uo-vetvi", "uo-vetvi-okno"],
    tag: "div",
    window: { title: "Ветви сценария", icon: "fa-solid fa-code-branch", resizable: true },   // подменяется get title()
    position: { width: 1100, height: 720 },
    actions: {
      новыйУзел: ОкноГрафа.#новыйУзел,
      разложить: ОкноГрафа.#разложить,
      поЦентру: ОкноГрафа.#поЦентру,
      проверить: ОкноГрафа.#проверить,
      заново: ОкноГрафа.#заново,

      выбрать: ОкноГрафа.#выбрать,
      открытьУзел: ОкноГрафа.#открытьУзел,
      правитьУзел: ОкноГрафа.#правитьУзел,
      удалитьУзел: ОкноГрафа.#удалитьУзел,
      началоЗдесь: ОкноГрафа.#началоЗдесь,
      отметить: ОкноГрафа.#отметить,
      частично: ОкноГрафа.#частично,
      снять: ОкноГрафа.#снять,
      заметка: ОкноГрафа.#заметка,
      тянуть: ОкноГрафа.#тянуть,

      выбратьРебро: ОкноГрафа.#выбратьРебро,
      правитьРебро: ОкноГрафа.#правитьРебро,
      удалитьРебро: ОкноГрафа.#удалитьРебро,

      новаяГруппа: ОкноГрафа.#новаяГруппа,
      правитьГруппу: ОкноГрафа.#правитьГруппуДиалог,
      убратьГруппу: ОкноГрафа.#убратьГруппу,

      новаяМетка: ОкноГрафа.#новаяМетка,
      переключитьМетку: ОкноГрафа.#переключитьМетку,
      убратьМетку: ОкноГрафа.#убратьМетку,

      перейтиКПартии: ОкноГрафа.#перейтиКПартии,
      новаяПартия: ОкноГрафа.#новаяПартия,
      правитьПартию: ОкноГрафа.#правитьПартиюДиалог,
      расколПартии: ОкноГрафа.#расколПартии,
      убратьПартию: ОкноГрафа.#убратьПартию,
    },
  };

  /*
   * Партия — в заголовке окна, а не только в панели. Отмечать ход не той
   * компании — ошибка, которую не видно, пока не станет поздно; название
   * в шапке стоит того, чтобы занимать место.
   */
  get title() {
    const п = this.свод.партия;
    const имя = this.журнал?.name ?? "";
    return п ? Т("Ветви: {имя} · {партия}", { имя, партия: п.имя }) : Т("Ветви: {имя}", { имя });
  }

  get свод() { return свести(this.журнал); }

  /* ─── жизнь окна ─── */

  async _onFirstRender(context, options) {
    await super._onFirstRender?.(context, options);
    const свой = док => (док.id ?? док.parent?.id) === this.журнал.id || док.parent?.id === this.журнал.id;
    const освежить = док => { if (свой(док)) this.render(); };

    this.слушатели = [
      ["updateJournalEntry", Hooks.on("updateJournalEntry", освежить)],
      ["updateJournalEntryPage", Hooks.on("updateJournalEntryPage", освежить)],
      ["createJournalEntryPage", Hooks.on("createJournalEntryPage", освежить)],
      ["deleteJournalEntryPage", Hooks.on("deleteJournalEntryPage", освежить)],
    ];
  }

  _onClose(options) {
    for (const [имя, id] of this.слушатели ?? []) Hooks.off(имя, id);
    this.слушатели = null;
    super._onClose?.(options);
  }

  /* ─── разметка ─── */

  async _renderHTML() {
    const свод = this.свод;
    const места = this.#места(свод);
    const { узлы: досягаемые } = достижимое(свод);
    const пройдено = new Set(свод.ход.пройдено);
    const метки = наборМеток(свод.ход.метки);
    const наФронте = new Set(фронт(свод));

    const стрелки = свод.рёбра.map(р => {
      const из = места[р.из], в = места[р.в];
      if (!из || !в) return "";
      // Живая — по ней можно шагнуть прямо сейчас; закрытая — развилка позади
      // неё уже решена в другую сторону, и этой дороги больше нет.
      const живая = наФронте.has(р.из) && открыта(свод, р, метки);
      const закрыта = решена(свод, р.из) && !пройдено.has(р.в);
      const классы = [
        "uo-vetvi-strelka",
        живая ? "uo-zhivaya" : "",
        закрыта ? "uo-zakryta" : "",
        this.выбран?.тип === "ребро" && this.выбран.id === р.id ? "uo-vybrana" : "",
      ].filter(Boolean).join(" ");
      const условие = [
        ...(р.нужны ?? []).map(м => `+${метка(свод, м)?.имя ?? "?"}`),
        ...(р.запрещены ?? []).map(м => `−${метка(свод, м)?.имя ?? "?"}`),
      ].join(", ");
      const подпись = [р.подпись, условие ? `(${условие})` : ""].filter(Boolean).join(" ");
      const с = серединка(из, в);

      return `
        <path class="${классы}" d="${путь(из, в)}" data-action="выбратьРебро" data-rebro="${р.id}"></path>
        ${подпись ? `<text class="uo-vetvi-podpis" x="${с.x}" y="${с.y}" text-anchor="middle"
          data-action="выбратьРебро" data-rebro="${р.id}">${экранировать(подпись)}</text>` : ""}`;
    }).join("");

    const частично = new Set(свод.ход.частично ?? []);

    /*
     * Точки чужих партий на карточке: кто здесь уже был.
     *
     * Без этого несколько партий в одном мире слепы друг к другу: ведущий
     * ведёт вторую компанию к финалу, не помня, что первая его уже взяла.
     * Цветная точка отвечает на это молча, не занимая места в панели.
     * Полая точка — прошли частично.
     */
    const чужиеТочки = {};
    for (const п of ходыПартий(this.журнал)) {
      if (п.id === свод.партия?.id) continue;
      for (const id of п.пройдено) (чужиеТочки[id] ??= []).push({ ...п, целиком: true });
      for (const id of п.частично) (чужиеТочки[id] ??= []).push({ ...п, целиком: false });
    }

    const карточки = свод.узлы.map(у => {
      const м = места[у.id];
      const классы = [
        "uo-vetvi-uzel",
        `uo-vid-${ВИДЫ[у.вид]?.класс ?? "scena"}`,
        пройдено.has(у.id) ? "uo-projden" : "",
        частично.has(у.id) ? "uo-chastichno" : "",
        у.id === свод.начало ? "uo-nachalo" : "",
        у.вид === "финал" && !досягаемые.has(у.id) && !пройдено.has(у.id) ? "uo-otrezan" : "",
        this.выбран?.тип === "узел" && this.выбран.id === у.id ? "uo-vybran" : "",
        this.связьОт === у.id ? "uo-tjanem" : "",
      ].filter(Boolean).join(" ");

      const ставит = (у.ставит ?? []).map(id => метка(свод, id)?.имя).filter(Boolean);
      const снимает = (у.снимает ?? []).map(id => метка(свод, id)?.имя).filter(Boolean);

      const г = у.группа ? группа(свод, у.группа) : null;
      const заметка = свод.ход.заметки?.[у.id] ?? "";

      return `
        <div class="${классы}" style="left: ${м.x}px; top: ${м.y}px; width: ${ШИРИНА_УЗЛА}px; height: ${ВЫСОТА_УЗЛА}px${
          г ? `; --uo-gruppa: ${г.цвет}` : ""}"
             data-uzel="${у.id}" data-action="выбрать"
             title="${экранировать(заметка || у.имя)}">
          <div class="uo-vetvi-shapka">
            <span class="uo-znak">${ВИДЫ[у.вид].знак}</span>
            <span class="uo-imja">${экранировать(у.имя)}</span>
            ${заметка ? `<span class="uo-zametka-znak" title="${экранировать(заметка)}">✎</span>` : ""}
            ${(чужиеТочки[у.id] ?? []).map(п => `<span class="uo-vetvi-tochka uo-chuzhaja ${п.целиком ? "" : "uo-poluchuzhaja"}"
              style="background: ${п.целиком ? п.цвет : "transparent"}; border-color: ${п.цвет}"
              title="${экранировать(п.целиком
                ? Т("{партия}: здесь была", { партия: п.имя })
                : Т("{партия}: была частично", { партия: п.имя }))}"></span>`).join("")}
          </div>
          ${г ? `<div class="uo-vetvi-gruppa">${экранировать(г.имя)}</div>` : ""}
          <div class="uo-vetvi-metki">
            ${ставит.map(и => `<span class="uo-stavit">+${экранировать(и)}</span>`).join("")}
            ${снимает.map(и => `<span class="uo-snimaet">−${экранировать(и)}</span>`).join("")}
          </div>
        </div>`;
    }).join("");

    const размер = свод.узлы.reduce((б, у) => ({
      w: Math.max(б.w, места[у.id].x + ШИРИНА_УЗЛА + 120),
      h: Math.max(б.h, места[у.id].y + ВЫСОТА_УЗЛА + 120),
    }), { w: 800, h: 500 });

    return `
      <div class="uo-vetvi-telo">
        ${this.#панель(свод)}
        <div class="uo-vetvi-pole">
          <div class="uo-vetvi-holst" style="transform: translate(${this.вид.x}px, ${this.вид.y}px) scale(${this.вид.м})">
            <svg class="uo-vetvi-strelki" width="${размер.w}" height="${размер.h}">
              <defs>
                <marker id="uo-vetvi-nakonechnik" viewBox="0 0 10 10" refX="9" refY="5"
                        markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z"></path>
                </marker>
              </defs>
              ${стрелки}
            </svg>
            ${карточки}
          </div>
          ${свод.узлы.length ? "" : `<p class="uo-vetvi-pusto">${Т("Сценарий пуст. Начните с кнопки «Узел».")}</p>`}
          ${this.связьОт ? `<p class="uo-vetvi-namek">${Т("Щёлкните по узлу, к которому ведёт стрелка. Escape — отмена.")}</p>` : ""}
        </div>
      </div>`;
  }

  /**
   * Складной раздел панели.
   *
   * Меток в длинной кампании набирается три десятка, и развёрнутый список
   * съедает всю панель: до финалов приходится листать. Поэтому списки
   * свёрнуты, пока не понадобятся, а число рядом с заголовком говорит,
   * сколько там внутри, — ради этого разворачивать не нужно.
   *
   * Что развёрнуто, помнит окно, а не разметка: перерисовка холста случается
   * от каждого щелчка, и без памяти раздел захлопывался бы на глазах.
   */
  #складка(ключ, заголовок, сколько, нутро) {
    const открыт = this.развёрнуто.has(ключ);
    return `
      <details class="uo-vetvi-razdel uo-vetvi-skladka" data-razdel="${ключ}" ${открыт ? "open" : ""}>
        <summary><h4>${заголовок}<span class="uo-vetvi-skolko">${сколько}</span></h4></summary>
        ${нутро}
      </details>`;
  }

  /** Боковая панель: что выбрано, метки, финалы. */
  #панель(свод) {
    const выбранный = this.выбран?.тип === "узел" ? узел(свод, this.выбран.id) : null;
    const выбраннаяСтрелка = this.выбран?.тип === "ребро" ? ребро(свод, this.выбран.id) : null;
    const пройдено = new Set(свод.ход.пройдено);

    const как = выбранный ? какОтмечен(свод, выбранный.id) : КАК.нет;
    const заметка = выбранный ? (свод.ход.заметки?.[выбранный.id] ?? "") : "";
    const егоГруппа = выбранный?.группа ? группа(свод, выбранный.группа) : null;

    const состояние = {
      [КАК.полностью]: Т("случилось"),
      [КАК.частично]: Т("случилось частично"),
      [КАК.нет]: "",
    }[как];

    const оУзле = выбранный ? `
      <section class="uo-vetvi-razdel">
        <h4>${ВИДЫ[выбранный.вид].знак} ${экранировать(выбранный.имя)}</h4>
        <p class="uo-vetvi-tiho">${Т(ВИДЫ[выбранный.вид].имя)}${выбранный.id === свод.начало ? " · " + Т("начало") : ""}${
          состояние ? " · " + состояние : ""}${егоГруппа ? " · " + экранировать(егоГруппа.имя) : ""}</p>

        <div class="uo-vetvi-sostojanie">
          <button type="button" class="${как === КАК.нет ? "uo-vybrano" : ""}"
            data-action="снять" data-uzel="${выбранный.id}">${Т("Не случилось")}</button>
          <button type="button" class="${как === КАК.частично ? "uo-vybrano" : ""}"
            data-action="частично" data-uzel="${выбранный.id}">${Т("Частично")}</button>
          <button type="button" class="${как === КАК.полностью ? "uo-vybrano" : ""}"
            data-action="отметить" data-uzel="${выбранный.id}">${Т("Случилось")}</button>
        </div>
        ${как === КАК.частично
          ? `<p class="uo-vetvi-tiho">${Т("Частично — метки узла ещё не подняты: событие началось, последствий нет.")}</p>`
          : ""}

        ${заметка ? `<p class="uo-vetvi-zametka">✎ ${экранировать(заметка)}</p>` : ""}

        <div class="uo-vetvi-knopki">
          <button type="button" data-action="открытьУзел" data-uzel="${выбранный.id}">${Т("Текст")}</button>
          <button type="button" data-action="заметка" data-uzel="${выбранный.id}">${заметка ? Т("Замечание") : Т("Замечание…")}</button>
          <button type="button" data-action="правитьУзел" data-uzel="${выбранный.id}">${Т("Правка")}</button>
          <button type="button" data-action="тянуть" data-uzel="${выбранный.id}">${Т("Стрелка")}</button>
          <button type="button" data-action="началоЗдесь" data-uzel="${выбранный.id}">${Т("Начало здесь")}</button>
          <button type="button" class="uo-opasno" data-action="удалитьУзел" data-uzel="${выбранный.id}">${Т("Убрать")}</button>
        </div>
      </section>` : "";

    const оСтрелке = выбраннаяСтрелка ? `
      <section class="uo-vetvi-razdel">
        <h4>${Т("Стрелка")}</h4>
        <p class="uo-vetvi-tiho">${экранировать(узел(свод, выбраннаяСтрелка.из)?.имя ?? "?")}
          → ${экранировать(узел(свод, выбраннаяСтрелка.в)?.имя ?? "?")}</p>
        <div class="uo-vetvi-knopki">
          <button type="button" data-action="правитьРебро" data-rebro="${выбраннаяСтрелка.id}">${Т("Правка")}</button>
          <button type="button" class="uo-opasno" data-action="удалитьРебро" data-rebro="${выбраннаяСтрелка.id}">${Т("Убрать")}</button>
        </div>
      </section>` : "";

    const метки = свод.метки.length ? свод.метки.map(м => `
      <label class="uo-vetvi-metka">
        <input type="checkbox" data-action="переключитьМетку" data-metka="${м.id}" ${свод.ход.метки[м.id] ? "checked" : ""}>
        <span>${экранировать(м.имя)}</span>
        <button type="button" class="uo-krestik" data-action="убратьМетку" data-metka="${м.id}" title="${Т("Убрать метку")}">×</button>
      </label>`).join("") : `<p class="uo-vetvi-tiho">${Т("Меток пока нет.")}</p>`;

    const группы = свод.группы.length ? свод.группы.map(г => `
      <div class="uo-vetvi-gruppa-stroka">
        <span class="uo-vetvi-tochka" style="background: ${г.цвет}"></span>
        <span>${экранировать(г.имя)}</span>
        <button type="button" class="uo-krestik" data-action="правитьГруппу" data-gruppa="${г.id}" title="${Т("Переименовать")}">✎</button>
        <button type="button" class="uo-krestik" data-action="убратьГруппу" data-gruppa="${г.id}" title="${Т("Убрать группу")}">×</button>
      </div>`).join("") : `<p class="uo-vetvi-tiho">${Т("Групп пока нет. Группа — ветка сценария, названная вслух.")}</p>`;

    const финалы = итоги(свод);
    const оФиналах = финалы.length ? финалы.map(ф => `
      <p class="uo-vetvi-final ${ф.состоялся ? "uo-sostojalsja" : ф.отрезан ? "uo-otrezan" : "uo-dostizhim"}">
        ★ ${экранировать(ф.имя)} — ${ф.состоялся ? Т("состоялся") : ф.отрезан ? Т("отрезан") : Т("ещё возможен")}
      </p>`).join("") : `<p class="uo-vetvi-tiho">${Т("Финалов не отмечено.")}</p>`;

    return `
      <aside class="uo-vetvi-panel">
        <div class="uo-vetvi-knopki uo-vetvi-glavnye">
          <button type="button" data-action="новыйУзел">${Т("Узел")}</button>
          <button type="button" data-action="разложить">${Т("Разложить")}</button>
          <button type="button" data-action="поЦентру">${Т("По центру")}</button>
          <button type="button" data-action="проверить">${Т("Проверить")}</button>
        </div>

        ${this.#оПартиях(свод)}
        ${оУзле}
        ${оСтрелке}

        ${this.#складка("metki", Т("Метки кампании"), свод.метки.length, `
          ${метки}
          <div class="uo-vetvi-knopki"><button type="button" data-action="новаяМетка">${Т("Новая метка")}</button></div>`)}

        ${this.#складка("vetki", Т("Ветки"), свод.группы.length, `
          ${группы}
          <div class="uo-vetvi-knopki"><button type="button" data-action="новаяГруппа">${Т("Новая ветка")}</button></div>`)}

        <section class="uo-vetvi-razdel">
          <h4>${Т("Финалы")}</h4>
          ${оФиналах}
          <p class="uo-vetvi-tiho">${Т("«Отрезан» — наверняка; «ещё возможен» — при удачном ходе.")}</p>
        </section>

        <section class="uo-vetvi-razdel">
          <div class="uo-vetvi-knopki">
            <button type="button" class="uo-opasno" data-action="заново">${
              свод.партия ? Т("Начать заново: {партия}", { партия: экранировать(свод.партия.имя) }) : Т("Начать кампанию заново")}</button>
          </div>
        </section>
      </aside>`;
  }

  /**
   * Раздел партий — первым в панели, сразу под главными кнопками.
   *
   * Стоит он там потому, что отвечает на вопрос «чей ход я сейчас записываю».
   * Ответ должен попадаться на глаза сам, без разворачивания складки: отметить
   * пройденное не той компании легко, а заметить это — нет.
   *
   * Прочие партии показаны строкой каждая: сколько узлов прошли и до каких
   * финалов добрались. Это и есть смысл нескольких партий в одном мире —
   * видеть, что первая компания уже взяла тот финал, к которому вторая
   * только идёт.
   */
  #оПартиях(свод) {
    if (!свод.партии.length) {
      return `<section class="uo-vetvi-razdel">
        <h4>${Т("Партия")}</h4>
        <p class="uo-vetvi-tiho">${Т("Партия ещё не заведена. Она появится сама, как только откроете граф заново.")}</p>
      </section>`;
    }

    const текущая = свод.партия;
    const финалы = new Set(свод.узлы.filter(у => у.вид === "финал").map(у => у.id));
    const имяУзла = id => свод.узлы.find(у => у.id === id)?.имя ?? "";

    const кнопки = свод.партии.map(п => `
      <button type="button" class="uo-vetvi-partiya ${п.id === текущая?.id ? "uo-vybrano" : ""}"
        data-action="перейтиКПартии" data-partiya="${п.id}">
        <span class="uo-vetvi-tochka" style="background: ${п.цвет}"></span>${экранировать(п.имя)}
      </button>`).join("");

    const прочие = ходыПартий(this.журнал)
      .filter(п => п.id !== текущая?.id)
      .map(п => {
        const взяты = п.пройдено.filter(id => финалы.has(id)).map(имяУзла).filter(Boolean);
        const хвост = взяты.length
          ? Т("финал: {какой}", { какой: взяты.map(экранировать).join(", ") })
          : Т("финалов нет");
        return `<p class="uo-vetvi-tiho">
          <span class="uo-vetvi-tochka" style="background: ${п.цвет}"></span>
          ${экранировать(п.имя)} — ${Т("пройдено {сколько}", { сколько: п.пройдено.length })}, ${хвост}
        </p>`;
      }).join("");

    return `
      <section class="uo-vetvi-razdel">
        <h4>${Т("Партия")}</h4>
        <div class="uo-vetvi-partii">${кнопки}</div>
        ${текущая?.заметка ? `<p class="uo-vetvi-tiho">${экранировать(текущая.заметка)}</p>` : ""}
        <div class="uo-vetvi-knopki">
          <button type="button" data-action="новаяПартия">${Т("Новая партия")}</button>
          ${текущая ? `<button type="button" data-action="правитьПартию" data-partiya="${текущая.id}">${Т("Правка")}</button>` : ""}
          ${текущая ? `<button type="button" data-action="расколПартии" data-partiya="${текущая.id}">${Т("Раскол")}</button>` : ""}
          ${свод.партии.length > 1 && текущая
            ? `<button type="button" class="uo-opasno" data-action="убратьПартию" data-partiya="${текущая.id}">${Т("Убрать")}</button>`
            : ""}
        </div>
        ${прочие}
      </section>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  /**
   * Места карточек: что записано в страницах, а чему места нет — раскладываем
   * по слоям. Раскладка не записывается сама: первый же взгляд не должен
   * менять сценарий.
   */
  #места(свод) {
    const запасные = слои(свод);
    const места = {};
    for (const у of свод.узлы) {
      места[у.id] = у.естьМесто ? { x: у.x, y: у.y } : (запасные[у.id] ?? { x: 60, y: 60 });
    }
    return места;
  }

  /* ─── мышь: холст, перетаскивание, колесо ─── */

  _onRender(context, options) {
    super._onRender?.(context, options);

    // Заголовок ставится при первой отрисовке и сам не меняется, а партию
    // в нём переключают на ходу — обновляем вслух.
    const шапка = this.element.querySelector(".window-title");
    if (шапка) шапка.textContent = this.title;

    const поле = this.element.querySelector(".uo-vetvi-pole");
    const холст = this.element.querySelector(".uo-vetvi-holst");
    if (!поле || !холст) return;

    поле.addEventListener("wheel", событие => {
      событие.preventDefault();
      const было = this.вид.м;
      this.вид.м = Math.min(2, Math.max(0.3, было * (событие.deltaY < 0 ? 1.1 : 1 / 1.1)));
      // Приближаем к указателю, а не к углу: иначе холст уползает из-под мыши.
      const к = поле.getBoundingClientRect();
      const мышьX = событие.clientX - к.left, мышьY = событие.clientY - к.top;
      this.вид.x = мышьX - (мышьX - this.вид.x) * (this.вид.м / было);
      this.вид.y = мышьY - (мышьY - this.вид.y) * (this.вид.м / было);
      this.#применитьВид(холст);
    }, { passive: false });

    поле.addEventListener("pointerdown", событие => {
      const карточка = событие.target.closest(".uo-vetvi-uzel");
      if (карточка) return this.#тащитьУзел(событие, карточка);
      if (событие.target.closest(".uo-vetvi-strelka, .uo-vetvi-podpis")) return;
      this.#тащитьХолст(событие, холст);
    });

    /*
     * Двойной щелчок открывает страницу узла. Самое частое действие за столом —
     * прочитать, что в сцене написано; ради него ходить в панель незачем.
     */
    поле.addEventListener("dblclick", событие => {
      const карточка = событие.target.closest(".uo-vetvi-uzel");
      if (!карточка) return;
      событие.preventDefault();
      const страница = this.журнал.pages.get(карточка.dataset.uzel);
      if (страница) this.журнал.sheet.render(true, { pageId: страница.id });
    });

    // Правый щелчок — меню прямо на узле: остальное в панели сбоку.
    поле.addEventListener("contextmenu", событие => {
      const карточка = событие.target.closest(".uo-vetvi-uzel");
      if (!карточка) return;
      событие.preventDefault();
      this.#менюУзла(событие, карточка.dataset.uzel);
    });

    // Щелчок мимо меню его закрывает — как ведёт себя всякое меню.
    поле.addEventListener("pointerdown", () => this.#убратьМеню(), { capture: true });

    // Складки панели: помним раскрытое, иначе перерисовка их захлопнет.
    for (const складка of this.element.querySelectorAll(".uo-vetvi-skladka")) {
      складка.addEventListener("toggle", () => {
        const ключ = складка.dataset.razdel;
        if (складка.open) this.развёрнуто.add(ключ);
        else this.развёрнуто.delete(ключ);
      });
    }

    this.element.addEventListener("keydown", событие => {
      if (событие.key === "Escape" && this.связьОт) {
        this.связьОт = null;
        this.render();
      }
    });
  }

  /* ─── меню на узле ─── */

  #убратьМеню() {
    this.element?.querySelector(".uo-vetvi-menu")?.remove();
  }

  #менюУзла(событие, узелId) {
    this.#убратьМеню();

    const свод = this.свод;
    const у = узел(свод, узелId);
    if (!у) return;
    const как = какОтмечен(свод, узелId);

    const пункты = [
      { действие: "открытьУзел", подпись: Т("Открыть страницу") },
      { действие: "заметка", подпись: Т("Замечание…") },
      { разделитель: true },
      { действие: "отметить", подпись: Т("Случилось"), отмечен: как === КАК.полностью },
      { действие: "частично", подпись: Т("Случилось частично"), отмечен: как === КАК.частично },
      { действие: "снять", подпись: Т("Не случилось"), отмечен: как === КАК.нет },
      { разделитель: true },
      { действие: "правитьУзел", подпись: Т("Настройки узла") },
      { действие: "тянуть", подпись: Т("Тянуть стрелку") },
      { действие: "началоЗдесь", подпись: Т("Начало здесь") },
      { разделитель: true },
      { действие: "удалитьУзел", подпись: Т("Убрать узел"), опасно: true },
    ];

    const меню = document.createElement("nav");
    меню.className = "uo-vetvi-menu";
    меню.innerHTML = пункты.map(п => п.разделитель
      ? `<hr>`
      : `<button type="button" data-action="${п.действие}" data-uzel="${узелId}"
           class="${п.опасно ? "uo-opasno" : ""} ${п.отмечен ? "uo-vybrano" : ""}">${п.подпись}</button>`).join("");

    const к = this.element.getBoundingClientRect();
    меню.style.left = `${событие.clientX - к.left}px`;
    меню.style.top = `${событие.clientY - к.top}px`;

    // Щелчок по пункту закрывает меню; само действие уедет штатным обработчиком.
    меню.addEventListener("click", () => this.#убратьМеню());

    this.element.appendChild(меню);
  }

  #применитьВид(холст) {
    холст.style.transform = `translate(${this.вид.x}px, ${this.вид.y}px) scale(${this.вид.м})`;
  }

  #тащитьХолст(событие, холст) {
    const начало = { x: событие.clientX, y: событие.clientY, вx: this.вид.x, вy: this.вид.y };
    const вести = е => {
      this.вид.x = начало.вx + (е.clientX - начало.x);
      this.вид.y = начало.вy + (е.clientY - начало.y);
      this.#применитьВид(холст);
    };
    const бросить = () => {
      window.removeEventListener("pointermove", вести);
      window.removeEventListener("pointerup", бросить);
    };
    window.addEventListener("pointermove", вести);
    window.addEventListener("pointerup", бросить);
  }

  /**
   * Перетаскивание карточки. Пока тащим — двигаем сам div, и только на отпускании
   * пишем в страницу: иначе каждое движение мыши было бы записью в базу.
   */
  #тащитьУзел(событие, карточка) {
    if (событие.target.closest("button")) return;
    const узелId = карточка.dataset.uzel;
    const начало = {
      x: событие.clientX, y: событие.clientY,
      кx: parseFloat(карточка.style.left) || 0,
      кy: parseFloat(карточка.style.top) || 0,
    };
    let двигали = false;

    const вести = е => {
      const дx = (е.clientX - начало.x) / this.вид.м;
      const дy = (е.clientY - начало.y) / this.вид.м;
      if (Math.abs(дx) > 2 || Math.abs(дy) > 2) двигали = true;
      карточка.style.left = `${Math.round(начало.кx + дx)}px`;
      карточка.style.top = `${Math.round(начало.кy + дy)}px`;
    };
    const бросить = async () => {
      window.removeEventListener("pointermove", вести);
      window.removeEventListener("pointerup", бросить);
      if (!двигали) return;
      await правитьУзел(this.журнал, узелId, {
        x: Math.round(parseFloat(карточка.style.left)),
        y: Math.round(parseFloat(карточка.style.top)),
      });
    };
    window.addEventListener("pointermove", вести);
    window.addEventListener("pointerup", бросить);
  }

  /* ─── рычаги ─── */

  static async #новыйУзел() {
    const где = { x: Math.round(-this.вид.x / this.вид.м) + 80, y: Math.round(-this.вид.y / this.вид.м) + 80 };
    const имя = await спросить(Т("Новый узел"), Т("Название"), Т("Новый узел"));
    if (имя === null) return;
    await добавитьУзел(this.журнал, { имя, вид: "сцена", ...где });
  }

  static async #разложить() {
    const свод = this.свод;
    const места = слои(свод);
    for (const у of свод.узлы) {
      const м = места[у.id];
      if (м) await правитьУзел(this.журнал, у.id, { x: м.x, y: м.y });
    }
  }

  static #поЦентру() {
    this.вид = { x: 0, y: 0, м: 1 };
    this.render();
  }

  static #выбрать(event, target) {
    const узелId = target.dataset.uzel;
    if (this.связьОт === узелId) { this.связьОт = null; return this.render(); }   // передумали тянуть
    if (this.связьОт) {
      const откуда = this.связьОт;
      this.связьОт = null;
      return связать(this.журнал, откуда, узелId);
    }
    this.выбран = { тип: "узел", id: узелId };
    this.render();
  }

  static #выбратьРебро(event, target) {
    this.выбран = { тип: "ребро", id: target.dataset.rebro };
    this.render();
  }

  static #тянуть(event, target) {
    this.связьОт = target.dataset.uzel;
    this.render();
  }

  static #открытьУзел(event, target) {
    const страница = this.журнал.pages.get(target.dataset.uzel);
    if (страница) this.журнал.sheet.render(true, { pageId: страница.id });
  }

  static async #правитьУзел(event, target) {
    await диалогУзла(this.журнал, target.dataset.uzel);
  }

  static async #удалитьУзел(event, target) {
    const узелId = target.dataset.uzel;
    const страница = this.журнал.pages.get(узелId);
    const ладно = await DialogV2.confirm({
      window: { title: Т("Убрать узел") },
      content: `<p>${Т("Убрать «{имя}» вместе с текстом и всеми стрелками?",
        { имя: экранировать(страница?.name ?? Т("узел")) })}</p>`,
    });
    if (!ладно) return;
    if (this.выбран?.id === узелId) this.выбран = null;
    await удалитьУзел(this.журнал, узелId);
  }

  static async #началоЗдесь(event, target) { await назначитьНачало(this.журнал, target.dataset.uzel); }
  static async #отметить(event, target) { await отметить(this.журнал, target.dataset.uzel, КАК.полностью); }
  static async #частично(event, target) { await отметить(this.журнал, target.dataset.uzel, КАК.частично); }
  static async #снять(event, target) { await снятьОтметку(this.журнал, target.dataset.uzel); }
  static async #заметка(event, target) { await диалогЗаметки(this.журнал, target.dataset.uzel); }

  static async #новаяГруппа() { await диалогГруппы(this.журнал); }
  static async #правитьГруппуДиалог(event, target) { await диалогГруппы(this.журнал, target.dataset.gruppa); }

  static async #убратьГруппу(event, target) {
    const г = группа(this.свод, target.dataset.gruppa);
    const ладно = await DialogV2.confirm({
      window: { title: Т("Убрать группу") },
      content: `<p>${Т("Убрать группу «{имя}»? Узлы останутся, просто потеряют цвет.", { имя: экранировать(г?.имя ?? "") })}</p>`,
    });
    if (ладно) await удалитьГруппу(this.журнал, target.dataset.gruppa);
  }

  static async #правитьРебро(event, target) { await диалогРебра(this.журнал, target.dataset.rebro); }

  static async #удалитьРебро(event, target) {
    if (this.выбран?.id === target.dataset.rebro) this.выбран = null;
    await удалитьРебро(this.журнал, target.dataset.rebro);
  }

  static async #новаяМетка() {
    const имя = await спросить(Т("Новая метка"), Т("Что случилось в мире"), "");
    if (!имя) return;
    await завестиМетку(this.журнал, имя);
  }

  static async #переключитьМетку(event, target) {
    await переключитьМетку(this.журнал, target.dataset.metka, target.checked);
  }

  static async #убратьМетку(event, target) {
    const свод = this.свод;
    const м = метка(свод, target.dataset.metka);
    const ладно = await DialogV2.confirm({
      window: { title: Т("Убрать метку") },
      content: `<p>${Т("Убрать метку «{имя}» из сценария? Она исчезнет и из условий стрелок.",
        { имя: экранировать(м?.имя ?? "") })}</p>`,
    });
    if (ладно) await удалитьМетку(this.журнал, target.dataset.metka);
  }

  static async #заново() {
    const п = this.свод.партия;
    const ладно = await DialogV2.confirm({
      window: { title: Т("Начать заново") },
      content: `<p>${п
        ? Т("Забыть, что случилось у партии «{партия}», и снять её метки? Сценарий и остальные партии останутся целы.",
          { партия: экранировать(п.имя) })
        : Т("Забыть, что уже случилось, и снять все метки? Сам сценарий останется цел.")}</p>`,
    });
    if (ладно) await начатьЗаново(this.журнал);
  }

  /* ─── партии ─── */

  static async #перейтиКПартии(event, target) {
    await перейтиКПартии(this.журнал, target.dataset.partiya);
  }

  static async #новаяПартия() {
    await диалогПартии(this.журнал);
  }

  static async #правитьПартиюДиалог(event, target) {
    await диалогПартии(this.журнал, target.dataset.partiya);
  }

  /**
   * Раскол: новая партия перенимает ход прежней.
   *
   * За столом это случается так: половина игроков уходит своим путём с того
   * же места. Переписывать десяток отметок руками — работа ни о чём.
   */
  static async #расколПартии(event, target) {
    const п = партия(this.журнал, target.dataset.partiya);
    const имя = await спросить(Т("Раскол партии"),
      Т("Отделившаяся начнёт с того же места, что «{партия}»", { партия: п?.имя ?? "" }), "");
    if (!имя) return;
    await размножитьПартию(this.журнал, target.dataset.partiya, имя);
  }

  static async #убратьПартию(event, target) {
    const п = партия(this.журнал, target.dataset.partiya);
    const ладно = await DialogV2.confirm({
      window: { title: Т("Убрать партию") },
      content: `<p>${Т("Убрать партию «{партия}» вместе с её пройденным и замечаниями? Сценарий и остальные партии останутся целы.",
        { партия: экранировать(п?.имя ?? "") })}</p>`,
    });
    if (!ладно) return;
    if (!(await удалитьПартию(this.журнал, target.dataset.partiya))) {
      ui.notifications.warn(Т("Это последняя партия — её ход и есть весь прогресс. Убрать нельзя."));
    }
  }

  static #проверить() {
    const свод = this.свод;
    const р = разбор(свод);
    const имя = id => узел(свод, id)?.имя ?? "?";

    const строки = [
      р.безНачала ? `<li>${Т("Начало не назначено — непонятно, откуда кампания стартует.")}</li>` : "",
      р.безФиналов ? `<li>${Т("Нет ни одного узла вида «финал» — считать нечего.")}</li>` : "",
      р.сироты.length ? `<li>${Т("Ни от чего не ведут: {кто}.",
        { кто: р.сироты.map(имя).map(экранировать).join(", ") })}</li>` : "",
      р.тупики.length ? `<li>${Т("Тупики без пометки «финал»: {кто}.",
        { кто: р.тупики.map(имя).map(экранировать).join(", ") })}</li>` : "",
      р.финалыСВыходом.length ? `<li>${Т("Из финала есть выход: {кто}.",
        { кто: р.финалыСВыходом.map(имя).map(экранировать).join(", ") })}</li>` : "",
      р.запасСоВходом?.length ? `<li>${Т("В запас ведут стрелки — может, это обычная сцена: {кто}.",
        { кто: р.запасСоВходом.map(имя).map(экранировать).join(", ") })}</li>` : "",
      р.меткиНиоткуда.length ? `<li>${Т("Метки нужны, но их никто не ставит: {кто}.",
        { кто: р.меткиНиоткуда.map(id => метка(свод, id)?.имя ?? "?").map(экранировать).join(", ") })}</li>` : "",
      р.висячие.length ? `<li>${Т("Стрелки в никуда: {сколько}.", { сколько: р.висячие.length })}</li>` : "",
    ].filter(Boolean).join("");

    return DialogV2.prompt({
      window: { title: Т("Разбор сценария") },
      content: строки
        ? `<p>${Т("Что стоит поправить:")}</p><ul class="uo-vetvi-razbor">${строки}</ul>
           <p class="uo-vetvi-tiho">${Т("Это замечания, а не запреты: сценарий с висящим узлом играется, просто автор обычно хочет об этом знать.")}</p>`
        : `<p>${Т("Сценарий сходится: начало есть, тупиков нет, все узлы достижимы.")}</p>`,
      ok: { label: Т("Понятно") },
    });
  }
}

/* ─────────────────────────── диалоги ─────────────────────────── */

async function спросить(заголовок, подпись, значение = "") {
  return DialogV2.prompt({
    window: { title: заголовок },
    content: `<div class="uo-forma"><label>${экранировать(подпись)}
      <input type="text" name="что" value="${экранировать(значение)}" autofocus></label></div>`,
    ok: {
      label: Т("Готово"),
      callback: (event, кнопка, диалог) => диалог.element.querySelector(`[name="что"]`)?.value?.trim() ?? "",
    },
  }).catch(() => null);
}

/** Правка узла: имя, вид и какие метки он ставит и снимает. */
export async function диалогУзла(журнал, узелId) {
  const свод = свести(журнал);
  const у = узел(свод, узелId);
  if (!у) return;

  const виды = Object.entries(ВИДЫ).map(([id, в]) =>
    `<option value="${id}" ${у.вид === id ? "selected" : ""}>${в.знак} ${Т(в.имя)}</option>`).join("");

  const метки = свод.метки.length ? свод.метки.map(м => `
    <tr>
      <td>${экранировать(м.имя)}</td>
      <td><input type="checkbox" name="ставит" value="${м.id}" ${(у.ставит ?? []).includes(м.id) ? "checked" : ""}></td>
      <td><input type="checkbox" name="снимает" value="${м.id}" ${(у.снимает ?? []).includes(м.id) ? "checked" : ""}></td>
    </tr>`).join("") : `<tr><td colspan="3" class="uo-vetvi-tiho">${Т("Меток в сценарии нет.")}</td></tr>`;

  return DialogV2.wait({
    window: { title: Т("Узел сценария") },
    position: { width: 460 },
    content: `
      <div class="uo-forma">
        <label>${Т("Название")} <input type="text" name="имя" value="${экранировать(у.имя)}"></label>
        <label>${Т("Вид")} <select name="вид">${виды}</select></label>
        <label>${Т("Ветка")} <select name="группа">
          <option value="">${Т("— без ветки —")}</option>
          ${свод.группы.map(г => `<option value="${г.id}" ${у.группа === г.id ? "selected" : ""}>${экранировать(г.имя)}</option>`).join("")}
        </select></label>
        <p class="uo-vetvi-tiho">${Т("Вид — не украшение. К <strong>сцене</strong> можно вернуться, а <strong>развилка</strong> захлопывается: как только пройден один её выход, остальные закрыты навсегда — на этом и держится подсчёт отрезанного.")}</p>
        <p class="uo-vetvi-tiho">${Т("<strong>Запас</strong> — сцена в рукаве: спасение, которое тратят по обстановке. Стрелок к нему не ведут; потраченный отмечают пройденным, и его выходы открываются. Разбор не зовёт его сиротой, а подсчёт считает доступным всегда.")}</p>
        <p class="uo-vetvi-tiho">${Т("Что этот узел меняет в мире — метки ставятся, когда узел отмечают как случившийся.")}</p>
        <table class="uo-vetvi-tablica">
          <thead><tr><th>${Т("Метка")}</th><th>${Т("ставит")}</th><th>${Т("снимает")}</th></tr></thead>
          <tbody>${метки}</tbody>
        </table>
      </div>`,
    buttons: [
      {
        action: "готово", label: Т("Сохранить"), default: true,
        callback: async (event, кнопка, диалог) => {
          const э = диалог.element;
          await правитьУзел(журнал, узелId, {
            имя: э.querySelector(`[name="имя"]`).value.trim() || у.имя,
            вид: э.querySelector(`[name="вид"]`).value,
            группа: э.querySelector(`[name="группа"]`).value || null,
            ставит: [...э.querySelectorAll(`[name="ставит"]:checked`)].map(и => и.value),
            снимает: [...э.querySelectorAll(`[name="снимает"]:checked`)].map(и => и.value),
          });
        },
      },
      { action: "отмена", label: Т("Отмена") },
    ],
  });
}

/** Правка стрелки: подпись и условие из меток. */
export async function диалогРебра(журнал, реброId) {
  const свод = свести(журнал);
  const р = ребро(свод, реброId);
  if (!р) return;

  const метки = свод.метки.length ? свод.метки.map(м => `
    <tr>
      <td>${экранировать(м.имя)}</td>
      <td><input type="checkbox" name="нужны" value="${м.id}" ${(р.нужны ?? []).includes(м.id) ? "checked" : ""}></td>
      <td><input type="checkbox" name="запрещены" value="${м.id}" ${(р.запрещены ?? []).includes(м.id) ? "checked" : ""}></td>
    </tr>`).join("") : `<tr><td colspan="3" class="uo-vetvi-tiho">${Т("Меток в сценарии нет.")}</td></tr>`;

  return DialogV2.wait({
    window: { title: Т("Стрелка") },
    position: { width: 460 },
    content: `
      <div class="uo-forma">
        <p class="uo-vetvi-tiho">${экранировать(узел(свод, р.из)?.имя ?? "?")} → ${
          экранировать(узел(свод, р.в)?.имя ?? "?")}</p>
        <label>${Т("Подпись")} <input type="text" name="подпись" value="${экранировать(р.подпись ?? "")}"
          placeholder="${Т("«если отдали печать»")}"></label>
        <p class="uo-vetvi-tiho">${Т("Условие: стрелка открыта, когда все нужные метки стоят, а ни одной запрещённой нет.")}</p>
        <table class="uo-vetvi-tablica">
          <thead><tr><th>${Т("Метка")}</th><th>${Т("нужна")}</th><th>${Т("мешает")}</th></tr></thead>
          <tbody>${метки}</tbody>
        </table>
      </div>`,
    buttons: [
      {
        action: "готово", label: Т("Сохранить"), default: true,
        callback: async (event, кнопка, диалог) => {
          const э = диалог.element;
          await правитьРебро(журнал, реброId, {
            подпись: э.querySelector(`[name="подпись"]`).value.trim(),
            нужны: [...э.querySelectorAll(`[name="нужны"]:checked`)].map(и => и.value),
            запрещены: [...э.querySelectorAll(`[name="запрещены"]:checked`)].map(и => и.value),
          });
        },
      },
      { action: "отмена", label: Т("Отмена") },
    ],
  });
}

/* ─────────────────────────── открыть окно ─────────────────────────── */

const окна = new Map();

export async function открыть(журнал) {
  if (!game.user.isGM || !журнал) return null;
  const было = окна.get(журнал.id);
  if (было?.rendered) return было.bringToFront?.() ?? было;

  // Партия должна быть до первого взгляда: сценарий приезжает из компендиума
  // без партий, а водимый прежде — с одним общим ходом, который здесь и
  // становится ходом первой партии.
  await обеспечитьПартию(журнал);

  const окно = new ОкноГрафа({ журнал, id: `${MODULE_ID}-${журнал.id}` });
  окна.set(журнал.id, окно);
  окно.render(true);
  return окно;
}


/**
 * Замечание ведущего к узлу.
 *
 * Живёт в ходе кампании, а не в сценарии: «книгу нашли, но не прочли» —
 * это про эту партию, а не про сценарий вообще. Уедет сценарий другому
 * ведущему — замечания останутся здесь.
 */
export async function диалогЗаметки(журнал, узелId) {
  const свод = свести(журнал);
  const у = узел(свод, узелId);
  if (!у) return;
  const было = свод.ход.заметки?.[узелId] ?? "";

  return DialogV2.wait({
    window: { title: Т("Замечание к узлу") },
    position: { width: 460 },
    content: `
      <div class="uo-forma">
        <p class="uo-vetvi-tiho">${Т("Чем кончилось и что осталось: «книгу нашли, но не прочли», «уговор в силе до полнолуния». Видно только вам.")}</p>
        <label class="uo-vetvi-stolbik">${экранировать(у.имя)}
          <textarea name="текст" rows="4">${экранировать(было)}</textarea>
        </label>
      </div>`,
    buttons: [
      {
        action: "готово", label: Т("Сохранить"), default: true,
        callback: (event, кнопка, диалог) =>
          заметкаУзла(журнал, узелId, диалог.element.querySelector(`[name="текст"]`).value),
      },
      { action: "отмена", label: Т("Отмена") },
    ],
  });
}

/**
 * Партия: имя, цвет и заметка о составе. Новая — если id не передан.
 *
 * Заметка нужна не для порядка: две компании в одном мире путаются именно
 * по составу — «эти которые с дриадой» вспоминается быстрее, чем название.
 */
export async function диалогПартии(журнал, партияId = null) {
  const п = партияId ? партия(журнал, партияId) : null;
  const цвета = ЦВЕТА.slice(1);

  return DialogV2.wait({
    window: { title: п ? Т("Партия") : Т("Новая партия"), icon: "fa-solid fa-users" },
    position: { width: 440 },
    content: `
      <div class="uo-forma">
        <p class="uo-vetvi-tiho">${Т("Схема у всех партий одна: новый узел или стрелка появятся сразу у всех. Своё у партии — пройденное, поднятые метки и замечания.")}</p>
        <label>${Т("Название")} <input type="text" name="имя" value="${экранировать(п?.имя ?? "")}" autofocus></label>
        <label>${Т("Кто играет")} <input type="text" name="заметка" value="${экранировать(п?.заметка ?? "")}" placeholder="${Т("состав, день недели — что поможет не спутать")}"></label>
        <!-- У новой партии цвет не отмечен нарочно: не выбрали — возьмётся
             следующий свободный, и две партии не окажутся одного цвета. -->
        <div class="uo-vetvi-cveta">
          ${цвета.map(ц => `
            <label class="uo-vetvi-cvet" style="background: ${ц}">
              <input type="radio" name="цвет" value="${ц}" ${п?.цвет === ц ? "checked" : ""}>
            </label>`).join("")}
        </div>
      </div>`,
    buttons: [
      {
        action: "готово", label: Т("Сохранить"), default: true,
        callback: async (event, кнопка, диалог) => {
          const э = диалог.element;
          const имя = э.querySelector(`[name="имя"]`).value.trim();
          const заметка = э.querySelector(`[name="заметка"]`).value.trim();
          const цвет = э.querySelector(`[name="цвет"]:checked`)?.value ?? null;
          if (!имя) return;
          if (п) await правитьПартию(журнал, п.id, { имя, заметка, цвет: цвет ?? п.цвет });
          else await завестиПартию(журнал, имя, { цвет, заметка });
        },
      },
      { action: "отмена", label: Т("Отмена") },
    ],
  });
}

/** Ветка сценария: имя и цвет. Новая — если id не передан. */
export async function диалогГруппы(журнал, группаId = null) {
  const свод = свести(журнал);
  const г = группаId ? группа(свод, группаId) : null;
  const цвета = ЦВЕТА.slice(1);

  return DialogV2.wait({
    window: { title: г ? Т("Ветка сценария") : Т("Новая ветка") },
    position: { width: 440 },
    content: `
      <div class="uo-forma">
        <p class="uo-vetvi-tiho">${Т("Ветка — только для глаза: узлы одной ветки видно цветом. На правила она не влияет, и узел одной ветки может вести в другую.")}</p>
        <label>${Т("Название")} <input type="text" name="имя" value="${экранировать(г?.имя ?? "")}" autofocus></label>
        <div class="uo-vetvi-cveta">
          ${цвета.map((ц, i) => `
            <label class="uo-vetvi-cvet" style="background: ${ц}">
              <input type="radio" name="цвет" value="${ц}" ${(г?.цвет ?? цвета[0]) === ц ? "checked" : ""}>
            </label>`).join("")}
        </div>
      </div>`,
    buttons: [
      {
        action: "готово", label: Т("Сохранить"), default: true,
        callback: async (event, кнопка, диалог) => {
          const э = диалог.element;
          const имя = э.querySelector(`[name="имя"]`).value.trim();
          const цвет = э.querySelector(`[name="цвет"]:checked`)?.value ?? цвета[0];
          if (!имя) return;
          if (г) await правитьГруппу(журнал, г.id, { имя, цвет });
          else await завестиГруппу(журнал, имя, цвет);
        },
      },
      { action: "отмена", label: Т("Отмена") },
    ],
  });
}
