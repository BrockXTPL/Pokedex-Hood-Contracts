CREATE TABLE `contractConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`chainId` int NOT NULL,
	`rpcUrl` text NOT NULL,
	`liquidityPoolAddress` varchar(42),
	`marketAddress` varchar(42),
	`oracleAddress` varchar(42),
	`abiJson` text NOT NULL,
	`isConfigured` boolean NOT NULL DEFAULT false,
	`lastIndexedBlock` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contractConfigs_id` PRIMARY KEY(`id`),
	CONSTRAINT `contract_configs_market_unique` UNIQUE(`marketId`)
);
--> statement-breakpoint
CREATE TABLE `contributions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`walletAddress` varchar(42) NOT NULL,
	`amountWei` varchar(78) NOT NULL,
	`amountEth` decimal(36,18) NOT NULL,
	`transactionHash` varchar(66) NOT NULL,
	`chainId` int NOT NULL,
	`blockNumber` varchar(32),
	`contributionStatus` enum('pending','confirmed','failed') NOT NULL DEFAULT 'pending',
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`confirmedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contributions_id` PRIMARY KEY(`id`),
	CONSTRAINT `contributions_tx_hash_unique` UNIQUE(`transactionHash`)
);
--> statement-breakpoint
CREATE TABLE `indexComponents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`providerCardId` varchar(96) NOT NULL,
	`cardNumber` varchar(32) NOT NULL,
	`cardName` varchar(128) NOT NULL,
	`approvedVariant` varchar(64) NOT NULL,
	`weight` decimal(20,10) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `indexComponents_id` PRIMARY KEY(`id`),
	CONSTRAINT `index_components_market_card_unique` UNIQUE(`marketId`,`providerCardId`,`approvedVariant`)
);
--> statement-breakpoint
CREATE TABLE `indexSnapshots` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`indexIdentifier` varchar(96) NOT NULL,
	`indexValue` decimal(20,8) NOT NULL,
	`weightedMarketValueUsd` decimal(20,8) NOT NULL,
	`baselineMarketValueUsd` decimal(20,8) NOT NULL,
	`componentCount` int NOT NULL,
	`componentData` text NOT NULL,
	`dataProvider` varchar(64) NOT NULL,
	`calculationVersion` varchar(32) NOT NULL,
	`methodologyVersion` varchar(32) NOT NULL,
	`oracleUpdateStatus` varchar(32) NOT NULL,
	`oracleUpdatedAt` timestamp,
	`providerUpdatedAt` timestamp,
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `indexSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketAuditEvents` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`actorOpenId` varchar(64) NOT NULL,
	`action` varchar(96) NOT NULL,
	`detail` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketAuditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `markets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`setCode` varchar(64) NOT NULL,
	`marketNetwork` enum('testnet','mainnet') NOT NULL,
	`marketLifecycle` enum('configuration_pending','funding','ready','active','paused','locked') NOT NULL DEFAULT 'configuration_pending',
	`fundingTargetWei` varchar(78) NOT NULL,
	`baseSetValidated` boolean NOT NULL DEFAULT false,
	`adminApproved` boolean NOT NULL DEFAULT false,
	`scheduleCronTaskUid` varchar(65),
	`oracleIntervalMinutes` int NOT NULL DEFAULT 60,
	`maximumOracleAgeMinutes` int NOT NULL DEFAULT 180,
	`lastContributionSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `markets_id` PRIMARY KEY(`id`),
	CONSTRAINT `markets_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `priceObservations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`componentId` int NOT NULL,
	`cardName` varchar(128) NOT NULL,
	`cardSet` varchar(128) NOT NULL,
	`cardNumber` varchar(32) NOT NULL,
	`variant` varchar(64) NOT NULL,
	`condition` varchar(64),
	`gradingCompany` varchar(64),
	`grade` varchar(32),
	`marketPriceUsd` decimal(20,8) NOT NULL,
	`source` varchar(64) NOT NULL,
	`sourceTimestamp` timestamp,
	`apiResponseIdentifier` varchar(160) NOT NULL,
	`retrievedAt` timestamp NOT NULL DEFAULT (now()),
	`rawPayload` text NOT NULL,
	CONSTRAINT `priceObservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','user') NOT NULL DEFAULT 'user';--> statement-breakpoint
CREATE INDEX `contract_configs_chain_idx` ON `contractConfigs` (`chainId`);--> statement-breakpoint
CREATE INDEX `contributions_market_recorded_idx` ON `contributions` (`marketId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `contributions_wallet_idx` ON `contributions` (`walletAddress`);--> statement-breakpoint
CREATE INDEX `index_components_market_idx` ON `indexComponents` (`marketId`);--> statement-breakpoint
CREATE INDEX `index_snapshots_market_observed_idx` ON `indexSnapshots` (`marketId`,`observedAt`);--> statement-breakpoint
CREATE INDEX `market_audit_market_created_idx` ON `marketAuditEvents` (`marketId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `markets_network_idx` ON `markets` (`marketNetwork`);--> statement-breakpoint
CREATE INDEX `price_observations_market_retrieved_idx` ON `priceObservations` (`marketId`,`retrievedAt`);--> statement-breakpoint
CREATE INDEX `price_observations_component_idx` ON `priceObservations` (`componentId`);