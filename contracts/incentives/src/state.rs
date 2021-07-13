use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use cosmwasm_std::{CanonicalAddr, Decimal, Storage, Uint128};
use cosmwasm_storage::{
    bucket, bucket_read, singleton, singleton_read, Bucket, ReadonlyBucket, ReadonlySingleton,
    Singleton,
};

// keys (for singleton)
pub static CONFIG_KEY: &[u8] = b"config";

// namespaces (for buckets)
pub static ASSET_INCENTIVES_NAMESPACE: &[u8] = b"asset_data";
pub static USER_ASSET_INDICES_NAMESPACE: &[u8] = b"user_asset_indices";
pub static USER_UNCLAIMED_REWARDS_NAMESPACE: &[u8] = b"user_unclaimed_rewards";

/// Global configuration
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    /// Contract owner
    pub owner: CanonicalAddr,
    /// Address provider returns addresses for all protocol contracts
    pub address_provider_address: CanonicalAddr,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct AssetIncentive {
    pub emission_per_second: Uint128,
    pub index: Decimal,
    pub last_updated: u64,
}

pub fn config<S: Storage>(storage: &mut S) -> Singleton<S, Config> {
    singleton(storage, CONFIG_KEY)
}

pub fn config_read<S: Storage>(storage: &S) -> ReadonlySingleton<S, Config> {
    singleton_read(storage, CONFIG_KEY)
}

pub fn asset_incentives<S: Storage>(storage: &mut S) -> Bucket<S, AssetIncentive> {
    bucket(ASSET_INCENTIVES_NAMESPACE, storage)
}

pub fn asset_incentives_read<S: Storage>(storage: &S) -> ReadonlyBucket<S, AssetIncentive> {
    bucket_read(ASSET_INCENTIVES_NAMESPACE, storage)
}

pub fn user_asset_indices<'a, S: Storage>(
    storage: &'a mut S,
    user_reference: &[u8],
) -> Bucket<'a, S, Decimal> {
    Bucket::multilevel(&[USER_ASSET_INDICES_NAMESPACE, user_reference], storage)
}

pub fn user_asset_indices_read<'a, S: Storage>(
    storage: &'a S,
    user_reference: &[u8],
) -> ReadonlyBucket<'a, S, Decimal> {
    ReadonlyBucket::multilevel(&[USER_ASSET_INDICES_NAMESPACE, user_reference], storage)
}

pub fn user_unclaimed_rewards<S: Storage>(storage: &mut S) -> Bucket<S, Uint128> {
    bucket(USER_UNCLAIMED_REWARDS_NAMESPACE, storage)
}

pub fn user_unclaimed_rewards_read<S: Storage>(storage: &S) -> ReadonlyBucket<S, Uint128> {
    bucket_read(USER_UNCLAIMED_REWARDS_NAMESPACE, storage)
}