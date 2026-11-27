/**
 * Mocked wger API responses for deterministic tests.
 * Shapes copied from real https://wger.de/api/v2/ responses (OpenAPI 2.8.0),
 * trimmed to the fields FitSync reads. Content is shortened test data.
 */
export const wgerFixtures = {
  licenses: {
    count: 5,
    next: null,
    previous: null,
    results: [
      { id: 1, full_name: 'Creative Commons Attribution Share Alike 3', short_name: 'CC-BY-SA 3', url: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en' },
      { id: 2, full_name: 'Creative Commons Attribution Share Alike 4', short_name: 'CC-BY-SA 4', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en' },
      { id: 3, full_name: 'Creative Commons Public Domain 1.0', short_name: 'CC0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
      { id: 4, full_name: 'Creative Commons Attribution 4', short_name: 'CC-BY 4', url: 'https://creativecommons.org/licenses/by/4.0/' },
      { id: 5, full_name: 'Open Data Commons Open Database License', short_name: 'ODbL', url: 'https://opendatacommons.org/licenses/odbl/' },
    ],
  },
  categories: {
    count: 2,
    next: null,
    previous: null,
    results: [
      { id: 11, name: 'Chest' },
      { id: 10, name: 'Abs' },
    ],
  },
  equipment: {
    count: 2,
    next: null,
    previous: null,
    results: [
      { id: 1, name: 'Barbell' },
      { id: 8, name: 'Bench' },
    ],
  },
  list: {
    count: 2,
    next: null,
    previous: null,
    results: [
      {
        id: 73,
        uuid: '3717d144-7815-4a97-9a56-956fb889c996',
        category: { id: 11, name: 'Chest' },
        muscles: [{ id: 4, name: 'Pectoralis major', name_en: 'Chest', is_front: true }],
        muscles_secondary: [{ id: 5, name: 'Triceps brachii', name_en: 'Triceps', is_front: false }],
        equipment: [
          { id: 1, name: 'Barbell' },
          { id: 8, name: 'Bench' },
        ],
        license: { id: 1, full_name: 'Creative Commons Attribution Share Alike 3', short_name: 'CC-BY-SA 3', url: 'https://creativecommons.org/licenses/by-sa/3.0/deed.en' },
        license_author: 'wger.de',
        images: [
          {
            id: 68,
            image: 'https://wger.de/media/exercise-images/192/Bench-press-1.png',
            thumbnails: {
              small: 'https://wger.de/media/exercise-images/192/Bench-press-1.png.200x200_q85.png',
              medium: 'https://wger.de/media/exercise-images/192/Bench-press-1.png.400x400_q85.png',
            },
            is_main: true,
            license: 2,
            license_author: 'Everkinetic',
            license_author_url: '',
            license_object_url: '',
          },
          { id: 69, image: 'https://wger.de/media/exercise-images/192/Bench-press-2.png', is_main: false, license: 5, license_author: 'x' },
          { id: 70, image: 'https://evil.example.com/tracker.png', is_main: false, license: 2, license_author: 'y' },
        ],
        translations: [
          { id: 900, name: 'Bankdrücken', description: '<p>Auf die Bank legen.</p>', language: 1, license_author: 'someone' },
          {
            id: 901,
            name: 'Bench Press',
            description: '<p>Lie on a bench.</p><ul><li>Lower the bar</li><li>Press up</li></ul><script>alert(1)</script>',
            language: 2,
            license_author: 'Everkinetic',
          },
        ],
      },
      {
        id: 91,
        uuid: '1b020b3a-3732-4c7e-92fd-a0cec90ed69b',
        category: { id: 10, name: 'Abs' },
        muscles: [],
        muscles_secondary: [],
        equipment: [],
        license: { id: 2, short_name: 'CC-BY-SA 4', url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.en' },
        license_author: 'wger.de',
        images: [],
        translations: [{ id: 902, name: 'Crunches', description: '', language: 2, license_author: 'wger.de' }],
      },
    ],
  },
};
