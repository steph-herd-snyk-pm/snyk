import { Options } from '../../lib/types';
import { MissingArgError } from '../../lib/errors';

export function processCommandArgs<CommandOptions>(
  method,
  ...args
): { paths: string[]; options: Options & CommandOptions } {
  let options = ({} as any) as Options & CommandOptions;

  if (typeof args[args.length - 1] === 'object') {
    options = (args.pop() as any) as Options & CommandOptions;
  }
  args = args.filter(Boolean);

  if (args.length === 0) {
    // For Docker image scanning, image name has to be provided
    if (options.docker) {
      throw new MissingArgError(method);
    }
    // For repository scanning, populate with default path (cwd) if no path given
    args.unshift(process.cwd());
  }

  return { options, paths: args };
}
