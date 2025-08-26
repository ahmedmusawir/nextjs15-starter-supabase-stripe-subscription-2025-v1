declare module "pdfkit" {
  import { Readable } from "stream";

  export interface PDFPage {
    margins: { left: number; right: number; top: number; bottom: number };
    width: number;
    height: number;
  }

  export interface TextOptions {
    align?: "left" | "center" | "right" | "justify";
    width?: number;
    continued?: boolean;
  }

  export default class PDFDocument extends Readable {
    constructor(options?: any);
    // Common properties used in our code
    page: PDFPage;
    y: number;

    // Drawing/text API we use
    fontSize(size: number): this;
    text(text: string, options?: TextOptions): this;
    text(text: string, x?: number, y?: number, options?: TextOptions): this;
    moveDown(lines?: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(color?: string | number): this;
    fillColor(color: string | number): this;
    rect(x: number, y: number, w: number, h: number): this;
    font(name: string): this;
    addPage(options?: any): this;
    end(): void;
    pipe(dest: NodeJS.WritableStream): NodeJS.WritableStream;
  }
}
