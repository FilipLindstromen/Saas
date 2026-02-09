import { POSTIT_WIDTH, POSTIT_MIN_HEIGHT } from '../constants';

const id = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const TEMPLATES = [
  {
    id: 'funnel',
    name: 'Sales Funnel',
    description: 'Awareness → Interest → Decision → Action',
    getData: () => ({
      notes: [
        { id: id(), x: 320, y: 80, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Awareness\n\nTop of funnel: ads, content, SEO', colorIndex: 0 },
        { id: id(), x: 340, y: 240, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Interest\n\nLead magnets, email, webinars', colorIndex: 1 },
        { id: id(), x: 360, y: 380, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Decision\n\nTrials, demos, comparisons', colorIndex: 2 },
        { id: id(), x: 380, y: 520, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Action\n\nPurchase, sign-up, booking', colorIndex: 3 },
      ],
      comments: [],
      arrows: [],
    }),
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Central idea with branches',
    getData: () => {
      const center = id();
      const n1 = id(), n2 = id(), n3 = id(), n4 = id();
      return {
        notes: [
          { id: center, x: 350, y: 220, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Central idea\n\nYour main topic or goal', colorIndex: 0 },
          { id: n1, x: 120, y: 100, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Idea 1', colorIndex: 1 },
          { id: n2, x: 120, y: 340, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Idea 2', colorIndex: 2 },
          { id: n3, x: 560, y: 100, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Idea 3', colorIndex: 3 },
          { id: n4, x: 560, y: 340, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Idea 4', colorIndex: 4 },
        ],
        comments: [],
        arrows: [
          { id: id(), fromId: center, toId: n1, fromType: 'note', toType: 'note' },
          { id: id(), fromId: center, toId: n2, fromType: 'note', toType: 'note' },
          { id: id(), fromId: center, toId: n3, fromType: 'note', toType: 'note' },
          { id: id(), fromId: center, toId: n4, fromType: 'note', toType: 'note' },
        ],
      };
    },
  },
  {
    id: 'offers',
    name: 'Offer Map',
    description: 'How offers connect and upsells',
    getData: () => {
      const lead = id(), core = id(), upsell = id(), bundle = id();
      return {
        notes: [
          { id: lead, x: 80, y: 240, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Lead offer\n\nFree trial / lead magnet', colorIndex: 0 },
          { id: core, x: 320, y: 240, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Core offer\n\nMain product or service', colorIndex: 1 },
          { id: upsell, x: 560, y: 160, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Upsell', colorIndex: 2 },
          { id: bundle, x: 560, y: 320, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Bundle / OTO', colorIndex: 3 },
        ],
        comments: [
          { id: id(), x: 300, y: 420, text: 'Map your revenue flow from lead to bundle', width: 280, height: 44 },
        ],
        arrows: [
          { id: id(), fromId: lead, toId: core, fromType: 'note', toType: 'note' },
          { id: id(), fromId: core, toId: upsell, fromType: 'note', toType: 'note' },
          { id: id(), fromId: core, toId: bundle, fromType: 'note', toType: 'note' },
        ],
      };
    },
  },
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'To Do → Doing → Done',
    getData: () => {
      const t1 = id(), t2 = id(), d1 = id(), done1 = id();
      return {
        notes: [
          { id: t1, x: 60, y: 140, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'To do\n\nTask or feature', colorIndex: 0 },
          { id: t2, x: 60, y: 280, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Another task', colorIndex: 0 },
          { id: d1, x: 320, y: 200, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Doing\n\nIn progress', colorIndex: 1 },
          { id: done1, x: 580, y: 200, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Done\n\nCompleted', colorIndex: 2 },
        ],
        comments: [
          { id: id(), x: 320, y: 360, text: 'Drag notes between columns', width: 220, height: 44 },
        ],
        arrows: [],
      };
    },
  },
  {
    id: 'mindmap',
    name: 'Mind Map',
    description: 'Hierarchical idea map',
    getData: () => {
      const root = id(), a = id(), b = id(), c = id(), a1 = id(), b1 = id();
      return {
        notes: [
          { id: root, x: 360, y: 240, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Main topic', colorIndex: 0 },
          { id: a, x: 140, y: 120, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Branch A', colorIndex: 1 },
          { id: b, x: 140, y: 320, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Branch B', colorIndex: 2 },
          { id: c, x: 560, y: 240, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Branch C', colorIndex: 3 },
          { id: a1, x: 40, y: 100, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Sub A1', colorIndex: 4 },
          { id: b1, x: 40, y: 340, width: POSTIT_WIDTH, height: POSTIT_MIN_HEIGHT, text: 'Sub B1', colorIndex: 5 },
        ],
        comments: [],
        arrows: [
          { id: id(), fromId: root, toId: a, fromType: 'note', toType: 'note' },
          { id: id(), fromId: root, toId: b, fromType: 'note', toType: 'note' },
          { id: id(), fromId: root, toId: c, fromType: 'note', toType: 'note' },
          { id: id(), fromId: a, toId: a1, fromType: 'note', toType: 'note' },
          { id: id(), fromId: b, toId: b1, fromType: 'note', toType: 'note' },
        ],
      };
    },
  },
];
