// Избранное: те же карточки, что на главной, — отдельной страницей (быстрый доступ из меню).
import {h} from '../ui.js?v=__V__';
import {loadFavorites, favoritesBlock} from '../components.js?v=__V__';

export default {
  section: () => 'favorites',
  title: () => 'Избранное',
  async render(view) {
    const draw = async (quiet) => {
      const block = favoritesBlock(await loadFavorites());
      const page = h('div', {class: `page${quiet ? ' quiet' : ''}`},
        h('header', {class: 'page-head'},
          h('p', {class: 'eyebrow'}, 'Избранное'),
          h('h1', {class: 'page-title'}, 'Мои игроки'),
          h('p', {class: 'page-lead'}, 'Список хранится в этом браузере: на телефоне и компьютере он свой.')),
        block);
      view.replaceChildren(page);
    };
    await draw(false);
    const onFav = () => draw(true);
    window.addEventListener('favorites-change', onFav);
    return {update: () => draw(true), destroy: () => window.removeEventListener('favorites-change', onFav)};
  },
};
