import { CustomError } from './custom-error';

export class MissingArgError extends CustomError {
  constructor(command: string) {
    const msg = `Could not detect an image to ${command}. Specify an image name to scan and try running the command again.`;
    super(msg);
    this.code = 422;
    this.userMessage = msg;
  }
}
