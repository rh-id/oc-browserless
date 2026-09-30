import { describe, test, expect } from 'bun:test';
import plugin, * as entry from '../src/plugin/browserless';
import { BROWSERLESS_GUIDELINES } from '../src/plugin/guidelines';
import {
  webBrowseSchema,
  webPdfSchema,
  webScreenshotSchema,
  webSearchSchema,
} from '../src/plugin/schemas';

describe('default export', () => {
  test('exposes the dual V1/V2 entry shape', () => {
    expect(typeof plugin).toBe('object');
    expect(plugin.id).toBe('oc-browserless');
    expect(typeof plugin.setup).toBe('function');
    expect(typeof plugin.server).toBe('function');
  });
});

describe('entry module export hygiene', () => {
  test('every named export is a function (V1 loader invariant)', () => {
    const nonFunctions = Object.entries(entry)
      .filter(([name, value]) => name !== 'default' && typeof value !== 'function')
      .map(([name]) => name);
    expect(nonFunctions).toEqual([]);
  });

  test('pure content helpers remain exported', () => {
    expect(typeof entry.cleanupPageAndExtract).toBe('function');
    expect(typeof entry.collapseWhitespace).toBe('function');
    expect(typeof entry.truncateContent).toBe('function');
  });
});

describe('server()', () => {
  test('returns exactly the 4 V1 tools plus the system prompt hook', async () => {
    const server = await plugin.server();

    expect(Object.keys(server.tool).sort()).toEqual([
      'web_browse',
      'web_pdf',
      'web_screenshot',
      'web_search',
    ]);

    for (const tool of Object.values(server.tool)) {
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      expect(typeof tool.execute).toBe('function');
    }

    expect(typeof server['experimental.chat.system.transform']).toBe('function');
  });

  test('web_search execute fails fast on a non-string query', async () => {
    const server = await plugin.server();
    const output = (await server.tool.web_search.execute(
      { query: 42 } as never,
      {} as never,
    )) as string;

    expect(JSON.parse(output)).toEqual({
      success: false,
      query: 42,
      error: 'Invalid query format',
    });
  });

  test('system prompt hook pushes the guidelines verbatim', async () => {
    const server = await plugin.server();
    const output = { system: [] as string[] };
    await server['experimental.chat.system.transform']({ model: {} as never }, output);

    expect(output.system.length).toBe(1);
    expect(output.system[0]).toBe(BROWSERLESS_GUIDELINES);
    expect(output.system[0]).toContain('# Browserless Plugin Guidelines');
  });
});

describe('V2 JSON schemas', () => {
  test('web_browse requires a url string', () => {
    expect(webBrowseSchema.type).toBe('object');
    expect(webBrowseSchema.required).toEqual(['url']);
    expect(webBrowseSchema.properties.url.type).toBe('string');
    expect(webBrowseSchema.properties.url.description).toBe('The URL to navigate to');
    expect(webBrowseSchema.additionalProperties).toBe(false);
  });

  test('web_search requires a query string', () => {
    expect(webSearchSchema.type).toBe('object');
    expect(webSearchSchema.required).toEqual(['query']);
    expect(webSearchSchema.properties.query.type).toBe('string');
  });

  test('web_screenshot mirrors the zod args', () => {
    expect(webScreenshotSchema.required).toEqual(['url']);
    const props = webScreenshotSchema.properties;
    expect(props.url.type).toBe('string');
    expect(props.path.type).toBe('string');
    expect(props.format.enum).toEqual(['png', 'jpeg', 'webp']);
    expect(props.format.default).toBe('png');
    expect(props.fullPage.type).toBe('boolean');
    expect(props.fullPage.default).toBe(false);
    expect(props.quality.minimum).toBe(0);
    expect(props.quality.maximum).toBe(100);
    expect(props.viewportWidth.minimum).toBe(100);
    expect(props.viewportWidth.maximum).toBe(5000);
    expect(props.viewportHeight.minimum).toBe(100);
    expect(props.viewportHeight.maximum).toBe(5000);
  });

  test('web_pdf mirrors the zod args with defaults as annotations only', () => {
    expect(webPdfSchema.required).toBeUndefined();
    const props = webPdfSchema.properties;
    expect(props.html.type).toBe('string');
    expect(props.url.type).toBe('string');
    expect(props.path.type).toBe('string');
    expect(props.format.enum).toEqual([
      'A4',
      'Letter',
      'Legal',
      'Tabloid',
      'Ledger',
      'A0',
      'A1',
      'A2',
      'A3',
      'A5',
      'A6',
    ]);
    expect(props.format.default).toBe('A4');
    expect(props.printBackground.default).toBe(true);
    expect(props.landscape.default).toBe(false);
    expect(props.marginTop.default).toBe('0cm');
    expect(props.marginBottom.default).toBe('0cm');
    expect(props.marginLeft.default).toBe('0cm');
    expect(props.marginRight.default).toBe('0cm');
  });
});
