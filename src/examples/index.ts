import emberForge from './ember-forge.json';
import orbitalRelay from './orbital-relay.json';
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
    description: 'A complete practice rig with movement, grounded attacks, an aerial, and a taunt.',
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
    name: 'Lift laboratory',
    description: 'An animated training stage with a moving collision platform and scene effects.',
    files: [{ path: 'app/assets/stages/training-platform.json', content: json(trainingPlatform) }],
  },
  {
    id: 'ember-forge',
    name: 'Ember forge',
    description: 'A tournament layout showcasing lighting, atmosphere, fog, and particles.',
    files: [{ path: 'app/assets/stages/ember-forge.json', content: json(emberForge) }],
  },
  {
    id: 'orbital-relay',
    name: 'Orbital relay',
    description: 'A counterpick with paired moving platforms and simultaneous animation tracks.',
    files: [{ path: 'app/assets/stages/orbital-relay.json', content: json(orbitalRelay) }],
  },
];

/** Files loaded together when the examples are used as a practice workspace. */
export const EXAMPLE_WORKSPACE_FILES: ExampleFile[] = EXAMPLE_PROJECTS.flatMap(
  (example) => example.files
);

export const exampleById = (id: string): ExampleProject | undefined =>
  EXAMPLE_PROJECTS.find((example) => example.id === id);
