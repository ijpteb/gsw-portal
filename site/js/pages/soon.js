// Раздел, который появится на следующих этапах: честно говорим, что будет и когда.
import {h, icon} from '../ui.js?v=__V__';
import {byId} from '../sections.js?v=__V__';

export default {
  section: ([id]) => id,
  title: ([id]) => byId(id)?.title || 'Раздел',
  async render(view, [id]) {
    const s = byId(id);
    view.append(h('div', {class: 'page narrow soon'},
      h('span', {class: 'soon-icon'}, icon(s.icon, 34)),
      h('p', {class: 'eyebrow'}, `Раздел в разработке · этап ${s.stage}`),
      h('h1', {class: 'page-title'}, s.title),
      h('p', {class: 'page-lead'}, s.about),
      h('a', {class: 'btn', href: '#/'}, 'На главную')));
    return {};
  },
};
