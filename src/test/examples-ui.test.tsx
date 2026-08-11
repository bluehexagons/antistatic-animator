import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourcePicker } from '../app/SourcePicker';
import { EXAMPLE_PROJECTS } from '../examples';

describe('example source picker', () => {
  it('labels the example entry point as browser-local', () => {
    const markup = renderToStaticMarkup(
      <SourcePicker
        onElectron={() => {}}
        onFsAccess={() => {}}
        onUpload={() => {}}
        examples={EXAMPLE_PROJECTS}
        onExample={() => {}}
      />
    );
    expect(markup).toContain('Try examples — files stay local in your browser');
    expect(markup).toContain('Nothing is uploaded.');
  });
});
