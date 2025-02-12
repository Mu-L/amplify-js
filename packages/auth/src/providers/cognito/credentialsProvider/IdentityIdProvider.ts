// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AuthTokens, ConsoleLogger, Identity, getId } from '@aws-amplify/core';
import { CognitoIdentityPoolConfig } from '@aws-amplify/core/internals/utils';

import { AuthError } from '../../../errors/AuthError';
import { getRegionFromIdentityPoolId } from '../../../foundation/parsers';
import { GetIdException } from '../types/errors';

import { IdentityIdStore } from './types';
import { formLoginsMap } from './utils';

const logger = new ConsoleLogger('CognitoIdentityIdProvider');
/**
 * Provides a Cognito identityId
 *
 * @param tokens - The AuthTokens received after SignIn
 * @returns string
 * @throws configuration exceptions: `InvalidIdentityPoolIdException`
 *  - Auth errors that may arise from misconfiguration.
 * @throws service exceptions: {@link GetIdException }
 */
export async function cognitoIdentityIdProvider({
	tokens,
	authConfig,
	identityIdStore,
}: {
	tokens?: AuthTokens;
	authConfig: CognitoIdentityPoolConfig;
	identityIdStore: IdentityIdStore;
}): Promise<string> {
	identityIdStore.setAuthConfig({ Cognito: authConfig });

	// will return null only if there is no identityId cached or if there is an error retrieving it
	const identityId: Identity | null = await identityIdStore.loadIdentityId();

	if (identityId) {
		logger.debug('Cached identityId found.');

		return identityId.id;
	} else {
		logger.debug('Generating a new identityId as it was not found in cache.');

		let generatedIdentityId;
		if (tokens) {
			const logins = tokens.idToken
				? formLoginsMap(tokens.idToken.toString())
				: {};

			generatedIdentityId = await generateIdentityId(logins, authConfig);
			// Store generated identityId
			identityIdStore.storeIdentityId({
				id: generatedIdentityId,
				type: 'primary',
			});
		} else {
			generatedIdentityId = await generateIdentityId({}, authConfig);
			// Store generated identityId
			identityIdStore.storeIdentityId({
				id: generatedIdentityId,
				type: 'guest',
			});
		}

		return generatedIdentityId;
	}
}

async function generateIdentityId(
	logins: Record<string, string>,
	authConfig: CognitoIdentityPoolConfig,
): Promise<string> {
	const identityPoolId = authConfig?.identityPoolId;
	const region = getRegionFromIdentityPoolId(identityPoolId);

	// IdentityId is absent so get it using IdentityPoolId with Cognito's GetId API
	const idResult =
		// for a first-time user, this will return a brand new identity
		// for a returning user, this will retrieve the previous identity assocaited with the logins
		(
			await getId(
				{
					region,
				},
				{
					IdentityPoolId: identityPoolId,
					Logins: logins,
				},
			)
		).IdentityId;
	if (!idResult) {
		throw new AuthError({
			name: 'GetIdResponseException',
			message: 'Received undefined response from getId operation',
			recoverySuggestion:
				'Make sure to pass a valid identityPoolId in the configuration.',
		});
	}

	return idResult;
}
