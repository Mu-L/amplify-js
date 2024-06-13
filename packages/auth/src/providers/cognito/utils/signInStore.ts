// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ConsoleLogger, syncSessionStorage } from '@aws-amplify/core';

import { CognitoAuthSignInDetails } from '../types';

import { ChallengeName } from './clients/CognitoIdentityProvider/types';

// TODO: replace all of this implementation with state machines
interface SignInState {
	username?: string;
	challengeName?: ChallengeName;
	signInSession?: string;
	signInDetails?: CognitoAuthSignInDetails;
}

type SignInAction =
	| { type: 'SET_INITIAL_STATE' }
	| { type: 'SET_SIGN_IN_STATE'; value: SignInState }
	| { type: 'SET_USERNAME'; value?: string }
	| { type: 'SET_CHALLENGE_NAME'; value?: ChallengeName }
	| { type: 'SET_SIGN_IN_SESSION'; value?: string };

type Store<State, Action> = (reducer: Reducer<State, Action>) => {
	getState(): ReturnType<Reducer<State, Action>>;
	dispatch(action: Action): void;
};

type Reducer<State, Action> = (state: State, action: Action) => State;

const logger = new ConsoleLogger('Auth signInStore');

// Minutes until stored session invalidates
const EXPIRATION_MINUTES = 3;
const MS_TO_EXPIRY = 1000 * 60 * EXPIRATION_MINUTES;
const signInStateKeys: Record<string, string> = {
	username: 'CognitoSignInState.username',
	challengeName: 'CognitoSignInState.challengeName',
	signInSession: 'CognitoSignInState.signInSession',
	expiry: 'CognitoSignInState.expiry',
};

const signInReducer: Reducer<SignInState, SignInAction> = (state, action) => {
	switch (action.type) {
		case 'SET_SIGN_IN_SESSION':
			return {
				...state,
				signInSession: action.value,
			};
		case 'SET_SIGN_IN_STATE':
			return {
				...action.value,
			};
		case 'SET_CHALLENGE_NAME':
			return {
				...state,
				challengeName: action.value,
			};
		case 'SET_USERNAME':
			return {
				...state,
				username: action.value,
			};
		case 'SET_INITIAL_STATE':
			return setInitialState();
		default:
			return state;
	}
};

const isExpired = (expiryDate: string): boolean => {
	const expiryTimestamp = Number(expiryDate);
	const currentTimestamp = Date.now();

	return expiryTimestamp <= currentTimestamp;
};

const clearPersistedSignInState = (keys: Record<string, string>) => {
	for (const key in keys) {
		syncSessionStorage.removeItem(key);
	}
};

// Clear saved sign in states from both memory and Synced Session Storage
export function cleanActiveSignInState(): void {
	signInStore.dispatch({ type: 'SET_INITIAL_STATE' });
	clearSignInStateKeysFromSessionStorage();
}

// Clear stored values for sign in state keys in Synced Session Storage
export function clearSignInStateKeysFromSessionStorage(): void {
	clearPersistedSignInState(signInStateKeys);
}

const getDefaultState = (): SignInState => ({
	username: undefined,
	challengeName: undefined,
	signInSession: undefined,
});

// Hydrate signInStore from Synced Session Storage
const setInitialState = (): SignInState => {
	const expiry = syncSessionStorage.getItem(signInStateKeys.expiry) as string;
	if (isExpired(expiry)) {
		logger.warn('Sign-in session expired');
		clearPersistedSignInState(signInStateKeys);

		return getDefaultState();
	}

	const username =
		syncSessionStorage.getItem(signInStateKeys.username) ?? undefined;

	const challengeName = (syncSessionStorage.getItem(
		signInStateKeys.challengeName,
	) ?? undefined) as ChallengeName;
	const signInSession =
		syncSessionStorage.getItem(signInStateKeys.signInSession) ?? undefined;

	return {
		username,
		challengeName,
		signInSession,
	};
};

const createStore: Store<SignInState, SignInAction> = reducer => {
	let currentState = reducer(getDefaultState(), { type: 'SET_INITIAL_STATE' });

	return {
		getState: () => currentState,
		dispatch: action => {
			currentState = reducer(currentState, action);
		},
	};
};

export const signInStore = createStore(signInReducer);

export function setActiveSignInState(state: SignInState): void {
	signInStore.dispatch({
		type: 'SET_SIGN_IN_STATE',
		value: state,
	});

	// Save the local state into Synced Session Storage
	persistSignInState(syncSessionStorage, state);
}

const persistSignInState = (
	storage = syncSessionStorage,
	{
		challengeName = '' as ChallengeName,
		signInSession = '',
		username = '',
	}: SignInState,
) => {
	storage.setItem(signInStateKeys.username, username);
	storage.setItem(signInStateKeys.challengeName, challengeName);
	storage.setItem(signInStateKeys.signInSession, signInSession);
	storage.setItem(signInStateKeys.expiry, String(Date.now() + MS_TO_EXPIRY));
};
