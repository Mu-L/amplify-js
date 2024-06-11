// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface SyncKeyValueStorageInterface {
	setItem(key: string, value: string): void;
	getItem(key: string): string | null;
	removeItem(key: string): void;
	clear(): void;
}
