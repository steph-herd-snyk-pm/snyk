import {
  readFileSync,
  existsSync,
  unlinkSync,
  readdirSync,
  statSync,
} from 'fs';
import * as path from 'path';
const osName = require('os-name');
import { v4 as uuidv4 } from 'uuid';

import { startMockServer } from '../iac/helpers';

const ROOT_DIR = './test/fixtures';

export class GithubActionTestRunner {
  constructor(
    private command: string,
    private scanPath: string,
    private run: (
      cmd: string,
    ) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
    private teardown: () => void,
  ) {}

  static async build(
    product: string,
    relativeDir: string,
    inputPath: string,
  ): Promise<GithubActionTestRunner> {
    const command = buildCommand(product, relativeDir, inputPath);
    const scanPath = buildScanPath(relativeDir, inputPath);
    const { run, teardown } = await startMockServer();

    return new GithubActionTestRunner(command, scanPath, run, teardown);
  }

  public async destroy() {
    this.teardown();
  }

  public async test(flag: string) {
    const sarif = await this.runAndGenerateSARIF(flag);
    this.verifySARIFPaths(sarif);
  }

  private async runAndGenerateSARIF(flag: string): Promise<string> {
    const sarifOutputFilename = path.join(__dirname, `${uuidv4()}.sarif`);

    try {
      const { stderr } = await this.run(
        `${this.command} ${flag} --sarif-file-output=${sarifOutputFilename}`,
      );
      expect(stderr).toEqual('');

      return readFileSync(sarifOutputFilename, 'utf-8');
    } finally {
      if (existsSync(sarifOutputFilename)) {
        unlinkSync(sarifOutputFilename);
      }
    }
  }

  private async verifySARIFPaths(sarif: string) {
    const jsonObj = JSON.parse(sarif);

    const actualPaths: Set<string> = new Set();
    for await (const p of walk(this.scanPath)) {
      actualPaths.add('file://' + p.replace(/\\/g, '/')); // URIs should use forward slash, not backward slash
    }

    const generatedPaths: Set<string> = new Set();
    for (const run of jsonObj.runs) {
      const projectRoot = run.originalUriBaseIds.PROJECTROOT.uri;

      for (const result of run.results) {
        for (const loc of result.locations) {
          generatedPaths.add(
            projectRoot + loc.physicalLocation.artifactLocation.uri,
          );
        }
      }
    }

    for (const p of generatedPaths) {
      expect(actualPaths).toContainEqual(p);
    }
  }
}

async function* walk(dir: string) {
  if (!statSync(dir).isDirectory()) {
    yield dir;
    return;
  }
  const files = readdirSync(dir);
  for (const file of files) {
    const entry = path.join(dir, file);
    if (statSync(entry).isDirectory()) {
      yield* walk(entry);
    } else {
      yield entry;
    }
  }
}

function buildCommand(product: string, relativeDir: string, inputPath: string) {
  // Before running the command, check if we need to change into a different directory
  // And if it's windows we need to add /d
  const isWindows =
    osName()
      .toLowerCase()
      .indexOf('windows') === 0;
  const changeDir =
    relativeDir !== '' ? `cd ${isWindows ? '/d' : ''} ${relativeDir} &&` : '';
  return `${changeDir} snyk ${product} test ${path.join(inputPath)}`;
}

function buildScanPath(relativeDir: string, inputPath: string) {
  // The scan path is the location of the scanned files, at the input path relative to the working directory
  const workingDir = path.join(ROOT_DIR, relativeDir);
  return path.resolve(workingDir, inputPath);
}
