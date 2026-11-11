// История клуба — только факты, сверенные с официальными источниками: NBA.com (сайт лиги) и сайтом клуба
// (nba.com/warriors). У каждого факта — ключи источников из SOURCES. Что не подтвердилось — не включено.
// Рекорды, которые ещё могут обновиться, сверены заново и помечены датой проверки (checked: true).
// Имена игроков и команд — латиницей, как в источниках и на остальных страницах сайта.

/** Когда факты сверены с источниками. */
export const CHECKED = '2026-11-11';

/**
 * short — короткое название для ссылки; date — дата публикации или обновления страницы;
 * stats: true — живая таблица NBA.com, date = день проверки.
 */
export const SOURCES = {
  origins: {short: 'Истоки клуба', site: 'Сайт клуба', date: '2022-02-09', title: 'Warriors Origins: History Between Dubs, Knicks and Celtics',
    url: 'https://www.nba.com/warriors/news-blogs/warriors-origins-20220209'},
  oracle: {short: '47 сезонов в «Оракл-арене»', site: 'Сайт клуба', date: '2019-04-05', title: 'Celebrating 47 Seasons at Oracle Arena',
    url: 'https://www.nba.com/warriors/47-seasons-at-oracle'},
  chase: {short: 'Первый матч в «Чейз-центре»', site: 'Сайт клуба', date: '2019-10-24', title: 'Warriors Opening Night at Chase Center: What to Look Forward To',
    url: 'https://www.nba.com/warriors/news-blogs/opening-night-activities-20191024'},
  title1947: {short: 'Первый титул, 1947', site: 'NBA.com', date: '2021-09-14', title: 'Top Moments: Howie Dallmar, Philadelphia Warriors win first NBA title',
    url: 'https://www.nba.com/news/history-top-moments-warriors-first-nba-title-1947'},
  s1956: {short: 'Обзор сезона 1955/56', site: 'NBA.com', date: '2021-09-13', title: 'Season Review: 1955-56',
    url: 'https://www.nba.com/news/history-season-review-1955-56'},
  s1975: {short: 'Обзор сезона 1974/75', site: 'NBA.com', date: '2021-09-13', title: 'Season Review: 1974-75',
    url: 'https://www.nba.com/news/history-season-review-1974-75'},
  s2015: {short: 'Обзор сезона 2014/15', site: 'NBA.com', date: '2021-09-13', title: 'Season Review: 2014-15',
    url: 'https://www.nba.com/news/history-season-review-2014-15'},
  s2016: {short: 'Обзор сезона 2015/16', site: 'NBA.com', date: '2021-09-13', title: 'Season Review: 2015-16',
    url: 'https://www.nba.com/news/history-season-review-2015-16'},
  s2017: {short: 'Обзор сезона 2016/17', site: 'NBA.com', date: '2021-09-13', title: 'Season Review: 2016-17',
    url: 'https://www.nba.com/news/history-season-review-2016-17'},
  s2018: {short: 'Обзор сезона 2017/18', site: 'NBA.com', date: '2021-09-13', title: 'Season Review: 2017-18',
    url: 'https://www.nba.com/news/history-season-review-2017-18'},
  s2022: {short: 'Обзор сезона 2021/22', site: 'NBA.com', date: '2022-08-12', title: 'Season Review: 2021-22',
    url: 'https://www.nba.com/news/history-season-review-2021-22'},
  s2026: {short: 'Обзор сезона 2025/26', site: 'NBA.com', date: '2026-06-29', title: 'Season Review: 2025-26',
    url: 'https://www.nba.com/news/season-review-2025-26'},
  finalsMvp: {short: 'Все MVP финалов', site: 'NBA.com', date: '2026-06-14', title: 'NBA Finals MVP winners',
    url: 'https://www.nba.com/news/history-finals-mvp-winners'},
  retired: {short: 'Выведенные номера', site: 'NBA.com', date: '2024-10-22', title: 'Numbers retired by Golden State Warriors',
    url: 'https://www.nba.com/news/numbers-retired-by-golden-state-warriors'},
  iguodala: {short: 'Номер Iguodala выведен', site: 'Сайт клуба', date: '2025-02-23', title: "Warriors Retire Andre Iguodala's Number 9 Jersey at Chase Center",
    url: 'https://www.nba.com/warriors/news/andre-iguodalas-number-9-jersey-retired-at-chase-center-20250223'},
  wilt: {short: 'Профиль Wilt Chamberlain', site: 'NBA.com', date: '2021-09-13', title: 'Legends profile: Wilt Chamberlain',
    url: 'https://www.nba.com/news/history-nba-legend-wilt-chamberlain'},
  points100: {short: 'Больше всех очков за матч', site: 'NBA.com', date: '2026-03-11', title: 'Most points scored by a player in an NBA game',
    url: 'https://www.nba.com/news/most-points-scored-by-a-player-in-an-nba-game'},
  wins73: {short: 'Рекорд 73–9 и Thunder', site: 'NBA.com', date: '2025-12-03', title: "10 years after Warriors' record 73-9 run, OKC is on pace to rewrite history",
    url: 'https://www.nba.com/news/okc-thunder-pursuit-73-wins-2025-26'},
  start2025: {short: 'Старт Thunder 24–1', site: 'NBA.com', date: '2025-12-11', title: 'At 24-1, Thunder tie 2015-16 Warriors for the best 25-game start in NBA history',
    url: 'https://www.nba.com/news/inside-numbers-thunder-start'},
  threes402: {short: 'Рекорд новичка Knueppel', site: 'NBA.com', date: '2026-02-28', title: "Hornets' Kon Knueppel breaks NBA rookie record for 3-pointers in a season",
    url: 'https://www.nba.com/news/hornets-kon-knueppel-breaks-nba-rookie-record-for-3-pointers-in-a-season-in-just-59-games'},
  season3: {short: 'Лидеры 2025/26 по трёхочковым', site: 'NBA.com Stats', date: CHECKED, stats: true, title: 'Season Leaders 2025-26: 3-pointers made',
    url: 'https://www.nba.com/stats/leaders?StatCategory=FG3M&Season=2025-26&SeasonType=Regular%20Season&PerMode=Totals'},
  career3: {short: 'Трёхочковые за всю историю', site: 'NBA.com Stats', date: CHECKED, stats: true, title: 'All Time Leaders: 3-pointers made (regular season)',
    url: 'https://www.nba.com/stats/alltime-leaders?StatCategory=FG3M'},
  threes14: {short: 'Больше всех трёхочковых за матч', site: 'NBA.com', date: '2024-09-24', title: 'Most 3-pointers made by a player in a single NBA game',
    url: 'https://www.nba.com/news/most-3-pointers-made-single-game-nba-history'},
  quarter37: {short: '37 очков за четверть', site: 'Сайт клуба', date: '2020-01-23', title: "On This Date in Warriors History: Klay's 37-Point Quarter",
    url: 'https://www.nba.com/warriors/news-blogs/tdiwh-klay37'},
  klayNow: {short: 'Starting 5, 8 ноября 2026', site: 'NBA.com', date: '2026-11-08', title: 'Starting 5: Steph Curry cooks, 7-game Sunday ahead',
    url: 'https://www.nba.com/news/starting-5-november-8-2026'},
  curryWilt: {short: 'Curry — лучший бомбардир клуба', site: 'NBA.com', date: '2021-04-13', title: 'Stephen Curry passes Wilt Chamberlain for Warriors all-time scoring record',
    url: 'https://www.nba.com/news/stephen-curry-passes-wilt-chamberlain-for-warriors-all-time-scoring-record'},
};

/** Главное — крупными цифрами. */
export const ACHIEVEMENTS = [
  {value: '7', label: 'титулов чемпиона НБА', note: '1947, 1956, 1975, 2015, 2017, 2018, 2022',
    src: ['origins']},
  {value: '5', label: 'наград MVP финала', note: 'Rick Barry, Andre Iguodala, Kevin Durant (дважды), Stephen Curry',
    src: ['finalsMvp']},
  {value: '73–9', label: 'лучший результат в истории НБА', note: 'сезон 2015/16', checked: true,
    src: ['wins73', 's2026']},
  {value: '7', label: 'номеров выведено из обращения', note: '9, 13, 14, 16, 17, 24, 42',
    src: ['retired', 'iguodala']},
];

/** Чемпионские сезоны. mvp — MVP финала по списку NBA.com (в 1947 и 1956 годах его в списке нет). */
export const TITLES = [
  {year: 1947, season: '1946/47', team: 'Philadelphia Warriors', opp: 'Chicago Stags', series: '4–1',
    facts: [
      'Первый сезон лиги: тогда она называлась BAA, а название НБА появилось в 1949 году. «Уорриорз» стали её первым чемпионом.',
      'В регулярном чемпионате у соперника было больше побед — 39 против 35. Тренер — Eddie Gottlieb.',
      'В пятом матче лучший бомбардир лиги Joe Fulks набрал 34 очка, а при счёте 80:80 меньше чем за минуту до конца победный бросок сделал Howie Dallmar — 83:80.',
    ],
    src: ['title1947', 'origins']},
  {year: 1956, season: '1955/56', team: 'Philadelphia Warriors', opp: 'Fort Wayne Pistons', series: '4–1',
    facts: [
      'Лидеры команды — Paul Arizin, новичок Tom Gola и ветеран Neil Johnston.',
      'В финале Восточного дивизиона «Уорриорз» обыграли Syracuse Nationals — 4–3.',
      'Arizin набрал 289 очков в 10 матчах плей-офф — больше за один розыгрыш до него набирал только George Mikan.',
    ],
    src: ['s1956']},
  {year: 1975, season: '1974/75', team: 'Golden State Warriors', opp: 'Washington Bullets', series: '4–0', mvp: 'Rick Barry',
    facts: [
      'По составу фаворитом считался «Вашингтон», но «Голден Стэйт» (48 побед в сезоне) выиграл четыре упорных матча подряд. «Сухой» финал был всего третьим за 29 лет.',
      'Rick Barry набирал в сезоне 30,6 очка за матч; Jamaal Wilkes признан лучшим новичком года. Главный тренер — Al Attles.',
      'Первый титул НБА для района залива Сан-Франциско.',
    ],
    src: ['s1975', 'oracle']},
  {year: 2015, season: '2014/15', team: 'Golden State Warriors', opp: 'Cleveland Cavaliers', series: '4–2', mvp: 'Andre Iguodala',
    facts: [
      'Первый сезон Steve Kerr в роли главного тренера: 67 побед при 15 поражениях, Stephen Curry — MVP сезона.',
      'Первый титул за 40 лет; решающий шестой матч выигран в Кливленде.',
      'Andre Iguodala, выходивший со скамейки, стал MVP финала — во многом за защиту против LeBron James.',
    ],
    src: ['s2015', 'oracle']},
  {year: 2017, season: '2016/17', team: 'Golden State Warriors', opp: 'Cleveland Cavaliers', series: '4–1', mvp: 'Kevin Durant',
    facts: [
      'Летом 2016 года в команду пришёл Kevin Durant. Три серии плей-офф до финала — 4–0, 4–0, 4–0, в финале — одно поражение.',
      'Durant набирал 30 и больше очков в каждом матче финала. Steve Kerr почти два месяца пропустил из-за болезни и вернулся к финалу.',
      'Draymond Green — лучший защитник сезона.',
    ],
    src: ['s2017']},
  {year: 2018, season: '2017/18', team: 'Golden State Warriors', opp: 'Cleveland Cavaliers', series: '4–0', mvp: 'Kevin Durant',
    facts: [
      'Самая трудная серия — финал Запада с Houston Rockets: соперник вёл 3–2, но «Уорриорз» выиграли шестой и седьмой матчи.',
      'Финал выигран всухую, Durant второй год подряд — MVP финала.',
    ],
    src: ['s2018', 'oracle']},
  {year: 2022, season: '2021/22', team: 'Golden State Warriors', opp: 'Boston Celtics', series: '4–2', mvp: 'Stephen Curry',
    facts: [
      'Шестой финал за восемь сезонов.',
      'При счёте 1–2 в серии Curry набрал 43 очка в четвёртом матче, а в шестом (103:90) — 34 очка, 7 подборов и 7 передач.',
      'Первая в карьере Curry награда MVP финала (31,2 очка, 6,0 подбора и 5,0 передачи в среднем). До этого он первым получил Magic Johnson Trophy — приз лучшему игроку финала Запада.',
    ],
    src: ['s2022']},
];

/** Номера, выведенные из обращения (по порядку номеров, как на NBA.com). hof — год включения в Зал славы. */
export const LEGENDS = [
  {num: 9, name: 'Andre Iguodala', role: 'Восемь сезонов в клубе',
    facts: [
      'Пришёл из Denver перед сезоном 2013/14: шесть сезонов, три титула и MVP финала 2015 года (16,3 очка и 5,8 подбора в среднем в той серии).',
      'Вернулся в 2021 году и выиграл четвёртый титул: стал 11-м в истории НБА игроком с четырьмя титулами и наградой MVP финала.',
      'Номер выведен из обращения 23 февраля 2025 года.',
    ],
    src: ['retired', 'iguodala']},
  {num: 13, name: 'Wilt Chamberlain', role: 'Шесть сезонов в клубе', hof: 1979,
    facts: [
      'Выбран Philadelphia Warriors на драфте 1959 года и в первом же сезоне стал и лучшим новичком, и MVP.',
      'За клуб — 41,5 очка и 21,5 подбора в среднем; во всех шести сезонах — лучший бомбардир лиги.',
      'В 1962 году набрал 100 очков в одном матче — рекорд НБА.',
    ],
    src: ['retired']},
  {num: 14, name: 'Tom Meschery', role: 'Шесть сезонов в клубе',
    facts: [
      'Выбран под 7-м номером на драфте 1961 года; первые шесть сезонов карьеры провёл в клубе — в Филадельфии и Сан-Франциско (12,9 очка и 8,5 подбора).',
      'Во втором сезоне сыграл в Матче всех звёзд — первым из игроков, родившихся за пределами США (родился в Китае).',
      'Учился в школе в Сан-Франциско и в колледже St. Mary’s — местный герой района залива.',
    ],
    src: ['retired']},
  {num: 16, name: 'Al Attles', role: 'Игрок, тренер, менеджер · 64 года в клубе', hof: 2019,
    facts: [
      'Все 11 сезонов игровой карьеры — в «Уорриорз» (8,9 очка, 3,5 подбора и 3,5 передачи).',
      'Главным тренером привёл команду к титулу 1975 года; один из первых темнокожих главных тренеров в профессиональном спорте.',
      'Потом был генеральным менеджером и остался в клубе до конца жизни.',
    ],
    src: ['retired', 'oracle', 's1975']},
  {num: 17, name: 'Chris Mullin', role: '12 сезонов в клубе', hof: 2011,
    facts: [
      'Выбран под 7-м номером на драфте 1985 года; первые 12 сезонов карьеры — в «Голден Стэйт».',
      'Пять раз подряд играл в Матче всех звёзд, набирая в те годы не меньше 25 очков за матч.',
      'За клуб — 20,1 очка, 4,4 подбора, 3,9 передачи и 1,7 перехвата в среднем; всего 16 235 очков.',
    ],
    src: ['retired']},
  {num: 24, name: 'Rick Barry', role: 'Восемь сезонов в клубе: 1965–1967 и 1972–1978', hof: 1987,
    facts: [
      'Выбран San Francisco Warriors под 4-м номером на драфте 1965 года и стал лучшим новичком сезона.',
      'За клуб — 25,6 очка, 7,3 подбора, 5,1 передачи и 2,3 перехвата в среднем.',
      'MVP финала 1975 года — единственного титула в его карьере.',
    ],
    src: ['retired', 'oracle']},
  {num: 42, name: 'Nate Thurmond', role: '11 сезонов в клубе', hof: 1985,
    facts: [
      'Выбран под 3-м номером на драфте 1963 года; первые 11 сезонов карьеры — в клубе.',
      'Семь раз играл в Матче всех звёзд.',
      'Больше всех подборов в истории клуба — 12 771.',
    ],
    src: ['retired']},
];

/**
 * Рекорды НБА, установленные игроками и командой «Уорриорз».
 * checked: true — рекорд ещё может обновиться, поэтому сверен заново (CHECKED); check — чем подтверждено.
 */
export const RECORDS = [
  {value: '100', what: 'очков в одном матче', who: 'Wilt Chamberlain', when: '2 марта 1962',
    text: 'Philadelphia Warriors — New York Knicks, 169:147. 36 из 63 с игры, 28 из 32 штрафных, 25 подборов, все 48 минут.',
    checked: true, check: 'Рекорд держится больше 60 лет: ближе всех подобрался Bam Adebayo — 83 очка 10 марта 2026 года.',
    src: ['points100']},
  {value: '50,4', what: 'очка в среднем за сезон', who: 'Wilt Chamberlain', when: '1961/62',
    text: 'Единственный игрок в истории, набравший за сезон больше 4000 очков.',
    src: ['wilt']},
  {value: '55', what: 'подборов в одном матче', who: 'Wilt Chamberlain', when: '24 ноября 1960',
    text: 'Против Boston Celtics (поражение 129:132); 31 подбор — за одну половину, это рекорд клуба.',
    src: ['origins', 'wilt']},
  {value: '73', what: 'победы за регулярный чемпионат', who: 'Golden State Warriors', when: '2015/16',
    text: 'Итог сезона — 73–9.',
    checked: true, check: 'В сезоне 2025/26 больше всех побед — 64 — у Oklahoma City Thunder.',
    src: ['s2016', 'wins73', 's2026']},
  {value: '24–0', what: 'лучший старт сезона', who: 'Golden State Warriors', when: '2015/16',
    text: 'Первое поражение — только в 25-м матче. На сайте клуба: лучший старт сезона в истории профессионального спорта.',
    checked: true, check: 'В 2025/26 Oklahoma City Thunder начали с 24–1 — это повторение лучшего результата после 25 матчей, но не старта без поражений.',
    src: ['s2016', 'origins', 'start2025']},
  {value: '15', what: 'побед подряд в плей-офф', who: 'Golden State Warriors', when: '2017',
    text: 'Самая длинная победная серия в истории плей-офф.',
    checked: true, check: 'В 2026 году New York Knicks остановились на 13 победах подряд — второй результат.',
    src: ['s2026']},
  {value: '402', what: 'трёхочковых за сезон', who: 'Stephen Curry', when: '2015/16',
    text: 'Побил собственный рекорд и стал первым, кто забил за сезон больше 400 трёхочковых.',
    checked: true, check: 'Рекорд держится: в сезоне 2025/26 больше всех трёхочковых забил Kon Knueppel — 273.',
    src: ['s2016', 'threes402', 'season3']},
  {value: '4290', what: 'трёхочковых за карьеру — больше всех в истории', who: 'Stephen Curry', when: 'лидер с 14 декабря 2021',
    text: 'В тот вечер в Нью-Йорке обошёл Ray Allen (2973).',
    checked: true, check: 'Число растёт с каждым матчем Curry: 4290 — в регулярных чемпионатах на 11 ноября 2026 года.',
    src: ['origins', 'career3']},
  {value: '14', what: 'трёхочковых в одном матче', who: 'Klay Thompson', when: '29 октября 2018',
    text: 'В Чикаго против Bulls: 52 очка, победа 149:124. Предыдущий рекорд — 13 — был у Stephen Curry.',
    checked: true, check: 'NBA.com 8 ноября 2026 года по-прежнему называет его рекордсменом.',
    src: ['threes14', 'klayNow']},
  {value: '37', what: 'очков за одну четверть', who: 'Klay Thompson', when: '23 января 2015',
    text: 'Третья четверть против Sacramento Kings (126:101): 13 из 13 с игры, из них 9 из 9 трёхочковых.',
    checked: true, check: 'NBA.com 8 ноября 2026 года по-прежнему называет это рекордом НБА.',
    src: ['quarter37', 'klayNow']},
];

/** Интересные факты — по времени. checked: true — может измениться, поэтому сверено заново. */
export const FACTS = [
  {year: '1946', text: 'Один из трёх клубов, которые играют в лиге с её первого сезона, — вместе с New York Knicks и Boston Celtics.',
    src: ['origins']},
  {year: '1947', text: 'За первый титул каждый игрок получил 2000 долларов и перстень с крошечным бриллиантом.',
    src: ['title1947']},
  {year: '1959', text: 'Wilt Chamberlain учился в колледже в Канзасе, но клуб забрал его по «территориальному» правилу драфта: владелец команды Eddie Gottlieb доказал лиге, что Chamberlain вырос в Филадельфии и стал там знаменит ещё школьником. Больше никого в истории НБА так не выбирали — по родному городу, а не по колледжу.',
    src: ['wilt']},
  {year: '1962', text: 'Матч Wilt Chamberlain на 100 очков сыгран не в Филадельфии, а в городке Херши (Пенсильвания). Вторым по очкам в той игре был его друг Al Attles — 17.',
    src: ['points100', 'origins']},
  {year: '1962', text: 'Клуб переехал из Филадельфии в район залива Сан-Франциско и поначалу проводил «домашние» матчи в разных городах — в Дейли-Сити, Сан-Хосе, Сан-Диего и Окленде.',
    src: ['oracle']},
  {year: '1971', text: '«Сан-Франциско Уорриорз» стали «Голден Стэйт Уорриорз», чтобы команда представляла всю Калифорнию. Главной ареной стал зал в Окленде (позже — «Оракл-арена»): там клуб играл 47 сезонов.',
    src: ['oracle']},
  {year: '2007', text: 'Команда эпохи «We Believe» первой в истории, будучи восьмой в посеве, выиграла серию до четырёх побед у первой — у Dallas Mavericks.',
    src: ['oracle']},
  {year: '2016', text: 'Stephen Curry второй год подряд стал MVP сезона — и первым в истории получил эту награду единогласно.',
    src: ['s2016', 'oracle']},
  {year: '2016', text: 'После рекордных 73 побед команда проиграла финал Cleveland Cavaliers, ведя в серии 3–1: до этого такое отставание в финалах не отыгрывал никто.',
    src: ['s2016']},
  {year: '2019', text: '24 октября — первый матч регулярного чемпионата в новом «Чейз-центре»: первая игра «Уорриорз» в Сан-Франциско (не считая предсезонных) с 29 января 1971 года.',
    src: ['chase']},
  {year: '2021', text: '12 апреля Stephen Curry обошёл Wilt Chamberlain (17 783 очка) и стал лучшим бомбардиром в истории клуба; в тот вечер он набрал 53 очка в победе над Denver Nuggets (116:107).',
    checked: true, check: 'Curry по-прежнему играет за клуб, и его сумма только растёт.',
    src: ['curryWilt']},
];
