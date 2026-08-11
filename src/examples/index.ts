import practiceAnimation from './practice-fighter_anim.json';
import practiceCharacter from './practice-fighter.json';
import trainingPlatform from './training-platform.json';

export interface ExampleFile {
  /** Path as it would appear inside an Antistatic checkout. */
  path: string;
  content: string;
}

export interface ExampleProject {
  id: string;
  name: string;
  description: string;
  files: ExampleFile[];
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const EXAMPLE_PROJECTS: ExampleProject[] = [
  {
    id: 'practice-fighter',
    name: 'Practice fighter',
    description: 'A small rig with idle, jab, and sweep animations.',
    files: [
      { path: 'app/characters/data/practice-fighter.json', content: json(practiceCharacter) },
      {
        path: 'app/characters/data/practice-fighter_anim.json',
        content: json(practiceAnimation),
      },
    ],
  },
  {
    id: 'training-platform',
    name: 'Training platform',
    description: 'A moving stage with collision, models, and a looping animation.',
    files: [{ path: 'app/assets/stages/training-platform.json', content: json(trainingPlatform) }],
  },
];

export const exampleById = (id: string): ExampleProject | undefined =>
  EXAMPLE_PROJECTS.find((example) => example.id === id);
