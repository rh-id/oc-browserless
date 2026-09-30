export type ToolPropertySchema = {
  type: string;
  description: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  default?: string | number | boolean;
};

export type ToolSchema = {
  type: 'object';
  properties: Record<string, ToolPropertySchema>;
  required?: string[];
  additionalProperties?: boolean;
};

export const WEB_BROWSE_DESCRIPTION = 'Navigate to and browse web pages using browserless';

export const WEB_SEARCH_DESCRIPTION =
  'Search web using SearXNG (if configured) or DuckDuckGo and return results';

export const WEB_SCREENSHOT_DESCRIPTION = 'Take screenshots of web pages using browserless';

export const WEB_PDF_DESCRIPTION = 'Generate PDF from HTML content or URL using browserless';

export const webBrowseSchema: ToolSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'The URL to navigate to' },
  },
  required: ['url'],
  additionalProperties: false,
};

export const webSearchSchema: ToolSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'The search query' },
  },
  required: ['query'],
  additionalProperties: false,
};

export const webScreenshotSchema: ToolSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to screenshot' },
    path: {
      type: 'string',
      description: 'Output file path (if not provided, returns base64)',
    },
    format: {
      type: 'string',
      enum: ['png', 'jpeg', 'webp'],
      default: 'png',
      description: 'Format: png, jpeg, webp',
    },
    fullPage: {
      type: 'boolean',
      default: false,
      description: 'Capture full page instead of viewport',
    },
    quality: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Quality for jpeg/webp (0-100)',
    },
    viewportWidth: {
      type: 'number',
      minimum: 100,
      maximum: 5000,
      description: 'Viewport width in pixels',
    },
    viewportHeight: {
      type: 'number',
      minimum: 100,
      maximum: 5000,
      description: 'Viewport height in pixels',
    },
  },
  required: ['url'],
  additionalProperties: false,
};

export const webPdfSchema: ToolSchema = {
  type: 'object',
  properties: {
    html: { type: 'string', description: 'HTML content to convert to PDF' },
    url: { type: 'string', description: 'URL to convert to PDF' },
    path: {
      type: 'string',
      description: 'Output file path (if not provided, returns base64)',
    },
    format: {
      type: 'string',
      enum: ['A4', 'Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A5', 'A6'],
      default: 'A4',
      description: 'Paper format',
    },
    printBackground: {
      type: 'boolean',
      default: true,
      description: 'Print background graphics',
    },
    landscape: {
      type: 'boolean',
      default: false,
      description: 'Landscape orientation',
    },
    marginTop: {
      type: 'string',
      default: '0cm',
      description: 'Top margin (e.g., "1cm", "0.5in")',
    },
    marginBottom: {
      type: 'string',
      default: '0cm',
      description: 'Bottom margin (e.g., "1cm", "0.5in")',
    },
    marginLeft: {
      type: 'string',
      default: '0cm',
      description: 'Left margin (e.g., "1cm", "0.5in")',
    },
    marginRight: {
      type: 'string',
      default: '0cm',
      description: 'Right margin (e.g., "1cm", "0.5in")',
    },
  },
  additionalProperties: false,
};

export interface BrowseArgs {
  url: string;
}

export interface SearchArgs {
  query: string;
}

export interface ScreenshotArgs {
  url: string;
  path?: string;
  format: 'png' | 'jpeg' | 'webp';
  fullPage: boolean;
  quality?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

export interface PdfArgs {
  html?: string;
  url?: string;
  path?: string;
  format:
    | 'A4'
    | 'Letter'
    | 'Legal'
    | 'Tabloid'
    | 'Ledger'
    | 'A0'
    | 'A1'
    | 'A2'
    | 'A3'
    | 'A5'
    | 'A6';
  printBackground: boolean;
  landscape: boolean;
  marginTop: string;
  marginBottom: string;
  marginLeft: string;
  marginRight: string;
}

export function normalizeBrowseArgs(input: unknown): BrowseArgs {
  const raw = (input ?? {}) as Record<string, unknown>;
  return { url: raw.url as string };
}

export function normalizeSearchArgs(input: unknown): SearchArgs {
  const raw = (input ?? {}) as Record<string, unknown>;
  return { query: raw.query as string };
}

export function normalizeScreenshotArgs(input: unknown): ScreenshotArgs {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    url: raw.url as string,
    path: raw.path as string | undefined,
    format: (raw.format as ScreenshotArgs['format'] | undefined) ?? 'png',
    fullPage: (raw.fullPage as boolean | undefined) ?? false,
    quality: raw.quality as number | undefined,
    viewportWidth: raw.viewportWidth as number | undefined,
    viewportHeight: raw.viewportHeight as number | undefined,
  };
}

export function normalizePdfArgs(input: unknown): PdfArgs {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    html: raw.html as string | undefined,
    url: raw.url as string | undefined,
    path: raw.path as string | undefined,
    format: (raw.format as PdfArgs['format'] | undefined) ?? 'A4',
    printBackground: (raw.printBackground as boolean | undefined) ?? true,
    landscape: (raw.landscape as boolean | undefined) ?? false,
    marginTop: (raw.marginTop as string | undefined) ?? '0cm',
    marginBottom: (raw.marginBottom as string | undefined) ?? '0cm',
    marginLeft: (raw.marginLeft as string | undefined) ?? '0cm',
    marginRight: (raw.marginRight as string | undefined) ?? '0cm',
  };
}
