// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Subscription } from 'rxjs';
import { Amplify } from '@aws-amplify/core';
import { DocumentType, amplifyUuid } from '@aws-amplify/core/internals/utils';

import { AppSyncEventProvider as eventProvider } from '../../Providers/AWSAppSyncEventsProvider';

import { appsyncRequest } from './appsyncRequest';
import { configure, normalizeAuth, serializeEvents } from './utils';
import type {
	EventsChannel,
	EventsOptions,
	PublishResponse,
	PublishedEvent,
	SubscriptionObserver,
} from './types';

const openChannels = new Set<string>();

/**
 * @experimental API may change in future versions
 *
 * Establish a WebSocket connection to an Events channel
 *
 * @example
 * const channel = await events.connect("default/channel")
 *
 * channel.subscribe({
 *   next: (data) => { console.log(data) },
 *   error: (err) => { console.error(err) },
 * })
 *
 * @example // authMode override
 * const channel = await events.connect("default/channel", { authMode: "userPool" })
 *
 * @param channel - channel path; `<namespace>/<channel>`
 * @param options - request overrides: `authMode`, `authToken`
 *
 */
async function connect(
	channel: string,
	options?: EventsOptions,
): Promise<EventsChannel> {
	const providerOptions = configure();

	providerOptions.authenticationType = normalizeAuth(
		options?.authMode,
		providerOptions.authenticationType,
	);

	await eventProvider.connect(providerOptions);

	const channelUuid = amplifyUuid();
	openChannels.add(channelUuid);

	let _subscription: Subscription;

	const sub = (
		observer: SubscriptionObserver<any>,
		subOptions?: EventsOptions,
	): Subscription => {
		const subscribeOptions = { ...providerOptions, query: channel };
		subscribeOptions.authenticationType = normalizeAuth(
			subOptions?.authMode,
			subscribeOptions.authenticationType,
		);

		_subscription = eventProvider
			.subscribe(subscribeOptions)
			.subscribe(observer);

		return _subscription;
	};

	const pub = async (
		event: DocumentType,
		pubOptions?: EventsOptions,
	): Promise<any> => {
		if (!openChannels.has(channelUuid)) {
			return; // TODO something different from this?
		}
		const publishOptions = {
			...providerOptions,
			query: channel,
			variables: event,
		};
		publishOptions.authenticationType = normalizeAuth(
			pubOptions?.authMode,
			publishOptions.authenticationType,
		);

		return eventProvider.publish(publishOptions);
	};

	const close = () => {
		_subscription && _subscription.unsubscribe();
		openChannels.delete(channelUuid);
		console.log('Here');
		if (openChannels.size === 0) {
			eventProvider.closeIfNoSubscriptions();
		}
	};

	return {
		subscribe: sub,
		close,
		publish: pub,
	};
}

/**
 * @experimental API may change in future versions
 *
 * Publish events to a channel via HTTP request
 *
 * @example
 * await events.post("default/channel", { some: "event" })
 *
 * @example // event batching
 * await events.post("default/channel", [{ some: "event" }, { some: "event2" }])
 *
 * @example // authMode override
 * await events.post("default/channel", { some: "event" }, { authMode: "userPool" })
 *
 * @param channel - channel path; `<namespace>/<channel>`
 * @param event - JSON-serializable value or an array of values
 * @param options - request overrides: `authMode`, `authToken`
 *
 * @returns void on success
 * @throws on error
 */
async function post(
	channel: string,
	event: DocumentType | DocumentType[],
	options?: EventsOptions,
): Promise<void | PublishedEvent[]> {
	const providerOptions = configure();
	providerOptions.authenticationType = normalizeAuth(
		options?.authMode,
		providerOptions.authenticationType,
	);

	// trailing slash required in publish
	const normalizedChannelName = channel[0] === '/' ? channel : `/${channel}`;

	const publishOptions = {
		...providerOptions,
		query: normalizedChannelName,
		variables: serializeEvents(event),
		authToken: options?.authToken,
	};

	const abortController = new AbortController();

	const res = await appsyncRequest<PublishResponse>(
		Amplify,
		publishOptions,
		{},
		abortController,
	);

	if (res.failed?.length > 0) {
		return res.failed;
	}
}

/**
 * @experimental API may change in future versions
 *
 * Close WebSocket connection, disconnect listeners and reconnect observers
 *
 * @example
 * await events.closeAll()
 *
 * @returns void on success
 * @throws on error
 */
async function closeAll(): Promise<void> {
	await eventProvider.close();
}

export { connect, post, closeAll };
