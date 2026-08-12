import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourcePicker } from '../app/SourcePicker';
import { EXAMPLE_PROJECTS } from '../examples';

describe('example source picker', () => {
  it('puts browser-local guidance on the upload option', () => {
    const markup = renderToStaticMarkup(
      <SourcePicker
        onElectron={() => {}}
        onFsAccess={() => {}}
        onUpload={() => {}}
        examples={EXAMPLE_PROJECTS}
        onExample={() => {}}
      />
    );
    expect(markup).toContain('<strong>Try examples</strong>');
    expect(markup).toContain('Files stay local in your browser.');
    expect(markup).toContain('Nothing is uploaded.');
    expect(markup.indexOf('Nothing is uploaded.')).toBeLessThan(
      markup.indexOf('<strong>Try examples</strong>')
    );
  });
});
