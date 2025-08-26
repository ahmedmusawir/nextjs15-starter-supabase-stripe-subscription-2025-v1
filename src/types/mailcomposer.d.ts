declare module "mailcomposer" {
  export interface MailAttachment {
    filename?: string;
    content?: Buffer | string;
    contentType?: string;
    path?: string;
  }

  export interface MailOptions {
    from?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    text?: string;
    html?: string;
    attachments?: MailAttachment[];
  }

  export default class MailComposer {
    constructor(options?: MailOptions);
    compile(): {
      build(callback: (err: any, message: Buffer) => void): void;
    };
  }
}
