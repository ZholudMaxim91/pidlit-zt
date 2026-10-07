/*
 * Дані: ціль (центр Житомира) та населені пункти.
 *
 * Координати:
 *  - src: "geonames"  — відкрита база GeoNames (geonames.org, CC BY 4.0);
 *  - src: "map"       — визначено за прив'язаними скріншотами карти
 *                       (похибка орієнтовно до 0,5 км).
 *
 * aliases — інші написання (рос., стара назва, латиниця) для пошуку.
 */
window.ZT_TARGET = {
  name: "Житомир (центр)",
  note: "Соборний майдан",
  lat: 50.25465,
  lon: 28.65867
};

window.ZT_PLACES = [
  { name: "Овруч",        lat: 51.32460, lon: 28.80351, src: "geonames", aliases: ["Ovruch"] },
  { name: "Народичі",     lat: 51.20286, lon: 29.08228, src: "geonames", aliases: ["Народичи", "Narodychi"] },
  { name: "Лугини",       lat: 51.08203, lon: 28.40057, src: "geonames", aliases: ["Лугины", "Luhyny"] },
  { name: "Коростень",    lat: 50.95937, lon: 28.63855, src: "geonames", aliases: ["Korosten"] },
  { name: "Іванків",      lat: 50.93865, lon: 29.89426, src: "geonames", aliases: ["Иванков", "Ivankiv"] },
  { name: "Ємільчине",    lat: 50.87349, lon: 27.80604, src: "geonames", aliases: ["Емильчино", "Yemilchyne"] },
  { name: "Чоповичі",     lat: 50.83325, lon: 28.95334, src: "geonames", aliases: ["Чоповичи", "Chopovychi"] },
  { name: "Малин",        lat: 50.77233, lon: 29.23833, src: "geonames", aliases: ["Malyn"] },
  { name: "Іршанськ",     lat: 50.74984, lon: 28.71857, src: "map",      aliases: ["Иршанск", "Irshansk"] },
  { name: "Звягель",      lat: 50.59412, lon: 27.61650, src: "geonames", aliases: ["Новоград-Волинський", "Новоград-Волынский", "Zviahel", "Novohrad-Volynskyi"] },
  { name: "Радомишль",    lat: 50.49613, lon: 29.22911, src: "geonames", aliases: ["Радомышль", "Radomyshl"] },
  { name: "Наливайківка", lat: 50.48979, lon: 29.71488, src: "map",      aliases: ["Наливайковка", "Nalyvaikivka"] },
  { name: "Черняхів",     lat: 50.45652, lon: 28.67018, src: "geonames", aliases: ["Черняхов", "Cherniakhiv"] },
  { name: "Довбиш",       lat: 50.37332, lon: 27.98742, src: "geonames", aliases: ["Довбыш", "Dovbysh"] },
  { name: "Вереси",       lat: 50.33770, lon: 28.75898, src: "map",      aliases: ["Вересы", "Veresy"] },
  { name: "Коростишів",   lat: 50.31723, lon: 29.05630, src: "geonames", aliases: ["Коростышев", "Korostyshiv"] },
  { name: "Баранівка",    lat: 50.29691, lon: 27.66220, src: "geonames", aliases: ["Барановка", "Baranivka"] },
  { name: "Брусилів",     lat: 50.28449, lon: 29.52626, src: "geonames", aliases: ["Брусилов", "Brusyliv"] },
  { name: "Левків",       lat: 50.23764, lon: 28.83787, src: "map",      aliases: ["Левков", "Levkiv"] },
  { name: "Тетерівка",    lat: 50.23562, lon: 28.56963, src: "map",      aliases: ["Тетеревка", "Teterivka"] },
  { name: "Деніши",       lat: 50.21415, lon: 28.40395, src: "geonames", aliases: ["Дениши", "Denyshi"] },
  { name: "Гуйва",        lat: 50.20887, lon: 28.65602, src: "map",      aliases: ["Huiva", "Guyva"] },
  { name: "Висока Піч",   lat: 50.19803, lon: 28.26771, src: "map",      aliases: ["Высокая Печь", "Vysoka Pich"] },
  { name: "Скоморохи",    lat: 50.19246, lon: 28.73807, src: "map",      aliases: ["Skomorokhy"] },
  { name: "Шепетівка",    lat: 50.18545, lon: 27.06365, src: "geonames", aliases: ["Шепетовка", "Shepetivka"] },
  { name: "Озерне",       lat: 50.17816, lon: 28.73384, src: "geonames", aliases: ["Озерное", "Ozerne"] },
  { name: "Ліщин",        lat: 50.15077, lon: 28.84576, src: "map",      aliases: ["Лещин", "Lishchyn"] },
  { name: "Корнин",       lat: 50.09530, lon: 29.53581, src: "geonames", aliases: ["Kornyn"] },
  { name: "Попільня",     lat: 49.95320, lon: 29.45265, src: "geonames", aliases: ["Попельня", "Popilnia"] },
  { name: "Любар",        lat: 49.92045, lon: 27.75918, src: "geonames", aliases: ["Liubar"] },
  { name: "Бердичів",     lat: 49.89928, lon: 28.60235, src: "geonames", aliases: ["Бердичев", "Berdychiv"] },
  { name: "Козятин",      lat: 49.71431, lon: 28.83385, src: "geonames", aliases: ["Казатин", "Koziatyn"] }
];
