import { sanitize } from '../../../../src/lib/utils';
import { ArgsOptions, MethodArgs } from '../../../../src/cli/args';

describe('Sanitize args', () => {
  it('sanitize for args when has username and password', () => {
    const argsWithUsernameAndPassword: ArgsOptions = {
      _doubleDashArgs: [],
      _: ['snyk/goof-image:latest'],
      org: 'demo-org',
      username: 'fakeuser',
      password: 'fakepass',
      file: 'Dockerfile',
    };

    const resultWithFlag = sanitize(argsWithUsernameAndPassword) as ArgsOptions;

    expect(resultWithFlag.username).toEqual('username-set');
    expect(resultWithFlag.password).toEqual('password-set');
    expect(resultWithFlag._[0]).toEqual('snyk/goof-image:latest');
    expect(resultWithFlag.org).toEqual('demo-org');
    expect(resultWithFlag.file).toEqual('Dockerfile');
  });

  it('sanitize for args when has just username', () => {
    const argsWithUsernameAndPassword: ArgsOptions = {
      _doubleDashArgs: [],
      _: ['snyk/goof-image:latest'],
      org: 'demo-org',
      username: 'fakeuser',
      file: 'Dockerfile',
    };

    const resultWithFlag = sanitize(argsWithUsernameAndPassword) as ArgsOptions;

    expect(resultWithFlag.username).toEqual('username-set');
    expect(resultWithFlag.password).toBeUndefined();
    expect(resultWithFlag._[0]).toEqual('snyk/goof-image:latest');
    expect(resultWithFlag.org).toEqual('demo-org');
    expect(resultWithFlag.file).toEqual('Dockerfile');
  });

  it('sanitize for args.options._ ', () => {
    const argsWithUsernameAndPassword: MethodArgs = [
      'snyk/goof-image:latest',
      {
        _doubleDashArgs: [],
        _: ['snyk/goof-image:latest'],
        username: 'fakeuser',
        password: 'fakepass',
        debug: true,
        docker: true,
        experimental: true,
      },
    ];

    const resultWithFlag = sanitize(argsWithUsernameAndPassword);

    expect(resultWithFlag[0]).toEqual('snyk/goof-image:latest');
    expect(resultWithFlag[1].username).toEqual('username-set');
    expect(resultWithFlag[1].password).toEqual('password-set');
  });
});
