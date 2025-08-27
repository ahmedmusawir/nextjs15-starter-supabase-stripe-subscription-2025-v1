import '@testing-library/jest-dom';
// Polyfill fetch, Request, Response, Headers for tests (needed by NextRequest and fetch mocks)
import 'whatwg-fetch';

// Ensure TextEncoder/TextDecoder exist for libraries like pdfkit standalone
// Some Jest environments under jsdom may not expose these globals
import { TextEncoder, TextDecoder } from 'util';
// @ts-ignore - assign to global if missing
if (!(global as any).TextEncoder) (global as any).TextEncoder = TextEncoder;
// @ts-ignore
if (!(global as any).TextDecoder) (global as any).TextDecoder = TextDecoder as any;
