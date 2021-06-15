import * as config from '../config';
import { isCI } from '../is-ci';
import { makeRequest } from '../request/promise';
import { Options } from '../types';

import { ResolveAndTestFactsResponse } from '../snyk-test/legacy';
import { assembleQueryString } from '../snyk-test/common';
import { getAuthHeader } from '../api-token';
import { ScanResult } from './types';

export async function pollingRequestToken(
  options: Options,
  isAsync: boolean,
  scanResult: ScanResult,
): Promise<ResolveAndTestFactsResponse> {
  const payload = {
    method: 'POST',
    url: `${config.API}/test-dependencies`,
    json: true,
    headers: {
      'x-is-ci': isCI(),
      authorization: getAuthHeader(),
    },
    body: {
      isAsync,
      scanResult,
    },
    qs: assembleQueryString(options),
  };
  const response = await makeRequest<ResolveAndTestFactsResponse>(payload);
  return response;
}

export async function pollingWithTokenUntilDone(
  token: string,
  type: string,
  options: Options,
  pollInterval: number,
  attemptsCount: number,
  maxAttempts = Infinity,
) {
  const payload = {
    method: 'GET',
    url: `${config.API}/test-dependencies/${token}`,
    json: true,
    headers: {
      'x-is-ci': isCI(),
      authorization: getAuthHeader(),
    },
    qs: { ...assembleQueryString(options), type },
  };

  ++attemptsCount;

  const response = await makeRequest<ResolveAndTestFactsResponse>(payload);

  if (response.result && response.meta) {
    return response;
  }

  return new Promise((resolve) =>
    setTimeout(async () => {
      checkPollingAttempts(maxAttempts)(attemptsCount);
      resolve(
        await pollingWithTokenUntilDone(
          token,
          type,
          options,
          pollInterval,
          maxAttempts,
          attemptsCount,
        ),
      );
    }, pollInterval),
  );
}

function checkPollingAttempts(maxAttempts: number) {
  return (attemptsCount: number) => {
    if (attemptsCount > maxAttempts) {
      throw new Error('Exceeded Polling maxAttempts');
    }
  };
}
