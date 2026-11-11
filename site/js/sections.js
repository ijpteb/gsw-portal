// Разделы сайта: из этого списка строятся меню на компьютере, нижняя панель на телефоне и меню «Ещё».

export const SECTIONS = [
  {id: 'home', path: '/', title: 'Главная', icon: 'home', tab: 1},
  {id: 'schedule', path: '/schedule', title: 'Расписание', icon: 'calendar', tab: 2},
  {id: 'roster', path: '/roster', title: 'Состав', icon: 'users', tab: 3},
  {id: 'stats', path: '/stats', title: 'Статистика', icon: 'chart'},
  {id: 'standings', path: '/standings', title: 'Таблица', icon: 'table', tab: 4},
  {id: 'news', path: '/news', title: 'Новости', icon: 'news'},
  {id: 'compare', path: '/compare', title: 'Сравнение', icon: 'compare'},
  {id: 'history', path: '/history', title: 'История', icon: 'trophy'},
  {id: 'favorites', path: '/favorites', title: 'Избранное', icon: 'star'},
];
