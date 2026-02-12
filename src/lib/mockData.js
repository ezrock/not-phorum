export const mockUsers = [
  {
    id: 1,
    username: 'e-z',
    email: 'eero.pailinna@gmail.com',
    avatar: '🍄',
    joinDate: '2004-11-18',
    posts: 12813
  },
  {
    id: 2,
    username: 'pikemon',
    email: 'pikemon@example.com',
    avatar: '🎮',
    joinDate: '2024-01-15',
    posts: 24555
  },
  {
    id: 3,
    username: 'jones',
    email: 'jones@example.com',
    avatar: '🐱',
    joinDate: '2024-02-01',
    posts: 29888
  }
];

export const mockCategories = [
  {
    id: 1,
    name: 'Pelit',
    description: 'Keskustelua peleistä kaikilla alustoilla',
    icon: '🎮',
    slug: 'pelit',
    topicCount: 1234,
    postCount: 45678
  },
  {
    id: 2,
    name: 'Teknologia',
    description: 'Tietokoneet, komponentit ja teknologia',
    icon: '💻',
    slug: 'teknologia',
    topicCount: 856,
    postCount: 12456
  },
  {
    id: 3,
    name: 'Yleinen',
    description: 'Vapaa keskustelu mistä vain',
    icon: '💬',
    slug: 'yleinen',
    topicCount: 2341,
    postCount: 78901
  },
  {
    id: 4,
    name: 'Harrastukset',
    description: 'Elokuvat, musiikki, urheilu ja muut harrastukset',
    icon: '🎬',
    slug: 'harrastukset',
    topicCount: 567,
    postCount: 8934
  }
];

export const mockTopics = [
  {
    id: 1,
    categoryId: 1,
    title: 'Mikä on paras souls-peli?',
    authorId: 1,
    createdAt: '2024-02-10T14:30:00Z',
    lastActivity: '2024-02-12T09:15:00Z',
    views: 456,
    replyCount: 23,
    isPinned: true,
    isLocked: false
  },
  {
    id: 2,
    categoryId: 1,
    title: 'Baldur\'s Gate 3 - Vinkkejä aloittelijoille',
    authorId: 2,
    createdAt: '2024-02-11T16:20:00Z',
    lastActivity: '2024-02-12T10:30:00Z',
    views: 234,
    replyCount: 15,
    isPinned: false,
    isLocked: false
  },
  {
    id: 3,
    categoryId: 1,
    title: 'Odotukset vuoden 2026 peleille',
    authorId: 3,
    createdAt: '2024-02-09T10:00:00Z',
    lastActivity: '2024-02-11T22:45:00Z',
    views: 789,
    replyCount: 42,
    isPinned: false,
    isLocked: false
  },
  {
    id: 4,
    categoryId: 2,
    title: 'Uuden PC:n kasaaminen - budjettivinkkejä',
    authorId: 2,
    createdAt: '2024-02-08T12:00:00Z',
    lastActivity: '2024-02-12T08:20:00Z',
    views: 567,
    replyCount: 31,
    isPinned: false,
    isLocked: false
  },
  {
    id: 5,
    categoryId: 3,
    title: 'Mitä teit viikonloppuna?',
    authorId: 1,
    createdAt: '2024-02-12T07:00:00Z',
    lastActivity: '2024-02-12T11:00:00Z',
    views: 123,
    replyCount: 8,
    isPinned: false,
    isLocked: false
  }
];

export const mockPosts = [
  {
    id: 1,
    topicId: 1,
    authorId: 1,
    content: 'Olen miettinyt, että mikä on oikeasti paras souls-peli? Itse pelannut Elden Ringin läpi kaksi kertaa ja se on kyllä aika kova. Mutta klassikot kuten Dark Souls 1 ja Bloodborne ovat myös erittäin hyviä.',
    createdAt: '2024-02-10T14:30:00Z',
    editedAt: null,
    likes: 12
  },
  {
    id: 2,
    topicId: 1,
    authorId: 2,
    content: 'Bloodborne on ehdottomasti paras! Viktoriaaninen estetiikka ja nopea pelilogiikka tekee siitä ainutlaatuisen. Säälittää vaan että se on edelleen PS4:llä jumissa.',
    createdAt: '2024-02-10T15:45:00Z',
    editedAt: null,
    likes: 8
  },
  {
    id: 3,
    topicId: 1,
    authorId: 3,
    content: 'Dark Souls 1:llä on paras maailman suunnittelu, mutta Elden Ring on kokonaisuutena paras. Valtava maailma, vapaus tutkia ja silti se FromSoftin tunnelma säilyy.',
    createdAt: '2024-02-10T16:20:00Z',
    editedAt: '2024-02-10T16:25:00Z',
    likes: 15
  },
  {
    id: 4,
    topicId: 2,
    authorId: 2,
    content: 'Terve! Aloitin juuri BG3:n pelaamisen ja tämä peli on massiivinen. Onko kenelläkään vinkkejä hyvästä aloitusluokasta? Ja kannattaako side questit tehdä heti vai palata niihin myöhemmin?',
    createdAt: '2024-02-11T16:20:00Z',
    editedAt: null,
    likes: 5
  },
  {
    id: 5,
    topicId: 2,
    authorId: 1,
    content: 'Paladin on hyvä aloitusluokka - pystyy tankkaamaan ja tekemään vahinkoa. Side questit kannattaa tehdä samalla kun tutkii maailmaa, koska ne antavat hyvää XP:tä. Älä kiirehdi pääjuonen kanssa!',
    createdAt: '2024-02-11T17:30:00Z',
    editedAt: null,
    likes: 7
  }
];