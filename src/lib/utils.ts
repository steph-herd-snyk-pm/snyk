import * as cloneDeep from 'lodash.clonedeep';
import { DepGraph } from '@snyk/dep-graph';
import { ArgsOptions, MethodArgs } from '../cli/args';

export function countPathsToGraphRoot(graph: DepGraph): number {
  return graph
    .getPkgs()
    .reduce((acc, pkg) => acc + graph.countPathsToRoot(pkg), 0);
}

export function sanitize(
  args: ArgsOptions | MethodArgs,
): ArgsOptions | MethodArgs {
  const sanitizedArgs = cloneDeep(args);
  if (sanitizedArgs['username']) {
    sanitizedArgs['username'] = 'username-set';
  }
  if (sanitizedArgs[1] && sanitizedArgs[1]['username']) {
    sanitizedArgs[1]['username'] = 'username-set';
  }

  if (sanitizedArgs['password']) {
    sanitizedArgs['password'] = 'password-set';
  }
  if (sanitizedArgs[1] && sanitizedArgs[1]['password']) {
    sanitizedArgs[1]['password'] = 'password-set';
  }

  return sanitizedArgs;
}
