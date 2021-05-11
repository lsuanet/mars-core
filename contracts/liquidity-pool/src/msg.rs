use cosmwasm_bignumber::{Decimal256, Uint256};
use cosmwasm_std::{HumanAddr, Uint128};
use cw20::Cw20ReceiveMsg;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InitMsg {
    pub ma_token_code_id: u64,
    pub close_factor: Decimal256,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HandleMsg {
    /// Implementation of cw20 receive msg
    Receive(Cw20ReceiveMsg),

    /// Initialize an asset on the money market
    InitAsset {
        /// Asset related info
        asset: Asset,
        /// Asset parameters
        asset_params: InitAssetParams,
    },
    /// Callback sent from maToken contract after instantiated
    InitAssetTokenCallback {
        /// Either the denom for a terra native asset or address for a cw20 token
        reference: Vec<u8>,
    },
    /// Deposit Terra native coins
    DepositNative {
        /// Denom used in Terra (e.g: uluna, uusd)
        denom: String,
    },
    /// Borrow Terra native coins
    Borrow {
        /// Denom used in Terra (e.g: uluna, uusd)
        asset: Asset,
        amount: Uint256,
    },
    /// Repay Terra native coins loan
    RepayNative {
        /// Denom used in Terra (e.g: uluna, uusd)
        denom: String,
    },
    /// Liquidate under-collateralized native loans
    LiquidateNative {
        /// Details for collateral asset
        collateral_asset: Asset,
        /// Denom used in Terra (e.g: uluna, uusd) of the debt asset
        debt_asset: String,
        /// The address of the borrower getting liquidated
        user_address: HumanAddr,
        /// Sends maAsset to liquidator if true and underlying collateral asset if false
        receive_ma_token: bool,
    },
    /// Increase uncollateralized loan allowance
    IncreaseAllowance {
        user: HumanAddr,
        asset: Asset,
        amount: Uint128,
    },
    /// Decrease uncollateralized loan allowance
    DecreaseAllowance {
        user: HumanAddr,
        asset: Asset,
        amount: Uint128,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReceiveMsg {
    /// Redeem the sent tokens for the underlying asset
    Redeem {},
    /// Deposit the sent cw20 tokens
    DepositCw20 {},
    /// Repay the sent cw20 tokens
    RepayCw20 {},
    /// Use the sent cw20 tokens to pay off a specified user's under-collateralized cw20 loan
    LiquidateCw20 {
        /// Details for collateral asset
        collateral_asset: Asset,
        /// Token address of the debt asset
        debt_asset_address: HumanAddr,
        /// The address of the borrower getting liquidated
        user_address: HumanAddr,
        /// Sends maAsset to liquidator if true and underlying collateral asset if false
        receive_ma_token: bool,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    Config {},
    Reserve { asset: Asset },
    ReservesList {},
    Debt { address: HumanAddr },
}

// We define a custom struct for each query response
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ConfigResponse {
    pub ma_token_code_id: u64,
    pub reserve_count: u32,
    pub close_factor: Decimal256,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ReserveResponse {
    pub ma_token_address: HumanAddr,
    pub borrow_index: Decimal256,
    pub liquidity_index: Decimal256,
    pub borrow_rate: Decimal256,
    pub liquidity_rate: Decimal256,
    pub borrow_slope: Decimal256,
    pub loan_to_value: Decimal256,
    pub interests_last_updated: u64,
    pub debt_total_scaled: Uint256,
    pub asset_type: AssetType,
    pub liquidation_threshold: Decimal256,
    pub liquidation_bonus: Decimal256,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ReservesListResponse {
    pub reserves_list: Vec<ReserveInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ReserveInfo {
    pub denom: String,
    pub ma_token_address: HumanAddr,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct DebtResponse {
    pub debts: Vec<DebtInfo>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct DebtInfo {
    pub denom: String,
    pub amount: Uint256,
}

/// We currently take no arguments for migrations
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct MigrateMsg {}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InitAssetParams {
    /// Borrow slope to calculate borrow rate
    pub borrow_slope: Decimal256,
    /// Max percentage of collateral that can be borrowed
    pub loan_to_value: Decimal256,
    // Percentage at which the loan is defined as under-collateralized
    pub liquidation_threshold: Decimal256,
    // Bonus on the price of assets of the collateral when liquidators purchase it
    pub liquidation_bonus: Decimal256,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Asset {
    Cw20 { contract_addr: HumanAddr },
    Native { denom: String },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum AssetType {
    Cw20,
    Native,
}
