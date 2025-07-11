// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Amplify } from '../Amplify';
import { AuthSession, FetchAuthSessionOptions } from '../Auth/types';

import { fetchAuthSession as fetchAuthSessionInternal } from './internal/fetchAuthSession';

/**
 * Fetch the auth session including the tokens and credentials if they are available. By default it
 * will automatically refresh expired auth tokens if a valid refresh token is present. You can force a refresh
 * of non-expired tokens with `{ forceRefresh: true }` input.
 *
 * @param options - Options configuring the fetch behavior.
 * @throws {@link AuthError} - Throws error when session information cannot be refreshed.
 * @returns Promise<AuthSession>
 */
export const fetchAuthSession = (
	options?: FetchAuthSessionOptions,
): Promise<AuthSession> => {
	return fetchAuthSessionInternal(Amplify, options);
};
