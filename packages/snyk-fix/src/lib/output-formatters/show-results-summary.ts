import * as chalk from 'chalk';

import { FixHandlerResultByPlugin } from '../../plugins/types';
import { EntityToFix, ErrorsByEcoSystem, Issue, TestResult } from '../../types';
import { contactSupportMessage, reTryMessage } from '../errors/common';
import { convertErrorToUserMessage } from '../errors/error-to-user-message';
import { hasFixableIssues } from '../issues/fixable-issues';
import { getIssueCountBySeverity } from '../issues/issues-by-severity';
import { getTotalIssueCount } from '../issues/total-issues-count';
import { formatChangesSummary } from './format-successful-item';
import { formatUnresolved } from './format-unresolved-item';
export const PADDING_SPACE = '  '; // 2 spaces

export async function showResultsSummary(
  nothingToFix: EntityToFix[],
  fixed: FixHandlerResultByPlugin,
  exceptions: ErrorsByEcoSystem,
  total: number,
): Promise<string> {
  const successfulFixesSummary = generateSuccessfulFixesSummary(fixed);
  const {
    summary: unresolvedSummary,
    count: unresolvedCount,
  } = generateUnresolvedSummary(fixed, exceptions);
  const {
    summary: overallSummary,
    count: changedCount,
  } = generateOverallSummary(fixed, exceptions, nothingToFix);

  const getHelpText = chalk.red(`\n${reTryMessage}. ${contactSupportMessage}`);

  // called without any `snyk test` results
  if (total === 0) {
    return `\n${chalk.green('✔ Nothing to fix')}`;
  }

  // 100% not vulnerable and had no errors/unsupported
  if (nothingToFix.length === total && unresolvedCount === 0) {
    return `\n${chalk.green(
      '✔ No vulnerable items to fix',
    )}\n\n${overallSummary}`;
  }

  return `\n${successfulFixesSummary}${unresolvedSummary}${
    unresolvedCount || changedCount ? `\n\n${overallSummary}` : ''
  }${unresolvedSummary ? `\n\n${getHelpText}` : ''}`;
}

export function generateSuccessfulFixesSummary(
  fixed: FixHandlerResultByPlugin,
): string {
  const sectionTitle = 'Successful fixes:';
  const formattedTitleHeader = `${chalk.bold(sectionTitle)}`;
  let summary = '';

  for (const plugin of Object.keys(fixed)) {
    const fixedSuccessfully = fixed[plugin].succeeded;
    if (fixedSuccessfully.length > 0) {
      summary +=
        '\n\n' +
        fixedSuccessfully
          .map((s) => formatChangesSummary(s.original, s.changes))
          .join('\n\n');
    }
  }
  if (summary) {
    return formattedTitleHeader + summary;
  }
  return chalk.red(' ✖ No successful fixes');
}

export function generateUnresolvedSummary(
  fixed: FixHandlerResultByPlugin,
  exceptions: ErrorsByEcoSystem,
): { summary: string; count: number } {
  const title = 'Unresolved items:';
  const formattedTitle = `${chalk.bold(title)}`;
  let summary = '';
  let count = 0;

  for (const plugin of Object.keys(fixed)) {
    const skipped = fixed[plugin].skipped;
    if (skipped.length > 0) {
      count += skipped.length;
      summary +=
        '\n\n' +
        skipped
          .map((s) => formatUnresolved(s.original, s.userMessage))
          .join('\n\n');
    }
    const failed = fixed[plugin].failed;
    if (failed.length > 0) {
      count += failed.length;
      summary +=
        '\n\n' +
        failed
          .map((s) =>
            formatUnresolved(
              s.original,
              convertErrorToUserMessage(s.error),
              s.tip,
            ),
          )
          .join('\n\n');
    }
  }

  if (Object.keys(exceptions).length) {
    for (const ecosystem of Object.keys(exceptions)) {
      const unresolved = exceptions[ecosystem];
      count += unresolved.originals.length;
      summary +=
        '\n\n' +
        unresolved.originals
          .map((s) => formatUnresolved(s, unresolved.userMessage))
          .join('\n\n');
    }
  }
  if (summary) {
    return { summary: `\n\n${formattedTitle}${summary}`, count };
  }
  return { summary: '', count: 0 };
}

export function generateOverallSummary(
  fixedResults: FixHandlerResultByPlugin,
  exceptions: ErrorsByEcoSystem,
  nothingToFix: EntityToFix[],
): { summary: string; count: number } {
  const sectionTitle = 'Summary:';
  const formattedTitleHeader = `${chalk.bold(sectionTitle)}`;
  const fixed = calculateFixed(fixedResults);
  const failed = calculateFailed(fixedResults, exceptions);

  const vulnsSummary = generateIssueSummary(fixedResults, exceptions);

  const notVulnerableSummary =
    nothingToFix.length > 0
      ? `\n${PADDING_SPACE}${nothingToFix.length} items were not vulnerable`
      : '';

  return {
    summary: `${formattedTitleHeader}\n\n${PADDING_SPACE}${chalk.bold.red(
      failed,
    )} items were not fixed\n${PADDING_SPACE}${chalk.green.bold(
      fixed,
    )} items were successfully fixed${notVulnerableSummary}\n${vulnsSummary}`,
    count: fixed + failed,
  };
}

export function calculateFixed(fixedResults: FixHandlerResultByPlugin): number {
  let fixed = 0;
  for (const plugin of Object.keys(fixedResults)) {
    fixed += fixedResults[plugin].succeeded.length;
  }
  return fixed;
}

export function calculateFixedIssues(fixed: FixHandlerResultByPlugin): number {
  const fixedIssues: string[] = [];
  for (const plugin of Object.keys(fixed)) {
    for (const entity of fixed[plugin].succeeded) {
      // count unique vulns fixed per scanned entity
      // some fixed may need to be made in multiple places
      // and would count multiple times otherwise.
      const fixedPerEntity = new Set<string>();
      entity.changes
        .filter((c) => c.success)
        .forEach((c) => {
          c.issueIds.map((i) => fixedPerEntity.add(i));
        });
      fixedIssues.push(...Array.from(fixedPerEntity));
    }
  }

  return fixedIssues.length;
}

export function calculateFailed(
  fixed: FixHandlerResultByPlugin,
  exceptions: ErrorsByEcoSystem,
): number {
  let failed = 0;
  for (const plugin of Object.keys(fixed)) {
    const results = fixed[plugin];
    failed += results.failed.length + results.skipped.length;
  }

  if (Object.keys(exceptions).length) {
    for (const ecosystem of Object.keys(exceptions)) {
      const unresolved = exceptions[ecosystem];
      failed += unresolved.originals.length;
    }
  }
  return failed;
}

export function formatIssueCountBySeverity({
  critical,
  high,
  medium,
  low,
}: {
  [severity: string]: number;
}): string {
  const summary: string[] = [];
  if (critical && critical > 0) {
    summary.push(
      severitiesColourMapping.critical.colorFunc(`${critical} Critical`),
    );
  }
  if (high && high > 0) {
    summary.push(severitiesColourMapping.high.colorFunc(`${high} High`));
  }
  if (medium && medium > 0) {
    summary.push(severitiesColourMapping.medium.colorFunc(`${medium} Medium`));
  }
  if (low && low > 0) {
    summary.push(severitiesColourMapping.low.colorFunc(`${low} Low`));
  }

  return summary.join(' | ');
}

export const severitiesColourMapping: {
  [severity: string]: {
    colorFunc: (arg: string) => string;
  };
} = {
  low: {
    colorFunc(text) {
      return chalk.hex('#BCBBC8')(text);
    },
  },
  medium: {
    colorFunc(text) {
      return chalk.hex('#EDD55E')(text);
    },
  },
  high: {
    colorFunc(text) {
      return chalk.hex('#FF872F')(text);
    },
  },
  critical: {
    colorFunc(text) {
      return chalk.hex('#FF0B0B')(text);
    },
  },
};

export const defaultSeverityColor = {
  colorFunc(text) {
    return chalk.grey(text);
  },
};

export function getSeveritiesColour(severity: string) {
  return severitiesColourMapping[severity] ?? defaultSeverityColor;
}

export function generateIssueSummary(
  fixed: FixHandlerResultByPlugin,
  exceptions: ErrorsByEcoSystem,
): string {
  const testResults: TestResult[] = getTestResults(fixed, exceptions);

  const issueData = testResults.map((i) => i.issuesData);
  const bySeverity = getIssueCountBySeverity(issueData);

  const issuesBySeverityMessage = formatIssueCountBySeverity({
    critical: bySeverity.critical.length,
    high: bySeverity.high.length,
    medium: bySeverity.medium.length,
    low: bySeverity.low.length,
  });

  // can't use .flat() or .flatMap() because it's not supported in Node 10
  const issues: Issue[] = [];
  for (const result of testResults) {
    issues.push(...result.issues);
  }

  let totalIssues = `${chalk.bold(getTotalIssueCount(issueData))} total issues`;
  if (issuesBySeverityMessage) {
    totalIssues += `: ${issuesBySeverityMessage}`;
  }

  const { count: fixableCount } = hasFixableIssues(testResults);
  const fixableIssues = `${chalk.bold(fixableCount)} fixable issues`;

  const fixedIssuesSummary = `${chalk.bold(
    calculateFixedIssues(fixed),
  )} fixed issues`;

  return `${PADDING_SPACE}${totalIssues}\n${PADDING_SPACE}${fixableIssues}\n${PADDING_SPACE}${fixedIssuesSummary}`;
}

function getTestResults(
  fixed: FixHandlerResultByPlugin,
  exceptions: ErrorsByEcoSystem,
): TestResult[] {
  const testResults: TestResult[] = [];
  for (const plugin of Object.keys(fixed)) {
    const { skipped, failed, succeeded } = fixed[plugin];
    testResults.push(...skipped.map((i) => i.original.testResult));
    testResults.push(...failed.map((i) => i.original.testResult));
    testResults.push(...succeeded.map((i) => i.original.testResult));
  }

  if (Object.keys(exceptions).length) {
    for (const ecosystem of Object.keys(exceptions)) {
      const unresolved = exceptions[ecosystem];
      testResults.push(...unresolved.originals.map((i) => i.testResult));
    }
  }
  return testResults;
}
